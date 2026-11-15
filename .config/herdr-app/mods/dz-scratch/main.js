// ctrl-b t: a scratch shell over the tab, like herdr-tui's `prefix+t` popup.
// It is Herdr's own peek (`terminal.peek`), the one overlay that hands its terminal the keyboard; a
// custom openOverlay layout can't be focused (pane.focus says "no such pane"). The peek's ↗ keep
// turns the shell into a tab, after which it is no longer the scratch shell.
// - ctrl-b t while the scratch shell has the keyboard: ends it (the peek closes with it).
// - ctrl-b t otherwise: shows the scratch shell, reusing one left running (closed with Esc/✕ or a click
//   beside it), else starts one with `hc run` in the focused terminal's folder.
// - ⌘W while it has the keyboard ends it too (dz-tabs asks `isScratch` first).
// Opened by the key as an invisible dialog (mod.json) that closes itself once the peek is up.
import { View, div } from "gpui-kit";
import { focused, terminals, panes, shared, setShared, closeOverlay, props, run, hc, home, notify } from "herdr";

export const KEY = "dz-scratch";
const NAME = "scratch";

// The scratch terminal, while it is still running and hasn't been kept as a pane.
export function scratch() {
  const t = shared(KEY)?.terminal;
  if (!t || !terminals().some((x) => x.address === t && x.state !== "exited")) return null;
  return panes().some((p) => p.terminal === t) ? null : t;
}
// True when the scratch shell has the keyboard (it is on screen).
export const isScratch = () => Boolean(scratch()) && focused()?.terminal === scratch();

export default class Scratch extends View {
  init(_props, cx) {
    const own = props()?.overlay;
    if (!own) return; // `herdr-app check` renders it without opening anything
    cx.spawn(async (cx) => {
      const wait = (ms) => new Promise((res) => cx.timer.after(ms, () => res()));
      try {
        let t = scratch();
        if (t && focused()?.terminal === t) {
          setShared(KEY, null);
          closeOverlay(own);
          await hc(["kill", t]).catch(() => {});
          return;
        }
        if (!t) {
          const cwd = focused()?.cwd || home();
          const args = ["run", "--json", "--bg", "--no-parent", "--rm", "--cwd", cwd, "--label", "dz.scratch=1"];
          // A name makes the peek's bar say "scratch"; skip it if another terminal holds it.
          if (!terminals().some((x) => x.name === NAME)) args.splice(1, 0, "--name", NAME);
          const r = await hc(args);
          t = JSON.parse(r.stdout || "{}").address;
          if (!t) throw new Error((r.stderr || r.stdout || "no address").trim());
          setShared(KEY, { terminal: t });
          // The app learns about a new terminal a moment after the core starts it; peek fails before.
          for (let i = 0; i < 40 && !terminals().some((x) => x.address === t); i++) await wait(25);
          await wait(50);
        }
        // Close this dialog first: closing it hands the keyboard back to where it was, which would
        // take it from the peek if the peek opened first.
        closeOverlay(own);
        run("terminal.peek", { terminal: t });
      } catch (e) {
        closeOverlay(own);
        notify({ title: "Couldn't open a scratch shell", body: String(e?.message ?? e), level: "error" });
      }
    });
  }

  render() { return div().id("dz-scratch").size_full(); }
}
