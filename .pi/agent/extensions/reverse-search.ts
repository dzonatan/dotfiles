/**
 * GNU Readline-style reverse search for pi prompts and !bash history.
 *
 * Hotkeys while searching:
 * - Ctrl+R / ↑ : older match
 * - Ctrl+S / ↓ : newer match
 * - Enter      : accept match
 * - Esc/Ctrl+G : cancel
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	Input,
	Key,
	matchesKey,
	truncateToWidth,
	type Component,
	type Focusable,
	type TUI,
} from "@mariozechner/pi-tui";

type Done = (value: string | null) => void;

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	return content
		.filter(
			(block): block is { type: string; text: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string"
		)
		.map((block) => block.text)
		.join("\n");
}

function collectHistory(ctx: ExtensionContext): string[] {
	const history: string[] = [];

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") continue;

		const message = entry.message as Record<string, unknown>;
		const role = message.role;

		if (role === "user") {
			const text = extractText(message.content).trim();
			if (text.length > 0) history.push(text);
			continue;
		}

		if (role === "bashExecution" && typeof message.command === "string") {
			const prefix = message.excludeFromContext ? "!!" : "!";
			history.push(`${prefix}${message.command}`);
		}
	}

	return history;
}

function toSingleLinePreview(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

class ReverseSearchComponent implements Component, Focusable {
	private _focused = false;
	private readonly input = new Input();

	private query = "";
	private matchIndices: number[] = [];
	private matchPointer = 0;

	constructor(
		private readonly tui: TUI,
		private readonly theme: any,
		private readonly history: string[],
		private readonly done: Done
	) {
		this.input.onEscape = () => this.done(null);
		this.input.onSubmit = () => {
			const match = this.getCurrentMatch();
			this.done(match ?? this.query);
		};

		this.recomputeMatches(true);
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	private recomputeMatches(resetPointer: boolean): void {
		const q = this.query.toLowerCase();
		const matches: number[] = [];

		for (let i = this.history.length - 1; i >= 0; i--) {
			const item = this.history[i]!;
			if (q.length === 0 || item.toLowerCase().includes(q)) {
				matches.push(i);
			}
		}

		this.matchIndices = matches;
		if (resetPointer) this.matchPointer = 0;
		if (this.matchPointer >= this.matchIndices.length) {
			this.matchPointer = Math.max(0, this.matchIndices.length - 1);
		}
	}

	private getCurrentMatch(): string | undefined {
		if (this.matchIndices.length === 0) return undefined;
		const index = this.matchIndices[this.matchPointer];
		return this.history[index];
	}

	private cycleOlderMatch(): void {
		if (this.matchIndices.length === 0) return;
		this.matchPointer = (this.matchPointer + 1) % this.matchIndices.length;
	}

	private cycleNewerMatch(): void {
		if (this.matchIndices.length === 0) return;
		this.matchPointer = (this.matchPointer - 1 + this.matchIndices.length) % this.matchIndices.length;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.ctrl("r")) || matchesKey(data, Key.up)) {
			this.cycleOlderMatch();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.ctrl("s")) || matchesKey(data, Key.down)) {
			this.cycleNewerMatch();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.ctrl("g"))) {
			this.done(null);
			return;
		}

		const before = this.input.getValue();
		this.input.handleInput(data);
		const after = this.input.getValue();

		if (after !== before) {
			this.query = after;
			this.recomputeMatches(true);
		}

		this.tui.requestRender();
	}

	render(width: number): string[] {
		const currentMatch = this.getCurrentMatch();
		const matchPreview = currentMatch
			? this.theme.fg("text", toSingleLinePreview(currentMatch))
			: this.theme.fg("warning", "failing search");

		const counter =
			this.matchIndices.length > 0
				? this.theme.fg("dim", ` [${this.matchPointer + 1}/${this.matchIndices.length}]`)
				: this.theme.fg("dim", " [0/0]");

		const header =
			this.theme.fg("accent", "(reverse-i-search)`") +
			this.theme.bold(this.query) +
			this.theme.fg("accent", "': ") +
			matchPreview +
			counter;

		const inputLine = this.input.render(width)[0] ?? "";
		const help = this.theme.fg("dim", "ctrl+r/↑ older • ctrl+s/↓ newer • enter accept • esc cancel");

		return [truncateToWidth(header, width), inputLine, truncateToWidth(help, width)];
	}

	invalidate(): void {
		this.input.invalidate();
	}
}

export default function readlineSearchExtension(pi: ExtensionAPI) {
	pi.registerShortcut(Key.ctrl("r"), {
		description: "GNU Readline reverse search through prompt history",
		handler: async (ctx) => {
			const history = collectHistory(ctx);

			if (history.length === 0) {
				ctx.ui.notify("No prompt history yet for reverse search.", "info");
				return;
			}

			const selected = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
				return new ReverseSearchComponent(tui, theme, history, done);
			});

			if (selected === null) return;
			ctx.ui.setEditorText(selected);
		},
	});
}
