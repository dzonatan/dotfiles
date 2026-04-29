/**
 * Tab Status Extension
 *
 * Sets the terminal tab title with an emoji indicating agent status:
 *   🚧  agent is running
 *   ✅  agent is idle
 */

import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

function buildTitle(pi: ExtensionAPI, emoji: string): string {
	const cwd = path.basename(process.cwd());
	const session = pi.getSessionName();
	return session ? `${emoji} π - ${session} - ${cwd}` : `${emoji} π - ${cwd}`;
}

export default function (pi: ExtensionAPI) {
	const setStatus = (ctx: ExtensionContext, emoji: string) => {
		ctx.ui.setTitle(buildTitle(pi, emoji));
	};

	pi.on("session_start", async (_e, ctx) => setStatus(ctx, "✅"));
	pi.on("agent_start", async (_e, ctx) => setStatus(ctx, "🚧"));
	pi.on("agent_end", async (_e, ctx) => setStatus(ctx, "✅"));
	pi.on("session_shutdown", async (_e, ctx) => setStatus(ctx, "✅"));
}
