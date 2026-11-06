// Close a tab and land on the one before it in the same space (the next one when it was first).
// The last tab in a space keeps Herdr's own behaviour: closing it closes the space.
// Kept in sync with dz-tabs/back.js (a mod can't import another mod's files).
import { spaces, run } from "herdr";

export function closeAndGoBack(tabId) {
  const space = spaces().find((s) => s.tabs.some((c) => c.id === tabId));
  const tabs = space?.tabs ?? [];
  const i = tabs.findIndex((c) => c.id === tabId);
  if (space?.active && tabs[i]?.active && tabs.length > 1) run("tab.select", { id: tabs[i > 0 ? i - 1 : 1].id });
  run("tab.close", { id: tabId, confirmed: true });
}
