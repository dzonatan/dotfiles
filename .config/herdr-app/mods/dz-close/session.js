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

// Captures and keeps each agent's session ({ address, title, space, spaceName }); resolves with what it kept.
export async function keep(agents) {
  const found = (await Promise.all(agents.map(async (a) => {
    const s = await capture(a.address);
    return s && { ...s, title: a.title, space: a.space, spaceName: a.spaceName, at: Date.now() };
  }))).filter(Boolean);
  if (found.length) {
    const all = sessions();
    for (const s of found) {
      // One record per terminal: a /clear or /resume inside it replaced the session.
      for (const [id, o] of Object.entries(all)) if (o.address === s.address && o.created === s.created) delete all[id];
      all[s.id] = s;
    }
    setShared(KEY, all);
  }
  return found;
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
