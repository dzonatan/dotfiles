// A space's avatar: its project's letter and color when it is in a bookmarked project
// (dz-projects, shared "projects": { letter?, color? }), else the space's own color
// (shared "space.colors") and the first letter of its name.
// The same file is copied into every dz-* mod that draws avatars: dz-projects, dz-spaces,
// dz-inbox, dz-picker, dz-new-menu, dz-launch. Change one, copy it to the others.
import { shared, spaces, panes } from "herdr";

// What a stored color name looks like on an avatar: one strong color per hue, light and dark alike.
export const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
export const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
export const fillOf = (c, t) => (c.startsWith("#") ? c : (MARK[c] ?? t[c] ?? MARK.ansi6));
export const firstLetter = (name) => [...(name ?? "")][0]?.toUpperCase() ?? "?";

const leastUsed = (used) => PALETTE.reduce((best, c) => (used.filter((v) => v === c).length < used.filter((v) => v === best).length ? c : best));

// Projects with their letter and color filled in. A project without a stored color gets the one
// fewest projects use, in list order: the same in every mod (dz-projects stores it once shown).
export function projectMarks() {
  const list = Array.isArray(shared("projects")) ? shared("projects") : [];
  const used = list.filter((p) => p.color).map((p) => p.color);
  return list.map((p) => {
    let color = p.color;
    if (!color) used.push((color = leastUsed(used)));
    return { ...p, color, letter: p.letter || firstLetter(p.name) };
  });
}

// The deepest bookmarked project holding `dir`, or null.
export function projectAt(dir) {
  if (!dir) return null;
  const inside = (p) => dir === p.path || dir.startsWith(p.path.replace(/\/+$/, "") + "/");
  return projectMarks().filter(inside).sort((x, y) => y.path.length - x.path.length)[0] ?? null;
}

// The project a space is in: where its first terminal is now, else where it was made.
export function projectOfSpace(s, ps = panes()) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return projectAt(ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd) ?? projectAt(s.folder);
}

// { letter, fill } for a space (`s`, or its id). `project`: one already found (an agent's own folder).
export function spaceMark(s, t, { project, name, ps } = {}) {
  if (typeof s === "string") s = spaces().find((x) => x.id === s) ?? { id: s };
  const p = project ?? (s.tabs || s.folder ? projectOfSpace(s, ps) : null);
  if (p) return { letter: p.letter, fill: fillOf(p.color, t) };
  const color = (shared("space.colors") ?? {})[s.id] ?? "ansi6";
  return { letter: firstLetter(name ?? s.name), fill: fillOf(color, t) };
}
