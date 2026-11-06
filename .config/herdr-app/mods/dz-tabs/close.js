// Close a tab without a dialog when nothing runs in it (idle shells, mod panes); else open the layout's
// closeWith dialog (dz-projects: dz-close), which lists what runs and settles Claude sessions first.
// Checked here, not inside the dialog: a dialog dims the window even while it draws nothing.
import { hc, panes, agents, run } from "herdr";
import { closeAndGoBack } from "./back.js";

const SHELL = /(^|\/)-?(zsh|bash|fish|sh|dash|ksh|tcsh|nu|pwsh|xonsh)$/;

// True when a program other than an idle shell runs in front of the terminal (same test as dz-close).
async function running(address) {
  const r = await hc(["get", address, "--json"]).catch(() => null);
  if (!r || r.code !== 0) return false;
  const k = JSON.parse(r.stdout), f = k.foreground;
  if (k.state !== "live") return false;
  return !((!f || f.pid === k.pid) && SHELL.test(f?.argv?.[0] ?? k.argv?.[0] ?? ""));
}

export async function closeTab(tabId, dialog) {
  if (!tabId) return;
  const busy = agents().some((a) => a.tab === tabId)
    || (await Promise.all(panes().filter((p) => p.tab === tabId && p.terminal).map((p) => running(p.terminal)))).some(Boolean);
  if (busy) run("mod.open", { name: dialog });
  else closeAndGoBack(tabId);
}
