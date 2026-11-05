// ⌘⇧N: a new Claude session in a new tab of the space in view, in that space's checkout (the project's main
// checkout or one of its worktrees, as ⌘N's dz-launch groups spaces). Nothing to ask: it opens, starts, closes.
// mod.json opens it with frame "none", so nothing shows.
import { View, div } from "gpui-kit";
import { spaces, panes, shared, focused, run, exec, props, closeOverlay, notify } from "herdr";

const inside = (path, dir) => Boolean(path && dir) && (path === dir || path.startsWith(dir.replace(/\/+$/, "") + "/"));
const projects = () => (Array.isArray(shared("projects")) ? shared("projects") : []);

// Where a space is now (its first terminal's live folder, else where it was made), as dz-launch says it.
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// The checkout that holds `dir`: the deepest of its project's main checkout and worktrees. Outside every
// project, `dir` itself.
async function checkout(dir) {
  const p = projects().filter((q) => inside(dir, q.path)).sort((x, y) => y.path.length - x.path.length)[0];
  if (!p) return dir;
  const r = await exec("git", ["-C", p.path, "worktree", "list", "--porcelain"]).catch(() => null);
  const roots = [p.path, ...(r?.code === 0 ? r.stdout.split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)) : [])];
  return roots.filter((w) => inside(dir, w)).sort((x, y) => y.length - x.length)[0] ?? p.path;
}

export default class Again extends View {
  init(_props, cx) {
    const f = focused(), space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    cx.spawn(async () => {
      try {
        if (!space) return notify({ title: "No space in view", level: "warning" });
        const dir = place(space, panes());
        if (!dir) return notify({ title: "Can't tell this space's folder", level: "warning" });
        run("tab.new", { space: space.id, folder: await checkout(dir), argv: ["claude"] });
      } finally {
        closeOverlay(props().overlay);
      }
    });
  }

  render() { return div().id("again").size_full(); }
}
