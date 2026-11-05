// ⌘K: actions on the agent in view, from actions.js. Type to filter; ↑↓ move; ↵ runs or opens its menu;
// ⌫ on an empty field or Esc goes back a step. An action that's off shows why, dimmed.
// A popup is as tall as its content: the list keeps a fixed height so the window doesn't jump.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, terminals, focused, shared, theme, props, closeOverlay } from "herdr";
import { namer } from "./name.js";
import { snoozedUntil } from "./snooze.js";
import { ACTIONS } from "./actions.js";

const ROW_H = 34, LIST_H = 380 - 52 - 34;

// Each typed word must start a word, not sit inside one. Title matches rank above keyword-only matches.
const wordsOf = (s) => (s ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const hits = (q, text) => wordsOf(q).every((w) => wordsOf(text).some((t) => t.startsWith(w)));
const matches = (q, ...texts) => hits(q, texts.join(" "));
// 0: the title itself matches; 1: only its hidden keywords help; null: no match.
const rank = (q, a) => (hits(q, a.title) ? 0 : matches(q, a.title, a.words) ? 1 : null);

export default class Actions extends View {
  init(_props, cx) {
    this.keys = cx.focus_handle();
    this.stack = []; // open menus, innermost last
    this.at = 0;
    this.root = this.field("Type an action…");
    this.root.focus();
    cx.timer.after(300, () => this.input.focus());
    // The agent it acts on is the one in view when it opened.
    const f = focused();
    this.address = (agents().find((a) => a.focused) ?? agents().find((a) => a.address === f?.agent))?.address ?? null;
  }

  // Each list has its own field, so each has its own placeholder.
  field(placeholder) {
    const f = InputState.new({ placeholder });
    f.on("change", (_e, cx) => { this.at = 0; cx.notify(); });
    f.on("submit", (_e, cx) => this.pick(this.rows()[this.at], cx));
    return f;
  }

  get input() { return this.stack.at(-1)?.input ?? this.root; }

  ctx() {
    const agent = agents().find((a) => a.address === this.address) ?? null;
    const term = agent && terminals().find((k) => k.address === agent.address);
    return {
      agent, title: agent ? namer()(agent) : null, now: Date.now(),
      pinned: Boolean(agent && (shared("agents.pins") ?? []).includes(agent.address)),
      snoozed: term ? snoozedUntil(term) : null,
    };
  }

  close() { closeOverlay(props().overlay); }

  rows() {
    const ctx = this.ctx(), q = this.input.value().trim(), menu = this.stack.at(-1);
    if (!menu) {
      return ACTIONS.map((a) => ({ a, r: rank(q, a) })).filter((x) => x.r !== null)
        .map(({ a, r }) => { const ok = a.when ? a.when(ctx) : true; return { ...a, rank: r, off: ok === true ? null : ok }; })
        .filter((x) => x.off !== false)
        .sort((x, y) => Number(Boolean(x.off)) - Number(Boolean(y.off)) || x.rank - y.rank);
    }
    const typed = q && menu.typed ? menu.typed(q, ctx) : null;
    // Custom… stays while what's typed isn't a time yet.
    return [...(typed ? [typed] : []), ...menu.items.filter((i) => !q || (i.custom ? !typed : matches(q, i.title, i.hint ?? "")))];
  }

  pick(r, cx) {
    if (!r || r.off) return;
    const ctx = this.ctx();
    if (r.custom) {
      this.input.focus();
      return cx.notify();
    }
    if (r.menu) {
      const m = r.menu(ctx);
      this.stack.push({ ...m, input: this.field(m.placeholder ?? "Type to filter…") });
      this.input.focus();
      this.at = 0;
      return cx.notify();
    }
    this.close();
    r.run?.(ctx);
  }

  back(cx) {
    if (!this.stack.length) return this.close();
    this.stack.pop();
    this.input.focus();
    this.at = 0;
    cx.notify();
  }

  render() {
    const t = theme(), ctx = this.ctx(), rows = this.rows(), menu = this.stack.at(-1);
    this.at = Math.min(this.at, Math.max(0, rows.length - 1));
    const shown = Math.floor(LIST_H / ROW_H), first = Math.max(0, Math.min(this.at - shown + 1, rows.length - shown));
    const row = (r, i) => {
      const on = i === this.at;
      return h_flex().id(`act-${r.id}`).h(ROW_H).flex_none().mx(6).px(10).gap(10).items_center().rounded(7)
        .when(on && !r.off, (el) => el.bg(t.selected))
        .when(Boolean(r.off), (el) => el.opacity(0.45))
        .when(!r.off, (el) => el.hover((s) => s.bg(on ? t.selected : t.hover)).on_click((_e, cx) => this.pick(r, cx)))
        .when(Boolean(r.icon), (el) => el.child(svg(r.icon).size(15).flex_none().text_color(on ? t.foreground : t.muted)))
        .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(r.title))
        .when(Boolean(r.off || r.hint), (el) => el.child(div().flex_none().text_size(12).text_color(t.dim).child(r.off || r.hint)));
    };
    return v_flex().id("actions").w_full().h(380).flex_none().bg(t.popover).text_size(13)
      .track_focus(this.keys)
      .on_key_down((e, cx) => {
        const n = rows.length;
        if (e.key === "escape") { cx.stop_propagation(); return this.back(cx); }
        if (e.key === "backspace" && !this.input.value() && this.stack.length) { cx.stop_propagation(); return this.back(cx); }
        if (e.key === "down" && n) this.at = (this.at + 1) % n;
        else if (e.key === "up" && n) this.at = (this.at - 1 + n) % n;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().h(52).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(menu), (el) => el.child(h_flex().h(22).px(8).flex_none().items_center().rounded(5).bg(t.raised)
          .text_size(12).text_color(t.foreground).child(menu.title)))
        .when(!menu, (el) => el.child(svg("mods/workspace-chrome/search.svg").size(14).flex_none().text_color(t.dim)))
        .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground)))
      .child(v_flex().id("actions-list").h(LIST_H).flex_none().pt(6).gap(0).overflow_hidden()
        .children(rows.slice(first, first + shown).map((r, i) => row(r, first + i)))
        .when(!rows.length, (el) => el.child(div().px(16).py(10).text_color(t.dim)
          .child(menu?.typed ? "Can't read that time. Try 45m, 2h, 17:30, tomorrow 10:00 or fri." : "No matching action."))))
      .child(h_flex().h(34).flex_none().px(14).gap(8).items_center().border_t(1).border_color(t.border).text_size(12).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(ctx.agent ? ctx.title : "No agent in view"))
        .child(div().flex_none().child(menu ? "↵ pick · esc back" : "↑↓ choose · ↵ run · esc close")));
  }
}
