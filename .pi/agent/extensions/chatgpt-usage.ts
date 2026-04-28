import { AuthStorage, type ExtensionAPI, type ExtensionContext, type Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

type WindowUsage = {
  usedPercent: number | null;
  leftPercent: number | null;
  resetsIn?: string;
};

type CodexUsage = {
  primary: WindowUsage;
  secondary?: WindowUsage;
  planType?: string;
  updatedAt: Date;
};

const STATUS_KEY = "chatgpt-usage";
const REFRESH_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let lastUsage: CodexUsage | undefined;
let lastError: string | undefined;
let sessionGeneration = 0;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Most observed responses use 0..100, but tolerate 0..1 just in case.
  return clampPercent(value <= 1 ? value * 100 : value);
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "now";
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

function parseReset(window: any): string | undefined {
  if (typeof window?.reset_after_seconds === "number") {
    return formatDuration(window.reset_after_seconds);
  }

  const resetAt = window?.reset_at ?? window?.resets_at;
  if (typeof resetAt === "string") {
    const ms = new Date(resetAt).getTime();
    if (Number.isFinite(ms)) return formatDuration((ms - Date.now()) / 1000);
  }

  return undefined;
}

function parseWindow(window: any): WindowUsage {
  const usedPercent =
    asPercent(window?.used_percent) ??
    asPercent(window?.usage_percent) ??
    asPercent(window?.utilization) ??
    null;

  return {
    usedPercent,
    leftPercent: usedPercent == null ? null : clampPercent(100 - usedPercent),
    resetsIn: parseReset(window),
  };
}

function parseUsage(payload: any): CodexUsage {
  const rateLimit = payload?.rate_limit ?? payload?.rateLimits ?? payload;
  const primaryRaw =
    rateLimit?.primary_window ??
    rateLimit?.primaryWindow ??
    rateLimit?.five_hour_window ??
    rateLimit?.fiveHourWindow;
  const secondaryRaw =
    rateLimit?.secondary_window ??
    rateLimit?.secondaryWindow ??
    rateLimit?.weekly_window ??
    rateLimit?.weeklyWindow;

  const primary = parseWindow(primaryRaw);
  const secondary = secondaryRaw ? parseWindow(secondaryRaw) : undefined;

  if (primary.usedPercent == null && secondary?.usedPercent == null) {
    throw new Error("usage response did not include known rate-limit fields");
  }

  return {
    primary,
    secondary,
    planType: typeof payload?.plan_type === "string" ? payload.plan_type : undefined,
    updatedAt: new Date(),
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[^\s,}]+/gi, "Bearer <redacted>")
    .replace(/(authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key)['\"]?\s*[:=]\s*['\"]?[^'\"\s,}]+/gi, "$1=<redacted>")
    .slice(0, 240);
}

async function fetchCodexUsage(signal?: AbortSignal): Promise<CodexUsage> {
  const auth = AuthStorage.create();
  const accessToken = await auth.getApiKey("openai-codex");
  if (!accessToken) {
    throw new Error("missing openai-codex OAuth token; run /login for openai-codex");
  }

  const credential = auth.get("openai-codex") as any;
  const accountId = typeof credential?.accountId === "string" ? credential.accountId : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const relayAbort = () => controller.abort();
  signal?.addEventListener("abort", relayAbort, { once: true });

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };
    if (accountId) headers["ChatGPT-Account-Id"] = accountId;

    const response = await fetch(USAGE_ENDPOINT, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`usage endpoint returned HTTP ${response.status}`);
    }

    return parseUsage(await response.json());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", relayAbort);
  }
}

function bar(value: number | null, width = 12): string {
  if (value == null) return "?".repeat(width);
  const filled = Math.round((clampPercent(value) / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function formatStatus(usage: CodexUsage): string {
  const fiveHour = usage.primary.leftPercent == null ? "?" : `${usage.primary.leftPercent}%`;
  const reset = usage.primary.resetsIn ? ` · ${usage.primary.resetsIn}` : "";
  return `Codex ${fiveHour}${reset}`;
}

function formatWidget(usage: CodexUsage, theme?: Theme): string[] {
  const dim = (text: string) => (theme ? theme.fg("dim", text) : text);
  const accent = (text: string) => (theme ? theme.fg("accent", text) : text);

  const lines = [];
  if (usage.planType) lines.push(`${dim("Plan")}    ${usage.planType}`);

  const primaryLabel = usage.primary.leftPercent == null ? "?" : `${usage.primary.leftPercent}% left`;
  lines.push(`${accent("5h")}      ${bar(usage.primary.leftPercent)} ${primaryLabel}${usage.primary.resetsIn ? dim(` · resets in ${usage.primary.resetsIn}`) : ""}`);

  if (usage.secondary) {
    const secondaryLabel = usage.secondary.leftPercent == null ? "?" : `${usage.secondary.leftPercent}% left`;
    lines.push(`${accent("Weekly")}  ${bar(usage.secondary.leftPercent)} ${secondaryLabel}${usage.secondary.resetsIn ? dim(` · resets in ${usage.secondary.resetsIn}`) : ""}`);
  }

  lines.push(dim(`Updated ${usage.updatedAt.toLocaleTimeString()} · wham/usage`));
  lines.push(dim("Press any key to close"));
  return lines;
}

class UsageOverlay {
  constructor(
    private theme: Theme,
    private usage: CodexUsage | undefined,
    private error: string | undefined,
    private done: () => void,
  ) {}

  handleInput(): void {
    this.done();
  }

  render(width: number): string[] {
    const th = this.theme;
    const innerW = Math.max(1, width - 2);
    const result: string[] = [];
    const title = truncateToWidth(" ChatGPT/Codex usage ", innerW);
    const titleW = visibleWidth(title);
    const left = "─".repeat(Math.floor((innerW - titleW) / 2));
    const right = "─".repeat(Math.max(0, innerW - titleW - left.length));

    result.push(th.fg("border", `╭${left}`) + th.fg("accent", title) + th.fg("border", `${right}╮`));

    const lines = this.usage
      ? formatWidget(this.usage, th)
      : [th.fg("error", `Error: ${this.error ?? "usage unavailable"}`), th.fg("dim", "Press any key to close")];

    for (const line of lines) {
      result.push(th.fg("border", "│") + truncateToWidth(` ${line}`, innerW, "...", true) + th.fg("border", "│"));
    }

    result.push(th.fg("border", `╰${"─".repeat(innerW)}╯`));
    return result;
  }

  invalidate(): void {}
  dispose(): void {}
}

function render(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  if (lastUsage) {
    ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", formatStatus(lastUsage)));
  } else if (lastError) {
    ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", "Codex usage unavailable"));
  } else {
    ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", "Codex usage loading…"));
  }
}

async function refresh(ctx: ExtensionContext, notify = false, generation = sessionGeneration) {
  if (!ctx.hasUI) return;

  try {
    const usage = await fetchCodexUsage(ctx.signal);
    if (generation !== sessionGeneration) return;

    lastError = undefined;
    lastUsage = usage;
    render(ctx);
    if (notify) ctx.ui.notify(formatStatus(lastUsage), "info");
  } catch (error) {
    if (generation !== sessionGeneration) return;

    lastUsage = undefined;
    lastError = safeError(error);
    render(ctx);
    if (notify) ctx.ui.notify(`ChatGPT/Codex usage failed: ${lastError}`, "warning");
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    sessionGeneration++;
    const generation = sessionGeneration;
    lastUsage = undefined;
    lastError = undefined;

    render(ctx);
    void refresh(ctx, false, generation);

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      void refresh(ctx, false, generation);
    }, REFRESH_MS);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    sessionGeneration++;
    lastUsage = undefined;
    lastError = undefined;

    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
    if (ctx.hasUI) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      ctx.ui.setWidget(STATUS_KEY, undefined);
    }
  });

  pi.registerCommand("chatgpt-usage", {
    description: "Refresh and show ChatGPT/Codex 5h and weekly usage left",
    handler: async (args, ctx) => {
      const normalized = args.trim().toLowerCase();
      if (normalized === "hide" || normalized === "off") {
        ctx.ui.setWidget(STATUS_KEY, undefined);
        return;
      }

      await refresh(ctx, false);
      await ctx.ui.custom<void>(
        (_tui, theme, _keybindings, done) => new UsageOverlay(theme, lastUsage, lastError, done),
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-center",
            width: 58,
            maxHeight: 10,
            margin: { bottom: 1 },
          },
        },
      );
    },
  });
}
