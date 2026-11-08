import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, settings, home, readTextFile } from "herdr";

// ~/.claude/statusline.sh saves Claude Code's `rate_limits` here on every status line update.
const dataFile = () => `${home()}/.claude/cache/rate-limits.json`;

const WINDOWS = [
  { key: "five_hour", label: "5-hour", seconds: 5 * 3600 },
  { key: "seven_day", label: "Weekly", seconds: 7 * 24 * 3600 },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function countdown(seconds) {
  const total = Math.floor(seconds / 60);
  const days = Math.floor(total / 1440);
  const clock = `${Math.floor((total % 1440) / 60)}:${String(total % 60).padStart(2, "0")}`;
  return days ? `${days}d ${clock}` : clock;
}

// `left` is the percent still available. `pace` is the percent that would be left now
// had the window been used evenly from start to reset: the white line.
function reading(limit, seconds, now) {
  if (limit?.used_percentage == null || !limit.resets_at) return null;
  const remaining = limit.resets_at - now;
  if (remaining <= 0) return { left: 100, pace: null, resets: null }; // reset since the last update
  return {
    left: clamp(100 - limit.used_percentage, 0, 100),
    pace: clamp((remaining / seconds) * 100, 0, 100),
    resets: remaining,
  };
}

export default class Usage extends View {
  init(_props, cx) {
    this.raw = null;
    this.limits = null;
    this.minute = 0;
    this.refresh(cx);
    cx.timer.every(15000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      const raw = await readTextFile(dataFile()).catch(() => null);
      const minute = Math.floor(Date.now() / 60000);
      if (raw === this.raw && minute === this.minute) return;
      this.minute = minute;
      if (raw !== this.raw) {
        this.raw = raw;
        try { this.limits = raw ? JSON.parse(raw) : null; } catch { this.limits = null; }
      }
      cx.notify();
    });
  }

  meter(w, now, t) {
    const r = reading(this.limits?.[w.key], w.seconds, now);
    const left = r ? `${Math.round(r.left)}% left` : "No data";
    const resets = r?.resets != null ? `resets in ${countdown(r.resets)}` : "";
    const low = r?.left < 15; // the only time the bar asks for attention
    const line = settings().dark ? "#ffffff" : t.foreground;

    return v_flex().gap(5)
      .accessibility_label(r ? `${w.label}: ${left}${resets && `, ${resets}`}` : `${w.label}: no data`)
      .child(h_flex().justify_between().items_center().gap(8)
        .child(h_flex().gap(6).min_w(0)
          .child(div().text_color(t.muted).child(w.label))
          .child(div().text_color(t.foreground).child(left)))
        .child(div().flex_none().text_color(t.muted).child(resets)))
      .child(div().relative().h(4).rounded_full().bg(t.raised)
        .when(Boolean(r), (el) => el.child(div().absolute().left(0).top(0).bottom(0)
          .w(`${r.left}%`).rounded_full().bg(low ? t.blocked : t.muted)))
        .when(r?.pace != null, (el) => {
          const x = `${clamp(r.pace, 0.5, 99.5)}%`;
          return el
            .child(div().absolute().left(x).ml(-2).top(-3).bottom(-3).w(4).bg(t.chrome))
            .child(div().absolute().left(x).ml(-1).top(-3).bottom(-3).w(2).rounded(1).bg(line));
        }));
  }

  render() {
    const t = theme();
    const now = Date.now() / 1000;
    return v_flex().size_full().justify_center().gap(10).px(16).bg(t.chrome)
      .border_t(1).border_color(t.border).text_size(12)
      .children(WINDOWS.map((w) => this.meter(w, now, t)));
  }
}
