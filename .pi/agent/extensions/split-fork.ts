import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { existsSync, promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

function shellQuote(value: string): string {
	if (value.length === 0) return "''";
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function getPiInvocationParts(): string[] {
	const currentScript = process.argv[1];
	if (currentScript && existsSync(currentScript)) {
		return [process.execPath, currentScript];
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return [process.execPath];
	}

	return ["pi"];
}

function buildPiCommand(sessionFile: string | undefined, prompt: string, cwd: string): string {
	const commandParts = [...getPiInvocationParts()];

	if (sessionFile) {
		commandParts.push("--session", sessionFile);
	}

	if (prompt.length > 0) {
		commandParts.push(prompt);
	}

	return `cd ${shellQuote(cwd)} && exec ${commandParts.map(shellQuote).join(" ")}`;
}

async function createForkedSession(ctx: ExtensionCommandContext): Promise<string | undefined> {
	const sessionFile = ctx.sessionManager.getSessionFile();
	if (!sessionFile) {
		return undefined;
	}

	const sessionDir = path.dirname(sessionFile);
	const branchEntries = ctx.sessionManager.getBranch();
	const currentHeader = ctx.sessionManager.getHeader();

	const timestamp = new Date().toISOString();
	const fileTimestamp = timestamp.replace(/[:.]/g, "-");
	const newSessionId = randomUUID();
	const newSessionFile = path.join(sessionDir, `${fileTimestamp}_${newSessionId}.jsonl`);

	const newHeader = {
		type: "session",
		version: currentHeader?.version ?? 3,
		id: newSessionId,
		timestamp,
		cwd: currentHeader?.cwd ?? ctx.cwd,
		parentSession: sessionFile,
	};

	const lines = [JSON.stringify(newHeader), ...branchEntries.map((entry) => JSON.stringify(entry))].join("\n") + "\n";

	await fs.mkdir(sessionDir, { recursive: true });
	await fs.writeFile(newSessionFile, lines, "utf8");

	return newSessionFile;
}

type CmuxFocusedTarget = {
	workspace?: string;
	surface?: string;
};

function parseCmuxIdentify(stdout: string): CmuxFocusedTarget {
	try {
		const identified = JSON.parse(stdout) as {
			focused?: {
				workspace_id?: string;
				workspace_ref?: string;
				surface_id?: string;
				surface_ref?: string;
			};
		};
		return {
			workspace: identified.focused?.workspace_id ?? identified.focused?.workspace_ref,
			surface: identified.focused?.surface_id ?? identified.focused?.surface_ref,
		};
	} catch {
		return {};
	}
}

function parseSurfaceRefs(stdout: string): string[] {
	return [...new Set(stdout.match(/surface:\d+/g) ?? [])];
}

async function getFocusedCmuxTarget(pi: ExtensionAPI): Promise<CmuxFocusedTarget> {
	const result = await pi.exec("cmux", ["identify", "--no-caller"]);
	if (result.code !== 0) return {};
	return parseCmuxIdentify(result.stdout ?? "");
}

async function listCmuxSurfaceRefs(pi: ExtensionAPI, workspace: string | undefined): Promise<string[]> {
	const args = ["tree"];
	if (workspace) args.push("--workspace", workspace);

	const result = await pi.exec("cmux", args);
	if (result.code !== 0) return [];
	return parseSurfaceRefs(result.stdout ?? "");
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

type CmuxSplitDirection = "right" | "down";

async function createCmuxSplit(
	pi: ExtensionAPI,
	direction: CmuxSplitDirection
): Promise<{ workspace?: string; surface?: string; error?: string }> {
	const initialTarget = await getFocusedCmuxTarget(pi);
	const workspace = process.env.CMUX_WORKSPACE_ID ?? initialTarget.workspace;
	const sourceSurface = process.env.CMUX_SURFACE_ID ?? initialTarget.surface;
	const beforeSurfaces = await listCmuxSurfaceRefs(pi, workspace);

	const splitArgs = ["new-split", direction];
	if (workspace) splitArgs.push("--workspace", workspace);
	if (sourceSurface) splitArgs.push("--surface", sourceSurface);

	const splitResult = await pi.exec("cmux", splitArgs);
	if (splitResult.code !== 0) {
		return { workspace, error: splitResult.stderr?.trim() || splitResult.stdout?.trim() || "unknown cmux error" };
	}

	await sleep(200);

	const afterSurfaces = await listCmuxSurfaceRefs(pi, workspace);
	const createdSurface = afterSurfaces.find((surface) => !beforeSurfaces.includes(surface));
	if (createdSurface) {
		return { workspace, surface: createdSurface };
	}

	const focusedTarget = await getFocusedCmuxTarget(pi);
	if (focusedTarget.surface && focusedTarget.surface !== sourceSurface) {
		return { workspace: workspace ?? focusedTarget.workspace, surface: focusedTarget.surface };
	}

	const outputSurface = parseSurfaceRefs(`${splitResult.stdout ?? ""}\n${splitResult.stderr ?? ""}`)[0];
	if (outputSurface) {
		return { workspace, surface: outputSurface };
	}

	return { workspace, error: "cmux created a split, but the new surface could not be identified" };
}

async function runCommandInCmuxSurface(
	pi: ExtensionAPI,
	workspace: string | undefined,
	surface: string,
	command: string
): Promise<{ ok: true; method: "respawn" | "send" } | { ok: false; error: string }> {
	const targetArgs: string[] = [];
	if (workspace) targetArgs.push("--workspace", workspace);
	targetArgs.push("--surface", surface);

	const respawn = await pi.exec("cmux", ["respawn-pane", ...targetArgs, "--command", command]);
	if (respawn.code === 0) {
		return { ok: true, method: "respawn" };
	}

	const sent = await pi.exec("cmux", ["send", ...targetArgs, `${command}\n`]);
	if (sent.code === 0) {
		return { ok: true, method: "send" };
	}

	return {
		ok: false,
		error:
			sent.stderr?.trim() ||
			sent.stdout?.trim() ||
			respawn.stderr?.trim() ||
			respawn.stdout?.trim() ||
			"unknown cmux error",
	};
}

async function forkIntoCmuxSplit(
	pi: ExtensionAPI,
	direction: CmuxSplitDirection,
	args: string,
	ctx: ExtensionCommandContext
): Promise<void> {
	const wasBusy = !ctx.isIdle();
	const prompt = args.trim();

	const ping = await pi.exec("cmux", ["ping"]);
	if (ping.code !== 0) {
		ctx.ui.notify(`cmux is not available: ${ping.stderr?.trim() || ping.stdout?.trim() || "cmux ping failed"}`, "error");
		return;
	}

	const forkedSessionFile = await createForkedSession(ctx);
	const startupCommand = buildPiCommand(forkedSessionFile, prompt, ctx.cwd);

	const split = await createCmuxSplit(pi, direction);
	if (!split.surface) {
		ctx.ui.notify(`Failed to create cmux ${direction} split: ${split.error ?? "unknown cmux error"}`, "error");
		if (forkedSessionFile) {
			ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
		}
		return;
	}

	const launched = await runCommandInCmuxSurface(pi, split.workspace, split.surface, startupCommand);
	if (!launched.ok) {
		ctx.ui.notify(`Created cmux ${direction} split, but failed to launch pi: ${launched.error}`, "error");
		if (forkedSessionFile) {
			ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
		}
		return;
	}

	if (forkedSessionFile) {
		const fileName = path.basename(forkedSessionFile);
		const suffix = prompt ? " and sent prompt" : "";
		ctx.ui.notify(`Forked to ${fileName} in a new cmux ${direction} split${suffix}.`, "info");
		if (wasBusy) {
			ctx.ui.notify("Forked from current committed state (in-flight turn continues in original session).", "info");
		}
	} else {
		ctx.ui.notify(`Opened a new cmux ${direction} split (no persisted session to fork).`, "warning");
	}
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("fork-right", {
		description: "Fork this session into a new pi process in a right-hand cmux split. Usage: /fork-right [optional prompt]",
		handler: async (args, ctx) => forkIntoCmuxSplit(pi, "right", args, ctx),
	});

	pi.registerCommand("fork-down", {
		description: "Fork this session into a new pi process in a bottom cmux split. Usage: /fork-down [optional prompt]",
		handler: async (args, ctx) => forkIntoCmuxSplit(pi, "down", args, ctx),
	});
}
