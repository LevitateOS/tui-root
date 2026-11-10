/**
 * Drawing a part cell by cell, the way the design's mock-ups are drawn: a grid of cells,
 * each with a glyph, a text colour, a background and a weight, all named by intent. Every
 * cell is painted, and every run of cells is a Text that names both its colours, so a
 * part never shows the terminal's own colour, whatever surface it sits on.
 */
import { Box, Text } from "ink";
import { createContext, useContext, type ReactNode } from "react";
import { useIntentColor } from "../../app/app-provider";
import type { ColorIntent } from "../../theme/tokens";
import { textWidth } from "../../utils/strings";

/**
 * The background intent of the surface a part is drawn on. The frame sets it for each
 * pane, and `Surface` and `Panel` set it for what they hold, so a part paints its empty
 * cells in the colour under it.
 */
export const SurfaceBackground = createContext<ColorIntent>("contentBackground");

/** The background intent of the surface this part sits on. */
export function useSurfaceBackground(): ColorIntent {
	return useContext(SurfaceBackground);
}

type Cell = { ch: string; fg: ColorIntent; bg: ColorIntent; bold: boolean };

const segmenter = new Intl.Segmenter();

/** A block of cells to draw on; `put` and `fill` work as the mock-ups' own. */
export class CellGrid {
	readonly rows: Cell[][];

	constructor(
		readonly width: number,
		height: number,
		background: ColorIntent,
	) {
		this.rows = Array.from({ length: Math.max(0, height) }, () =>
			Array.from({ length: Math.max(0, width) }, () => ({
				ch: " ",
				fg: "text" as ColorIntent,
				bg: background,
				bold: false,
			})),
		);
	}

	/** Writes `text` from `col` (cut at the grid's edge); returns the column after it. */
	put(
		row: number,
		col: number,
		text: string,
		fg: ColorIntent,
		bg?: ColorIntent,
		bold = false,
	): number {
		const line = this.rows[row];
		let at = col;
		for (const { segment } of segmenter.segment(text)) {
			const wide = textWidth(segment);
			if (wide === 0) continue;
			if (line && at >= 0 && at + wide <= this.width) {
				line[at] = { ch: segment, fg, bg: bg ?? line[at]!.bg, bold };
				// A wide glyph covers the next cell too.
				for (let i = 1; i < wide; i++) line[at + i] = { ch: "", fg, bg: bg ?? line[at]!.bg, bold };
			}
			at += wide;
		}
		return at;
	}

	/** Paints `width` cells from `col` in a background, keeping their glyphs. */
	fill(row: number, col: number, width: number, bg: ColorIntent): void {
		const line = this.rows[row];
		if (!line) return;
		for (let c = Math.max(0, col); c < Math.min(this.width, col + width); c++) {
			line[c] = { ...line[c]!, bg };
		}
	}
}

/** The grid drawn: one Text a row, one nested Text a run of cells in one style. */
export function CellRows({ grid }: { grid: CellGrid }): ReactNode {
	const color = useIntentColor();
	return (
		<Box flexDirection="column" flexShrink={0} width={grid.width}>
			{grid.rows.map((line, r) => {
				const runs: { cell: Cell; text: string }[] = [];
				for (const cell of line) {
					const last = runs.at(-1);
					if (
						last &&
						last.cell.fg === cell.fg &&
						last.cell.bg === cell.bg &&
						last.cell.bold === cell.bold
					)
						last.text += cell.ch;
					else runs.push({ cell, text: cell.ch });
				}
				return (
					<Text key={r} wrap="truncate">
						{runs.map((run, i) => (
							<Text
								key={i}
								color={color(run.cell.fg)}
								backgroundColor={color(run.cell.bg)}
								bold={run.cell.bold}
							>
								{run.text}
							</Text>
						))}
					</Text>
				);
			})}
		</Box>
	);
}
