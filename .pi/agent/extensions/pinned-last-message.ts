import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

type TextBlock = { type: "text"; text: string };
type ImageBlock = { type: "image" };
type UserContent = string | Array<TextBlock | ImageBlock | Record<string, unknown>>;

const WIDGET_KEY = "pinned-last-message";
const MAX_CHARS = 500;

let pinnedText = "";
let hidden = false;
let expanded = false;

function contentToText(content: UserContent): string {
	if (typeof content === "string") return content;

	const parts: string[] = [];
	for (const block of content) {
		if (block && typeof block === "object" && "type" in block) {
			if (block.type === "text" && "text" in block && typeof block.text === "string") {
				parts.push(block.text);
			} else if (block.type === "image") {
				parts.push("[image]");
			}
		}
	}
	return parts.join("\n");
}

function clean(text: string): string {
	return text.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
}

function findLastUserMessage(ctx: ExtensionContext): string {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry?.type !== "message") continue;
		if (entry.message.role !== "user") continue;
		return clean(contentToText(entry.message.content as UserContent));
	}
	return "";
}

function renderWidget(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;

	// Clear any header/overlay remnants from earlier versions.
	ctx.ui.setHeader(undefined);

	if (hidden || !pinnedText) {
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	ctx.ui.setWidget(
		WIDGET_KEY,
		(_tui, theme) => ({
			render(width: number): string[] {
				const oneLine = pinnedText.replace(/\n+/g, " ⏎ ");
				const label = expanded ? "Last message expanded: " : "Last message: ";
				const muted = (text: string) => theme.fg("dim", text);

				if (!expanded) {
					const shortened = oneLine.length > MAX_CHARS ? `${oneLine.slice(0, MAX_CHARS - 1)}…` : oneLine;
					return [truncateToWidth(muted(label + shortened), width)];
				}

				return [
					truncateToWidth(muted(`${label}ctrl+shift+o to collapse`), width),
					...wrapTextWithAnsi(muted(oneLine), Math.max(1, width)),
				];
			},
			invalidate() {},
		}),
		{ placement: "aboveEditor" },
	);
}

function setPinned(ctx: ExtensionContext, text: string): void {
	pinnedText = clean(text);
	renderWidget(ctx);
}

function refreshFromCurrentBranch(ctx: ExtensionContext): void {
	setPinned(ctx, findLastUserMessage(ctx));
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		refreshFromCurrentBranch(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		// Recompute from active branch after /tree rewind/navigation.
		refreshFromCurrentBranch(ctx);
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "user") return;
		setPinned(ctx, contentToText(event.message.content as UserContent));
	});

	pi.on("before_agent_start", async (event, ctx) => {
		setPinned(ctx, event.prompt);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setWidget(WIDGET_KEY, undefined);
		}
	});

	pi.registerCommand("pin-last", {
		description: "Toggle the pinned last-user-message widget.",
		handler: async (_args, ctx) => {
			hidden = !hidden;
			if (!hidden && !pinnedText) refreshFromCurrentBranch(ctx);
			renderWidget(ctx);
		},
	});

	pi.registerShortcut("ctrl+shift+o", {
		description: "Expand or collapse the pinned last-user-message widget.",
		handler: async (ctx) => {
			if (hidden || !pinnedText) return;
			expanded = !expanded;
			renderWidget(ctx);
		},
	});
}
