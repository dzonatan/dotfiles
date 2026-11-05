// Snooze: an agent put away until a time, then back on top of Active. One copy per mod (dz-inbox, dz-actions):
// a mod can't import outside its folder. Kept on the agent's own terminal as `snoozed=<until ms>`, as Settled
// keeps `settled=`: it ends with the terminal and every mod sees it. Only the time brings it back.
import { hc } from "herdr";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MORNING = 9;

const two = (n) => String(n).padStart(2, "0");
export const clock = (ms) => { const d = new Date(ms); return `${d.getHours()}:${two(d.getMinutes())}`; };

// "16:00" today, "Tomorrow 9:00", "Mon 9:00" within a week, else "Nov 12 9:00".
export function when(ms, now = Date.now()) {
  const d = new Date(ms), day = (x) => new Date(x).toDateString();
  if (day(ms) === day(now)) return clock(ms);
  if (day(ms) === day(now + 86400000)) return `Tomorrow ${clock(ms)}`;
  if (ms - now < 6 * 86400000) return `${DAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase())} ${clock(ms)}`;
  return `${d.toLocaleString("en", { month: "short" })} ${d.getDate()} ${clock(ms)}`;
}

const at = (base, h, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d.getTime(); };
const minute = (ms) => Math.ceil(ms / 60000) * 60000;

// The menu's choices: { id, label, until, hint }.
export function presets(now = Date.now()) {
  const tomorrow = at(now + 86400000, MORNING);
  const d = new Date(now), toMon = ((8 - d.getDay()) % 7) || 7;
  const week = at(now + toMon * 86400000, MORNING);
  return [
    { id: "1h", label: "In 1 hour", until: minute(now + 3600000) },
    { id: "3h", label: "In 3 hours", until: minute(now + 3 * 3600000) },
    { id: "tomorrow", label: "Tomorrow", until: tomorrow },
    { id: "week", label: "Next week", until: week },
  ].map((p) => ({ ...p, hint: p.id === "week" ? `Mon ${clock(p.until)}` : clock(p.until) }));
}

// Custom: "45m", "2h", "1h30m", "3d", "17:30", "5pm", "tomorrow", "tomorrow 14:00", "fri", "fri 10:00",
// "2026-11-20", "2026-11-20 8:30". null: not understood, or not in the future.
export function parse(text, now = Date.now()) {
  const s = text.trim().toLowerCase().replace(/^in\s+/, "");
  if (!s) return null;
  const span = s.replace(/\s+/g, "").match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m(?:in)?)?$/);
  if (span && span.slice(1).some(Boolean)) {
    const [w, d, h, m] = span.slice(1).map((x) => Number(x ?? 0));
    return minute(now + ((w * 7 + d) * 1440 + h * 60 + m) * 60000);
  }
  const time = (t) => {
    const x = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!x) return null;
    let h = Number(x[1]);
    const m = Number(x[2] ?? 0);
    if (x[3] === "pm" && h < 12) h += 12;
    if (x[3] === "am" && h === 12) h = 0;
    if (!x[2] && !x[3] && t.length > 2) return null;
    return h < 24 && m < 60 ? [h, m] : null;
  };
  const [head, ...rest] = s.split(/\s+/), tail = rest.join(" ");
  const hm = (t, def) => (t ? time(t) : def);
  let out = null;
  const date = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (date) {
    const t = hm(tail, [MORNING, 0]);
    if (t) out = new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), t[0], t[1]).getTime();
  } else if (head === "tomorrow" || head === "tmr") {
    const t = hm(tail, [MORNING, 0]);
    if (t) out = at(now + 86400000, t[0], t[1]);
  } else if (DAYS.some((d) => head.startsWith(d) && d.length <= head.length)) {
    const t = hm(tail, [MORNING, 0]), day = DAYS.findIndex((d) => head.startsWith(d));
    const ahead = ((day - new Date(now).getDay()) + 7) % 7 || 7;
    if (t) out = at(now + ahead * 86400000, t[0], t[1]);
  } else {
    const t = time(s);
    if (t) { out = at(now, t[0], t[1]); if (out <= now) out = at(now + 86400000, t[0], t[1]); }
  }
  return out && out > now ? out : null;
}

export const snoozedUntil = (k) => { const v = Number(k?.labels?.snoozed); return v > 0 ? v : null; };

// Snoozing takes it out of Settled too: it comes back at the time, as news.
export async function snooze(address, until) {
  const r = await hc(["label", address, `snoozed=${until}`, "settled="]).catch((e) => ({ code: 1, stderr: String(e) }));
  if (r.code !== 0) throw new Error(r.stderr?.trim() || "hc label failed");
}

export async function wake(address) {
  const r = await hc(["label", address, "snoozed="]).catch((e) => ({ code: 1, stderr: String(e) }));
  if (r.code !== 0) throw new Error(r.stderr?.trim() || "hc label failed");
}
