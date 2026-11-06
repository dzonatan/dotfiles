// Dirty repos (⌘M, ctrl-b m): the child repos of a mani workspace that have uncommitted changes, commits ahead
// of the default branch, or unpushed commits. Type to filter (repo or branch), ↑/↓ to move, ↵ to open it from the
// focused pane: cd there when it's an idle shell, else a new tab. ctrl-t new tab, ctrl-v split right, ctrl-h split
// down (the old popup's t/v/h, on ctrl so typing still filters). Esc closes.
//
// The workspace is the nearest folder holding a mani.yaml at or above the focused pane's folder. Outside one, it
// falls back to the "root" in LOCAL_CONFIG, a file that stays on this machine (the dotfiles sync never copies it),
// so no personal path lives in this mod: { "root": "~/path/to/workspace" }.
// Everything scanned (repo names, branches, counts) stays in memory while the popup is open; nothing is saved.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, hc, run, theme, props, closeOverlay, focused, panes, home, appHome, readTextFile } from "herdr";
import { bar, field, footer, rowFrame, empty, ROW_H } from "./panel.js";

const LOCAL_CONFIG = "local/dz-dirty.json"; // under appHome()
const LIST_MAX = 440;

const expand = (p) => (p.startsWith("~/") ? home() + p.slice(1) : p === "~" ? home() : p);
const parent = (dir) => dir.replace(/\/+$/, "").replace(/\/[^/]*$/, "") || "/";
const base = (dir) => dir.replace(/\/+$/, "").split("/").pop();
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

// Project paths from mani.yaml: a project's `path:`, else its name (as the awk in the old popup read it).
function projects(yaml) {
  const out = [];
  let inProjects = false, cur = null;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  for (const line of yaml.split("\n")) {
    if (/^[^ #]/.test(line)) { flush(); inProjects = /^projects:\s*$/.test(line); continue; }
    if (!inProjects) continue;
    let m;
    if ((m = line.match(/^  ([A-Za-z0-9_.-]+):\s*$/))) { flush(); cur = m[1]; continue; }
    if (cur && (m = line.match(/^    path:\s*(\S+)/))) cur = m[1].replace(/^["']|["']$/g, "");
  }
  flush();
  return out;
}

async function git(dir, args) {
  try {
    const r = await exec("git", ["-C", dir, "--no-optional-locks", ...args]);
    return r.code === 0 ? r.stdout.trim() : null;
  } catch { return null; }
}

async function baseRef(dir) {
  const head = await git(dir, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (head) return head;
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    if ((await git(dir, ["rev-parse", "--verify", "--quiet", ref])) != null) return ref;
  }
  return "HEAD";
}

// One repo's state, or null when it's clean (a fresh branch with nothing on it yet is clean, whatever its name).
async function scan(root, path) {
  const dir = `${root}/${path}`;
  const status = await git(dir, ["status", "--porcelain=v2", "--branch"]);
  if (status == null) return null;
  const lines = status.split("\n");
  const branch = lines.find((l) => l.startsWith("# branch.head "))?.slice(14) ?? "";
  const ab = lines.find((l) => l.startsWith("# branch.ab "))?.match(/\+(\d+)/);
  const uncommitted = lines.filter((l) => /^[12u?] /.test(l)).length;
  const ref = await baseRef(dir);
  const ahead = Number(await git(dir, ["rev-list", "--count", `${ref}..HEAD`])) || 0;
  // Without an upstream nothing of the branch is pushed: all its commits ahead of the default branch.
  const unpushed = ab ? Number(ab[1]) : ahead;
  if (!uncommitted && !ahead && !unpushed) return null;
  const from = (await git(dir, ["merge-base", ref, "HEAD"])) || "HEAD";
  const stat = (await git(dir, ["diff", "--shortstat", from])) ?? "";
  const added = Number(stat.match(/(\d+) insertion/)?.[1] ?? 0);
  const removed = Number(stat.match(/(\d+) deletion/)?.[1] ?? 0);
  return { path, dir, branch, ahead, uncommitted, unpushed, added, removed };
}

// The mani workspace holding `dir`, else the local fallback, else null.
async function findRoot(dir) {
  for (let d = dir; d && d !== "/"; d = parent(d)) {
    if ((await readTextFile(`${d}/mani.yaml`)) != null) return d;
  }
  try {
    const conf = JSON.parse((await readTextFile(`${appHome()}/${LOCAL_CONFIG}`)) ?? "{}");
    if (conf.root && (await readTextFile(`${expand(conf.root)}/mani.yaml`)) != null) return expand(conf.root);
  } catch {}
  return null;
}

export default class Dirty extends View {
  init(_props, cx) {
    this.rows = null; // null while scanning
    this.error = null;
    this.at = 0;
    this.scroll = 0;
    // The pane the popup was opened from: the one Enter, v and h act on.
    const f = focused();
    this.from = f?.pane ? panes().find((p) => p.pane === f.pane) ?? null : null;
    this.filter = "";
    this.input = InputState.new({ placeholder: "Filter dirty repos…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", () => this.open(this.picked));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => {
      const root = await findRoot(this.from?.cwd ?? f?.cwd ?? "");
      if (!root) {
        this.error = ["No mani.yaml here", `Open from inside a mani workspace, or set "root" in ${LOCAL_CONFIG}`];
        this.rows = [];
        return cx.notify();
      }
      const list = projects((await readTextFile(`${root}/mani.yaml`)) ?? "");
      this.rows = (await Promise.all(list.map((p) => scan(root, p)))).filter(Boolean);
      if (!this.rows.length) this.error = ["All repos clean", null];
      cx.notify();
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  // how: "enter" (cd in an idle shell, else a tab), "tab", "right" or "down" (a split beside the pane it opened from).
  open(r, how = "enter") {
    if (!r) return;
    this.close();
    if (how === "enter") {
      // A shell at its prompt gets a cd; anything else running keeps its pane and the repo opens in a new tab.
      const idle = this.from?.terminal && this.from.program?.shell && !this.from.status;
      if (idle) return hc(["send", this.from.terminal, `cd ${quote(r.dir)}`]);
    }
    if ((how === "right" || how === "down") && this.from?.terminal) {
      run("pane.focus", { pane: this.from.pane });
      return run("terminal.open", { folder: r.dir, place: how });
    }
    run("tab.new", { folder: r.dir, name: base(r.dir) });
  }

  render() {
    const t = theme();
    const words = this.filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (this.rows ?? []).filter((r) => words.every((w) => `${r.path} ${r.branch}`.toLowerCase().includes(w)));
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    const sel = (this.picked = rows[this.at]);

    const height = Math.min(LIST_MAX, rows.length * ROW_H);
    const maxScroll = Math.max(0, rows.length * ROW_H - height);
    if (this.at * ROW_H < this.scroll) this.scroll = this.at * ROW_H;
    if ((this.at + 1) * ROW_H > this.scroll + height) this.scroll = (this.at + 1) * ROW_H - height;
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const fixed = rows.length * ROW_H > height;

    const count = (n, mark, color, tip) => div().w(44).flex_none().text_size(12).text_color(n ? color : t.dim)
      .opacity(n ? 1 : 0).accessibility_label(tip).child(n ? `${mark}${n}` : "");

    const row = (r, i) => {
      const on = r === sel;
      return rowFrame(t, on).id(`dd-${r.path}`).mx(6).cursor_pointer()
        .when(fixed, (el) => el.absolute().left(0).right(0).top(i * ROW_H - this.scroll))
        .on_click(() => this.open(r))
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(t.foreground).child(r.path))
        .child(div().w(200).flex_none().truncate().text_size(12).text_color(t.muted).child(r.branch))
        .child(count(r.ahead, "↑", t.accent, "commits ahead of the default branch"))
        .child(count(r.uncommitted, "●", t.blocked, "uncommitted files"))
        .child(count(r.unpushed, "⇡", t.working, "unpushed commits"))
        .child(h_flex().w(96).flex_none().justify_end().gap(6).text_size(12)
          .child(div().text_color(t.ansi2).child(`+${r.added}`))
          .child(div().text_color(t.ansi1).child(`−${r.removed}`)));
    };

    const step = (d, cx) => {
      if (!rows.length) return;
      this.at = (this.at + d + rows.length) % rows.length;
      cx.stop_propagation();
      cx.notify();
    };

    const body = this.rows == null
      ? v_flex().h(96).flex_none().justify_center().child(empty(t, "Scanning repos…"))
      : !rows.length
        ? v_flex().h(96).flex_none().justify_center().child(this.error
          ? empty(t, this.error[0], this.error[1])
          : empty(t, `Nothing matches “${this.filter.trim()}”`))
        : v_flex().id("dd-list").flex_none().py(6)
          .child(v_flex().id("dd-strip").relative().h(height).w_full().flex_none()
            .when(fixed, (el) => el.overflow_hidden().on_scroll_wheel((e, cx) => {
              this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
              while (this.at < rows.length - 1 && this.at * ROW_H < this.scroll) this.at++;
              while (this.at > 0 && (this.at + 1) * ROW_H > this.scroll + height) this.at--;
              cx.notify();
            }))
            .children(rows.map(row)));

    return v_flex()
      .id("dirty")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        // ctrl-j/k and ctrl-n/p move like ↓/↑.
        const ctrl = e.modifiers.control, k = ctrl ? ({ j: "down", k: "up", n: "down", p: "up" }[e.key] ?? e.key) : e.key;
        if (k === "escape") return this.close();
        if (k === "down") return step(1, cx);
        if (k === "up") return step(-1, cx);
        const how = ctrl && { t: "tab", v: "right", h: "down" }[k];
        if (how) { cx.stop_propagation(); return this.open(sel, how); }
      })
      .child(bar(t, { body: field(Input, this.input).text_color(t.foreground),
        trail: this.rows?.length ? div().text_size(12).text_color(t.dim).child(`${rows.length}`) : null }))
      .child(body)
      .child(footer(t, [[["↑", "↓"], "move"], [["↵"], "open"], [["⌃T"], "tab"], [["⌃V"], "right"], [["⌃H"], "down"], [["esc"], "close"]]));
  }
}
