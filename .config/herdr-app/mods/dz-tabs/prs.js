// Pull requests for the active tab's terminal folders (else the space's folder), shown at the tab bar's right end.
// Repos: the folder itself and subfolders up to two levels down that are git checkouts (`find -maxdepth 3
// -name .git`; .git is a folder in a clone and a file in a worktree), e.g. backend/<service>. No deeper scan.
// For each repo, the PR of the branch checked out there (open, draft, merged or closed; newest first),
// skipping branches that can't have one (see branch()). Runs on the space's machine.
import { exec } from "herdr";

const LOCAL_EVERY = 15000;  // re-read repos and branches (local git only)
const REMOTE_EVERY = 120000; // ask GitHub again even if no branch changed

const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

async function repos(folder, on) {
  // node_modules is pruned (not entered at all), so depth 3 stays as fast as depth 2 (~30-40 ms).
  const r = await exec("find", [folder, "-maxdepth", "3", "-name", "node_modules", "-prune", "-o", "-name", ".git", "-print"], { on });
  return lines(r.stdout).map((p) => p.replace(/\/\.git$/, "")).sort();
}

// The branch worth asking GitHub about, or "" to skip the repo. Local git only, ~25 ms a repo.
// Skipped: the default branch, a branch never pushed (no upstream: no PR can exist), and a branch with no
// commits beyond the default branch (nothing to review; a PR merged with a merge commit drops out too).
async function branch(repo, on) {
  const git = (...args) => exec("git", ["-C", repo, ...args], { on });
  const [cur, def, up] = await Promise.all([
    git("branch", "--show-current"),
    git("symbolic-ref", "--short", "refs/remotes/origin/HEAD"),
    git("rev-parse", "--abbrev-ref", "@{u}"),
  ]);
  const name = cur.code === 0 ? cur.stdout.trim() : "";
  const main = def.code === 0 ? def.stdout.trim() : ""; // e.g. origin/main
  if (!name || up.code !== 0 || name === main.replace(/^origin\//, "") || ["main", "master"].includes(name)) return "";
  if (main) {
    const ahead = await git("rev-list", "--count", `${main}..HEAD`);
    if (ahead.code === 0 && Number(ahead.stdout.trim()) === 0) return "";
  }
  return name;
}

async function pr(repo, name, on) {
  const r = await exec("gh", ["pr", "list", "--head", name, "--state", "all", "--limit", "1",
    "--json", "number,title,url,state,isDraft"], { cwd: repo, on });
  if (r.code !== 0) return null;
  try { return JSON.parse(r.stdout)[0] ?? null; } catch { return null; }
}

// The folders to search: the active tab's terminals' current folders, else the space's folder.
export function foldersOf(space, panes) {
  const tab = space?.tabs?.find((c) => c.active)?.id;
  const cwds = [...new Set(panes.filter((p) => p.tab === tab && p.terminal && p.cwd).map((p) => p.cwd))].sort();
  return cwds.length ? cwds : space?.folder ? [space.folder] : [];
}

// One per set of folders: { sig, list: [{ repo, name, pr }], localAt, remoteAt, busy }.
export class PullRequests {
  constructor() { this.byKey = new Map(); }

  list(folders) { return this.byKey.get(folders.join("\n"))?.list ?? []; }

  // Called often (a cheap timer); does real work only when due. Resolves true when the list changed.
  async tick(space, folders) {
    if (!folders.length) return false;
    const key = folders.join("\n"), on = space?.machine ?? null, now = Date.now();
    const e = this.byKey.get(key) ?? { sig: null, list: [], localAt: 0, remoteAt: 0, busy: false };
    this.byKey.set(key, e);
    if (e.busy || now - e.localAt < LOCAL_EVERY) return false;
    e.busy = true;
    try {
      e.localAt = now;
      const found = [...new Set((await Promise.all(folders.map((f) => repos(f, on)))).flat())].sort();
      const branches = await Promise.all(found.map((r) => branch(r, on)));
      const pairs = found.map((r, i) => [r, branches[i]]).filter(([, b]) => b);
      const sig = JSON.stringify(pairs);
      if (sig === e.sig && now - e.remoteAt < REMOTE_EVERY) return false;
      const prs = await Promise.all(pairs.map(([r, b]) => pr(r, b, on)));
      const base = (p) => p.split("/").pop();
      const list = pairs.map(([r], i) => ({ repo: r, name: base(r), pr: prs[i] })).filter((x) => x.pr);
      const changed = JSON.stringify(list) !== JSON.stringify(e.list);
      Object.assign(e, { sig, list, remoteAt: now });
      return changed;
    } catch {
      return false; // offline machine, no git or gh: keep what was shown
    } finally {
      e.busy = false;
    }
  }
}

export const openUrl = (url) => exec("open", [url]); // the browser is on this computer, even for remote spaces
