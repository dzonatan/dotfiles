import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, updates, layout, nextCommand, shared } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar shows either Lists (Spaces and Agents) or the Inbox (dz-inbox): a stack in the layout.
const inboxShown = () => find(layout(), "sidebar-lists")?.active === "inbox";
const switchSidebar = () => run("layout.select", { stack: "sidebar-lists", child: inboxShown() ? "lists" : "inbox" });

export default class WorkspaceChrome extends View {
  init(_props, cx) {
    // Only the brand bar's copy takes `dz-chrome.sidebar`; the footer's has nothing to switch.
    if (props()?.footer) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "sidebar") switchSidebar();
        // `dz-chrome.go1`…`go9` (cmd-1…9): the Nth agent as the shown list numbers them (shared "agents.jump").
        const n = /^go([1-9])$/.exec(c)?.[1];
        const addr = n && (shared("agents.jump") ?? [])[n - 1];
        if (addr) run("agent.focus", { terminal: addr });
        cx.notify();
      }
    });
  }

  render() {
    const t = theme();
    if (props()?.footer) {
      const row = (id, icon, label, action) => h_flex().id(id).relative().h(30).px(8).gap(8).items_center().rounded(8)
        .role("button").accessibility_label(label)
        .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(action).child(h_flex().size(18).flex_none().items_center().justify_center()
          .child(svg(`mods/dz-chrome/${icon}.svg`).size(16)))
        .child(div().flex_1().min_w(0).truncate().child(label));
      // props().projects (dz-projects layout): a Projects row opening dz-projects.
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(8).pt(4).pb(6).text_size(13)
        .when(Boolean(props()?.projects), el => el.child(row("projects", "projects", "Projects", () => run("mod.open", { name: "dz-projects" }))))
        .child(row("settings", "settings", "Settings", () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(div().size(6).rounded_full().bg(t.accent))));
    }
    // Room for the macOS window buttons (layout traffic_lights), a place to drag the window, and the
    // sidebar toggle at its right edge; while the sidebar is hidden, dz-tabs shows it after the buttons.
    const inbox = inboxShown();
    return h_flex().id("brand").size_full().bg(t.chrome).pr(10).gap(2).items_center().justify_end()
      .child(div().id("sidebar-mode").size(26).flex_none().flex().items_center().justify_center().rounded(6)
        .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label(inbox ? "Show lists" : "Show inbox")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(switchSidebar)
        .child(svg(`mods/workspace-chrome/${inbox ? "layers" : "circle-check"}.svg`).size(14)))
      .child(div().id("sidebar-toggle").size(26).flex_none().flex().items_center().justify_center().rounded(6)
        .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label("Hide sidebar")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(() => run("layout.toggle", { id: "sidebar" }))
        .child(svg("mods/workspace-chrome/sidebar.svg").size(14)));
  }
}
