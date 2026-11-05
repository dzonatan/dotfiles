const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function element() {
  const node = { key: null, items: [], handlers: {}, style: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (["child", "content", "trigger"].includes(key)) node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.key = args[0];
      else if (key === "on_mouse_down" || key === "on_mouse_up") node.handlers[`${key}:${args[0]}`] = args[1];
      else if (key.startsWith("on_")) node.handlers[key] = args[0];
      else node.style[key] = args;
      return proxy;
    };
  } });
  return proxy;
}

function find(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.key === id) return node;
  for (const child of node.items) { const hit = find(child, id); if (hit) return hit; }
  return null;
}

function cards(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.key?.startsWith("card-")) out.push(node.key.slice(5));
  else for (const child of node.items) cards(child, out);
  return out;
}

function texts(node) {
  if (typeof node === "string") return [node];
  return node && typeof node === "object" ? node.items.flatMap(texts) : [];
}

function fixture() {
  const f = { now: 1000, rows: [], terms: [], order: [], calls: [], jobs: [], timers: [], data: new Map(), pins: [], mode: "inbox", notifications: [] };
  const cx = {
    notify() { f.notified = true; }, stop_propagation() {},
    focus_handle: () => ({ focus() { f.keys = true; } }),
    spawn: (fn) => f.jobs.push(fn),
    timer: {
      every: () => ({}),
      after(ms, fn) {
        const timer = { at: f.now + ms, fn, cancelled: false, cancel() { this.cancelled = true; } };
        f.timers.push(timer);
        return timer;
      },
    },
  };
  const env = {
    View: class {}, div: element, image: element, svg: element, v_flex: element, h_flex: element,
    Popover: { new: element }, Input: { new: element }, Button: { new: element },
    InputState: { new: () => ({ on() {}, value: () => "", set_value() {}, focus() {} }) },
    namer: () => (a) => a.address, Date: class extends Date { static now() { return f.now; } },
    localStorage: { getItem: (k) => f.data.get(k) ?? null, setItem: (k, v) => f.data.set(k, v) },
    agents: () => f.rows, terminals: () => f.terms, panes: () => [],
    spaces: () => [{ id: "s1", name: "One", tabs: [] }, { id: "s2", name: "Two", tabs: [] }],
    focused: () => ({ agent: f.rows.find((a) => a.focused)?.address }),
    theme: () => ({}), settings: () => ({}), props: () => ({}),
    layout: () => ({ id: "sidebar-lists", active: f.mode }),
    shared: (k) => k === "agents.pins" ? f.pins : null,
    setShared: (k, v) => { if (k === "agents.pins") f.pins = Array.from(v); },
    setAgentOrder: (xs) => { f.order = Array.from(xs); },
    run: (...args) => f.calls.push(args), notify: (n) => f.notifications.push(n), openOverlay() {}, closeOverlay() {},
    hc: async () => ({ code: 0 }), nextCommand: () => new Promise(() => {}),
  };
  // tree.js, the shared status rule, is inlined as each mod's own copy is.
  // Local additions too: session.js (kept sessions) and snooze.js.
  const own = (f) => fs.readFileSync(path.join(__dirname, f), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export (async function|function|const) /g, "$1 ");
  const tree = own("tree.js") + own("session.js") + own("snooze.js");
  const src = tree + fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
  const context = vm.createContext(env);
  vm.runInContext(src, context, { filename: "dz-inbox/main.js" });
  f.mod = new context.Mod(); f.mod.init({}, cx);
  f.loadAgents = () => {
    const src = tree + fs.readFileSync(path.join(__dirname, "../dz-agents/main.js"), "utf8")
      .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
    const context = vm.createContext({ ...env });
    vm.runInContext(src, context);
    const mod = new context.Mod(); mod.init({});
    return () => mod.render(cx);
  };
  f.add = (address, status = "idle", ms = 100) => {
    const row = { address, status, seq: f.rows.length + 1, space: "s1", space_name: "One", pane: address, program: {}, focused: false };
    f.rows.push(row);
    f.terms.push({ address, status, status_ms: ms, state: "live", turn: 0, labels: {} });
    return row;
  };
  f.render = (now = f.now) => {
    f.now = now;
    for (const timer of f.timers) if (!timer.cancelled && timer.at <= now) { timer.cancel(); timer.fn(cx); }
    f.tree = f.mod.render(cx);
    return f.tree;
  };
  f.working = () => cards(find(f.tree, "shelves"));
  f.active = () => cards(find(f.tree, "inbox-list")).filter((a) => !f.working().includes(a) && !f.pins.includes(a));
  f.event = (id, name, e = {}) => {
    const node = find(f.tree, id);
    assert.ok(node, `missing ${id}`);
    assert.ok(node.handlers[name], `missing ${name} on ${id}`);
    node.handlers[name]({ position: { x: 20, y: 100 }, local_position: { x: 20, y: 100 }, bounds: { height: 82 }, modifiers: {}, ...e }, cx);
  };
  f.settle = () => f.mod.settleKey(cx);
  f.cx = cx;
  f.env = env;
  return f;
}

test("a quick continuation keeps its Working place, showing its real state meanwhile", () => {
  const f = fixture(), a = f.add("A", "working", 100); f.add("B", "working", 200); f.mod.workOpen = true;
  f.render(); assert.deepEqual(f.working(), ["B", "A"]);
  a.status = "done"; f.render(1100);
  assert.deepEqual(f.working(), ["B", "A"]);
  assert.ok(texts(find(f.tree, "state-A")).includes("Done"));
  a.status = "working"; f.render(1300);
  assert.deepEqual(f.working(), ["B", "A"]);
});

test("a finished run moves to Active once the grace is out; blocked moves at once", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  f.terms[0].turn++; f.render(2000); // the turn's end arriving late doesn't restart the grace
  f.render(3099); assert.deepEqual(f.working(), ["A", "B"]);
  assert.ok(f.timers.some((t) => !t.cancelled && t.at === 3100)); // on time, not on the next second's tick
  f.render(3100); assert.deepEqual(f.active(), ["A"]);
  b.status = "blocked"; f.render(3200); assert.deepEqual(f.active(), ["B", "A"]);
  f.terms.push({ address: "kid", parent: "A", state: "live", status: "error" });
  a.status = "working"; f.render(3300); assert.deepEqual(f.active(), ["A", "B"]);
});

test("a failed turn needs the person: the terminal's error, which agents() can't say", () => {
  const f = fixture(); f.add("A", "done"); f.add("B", "done");
  f.terms[0].status = "error";
  f.render();
  assert.ok(texts(find(f.tree, "state-A")).includes("Needs you"));
  assert.ok(texts(find(f.tree, "state-B")).includes("Done"));
  // A sub-agent with its own pane is in agents() too, where its error reads as something else.
  f.add("kid", "done"); f.terms.at(-1).parent = "B"; f.terms.at(-1).status = "error";
  f.render();
  assert.ok(texts(find(f.tree, "state-B")).includes("Needs you"));
});

test("looking, seq and data order don't reshuffle; equal times go by address", () => {
  const f = fixture(), a = f.add("B", "done"); f.add("A", "done");
  f.render(); assert.deepEqual(f.order, ["A", "B"]);
  a.status = "idle"; a.focused = true; a.seq = 99; f.rows.reverse(); f.render(1500);
  assert.deepEqual(f.order, ["A", "B"]);
  for (const k of f.terms) k.labels.settled = "500:0";
  f.render(1600); f.rows.reverse(); f.render(1700); assert.deepEqual(f.order, ["A", "B"]);
});

test("a short absence and a restart keep each agent's place", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B"), c = f.add("C", "idle", 1500);
  f.render(1600); a.status = "done"; f.render(2000); f.render(4100);
  assert.deepEqual(f.order, ["A", "C", "B"]);
  f.rows = [b, c]; b.status = "working"; f.render(4200);
  f.rows = [a, b, c]; f.render(4300); assert.deepEqual(f.order, ["A", "C", "B"]);
  const g = fixture(); g.data = f.data; g.rows = f.rows; g.terms = f.terms; g.mod.init({}, g.cx);
  g.render(4400); assert.deepEqual(g.order, f.order);
  f.terms[0].state = "exited"; f.rows = [b, c]; c.status = "working"; f.render(4500);
  assert.equal(f.mod.changed.A, undefined);
});

test("a turn that ended unseen is news; unsettling doesn't land on Working", () => {
  const f = fixture(), a = f.add("A", "idle", 200); f.add("B", "idle", 100);
  f.render(); assert.deepEqual(f.order, ["A", "B"]);
  f.terms[1].turn++; f.render(1500); assert.deepEqual(f.order, ["B", "A"]);
  f.terms[0].labels.settled = "1000:0"; f.render(1600);
  a.focused = true; f.settle(); f.render(1700);
  assert.deepEqual(f.working(), []); assert.deepEqual(f.order, ["A", "B"]);
});

// Synced alone to herdr-t3-focus, there's no agents list to load.
const lists = fs.existsSync(path.join(__dirname, "../dz-agents/main.js"));
test("only the sidebar list in view sets agent.next order", { skip: !lists && "dz-agents isn't here" }, () => {
  const f = fixture(); f.add("A", "working"); f.add("B", "idle", 200); f.render();
  const order = [...f.order], renderAgents = f.loadAgents(); renderAgents();
  assert.deepEqual(f.order, order);
  f.mode = "lists"; renderAgents(); const lists = [...f.order];
  f.render(1500); assert.deepEqual(f.order, lists);
});

test("a pause for the person keeps the run's Working place", () => {
  const f = fixture(), a = f.add("A", "working", 100); f.add("B", "working", 200); f.mod.workOpen = true;
  f.render(); a.status = "blocked"; f.render(1100); assert.deepEqual(f.active(), ["A"]);
  a.status = "working"; f.render(9000); assert.deepEqual(f.working(), ["B", "A"]);
});

test("a reply while sub-agents work comes to Active; read, the run goes on from its start", () => {
  const f = fixture(), a = f.add("A", "idle"); f.mod.workOpen = true;
  f.render(1000); f.terms.push({ address: "kid", parent: "A", state: "live", status: "working" });
  f.render(2000); assert.deepEqual(f.working(), ["A"]);
  a.status = "done"; f.render(3000); assert.deepEqual([f.active(), f.working()], [["A"], []]);
  a.status = "idle"; f.render(4000); assert.deepEqual(f.working(), ["A"]);
  assert.equal(f.mod.changed.A.at, 2000);
});

test("a run out of its grace lands on top of Active, over one that came back meanwhile", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  b.status = "blocked"; f.render(2000); assert.deepEqual(f.active(), ["B"]);
  f.render(3100); assert.deepEqual(f.active(), ["A", "B"]);
});

test("pinned agents skip the grace: unpinned right after stopping, it's in Active", () => {
  const f = fixture(), a = f.add("A", "working"); f.pins = ["A"]; f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  f.pins = []; f.render(1200);
  assert.deepEqual(f.active(), ["A"]); assert.deepEqual(f.working(), []);
});

test("Settle in view moves down the cards, then from the top", () => {
  const go = (focus) => {
    const f = fixture(); f.add("A", "idle", 300); f.add("B", "idle", 200); f.add("P", "idle", 100); f.pins = ["P"];
    f.rows.find((a) => a.address === focus).focused = true; f.render(); assert.deepEqual(f.order, ["P", "A", "B"]);
    f.settle(); return f.calls.at(-1)[1].terminal;
  };
  assert.equal(go("A"), "B");
  assert.equal(go("B"), "P");
});

test("times read as T3's", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); f.render(1000 + 3720000);
  assert.deepEqual(texts(find(f.tree, "state-A")).slice(-2), ["1h", "2m"]);
  b.status = "idle"; f.render(4000000); f.render(4002000);
  assert.ok(texts(find(f.tree, "state-B")).includes("just now"));
  f.render(4002000 + 9 * 86400000); assert.ok(texts(find(f.tree, "state-B")).includes("9d"));
});

test("a new scope starts the settled tail over", () => {
  const f = fixture(); f.mod.limit = 35; f.mod.pick({ id: "s1" }, false, f.cx);
  assert.equal(f.mod.limit, 10);
});

test("a plain click on Settle leaves no sweep behind to swallow the next click", () => {
  const f = fixture(), a = f.add("A", "idle", 100); f.add("B", "idle", 50); f.add("C", "idle", 30); a.focused = true;
  f.render(); f.mod.hovered = "A"; f.render();
  f.event("settle-A", "on_mouse_down:left");
  // The button's click stops its release there: the sidebar's own mouse-up never comes.
  f.event("settle-A", "on_click"); f.render(1100);
  f.event("dz-inbox-root", "on_mouse_move", { position: { x: 20, y: 300 } });
  assert.equal(f.keys, undefined, "the sidebar doesn't take the keyboard");
  f.event("card-C", "on_click");
  assert.deepEqual([f.calls.at(-1)[0], f.calls.at(-1)[1].terminal], ["agent.focus", "C"], "the next click opens the card at once");
});

test("a plain click on a settled row's undo leaves no sweep behind either", () => {
  const f = fixture(); f.add("A"); f.terms[0].labels.settled = "500:0"; f.mod.open = true;
  f.render(); f.mod.hovered = "A"; f.render();
  f.event("unsettle-A", "on_mouse_down:left"); f.event("unsettle-A", "on_click"); f.render(1100);
  f.event("dz-inbox-root", "on_mouse_move", { position: { x: 20, y: 300 } });
  assert.equal(f.keys, undefined); assert.equal(f.mod.sweep, null);
});

test("snoozed agents sit on their own shelf until their time, then come back on top", () => {
  const f = fixture(); f.add("A", "idle", 100); f.add("B", "idle", 50);
  f.terms[1].labels.snoozed = "5000";
  f.render();
  assert.ok(find(f.tree, "snoozed"), "the Snoozed shelf shows");
  assert.ok(find(f.tree, "nap-B"), "B is on it");
  assert.ok(!find(f.tree, "card-B"), "B is no card");
  f.render(6000);
  assert.ok(f.notifications.some((n) => n.title === "Back from snooze"), "it says so");
  delete f.terms[1].labels.snoozed; f.render(6100);
  assert.ok(!find(f.tree, "snoozed"), "the shelf goes");
  assert.equal(cards(find(f.tree, "inbox-list"))[0], "B", "B is on top of Active");
});

test("snooze reads custom times", () => {
  const src = fs.readFileSync(path.join(__dirname, "snooze.js"), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export (async function|function|const) /g, "$1 ");
  const c = vm.createContext({ hc: async () => ({ code: 0 }), Date }); vm.runInContext(src + "; globalThis.parse = parse;", c);
  const now = new Date(2026, 10, 4, 15, 0).getTime(), hr = 3600000;
  assert.equal(c.parse("45m", now), now + 45 * 60000);
  assert.equal(c.parse("1h30m", now), now + 1.5 * hr);
  assert.equal(c.parse("17:30", now), new Date(2026, 10, 4, 17, 30).getTime());
  assert.equal(c.parse("9:00", now), new Date(2026, 10, 5, 9, 0).getTime(), "past today: tomorrow");
  assert.equal(c.parse("5pm", now), new Date(2026, 10, 4, 17, 0).getTime());
  assert.equal(c.parse("tomorrow 10:00", now), new Date(2026, 10, 5, 10, 0).getTime());
  assert.equal(c.parse("fri", now), new Date(2026, 10, 6, 9, 0).getTime());
  assert.equal(c.parse("wed", now), new Date(2026, 10, 11, 9, 0).getTime(), "today's weekday: next week");
  assert.equal(c.parse("2026-11-20 8:30", now), new Date(2026, 10, 20, 8, 30).getTime());
  assert.equal(c.parse("banana", now), null);
  assert.equal(c.parse("2020-01-01", now), null);
});

// Local change: Settle ends a Claude agent once its session is kept; one with no session stays, settled by label.
test("Settle keeps the Claude session, then closes the agent's pane", async () => {
  const f = fixture(), a = f.add("A"); f.add("B");
  let store = {};
  f.env.hc = async (args) => args[0] === "get"
    ? { code: 0, stdout: JSON.stringify({ foreground: { pid: 7, cwd: "/w" }, status: { app: "claude-code" }, created_ms: 5 }) }
    : { code: 0 };
  f.env.home = () => "/h";
  f.env.readTextFile = async () => JSON.stringify({ sessionId: "sess-1", cwd: "/w" });
  f.env.shared = (k) => k === "t3.sessions" ? store : k === "agents.pins" ? f.pins : null;
  f.env.setShared = (k, v) => { if (k === "t3.sessions") store = JSON.parse(JSON.stringify(v)); };
  f.render(); a.focused = true; f.render(1100);
  f.settle();
  for (const job of f.jobs.splice(1)) await job(f.cx);
  assert.ok(store["sess-1"], "the session is kept");
  assert.ok(f.calls.some((c) => c[0] === "pane.close" && c[1].pane === "A"), "its pane closes");
  assert.ok(!f.calls.some((c) => c[0] === "pane.close" && c[1].pane === "B"));
});

test("Settle leaves a non-Claude agent running, settled by label", async () => {
  const f = fixture(), a = f.add("A");
  const labels = [];
  f.env.hc = async (args) => { if (args[0] === "label") labels.push(args); return { code: 0 }; };
  f.render(); a.focused = true; f.render(1100); f.settle();
  for (const job of f.jobs.splice(1)) await job(f.cx);
  for (const job of f.jobs.splice(1)) await job(f.cx);
  assert.ok(!f.calls.some((c) => c[0] === "pane.close"), "nothing closes");
  assert.match(labels.at(-1)[2], /^settled=\d+:0$/);
  assert.ok(f.notifications.some((n) => n.level === "warning"));
});

test("opening a settled agent brings it back: no preview", () => {
  const f = fixture(), a = f.add("A"); f.add("B");
  f.terms[0].labels.settled = "500:0"; f.render();
  assert.ok(!f.active().includes("A"));
  a.focused = true; f.render(1100);
  assert.equal(f.mod.pending.A, "", "unsettled on arrival");
  assert.ok(f.active().includes("A"));
});
