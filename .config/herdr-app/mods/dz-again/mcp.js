// MCP servers for a new Claude session, so a project only gets the servers it needs.
// - The servers: what `claude mcp list` finds in a folder (user, local, .mcp.json, plugins, claude.ai
//   connectors). Only whether a server is installed matters, not its status: MCP_TIMEOUT=1 cuts each
//   health check short, so a listing takes ~2s (CLI start and the connector fetch). Cached per folder in
//   shared "dz-launch.mcp" and refreshed in the background.
// - Defaults: per project path, the names of the servers left on; ANY ("*") is the default for No project
//   and for projects without their own. No default at all: every server on. A server installed after a
//   default was saved starts off in that project.
// - Hidden servers (noise for now, e.g. unused connectors): one list for every project, always off, and
//   shown in ⌘N only as a "N hidden" line, so they're never forgotten.
// - Turning servers off: `--settings {"deniedMcpServers": [{"serverName": …}]}` for that session only. A
//   denied server is never started or connected (unlike --disallowedTools, which only hides its tools).
// Copied into dz-launch and dz-again. Change one, copy it to the other.
import { shared, setShared, exec } from "herdr";

const KEY = "dz-launch.mcp";
export const ANY = "*";

const state = () => { const s = shared(KEY); return s && typeof s === "object" ? s : {}; };
const save = (patch) => setShared(KEY, { ...state(), ...patch });

// `claude mcp list`: "name: command or url - status" per line (the status is left out). Names never hold ": ".
export function parseList(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const i = line.indexOf(": ");
    if (i <= 0) continue;
    const name = line.slice(0, i).trim(), rest = line.slice(i + 2);
    const j = rest.lastIndexOf(" - ");
    out.push({ name, detail: j >= 0 ? rest.slice(0, j) : rest });
  }
  return out;
}

// { servers: [{ name, detail }], at } for a folder, or null before its first listing.
export const cached = (dir) => state().lists?.[dir] ?? null;
export const fresh = (dir, ms) => Date.now() - (cached(dir)?.at ?? 0) < ms;

// Lists a folder's servers again (one listing per folder at a time) and caches them.
const inflight = new Map();
export function refresh(dir) {
  if (inflight.has(dir)) return inflight.get(dir);
  const job = (async () => {
    const r = await exec("env", ["MCP_TIMEOUT=1", "claude", "mcp", "list"], { cwd: dir });
    if (r.code !== 0) throw new Error(r.stderr.trim() || "claude mcp list failed.");
    const servers = parseList(r.stdout);
    save({ lists: { ...(state().lists ?? {}), [dir]: { servers, at: Date.now() } } });
    return servers;
  })().finally(() => inflight.delete(dir));
  inflight.set(dir, job);
  return job;
}

// The servers left on in a project: its own default, else ANY's, else null (all on).
export const ownDefault = (key) => state().defaults?.[key] ?? null;
export const defaultOn = (key) => ownDefault(key) ?? ownDefault(ANY);
export const onByDefault = (key, servers) => new Set(defaultOn(key) ?? servers.map((s) => s.name));
export function saveDefault(key, on) {
  save({ defaults: { ...(state().defaults ?? {}), [key]: [...on].sort() } });
}

export const hiddenSet = () => new Set(Array.isArray(state().hidden) ? state().hidden : []);
export function setHidden(name, hide) {
  const h = hiddenSet();
  if (hide) h.add(name); else h.delete(name);
  save({ hidden: [...h].sort() });
}

// The argv that turns off every listed server not in `on`, and every hidden one, for one session.
export function denyArgs(servers, on) {
  const hidden = hiddenSet();
  const off = servers.map((s) => s.name).filter((n) => !on.has(n) || hidden.has(n));
  return off.length ? ["--settings", JSON.stringify({ deniedMcpServers: off.map((serverName) => ({ serverName })) })] : [];
}

// How a server reads in a list: "claude.ai Gmail" -> Gmail · claude.ai connector, "plugin:p:s" -> s · plugin p.
export function label(s) {
  if (s.name.startsWith("claude.ai ")) return { name: s.name.slice(10), sub: "claude.ai connector" };
  const m = /^plugin:([^:]+):(.+)$/.exec(s.name);
  if (m) return { name: m[2], sub: `plugin ${m[1]}` };
  return { name: s.name, sub: s.detail };
}
