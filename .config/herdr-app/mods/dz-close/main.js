// Close tab (⌘W and the tab's × in dz-projects). A tab where nothing runs (idle shells, mod panes) closes at
// once; otherwise it asks. Claude sessions in it are settled first: kept past their terminal (session.js), shown
// in the Inbox's Settled, and resumed from there with `claude --resume`.
// mod.json opens it with frame "none": nothing shows while it looks, so an idle tab closes without a flash.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, spaces, panes, agents, focused, run, props, closeOverlay, notify, hc } from "herdr";
import { namer } from "./name.js";
import { keep } from "./session.js";

const SHELL = /(^|\/)-?(zsh|bash|fish|sh|dash|ksh|tcsh|nu|pwsh|xonsh)$/;
const isClaude = (a) => a.app === "claude-code" || a.program?.key === "claude";

// What runs in front in a terminal: null for an idle shell (or a terminal already gone), else its name.
async function front(address) {
  const r = await hc(["get", address, "--json"]).catch(() => null);
  if (!r || r.code !== 0) return null;
  const k = JSON.parse(r.stdout), f = k.foreground;
  if (k.state !== "live") return null;
  const idle = (!f || f.pid === k.pid) && SHELL.test(f?.argv?.[0] ?? k.argv?.[0] ?? "");
  return idle ? null : f?.name || f?.argv?.[0] || "a program";
}

export default class Close extends View {
  init(_props, cx) {
    this.keys = cx.focus_handle();
    this.keys.focus();
    this.busy = false;
    this.items = null; // null: still looking
    const f = focused();
    this.space = f?.space ?? null;
    this.tab = f?.tab ?? null;
    cx.spawn(async (cx) => {
      const tg = this.target();
      if (!tg) return this.done();
      const title = namer();
      const mine = agents().filter((a) => a.tab === tg.tab.id);
      const terms = panes().filter((p) => p.tab === tg.tab.id && p.terminal);
      const items = (await Promise.all(terms.map(async (p) => {
        const a = mine.find((x) => x.address === p.terminal);
        if (a) return { agent: a, name: title(a), claude: isClaude(a) };
        const what = await front(p.terminal);
        return what && { name: what };
      }))).filter(Boolean);
      if (!items.length) {
        this.done();
        run("tab.close", { id: tg.tab.id, confirmed: true });
        return;
      }
      this.items = items;
      cx.notify();
    });
  }

  done() { closeOverlay(props().overlay); }

  target() {
    const space = spaces().find((s) => s.id === this.space);
    const tab = space?.tabs.find((c) => c.id === this.tab);
    return tab ? { space, tab } : null;
  }

  confirm(cx) {
    const tg = this.target();
    if (this.busy || !this.items) return;
    if (!tg) return this.done();
    this.busy = true;
    cx.notify();
    const claude = this.items.filter((i) => i.claude);
    cx.spawn(async () => {
      const kept = await keep(claude.map((i) => ({
        address: i.agent.address, title: i.name, space: tg.space.id, spaceName: tg.space.named ? tg.space.name : null,
      }))).catch(() => []);
      const missed = claude.filter((i) => !kept.some((k) => k.address === i.agent.address));
      if (missed.length) notify({ title: "Session not kept", body: `${missed.map((i) => i.name).join(", ")}: no Claude session id found.`, level: "warning" });
      this.done();
      run("tab.close", { id: tg.tab.id, confirmed: true });
    });
  }

  render() {
    const t = theme(), tg = this.target();
    // One focused root from the first frame: init() focuses this.keys, and a handle no element tracks loses focus.
    const root = v_flex().id("close").size_full().justify_center()
      .track_focus(this.keys)
      .on_key_down((e, cx) => {
        if (e.key === "escape") { cx.stop_propagation(); this.done(); }
        else if (e.key === "enter") { cx.stop_propagation(); this.confirm(cx); }
      });
    if (!this.items || !tg) return root;
    const name = tg.tab.name, last = tg.space.tabs.length === 1;
    const shown = this.items.slice(0, 4), more = this.items.length - shown.length;
    const line = (i, n) => h_flex().id(`what-${n}`).h(22).gap(8).items_center()
      .child(div().size(6).flex_none().rounded_full().bg(i.claude ? t.accent : t.blocked))
      .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(i.name))
      .child(div().flex_none().text_size(12).text_color(t.dim).child(i.claude ? "settles" : "ends"));
    const button = (id, label, action, primary) => h_flex().id(id).h(28).px(12).items_center().rounded(7).flex_none()
      .role("button").accessibility_label(label)
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .hover((s) => s.opacity(0.85)).on_click(action).child(label);
    return root
      .child(v_flex().id("close-card").w_full().p(16).gap(10).rounded(12).bg(t.popover)
        .border(1).border_color(t.border).shadow_lg().text_size(13)
        .child(div().text_size(14).font_semibold().text_color(t.foreground).truncate()
          .child(/^\d+$/.test(name) ? "Close tab?" : `Close “${name}”?`))
        .child(v_flex().gap(2).children(shown.map(line))
          .when(more > 0, (el) => el.child(div().text_size(12).text_color(t.dim).child(`+${more} more`))))
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(last ? `Closes ${tg.space.name} too.` : ""))
          .child(button("close-cancel", "Cancel", () => this.done()))
          .child(button("close-ok", this.busy ? "Closing…" : "Close", (_e, cx) => this.confirm(cx), true))));
  }
}
