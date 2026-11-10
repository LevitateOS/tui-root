/**
 * The one set of marks every list of steps, checks or commands uses: ✓ done, ◉ you are
 * here, ● ready, ○ not yet, ◐ running, ✗ failed or refused.
 */
import type { ColorIntent } from "../theme/tokens";

/** How a step, a check or a command stands. `none` draws no mark. */
export type PathState = "done" | "running" | "failed" | "ready" | "waiting" | "none";

export const MARK: Record<PathState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	running: { mark: "◐", intent: "warning" },
	failed: { mark: "✗", intent: "error" },
	ready: { mark: "●", intent: "accent" },
	waiting: { mark: "○", intent: "faintText" },
	none: { mark: " ", intent: "faintText" },
};

/** The mark of the row you are at, unless its state says more. */
export const HERE_MARK = { mark: "◉", intent: "accent" as ColorIntent };
