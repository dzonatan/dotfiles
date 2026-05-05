import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "elapsed-time";

let startedAt: number | undefined;

function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes <= 0) return `${seconds}s`;
	if (minutes < 60) return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function setElapsedStatus(ctx: ExtensionContext, text: string) {
	// Footer status: visible, subtle, and not persisted into the conversation/history.
	ctx.ui.setStatus(STATUS_KEY, text ? ctx.ui.theme.fg("dim", text) : "");
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		startedAt = undefined;
		setElapsedStatus(ctx, "");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		startedAt = Date.now();
		setElapsedStatus(ctx, "");
	});

	pi.on("agent_start", async (_event, ctx) => {
		// Fallback for any path that starts the agent without before_agent_start.
		startedAt ??= Date.now();
		setElapsedStatus(ctx, "");
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (startedAt === undefined) return;

		const elapsed = formatElapsed(Date.now() - startedAt);
		startedAt = undefined;
		setElapsedStatus(ctx, ` · took ${elapsed}`);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		startedAt = undefined;
		setElapsedStatus(ctx, "");
	});
}
