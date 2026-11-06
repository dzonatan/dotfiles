// Settled Claude sessions that outlive their terminal. One copy per mod (dz-inbox, dz-close): a mod can't import
// outside its folder. Kept in shared("t3.sessions"), persisted by Herdr:
//   { [sessionId]: { id, address, created, cwd, title, space, spaceName, at } }
// `address` + `created` tie a record to its live terminal; once that terminal is gone the record shows in
// Settled as a closed session, and opening it runs `claude --resume <id>` in its folder.
import { hc, readTextFile, home, shared, setShared, spaces, panes, run, exec, notify } from "herdr";

export const KEY = "t3.sessions";
export const sessions = () => ({ ...(shared(KEY) ?? {}) });

// The Claude session a terminal runs now, from Claude's own ~/.claude/sessions/<pid>.json. null: not Claude.
export async function capture(address) {
  const r = await hc(["get", address, "--json"]).catch(() => null);
  if (!r || r.code !== 0) return null;
  const k = JSON.parse(r.stdout);
  const pid = k.foreground?.pid;
  if (!pid || k.status?.app !== "claude-code") return null;
  const text = await readTextFile(`${home()}/.claude/sessions/${pid}.json`).catch(() => null);
  if (!text) return null;
  const s = JSON.parse(text);
  if (!s.sessionId) return null;
  return { id: s.sessionId, address, created: k.created_ms ?? null, cwd: s.cwd || k.foreground.cwd || k.cwd };
}

// Scratch sessions (dz-launch's "No project") live in ~/.scratches/<date>-<random>, one folder each.
export const isScratch = (cwd) => {
  const root = `${home()}/.scratches/`;
  return Boolean(cwd) && cwd.startsWith(root) && cwd.length > root.length && !cwd.slice(root.length).includes("/");
};

// Whether anything was ever sent in a Claude session: Claude writes ~/.claude/projects/<cwd>/<id>.jsonl from the
// first message on, with a "user" entry per message. A failed check counts as used, so nothing is lost by mistake.
export async function used(id) {
  const r = await exec("sh", ["-c", 'grep -qs \'"type":"user"\' "$HOME"/.claude/projects/*/"$1".jsonl', "sh", id]).catch(() => null);
  return !r || (r.code !== 1 && r.code !== 2);
}

// Whether a folder's Claude project has any session with a message, by Claude's folder naming (/ and . become -).
async function folderUsed(cwd) {
  const dir = `${home()}/.claude/projects/${cwd.replace(/[/.]/g, "-")}`;
  const r = await exec("sh", ["-c", 'grep -qs \'"type":"user"\' "$1"/*.jsonl', "sh", dir]).catch(() => null);
  return !r || (r.code !== 1 && r.code !== 2);
}

// An empty scratch folder goes; rmdir leaves one with anything in it.
const drop = (cwd) => exec("rmdir", [cwd]).catch(() => null);

// Captures and keeps each agent's session ({ address, title, space, spaceName }); resolves with what it kept.
// A scratch session nobody wrote in isn't kept: it's returned with `empty: true` (so callers still end it),
// left out of Settled, and its folder removed.
export async function keep(agents) {
  const found = (await Promise.all(agents.map(async (a) => {
    const s = await capture(a.address);
    if (s && isScratch(s.cwd) && !(await used(s.id))) return { ...s, empty: true };
    return s && { ...s, title: a.title, space: a.space, spaceName: a.spaceName, at: Date.now() };
  }))).filter(Boolean);
  for (const s of found) if (s.empty) await drop(s.cwd);
  const kept = found.filter((s) => !s.empty);
  if (kept.length) {
    const all = sessions();
    for (const s of kept) {
      // One record per terminal: a /clear or /resume inside it replaced the session.
      for (const [id, o] of Object.entries(all)) if (o.address === s.address && o.created === s.created) delete all[id];
      all[s.id] = s;
    }
    setShared(KEY, all);
  }
  return found;
}

// Clears out scratch leftovers: closed sessions in a scratch nobody wrote in (dropped from Settled), and empty
// ~/.scratches folders no live terminal is in and no session with a message came from.
export async function prune(live) {
  const all = sessions();
  const empty = (await Promise.all(Object.values(all)
    .filter((s) => isScratch(s.cwd) && !liveIn(s, live.term))
    .map(async (s) => ((await used(s.id)) ? null : s)))).filter(Boolean);
  if (empty.length) forget((o) => empty.some((s) => s.id === o.id));
  for (const s of empty) await drop(s.cwd);
  const r = await exec("sh", ["-c", 'find "$HOME/.scratches" -mindepth 1 -maxdepth 1 -type d -empty 2>/dev/null']).catch(() => null);
  const keepers = new Set(Object.values(sessions()).map((s) => s.cwd));
  for (const dir of (r?.stdout ?? "").split("\n").filter(Boolean)) {
    if (!isScratch(dir) || keepers.has(dir) || live.cwds.some((c) => c === dir || c.startsWith(dir + "/"))) continue;
    if (!(await folderUsed(dir))) await drop(dir);
  }
}

export function forget(pred) {
  const all = sessions();
  let changed = false;
  for (const [id, s] of Object.entries(all)) if (pred(s)) { delete all[id]; changed = true; }
  if (changed) setShared(KEY, all);
}

// A record whose terminal is still the one it was captured from.
export const liveIn = (s, term) => {
  const k = term.get(s.address);
  return Boolean(k && k.state === "live" && (s.created == null || k.created_ms == null || k.created_ms === s.created));
};


// Resumes a closed session: a new tab in its space (or the space working in its folder), else a new space.
export async function resume(s) {
  const ok = await exec("test", ["-d", s.cwd]).then((r) => r.code === 0).catch(() => false);
  if (!ok) {
    notify({ title: "Can't resume the session", body: `${s.cwd} is gone. Forget it from Settled.`, level: "error" });
    return false;
  }
  const ps = panes(), sp = spaces().filter((x) => !x.machine);
  // Else the space whose first terminal works in that very folder: worktrees get their own spaces.
  const at = (x) => {
    const tabs = new Set(x.tabs.map((c) => c.id));
    return (ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || x.folder) === s.cwd;
  };
  const space = sp.find((x) => x.id === s.space) ?? sp.find(at) ?? null;
  const argv = ["claude", "--resume", s.id];
  if (space) {
    run("space.select", { id: space.id });
    run("tab.new", { space: space.id, folder: s.cwd, argv });
  } else {
    run("space.new", { ...(s.spaceName ? { name: s.spaceName } : {}), folder: s.cwd, argv, machine: "" });
  }
  forget((o) => o.id === s.id);
  return true;
}
