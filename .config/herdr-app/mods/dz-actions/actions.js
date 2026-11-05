// The ⌘K actions (keys.json: mod.open:dz-actions). To add one, add an entry here; main.js only draws the list.
//
//   { id, title, icon, words?,
//     when(ctx)  → true to offer it, or a short reason it's off ("No agent in view.")
//     run(ctx)   → does it; the popup closes
//     menu(ctx)  → opens a second list instead: { title, placeholder, items: [{ id, title, hint?, run(ctx) }],
//                  typed?(text, ctx) → an extra first item for what was typed ({ title, hint, run }) or null } }
//
// ctx: { agent (the one in view, or null), title (its name), pinned, snoozed (until ms, or null), now }.
import { notify } from "herdr";
import { presets, parse, when, snooze, wake } from "./snooze.js";
import { isClaude, retitle } from "./retitle.js";

const fail = (e) => notify({ title: "Couldn't update the agent", body: String(e?.message ?? e), level: "error" });
const agentOnly = (ctx) => (!ctx.agent ? "No agent in view." : ctx.pinned ? "Pinned agents stay in sight." : true);

export const ACTIONS = [
  {
    id: "snooze", title: "Snooze agent…", icon: "mods/dz-inbox/alarm-clock.svg", words: "later remind hide timer",
    when: agentOnly,
    menu: (ctx) => ({
      title: "Snooze",
      placeholder: "Pick a time, or type one: 45m, 2h, 17:30, tomorrow 10:00, fri…",
      items: [
        ...presets(ctx.now).map((p) => ({ id: p.id, title: p.label, hint: p.hint, run: (c) => snooze(c.agent.address, p.until).catch(fail) })),
        { id: "custom", title: "Custom…", hint: "type a time", custom: true },
      ],
      typed: (text, c) => {
        const until = parse(text, c.now);
        return until && { id: "typed", title: "Snooze until", hint: when(until, c.now), run: (c) => snooze(c.agent.address, until).catch(fail) };
      },
    }),
  },
  {
    id: "wake", title: "Wake agent", icon: "mods/dz-inbox/undo.svg", words: "unsnooze back now",
    when: (ctx) => (!ctx.agent ? "No agent in view." : ctx.snoozed ? true : "Not snoozed."),
    run: (ctx) => wake(ctx.agent.address).catch(fail),
  },
  {
    id: "retitle", title: "Regenerate title", icon: "mods/workspace-chrome/square-pen.svg", words: "rename name title claude",
    when: (ctx) => (!ctx.agent ? "No agent in view." : isClaude(ctx.agent) ? true : "Only for Claude Code."),
    run: (ctx) => retitle(ctx.agent).catch((e) => notify({ title: "Couldn't regenerate the title", body: String(e?.message ?? e), level: "error" })),
  },
];
