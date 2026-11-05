// The work area's empty state (dz-projects' "main-stack" → "empty"): shown by dz-inbox when the pane in view
// closed and no Active agent is left to move on to. Any focus change (a click on an agent or tab, ⌘T, ⌘N)
// puts the tab back (dz-inbox).
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run } from "herdr";

const kbd = (t, k) => h_flex().h(20).min_w(20).px(5).flex_none().items_center().justify_center().rounded(5)
  .bg(t.raised).border(1).border_color(t.border).text_size(11).font_medium().text_color(t.muted).child(k);

export default class Empty extends View {
  render() {
    const t = theme();
    return v_flex().id("dz-empty").size_full().items_center().justify_center().gap(18).bg(t.background).rounded(8)
      .child(h_flex().size(56).flex_none().items_center().justify_center().rounded_full().bg(t.ansi2 + "1f")
        .child(svg("mods/workspace-chrome/circle-check.svg").size(26).text_color(t.ansi2)))
      .child(v_flex().items_center().gap(6)
        .child(div().text_size(17).font_semibold().text_color(t.foreground).child("All caught up"))
        .child(div().text_size(13).text_color(t.muted).child("No agents are waiting on you. Sit back and relax.")))
      .child(h_flex().id("dz-empty-new").h(32).px(12).gap(10).flex_none().items_center().rounded(8)
        .bg(t.raised).border(1).border_color(t.border).text_size(13).text_color(t.foreground)
        .hover((s) => s.bg(t.hover)).role("button").accessibility_label("Start a new session")
        .on_click(() => run("mod.open", { name: "dz-launch" }))
        .child(svg("mods/workspace-chrome/square-pen.svg").size(14).text_color(t.muted))
        .child(div().child("Start something new"))
        .child(h_flex().gap(3).child(kbd(t, "⌘")).child(kbd(t, "N"))));
  }
}
