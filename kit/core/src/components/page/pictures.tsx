/**
 * The pictures a page is built around: a disk as one bar, a word typed a letter a cell,
 * checks in columns, commands as a run sheet, what goes where. Each draws to the content
 * width (`ContentWidth`) unless given a width, and paints every cell it covers.
 */
import { Box } from "ink";
import { useContext, type ReactNode } from "react";
import {
	CellGrid,
	CellRows,
	SurfaceBackground,
	useSurfaceBackground,
} from "../../primitives/display/cells";
import { useIntentColor } from "../../app/app-provider";
import type { ColorIntent } from "../../theme/tokens";
import { textWidth, truncateLine } from "../../utils/strings";
import { MARK, type PathState } from "../marks";
import { ContentWidth } from "./blocks";

export type DiskPart = {
	/** Written inside the stretch when it is wide enough; may be empty. */
	name: string;
	/** In any unit, the same for every part and the total. */
	size: number;
	intent: ColorIntent;
};

/** The columns a `DiskBar` label takes before the bar. */
const DISK_LABEL_COLUMNS = 7;

/**
 * Where each part of a `DiskBar` drawn with these arguments sits: its first column
 * (from the bar's left edge, label included) and its width. A caller writes a line of
 * labels under the bar from these.
 */
export function diskBarSpans(
	parts: readonly DiskPart[],
	width: number,
	total = parts.reduce((sum, part) => sum + part.size, 0),
	label?: string,
): { start: number; width: number }[] {
	const x = label ? DISK_LABEL_COLUMNS : 0;
	const room = width - x;
	let col = x;
	return parts.map((part, i) => {
		let w = Math.max(2, Math.round((room * part.size) / Math.max(1, total)));
		w = Math.max(0, Math.min(w, x + room - col - 2 * (parts.length - 1 - i)));
		const span = { start: col, width: w };
		col += w;
		return span;
	});
}

/**
 * A disk as one bar: each part a stretch in its intent, its name inside when it fits,
 * what is left of `total` in the rule colour. `label` (up to six cells, such as "Now")
 * stands before the bar; `selected` (an index into `parts`) is marked by a line under
 * its stretch, which takes a second row.
 */
export function DiskBar({
	parts,
	total,
	width,
	label,
	selected,
}: {
	parts: readonly DiskPart[];
	total?: number;
	width?: number;
	label?: string;
	selected?: number;
}): ReactNode {
	const contentWidth = useContext(ContentWidth);
	const full = width ?? contentWidth;
	const marked = selected !== undefined && selected >= 0 && selected < parts.length;
	const grid = new CellGrid(full, marked ? 2 : 1, useSurfaceBackground());
	const spans = diskBarSpans(parts, full, total, label);
	if (label) grid.put(0, 0, truncateLine(label, DISK_LABEL_COLUMNS - 1), "dimText");
	const start = label ? DISK_LABEL_COLUMNS : 0;
	grid.fill(0, start, full - start, "panelBorder");
	parts.forEach((part, i) => {
		const span = spans[i]!;
		grid.fill(0, span.start, span.width, part.intent);
		if (part.name && textWidth(part.name) + 2 <= span.width) {
			grid.put(0, span.start + 1, part.name, "contentBackground", undefined, true);
		}
	});
	if (marked) {
		const span = spans[selected]!;
		grid.put(1, span.start, "▀".repeat(span.width), "text");
	}
	return <CellRows grid={grid} />;
}

/**
 * A word to type, a cell a letter: the destructive steps' last gate. Typed letters fill
 * their cells, in the error colour until the word is whole and then in success; after
 * the cells, "locked" or "unlocked". A blank row follows.
 */
export function WordSlots({ word, typed }: { word: string; typed: string }): ReactNode {
	const letters = [...word];
	const keyed = [...typed];
	const done = typed === word;
	const state = done ? "unlocked" : "locked";
	const grid = new CellGrid(letters.length * 4 + 2 + state.length, 2, useSurfaceBackground());
	letters.forEach((_, i) => {
		const filled = i < keyed.length;
		const bg: ColorIntent = filled ? (done ? "success" : "error") : "raisedBackground";
		grid.fill(0, i * 4, 3, bg);
		grid.put(
			0,
			i * 4 + 1,
			filled ? keyed[i]! : "·",
			filled ? "contentBackground" : "faintText",
			bg,
			true,
		);
	});
	grid.put(0, letters.length * 4 + 2, state, done ? "success" : "error", undefined, true);
	return <CellRows grid={grid} />;
}

export type CheckColumn = {
	/** A small title over the column. */
	title: string;
	items: ReadonlyArray<{ state: PathState; text: string }>;
};

/** Checks in columns, each under a small title, each line with its mark; a failed one
 * in the error colour. A blank row follows. */
export function Checks({
	columns,
	width,
}: {
	columns: readonly CheckColumn[];
	width?: number;
}): ReactNode {
	const contentWidth = useContext(ContentWidth);
	const full = width ?? contentWidth;
	const each = Math.floor(full / Math.max(1, columns.length));
	const height = 1 + Math.max(0, ...columns.map((column) => column.items.length)) + 1;
	const grid = new CellGrid(full, height, useSurfaceBackground());
	columns.forEach((column, i) => {
		const x = i * each;
		grid.put(
			0,
			x,
			truncateLine(column.title.toUpperCase(), each - 1),
			"faintText",
			undefined,
			true,
		);
		column.items.forEach((item, j) => {
			const { mark, intent } = MARK[item.state];
			const failed = item.state === "failed";
			grid.put(1 + j, x, mark, intent, undefined, failed);
			grid.put(1 + j, x + 2, truncateLine(item.text, each - 3), failed ? "error" : "text");
		});
	});
	return <CellRows grid={grid} />;
}

export type RunStep = {
	/** The phase the command belongs to; named on its first command. */
	phase: string;
	command: string;
	state: PathState;
};

/**
 * Commands in the order they run, the phase named where it starts, each with its mark.
 * The running or failed command is on a raised row. Once anything has run, the commands
 * still waiting are drawn quieter.
 */
export function RunSheet({
	steps,
	width,
}: {
	steps: readonly RunStep[];
	width?: number;
}): ReactNode {
	const contentWidth = useContext(ContentWidth);
	const full = width ?? contentWidth;
	const phaseWidth = Math.max(0, ...steps.map((step) => textWidth(step.phase)));
	const markColumn = phaseWidth + 3;
	const started = steps.some((step) => step.state !== "waiting" && step.state !== "none");
	const grid = new CellGrid(full, steps.length, useSurfaceBackground());
	steps.forEach((step, row) => {
		const quiet = started && step.state === "waiting";
		const here = step.state === "running" || step.state === "failed";
		const raised: ColorIntent | undefined = here ? "raisedBackground" : undefined;
		if (here) grid.fill(row, markColumn - 1, full - markColumn + 1, "raisedBackground");
		if (row === 0 || steps[row - 1]!.phase !== step.phase) {
			grid.put(row, 0, step.phase, quiet ? "faintText" : "info");
		}
		const { mark, intent } = MARK[step.state];
		grid.put(row, markColumn, mark, intent, raised, here);
		grid.put(
			row,
			markColumn + 3,
			truncateLine(step.command, full - markColumn - 4),
			quiet ? "dimText" : "text",
			raised,
			here,
		);
	});
	return <CellRows grid={grid} />;
}

export type FromToSide = { title: string; lines: readonly string[] };

/** What goes where: two surfaces side by side with an arrow between, a title and a few
 * lines in each. A blank row follows. */
export function FromTo({
	from,
	to,
	width,
}: {
	from: FromToSide;
	to: FromToSide;
	width?: number;
}): ReactNode {
	const contentWidth = useContext(ContentWidth);
	const full = width ?? contentWidth;
	const half = Math.max(1, Math.floor((full - 5) / 2));
	const height = Math.max(from.lines.length, to.lines.length) + 3;
	const grid = new CellGrid(full, height + 1, useSurfaceBackground());
	[from, to].forEach((side, i) => {
		const x = i * (half + 5);
		for (let r = 0; r < side.lines.length + 3; r++) grid.fill(r, x, half, "panelBackground");
		grid.put(1, x + 2, truncateLine(side.title, half - 4), "text", undefined, true);
		side.lines.forEach((line, j) => {
			grid.put(2 + j, x + 2, truncateLine(line, half - 4), "dimText");
		});
	});
	grid.put(2, half + 1, "──▶", "accent", undefined, true);
	return <CellRows grid={grid} />;
}

/**
 * A block of a background intent that paints every cell, for an app to lay its own
 * content on (a card, a tile, the machine being made). The parts inside take its
 * background for their empty cells. Give it a `width` (or `flexGrow`) and, for a fixed
 * block, a `height`; `paddingX` and `paddingY` keep content off its edges.
 */
export function Surface({
	background = "panelBackground",
	width,
	height,
	flexGrow,
	paddingX = 0,
	paddingY = 0,
	marginBottom,
	children,
}: {
	background?: ColorIntent;
	width?: number | string;
	height?: number;
	flexGrow?: number;
	paddingX?: number;
	paddingY?: number;
	marginBottom?: number;
	children?: ReactNode;
}): ReactNode {
	const color = useIntentColor();
	return (
		<SurfaceBackground.Provider value={background}>
			<Box
				flexDirection="column"
				flexShrink={0}
				width={width}
				height={height}
				flexGrow={flexGrow}
				paddingX={paddingX}
				paddingY={paddingY}
				marginBottom={marginBottom}
				overflow="hidden"
				backgroundColor={color(background)}
			>
				{children}
			</Box>
		</SurfaceBackground.Provider>
	);
}
