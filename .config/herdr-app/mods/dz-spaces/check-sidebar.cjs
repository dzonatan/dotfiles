const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function element(kind = "div", source) {
  const node = { kind, source, items: [], handlers: {}, style: {}, hoverStyle: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (key === "child") node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "on_mouse_down" || key === "on_mouse_up") node.handlers[`${key}:${args[0]}`] = args[1];
      else if (key.startsWith("on_")) node.handlers[key] = args[0];
      else if (key === "id") node.key = args[0];
      else if (key === "hover") { const hovered = element(); args[0](hovered); node.hoverStyle = hovered.style; }
      else node.style[key] = args.length === 1 ? args[0] : args;
      return proxy;
    };
  } });
  return proxy;
}

// A row's laid-out children, without the absolutely placed tree lines.
const inFlow = row => row.items.filter(n => !("absolute" in n.style));

function find(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.key === id) return node;
  for (const child of node.items) { const found = find(child, id); if (found) return found; }
  return null;
}
function strings(node) {
  if (typeof node === "string") return [node];
  return node && typeof node === "object" ? node.items.flatMap(strings) : [];
}
function walk(node) {
  return node && typeof node === "object" ? [node, ...node.items.flatMap(walk)] : [];
}
function fire(node, event, ...args) {
  assert.ok(node, `missing event target: ${event}`);
  assert.equal(typeof node.handlers[event], "function", event);
  return node.handlers[event](...args);
}

const modRoot = path.dirname(__dirname);
const cx = { notify() {}, stop_propagation() {}, spawn() {}, timer: { every() {} }, focus_handle: () => { let gone = false; return { focus() { assert.ok(!gone, "a released FocusHandle throws when used"); }, is_focused: () => false, release() { gone = true; return true; } }; } };
function fixture(width) {
  const program = { key: "pi", name: "Pi", agent: true, tint: true, icon: "icons/pi.svg" };
  const tabs = ["local task", "second task", "remote task"].map((name, i) => ({ id: `b${i}`, name, named: true }));
  const spaces = tabs.map((tab, i) => ({ id: `s${i}`, name: `project ${i}`, active: i === 0, folder: `/work/p${i}`, machine: i === 2 ? "vps" : null, status: "working", tabs: [tab] }));
  const agents = [0, 2].map((i) => ({ address: i === 2 ? "vps/t2" : "t0", pane: `p${i}`, space: `s${i}`, space_name: spaces[i].name, tab: `b${i}`, title: tabs[i].name, seq: i, program, focused: i === 0, status: i === 0 ? "working" : "blocked" }));
  const terminals = [...agents.map(a => ({ ...a, state: "live" })),
    { address: "child", parent: "t0", name: "child task", state: "live", status: "error", program },
    { address: "grandchild", parent: "child", name: "grandchild task", state: "live", status: "working", program }];
  const panes = agents.map(a => ({ ...a, terminal: a.address, cwd: `/work/${a.space}` }));
  const slots = { sidebar: { id: "sidebar", size: { px: width } }, spaces: { id: "spaces", size: { px: 90 } } };
  const state = { "agents.sort": "grouped" };
  const calls = [], overlays = [], stores = new Map(), labelled = [], shown = { agent: "child" };
  const theme = new Proxy({ selected: "#2c2c2f", hover: "#202024", working: "#6b93ff", blocked: "#f0a33a", done: "#ececf0", muted: "#a9a9b4", foreground: "#f4f4f6", dim: "#77777f" }, { get: (t, k) => t[k] ?? "#a9a9b4" });
  const env = {
    View: class {}, div: () => element(), h_flex: () => element("h"), v_flex: () => element("v"),
    Button: { new: id => element("button").id(id) },
    Popover: { new: id => element("popover").id(id) }, Input: { new: () => element("input") },
    InputState: { new: () => ({ on() {}, value: () => "", set_value() {}, focus() {} }) },
    svg: source => element("svg", source), image: source => element("image", source),
    spaces: () => spaces, agents: () => agents, terminals: () => terminals, panes: () => panes,
    machines: () => [{ name: "vps", layout: "ready" }], focused: () => shown,
    exec: async () => ({ code: 1, stdout: "" }),
    window: () => ({ platform: "macos" }), props: () => ({}), theme: () => theme,
    settings: () => ({ zoom: 1 }), home: () => "/home/test",
    layout: () => ({ children: Object.values(slots) }), shared: key => state[key],
    setShared: (key, value) => { state[key] = value; }, setAgentOrder() {},
    hc: (args) => { labelled.push([...args]); return Promise.resolve({ code: 0 }); }, notify() {},
    run: (name, args) => {
      calls.push([name, JSON.parse(JSON.stringify(args ?? {}))]);
      if (name === "layout.resize") slots[args.id].size = { px: args.px };
    },
    openOverlay: spec => overlays.push(spec), closeOverlay() {}, updates: () => ({ app: {} }),
  };
  function load(name, props = {}) {
    const storage = stores.get(name) ?? new Map();
    stores.set(name, storage);
    const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const read = file => fs.readFileSync(path.join(modRoot, name, file), "utf8");
    // name.js and tree.js, the shared naming and status rules, are inlined as the mod's own copies are.
    const shared = ["name.js", "tree.js"].filter(f => fs.existsSync(path.join(modRoot, name, f))).map(f => read(f) + "\n").join("");
    const source = (shared + read("main.js"))
      .replace(/^import .*;\r?\n/gm, "").replace(/export (function|const) /g, "$1 ")
      .replace("export default class", "globalThis.Mod = class");
    const context = vm.createContext({ ...env, localStorage, props: () => props, fs: fs.promises, appHome: () => path.dirname(modRoot) });
    vm.runInContext(source, context, { filename: name });
    const mod = new context.Mod();
    mod.init?.(props, cx);
    return mod;
  }
  return { ...env, load, slots, state, calls, overlays, stores, labelled, shown };
}

for (const width of [208, 240, 256, 320, 480]) {
  const f = fixture(width);
  const sp = f.load("dz-spaces"), ag = f.load("dz-agents");
  const st = sp.render(cx);
  let at = ag.render(cx);
  assert.ok(find(at, "fold-t0") && !find(at, "sub-grandchild"), "sub-agents start folded");
  // The child is in error: folded, it still shows, one step in, hung from the parent.
  assert.equal(find(at, "sub-child").style.pl, 28, "a stuck sub-agent shows under its folded parent");
  f.terminals().find(k => k.address === "grandchild").status = "blocked";
  const stuck = ag.render(cx);
  assert.deepEqual([find(stuck, "sub-child").style.pl, find(stuck, "sub-grandchild").style.pl], [28, 28], "every stuck one hangs straight from the parent");
  f.terminals().find(k => k.address === "grandchild").status = "working";
  ag.toggleFold("t0", cx);
  Object.assign(ag.folded, { gone: false, "vps/gone": false, "far/t1": false, "sp-gone": true });
  ag.render(cx);
  assert.deepEqual(Object.keys(ag.folded).sort(), ["far/t1", "sp-gone", "t0"], "an ended agent's fold goes; a quiet machine's and group headers stay");
  at = ag.render(cx);
  const space = find(st, "space-s0"), agent = find(at, "ag-t0");
  assert.ok(strings(space).includes("project 0"), `space identity at ${width}`);
  assert.ok(strings(agent).includes("local task"), `agent identity at ${width}`);
  assert.equal(space.style.bg, "#2c2c2f");
  assert.equal(agent.style.bg, "#2c2c2f");
  const child = find(at, "sub-child"), grandchild = find(at, "sub-grandchild");
  assert.ok(child.style.pl > agent.style.px, "child is indented from its parent");
  assert.ok(grandchild.style.pl > child.style.pl, "each descendant level is indented");
  assert.ok(strings(child).includes("child task"), "sub-agent keeps its name");
  assert.equal(child.style.bg, f.theme().selected, "parent and peeked child share the selection color");
  for (const row of [space, agent, child]) assert.equal(row.hoverStyle.bg, undefined, "hover preserves a selected row");
  for (const row of [find(st, "space-s1"), find(at, "ag-vps/t2"), grandchild]) assert.equal(row.hoverStyle.bg, f.theme().hover);
  assert.equal(child.style.pl, 28, "first child sits one 20px step in, its turn hung from the parent icon");
  assert.equal(grandchild.style.pl - child.style.pl, 20);
  assert.equal(child.style.text_size, 13);
  for (const row of [agent, child, grandchild]) {
    assert.equal(inFlow(row)[0].style.size, 18, "icons share a fixed column");
    assert.equal(row.style.gap, 8);
  }
  const lines = row => row.items.filter(n => "absolute" in n.style).map(n => [n.style.left, "border_b" in n.style ? "elbow" : "line"]);
  assert.deepEqual(lines(child), [[16.25, "elbow"]], "a last child turns in from under its parent's icon");
  assert.deepEqual(lines(grandchild), [[36.25, "elbow"]], "no line continues past a last child");
  f.terminals().push({ address: "child2", parent: "t0", name: "second child", state: "live", status: "idle", program: f.agents()[0].program });
  const branched = ag.render(cx);
  assert.deepEqual(lines(find(branched, "sub-child")), [[16.25, "line"], [16.25, "elbow"]], "a middle child keeps the line going");
  assert.deepEqual(lines(find(branched, "sub-grandchild")), [[16.25, "line"], [36.25, "elbow"]], "descendants carry their ancestors' lines");
  assert.deepEqual(lines(find(branched, "sub-child2")), [[16.25, "elbow"]]);
  const elbow = find(child, "sub-child").items.find(n => "border_b" in n.style).style;
  assert.deepEqual([elbow.w, elbow.rounded_bl], [9.75, 6], "upstream-size turn: ends 4px before the icon, 6px radius");
  assert.equal(elbow.left + 1.5 / 2, agent.style.px + inFlow(agent)[0].style.size / 2, "the line runs down the parent icon's center");
  assert.equal(elbow.left + elbow.w + 4, child.style.pl + (18 - 14) / 2, "the turn stops 4px before the child icon");
  f.terminals().pop();
  assert.equal(space.items[0].style.gap, 8);
  assert.equal(space.items[0].items[0].style.size, 18);
  assert.equal(find(st, "spaces-heading").style.pr, find(at, "agents-heading").style.pr, "header actions share a right edge");
  assert.equal(find(at, "controls-t0").style.gap, 4);
  for (const id of ["status-t0", "status-vps/t2", "sub-status-child", "sub-status-grandchild"]) assert.equal(find(at, id).style.size, 20);
  assert.equal(find(agent, "pin-t0"), null, "hidden pin has no click target");
  assert.deepEqual(find(at, "controls-t0").items.map(n => n.key), ["fold-t0", "when-t0", "status-t0"], "a parent shows its fold arrow and time before the status, as the shipped list");
  assert.equal(find(at, "fold-t0").items[0].source, "mods/workspace-chrome/chevron-down.svg");
  assert.deepEqual(strings(find(at, "when-t0")), ["<1m"], "time in its state, as the shipped list");
  fire(agent, "on_hover", true, cx);
  const hoveredTree = ag.render(cx);
  assert.notEqual(find(hoveredTree, "agent-fold-t0").items[0]?.source, "mods/workspace-chrome/chevron-down.svg", "hover leaves the icon alone");
  assert.equal(find(hoveredTree, "agent-fold-t0").style.size, 18);
  assert.equal(find(hoveredTree, "pin-t0").style.size, 20, "pin is as wide as the time's slot");
  assert.equal(find(hoveredTree, "pin-t0").style.border, undefined, "pin is borderless like fold");
  fire(find(hoveredTree, "pin-t0"), "on_hover", true, cx);
  assert.equal(find(ag.render(cx), "pin-t0").items[0].style.text_color, f.theme().foreground, "hovered, the pin brightens");
  fire(find(hoveredTree, "pin-t0"), "on_hover", false, cx);
  assert.deepEqual(find(hoveredTree, "controls-t0").items.map(n => n.key), ["fold-t0", "pin-t0", "status-t0"], "pin takes the time's slot, the status stays, as the shipped list");
  assert.equal(find(at, "when-t0").style.min_w, 20, "the time's slot is the pin's width, so hovering moves nothing");
  fire(find(hoveredTree, "ag-t0"), "on_hover", false, cx);
  assert.ok(find(ag.render(cx), "when-t0") && !find(ag.render(cx), "pin-t0"), "leaving restores the time");
  assert.equal(find(at, "agent-menu-t0"), null, "no extra context menu");
  assert.equal(space.items[0].style.justify_center, undefined, "space content stays left aligned");
  assert.equal(agent.style.justify_center, undefined, "agent content stays left aligned");
  assert.equal(find(st, "sidebar-collapse"), null, "no inline sidebar toggle");
  assert.equal(find(at, "collapse"), null, "no sidebar expand control");
  assert.ok(find(at, "sp-s0"), "space group remains visible");
  fire(find(at, "agent-fold-t0"), "on_click", {}, cx);
  at = ag.render(cx);
  assert.equal(find(at, "sub-grandchild"), null, "descendants fold in place");
  assert.equal(find(at, "fold-t0").style.min_w, 20);
  assert.equal(find(at, "fold-t0").style.h, 20);
  assert.ok(strings(find(at, "fold-t0")).includes("2"), "folded badge counts descendants");
  assert.equal(find(at, "fold-t0").items[0].source, "mods/workspace-chrome/chevron-right.svg", "folded, the arrow points right");
  assert.equal(find(at, "fold-t0").items[1], "2", "and the count follows");
  assert.equal(find(at, "fold-t0").style.text_color, f.theme().dim, "count is dim");
  // Inside a hovered row a button's own fill doesn't show: its arrow and count brighten together instead.
  fire(find(at, "fold-t0"), "on_hover", true, cx);
  const lit = find(ag.render(cx), "fold-t0");
  assert.deepEqual([lit.style.text_color, lit.items[0].style.text_color], [f.theme().foreground, f.theme().foreground], "hovered, the arrow and the count brighten together");
  fire(lit, "on_hover", false, cx);
  assert.equal(find(ag.render(cx), "fold-t0").items[0].style.text_color, f.theme().dim);
  assert.equal(find(at, "status-t0").style.accessibility_label, "Needs you (sub-agent)", "folded status carries a more urgent hidden child");
  f.agents()[0].status = "blocked";
  assert.equal(find(ag.render(cx), "status-t0").style.accessibility_label, "Needs you", "a row as urgent as its children shows its own status");
  f.agents()[0].status = "idle";
  assert.equal(find(ag.render(cx), "status-t0").style.accessibility_label, "Needs you (sub-agent)");
  f.agents()[0].status = "working";
  const t0 = f.terminals().find(k => k.address === "t0");
  t0.labels = { "pi.session": "mine" };
  assert.ok(strings(find(ag.render(cx), "ag-t0")).includes("mine"), "a lone agent reads as its session, as in the inbox");
  f.agents().push({ ...f.agents()[0], address: "t1", pane: "p1", seq: 1, focused: false });
  f.terminals().push({ address: "t1", state: "live", labels: { "pi.session": "theirs" } });
  const shared = ag.render(cx);
  assert.ok(strings(find(shared, "ag-t0")).includes("mine") && strings(find(shared, "ag-t1")).includes("theirs"), "agents sharing a tab read as their own sessions");
  f.terminals().at(-1).labels = {};
  assert.ok(strings(find(ag.render(cx), "ag-t1")).includes("local task"), "without a session label it falls back to the tab");
  f.agents().pop(); f.terminals().pop(); delete t0.labels;
  assert.equal(f.slots.sidebar.size.px, width, "folding preserves sidebar width");
  fire(find(at, "fold-t0"), "on_click", {}, cx);
  at = ag.render(cx);
  assert.ok(find(at, "sub-child") && !strings(find(at, "fold-t0")).includes("2"), "the fold unfolds and drops its count");
  fire(find(at, "sub-child"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["terminal.peek", { terminal: "child" }]);
  fire(agent, "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["agent.focus", { terminal: "t0" }]);
  assert.equal(f.state["agents.pins"], undefined, "ordinary row click does not pin");
  fire(space, "on_mouse_down:left", {}, cx);
  fire(space, "on_mouse_up:left", {}, cx);
  assert.deepEqual(f.calls.pop(), ["space.select", { id: "s0" }]);
  fire(find(st, "space-s2"), "on_mouse_down:right", {}, cx);
  assert.deepEqual(JSON.parse(JSON.stringify(f.overlays.pop().props.target)), { id: "s2" });
  fire(find(at, "ag-sort"), "on_click", {}, cx);
  assert.equal(f.overlays.pop().mod, "dz-agents");
  fire(find(at, "agent-fold-t0"), "on_click", {}, cx);
  assert.equal(find(ag.render(cx), "sub-grandchild"), null);
  fire(find(ag.render(cx), "agent-fold-t0"), "on_click", {}, cx);
  assert.ok(find(ag.render(cx), "sub-child"));
  const beforePin = f.calls.length;
  let stopped = false;
  fire(find(ag.render(cx), "ag-t0"), "on_hover", true, cx);
  fire(find(ag.render(cx), "pin-t0"), "on_click", {}, { ...cx, stop_propagation() { stopped = true; } });
  assert.ok(stopped, "pin button stops propagation to the row");
  assert.ok(f.state["agents.pins"].includes("t0"));
  assert.equal(find(ag.render(cx), "pin-t0"), null, "pinning does not leave a stale hover after reordering");
  fire(find(ag.render(cx), "ag-t0"), "on_hover", true, cx);
  assert.equal(find(ag.render(cx), "pin-t0").items[0].source, "mods/workspace-chrome/pin-off.svg", "pinned rows offer unpin");
  fire(find(ag.render(cx), "ag-t0"), "on_hover", false, cx);
  assert.equal(find(ag.render(cx), "pin-t0"), null, "pinned rows also hide their pin outside hover");
  fire(find(ag.render(cx), "ag-t0"), "on_hover", true, cx);
  fire(find(ag.render(cx), "pin-t0"), "on_click", {}, cx);
  assert.equal(f.state["agents.pins"].includes("t0"), false, "unpin still persists");
  assert.equal(f.calls.length, beforePin, "pin and unpin do not focus a pane");
  fire(find(ag.render(cx), "ag-vps/t2"), "on_hover", true, cx);
  fire(find(ag.render(cx), "ag-t0"), "on_hover", false, cx);
  assert.equal(find(ag.render(cx), "pin-t0"), null);
  fire(find(ag.render(cx), "pin-vps/t2"), "on_click", {}, cx);
  assert.deepEqual([...f.state["agents.pins"]], ["vps/t2"], "pin acts on the selected remote button");
  const header = f.load("dz-chrome").render(cx);
  assert.deepEqual(header.items.map(n => n.key), ["sidebar-mode", "sidebar-toggle"], "the header holds the sidebar switch and toggle; search is a shortcut");
  assert.equal(header.style.pr + (26 - 14) / 2, 16, "the toggle's icon ends on the same line as the + and status column");
  fire(find(header, "sidebar-toggle"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["layout.toggle", { id: "sidebar" }]);
  const footer = f.load("dz-chrome", { footer: true });
  const settings = find(footer.render(cx), "settings");
  assert.equal(settings.items[0].style.size, 18);
  assert.equal(settings.style.gap, 8);
  const groups = ["pinned", "sp-s0"].map(id => find(ag.render(cx), id).style);
  assert.deepEqual([groups[0].h, "pt" in groups[0]], [22, false], "the first group sits under the heading like Spaces' first row");
  assert.deepEqual([groups[1].h, groups[1].pt], [30, 8], "later groups keep their 8px separation");
  fire(settings, "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["app.settings", {}]);
}

{
  const f = fixture(208), ag = f.load("dz-agents");
  for (const status of ["working", "blocked", "idle", "done"]) {
    const slot = ag.status(f.theme(), { status });
    assert.equal(slot.style.size, 20, `${status} keeps the same status column`);
    const mark = slot.items[0];
    assert.equal(mark.style.size + 2 * (mark.style.mx ?? 0), 14, `${status} mark is 14 wide, so centers line up`);
    assert.ok("justify_end" in slot.style && !("justify_center" in slot.style), "marks sit flush right in the slot");
    assert.equal(slot.handlers.on_click, undefined, "status remains an indicator, not a pin target");
  }
  const at = ag.render(cx), heading = find(at, "agents-heading");
  // Header icon: 14 inside a 26 button, inset by pr. Status mark: flush right inside list px 8 + row px 8.
  assert.equal(heading.style.pr + (26 - 14) / 2, 8 + find(at, "ag-t0").style.px, "status column ends under the header icons");
  assert.equal(heading.items[0].style.text_color, f.theme().muted, "section titles are a step brighter than group labels");
  assert.equal(find(at, "sp-s0").items[0].style.text_color, f.theme().dim);
  assert.equal(find(f.load("dz-spaces").render(cx), "spaces-heading").items[0].style.text_color, f.theme().muted);
}

{
  // The inbox: Working holds busy trees; Settle is by hand, undone by new work, never by looking.
  const f = fixture(256), inbox = f.load("dz-inbox"), run = { ...cx, spawn: fn => { fn(run); } };
  const remote = f.agents()[1], k = f.terminals().find(k => k.address === "vps/t2"), child = f.terminals().find(c => c.address === "child");
  child.status = "idle";
  assert.deepEqual(strings(find(inbox.render(run), "working-header")), ["Working", "1"], "a working tree moves down to Working");
  fire(find(inbox.render(run), "card-t0"), "on_hover", true, run);
  assert.equal(find(inbox.render(run), "settle-t0"), null, "a working tree can't be settled");
  remote.status = "done"; k.turn = 4;
  fire(find(inbox.render(run), "card-vps/t2"), "on_hover", true, run);
  fire(find(inbox.render(run), "settle-vps/t2"), "on_click", {}, run);
  const [, , value] = f.labelled.pop();
  assert.match(value, /^settled=\d+:4$/, "the label keeps when and the turn it was settled at");
  k.labels = { settled: value.slice(8) };
  const at = inbox.render(run);
  assert.ok(!find(at, "card-vps/t2") && strings(find(at, "settled-header")).includes("1"), "settled leaves the cards for the tail");
  {
    // The settle key (dz-inbox.settle) acts on the agent in view: a busy one stays, a settled one comes back, then goes again.
    const t0 = f.agents()[0], n = f.labelled.length;
    inbox.render(run); inbox.settleKey(run);
    assert.equal(f.labelled.length, n, "the key doesn't settle a working agent");
    t0.focused = false; remote.focused = true;
    inbox.render(run); inbox.settleKey(run);
    assert.deepEqual(f.labelled.pop(), ["label", "vps/t2", "settled="], "on a settled agent the key brings it back");
    inbox.render(run); inbox.settleKey(run);
    const [, , again] = f.labelled.pop();
    assert.match(again, /^settled=\d+:4$/, "and settles it again");
    k.labels = { settled: again.slice(8) };
    t0.focused = true; remote.focused = false;
  }
  {
    // Clear asks once on the button, then closes settled panes; a space left empty closes whole.
    // A fake timer: `due` is the pending revert and its delay, null once cancelled or run.
    let due = null;
    const later = { ...run, timer: { after(ms, fn) { const task = { ms, fn, cancel() { if (due === task) due = null; } }; return (due = task); } } };
    const tick = () => { const { fn } = due; due = null; fn(later); };
    const label = () => strings(find(inbox.render(later), "settled-clear"));
    const n = f.calls.length;
    f.spaces()[0].tabs[0].active = true;
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    assert.equal(f.calls.length, n, "the first click only asks");
    assert.deepEqual(label(), ["Clear 1?"]);
    assert.equal(due.ms, 3000, "asked without the pointer (keyboard), the ask ends on its own");
    tick();
    assert.deepEqual(label(), ["Clear"]);
    fire(find(inbox.render(later), "settled-clear"), "on_hover", true, later);
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    assert.equal(due, null, "under the pointer the ask stays");
    fire(find(inbox.render(later), "settled-clear"), "on_hover", false, later);
    assert.equal(due.ms, 400, "leaving the button ends the ask shortly");
    fire(find(inbox.render(later), "settled-clear"), "on_hover", true, later);
    assert.equal(due, null, "coming back in time keeps it");
    assert.deepEqual(label(), ["Clear 1?"]);
    fire(find(inbox.render(later), "settled-clear"), "on_click", { click_count: 2 }, later);
    assert.equal(f.calls.length, n, "a double-click's second click doesn't clear");
    assert.deepEqual(label(), ["Clear 1?"]);
    f.panes().push({ pane: "p9", tab: "b2", terminal: "t9" });
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    assert.deepEqual(f.calls.splice(n), [["pane.close", { pane: "p2" }], ["space.select", { id: "s0" }], ["tab.select", { id: "b0" }]], "another pane keeps the space");
    f.panes().pop();
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    assert.deepEqual(f.calls.splice(n), [["tab.new", { space: "s2", folder: "/work/s2" }], ["pane.close", { pane: "p2" }],
      ["space.select", { id: "s0" }], ["tab.select", { id: "b0" }]], "an emptied space keeps a fresh shell tab where its terminal was, not where the space began");
    fire(find(inbox.render(later), "settled-clear"), "on_click", {}, later);
    assert.equal(due, null, "asked under the pointer: no timer");
    remote.focused = true;
    assert.equal(find(inbox.render(later), "settled-clear"), null, "the agent in view is never cleared");
    remote.focused = false;
    assert.deepEqual(label(), ["Clear"], "a button that went away under the pointer comes back unasked");
    assert.equal(f.calls.length, n);
  }
  remote.focused = true;
  inbox.render(run);
  assert.equal(f.labelled.length, 0, "looking doesn't bring it back");
  k.turn = 5;
  inbox.render(run);
  assert.deepEqual(f.labelled.pop(), ["label", "vps/t2", "settled="], "a turn ended since brings it back");
  // The space filter, as T3's project scope: picking a space hides the others' agents; All spaces brings them back.
  const scope = (id) => fire(find(find(inbox.render(run), "inbox-scope-menu").style.content, `scope-${id}`), "on_click", { modifiers: {} }, run);
  scope("s2");
  assert.ok(find(inbox.render(run), "card-vps/t2") && !find(inbox.render(run), "working-header"), "only the chosen space's agents");
  scope("all");
  assert.ok(find(inbox.render(run), "working-header"), "all spaces again");
  // The brand bar switches the sidebar; with the inbox showing, a settled agent's done is no news.
  fire(find(f.load("dz-chrome").render(cx), "sidebar-mode"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["layout.select", { stack: "sidebar-lists", child: "inbox" }]);
  f.slots["sidebar-lists"] = { id: "sidebar-lists", active: "inbox" };
  f.spaces()[0].tabs[0].status = "done"; f.agents()[0].status = "done";
  for (const k of f.terminals()) if (k.parent) k.status = "idle";
  f.terminals().find(c => c.address === "t0").labels = { settled: "1:0" };
  assert.equal(find(f.load("dz-tabs").render(cx), "tab-b0").items.some(n => n.style.rounded_full), false, "no done dot for a settled agent's tab");
}

{
  // A parent's unread reply shows first, its working sub-agents beside it; once read, waiting on them is
  // working, everywhere, for as long as the longest-working one has worked.
  const f = fixture(256), inbox = f.load("dz-inbox");
  f.agents()[0].status = "idle"; f.terminals().find(c => c.address === "child").status = "idle";
  f.terminals().find(c => c.address === "grandchild").status_ms = Date.now() - 90000;
  assert.deepEqual(strings(find(inbox.render(cx), "state-t0")), ["Working", "1m"], "the waiting parent shows its sub-agent's working time");
  f.agents()[0].status = "done"; f.panes()[0].status = "done";
  const drawn = inbox.render(cx);
  assert.ok(strings(find(drawn, "state-t0")).includes("Done") && strings(drawn).includes("1 sub-agent working"), "an unread reply isn't hidden by a working sub-agent");
  assert.equal(find(f.load("dz-agents").render(cx), "status-t0").style.accessibility_label, "Done");
  assert.ok(find(f.load("dz-tabs").render(cx), "tab-b0").items.some(n => n.style.rounded_full), "its tab shows the done dot");
  f.agents()[0].status = "idle"; f.panes()[0].status = "idle";
  assert.deepEqual(strings(find(inbox.render(cx), "state-t0")), ["Working", "1m"], "read, the run goes on from its start");
  assert.equal(find(f.load("dz-agents").render(cx), "status-t0").style.accessibility_label, "Working (sub-agent)", "a read parent waiting on a sub-agent is working");
  const spins = tree => walk(tree).some(n => n.source === "mods/workspace-chrome/spinner.svg");
  assert.ok(spins(find(f.load("dz-tabs").render(cx), "tab-b0")) && spins(f.load("dz-pane", { pane: "p0" }).render(cx)), "its tab and pane header show it working");
}

{
  // Dragging, as T3's sidebar: labels and gaps open only while a row is lifted; Pinned pins and reorders,
  // Active unpins and unsettles, Settled settles; empty sections take drops; Esc, leaving, or a row
  // vanishing put it back; Working never lifts; a sweep from Settle or undo takes a run of rows along.
  const f = fixture(256), run = { ...cx, spawn: fn => { fn(run); } }, inbox = f.load("dz-inbox");
  for (const a of f.agents()) { a.status = "done"; a.focused = false; }
  for (const k of f.terminals()) if (k.parent) k.status = "idle";
  const t0 = f.terminals().find(k => k.address === "t0");
  const pins = () => [...(f.state["agents.pins"] ?? [])];
  const root = () => inbox.render(run);
  const h = (id) => find(root(), id)?.style.h;
  const badge = (v) => find(find(root(), "drag-ghost"), `badge-${v}`);
  // Press 10px into an 80px row, then move: the sidebar sees the pointer at y.
  const lift = (from, y = 20) => {
    fire(find(root(), from), "on_mouse_down:left", { position: { x: 0, y: 0 }, local_position: { x: 0, y: 10 }, bounds: { height: 80 } }, run);
    fire(root(), "on_mouse_move", { position: { x: 0, y }, local_position: { x: 0, y: 100 + y } }, run);
  };
  const over = (to, y = 10) => fire(find(root(), to), "on_mouse_move", { local_position: { x: 0, y }, bounds: { height: 80 } }, run);
  const release = () => fire(root(), "on_mouse_up:left", {}, run);
  const drag = (from, to, y) => { lift(from); over(to, y); release(); };

  assert.equal(h("pinned"), 0, "no Pinned or Active label until something is lifted");
  f.shown.pane = "p9";
  lift("card-t0", 5);
  assert.equal(find(root(), "drag-ghost"), null, "under 6px it's still a click");
  release();
  lift("card-vps/t2");
  assert.ok(find(find(root(), "drag-ghost"), "ghost-card-vps/t2"), "the lifted card follows the pointer");
  assert.equal(find(root(), "drag-ghost").style.top, 110, "the pressed spot stays under the pointer");
  assert.equal(h("pinned"), 24); assert.equal(h("active"), 24, "the labels open while it's lifted");
  assert.equal(h("hold-vps/t2"), 82, "it holds its place, spacing included");
  assert.equal(badge("pin"), null, "over its own section it says nothing");
  over("pinned");
  assert.equal(h("hold-vps/t2"), 0, "headed elsewhere, its place folds");
  assert.equal(h("gap-head-pinned"), 82, "and empty Pinned opens a gap under its label");
  assert.ok(badge("pin"), "the lifted card says Pin");
  release();
  assert.deepEqual(pins(), ["vps/t2"]);
  assert.ok(find(f.load("dz-agents").render(cx), "pinned"), "the agents list shows the same pin");
  assert.deepEqual(f.calls.pop(), ["pane.focus", { pane: "p9" }], "letting go hands the keyboard back to the pane that had it");
  assert.equal(h("pinned"), 0, "the labels close again");
  assert.ok(walk(find(root(), "card-vps/t2")).some(n => n.source === "mods/workspace-chrome/pin.svg"), "a pin shows its glyph");

  lift("card-t0"); over("card-vps/t2", 10);
  assert.equal(h("gap-vps/t2"), 82, "the upper half of a pin opens a gap above it");
  over("card-vps/t2", 60);
  assert.equal(h("gap-vps/t2"), 0);
  assert.equal(h("gap-end-pinned"), 82, "the lower half opens it below");
  assert.deepEqual(JSON.parse(JSON.stringify(find(root(), "gap-end-pinned").style.transition)), ["height", { duration: 150, easing: "ease-out" }], "gaps slide natively");
  release();
  assert.deepEqual(pins(), ["vps/t2", "t0"]);
  lift("card-t0"); over("card-vps/t2", 10);
  assert.equal(badge("pin"), null, "reordering pins says nothing");
  release();
  assert.deepEqual(pins(), ["t0", "vps/t2"], "within Pinned it reorders");
  drag("card-t0", "card-t0", 70);
  assert.deepEqual(pins(), ["t0", "vps/t2"], "back over its own place, nothing changes");

  lift("card-t0");
  assert.ok(find(root(), "active-placeholder"), "empty Active shows a dashed drop target");
  over("active-placeholder");
  assert.equal(find(root(), "active-placeholder"), null);
  assert.equal(h("gap-head-active"), 82, "targeted, it opens a gap instead");
  assert.ok(badge("unpin"));
  release();
  assert.deepEqual(pins(), ["vps/t2"], "onto Active unpins");

  lift("card-t0");
  assert.ok(find(root(), "settled-header") && find(root(), "settled-placeholder"), "Settled shows while dragging, even empty");
  over("settled-header");
  assert.ok(badge("settle"));
  release();
  const [, addr, value] = f.labelled.pop();
  assert.equal(addr, "t0");
  assert.match(value, /^settled=\d+:/, "dropped on Settled, it's settled");
  t0.labels = { settled: value.slice(8) };
  inbox.open = true;
  lift("slim-t0");
  assert.ok(find(find(root(), "drag-ghost"), "ghost-slim-t0"), "a settled row lifts as its row");
  over("card-vps/t2", 10);
  assert.equal(h("gap-vps/t2"), 84, "the gap is the destination's: a card");
  assert.ok(badge("pin"), "a settled row can be pinned");
  over("active-rest");
  assert.equal(h("gap-head-active"), 84, "the empty space above the shelves counts as Active");
  assert.ok(badge("unsettle"));
  release();
  assert.deepEqual(f.labelled.pop(), ["label", "t0", "settled="], "dropped on Active, it's unsettled");
  assert.deepEqual(pins(), ["vps/t2"]);
  lift("card-t0");
  assert.equal(find(root(), "drag-ghost"), null, "a row whose change hasn't landed yet stays put");
  release();
  t0.labels = {};

  f.state["agents.pins"] = [];
  fire(find(root(), "card-t0"), "on_hover", true, run);
  const settleButton = find(root(), "settle-t0");
  fire(settleButton, "on_mouse_down:left", { position: { x: 0, y: 0 } }, { ...run, stop_propagation() {} });
  fire(root(), "on_mouse_move", { position: { x: 0, y: 20 }, local_position: { x: 0, y: 120 } }, run);
  over("card-vps/t2");
  assert.ok(find(find(root(), "card-t0"), "badge-settle") && find(find(root(), "card-vps/t2"), "badge-settle"), "a sweep from Settle marks the run");
  assert.equal(find(root(), "drag-ghost"), null, "a sweep lifts nothing");
  release();
  assert.deepEqual(f.labelled.splice(0).map(([, a, v]) => [a, v.split("=")[0]]).sort(), [["t0", "settled"], ["vps/t2", "settled"]], "letting go settles every marked row");
  fire(settleButton, "on_click", {}, run);
  assert.equal(f.labelled.length, 0, "the button's click after a sweep doesn't settle again");
  for (const k of [t0, f.terminals().find(k => k.address === "vps/t2")]) k.labels = { settled: `${Date.now()}:0` };

  const n = f.labelled.length;
  lift("slim-vps/t2"); over("active");
  fire(root(), "on_key_down", { keystroke: "escape" }, run);
  assert.equal(find(root(), "drag-ghost"), null, "Esc puts it back");
  release();
  lift("slim-vps/t2"); over("active");
  fire(root(), "on_hover", false, run);
  assert.equal(find(root(), "drag-ghost"), null, "leaving off a side puts it back");
  release();
  const before = f.calls.length;
  lift("slim-vps/t2"); over("active");
  const gone = f.agents().splice(1, 1)[0];
  assert.equal(find(root(), "drag-ghost"), null, "a row that leaves the list ends the drag");
  f.agents().push(gone);
  release();
  assert.deepEqual(f.calls.slice(before), [["pane.focus", { pane: "p9" }]], "and the release still hands the keyboard back");
  assert.equal(f.labelled.length, n, "none of those changed anything");
  // Off the bottom edge, past the Settled shelf, it lands where the badge said (Herdr reports no release outside).
  fire(root(), "on_size_change", { width: 256, height: 900 }, run);
  for (const k of f.terminals()) if (k.address === "vps/t2") k.labels = {};
  lift("card-vps/t2");
  fire(root(), "on_mouse_move", { position: { x: 0, y: 40 }, local_position: { x: 130, y: 895 } }, run);
  over("settled-header");
  fire(root(), "on_hover", false, run);
  assert.equal(find(root(), "drag-ghost"), null);
  assert.deepEqual(f.labelled.pop()?.slice(0, 2), ["label", "vps/t2"], "leaving off the bottom settles it");
  const calls = f.calls.length;
  lift("slim-vps/t2"); over("slim-vps/t2");
  fire(find(root(), "slim-vps/t2"), "on_click", {}, run);
  release();
  assert.ok(!f.calls.slice(calls).some(([name]) => name === "agent.focus"), "a drag's release doesn't open the row");

  const old = fixture(256);
  old.stores.set("dz-agents", new Map([["pins", '["t0"]']]));
  old.load("dz-agents");
  assert.deepEqual([...old.state["agents.pins"]], ["t0"], "older pins move to the shared set, so a drag in the inbox keeps them");

  const w = fixture(256), wf = w.load("dz-inbox");
  for (const k of w.terminals()) if (k.parent) k.status = "idle";
  fire(find(wf.render(cx), "card-t0"), "on_mouse_down:left", { position: { x: 0, y: 0 }, local_position: { x: 0, y: 10 }, bounds: { height: 80 } }, cx);
  fire(wf.render(cx), "on_mouse_move", { position: { x: 0, y: 30 }, local_position: { x: 0, y: 130 } }, cx);
  assert.equal(find(wf.render(cx), "drag-ghost"), null, "a working card doesn't lift");
}

{
  const f = fixture(256), sp = f.load("dz-spaces"), ag = f.load("dz-agents");
  let root = sp.render(cx);
  // The Spaces/Agents divider is the layout's own, as upstream: neither list sizes it.
  for (const tree of [root, ag.render(cx)]) assert.equal(walk(tree).filter(n => "on_size_change" in n.handlers).length, 0, "no list measures itself to move the divider");
  assert.ok(!f.calls.some(([name]) => name === "layout.resize"), "rendering never resizes the layout");
  root = sp.render(cx);
  fire(find(root, "space-s0"), "on_mouse_down:left", {}, cx);
  fire(find(root, "space-s1"), "on_mouse_move", {}, cx);
  fire(find(root, "space-s1"), "on_mouse_up:left", {}, cx);
  assert.deepEqual(f.calls.pop(), ["space.move", { id: "s0", index: 2 }]);
  const n2 = f.calls.length;
  fire(find(root, "space-s0"), "on_mouse_down:left", {}, cx);
  fire(find(root, "space-s2"), "on_mouse_move", {}, cx);
  fire(find(root, "space-s2"), "on_mouse_up:left", {}, cx);
  assert.equal(f.calls.length, n2, "cross-machine drag remains rejected");
}

{
  const f = fixture(240), ag = f.load("dz-agents"), sp = f.load("dz-spaces");
  const worktree = sp.row({ w: f.spaces()[1], i: 1, g: null, tree: "└─" }, f.theme());
  assert.equal(inFlow(worktree)[0].style.pl, 20, "worktree icon lines up with a sub-agent's");
  assert.equal(inFlow(worktree)[0].items[0].style.size, 18);
  const treeLines = row => row.items.filter(n => "absolute" in n.style).map(n => [n.style.left, "border_b" in n.style ? "elbow" : "line"]);
  assert.deepEqual(treeLines(worktree), [[16.25, "elbow"]], "last worktree turns in from under its checkout");
  assert.deepEqual(treeLines(sp.row({ w: f.spaces()[1], i: 1, g: null, tree: "├─" }, f.theme())), [[16.25, "line"], [16.25, "elbow"]], "a middle worktree keeps the line going");
  assert.deepEqual(treeLines(sp.row({ w: f.spaces()[1], i: 1, g: null, tree: null }, f.theme())), [], "checkouts draw no lines");
  {
    // project 1 is a worktree of project 0's repo.
    const g = { repo: "/r", linked: false, name: "project 0", branch: "main", ahead: 0, behind: 0 };
    sp.git[JSON.stringify([null, "/work/s0"])] = g;
    sp.git[JSON.stringify([null, "/work/p1"])] = { ...g, linked: true, branch: "x" };
    const ids = () => [...sp.ordered().map(r => r.w.id)];
    assert.deepEqual(ids(), ["s0", "s1", "s2"]);
    const arrow = find(sp.render(cx), "space-fold-s0");
    assert.deepEqual([arrow.items[0].source, arrow.items.length], ["mods/workspace-chrome/chevron-down.svg", 1], "a checkout shows its fold arrow at the end, as an agent parent");
    assert.equal(arrow.style.text_color, f.theme().dim, "the arrow is dim");
    fire(arrow, "on_hover", true, cx);
    assert.equal(find(sp.render(cx), "space-fold-s0").items[0].style.text_color, f.theme().foreground, "hovered, it brightens");
    fire(arrow, "on_hover", false, cx);
    let stopped = false;
    fire(arrow, "on_mouse_down:left", {}, { ...cx, stop_propagation() { stopped = true; } });
    assert.ok(stopped, "pressing the arrow neither selects nor drags the space");
    const before = f.calls.length;
    fire(arrow, "on_click", {}, cx);
    assert.deepEqual(ids(), ["s0", "s2"], "folding hides the worktrees");
    assert.equal(f.calls.length, before, "folding runs no command");
    assert.equal(f.stores.get("dz-spaces").get("repos.folded"), JSON.stringify(["/r"]), "folding persists");
    const count = find(sp.render(cx), "space-fold-s0");
    assert.equal(count.items[0].source, "mods/workspace-chrome/chevron-right.svg");
    assert.deepEqual([count.items[1], count.style.text_color], ["1", f.theme().dim], "folded, a dim count says how many");
    fire(count, "on_click", {}, cx);
    assert.deepEqual(ids(), ["s0", "s1", "s2"], "the count unfolds them");
    assert.equal(find(sp.render(cx), "space-fold-s0").items.length, 1);
    sp.git = {};
  }
  delete f.agents()[0].program.icon;
  ag.toggleFold("t0", cx);
  const tree = ag.render(cx);
  assert.equal(find(tree, "ag-t0").items[0].style.size, 18, "missing icons do not shift names");
  assert.equal(inFlow(find(tree, "sub-child"))[0].style.size, 18);
  fire(find(tree, "agent-fold-t0"), "on_click", {}, cx);
  assert.equal(find(ag.render(cx), "sub-grandchild"), null, "missing icons do not disable folding");
  const menu = f.load("dz-agents", { sortMenu: true }).render(cx);
  assert.equal(find(menu, "sort-grouped").style.bg, f.theme().selected);
  assert.equal(find(menu, "sort-grouped").hoverStyle.bg, undefined);
  fire(find(menu, "sort-priority"), "on_click", {}, cx);
  assert.equal(f.state["agents.sort"], "priority");
  const byPriority = find(ag.render(cx), "ag-t0"), names = byPriority.items[1];
  assert.deepEqual(strings(names), ["local task", "project 0"], "without a space header the task leads and its space follows; the address stays in the pane header");
  assert.deepEqual([names.items[1].style.text_color, names.items[1].style.text_size, names.items[1].style.flex_shrink], [f.theme().dim, 12, 1000], "the space is dim, smaller, and gives way first");
}

{
  const f = fixture(256), first = f.spaces()[0].tabs[0];
  Object.assign(first, { active: true, status: "working" });
  f.spaces()[0].tabs.push({ id: "other", name: "other task", active: false });
  const tabs = f.load("dz-tabs"), root = tabs.render(cx);
  assert.equal(find(root, "tab-b0").hoverStyle.bg, undefined);
  assert.equal(find(root, "tab-other").hoverStyle.bg, f.theme().hover);
  assert.equal(find(root, "tab-scroll").style.gap, 4);
  // A tab nobody named reads as its agent, the name its pane header and inbox card show.
  Object.assign(first, { name: "1", named: false });
  f.terminals().find(k => k.address === "t0").labels = { "pi.session": "mine" };
  assert.ok(strings(find(f.load("dz-tabs").render(cx), "tab-b0")).includes("mine"), "an unnamed tab reads as its agent's session");
  assert.ok(strings(f.load("dz-pane", { pane: "p0" }).render(cx)).includes("mine"), "its pane header reads the same");

  // New opens a terminal tab in the space picked: no agent step.
  const menu = f.load("dz-new-menu"); f.calls.length = 0;
  menu.choose(f.spaces()[0]);
  assert.deepEqual(f.calls.splice(0), [["tab.new", { space: f.spaces()[0].id }]], "New opens a tab");
  menu.choose(menu.items().find(s => s.id === "new"));
  assert.deepEqual(f.calls.pop(), ["space.new", {}], "New space opens a space");
  f.calls.length = 0;
  assert.equal(find(root, "sidebar-toggle"), null, "with the sidebar shown its own header has the toggle");
  f.slots.sidebar.hidden = true;
  const bare = tabs.render(cx);
  assert.deepEqual(bare.items.slice(0, 2).map(n => n.key), ["sidebar-toggle", "tab-scroll"], "hidden, the toggle sits first, after the window buttons");
  const toggle = find(bare, "sidebar-toggle");
  // t0 works, but its sub-agent is stuck: it needs the person too.
  assert.deepEqual(toggle.items.slice(1).map(n => [n.key, strings(n)]), [["agents-blocked", ["!", "2"]]], "hidden, the toggle sums up agents most urgent first, idle left out");
  assert.equal(toggle.style.accessibility_label, "Show sidebar, 2 need you");
  assert.equal(walk(tabs.render(cx)).concat(walk(f.load("dz-agents").render(cx)), walk(f.load("dz-spaces").render(cx)), walk(f.load("dz-chrome").render(cx)), walk(f.load("dz-pane", { pane: "p0" }).render(cx))).filter(n => "tooltip" in n.style).length, 0, "no hover tooltips");
  {
    // One look across the preset: the same "needs you" mark everywhere, no scrollbars, English throughout.
    f.spaces()[0].tabs[0].status = "blocked";
    f.panes()[0].status = "blocked";
    const all = () => [tabs.render(cx), f.load("dz-agents").render(cx), f.load("dz-spaces").render(cx), f.load("dz-chrome").render(cx), f.load("dz-pane", { pane: "p0" }).render(cx)].flatMap(walk);
    const look = n => { const { accessibility_label, ...s } = n.style; return JSON.stringify([s, strings(n)]); };
    const marks = all().filter(n => strings(n).join("") === "!" && n.style.size === 14);
    assert.ok(marks.length >= 3, "tabs, the agents list and the pane header all show needs-you");
    assert.equal(new Set(marks.map(look)).size, 1, "needs-you is drawn the same everywhere");
    assert.ok(!all().some(n => Object.keys(n.style).some(k => k.includes("scrollbar"))), "lists scroll without a painted bar");
    assert.ok(!all().some(n => /\p{Script=Han}/u.test(strings(n).join("") + (n.style.accessibility_label ?? ""))), "UI text and labels are English");
    delete f.spaces()[0].tabs[0].status; f.panes()[0].status = "working";
  }
  const saved = f.agents().map(a => a.status);
  f.agents().forEach(a => { a.status = "idle"; });
  for (const k of f.terminals()) if (k.parent) k.status = "idle";
  assert.deepEqual(find(tabs.render(cx), "sidebar-toggle").items.length, 1, "with nothing to report it is just the icon");
  f.agents().forEach((a, i) => { a.status = saved[i]; });
  fire(find(bare, "sidebar-toggle"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["layout.toggle", { id: "sidebar" }]);
  delete f.slots.sidebar.hidden;
  fire(find(root, "tab-b0"), "on_mouse_down:left", { click_count: 1 }, cx);
  fire(find(root, "tab-other"), "on_mouse_up:left", {}, cx);
  assert.deepEqual(f.calls.pop(), ["tab.move", { id: "b0", index: 2 }]);
  fire(find(root, "tab-other"), "on_mouse_down:right", {}, cx);
  assert.equal(f.overlays.pop().props.target.id, "other");
  fire(find(root, "tab-new"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["tab.new", {}], "the tab bar's + opens a tab in its space");
  fire(find(root, "close-b0"), "on_click", {}, cx);
  assert.deepEqual(f.calls.pop(), ["tab.close", { id: "b0" }]);
  const pane = f.load("dz-pane", { pane: "p0" });
  pane.hovered = true;
  const head = pane.render(cx);
  const spinner = tree => walk(tree).find(n => n.source === "mods/workspace-chrome/spinner.svg");
  const open = f.load("dz-agents");
  for (const tree of [tabs.render(cx), head, open.render(cx)]) assert.equal(spinner(tree).style.text_color, f.theme().working);
  for (const id of ["ph-r-p0", "ph-d-p0", "ph-z-p0", "ph-x-p0"]) assert.equal(find(head, id).style.size, 26);
  const actions = walk(head).find(n => n.items.some(child => child?.key === "ph-r-p0"));
  assert.equal(actions.style.gap, 4);
  assert.ok("flex_none" in actions.style, "narrow panes keep the action targets at their full size");
}
{
  // Icons: every UI glyph drawn is a file that exists.
  const f = fixture(256);
  f.spaces()[0].tabs[0].status = "blocked";
  const trees = [f.load("dz-tabs").render(cx), f.load("dz-agents").render(cx), f.load("dz-spaces").render(cx), f.load("dz-chrome").render(cx), f.load("dz-chrome", { footer: true }).render(cx), f.load("dz-pane", { pane: "p0" }).render(cx)].flatMap(walk);
  const glyphs = trees.filter(n => n.kind === "svg").map(n => n.source).filter(s => !s.endsWith("/spinner.svg") && s !== "icons/pi.svg");
  assert.ok(glyphs.length >= 5);
  for (const s of glyphs) {
    assert.ok(fs.existsSync(path.join(path.dirname(modRoot), s)), `icon on disk: ${s}`);
  }
}
(async () => {
  {
    const f = fixture(256);
    assert.equal(find(f.load("dz-tabs").render(cx), "pulls-review"), null, "no review button");
  }
  console.log("ok: sidebar widths 208/240/256/320/480, pins, tree, colors, space drag, search/settings, tabs and pane controls, inbox Working/Settle.");
})().catch(e => { console.error(e); process.exit(1); });
