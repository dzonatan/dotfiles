// The look shared by the palette popups: ⌘P go to (dz-picker), ⌘K actions (dz-actions), ⌘N new session (dz-launch).
// Search bar on top, rows in the middle, a footer of key hints at the bottom.
// The same file is copied into each of those mods (a mod can't import outside its folder). Change one, copy it to the others.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";

export const BAR_H = 50, FOOTER_H = 38, ROW_H = 34;

// A key as a small outlined cap: "esc", "↵", "↑".
export const keycap = (t, k) => div().px(5).h(18).flex_none().flex().items_center().rounded(4)
  .border_1().border_color(t.border).text_size(10.5).text_color(t.muted).child(k);

// The top bar: `lead` (default: the search glyph), `body` (usually field()), `trail` (optional, on the right).
// Esc lives in the footer's hints, not here.
export const bar = (t, { lead, body, trail } = {}) => h_flex().h(BAR_H).flex_none().px(16).gap(10).items_center()
  .border_b(1).border_color(t.border)
  .when(lead !== null, (el) => el.child(lead ?? svg("mods/workspace-chrome/search.svg").size(16).flex_none().text_color(t.dim)))
  .child(body ?? div().flex_1())
  .when(Boolean(trail), (el) => el.child(trail));

// The text field inside a bar, sized alike everywhere.
export const field = (Input, state) => Input.new(state).flex_1().h_full().text_size(14);

// The footer: key hints on the left ([["↑", "↓"], "move"], …), then `note` (dim, or `noteColor`) and `extra` (buttons) on the right.
export const footer = (t, hints, { note, noteColor, extra } = {}) => h_flex().h(FOOTER_H).flex_none().px(14).gap(14).items_center()
  .border_t(1).border_color(t.border).bg(t.chrome).text_size(11).text_color(t.dim)
  .children(hints.map(([keys, text]) => h_flex().gap(5).flex_none().items_center().children([...keys.map((k) => keycap(t, k)), div().child(text)])))
  .child(div().flex_1())
  .when(Boolean(note), (el) => el.child(div().min_w(0).truncate().text_color(noteColor ?? t.dim).child(note)))
  .when(Boolean(extra), (el) => el.child(h_flex().gap(6).flex_none().items_center().children(extra)));

// A footer button: 26px, primary solid or secondary raised.
export const button = (t, id, label, onClick, { primary, disabled } = {}) => h_flex().id(id).h(26).px(12).flex_none().items_center().rounded(6)
  .text_size(12).role("button").accessibility_label(label)
  .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
  .when(Boolean(disabled), (el) => el.opacity(0.5))
  .when(!disabled, (el) => el.hover((s) => s.opacity(0.85)).on_click(onClick))
  .child(label);

// A group's label above its rows: "Working 2". No horizontal margin: the caller lines it up with its rows.
export const groupLabel = (t, text, count) => h_flex().px(10).pt(10).pb(4).gap(6).flex_none().items_end()
  .text_size(11).font_medium().text_color(t.dim)
  .child(div().child(text))
  .when(count != null, (el) => el.child(div().opacity(0.6).child(String(count))));

// A row's frame: 34px, rounded, the selected one filled. Callers add id, children and on_click.
export const rowFrame = (t, on) => h_flex().h(ROW_H).flex_none().px(10).gap(10).items_center().rounded(8)
  .when(on, (el) => el.bg(t.selected))
  .when(!on, (el) => el.hover((s) => s.bg(t.hover)));

// The message shown when nothing matches.
export const empty = (t, text, sub) => div().px(16).py(14).text_size(13).text_color(t.dim).child(div().child(text))
  .when(Boolean(sub), (el) => el.child(div().pt(2).text_size(11.5).child(sub)));
