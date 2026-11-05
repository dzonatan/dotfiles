// The inbox: no spaces, only the agents still asking for attention, as cards, latest news first.
// Below, as in T3: Working (busy agents, folded) and Settled (put away by hand until new work brings them back).
// Settled lives on the agent's own terminal as `settled=<ms>:<turn>`: it ends with the terminal, every mod
// sees it, and a turn ended since says there was new work even while no window watched. Looking doesn't count.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, Popover, InputState, Input } from "gpui-base";
import { agents, terminals, panes, spaces, focused, run, hc, notify, theme, shared, setShared, setAgentOrder, props, nextCommand, settings, layout } from "herdr";
import { namer } from "./name.js";
import { spaceMark, projectAt } from "./mark.js";
import { kidStatus, descendants, ownStatus, treeStatus } from "./tree.js";
// Local addition: settled Claude sessions kept past their terminal, resumed with `claude --resume` (session.js).
import { keep, forget, sessions, liveIn, resume, prune } from "./session.js";
// Local addition: Snooze, put away until a time (snooze.js); the Snoozed shelf sits above Settled.
import { presets, parse, when, snoozedUntil, snooze, wake } from "./snooze.js";

const BUSY = new Set(["working", "blocked"]);
// The settled tail opens on this many, then grows by MORE.
const FIRST = 10, MORE = 25;
// A run that stops stays on the Working shelf this long (ms), as in T3: a quick continuation doesn't move it twice.
const GRACE = 2000;
// The last word when times tie, so the order doesn't follow the order the data came in.
const byAddress = (x, y) => x.address.localeCompare(y.address);

// As T3's sidebar times: no "ago", nothing past days.
function ago(ms, now) {
  const m = Math.floor((now - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

// How long it's been working, as T3's Working pill: 9s, 4m, 1h 5m.
function took(ms, now) {
  const s = Math.max(0, Math.floor((now - ms) / 1000)), m = Math.floor(s / 60);
  return s < 60 ? `${s}s` : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// The program's icon from the app's table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Inbox extends View {
  init(_props, cx) {
    // Each agent's last state, when we saw it set going or come back (ms; 0: before we were watching), the turns
    // it had ended then, and for one that just stopped, when its run started.
    this.changed = JSON.parse(localStorage.getItem("changes") ?? "{}");
    this.open = localStorage.getItem("open") === "true";
    this.workOpen = localStorage.getItem("working-open") === "true";
    this.limit = FIRST;
    // Settled labels written but not back from the core yet: address → value ("" = removed).
    this.pending = {};
    // Snooze labels on their way, as `pending`: address → until (0 = woken).
    this.snoozing = {};
    this.snoozedOpen = localStorage.getItem("snoozed-open") !== "false";
    // The card whose snooze menu is open, and its Custom… field.
    this.snoozeMenu = null;
    this.snoozeCustom = false;
    this.snoozeInput = InputState.new({ placeholder: "45m, 2h, 17:30, tomorrow 10:00, fri…" });
    this.snoozeInput.on("change", (_e, cx) => cx.notify());
    this.snoozeInput.on("submit", (_e, cx) => this.snoozeSubmit?.(cx));
    this.hovered = null;
    // The spaces shown, as T3 scopes threads to projects; none: all of them.
    this.scope = JSON.parse(localStorage.getItem("scope") ?? "[]");
    this.scopeOpen = false;
    this.search = InputState.new({ placeholder: "Search spaces…" });
    this.search.on("change", (_e, cx) => cx.notify());
    this.search.on("submit", (_e, cx) => this.pick(this.matches()[0], false, cx));
    // Takes the keyboard while a row is lifted, so Esc can put it back.
    this.keys = cx.focus_handle();
    // "Working 9s" counts up only while such a card shows.
    cx.timer.every(1000, (cx) => { if (this.ticking) cx.notify(); });
    // Scratch leftovers (session.js prune): untouched scratch sessions out of Settled, their empty folders gone.
    const tidy = (cx) => cx.spawn(async () => {
      const ts = terminals(), term = new Map(ts.map((k) => [k.address, k]));
      const cwds = [...panes().map((p) => p.cwd), ...ts.filter((k) => k.state === "live").flatMap((k) => [k.cwd, k.foreground?.cwd])].filter(Boolean);
      await prune({ term, cwds }).catch(() => null);
    });
    tidy(cx);
    cx.timer.every(10 * 60 * 1000, tidy);
    // The cards' times (5m, 2h) move on by the minute, as T3's do.
    cx.timer.every(60000, (cx) => cx.notify());
    // `dz-inbox.settle` (cmd-shift-s in keys.json): see settleKey in render.
    cx.spawn(async (cx) => {
      for (;;) {
        if (await nextCommand() === "settle") this.settleKey?.(cx);
        cx.notify();
      }
    });
  }

  matches() {
    const q = this.search.value().toLowerCase();
    return [{ id: null, name: "All spaces" }, ...spaces()].filter((s) => s.name.toLowerCase().includes(q));
  }

  // A click shows that space alone; shift-click adds or removes it and keeps the menu open, as in T3.
  pick(s, shift, cx) {
    if (!s) return;
    this.scope = !s.id ? [] : !shift ? [s.id] : this.scope.includes(s.id) ? this.scope.filter((id) => id !== s.id) : [...this.scope, s.id];
    localStorage.setItem("scope", JSON.stringify(this.scope));
    // A new scope starts the settled tail over, as T3's does.
    this.limit = FIRST;
    if (!shift) this.scopeOpen = false;
    cx.notify();
  }

  // Takes each agent's state as working, blocked or idle (done counts as idle: looking at it isn't news).
  // A run's place in Working is when it started, as T3's is the person's message: a pause for them, or a stop
  // that goes on within the grace, is the same run. Pinned and settled ones skip the grace, as in T3: their
  // place doesn't hang on it. A turn ended while we weren't watching is news too.
  track(list, all, now, cx) {
    let dirty = false;
    for (const { address, s, turn, excluded } of list) {
      let was = this.changed[address];
      // The grace ran out: back with the person as of then, so it lands on top, and the run is over.
      if (was?.s === "idle" && was.start != null && (excluded || now - was.at >= GRACE)) {
        was = this.changed[address] = { s: "idle", at: excluded ? now : was.at + GRACE, turn: was.turn };
        dirty = true;
      }
      if (was?.s === s && (s !== "idle" || turn <= (was.turn ?? turn))) continue;
      const grace = was?.s === "working" && s === "idle" && !excluded;
      if (grace) cx.timer.after(GRACE, (cx) => cx.notify());
      this.changed[address] = !was ? { s, at: 0, turn } // First sight says nothing about when it changed.
        : s === "working" ? { s, at: was.start ?? now, turn }
        // A pause for the person, stuck or replying while its sub-agents work: the run keeps its start.
        : s === "blocked" || s === "done" ? { s, at: now, turn, start: was.s === "working" ? was.at : was.start }
        : grace ? { s, at: now, turn, start: was.at } // Stopped: the grace begins.
        : was.start != null && was.s === "idle" ? { ...was, turn } // The turn's end arriving within it.
        : { s, at: now, turn };
      dirty = true;
    }
    if (!dirty) return;
    // Only ended agents lose their record: one missing from the list for a moment comes back to its place.
    const listed = new Set(list.map((a) => a.address));
    const ended = new Set(all.filter((k) => k.state !== "live").map((k) => k.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && (ended.has(k) || now - c.at > 30 * 86400000)) delete this.changed[k];
    localStorage.setItem("changes", JSON.stringify(this.changed));
  }

  // Shown at once; the label comes back from the core a moment later.
  setSettled(addr, value, cx) {
    this.pending[addr] = value;
    cx.spawn(async (cx) => {
      // Brought back: its kept session goes too (it's live again).
      if (value === "") forget((s) => s.address === addr);
      const r = await hc(["label", addr, `settled=${value}`]).catch((e) => ({ code: 1, stderr: String(e) }));
      if (r.code === 0) return;
      delete this.pending[addr];
      notify({ title: "Couldn't update the agent", body: r.stderr.trim(), level: "error" });
      cx.notify();
    });
  }

  // Local change: settling ends the agent. Its terminal goes (its pane closes, so Herdr closes an emptied tab);
  // a space left empty gets a fresh shell tab first, as Clear does, and the view stays where it was.
  // `empty`: addresses of untouched scratch sessions (session.js keep): a space left with only those closes
  // instead of getting a fresh shell, since its folder is gone.
  end(addrs, empty = new Set()) {
    if (!addrs.length) return;
    const sp = spaces(), ps = panes();
    const spaceNow = sp.find((s) => s.active), tabNow = spaceNow?.tabs.find((c) => c.active)?.id;
    const doomed = agents().filter((a) => addrs.includes(a.address));
    const gone = new Set(doomed.map((a) => a.pane).filter(Boolean));
    let opened = false;
    for (const id of new Set(doomed.filter((a) => a.pane).map((a) => a.space))) {
      const s = sp.find((s) => s.id === id), tabs = s?.tabs.map((c) => c.id) ?? [];
      const mine = ps.filter((p) => tabs.includes(p.tab));
      if (mine.length && mine.every((p) => gone.has(p.pane))) {
        if (doomed.filter((a) => a.space === id).every((a) => empty.has(a.address))) {
          run("space.close", { id, confirmed: true });
          for (const a of doomed) if (a.space === id) gone.delete(a.pane), (a.closed = true);
          continue;
        }
        run("tab.new", { space: id, folder: mine.find((p) => p.cwd)?.cwd || s.folder });
        opened = true;
      }
    }
    for (const a of doomed.filter((a) => !a.closed)) run(a.pane ? "pane.close" : "terminal.kill", a.pane ? { pane: a.pane } : { terminal: a.address });
    // tab.new shows the new tab; go back to where the person was (unless that tab just closed).
    if (opened && tabNow && !doomed.some((a) => a.tab === tabNow)) { run("space.select", { id: spaceNow.id }); run("tab.select", { id: tabNow }); }
  }

  // Shown at once, as setSettled. `until` 0 wakes it.
  setSnoozed(addr, until, cx) {
    this.snoozing[addr] = until;
    if (until) this.pending[addr] = "";
    cx.spawn(async (cx) => {
      try { await (until ? snooze(addr, until) : wake(addr)); }
      catch (e) {
        delete this.snoozing[addr];
        notify({ title: "Couldn't update the agent", body: String(e?.message ?? e), level: "error" });
        cx.notify();
      }
    });
  }

  // Ends a drag or sweep, and hands the keyboard back to the pane that had it, unless the drop moved on to
  // another agent. Not FocusHandle.release(): that frees the handle, and the next drag would throw.
  // `this.back` is set only once something lifted.
  endDrag(restore = true) {
    const back = restore ? this.back : null;
    this.drag = this.sweep = this.back = null;
    if (back?.pane) run("pane.focus", { pane: back.pane });
    else if (back?.terminal) run("pane.focus", { terminal: back.terminal });
    return null;
  }

  render(cx) {
    const t = theme(), now = Date.now();
    const every = agents(), all = terminals(), ps = panes(), sp = spaces();
    // A space that's gone reads as all; its id stays stored, so the scope returns with it.
    const scope = this.scope.filter((id) => sp.some((s) => s.id === id));
    const list = scope.length ? every.filter((a) => scope.includes(a.space)) : every;
    const listed = new Map(every.map((a) => [a.address, a.status]));
    const term = new Map(all.map((k) => [k.address, k]));
    for (const [k, v] of Object.entries(this.pending)) if (!term.has(k) || (term.get(k).labels?.settled ?? "") === v) delete this.pending[k];
    const settledAt = (a) => {
      const v = this.pending[a.address] ?? term.get(a.address)?.labels?.settled;
      return v ? v.split(":").map(Number) : null;
    };
    for (const [k, v] of Object.entries(this.snoozing)) if (!term.has(k) || (snoozedUntil(term.get(k)) ?? 0) === v) delete this.snoozing[k];
    const snoozedAt = (a) => (this.snoozing[a.address] ?? snoozedUntil(term.get(a.address))) || null;
    const kids = new Map(every.map((a) => [a.address, descendants(all, a.address).map((k) => kidStatus(k, listed))]));
    // It, or anything under it, is working or needs the person.
    const busy = (a) => BUSY.has(a.status) || kids.get(a.address).some((s) => BUSY.has(s));
    // New work brings a settled agent back: busy now, or a turn ended since it was settled. Hidden ones too.
    for (const a of every) {
      const s = settledAt(a);
      if (s && (busy(a) || (term.get(a.address)?.turn ?? 0) > s[1])) this.setSettled(a.address, "", cx);
    }
    // Local change: no previewing a settled agent. Coming into view (a click, ⌘K, agent.next) brings it back.
    // Only on arrival: settling the agent in view, with no other card to move to, leaves it settled.
    const inView = every.find((a) => a.focused)?.address ?? null;
    if (inView !== this.inView) {
      this.inView = inView;
      const a = every.find((a) => a.address === inView);
      if (a && settledAt(a)) {
        this.setSettled(a.address, "", cx);
        this.changed[a.address] = { ...this.changed[a.address], at: now, start: null };
        localStorage.setItem("changes", JSON.stringify(this.changed));
      }
    }
    // Its time come, a snoozed agent is back on top of Active, as news. The next due time wakes the list.
    const title = namer();
    let due = Infinity;
    for (const a of every) {
      const u = snoozedAt(a);
      if (!u) continue;
      if (u > now) { due = Math.min(due, u); continue; }
      this.setSnoozed(a.address, 0, cx);
      notify({ title: "Back from snooze", body: title(a) });
    }
    // However it woke (its time, Wake now, ⌘K, another window), it's news again: the top of Active.
    const awake = every.filter((a) => this.napping?.has(a.address) && !snoozedAt(a));
    for (const a of awake) this.changed[a.address] = { ...this.changed[a.address], s: this.changed[a.address]?.s ?? "idle", at: now, start: null };
    if (awake.length) localStorage.setItem("changes", JSON.stringify(this.changed));
    this.napping = new Set(every.filter(snoozedAt).map((a) => a.address));
    if (due < Infinity && this.due !== due) {
      this.dueTimer?.cancel();
      this.due = due;
      // Timers this long are fine; past a day the minute tick gets there too.
      this.dueTimer = cx.timer.after(Math.min(due - now + 100, 86400000), (cx) => { this.due = null; cx.notify(); });
    }
    // It with what's under it (tree.js).
    const state = (a) => treeStatus(ownStatus(a.status, a.address, all), kids.get(a.address));
    const running = (a) => state(a) === "working";
    // Pins are the agents list's (dz-agents), one set for both: pinned agents stay up top in pin order, whatever their state.
    const pins = shared("agents.pins") ?? [];
    this.track(every.map((a) => ({
      address: a.address, s: state(a) === "blocked" ? "blocked" : running(a) ? "working"
        : state(a) === "done" && kids.get(a.address).includes("working") ? "done" : "idle",
      turn: term.get(a.address)?.turn ?? 0, excluded: pins.includes(a.address) || Boolean(settledAt(a)) || Boolean(snoozedAt(a)),
    })), all, now, cx);
    const mark = (a) => this.changed[a.address];
    // Seen changing, then; before that, the core's time of its last change. terminals() only has that as of
    // the app's start (status_ms isn't updated live), so it serves only until we see a change ourselves.
    const since = (a) => mark(a)?.at || term.get(a.address)?.status_ms || 0;
    // Just stopped: it shows its state now but keeps its Working place until the grace is out.
    const lingering = (a) => mark(a)?.s === "idle" && mark(a).start != null;
    // T3's Working shelf.
    const working = (a) => running(a) || lingering(a);
    // Active by when each came back to the person; Working by when its run started.
    const newest = (x, y) => since(y) - since(x) || byAddress(x, y);
    const begun = (a) => (lingering(a) ? mark(a).start || term.get(a.address)?.status_ms || 0 : since(a));
    // Working since: seen set going; before that, its own report, or for a parent waiting on sub-agents the
    // longest-working one's.
    const started = (a) => mark(a)?.at || (a.status === "working" ? term.get(a.address)?.status_ms
      : Math.min(Infinity, ...descendants(all, a.address).filter((k) => kidStatus(k, listed) === "working").map((k) => k.status_ms).filter(Boolean)));
    const pinned = pins.map((p) => list.find((a) => a.address === p)).filter(Boolean);
    const rest = list.filter((a) => !pins.includes(a.address) && !snoozedAt(a));
    const naps = list.filter((a) => !pins.includes(a.address) && snoozedAt(a)).sort((x, y) => snoozedAt(x) - snoozedAt(y) || byAddress(x, y));
    const napRows = this.snoozedOpen ? naps : naps.filter((a) => a.focused);
    const out = rest.filter((a) => !settledAt(a) && !working(a)).sort(newest);
    const work = rest.filter((a) => !settledAt(a) && working(a)).sort((x, y) => begun(y) - begun(x) || byAddress(x, y));
    const put = rest.filter(settledAt).sort((x, y) => settledAt(y)[0] - settledAt(x)[0] || byAddress(x, y));
    // Shelves fold by default on this screen; the one in view stays out even folded or past the page, so it's never lost.
    const busyRows = this.workOpen ? work : work.filter((a) => a.focused);
    // agent.next goes as the list reads. Only while this list shows: the agents list (dz-agents) sets its own.
    const find = (n) => n?.id === "sidebar-lists" ? n : (n?.children ?? []).map(find).find(Boolean);
    if (find(layout())?.active !== "lists") setAgentOrder([...pinned, ...out, ...work, ...naps, ...put].map((a) => a.address));
    // cmd-1…9 (dz-chrome.goN): the first nine cards top to bottom (pinned, active, shown working); settled rows aren't numbered.
    const jump = [...pinned, ...out, ...busyRows].map((a) => a.address).slice(0, 9);
    if (find(layout())?.active !== "lists" && JSON.stringify(shared("agents.jump") ?? []) !== JSON.stringify(jump)) setShared("agents.jump", jump);

    // Local addition: closing what's in view (a tab, a space, an agent's pane) moves on to the top Active agent
    // (pinned first, never Working, Snoozed or Settled); with none left, the work area shows dz-empty
    // (dz-projects' "main-stack"). Only while the inbox shows. Any later focus change puts the tab back.
    const stackOf = (n, id) => n?.id === id ? n : (n?.children ?? []).map((c) => stackOf(c, id)).find(Boolean);
    const mainStack = stackOf(layout(), "main-stack");
    const f = focused(), here = f ? `${f.tab}|${f.pane}|${inView}` : null;
    const showMain = () => cx.spawn(async () => run("layout.select", { stack: "main-stack", child: "main" }));
    if (mainStack && find(layout())?.active !== "lists") {
      const was = this.inViewPane;
      if (was && !ps.some((p) => p.pane === was)) {
        const next = [...pinned.filter((a) => !working(a)), ...out][0];
        if (next) {
          if (mainStack.active === "empty") showMain();
          cx.spawn(async () => run("agent.focus", { terminal: next.address }));
        } else if (mainStack.active !== "empty") {
          this.emptyAt = null;
          cx.spawn(async () => run("layout.select", { stack: "main-stack", child: "empty" }));
        }
      } else if (mainStack.active === "empty") {
        // Noted once it shows; a different focus after that (a click, ⌘T, ⌘N) brings the tab back.
        if (this.emptyAt == null) this.emptyAt = here;
        else if (this.emptyAt !== here) { this.emptyAt = null; showMain(); }
      }
    }
    this.inViewPane = f?.pane ?? null;
    // Clicking a card brings the tab back even when that agent is the one already focused behind the empty state.
    this.showMain = mainStack?.active === "empty" ? () => { this.emptyAt = null; run("layout.select", { stack: "main-stack", child: "main" }); } : null;

    const hover = (a) => (on, cx) => {
      if (on) this.hovered = a.address;
      else if (this.hovered === a.address) this.hovered = null;
      cx.notify();
    };
    // A button's icon and text brighten together: a hover style reaches the text but not the svg, so it's state.
    const glow = (id) => (on, cx) => {
      if (on) this.hot = id;
      else if (this.hot === id) this.hot = null;
      cx.notify();
    };
    const lit = (id, color) => (this.hot === id ? t.foreground : color);
    // A space's avatar, as dz-spaces draws it: its project's letter and color (dz-projects), else its own.
    // `project`: the project an agent's own folder is in, which wins over its space's.
    // No project: an empty dashed box where the letter would be.
    const noProject = (size) => div().size(size).flex_none().rounded(4).border_1().border_dashed().border_color(t.dim);
    const avatar = (id, name, size, project) => {
      const { letter, fill } = spaceMark(id, t, { project, name, ps });
      return h_flex().size(size).flex_none().rounded(4).bg(fill)
        .items_center().justify_center().text_size(size * 0.64).font_bold().text_color("#ffffff")
        .child(letter);
    };
    // Brought back, it's news again: the top of the list.
    const unsettle = (a, cx) => {
      this.setSettled(a.address, "", cx);
      this.changed[a.address] = { ...this.changed[a.address], at: Date.now(), start: null };
      localStorage.setItem("changes", JSON.stringify(this.changed));
    };
    // Settling the agent in view moves on to the next card down the list, from the top past the end, as T3 does;
    // one in the background moves nothing.
    // Local change: settling ends the agent. Its Claude session is kept first (session.js) and shows in Settled as
    // a closed session; opening that resumes it as a new tab, back among the cards. One with no session to keep
    // (not Claude, or no session id found) can't come back, so it stays running, settled by label as before.
    const settle = (xs, cx) => {
      const at = Object.fromEntries(xs.map((a) => [a.address, `${Date.now()}:${term.get(a.address)?.turn ?? 0}`]));
      // Shown settled at once, while its session is kept.
      for (const a of xs) this.pending[a.address] = at[a.address];
      const named = new Set(sp.filter((s) => s.named).map((s) => s.id));
      cx.spawn(async (cx) => {
        const kept = await keep(xs.map((a) => ({ address: a.address, title: title(a), space: a.space, spaceName: named.has(a.space) ? a.space_name : null }))).catch(() => []);
        const ended = new Set(kept.map((k) => k.address));
        const missed = xs.filter((a) => !ended.has(a.address));
        for (const a of missed) this.setSettled(a.address, at[a.address], cx);
        if (missed.length) notify({ title: "Settled, still running", body: `${missed.map((a) => title(a)).join(", ")}: no Claude session to resume, so it wasn't ended.`, level: "warning" });
        this.end([...ended], new Set(kept.filter((k) => k.empty).map((k) => k.address)));
        cx.notify();
      });
      return moveOn(xs);
    };
    // Putting away the agent in view moves on to the next card down the list.
    const moveOn = (xs) => {
      const cards = [...pinned, ...out, ...busyRows], i = cards.findIndex((a) => a.focused);
      if (i < 0 || !xs.includes(cards[i])) return false;
      const next = [...cards.slice(i + 1), ...cards.slice(0, i)].find((a) => !xs.includes(a));
      if (next) run("agent.focus", { terminal: next.address });
      return Boolean(next);
    };
    const nap = (a, until, cx) => {
      this.snoozeMenu = null;
      this.snoozeCustom = false;
      this.hovered = null;
      this.setSnoozed(a.address, until, cx);
      moveOn([a]);
    };
    const unnap = (a, cx) => this.setSnoozed(a.address, 0, cx);
    // The settle key: the agent in view, as its card's Settle (finished, unpinned) or its settled row's undo.
    this.settleKey = (cx) => {
      const a = every.find((a) => a.focused);
      if (!a) return;
      if (settledAt(a)) unsettle(a, cx);
      else if (!busy(a) && !pins.includes(a.address)) settle([a], cx);
    };

    // Dragging, as T3's sidebar does it (Sidebar.drag.ts, Sidebar.pointer.ts). Press a row and move 6px to lift it;
    // it follows the pointer up and down inside the list and says what letting go will do. While it's lifted, the
    // Pinned and Active labels open, and the list opens a gap the size of the destination's row where it will
    // land. Pinned keeps a hand-made order; Active and Settled keep their own, so the gap opens where that puts it.
    let d = this.drag;
    // A row that leaves the list (its agent ended, a filter) can't be dropped. Render can't run commands, so
    // `this.back` stays and the release (or Esc, or leaving) hands the keyboard back.
    if (d && !list.some((a) => a.address === d.from)) d = this.drag = null;
    const dragging = Boolean(d?.moved);
    const lifted = dragging ? list.find((a) => a.address === d.from) : null;
    const sectionOf = (a) => pins.includes(a.address) ? "pinned" : settledAt(a) ? "settled" : working(a) ? "working" : "active";
    const from = lifted ? sectionOf(lifted) : null;
    const others = (xs) => xs.filter((x) => x.address !== d?.from);
    const pinTo = (before) => ({ section: "pinned", before: before ?? null });
    const pinOrder = (before) => {
      const kept = pins.filter((p) => p !== d.from), at = before ? kept.indexOf(before) : -1;
      kept.splice(at < 0 ? kept.length : at, 0, d.from);
      return kept;
    };
    // What letting go would do, and the gap that shows it: above a row (its address), after a section's last row
    // (`end-…`), right under an empty section's label (`head-…`), or none (a folded or busy destination).
    const plan = (() => {
      const to = lifted && d.target;
      if (!to || (to.section === from && from !== "pinned")) return null;
      if (to.section === "pinned") {
        const order = pinOrder(to.before);
        if (from === "pinned" && order.join("\n") === pins.join("\n")) return null;
        return { section: "pinned", order, gap: to.before ?? (others(pinned).length ? "end-pinned" : "head-pinned") };
      }
      // Busy work can't be settled (new work brings it straight back); out of Pinned it joins the Working shelf.
      if (busy(lifted)) return to.section === "settled" ? null : { section: "active", gap: null };
      if (to.section === "settled") return { section: "settled", gap: !this.open ? null : others(put)[0]?.address ?? "head-settled" };
      const rest = others(out), at = from === "settled" ? 0 : rest.filter((x) => newest(x, lifted) < 0).length;
      return { section: "active", gap: !rest.length ? "head-active" : rest[at]?.address ?? "end-active" };
    })();
    const target = dragging ? d.target?.section ?? null : null;
    // A section lights up as the target, as T3's labels and shelf header do.
    const hot = (s) => target === s && (Boolean(plan) || s === from);
    const verb = !plan ? null : plan.section === "pinned" ? (from === "pinned" ? null : "pin")
      : plan.section === "settled" ? "settle" : from === "pinned" ? "unpin" : from === "settled" ? "unsettle" : null;
    const BADGE = { pin: ["mods/workspace-chrome/pin.svg", "Pin"], unpin: ["mods/workspace-chrome/pin-off.svg", "Unpin"],
      settle: ["mods/workspace-chrome/circle-check.svg", "Settle"], unsettle: ["mods/dz-inbox/undo.svg", "Un-settle"] };
    const badge = (v) => h_flex().id(`badge-${v}`).h(20).px(6).gap(4).flex_none().items_center().rounded(4)
      .border(1).border_color(t.accent + "66").bg(t.accent + "1a").text_size(11).font_medium().text_color(t.accent)
      .child(svg(BADGE[v][0]).size(12).flex_none().text_color(t.accent)).child(BADGE[v][1]);

    // Settled shows one page; while a drag moves a row out of it the next row fills in, and one settled into
    // it pushes the page's last row out of sight.
    const fromPage = from === "settled" && put.indexOf(lifted) < this.limit;
    const size = this.limit + (fromPage && plan ? 1 : 0) - (plan?.section === "settled" && from !== "settled" ? 1 : 0);
    const page = this.open ? put.slice(0, size) : [];
    const rows = [...page, ...put.filter((a) => a.focused && !page.includes(a))];
    // Closed sessions: settled, their terminal gone. After the live ones, newest first, in the same page.
    const closed = Object.values(sessions()).filter((s) => !liveIn(s, term) && (!scope.length || scope.includes(s.space)))
      .sort((x, y) => y.at - x.at);
    const closedRows = this.open ? closed.slice(0, Math.max(0, size - page.length)) : [];
    const settledCount = put.length + closed.length;

    const aim = (to, cx) => {
      if (!this.drag?.moved || JSON.stringify(this.drag.target ?? null) === JSON.stringify(to)) return;
      this.drag.target = to;
      cx.notify();
    };
    // Over a pin, the upper half drops above it and the lower half below.
    const pinNear = (a, upper) => {
      const xs = pinned.map((x) => x.address), i = xs.indexOf(a.address);
      return pinTo(xs.slice(upper && a.address !== d?.from ? i : i + 1).find((x) => x !== d?.from));
    };
    // The gap: a card and the list's 2px in Pinned and Active, a 30px slim row in Settled (stacked without gaps).
    const MOTION = { duration: 150, easing: "ease-out" };
    const cardH = lifted && from !== "settled" ? d.height : this.cardH ?? 82;
    const gap = (key) => div().id(`gap-${key}`).flex_none().h(plan?.gap !== key ? 0 : plan.section === "settled" ? 30 : cardH + 2)
      .when(dragging, (el) => el.transition("height", MOTION));
    // Each droppable row sits in a lane: the gap that opens above it, the row (folding away once the lifted one is
    // headed elsewhere, holding its place until then) with the list's spacing, and after the last, the end gap.
    const lane = (section, xs, draw, spacing) => xs.map((a, i) => v_flex().id(`lane-${a.address}`).flex_none()
      .child(gap(a.address))
      .child(v_flex().id(`hold-${a.address}`).flex_none()
        .when(dragging && d.from === a.address, (el) => el.overflow_hidden().opacity(0).h(plan ? 0 : d.height + spacing).transition("height", MOTION))
        .child(draw(a)).when(spacing > 0, (el) => el.child(div().h(spacing).flex_none())))
      .when(i === xs.length - 1, (el) => el.child(gap(`end-${section}`))));
    // T3's boundaries: Pinned and Active labels, shown only while dragging; the list opens room for them.
    const boundary = (id, text, section, to) => h_flex().id(id).flex_none().overflow_hidden().h(dragging ? 24 : 0)
      .transition("height", MOTION).px(10).gap(8).items_center().text_size(12).font_medium()
      .on_mouse_move((_e, cx) => aim(to, cx))
      .when(dragging, (el) => el.child(div().text_color(hot(section) ? t.accent : t.muted).child(text))
        .child(div().flex_1().h(1).bg(hot(section) ? t.accent + "80" : t.border)));
    // An empty section still takes a drop: T3's dashed placeholder, accent while it's the target.
    const placeholder = (section, text) => div().id(`${section}-placeholder`).h(36).mb(2).flex_none().flex().items_center().justify_center()
      .rounded(6).border(1).border_dashed().text_size(12)
      .border_color(hot(section) ? t.accent + "66" : t.border).text_color(hot(section) ? t.accent : t.muted)
      .when(hot(section), (el) => el.bg(t.accent + "0d"))
      .on_mouse_move((_e, cx) => aim({ section }, cx))
      .child(text);
    // Picked up anywhere on a row that can move (not Working, not one whose Settle is still on its way).
    const row = (el, a) => el
      .on_mouse_down("left", (e) => {
        if (sectionOf(a) === "working" || this.pending[a.address] !== undefined) return;
        this.drag = { from: a.address, at: e.position, grab: e.local_position?.y ?? 0, height: e.bounds?.height ?? 0, moved: false, target: null };
      })
      .on_mouse_move((e, cx) => {
        if (this.sweep?.moved) return sweepTo(a, cx);
        const s = sectionOf(a);
        aim(s === "pinned" ? pinNear(a, (e.local_position?.y ?? 0) < (e.bounds?.height ?? 0) / 2) : s === "working" ? null : { section: s }, cx);
      });
    // A drag's or sweep's release doesn't also click the row or button it ends on.
    const justDropped = () => this.drag?.moved || this.sweep?.moved || Date.now() - (this.dropped ?? 0) < 250;
    const open = (a) => () => {
      if (justDropped()) return;
      this.showMain?.();
      run("agent.focus", { terminal: a.address });
    };
    // Says whether it moved on to another agent.
    const drop = (cx) => {
      if (!plan) return false;
      const a = lifted;
      if (plan.section === "pinned") setShared("agents.pins", plan.order);
      else if (pins.includes(a.address)) setShared("agents.pins", pins.filter((p) => p !== a.address));
      if (plan.section === "settled") return settle([a], cx);
      if (settledAt(a)) unsettle(a, cx);
      return false;
    };

    // Sweep, T3's other drag: press a card's Settle (or a settled row's undo) and move across rows to take the
    // whole run along; letting go settles (or brings back) every row it marked.
    const sweepFrom = (action, a) => (e, cx) => {
      cx.stop_propagation();
      this.sweep = { action, origin: a.address, at: e.position, moved: false, keys: [a.address] };
    };
    const sweepList = () => this.sweep.action === "settle" ? out.filter((x) => !busy(x)) : rows;
    const sweepTo = (a, cx) => {
      const xs = sweepList().map((x) => x.address), i = xs.indexOf(this.sweep.origin), j = xs.indexOf(a.address);
      if (i < 0 || j < 0) return;
      const keys = xs.slice(Math.min(i, j), Math.max(i, j) + 1);
      if (keys.join("\n") === this.sweep.keys.join("\n")) return;
      this.sweep.keys = keys;
      cx.notify();
    };
    const swept = (a) => Boolean(this.sweep?.moved && this.sweep.keys.includes(a.address));
    const finish = (cx) => {
      if (!this.drag && !this.sweep && !this.back) return;
      const moved = (dragging && drop(cx)) || (Boolean(this.sweep?.moved) && applySweep(cx));
      if (dragging || this.sweep?.moved) this.dropped = Date.now();
      this.endDrag(!moved);
    };
    const applySweep = (cx) => {
      const xs = sweepList().filter((x) => this.sweep.keys.includes(x.address));
      if (this.sweep.action === "settle") return settle(xs, cx);
      for (const a of xs) unsettle(a, cx);
      return false;
    };

    // The card's snooze: a bare timer icon opening the menu of times; Custom… takes one typed.
    const snoozeButton = (a) => {
      const id = `snooze-${a.address}`, open = this.snoozeMenu === a.address;
      const choice = (key, label, hint, fn, disabled) => h_flex().id(`${id}-${key}`).h(30).px(8).gap(12).flex_none().items_center().rounded(6)
        .when(disabled, (el) => el.opacity(0.45))
        .when(!disabled, (el) => el.hover((st) => st.bg(t.hover)).on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); }))
        .child(div().flex_1().text_color(t.foreground).child(label))
        .when(Boolean(hint), (el) => el.child(div().flex_none().text_color(t.dim).child(hint)));
      const typed = this.snoozeCustom ? parse(this.snoozeInput.value(), now) : null;
      this.snoozeSubmit = (cx) => { if (open && typed) { nap(a, typed, cx); cx.notify(); } };
      return Popover.new(`snooze-menu-${a.address}`).anchor("top_right").open(open)
        .on_open_change((o, cx) => {
          this.snoozeMenu = o ? a.address : null;
          this.snoozeCustom = false;
          cx.notify();
        })
        .trigger(h_flex().id(id).size(20).flex_none().items_center().justify_center().rounded(6)
          .on_hover(glow(id)).role("button").accessibility_label("Snooze")
          // The press opens the menu; its click mustn't also open the agent.
          .on_click((_e, cx) => cx.stop_propagation())
          .child(svg("mods/dz-inbox/alarm-clock.svg").size(13).flex_none().text_color(open ? t.foreground : lit(id, t.muted))))
        .content(v_flex().id(`${id}-panel`).w(210).mt(4).p(4).gap(1).rounded(10)
          .bg(t.popover).border_1().border_color(t.border).shadow_lg().text_size(13)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .children(!open ? [] : this.snoozeCustom ? [
            h_flex().h(30).px(8).flex_none().items_center().rounded(6).border_1().border_color(t.accent).bg(t.background)
              .child(Input.new(this.snoozeInput).flex_1().h_full().text_size(13).text_color(t.foreground)),
            choice("custom-go", typed ? "Snooze until" : "Type a time", typed ? when(typed, now) : "", (cx) => this.snoozeSubmit(cx), !typed),
          ] : [
            ...presets(now).map((p) => choice(p.id, p.label, p.hint, (cx) => nap(a, p.until, cx))),
            div().h(1).mx(4).my(3).bg(t.border),
            choice("custom", "Custom…", "", () => {
              this.snoozeCustom = true;
              this.snoozeInput.set_value("");
              this.snoozeInput.focus();
            }),
          ]));
    };

    // The bookmarked project holding the agent's folder (its pane's, else its space's), deepest first; null: none.
    const bookmarks = (Array.isArray(shared("projects")) ? shared("projects") : []).slice().sort((x, y) => y.path.length - x.path.length);
    const projectOf = (a) => {
      if (a.address.includes("/")) return null;
      const s = sp.find((x) => x.id === a.space), tabs = new Set((s?.tabs ?? []).map((c) => c.id));
      const dir = ps.find((p) => p.pane === a.pane)?.cwd || ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s?.folder;
      return dir ? bookmarks.find((q) => dir === q.path || dir.startsWith(q.path.replace(/\/+$/, "") + "/")) ?? null : null;
    };

    // `ghost`: the copy that follows the pointer, drawn without handlers or ids the list already uses.
    const card = (a, ghost) => {
      const st = state(a), on = a.focused;
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      const branch = ps.find((p) => p.pane === a.pane)?.branch;
      // Local addition: the project it works in (dz-projects' bookmarks), so a worktree's space reads as its project.
      const project = projectOf(a);
      // A local agent outside every bookmarked project (Scratch included) says so, rather than its space's name.
      const none = !project && !a.address.includes("/");
      const where = project?.name ?? (none ? "No project" : a.space_name);
      const going = kids.get(a.address).filter((s) => s === "working").length;
      const meta = [branch, going ? `${going} sub-agent${going > 1 ? "s" : ""} working` : null].filter(Boolean).join(" · ");
      const pic = icon(a.program, 16, t.muted);
      // Hovered, the corner offers Settle, but only for what's finished: a working or stuck tree stays in sight.
      const offer = (!dragging && !this.sweep?.moved && this.hovered === a.address && !busy(a) && !pins.includes(a.address)) || this.snoozeMenu === a.address;
      const id = `settle-${a.address}`;
      // As in T3, the corner says the state when there's one worth saying (Working, Needs you, Done: finished
      // and not yet seen), else how long ago it last changed. Sized as T3's: 16px mark, 4px gaps, and the
      // time in monospace children, one per part, so spacing and width don't hang on the interface font and
      // a monospace space (a full cell) doesn't open "1h 5m" wider than the 4px gaps.
      const pill = (color, mark, label, time) => h_flex().id(`state-${a.address}`).h(20).gap(4).flex_none().items_center().font_medium().text_color(color)
        .child(mark).child(div().child(label))
        .when(Boolean(time), (el) => el.children(time.split(" ").map((part) => div().font_family(settings().font_family ?? "JetBrains Mono").child(part))));
      // Lifted, or marked by a sweep, the corner says what letting go will do instead.
      const corner = ghost ? (verb ? badge(verb) : div())
        : swept(a) ? badge("settle")
        : offer
        ? h_flex().gap(2).flex_none().items_center().child(snoozeButton(a)).child(h_flex().id(id).h(20).px(6).gap(4).flex_none().items_center().rounded(6)
          .text_size(12).text_color(lit(id, t.muted)).on_hover(glow(id))
          .role("button").accessibility_label("Settle")
          .on_mouse_down("left", sweepFrom("settle", a))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            if (justDropped()) return;
            // A click is no sweep. Its release stops here, so the sidebar's mouse-up won't end the one the press began.
            this.sweep = null;
            // The card moves away without a pointer-leave event.
            this.hovered = null;
            settle([a], cx);
            cx.notify();
          })
          .child(svg("mods/workspace-chrome/check.svg").size(12).flex_none().text_color(lit(id, t.muted)))
          .child("Settle"))
        : running(a)
          ? pill(t.working, svg("mods/workspace-chrome/spinner.svg").size(16).flex_none().text_color(t.working).spin(900),
            "Working", started(a) > 0 && started(a) < Infinity ? took(started(a), now) : null)
          : st === "blocked"
            ? pill(t.blocked, div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(11).font_bold().flex().items_center().justify_center().child("!"), "Needs you")
            : st === "done"
              ? pill(t.ansi2, svg("mods/workspace-chrome/circle-check.svg").size(16).flex_none().text_color(t.ansi2), "Done")
              : div().id(`state-${a.address}`).flex_none().child(since(a) > 0 ? ago(since(a), now) : "");
      const base = v_flex().id(`${ghost ? "ghost-" : ""}card-${a.address}`).px(10).py(8).gap(2).flex_none().rounded(10);
      return (ghost ? base : row(base, a).role("button").accessibility_label(title(a)).on_hover(hover(a))
        .on_click(open(a)).on_size_change((size) => { this.cardH = size.height; }))
        .when(on, (el) => el.bg(t.selected))
        .when(!on && !ghost && !dragging && !this.sweep?.moved, (el) => el.hover((s) => s.bg(t.hover)))
        .child(h_flex().h(20).gap(6).items_center().text_size(12).text_color(t.dim)
          .child(none ? noProject(14) : avatar(a.space, where, 14, project && projectAt(project.path)))
          // Lifted, a pin keeps its glyph only while it stays among the pins.
          .when(pins.includes(a.address) && (!ghost || plan?.section === "pinned" || !plan), (el) => el.child(svg("mods/workspace-chrome/pin.svg").size(12).flex_none().text_color(t.dim)))
          .child(div().flex_1().min_w(0).truncate().child(machine ? `${where} · ${machine}` : where ?? ""))
          .child(corner))
        .child(h_flex().gap(8).items_center()
          // Only the one in view is bright, as in T3.
          .child(div().flex_1().min_w(0).truncate().text_size(14).text_color(on ? t.foreground : t.muted).child(title(a)))
          .when(Boolean(pic), (el) => el.child(pic)))
        .when(Boolean(meta), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(t.dim).child(meta)));
    };

    // A settled row: one dim line; opening it brings it back (local change: no preview). Hovered it brightens and its time
    // becomes a bare undo arrow, as in T3.
    const slim = (a, ghost) => {
      const on = a.focused, over = !dragging && !this.sweep?.moved && this.hovered === a.address, bright = on || over || ghost || swept(a);
      const pic = icon(a.program, 14, t.dim);
      const undo = h_flex().id(`unsettle-${a.address}`).size(20).flex_none().items_center().justify_center().rounded(4)
        .on_hover(glow(`unsettle-${a.address}`))
        .role("button").accessibility_label("Unsettle")
        .on_mouse_down("left", sweepFrom("unsettle", a))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          if (justDropped()) return;
          this.sweep = null;
          this.hovered = null;
          unsettle(a, cx);
          cx.notify();
        })
        .child(svg("mods/dz-inbox/undo.svg").size(14).flex_none().text_color(lit(`unsettle-${a.address}`, t.muted)));
      const base = h_flex().id(`${ghost ? "ghost-" : ""}slim-${a.address}`).h(30).px(10).gap(8).flex_none().items_center().rounded(8);
      return (ghost ? base : row(base, a).role("button").accessibility_label(title(a)).on_hover(hover(a)).on_click(open(a)))
        .when(on, (el) => el.bg(t.selected))
        .when(!on && !ghost && !dragging && !this.sweep?.moved, (el) => el.hover((s) => s.bg(t.hover)))
        .child(h_flex().size(16).flex_none().items_center().justify_center().opacity(bright ? 1 : 0.5).when(Boolean(pic), (el) => el.child(pic)))
        .child(div().flex_1().min_w(0).truncate().text_color(bright ? t.foreground : t.muted).child(title(a)))
        .child(ghost ? (verb ? badge(verb) : div()) : swept(a) ? badge("unsettle")
          : over ? undo : div().flex_none().text_size(12).text_color(t.dim).child(ago(settledAt(a)[0], now)));
    };

    // A closed session (session.js): one dim line as a settled row, its space after the title. Opening it resumes
    // Claude there; hovered, the time becomes resume and forget.
    const gone = (s) => {
      const key = `closed-${s.id}`, over = this.hovered === key;
      const act = (id, icon, label, fn) => h_flex().id(`${id}-${s.id}`).size(20).flex_none().items_center().justify_center().rounded(4)
        .on_hover(glow(`${id}-${s.id}`)).role("button").accessibility_label(label)
        .on_click((_e, cx) => { cx.stop_propagation(); this.hovered = null; fn(cx); cx.notify(); })
        .child(svg(icon).size(14).flex_none().text_color(lit(`${id}-${s.id}`, t.muted)));
      const go = (cx) => cx.spawn(async () => { await resume(s); });
      return h_flex().id(key).h(30).px(10).gap(8).flex_none().items_center().rounded(8)
        .role("button").accessibility_label(`Resume ${s.title}`)
        .on_hover((on, cx) => { if (on) this.hovered = key; else if (this.hovered === key) this.hovered = null; cx.notify(); })
        .hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => go(cx))
        .child(h_flex().size(16).flex_none().items_center().justify_center().opacity(over ? 1 : 0.5)
          .child(image("icons/claude.svg").w(14).h(14).flex_none()))
        .child(div().flex_1().min_w(0).truncate().text_color(over ? t.foreground : t.muted).child(s.title || "Claude session"))
        .when(Boolean(s.spaceName) && !over, (el) => el.child(div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(s.spaceName)))
        .child(over
          ? h_flex().gap(2).flex_none()
            .child(act("resume", "mods/dz-inbox/undo.svg", "Resume", go))
            .child(act("forget", "mods/workspace-chrome/x.svg", "Forget", () => forget((o) => o.id === s.id)))
          : div().flex_none().text_size(12).text_color(t.dim).child(ago(s.at, now)));
    };

    // A shelf's header, folding it: label, then count and chevron at the far edge.
    const shelf = (id, label, count, open, toggle, extra) => h_flex().id(id).h(30).px(10).gap(6).flex_none().items_center()
      .text_size(12).font_medium().text_color(t.dim)
      .role("button").accessibility_label(`${open ? "Hide" : "Show"} ${label.toLowerCase()} agents`)
      .on_click((_e, cx) => {
        toggle();
        cx.notify();
      })
      .child(div().flex_1().child(label))
      .when(Boolean(extra), (el) => el.child(extra))
      .child(div().child(String(count)))
      .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none());

    this.ticking = busyRows.length > 0 || pinned.some(working);
    // The first shelf takes the free space above it, so both sit at the bottom.
    const shelves = v_flex().id("shelves").pt(12).flex_none()
      .when(work.length > 0, (el) => el
        .child(shelf("working-header", "Working", work.length, this.workOpen, () => {
          this.workOpen = !this.workOpen;
          localStorage.setItem("working-open", String(this.workOpen));
        }).on_mouse_move((_e, cx) => aim(null, cx)))
        .child(v_flex().gap(2).children(busyRows.map((a) => card(a)))));
    // Clear closes settled agents' panes; Herdr then closes emptied tabs. The one in view stays.
    const spaceNow = sp.find((s) => s.active), tabNow = spaceNow?.tabs.find((c) => c.active)?.id;
    const doomed = put.filter((a) => a.pane && !a.focused && a.tab !== tabNow);
    // With nothing to clear the button goes, and a gone element hears no pointer-leave: drop its ask and hover.
    if (doomed.length === 0) {
      this.clearing = false;
      if (this.hot === "settled-clear") this.hot = null;
    }
    // The ask ends a moment after the pointer leaves the button, or after 3s if the pointer never came (keyboard).
    const unask = (ms, cx) => {
      this.unask?.cancel();
      this.unask = ms > 0 ? cx.timer.after(ms, (cx) => { this.clearing = false; cx.notify(); }) : null;
    };
    const clear = (cx) => {
      if (!this.clearing) {
        this.clearing = true;
        unask(this.hot === "settled-clear" ? 0 : 3000, cx);
        return;
      }
      this.clearing = false;
      unask(0, cx);
      const gone = new Set(doomed.map((a) => a.pane));
      for (const id of new Set(doomed.map((a) => a.space))) {
        const s = sp.find((s) => s.id === id), tabs = s?.tabs.map((c) => c.id) ?? [];
        const mine = ps.filter((p) => tabs.includes(p.tab));
        // The space stays: pane.close refuses its last pane, so a space left empty gets a fresh shell tab first,
        // where its terminals are now: an unnamed space is named after that, and s.folder is only where it began.
        if (mine.every((p) => gone.has(p.pane))) run("tab.new", { space: id, folder: mine.find((p) => p.cwd)?.cwd || s.folder });
        for (const a of doomed.filter((a) => a.space === id)) run("pane.close", { pane: a.pane });
      }
      // tab.new shows the new tab; go back to where the person was.
      if (tabNow) { run("space.select", { id: spaceNow.id }); run("tab.select", { id: tabNow }); }
    };
    const clearButton = doomed.length > 0 && h_flex().id("settled-clear").h(20).px(6).flex_none().items_center().rounded(4)
      .text_color(this.clearing ? t.blocked : lit("settled-clear", t.dim)).on_hover((on, cx) => {
        if (this.clearing) unask(on ? 0 : 400, cx);
        glow("settled-clear")(on, cx);
      })
      .role("button").accessibility_label(this.clearing ? `Close ${doomed.length} settled agents` : "Clear settled agents")
      .on_click((e, cx) => {
        cx.stop_propagation();
        // A double-click only asks: the second click of it never answers.
        if (this.clearing && e.click_count > 1) return;
        clear(cx);
        cx.notify();
      })
      .child(this.clearing ? `Clear ${doomed.length}?` : "Clear");
    // A snoozed row: one dim line, its wake time at the end; hovered, that becomes wake now.
    const napping = (a) => {
      const on = a.focused, key = `nap-${a.address}`, over = this.hovered === key, bright = on || over;
      const pic = icon(a.program, 14, t.dim), wid = `wake-${a.address}`;
      return h_flex().id(key).h(30).px(10).gap(8).flex_none().items_center().rounded(8)
        .role("button").accessibility_label(title(a))
        .on_hover((o, cx) => { if (o) this.hovered = key; else if (this.hovered === key) this.hovered = null; cx.notify(); })
        .on_click(open(a))
        .when(on, (el) => el.bg(t.selected))
        .when(!on, (el) => el.hover((st) => st.bg(t.hover)))
        .child(h_flex().size(16).flex_none().items_center().justify_center().opacity(bright ? 1 : 0.5).when(Boolean(pic), (el) => el.child(pic)))
        .child(div().flex_1().min_w(0).truncate().text_color(bright ? t.foreground : t.muted).child(title(a)))
        .child(over
          ? h_flex().id(wid).size(20).flex_none().items_center().justify_center().rounded(4)
            .on_hover(glow(wid)).role("button").accessibility_label("Wake now")
            .on_click((_e, cx) => { cx.stop_propagation(); this.hovered = null; unnap(a, cx); cx.notify(); })
            .child(svg("mods/dz-inbox/undo.svg").size(14).flex_none().text_color(lit(wid, t.muted)))
          : div().flex_none().text_size(12).text_color(t.dim).child(when(snoozedAt(a), now)));
    };
    const naps_ = naps.length > 0 && v_flex().id("snoozed").flex_none()
      .child(shelf("snoozed-header", "Snoozed", naps.length, this.snoozedOpen, () => {
        this.snoozedOpen = !this.snoozedOpen;
        localStorage.setItem("snoozed-open", String(this.snoozedOpen));
      }).on_mouse_move((_e, cx) => aim(null, cx)))
      .children(napRows.map(napping));
    const tail = v_flex().id("settled").flex_none()
      .child(shelf("settled-header", "Settled", settledCount, this.open, () => {
        this.open = !this.open;
        this.limit = FIRST;
        localStorage.setItem("open", String(this.open));
      }, clearButton).on_mouse_move((_e, cx) => aim({ section: "settled" }, cx))
        // As T3's shelf header: brighter while anything is lifted, accent as the target.
        .when(dragging, (el) => el.text_color(hot("settled") ? t.accent : t.foreground)))
      .when(dragging && others(rows).length === 0 && !(rows.length > 0 && !plan), (el) => el
        .child(plan?.gap === "head-settled" ? gap("head-settled") : placeholder("settled", "Settled")))
      .children(lane("settled", rows, (a) => slim(a), 0))
      .children(closedRows.map(gone))
      .when(this.open && settledCount > this.limit, (el) => el.child(h_flex().id("settled-more").h(30).px(10).gap(8).flex_none().items_center().rounded(8)
        .text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label("Show more settled agents")
        .on_click((_e, cx) => {
          this.limit += MORE;
          cx.notify();
        })
        .child(svg("mods/workspace-chrome/chevron-down.svg").size(12).flex_none())
        .child(`Show ${Math.min(MORE, settledCount - this.limit)} more`)));

    // T3's top row: search on the left, then the space filter, new space and new tab.
    const tool = (id, label, icon, fn) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6)
      .hover((s) => s.bg(t.hover)).on_hover(glow(id))
      .role("button").accessibility_label(label).on_click(fn)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(14).text_color(lit(id, t.dim)));
    // The filter shows what it filters to: one avatar, two overlapping, or the plain filter icon.
    const scoped = sp.filter((s) => scope.includes(s.id));
    const choice = (s) => {
      const on = s.id ? scope.includes(s.id) : scope.length === 0;
      // Selection is a check badge on the icon, as in T3.
      return h_flex().id(`scope-${s.id ?? "all"}`).h(32).px(8).gap(10).flex_none().items_center().rounded(6)
        .hover((st) => st.bg(t.hover))
        .role("button").accessibility_label(s.name)
        .on_click((e, cx) => this.pick(s, e.modifiers.shift, cx))
        .child(div().relative().flex_none()
          .child(s.id ? avatar(s.id, s.name, 16) : svg("mods/workspace-chrome/folder.svg").size(16).text_color(t.muted))
          .when(on, (el) => el.child(h_flex().absolute().right(-4).bottom(-4).size(12).rounded_full().bg(t.accent)
            .border(2).border_color(t.popover).items_center().justify_center()
            .child(svg("mods/workspace-chrome/check.svg").size(7).text_color("#ffffff")))))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(s.name));
    };
    const filter = Popover.new("inbox-scope-menu").anchor("top_right").open(this.scopeOpen)
      .on_open_change((open, cx) => {
        this.scopeOpen = open;
        if (open) {
          this.search.set_value("");
          this.search.focus();
        }
        cx.notify();
      })
      .trigger(h_flex().id("inbox-scope").size(26).flex_none().items_center().justify_center().rounded(6)
        .hover((s) => s.bg(t.hover)).on_hover(glow("inbox-scope"))
        .role("button").accessibility_label(scoped.length ? `Filter by space: ${scoped.map((s) => s.name).join(", ")}` : "Filter by space")
        .child(scoped.length > 1
          ? h_flex().children(scoped.slice(0, 2).map((s, i) => avatar(s.id, s.name, 14).when(i > 0, (el) => el.ml(-6))))
          : scoped.length
            ? avatar(scoped[0].id, scoped[0].name, 16)
            : svg("mods/dz-inbox/list-filter.svg").size(14).text_color(lit("inbox-scope", t.dim))))
      .content(v_flex().id("inbox-scope-panel").w(260).max_h(360).mt(4).p(6).gap(2).rounded(10)
        .bg(t.popover).border_1().border_color(t.border).text_size(13)
        .child(h_flex().h(32).px(8).gap(8).flex_none().items_center().border_b_1().border_color(t.border)
          .child(svg("mods/workspace-chrome/search.svg").size(14).flex_none().text_color(t.dim))
          .child(Input.new(this.search).flex_1().h_full().text_size(13).text_color(t.foreground)))
        .child(v_flex().id("inbox-scope-list").min_h(0).pt(4).gap(2).overflow_y_scroll()
          .children(this.matches().map(choice))
          .when(this.matches().length === 0, (el) => el.child(div().px(8).py(6).text_color(t.dim).child("No matching spaces.")))));
    // Right edge as the brand bar's above (pr 10), so the two rows of icons line up.
    const top = h_flex().id("inbox-top").h(32).pl(8).pr(10).gap(2).flex_none().items_center()
      .child(h_flex().id("inbox-search").flex_1().h(26).px(10).gap(8).items_center().rounded(6)
        .text_color(lit("inbox-search", t.dim)).hover((s) => s.bg(t.hover)).on_hover(glow("inbox-search"))
        .role("button").accessibility_label("Search").on_click(() => run("mod.open", { name: "picker" }))
        .child(svg("mods/workspace-chrome/search.svg").size(14).flex_none().text_color(lit("inbox-search", t.dim)))
        .child(div().child("Search")))
      .child(filter)
      // The layout passes its own menu; docked alone, the shipped one.
      .child(tool("inbox-new-tab", "New tab", "square-pen", () => run("mod.open", { name: props()?.newMenu ?? "new-menu" })));

    return v_flex().id("dz-inbox-root").relative().size_full().min_h(0).bg(t.chrome).text_size(13)
      .on_size_change((size) => { this.height = size.height; this.width = size.width; })
      // Esc puts a lifted row back (the sidebar holds the keyboard only while something is lifted).
      .track_focus(this.keys).on_key_down((e, cx) => {
        if (e.keystroke !== "escape" || !(this.drag || this.sweep || this.back)) return;
        this.endDrag();
        cx.notify();
      })
      .on_mouse_move((e, cx) => {
        const g = this.drag ?? this.sweep;
        if (!g || (!g.moved && Math.hypot(e.position.x - g.at.x, e.position.y - g.at.y) <= 6)) return;
        if (!g.moved) { this.back = focused(); this.keys.focus(); }
        g.moved = true;
        g.last = e.local_position ?? g.last;
        if (this.drag) this.drag.y = e.local_position?.y ?? this.drag.y;
        cx.notify();
      })
      // Released anywhere in the sidebar, it lands where the gap shows.
      .on_mouse_up("left", (_e, cx) => { finish(cx); cx.notify(); })
      // Herdr reports no release outside the sidebar, so leaving decides. Off the top or bottom edge (the Pinned
      // label or the Settled shelf sit there) it lands where the badge says, as T3 keeps the last target past the
      // list's ends; off a side it goes back.
      .on_hover((on, cx) => {
        if (on || !(this.drag || this.sweep || this.back)) return;
        const p = (this.drag ?? this.sweep)?.last, w = this.width ?? Infinity, h = this.height ?? Infinity;
        const side = !p || Math.min(p.x, w - p.x) < Math.min(p.y, h - p.y);
        if (side) this.endDrag(); else finish(cx);
        cx.notify();
      })
      .child(top)
      .child(v_flex().id("inbox-list").flex_1().min_h(0).px(8).py(8).overflow_y_scroll()
        .child(boundary("pinned", "Pinned", "pinned", pinTo(others(pinned)[0]?.address)))
        .child(gap("head-pinned"))
        .children(lane("pinned", pinned, (a) => card(a), 2))
        .child(boundary("active", "Active", "active", { section: "active" }))
        .when(dragging && others(out).length === 0 && !(out.length > 0 && !plan), (el) => el
          .child(plan?.gap === "head-active" ? gap("head-active") : placeholder("active", "Active")))
        .children(lane("active", out, (a) => card(a), 2))
        .when(out.length === 0 && !dragging, (el) => el.child(div().px(10).py(8).text_size(12).text_color(t.dim)
          .child(every.length ? "Nothing needs you." : "No agent status yet. Agents show up here when they report their status.")))
        // While dragging, Settled shows even empty: it's where a drop settles.
        // The free space above the shelves pushes them to the bottom; a drag over it lands in Active, as T3's
        // nearest-row drop does.
        .child(div().id("active-rest").flex_1().min_h(0).on_mouse_move((_e, cx) => aim({ section: "active" }, cx)))
        .child(shelves.when(Boolean(naps_), (el) => el.child(naps_))
          .when(settledCount > 0 || (dragging && !busy(lifted)), (el) => el.child(tail))))
      // The lifted row moves only up and down, inside the list and below the Pinned label (T3's clamps).
      .when(Boolean(lifted) && d.y != null, (el) => el.child(div().id("drag-ghost").absolute().left(8).right(8)
        .top(Math.max(32 + 8 + 24, Math.min(d.y - d.grab, (this.height ?? Infinity) - d.height - 8)))
        .rounded(10).bg(t.selected).border(1).border_color(t.accent).shadow_lg()
        .child(from === "settled" ? slim(lifted, true) : card(lifted, true))));
  }
}
