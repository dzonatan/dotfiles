// Projects: named bookmarks of git checkouts that dz-launch starts Claude sessions in.
// Stored in shared("projects") as [{ id, name, path, letter?, color? }]; path is the main checkout's top folder.
// letter/color: the avatar every dz-* mod draws for spaces and agents in the project (mark.js).
// Opened as a dialog (dz-launch's Manage, the sidebar footer); props().back reopens that mod on close.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { theme, shared, setShared, pickFolder, exec, home, props, closeOverlay, run } from "herdr";
import { PALETTE, MARK, fillOf, firstLetter, projectMarks } from "./mark.js";

const KEY = "projects";
export const projects = () => (Array.isArray(shared(KEY)) ? shared(KEY) : []);
const base = (p) => p.replace(/\/+$/, "").split("/").pop() || p;

// A folder is a project when it is the top of a git checkout and not a linked worktree
// (worktrees are picked in the launcher, under their project). Resolves with the path or throws.
async function checkout(folder) {
  const git = (args) => exec("git", ["-C", folder, ...args]);
  const top = await git(["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) throw new Error(`${folder} is not in a git repository.`);
  const root = top.stdout.trim();
  const common = (await git(["rev-parse", "--path-format=absolute", "--git-common-dir"])).stdout.trim();
  if (common && common !== `${root}/.git`) {
    const main = common.endsWith("/.git") ? common.slice(0, -5) : common;
    throw new Error(`${root} is a worktree of ${main}. Add ${base(main)} instead.`);
  }
  const real = (await exec("pwd", ["-P"], { cwd: folder })).stdout.trim() || folder;
  if (real !== root) throw new Error(`${folder} is inside the repository ${root}. Pick its top folder.`);
  return root;
}

export default class Projects extends View {
  init(_props, cx) {
    this.keys = cx.focus_handle();
    this.editing = null; // project id being renamed, or "new"
    this.draft = null; // { path } waiting for its name
    this.error = "";
    this.busy = false;
    this.name = InputState.new({ placeholder: "Project name" });
    this.name.on("submit", (_e, cx) => { this.save(); cx.notify(); });
    this.letter = InputState.new({ placeholder: "" });
    this.letter.on("submit", (_e, cx) => { this.save(); cx.notify(); });
    // The avatar preview follows what's typed.
    this.letter.on("change", (_e, cx) => cx.notify());
    this.name.on("change", (_e, cx) => cx.notify());
    this.color = null; // color picked in the edit row
    // Colors given by default are stored, so removing a project above doesn't move them.
    const list = projects();
    if (list.some((p) => !p.color)) {
      const marks = projectMarks();
      setShared(KEY, list.map((p, i) => (p.color ? p : { ...p, color: marks[i].color })));
    }
    this.keys.focus();
  }

  close() {
    const back = props()?.back;
    closeOverlay(props().overlay);
    if (back) run("mod.open", { name: back });
  }

  add(cx) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    cx.spawn(async (cx) => {
      try {
        const folder = await pickFolder({ prompt: "Add project" });
        if (folder) {
          const path = await checkout(folder);
          const same = projects().find((p) => p.path === path);
          if (same) throw new Error(`${path} is already the project “${same.name}”.`);
          this.draft = { path };
          this.editing = "new";
          this.name.set_value(base(path));
          this.letter.set_value("");
          const used = projects().map((p) => p.color).filter(Boolean);
          this.color = PALETTE.reduce((b, c) => (used.filter((v) => v === c).length < used.filter((v) => v === b).length ? c : b));
          this.name.focus();
        }
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      cx.notify();
    });
  }

  rename(p) {
    this.error = "";
    this.draft = null;
    this.editing = p.id;
    this.name.set_value(p.name);
    this.letter.set_value(p.letter ?? "");
    this.color = projectMarks().find((q) => q.id === p.id)?.color ?? PALETTE[0];
    this.name.focus();
  }

  save() {
    const name = this.name.value().trim();
    if (!name) return (this.error = "Give the project a name.");
    const letter = [...this.letter.value().trim()].slice(0, 2).join("").toUpperCase();
    const look = { color: this.color ?? PALETTE[0], ...(letter ? { letter } : {}) };
    const list = projects();
    if (list.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== this.editing))
      return (this.error = `There is already a project called “${name}”.`);
    if (this.editing === "new" && this.draft) {
      const id = `pr${Date.now().toString(36)}`;
      setShared(KEY, [...list, { id, name, path: this.draft.path, ...look }]);
    } else {
      setShared(KEY, list.map((p) => {
        if (p.id !== this.editing) return p;
        const { letter: _old, ...rest } = p;
        return { ...rest, name, ...look };
      }));
    }
    this.cancel();
  }

  cancel() {
    this.editing = null;
    this.draft = null;
    this.color = null;
    this.error = "";
    this.keys.focus();
  }

  remove(p) {
    setShared(KEY, projects().filter((q) => q.id !== p.id));
    if (this.editing === p.id) this.cancel();
  }

  render(cx) {
    const t = theme(), h = home();
    const short = (p) => (h && p.startsWith(h) ? "~" + p.slice(h.length) : p);
    const icon = (id, name, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6)
      .text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .role("button").accessibility_label(label).on_click(action)
      .child(svg(`mods/workspace-chrome/${name}.svg`).size(14));
    const button = (id, label, action, primary) => h_flex().id(id).h(30).px(12).items_center().rounded(7).flex_none()
      .role("button").accessibility_label(label)
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .hover((s) => s.opacity(0.85)).on_click(action).child(label);
    const nameInput = () => h_flex().flex_1().min_w(0).h(30).px(8).items_center().rounded(6)
      .border(1).border_color(t.accent).bg(t.background)
      .child(Input.new(this.name).flex_1().h_full().text_size(13).text_color(t.foreground));
    const avatar = (letter, color, size) => h_flex().size(size).flex_none().rounded(5).bg(fillOf(color, t))
      .items_center().justify_center().text_size(size * 0.6).font_bold().text_color("#ffffff").child(letter);
    // The letter the avatar shows while editing: the typed one, else the name's first.
    const typed = () => [...this.letter.value().trim()].slice(0, 2).join("").toUpperCase() || firstLetter(this.name.value().trim());
    const letterInput = () => h_flex().w(44).flex_none().h(30).px(8).items_center().rounded(6)
      .border(1).border_color(t.border).bg(t.background)
      .child(Input.new(this.letter).flex_1().h_full().text_size(13).text_color(t.foreground));
    const swatch = (c) => div().id(`color-${c}`).size(20).flex_none().rounded_full().bg(fillOf(c, t))
      .border(2).border_color(this.color === c ? t.foreground : t.selected)
      .role("button").accessibility_label(`Color ${c}`)
      .on_click((_e, cx) => { this.color = c; cx.notify(); });
    const editRow = (id, path) => h_flex().id(id).px(10).py(8).gap(10).items_start().rounded(8).bg(t.selected)
      .child(div().pt(4).child(avatar(typed(), this.color ?? PALETTE[0], 22)))
      .child(v_flex().flex_1().min_w(0).gap(6)
        .child(h_flex().gap(6).items_center().child(nameInput()).child(letterInput()))
        .child(h_flex().gap(6).items_center()
          .child(div().text_size(11.5).text_color(t.dim).child("Color"))
          .children(Object.keys(MARK).map(swatch))
          .child(div().flex_1())
          .child(div().text_size(11.5).text_color(t.dim).child("Letter: blank uses the name's")))
        .child(div().truncate().text_size(11.5).text_color(t.dim).child(short(path))))
      .child(button(`${id}-save`, "Save", (_e, cx) => { this.save(); cx.notify(); }, true))
      .child(button(`${id}-cancel`, "Cancel", (_e, cx) => { this.cancel(); cx.notify(); }));

    const list = projectMarks();
    const rows = list.map((p) => this.editing === p.id
      ? editRow(`project-${p.id}`, p.path)
      : h_flex().id(`project-${p.id}`).h(46).px(10).gap(10).items_center().rounded(8).flex_none()
        .hover((s) => s.bg(t.hover))
        .child(avatar(p.letter, p.color, 22))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_color(t.foreground).child(p.name))
          .child(div().truncate().text_size(11.5).text_color(t.dim).child(short(p.path))))
        .child(icon(`rename-${p.id}`, "square-pen", `Edit ${p.name}`, (_e, cx) => { this.rename(p); cx.notify(); }))
        .child(icon(`remove-${p.id}`, "x", `Remove ${p.name}`, (_e, cx) => { this.remove(p); cx.notify(); })));
    if (this.editing === "new" && this.draft) rows.push(editRow("project-new", this.draft.path));

    return v_flex().id("projects").size_full().min_h(0).bg(t.popover).text_size(13)
      .track_focus(this.keys)
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        cx.stop_propagation();
        if (this.editing) { this.cancel(); cx.notify(); } else this.close();
      })
      .child(v_flex().px(18).pt(16).pb(10).gap(2).flex_none()
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Projects"))
        .child(div().text_size(12).text_color(t.dim).child("Git checkouts you start Claude sessions in. ⌘N picks one.")))
      .child(v_flex().id("project-list").flex_1().min_h(0).px(8).gap(2).overflow_y_scroll()
        .children(rows)
        .when(!rows.length, (el) => el.child(div().p(10).text_color(t.dim).child("No projects yet. Add a git checkout to get started."))))
      .when(Boolean(this.error), (el) => el.child(div().px(18).py(6).text_size(12).text_color(t.blocked).child(this.error)))
      .child(h_flex().px(14).py(12).gap(8).items_center().flex_none().border_t(1).border_color(t.border)
        .child(button("project-add", this.busy ? "Choosing…" : "Add project…", (_e, cx) => this.add(cx), true))
        .child(div().flex_1())
        .child(button("projects-done", "Done", () => this.close())));
  }
}
