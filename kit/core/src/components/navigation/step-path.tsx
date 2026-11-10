/**
 * Steps as a path you travel down: a mark for each, a line joining them, what was
 * answered beside them, and the one you are at on a raised bar with an accent edge.
 * It draws to both edges of its pane (`useShellLayout({ navFlush: true })`).
 *
 * In a pane with a background, Ink gives a Text nested in another the pane's background,
 * not the outer Text's: each part of the raised row therefore names the row's own.
 */
import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useIntentColor } from "../../app/app-provider";
import type { ColorIntent } from "../../theme/tokens";
import { textWidth, truncateLine } from "../../utils/strings";

export type PathState = "done" | "running" | "failed" | "ready" | "waiting";

export type PathStep = {
	id: string;
	label: string;
	state: PathState;
	/** Shown at the row's end: what the step was answered with. */
	value?: string;
};

const MARK: Record<PathState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	running: { mark: "◐", intent: "warning" },
	failed: { mark: "✗", intent: "error" },
	ready: { mark: "○", intent: "accent" },
	waiting: { mark: "○", intent: "navHeading" },
};

/** Where the mark sits, and where the label starts. */
const MARK_COLUMN = 3;
const LABEL_COLUMN = 6;
const END_PADDING = 2;

export function StepPath({
	steps,
	selected,
	width,
	rows,
}: {
	steps: readonly PathStep[];
	/** The id of the step shown. */
	selected: string;
	/** The pane's width and the rows there are; with too few rows the joining lines go. */
	width: number;
	rows: number;
}): ReactNode {
	const color = useIntentColor();
	const joined = rows >= steps.length * 2 - 1;
	return (
		<Box flexDirection="column">
			{steps.map((step, i) => {
				const here = step.id === selected;
				const { mark, intent } = MARK[step.state];
				const background = here ? color("raisedBackground") : undefined;
				const room = Math.max(1, width - LABEL_COLUMN - END_PADDING);
				const label = truncateLine(step.label, room);
				const space = room - textWidth(label) - 2;
				const value = step.value && space >= 3 ? truncateLine(step.value, space) : "";
				return (
					<Box key={step.id} flexDirection="column">
						<Text backgroundColor={background}>
							<Text color={color("accent")} backgroundColor={background}>
								{here ? "▌" : " "}
							</Text>
							{" ".repeat(MARK_COLUMN - 1)}
							<Text
								color={color(here && step.state !== "done" ? "accent" : intent)}
								backgroundColor={background}
								bold={here}
							>
								{here && step.state !== "done" && step.state !== "failed" ? "◉" : mark}
							</Text>
							{" ".repeat(LABEL_COLUMN - MARK_COLUMN - 1)}
							<Text
								bold={here}
								color={color(here ? "text" : step.state === "waiting" ? "dimText" : "navItem")}
								backgroundColor={background}
							>
								{label}
							</Text>
							<Text color={color("dimText")} backgroundColor={background}>
								{" ".repeat(Math.max(0, room - textWidth(label) - textWidth(value)))}
								{value}
							</Text>
							{" ".repeat(END_PADDING)}
						</Text>
						{joined && i < steps.length - 1 ? (
							<Text>
								{" ".repeat(MARK_COLUMN)}
								<Text color={color(step.state === "done" ? "success" : "contentBorder")}>│</Text>
							</Text>
						) : null}
					</Box>
				);
			})}
		</Box>
	);
}
