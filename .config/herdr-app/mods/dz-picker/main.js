// Go to… (cmd-p, and the inbox's picker). Agents grouped as the sidebar inbox (dz-inbox) shelves them, in its
// order: Pinned, Active, Working, Snoozed, then Settled (live settled agents, then closed Claude sessions,
// resumed when picked). Settled stays out until the search has 3+ characters. Each row: project avatar,
// project name and title on one line, state and program at the end. Tabs with no agent show only while searching.
// Type to filter, ↑/↓ and Enter to go, Esc leaves.
//
// The groups and order come from shared "inbox.order" (written by dz-inbox on every render), so they follow
// the sidebar live: an agent that starts working moves from Active to Working while the panel is open.
// An agent the inbox hasn't placed yet is grouped by its own status.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, terminals, panes, run, theme, props, closeOverlay, shared } from "herdr";
import { namer } from "./name.js";
import { spaceMark, projectAt, projectMarks } from "./mark.js";
import { sessions, liveIn, resume } from "./session.js";
import { snoozedUntil, when } from "./snooze.js";
import { bar, field, footer, groupLabel, rowFrame, empty, ROW_H } from "./panel.js";

const SEARCH_SETTLED = 3;
const ROW = ROW_H, HEAD = 30, LIST_MAX = 440;
const GROUPS = [
  { key: "pinned", label: "Pinned" },
  { key: "active", label: "Active" },
  { key: "working", label: "Working" },
  { key: "snoozed", label: "Snoozed" },
  { key: "settled", label: "Settled" },
  { key: "tabs", label: "Other tabs" },
];

function ago(ms, now) {
  const m = Math.floor((now - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Picker extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "Go to an agent or tab…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.picked));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.at = null;
    this.scroll = 0;
    this.handle = cx.focus_handle();
  }

  close() {
    closeOverlay(props().overlay);
  }

  // Every row in its group, in the sidebar's order, filtered by the search.
  groups() {
    const q = this.filter.trim().toLowerCase();
    const now = Date.now();
    const all = agents(), ts = terminals(), ps = panes(), sp = spaces();
    const term = new Map(ts.map((k) => [k.address, k]));
    const title = namer();
    const bookmarks = projectMarks().sort((x, y) => y.path.length - x.path.length);
    const inProject = (dir) => (dir ? bookmarks.find((p) => dir === p.path || dir.startsWith(p.path.replace(/\/+$/, "") + "/")) ?? null : null);
    // The project an agent works in (as the inbox reads it): its pane's folder, else its space's.
    const where = (a) => {
      if (a.address.includes("/")) return { project: null, name: a.space_name, none: false };
      const s = sp.find((x) => x.id === a.space), tabs = new Set((s?.tabs ?? []).map((c) => c.id));
      const dir = ps.find((p) => p.pane === a.pane)?.cwd || ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s?.folder;
      const project = inProject(dir);
      return { project, name: project?.name ?? "No project", none: !project };
    };
    const order = shared("inbox.order") ?? {};
    const placed = new Map(), rank = new Map();
    for (const g of ["pinned", "active", "working", "snoozed", "settled"]) {
      (order[g] ?? []).forEach((addr, i) => { if (!placed.has(addr)) { placed.set(addr, g); rank.set(addr, i); } });
    }
    // Not placed yet (new since the inbox last drew): by its own state.
    const own = (a) => {
      const k = term.get(a.address);
      if (snoozedUntil(k)) return "snoozed";
      if (k?.labels?.settled) return "settled";
      return a.status === "working" ? "working" : "active";
    };
    const byGroup = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    for (const a of all) {
      const w = where(a), k = term.get(a.address), name = title(a);
      const g = placed.get(a.address) ?? own(a);
      const settled = k?.labels?.settled ? Number(k.labels.settled.split(":")[0]) : null;
      byGroup[g].push({
        kind: "agent", key: `a-${a.address}`, a, group: g, title: name, where: w,
        status: a.status, snoozed: snoozedUntil(k), settled, rank: rank.get(a.address) ?? Infinity,
        here: a.focused, text: [w.name, a.space_name, name, a.program?.name].join(" "),
      });
    }
    for (const g of Object.keys(byGroup)) byGroup[g].sort((x, y) => x.rank - y.rank);
    // Closed sessions: settled, their terminal gone, newest first after the live ones (as the inbox lists them).
    const closed = Object.values(sessions()).filter((s) => !liveIn(s, term)).sort((x, y) => y.at - x.at);
    for (const s of closed) {
      const project = projectAt(s.cwd);
      const w = { project, name: project?.name ?? s.spaceName ?? "No project", none: !project };
      byGroup.settled.push({ kind: "closed", key: `s-${s.id}`, s, group: "settled", title: s.title || "Claude session", where: w,
        settled: s.at, text: [w.name, s.spaceName, s.title].join(" ") });
    }
    // Tabs without an agent, in space and tab order: only while searching.
    const agentTabs = new Set(all.map((a) => a.tab));
    for (const s of sp) for (const c of s.tabs) {
      if (agentTabs.has(c.id)) continue;
      const mine = ps.filter((p) => p.tab === c.id);
      const lead = mine.find((p) => p.focused) ?? mine[0];
      const name = c.named ? c.name : lead ? title(lead) : c.name;
      const project = s.machine ? null : inProject(lead?.cwd || s.folder);
      byGroup.tabs.push({ kind: "tab", key: `t-${c.id}`, s, c, group: "tabs", title: name, program: lead?.program,
        where: { project, name: project?.name ?? s.name, none: false, space: s.id }, here: s.active && c.active,
        text: [s.name, project?.name, name, lead?.program?.name].join(" ") });
    }
    const words = q.split(/\s+/).filter(Boolean);
    const match = (r) => words.every((w) => r.text.toLowerCase().includes(w));
    const shown = (g) => (g === "settled" ? q.length >= SEARCH_SETTLED : g === "tabs" ? q.length > 0 : true);
    const groups = GROUPS.filter((g) => shown(g.key)).map((g) => ({ ...g, rows: byGroup[g.key].filter(match) })).filter((g) => g.rows.length);
    return { groups, now, hiddenSettled: shown("settled") ? 0 : byGroup.settled.length };
  }

  go(r) {
    if (!r) return;
    this.close();
    if (r.kind === "agent") run("agent.focus", { terminal: r.a.address });
    else if (r.kind === "closed") resume(r.s);
    else if (r.kind === "tab") { run("space.select", { id: r.s.id }); run("tab.select", { id: r.c.id }); }
  }

  render() {
    const t = theme();
    const { groups, now, hiddenSettled } = this.groups();
    const pickable = groups.flatMap((g) => g.rows);
    // Opens on where you are.
    if (this.at === null) this.at = Math.max(0, pickable.findIndex((r) => r.here));
    this.at = Math.max(0, Math.min(this.at, pickable.length - 1));
    const sel = (this.picked = pickable[this.at]);

    // One strip of fixed-height lines; scrolling keeps the selected row in view.
    const lines = groups.flatMap((g, gi) => [{ head: g, first: gi === 0 }, ...g.rows.map((r) => ({ r }))]);
    const hOf = (l) => (l.head ? (l.first ? HEAD - 6 : HEAD) : ROW);
    const tops = [];
    let y = 0;
    for (const l of lines) { tops.push(y); y += hOf(l); }
    const total = y;
    const height = Math.min(LIST_MAX, total);
    const maxScroll = Math.max(0, total - height);
    const si = lines.findIndex((l) => l.r === sel);
    if (si >= 0 && this.keyed !== false) {
      // The first row of a group brings its header along.
      const top = lines[si - 1]?.head ? tops[si - 1] : tops[si];
      if (top < this.scroll) this.scroll = top;
      if (tops[si] + ROW > this.scroll + height) this.scroll = tops[si] + ROW - height;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const fixed = total > height;
    const visible = (i) => !fixed || (tops[i] + hOf(lines[i]) > this.scroll && tops[i] < this.scroll + height);
    const place = (el, i) => (fixed ? el.absolute().left(0).right(0).top(tops[i] - this.scroll).h(hOf(lines[i])) : el);

    const header = (g, first) => groupLabel(t, g.label, g.rows.length).id(`pk-head-${g.key}`).mx(6).pt(0).h(first ? HEAD - 6 : HEAD);

    const avatar = (r) => {
      if (r.where.none) return div().size(16).flex_none().rounded(4).border_1().border_dashed().border_color(t.dim);
      const space = r.kind === "agent" ? r.a.space : r.kind === "tab" ? r.where.space : r.s.space;
      const { letter, fill } = spaceMark(space ?? "", t, { project: r.where.project, name: r.where.name });
      return h_flex().size(16).flex_none().rounded(4).bg(fill).items_center().justify_center()
        .text_size(10).font_bold().text_color("#ffffff").child(letter);
    };

    const state = (r) => {
      const label = (color, mark, text) => h_flex().gap(4).flex_none().items_center().text_size(11.5).font_medium().text_color(color)
        .when(Boolean(mark), (el) => el.child(mark)).child(div().child(text));
      if (r.kind === "closed") return label(t.dim, svg("mods/dz-inbox/undo.svg").size(12).flex_none().text_color(t.dim), `resume · ${ago(r.settled, now)}`);
      if (r.kind === "tab") return null;
      if (r.group === "snoozed" && r.snoozed) return label(t.dim, svg("mods/dz-inbox/alarm-clock.svg").size(12).flex_none().text_color(t.dim), when(r.snoozed, now));
      if (r.group === "settled") return r.settled ? label(t.dim, null, ago(r.settled, now)) : null;
      if (r.status === "working") return label(t.working, svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900), "Working");
      if (r.status === "blocked") return label(t.blocked, div().size(12).flex_none().rounded(3).bg(t.blocked + "26").text_size(9.5).font_bold().flex().items_center().justify_center().child("!"), "Needs you");
      if (r.status === "done") return label(t.ansi2, svg("mods/workspace-chrome/circle-check.svg").size(12).flex_none().text_color(t.ansi2), "Done");
      return null;
    };

    const row = (r) => {
      const on = r === sel;
      const quiet = r.group === "settled";
      const prog = r.kind === "agent" ? r.a.program : r.kind === "tab" ? r.program : { icon: "icons/claude.svg" };
      const pic = icon(prog, 14, on ? t.muted : t.dim);
      const st = state(r);
      return rowFrame(t, on).id(`pk-${r.key}`).mx(6).cursor_pointer()
        .on_click(() => this.go(r))
        .child(div().flex_none().opacity(quiet && !on ? 0.6 : 1).child(avatar(r)))
        .child(h_flex().flex_1().min_w(0).gap(8).items_baseline()
          .child(div().flex_none().max_w(160).truncate().text_size(12).text_color(t.dim).child(r.where.name ?? ""))
          .child(div().flex_1().min_w(0).truncate().text_size(13.5)
            .text_color(on || !quiet ? t.foreground : t.muted)
            .when(Boolean(r.here), (d) => d.font_semibold())
            .child(r.title)))
        .when(Boolean(st), (el) => el.child(st))
        .child(h_flex().w(16).flex_none().justify_center().when(Boolean(pic), (el) => el.child(pic)));
    };

    const q = this.filter.trim();
    const note = hiddenSettled > 0 ? `${hiddenSettled} settled · type ${SEARCH_SETTLED}+ letters to search them` : "";
    const step = (d, cx) => {
      this.at = (this.at + d + pickable.length) % pickable.length;
      cx.stop_propagation();
      cx.notify();
    };

    return v_flex()
      .id("picker")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        // ctrl-j/k and ctrl-n/p move like ↓/↑.
        const k = e.modifiers.control ? ({ j: "down", k: "up", n: "down", p: "up" }[e.key] ?? e.key) : e.key;
        if (k === "escape") return this.close();
        if (!pickable.length) return;
        if (k === "down") return step(1, cx);
        if (k === "up") return step(-1, cx);
      })
      .child(bar(t, { body: field(Input, this.input).text_color(t.foreground) }))
      .child(pickable.length
        ? v_flex().id("pk-list").flex_none().py(6)
          .child(v_flex().id("pk-strip").relative().h(height).w_full().flex_none()
            .when(fixed, (el) => el.overflow_hidden().on_scroll_wheel((e, cx) => {
              this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
              // The selection follows the wheel, so the next frame doesn't scroll back to it.
              const top = (r) => tops[lines.findIndex((l) => l.r === r)];
              while (this.at < pickable.length - 1 && top(pickable[this.at]) < this.scroll) this.at++;
              while (this.at > 0 && top(pickable[this.at]) + ROW > this.scroll + height) this.at--;
              cx.notify();
            }))
            .children(lines.map((l, i) => (visible(i) ? place(l.head ? header(l.head, l.first) : row(l.r), i) : null)).filter(Boolean)))
        : v_flex().h(96).flex_none().justify_center().child(empty(t, q ? `Nothing matches “${q}”` : "No agents running",
          q.length > 0 && q.length < SEARCH_SETTLED && hiddenSettled > 0 ? `Settled sessions show from ${SEARCH_SETTLED} letters` : null)))
      .child(footer(t, [[["↑", "↓"], "move"], [["↵"], "open"], [["esc"], "close"]], { note }));
  }
}
