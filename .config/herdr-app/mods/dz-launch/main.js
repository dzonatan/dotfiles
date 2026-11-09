// New Claude session (⌘N), a wizard. Step 1: pick a project (dz-projects' bookmarks, with their
// avatars) or none. Step 2 (projects only): where in the project: the checkout as it is, one of its
// worktrees, or a new worktree (`claude -w`). Last step: which MCP servers the session gets, ticked from
// the project's default (mcp.js); "Save as default" keeps the ticks for that project (No project: for
// scratch sessions and projects without their own). Esc goes back a step. Starts Claude in a new tab of
// the space already working in that project, else in a new space named after it.
// No project: Claude starts in a fresh temporary folder, in a new space of its own ("Scratch <id>").
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { bar, field, footer as footerBar, button, groupLabel, empty } from "./panel.js";
import { settings, theme, spaces, panes, run, closeOverlay, openOverlay, props, home, exec, readTextFile } from "herdr";
import { projectMarks, fillOf } from "./mark.js";
import { ANY, cached, fresh, refresh, ownDefault, onByDefault, saveDefault, denyArgs, hiddenSet, setHidden, label as serverLabel } from "./mcp.js";

const NONE = { id: "none", name: "No project" };
const SCRATCH = "Scratch";
const ROW_H = 31; // a server row (30) plus the list's gap (1)
const NAME_OK = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

const projects = () => projectMarks();
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
    this.step = "project"; // or "checkout", "servers"
    this.opt = 0;
    this.info = {}; // project path -> { branch, worktrees, hook } | { error } | { loading }
    this.error = "";
    this.busy = false;
    this.search = InputState.new({ placeholder: "Search projects…" });
    this.search.on("change", (_e, cx) => { this.filter = this.search.value(); this.at = 0; this.opt = 0; this.error = ""; this.load(cx); cx.notify(); });
    this.search.on("submit", (_e, cx) => this.choose(cx));
    this.wtName = InputState.new({ placeholder: "worktree name (blank: Claude picks one)" });
    this.wtName.on("change", (_e, cx) => { this.error = ""; cx.notify(); });
    this.wtName.on("submit", (_e, cx) => this.openServers(cx));
    // The servers step: the ticks (null: the default's), the highlighted row, folders being listed.
    this.mcpOn = null;
    this.mcpAt = 0;
    // The server list scrolls by whole rows so the highlighted one can be kept on screen:
    // mcpTop is the first row shown, mcpViewH the list's height, mcpWheel unspent wheel pixels.
    this.mcpTop = 0;
    this.mcpViewH = 0;
    this.mcpWheel = 0;
    this.mcpRowH = 0; // a server row's measured height: sizes come back zoomed, rows are written unzoomed
    this.mcpLoading = new Set();
    this.mcpError = "";
    this.mcpNote = "";
    this.showHidden = false;
    // Always start on "No project" (first in the list).
    this.at = 0;
    this.search.focus();
    this.load(cx);
    this.listServers(home(), 10 * 60_000, cx);

  }

  // Whose default the servers step uses, and the folder it lists servers in.
  mcpOf(p) {
    return p === NONE ? { key: ANY, dir: home() } : { key: p.path, dir: p.path };
  }

  servers(p) {
    return cached(this.mcpOf(p).dir)?.servers ?? null;
  }

  onSet(p, servers) {
    return this.mcpOn ?? onByDefault(this.mcpOf(p).key, servers);
  }

  // Lists a folder's servers in the background, unless it was listed within `ms`.
  listServers(dir, ms, cx) {
    if (!dir || this.mcpLoading.has(dir) || fresh(dir, ms)) return;
    this.mcpLoading.add(dir);
    cx.spawn(async (cx) => {
      try { await refresh(dir); this.mcpError = ""; } catch (e) { this.mcpError = String(e?.message ?? e); }
      this.mcpLoading.delete(dir);
      cx.notify();
    });
  }

  // The last step. From a project's checkout step the chosen checkout must be valid first.
  openServers(cx) {
    const p = this.project();
    if (!p) return;
    if (p !== NONE) {
      const plan = this.plan(p);
      if (typeof plan === "string") { this.error = plan; cx.notify(); return; }
    }
    this.from = this.step;
    this.step = "servers";
    this.mcpOn = null;
    this.mcpAt = 0;
    this.mcpTop = 0;
    this.mcpNote = "";
    this.error = "";
    this.listServers(this.mcpOf(p).dir, 60_000, cx);
    this.keys.focus();
    cx.notify();
  }

  toggleServer(p, name, cx) {
    const list = this.servers(p);
    if (!list) return;
    const on = new Set(this.onSet(p, list));
    if (on.has(name)) on.delete(name); else on.add(name);
    this.mcpOn = on;
    this.mcpNote = "";
    cx.notify();
  }

  // The servers step's rows: the shown servers, then the hidden ones while "show" is on.
  serverRows(p) {
    const list = this.servers(p) ?? [], hidden = hiddenSet();
    const shown = list.filter((s) => !hidden.has(s.name)), hid = list.filter((s) => hidden.has(s.name));
    return { shown, hid, rows: this.showHidden ? [...shown, ...hid] : shown };
  }

  // The servers list as drawn: shown rows, the "n hidden" line, then hidden rows while open.
  serverLayout(p) {
    const { shown, hid } = this.serverRows(p);
    const count = shown.length + (hid.length ? 1 : 0) + (this.showHidden ? hid.length : 0);
    // Rows are 30px plus a 1px gap, times the zoom (measured from a row, else the setting);
    // the hidden line's 4px top margin costs one less row when present.
    const k = this.mcpRowH ? this.mcpRowH / (ROW_H - 1) : Number(settings().zoom) || 1;
    const fit = Math.max(1, Math.floor((this.mcpViewH + k - (hid.length ? 4 * k : 0)) / (ROW_H * k)));
    const item = (at) => (at < shown.length ? at : at + 1); // highlighted row -> drawn index
    return { count, fit: this.mcpViewH ? fit : count, item };
  }

  // Scrolls so the highlighted server row is on screen.
  revealServer(p) {
    const { count, fit, item } = this.serverLayout(p), at = item(this.mcpAt);
    if (at < this.mcpTop) this.mcpTop = at;
    else if (at >= this.mcpTop + fit) this.mcpTop = at - fit + 1;
    this.mcpTop = Math.max(0, Math.min(this.mcpTop, count - fit));
  }

  // Hides a server everywhere (always off), or brings it back.
  hideServer(p, name, cx) {
    if (!name) return;
    setHidden(name, !hiddenSet().has(name));
    const n = this.serverRows(p).rows.length;
    this.mcpAt = Math.max(0, Math.min(this.mcpAt, n - 1));
    this.revealServer(p);
    cx.notify();
  }

  setAllServers(p, all, cx) {
    if (!this.servers(p)) return;
    this.mcpOn = new Set(all ? this.serverRows(p).shown.map((s) => s.name) : []);
    this.mcpNote = "";
    cx.notify();
  }

  saveServers(p, cx) {
    const list = this.servers(p);
    if (!list) return;
    saveDefault(this.mcpOf(p).key, this.onSet(p, list));
    this.mcpNote = p === NONE ? "· saved: also for projects without their own" : "· saved as project default";
    cx.notify();
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

  // Step 1: highlight a project (and read it ahead, so step 2 opens ready).
  select(at, cx) {
    this.at = at;
    this.opt = 0;
    this.error = "";
    this.load(cx);
    cx.notify();
  }

  // Step 1 -> 2. "No project" has no checkout to choose: it goes straight to its servers.
  choose(cx) {
    const p = this.project();
    if (!p) return;
    if (p === NONE) return this.openServers(cx);
    this.step = "checkout";
    this.opt = 0;
    this.error = "";
    this.load(cx);
    this.listServers(p.path, 60_000, cx);
    this.focusOption();
    cx.notify();
  }

  back(cx) {
    this.error = "";
    if (this.step === "servers" && this.from === "checkout") {
      this.step = "checkout";
      this.focusOption();
    } else {
      this.step = "project";
      this.search.focus();
    }
    cx.notify();
  }

  focusOption() {
    if (this.options()[this.opt]?.kind === "new") this.wtName.focus();
    else this.keys.focus();
  }

  pickOption(i, cx) {
    this.opt = i;
    this.error = "";
    this.focusOption();
    cx.notify();
  }

  // What to run and where: { cwd, checkout, argv } or an error string. The tab stays unnamed, so it shows
  // the title Claude gives the session after the first message (the space already names the checkout).
  plan(p) {
    if (p === NONE) return { argv: ["claude"] };
    const info = this.info[p.path];
    if (!info || info.loading) return "Still reading the project…";
    if (info.error) return info.error;
    const o = this.options()[this.opt] ?? { kind: "current" };
    // `checkout`: the folder the session ends up working in, which picks its space (null: not known yet).
    if (o.kind === "current") return { cwd: p.path, checkout: p.path, argv: ["claude"] };
    if (o.kind === "existing") {
      const name = this.claudeName(p, o.w);
      return name ? { cwd: p.path, checkout: o.w.path, argv: ["claude", "-w", name] }
        : { cwd: o.w.path, checkout: o.w.path, argv: ["claude"] };
    }
    const name = this.wtName.value().trim();
    if (name && !NAME_OK.test(name)) return "Worktree names use letters, digits, '.', '_' and '-'.";
    const existing = name && info.worktrees.find((w) => this.claudeName(p, w) === name);
    // Where `claude -w <name>` puts it: the project's WorktreeCreate hook's .worktrees/, else Claude's own place.
    const checkout = !name ? null : existing ? existing.path : `${p.path}/${info.hook ? ".worktrees" : ".claude/worktrees"}/${name}`;
    return { cwd: p.path, checkout, argv: name ? ["claude", "-w", name] : ["claude", "-w"] };
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
    // Never start with servers unknown: an unlisted server can't be turned off.
    const list = this.servers(p);
    if (!list) {
      this.error = this.mcpError ? `Couldn't list MCP servers: ${this.mcpError}` : "Still reading MCP servers…";
      cx.notify();
      return;
    }
    plan.argv = [...plan.argv, ...denyArgs(list, this.onSet(p, list))];
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
        if (space) {
          run("space.select", { id: space.id });
          run("tab.new", { space: space.id, folder: cwd, argv: plan.argv });
        } else {
          run("space.new", { ...(name ? { name } : {}), folder: cwd, argv: plan.argv, machine: "" });
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
    const list = this.items(), p = this.project();
    const step = p && !(this.step === "checkout" && p === NONE) ? this.step : "project";
    const steps = p && p !== NONE ? 3 : 2;

    const row = (id, on, icon, name, sub, hint, pick) => h_flex().id(id).min_h(sub ? 46 : 34).px(10).py(4).gap(10)
      .rounded(8).items_center().flex_none()
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(on ? t.selected : t.hover)).on_click(pick)
      .child(h_flex().size(22).flex_none().items_center().justify_center().child(icon))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_color(t.foreground).child(name))
        .when(Boolean(sub), (el) => el.child(div().truncate().text_size(11.5).text_color(t.dim).child(sub))))
      .when(Boolean(hint), (el) => el.child(hint));
    const label = (text) => groupLabel(t, text);
    const ico = (name, color, size = 15) => svg(`mods/workspace-chrome/${name}.svg`).size(size).text_color(color ?? t.muted);
    const radio = (on) => div().size(14).rounded_full().border(on ? 4 : 1).border_color(on ? t.accent : t.input);
    // The project's avatar, as dz-projects draws it.
    const avatar = (q, size) => h_flex().size(size).flex_none().rounded(5).bg(fillOf(q.color, t))
      .items_center().justify_center().text_size(size * 0.6).font_bold().text_color("#ffffff").child(q.letter);
    const hintText = (text) => div().flex_none().text_size(11).text_color(t.dim).child(text);
    const check = (on) => h_flex().size(14).flex_none().rounded(4).items_center().justify_center()
      .border(1).border_color(on ? t.accent : t.input).when(on, (el) => el.bg(t.accent))
      .when(on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(10).text_color(t.accent_foreground)));
    // Steps 2 and 3: back, the project, the step.
    const head = (trail) => bar(t, { lead: null, trail: hintText(trail), body: h_flex().flex_1().min_w(0).gap(10).items_center()
      .child(h_flex().id("launch-back").size(28).flex_none().items_center().justify_center().rounded(6)
        .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label("Back")
        .on_click((_e, cx) => this.back(cx))
        .child(svg("mods/workspace-chrome/chevron-left.svg").size(15)))
      .child(p === NONE
        ? h_flex().size(22).flex_none().rounded(5).bg(t.raised).items_center().justify_center().child(ico("terminal", t.muted, 13))
        : avatar(p, 22))
      .child(h_flex().flex_1().min_w(0).gap(8).items_baseline()
        .child(div().flex_none().font_semibold().text_color(t.foreground).child(p.name))
        .child(div().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(p === NONE ? "temporary folder" : short(p.path)))) }).pl(10);

    let header, body, footer, canStart, primary, canSave = false;
    if (step === "project") {
      // Step 1: projects.
      const rows = list.map((q, i) => {
        const on = i === this.at;
        const pick = (_e, cx) => { this.at = i; this.choose(cx); };
        return q === NONE
          ? row("project-none", on, h_flex().size(22).rounded(5).bg(t.raised).items_center().justify_center().child(ico("terminal", t.muted, 13)),
            NONE.name, "Claude in a temporary folder", on ? hintText("↵ next") : null, pick)
          : row(`project-${q.id}`, on, avatar(q, 22), q.name, short(q.path), ico("chevron-right", on ? t.muted : t.dim, 14), pick);
      });
      header = bar(t, { body: field(Input, this.search).text_color(t.foreground), trail: hintText(`1 / ${steps} · Project`) });
      body = v_flex().flex_1().min_h(0)
        .child(v_flex().id("launch-projects").flex_1().min_h(0).px(6).pt(6).gap(1).overflow_y_scroll()
          .children(rows)
          .when(!list.length, (el) => el.child(empty(t, "No matching projects.")))
          .when(list.length && !projects().length, (el) => el.child(empty(t, "No projects yet."))))
        .child(h_flex().id("launch-manage").h(34).mx(6).mb(6).px(10).gap(10).items_center().rounded(8).flex_none()
          .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .role("button").accessibility_label("Manage projects")
          .on_click(() => this.manage())
          .child(h_flex().size(22).flex_none().items_center().justify_center().child(svg("mods/dz-chrome/settings.svg").size(14)))
          .child(div().child("Manage projects…")));
      footer = [[["↑", "↓"], "move"], [["↵"], "next"], [["esc"], "close"]];
      canStart = Boolean(p) && !this.busy;
      primary = "Next";
    } else if (step === "checkout") {
      // Step 2: where in the project.
      const info = this.info[p.path], opts = this.options();
      const ready = Boolean(info && !info.loading && !info.error);
      const optRows = [];
      if (!info || info.loading) optRows.push(div().p(10).text_color(t.dim).child("Reading the project…"));
      else if (info.error) optRows.push(div().p(10).text_color(t.blocked).child(info.error));
      else opts.forEach((o, i) => {
        const on = i === this.opt;
        const pick = (_e, cx) => this.pickOption(i, cx);
        if (o.kind === "current") {
          optRows.push(label("Checkout"));
          optRows.push(row("opt-current", on, radio(on), "Current checkout", info.branch, null, pick));
        } else if (o.kind === "existing") {
          if (i === 2) optRows.push(label("Existing worktrees"));
          const name = this.claudeName(p, o.w);
          optRows.push(row(`opt-wt-${o.w.path}`, on, radio(on), o.w.name,
            `${o.w.branch ?? ""} · ${short(o.w.path)}`, name ? hintText("claude -w") : null, pick));
        } else {
          optRows.push(label("New worktree"));
          optRows.push(row("opt-new", on, radio(on), "New worktree", info.hook ? "made by this project's WorktreeCreate hook" : "under .claude/worktrees", hintText("claude -w"), pick));
          if (on) optRows.push(h_flex().id("opt-new-name").mx(10).ml(42).mt(4).h(32).px(8).items_center().rounded(6).flex_none()
            .border(1).border_color(t.accent).bg(t.background)
            .on_click((_e, cx) => { this.wtName.focus(); cx.notify(); })
            .child(Input.new(this.wtName).flex_1().h_full().text_size(13).text_color(t.foreground)));
          if (opts.length === 2) optRows.push(label("Existing worktrees"), div().px(10).pb(4).text_size(12).text_color(t.dim).child("None yet."));
        }
      });
      header = head("2 / 3 · Checkout");
      body = v_flex().id("launch-options").flex_1().min_h(0).px(6).pb(6).gap(1).overflow_y_scroll().children(optRows);
      footer = [[["↑", "↓"], "move"], [["↵"], "next"], [["esc"], "back"]];
      canStart = ready && !this.busy;
      primary = "Next";
    } else {
      // Last step: the MCP servers this session gets.
      const servers = this.servers(p), on = servers ? this.onSet(p, servers) : null;
      const { shown, hid } = this.serverRows(p);
      const { key, dir } = this.mcpOf(p);
      const loading = this.mcpLoading.has(dir);
      const own = ownDefault(key), inherited = !own && p !== NONE && ownDefault(ANY);
      const same = (a, b) => a.size === b.size && [...a].every((n) => b.has(n));
      const changed = Boolean(servers && this.mcpOn && !same(this.mcpOn, onByDefault(key, servers)));
      // Saving does nothing when the ticks already are this project's own saved default.
      canSave = Boolean(servers) && !(own && same(on, new Set(own)));
      const note = this.mcpNote || ["",
        own ? (p === NONE ? "default" : "project default") : inherited ? "No project's default" : "no default: all on",
        changed ? "changed" : null,
      ].filter((x) => x !== null).join(" · ").trim();
      const rows = [], items = [];
      if (!servers) {
        rows.push(this.mcpError && !loading
          ? div().p(10).text_color(t.blocked).child(`Couldn't list MCP servers: ${this.mcpError}`)
          : div().p(10).text_color(t.dim).child("Reading MCP servers…"));
      } else {
        const link = (id, text, pick) => div().id(id).px(4).rounded(4).text_color(t.muted)
          .hover((s) => s.text_color(t.foreground)).on_click(pick).child(text);
        rows.push(h_flex().px(10).pt(10).pb(4).gap(8).flex_none().items_end().text_size(11).text_color(t.dim)
          .child(div().font_medium().child("MCP servers"))
          .child(div().opacity(0.6).child(`${shown.filter((s) => on.has(s.name)).length} of ${shown.length} on`))
          .when(loading, (el) => el.child(div().opacity(0.6).child("· refreshing…")))
          .child(div().min_w(0).truncate().text_color(this.mcpNote ? t.accent : t.dim).child(note))
          .child(div().flex_1())
          .child(link("mcp-all", "All", (_e, cx) => this.setAllServers(p, true, cx)))
          .child(link("mcp-none", "None", (_e, cx) => this.setAllServers(p, false, cx))));
        if (!servers.length) rows.push(empty(t, "No MCP servers installed."));
        const hideLink = (s, text) => div().id(`mcp-hide-${s.name}`).flex_none().px(4).rounded(4).text_size(11).text_color(t.dim)
          .hover((st) => st.text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); this.hideServer(p, s.name, cx); }).child(text);
        const serverRow = (s, i, isHidden) => {
          const sel = i === this.mcpAt, lit = !isHidden && on.has(s.name), l = serverLabel(s);
          return h_flex().id(`mcp-${s.name}`).h(30).px(10).gap(10).items_center().rounded(8).flex_none()
            .when(sel, (el) => el.bg(t.selected))
            .hover((st) => st.bg(sel ? t.selected : t.hover))
            .on_size_change((size, cx) => {
              if (Math.abs(size.height - this.mcpRowH) < 0.5) return;
              this.mcpRowH = size.height; this.revealServer(p); cx.notify();
            })
            .on_click((_e, cx) => { this.mcpAt = i; if (!isHidden) this.toggleServer(p, s.name, cx); else cx.notify(); })
            .child(h_flex().size(22).flex_none().items_center().justify_center().child(isHidden ? div().size(14) : check(lit)))
            .child(div().flex_none().text_color(lit ? t.foreground : t.muted).child(l.name))
            .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(isHidden ? "hidden · always off" : l.sub))
            .when(sel || isHidden, (el) => el.child(hideLink(s, isHidden ? "h · unhide" : "h · hide")));
        };
        shown.forEach((s, i) => items.push(serverRow(s, i, false)));
        // Hidden servers never vanish without a trace: this line names them.
        if (hid.length) {
          items.push(h_flex().id("mcp-hidden").h(30).mt(4).px(10).gap(8).items_center().rounded(8).flex_none()
            .text_size(11.5).text_color(t.dim).hover((st) => st.bg(t.hover))
            .on_click((_e, cx) => { this.showHidden = !this.showHidden; this.mcpAt = Math.min(this.mcpAt, shown.length - 1); cx.notify(); })
            .child(div().w(22).flex_none())
            .child(div().flex_none().font_medium().child(`${hid.length} hidden`))
            .child(div().flex_1().min_w(0).truncate().child(this.showHidden ? "always off" : hid.map((s) => serverLabel(s).name).join(", ")))
            .child(div().flex_none().text_color(t.muted).child(this.showHidden ? "collapse" : "show")));
          if (this.showHidden) hid.forEach((s, i) => items.push(serverRow(s, shown.length + i, true)));
        }
      }
      header = head(`${steps} / ${steps} · MCP servers`);
      const { count, fit } = this.serverLayout(p);
      const top = Math.max(0, Math.min(this.mcpTop, count - fit));
      body = v_flex().id("launch-servers").flex_1().min_h(0).px(6).pb(6).gap(1).children(rows)
        // The rows sit in an absolute layer so the list's measured height is the room it has, not its rows'.
        .child(div().id("launch-servers-list").relative().flex_1().min_h(0).overflow_hidden()
          .on_size_change((size, cx) => { this.mcpViewH = size.height; this.revealServer(p); cx.notify(); })
          .on_scroll_wheel((e, cx) => {
            const rowPx = this.mcpRowH ? this.mcpRowH + this.mcpRowH / (ROW_H - 1) : ROW_H;
            this.mcpWheel += e.delta_lines ? -e.delta_lines.y * rowPx : -e.delta.y;
            const step = Math.trunc(this.mcpWheel / rowPx);
            if (!step) return;
            this.mcpWheel -= step * rowPx;
            const next = Math.max(0, Math.min(top + step, count - fit));
            if (next !== this.mcpTop) { this.mcpTop = next; cx.notify(); }
          })
          .child(v_flex().absolute().top(0).left(0).right(0).gap(1).children(items.slice(top, top + fit))));
      footer = [[["↑", "↓"], "move"], [["space"], "toggle"], [["⌃A"], "all"], [["↵"], "start"], [["esc"], "back"]];
      canStart = Boolean(servers) && !this.busy;
      primary = this.busy ? "Starting…" : "Start Claude";
    }

    // A popup is as tall as its content: a fixed height keeps it still between steps.
    return v_flex().id("launch").w_full().h(440).flex_none().bg(t.popover).text_size(13)
      .track_focus(this.keys)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          cx.stop_propagation();
          return step === "project" ? closeOverlay(props().overlay) : this.back(cx);
        }
        const ctrl = e.modifiers.control;
        const move = e.key === "down" || (ctrl && e.key === "j") ? 1 : e.key === "up" || (ctrl && e.key === "k") ? -1 : 0;
        if (step === "project") {
          if (!move) return;
          const n = list.length;
          cx.stop_propagation();
          if (n) this.select((this.at + move + n) % n, cx);
          return;
        }
        if (step === "servers") {
          const { shown, rows } = this.serverRows(p), n = rows.length, cur = rows[this.mcpAt];
          if (e.key === "enter") { cx.stop_propagation(); return this.start(cx); }
          if (ctrl && e.key === "a" && shown.length) {
            cx.stop_propagation();
            const on = this.onSet(p, this.servers(p));
            return this.setAllServers(p, !shown.every((s) => on.has(s.name)), cx);
          }
          if (e.key === "space" && cur) {
            cx.stop_propagation();
            return this.mcpAt < shown.length ? this.toggleServer(p, cur.name, cx) : undefined;
          }
          if (e.key === "h" && !ctrl && !e.modifiers.platform && cur) { cx.stop_propagation(); return this.hideServer(p, cur.name, cx); }
          if (move && n) { cx.stop_propagation(); this.mcpAt = (this.mcpAt + move + n) % n; this.revealServer(p); cx.notify(); }
          return;
        }
        const opts = this.options();
        if (e.key === "enter" && opts[this.opt]?.kind !== "new") { cx.stop_propagation(); return this.openServers(cx); }
        if (move && opts.length) {
          cx.stop_propagation();
          this.opt = (this.opt + move + opts.length) % opts.length;
          this.error = "";
          this.focusOption();
          cx.notify();
        }
      })
      .child(header)
      .child(body)
      .child(footerBar(t, footer, {
        note: this.error || null, noteColor: t.blocked,
        extra: [
          ...(step === "checkout" ? [button(t, "launch-back-btn", "Back", (_e, cx) => this.back(cx))] : []),
          ...(step === "servers" ? [button(t, "launch-save", "Save default", (_e, cx) => this.saveServers(p, cx), { disabled: !canSave })] : []),
          button(t, "launch-start", primary, (_e, cx) => (step === "project" ? this.choose(cx) : step === "checkout" ? this.openServers(cx) : this.start(cx)),
            { primary: true, disabled: !canStart }),
        ],
      }));
  }
}
