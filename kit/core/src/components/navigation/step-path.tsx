/**
 * The rail: steps as a path you travel down (`StepPath`), or a grouped list (`RailList`).
 * Both draw the same rows: a mark for each, its label, something short at its end, and
 * the row you are at on a raised bar with an accent edge. They draw to both edges of
 * their pane (`useShellLayout({ navFlush: true })`).
 */
import { Box } from "ink";
import type { ReactNode } from "react";
import { CellGrid, CellRows, useSurfaceBackground } from "../../primitives/display/cells";
import type { ColorIntent } from "../../theme/tokens";
import { textWidth, truncateLine } from "../../utils/strings";
import { HERE_MARK, MARK, type PathState } from "../marks";

export type { PathState } from "../marks";

export type PathStep = {
	id: string;
	label: string;
	state: PathState;
	/** Shown at the row's end: what the step was answered with. */
	value?: string;
};

/** Where the mark sits, and where the label starts. */
const MARK_COLUMN = 3;
const LABEL_COLUMN = 6;
const END_PADDING = 2;

/** One row of the rail. `hereMark` turns the mark of the row you are at into ◉. */
function RailRow({
	width,
	label,
	state,
	end,
	endIntent,
	here,
	hereMark,
}: {
	width: number;
	label: string;
	state: PathState;
	end?: string;
	endIntent: ColorIntent;
	here: boolean;
	hereMark: boolean;
}): ReactNode {
	const grid = new CellGrid(width, 1, useSurfaceBackground());
	const raised: ColorIntent | undefined = here ? "raisedBackground" : undefined;
	if (here) {
		grid.fill(0, 0, width, "raisedBackground");
		grid.put(0, 0, "▌", "accent");
	}
	const { mark, intent } =
		here && hereMark && state !== "done" && state !== "failed" && state !== "running"
			? HERE_MARK
			: MARK[state];
	grid.put(0, MARK_COLUMN, mark, intent, raised, here);
	const room = Math.max(1, width - LABEL_COLUMN - END_PADDING);
	const shown = truncateLine(label, room);
	grid.put(
		0,
		LABEL_COLUMN,
		shown,
		here ? "text" : state === "waiting" ? "dimText" : "navItem",
		raised,
		here,
	);
	const space = room - textWidth(shown) - 2;
	if (end && space >= Math.min(3, textWidth(end))) {
		const fitted = truncateLine(end, space);
		grid.put(0, width - END_PADDING - textWidth(fitted), fitted, endIntent, raised);
	}
	return <CellRows grid={grid} />;
}

/** The line joining two steps of the path. */
function Joint({ width, done }: { width: number; done: boolean }): ReactNode {
	const grid = new CellGrid(width, 1, useSurfaceBackground());
	grid.put(0, MARK_COLUMN, "│", done ? "success" : "contentBorder");
	return <CellRows grid={grid} />;
}

/** Steps as a path: the marks joined by a line, what each was answered with at its end. */
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
	const joined = rows >= steps.length * 2 - 1;
	return (
		<Box flexDirection="column">
			{steps.map((step, i) => (
				<Box key={step.id} flexDirection="column">
					<RailRow
						width={width}
						label={step.label}
						state={step.state}
						end={step.value}
						endIntent="dimText"
						here={step.id === selected}
						hereMark
					/>
					{joined && i < steps.length - 1 ? (
						<Joint width={width} done={step.state === "done"} />
					) : null}
				</Box>
			))}
		</Box>
	);
}

export type RailItem = {
	id: string;
	label: string;
	state: PathState;
	/** Shown quietly at the row's end: the item's hotkey. */
	hint?: string;
};

export type RailGroup = {
	/** A small title over the group; none for a group that stands alone. */
	title?: string;
	items: readonly RailItem[];
};

/** A rail of groups: the rows of `StepPath` without the joining line, a blank row after
 * each group. The row you are at keeps its own mark. */
export function RailList({
	groups,
	selected,
	width,
}: {
	groups: readonly RailGroup[];
	/** The id of the item shown. */
	selected: string;
	width: number;
}): ReactNode {
	const background = useSurfaceBackground();
	return (
		<Box flexDirection="column">
			{groups.map((group, g) => {
				let title: ReactNode = null;
				if (group.title) {
					const grid = new CellGrid(width, 1, background);
					grid.put(
						0,
						MARK_COLUMN,
						truncateLine(group.title.toUpperCase(), width - MARK_COLUMN - END_PADDING),
						"faintText",
						undefined,
						true,
					);
					title = <CellRows grid={grid} />;
				}
				const gap = new CellGrid(width, 1, background);
				return (
					<Box key={g} flexDirection="column">
						{title}
						{group.items.map((item) => (
							<RailRow
								key={item.id}
								width={width}
								label={item.label}
								state={item.state}
								end={item.hint}
								endIntent="faintText"
								here={item.id === selected}
								hereMark={false}
							/>
						))}
						{g < groups.length - 1 ? <CellRows grid={gap} /> : null}
					</Box>
				);
			})}
		</Box>
	);
}
