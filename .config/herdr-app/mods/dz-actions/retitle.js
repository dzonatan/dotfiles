// Regenerate title: retitle.sh asks Haiku for a short title from what the Claude agent's terminal shows
// and names the agent's tab with it (a named tab is what name.js shows for an agent). It never types
// into the session. Renaming the tab to "" goes back to the terminal's own title. The work is one shell process because the popup closing cancels this mod's
// async work after ~250 ms, while a process already started keeps running.
import { exec, appHome, notify } from "herdr";

// The agent reports app "claude-code"; the program table keys it "claude".
export const isClaude = (agent) => agent?.app === "claude-code" || ["claude", "claude-code"].includes(agent?.program?.key);

export function retitle(agent) {
  notify({ title: "Regenerating title…", level: "info", timeout: 4000 });
  // scripts/ is outside the herdr-t3 mod folders, so a herdr-t3 update doesn't delete it.
  return exec("sh", [`${appHome()}/scripts/retitle.sh`, agent.address, agent.tab]);
}
