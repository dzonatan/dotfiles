// New Claude session (⌘N): pick a project (dz-projects' bookmarks) or none, then where in it:
// the checkout as it is, one of its worktrees, or a new worktree (`claude -w`). Starts Claude
// in a new tab of the space already working in that project, else in a new space named after it.
// No project: Claude starts in a fresh temporary folder, in a new space of its own ("Scratch <id>").
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { theme, spaces, panes, run, closeOverlay, openOverlay, props, shared, home, exec, readTextFile } from "herdr";

const NONE = { id: "none", name: "No project" };
const SCRATCH = "Scratch";
const NAME_OK = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

const projects = () => (Array.isArray(shared("projects")) ? shared("projects") : []);
const base = (p) => p.replace(/\/+$/, "").split("/").pop() || p;
const inside = (path, dir) => Boolean(path && dir) && (path === dir || path.startsWith(dir.replace(/\/+$/, "") + "/"));

// Where a space is now (its first terminal's live folder, else where it was made), as dz-spaces says it.
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// `git worktree list --porcelain`, the main checkout left out.
function parseWorktrees(text, main) {
  const out = [];
  for (const block of text.split(/\n\s*\n/)) {
    const w = {};
    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) w.path = line.slice(9);
      else if (line.startsWith("branch ")) w.branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "detached") w.branch = "detached";
      else if (line.startsWith("prunable")) w.prunable = true;
    }
    if (w.path && w.path !== main && !w.prunable) out.push({ ...w, name: base(w.path) });
  }
  return out;
}

export default class Launch extends View {
  init(_props, cx) {
    this.keys = cx.focus_handle();
    this.filter = "";
    this.col = "projects"; // or "options"
    this.opt = 0;
    this.info = {}; // project path -> { branch, worktrees, hook } | { error } | { loading }
    this.error = "";
    this.busy = false;
    this.search = InputState.new({ placeholder: "Search projects…" });
    this.search.on("change", (_e, cx) => { this.filter = this.search.value(); this.at = 0; this.opt = 0; this.error = ""; this.load(cx); cx.notify(); });
    this.search.on("submit", (_e, cx) => this.start(cx));
    this.wtName = InputState.new({ placeholder: "worktree name (blank: Claude picks one)" });
    this.wtName.on("change", (_e, cx) => { this.error = ""; cx.notify(); });
    this.wtName.on("submit", (_e, cx) => this.start(cx));
    // Always start on "No project" (first in the list).
    this.at = 0;
    this.search.focus();
    this.load(cx);
  }

  items() {
    const q = this.filter.toLowerCase();
    return [NONE, ...projects()].filter((p) => `${p.name} ${p.path ?? ""}`.toLowerCase().includes(q));
  }

  project() {
    const list = this.items();
    return list[Math.min(this.at, list.length - 1)] ?? null;
  }

  options() {
    const p = this.project();
    if (!p || p === NONE) return [];
    const info = this.info[p.path];
    return [{ kind: "current" }, { kind: "new" }, ...(info?.worktrees ?? []).map((w) => ({ kind: "existing", w }))];
  }

  load(cx) {
    const p = this.project();
    if (!p || p === NONE || this.info[p.path]) return;
    this.info[p.path] = { loading: true };
    cx.spawn(async (cx) => {
      const git = (args) => exec("git", ["-C", p.path, "--no-optional-locks", ...args]);
      try {
        const list = await git(["worktree", "list", "--porcelain"]);
        if (list.code !== 0) throw new Error(list.stderr.trim() || `${p.path} is not a git repository.`);
        let branch = (await git(["branch", "--show-current"])).stdout.trim();
        if (!branch) branch = `detached at ${(await git(["rev-parse", "--short", "HEAD"])).stdout.trim()}`;
        // A WorktreeCreate hook decides where `claude -w` puts worktrees; without one Claude
        // uses .claude/worktrees/<name>.
        const settings = await Promise.all([".claude/settings.json", ".claude/settings.local.json"]
          .map((f) => readTextFile(`${p.path}/${f}`).catch(() => null)));
        const hook = settings.some((s) => s?.includes("\"WorktreeCreate\""));
        this.info[p.path] = { branch, worktrees: parseWorktrees(list.stdout, p.path), hook };
      } catch (e) {
        this.info[p.path] = { error: String(e?.message ?? e) };
      }
      cx.notify();
    });
  }

  // The name `claude -w` finds an existing worktree by, or null when Claude doesn't own it
  // (then Claude just starts in its folder).
  claudeName(p, w) {
    const hook = this.info[p.path]?.hook;
    const rel = w.path.slice(p.path.length + 1);
    const m = /^(\.claude\/worktrees|\.worktrees)\/([^/]+)$/.exec(inside(w.path, p.path) ? rel : "");
    if (!m) return null;
    return (m[1] === ".worktrees") === Boolean(hook) ? m[2] : null;
  }

  select(at, cx) {
    this.at = at;
    this.opt = 0;
    this.error = "";
    this.load(cx);
    cx.notify();
  }

  focusColumn(col) {
    const o = this.options()[this.opt];
    this.col = col;
    if (col === "projects") this.search.focus();
    else if (o?.kind === "new") this.wtName.focus();
    else this.keys.focus();
  }

  pickOption(i, cx) {
    this.opt = i;
    this.error = "";
    this.focusColumn("options");
    cx.notify();
  }

  // What to run and where: { cwd, argv, tab } or an error string.
  plan(p) {
    if (p === NONE) return { argv: ["claude"], tab: null };
    const info = this.info[p.path];
    if (!info || info.loading) return "Still reading the project…";
    if (info.error) return info.error;
    const o = this.options()[this.opt] ?? { kind: "current" };
    // `checkout`: the folder the session ends up working in, which picks its space (null: not known yet).
    if (o.kind === "current") return { cwd: p.path, checkout: p.path, argv: ["claude"], tab: info.branch.startsWith("detached") ? null : info.branch };
    if (o.kind === "existing") {
      const name = this.claudeName(p, o.w);
      return name ? { cwd: p.path, checkout: o.w.path, argv: ["claude", "-w", name], tab: name }
        : { cwd: o.w.path, checkout: o.w.path, argv: ["claude"], tab: o.w.name };
    }
    const name = this.wtName.value().trim();
    if (name && !NAME_OK.test(name)) return "Worktree names use letters, digits, '.', '_' and '-'.";
    const existing = name && info.worktrees.find((w) => this.claudeName(p, w) === name);
    // Where `claude -w <name>` puts it: the project's WorktreeCreate hook's .worktrees/, else Claude's own place.
    const checkout = !name ? null : existing ? existing.path : `${p.path}/${info.hook ? ".worktrees" : ".claude/worktrees"}/${name}`;
    return { cwd: p.path, checkout, argv: name ? ["claude", "-w", name] : ["claude", "-w"], tab: name || null };
  }

  // One space per checkout: the main checkout's, or a worktree's. A space is in the checkout its first
  // terminal is in now: the deepest of the project's checkouts holding that folder (worktrees can sit inside
  // the main checkout, as .worktrees/ and .claude/worktrees/ do). The active one first, then by name.
  spaceFor(p, checkout) {
    if (!checkout) return null;
    const ps = panes(), info = this.info[p.path];
    const dirs = [p.path, ...(info?.worktrees ?? []).map((w) => w.path), checkout];
    const of = (path) => dirs.filter((d) => inside(path, d)).sort((x, y) => y.length - x.length)[0] ?? null;
    const mine = spaces().filter((s) => !s.machine && of(place(s, ps)) === checkout);
    const name = checkout === p.path ? p.name : base(checkout);
    return mine.find((s) => s.active) ?? mine.find((s) => s.named && s.name === name) ?? mine[0] ?? null;
  }

  start(cx) {
    if (this.busy) return;
    const p = this.project();
    if (!p) return;
    const plan = this.plan(p);
    if (typeof plan === "string") { this.error = plan; cx.notify(); return; }
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        let { cwd } = plan;
        let space = null, name = p.name;
        if (p === NONE) {
          // Scratch sessions live in ~/.scratches/<date>-<random>; trust ~/.scratches once to skip the trust prompt.
          const tmp = await exec("sh", ["-c",
            'mkdir -p "$HOME/.scratches" && mktemp -d "$HOME/.scratches/$(date +%Y-%m-%d)-XXXXXX"']);
          cwd = tmp.stdout.trim();
          if (tmp.code !== 0 || !cwd) throw new Error(tmp.stderr.trim() || "mktemp failed.");
          // Each scratch gets its own space, named after its folder's random suffix.
          name = `${SCRATCH} ${base(cwd).split("-").pop()}`;
          space = null;
        } else {
          space = this.spaceFor(p, plan.checkout);
          // A worktree's space is named after it; the main checkout's after the project; an unnamed new worktree's
          // follows where Claude puts it.
          name = plan.checkout === p.path ? p.name : plan.checkout ? base(plan.checkout) : null;
        }
        closeOverlay(props().overlay);
        const tab = plan.tab ?? undefined;
        if (space) {
          run("space.select", { id: space.id });
          run("tab.new", { space: space.id, folder: cwd, argv: plan.argv, ...(tab ? { name: tab } : {}) });
        } else {
          run("space.new", { ...(name ? { name } : {}), folder: cwd, argv: plan.argv, machine: "", ...(tab ? { tab } : {}) });
        }
      } catch (e) {
        this.error = String(e?.message ?? e);
        this.busy = false;
        cx.notify();
      }
    });
  }

  manage() {
    closeOverlay(props().overlay);
    openOverlay({ mod: "dz-projects", kind: "dialog", width: 560, height: 440, props: { back: "dz-launch" } });
  }

  render(cx) {
    const t = theme(), h = home();
    const short = (p) => (p && h && p.startsWith(h) ? "~" + p.slice(h.length) : p ?? "");
    const list = this.items(), p = this.project(), none = p === NONE || !p;
    const info = p && !none ? this.info[p.path] : null;
    const opts = this.options();
    const ready = Boolean(info && !info.loading && !info.error);

    const row = (id, on, icon, name, sub, hint, pick, disabled) => h_flex().id(id).min_h(sub ? 44 : 32).px(10).py(4).gap(10)
      .rounded(8).items_center().flex_none()
      .when(on, (el) => el.bg(t.selected))
      .when(disabled, (el) => el.opacity(0.45))
      .when(!disabled, (el) => el.hover((s) => s.bg(on ? t.selected : t.hover)).on_click(pick))
      .child(h_flex().size(20).flex_none().items_center().justify_center().child(icon))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_color(t.foreground).child(name))
        .when(Boolean(sub), (el) => el.child(div().truncate().text_size(11.5).text_color(t.dim).child(sub))))
      .when(Boolean(hint), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(hint)));
    const label = (text) => div().px(10).pt(8).pb(2).text_size(11).text_color(t.dim).child(text);
    const ico = (name, color) => svg(`mods/workspace-chrome/${name}.svg`).size(15).text_color(color ?? t.muted);
    const radio = (on) => div().size(14).rounded_full().border(on ? 4 : 1).border_color(on ? t.accent : t.input);

    // Left: projects.
    const projectRows = list.map((q, i) => {
      const on = i === this.at;
      return q === NONE
        ? row("project-none", on, ico("terminal"), NONE.name, "Claude in a temporary folder", "", (_e, cx) => this.select(i, cx))
        : row(`project-${q.id}`, on, ico("folder", on ? t.foreground : t.muted), q.name, short(q.path), "", (_e, cx) => this.select(i, cx));
    });

    // Right: where in the project.
    const optRows = [];
    if (none) {
      optRows.push(label("Checkout"));
      for (const [k, n] of [["current", "Current checkout"], ["new", "New worktree"], ["existing", "Existing worktree"]])
        optRows.push(row(`opt-${k}`, false, radio(false), n, null, "", null, true));
      optRows.push(div().px(10).pt(10).text_size(12).text_color(t.dim)
        .child("No project: Claude starts in a fresh temporary folder, in a new Scratch space of its own."));
    } else if (!info || info.loading) {
      optRows.push(div().p(10).text_color(t.dim).child("Reading the project…"));
    } else if (info.error) {
      optRows.push(div().p(10).text_color(t.blocked).child(info.error));
    } else {
      opts.forEach((o, i) => {
        const on = i === this.opt, mark = on && this.col === "options";
        const pick = (_e, cx) => this.pickOption(i, cx);
        if (o.kind === "current") {
          optRows.push(label("Checkout"));
          optRows.push(row("opt-current", mark, radio(on), "Current checkout", info.branch, "", pick));
        } else if (o.kind === "existing") {
          if (i === 2) optRows.push(label("Existing worktrees"));
          const name = this.claudeName(p, o.w);
          optRows.push(row(`opt-wt-${o.w.path}`, mark, radio(on), o.w.name,
            `${o.w.branch ?? ""} · ${short(o.w.path)}`, name ? "claude -w" : "", pick));
        } else {
          optRows.push(label("New worktree"));
          optRows.push(row("opt-new", mark, radio(on), "New worktree", info.hook ? "made by this project's WorktreeCreate hook" : "under .claude/worktrees", "claude -w", pick));
          if (on) optRows.push(h_flex().id("opt-new-name").mx(10).mt(4).h(32).px(8).items_center().rounded(6).flex_none()
            .border(1).border_color(this.col === "options" ? t.accent : t.input).bg(t.background)
            .on_click((_e, cx) => { this.col = "options"; this.wtName.focus(); cx.notify(); })
            .child(Input.new(this.wtName).flex_1().h_full().text_size(13).text_color(t.foreground)));
          if (opts.length === 2) optRows.push(label("Existing worktrees"), div().px(10).pb(4).text_size(12).text_color(t.dim).child("None yet."));
        }
      });
    }

    const canStart = Boolean(p) && (none || ready) && !this.busy;
    // A popup is as tall as its content: a fixed height keeps it still between projects.
    return v_flex().id("launch").w_full().h(470).flex_none().bg(t.popover).text_size(13)
      .track_focus(this.keys)
      .on_key_down((e, cx) => {
        const n = list.length;
        if (e.key === "escape") { cx.stop_propagation(); return closeOverlay(props().overlay); }
        if (e.key === "enter" && this.col === "options" && opts[this.opt]?.kind !== "new") { cx.stop_propagation(); return this.start(cx); }
        if (e.key === "tab") {
          if (!none && ready) this.focusColumn(this.col === "projects" ? "options" : "projects");
        } else if (e.key === "down" || e.key === "up") {
          const d = e.key === "down" ? 1 : -1;
          if (this.col === "projects" && n) return (cx.stop_propagation(), this.select((this.at + d + n) % n, cx));
          if (this.col === "options" && opts.length) { this.opt = (this.opt + d + opts.length) % opts.length; this.focusColumn("options"); }
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(svg("mods/workspace-chrome/search.svg").size(14).text_color(t.dim))
        .child(Input.new(this.search).flex_1().h_full().text_size(13).text_color(t.foreground))
        .child(div().flex_none().text_size(11).text_color(t.dim).child("New Claude session")))
      .child(h_flex().flex_1().min_h(0).items_stretch()
        .child(v_flex().w(250).flex_none().min_h(0).border_r(1).border_color(t.border)
          .child(label("Projects"))
          .child(v_flex().id("launch-projects").flex_1().min_h(0).px(6).gap(1).overflow_y_scroll()
            .children(projectRows)
            .when(!projects().length, (el) => el.child(div().px(10).py(6).text_size(12).text_color(t.dim).child("No projects yet."))))
          .child(h_flex().id("launch-manage").h(34).mx(6).mb(6).px(10).gap(10).items_center().rounded(8).flex_none()
            .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
            .role("button").accessibility_label("Manage projects")
            .on_click(() => this.manage())
            .child(svg("mods/dz-chrome/settings.svg").size(14))
            .child(div().child("Manage projects…"))))
        .child(v_flex().id("launch-options").flex_1().min_w(0).min_h(0).px(6).pb(6).gap(1).overflow_y_scroll().children(optRows)))
      .child(h_flex().h(46).flex_none().px(14).gap(10).items_center().border_t(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().text_size(12)
          .text_color(this.error ? t.blocked : t.dim)
          .child(this.error || "↑↓ choose · ⇥ projects / checkout · ↵ start · esc close"))
        .child(h_flex().id("launch-start").h(30).px(14).items_center().rounded(7).flex_none()
          .role("button").accessibility_label("Start Claude")
          .bg(t.solid).text_color(t.solid_foreground)
          .when(!canStart, (el) => el.opacity(0.5))
          .when(canStart, (el) => el.hover((s) => s.opacity(0.85)).on_click((_e, cx) => this.start(cx)))
          .child(this.busy ? "Starting…" : "Start Claude ↵")));
  }
}
