/** Figures three rows tall, drawn with half blocks: a step's number, a tick, a warning,
 * a percentage. */
import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useIntentColor } from "../../app/app-provider";
import { useSurfaceBackground } from "../../primitives/display/cells";
import type { ColorIntent } from "../../theme/tokens";

/** Each glyph as five columns by six rows of pixels, read row by row. */
const PIXELS: Record<string, readonly string[]> = {
	"0": [".###.", "#...#", "#...#", "#...#", "#...#", ".###."],
	"1": ["..#..", ".##..", "..#..", "..#..", "..#..", ".###."],
	"2": [".###.", "#...#", "...#.", "..#..", ".#...", "#####"],
	"3": ["####.", "....#", ".###.", "....#", "....#", "####."],
	"4": ["...#.", "..##.", ".#.#.", "#####", "...#.", "...#."],
	"5": ["#####", "#....", "####.", "....#", "....#", "####."],
	"6": [".###.", "#....", "####.", "#...#", "#...#", ".###."],
	"7": ["#####", "....#", "...#.", "..#..", "..#..", "..#.."],
	"8": [".###.", "#...#", ".###.", "#...#", "#...#", ".###."],
	"9": [".###.", "#...#", "#...#", ".####", "....#", ".###."],
	"%": ["#...#", "...#.", "..#..", "..#..", ".#...", "#...#"],
	check: ["....#", "...##", "#.##.", "###..", ".#...", "....."],
	bang: ["..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
};

export const BIG_NUMBER_ROWS = 3;

/** A glyph beside a heading: a number, a tick or a warning. */
export type BigGlyph = number | "check" | "bang";

/** The three text rows of these glyphs: two pixel rows to a cell, a column between
 * glyphs. Glyphs it has no pixels for are left out. */
function glyphLines(names: readonly string[]): string[] {
	const glyphs = names.flatMap((name) => (PIXELS[name] ? [PIXELS[name]] : []));
	return Array.from({ length: BIG_NUMBER_ROWS }, (_, row) =>
		glyphs
			.map((pixels) =>
				[...pixels[0]!]
					.map((_, column) => {
						const top = pixels[row * 2]![column] === "#";
						const bottom = pixels[row * 2 + 1]![column] === "#";
						return top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
					})
					.join(""),
			)
			.join(" "),
	);
}

/** The three text rows of `value`. */
export function bigNumberLines(value: number): string[] {
	return glyphLines([...String(Math.max(0, Math.trunc(value)))]);
}

/** The three text rows of a heading's glyph. */
export function bigGlyphLines(glyph: BigGlyph): string[] {
	return typeof glyph === "number" ? bigNumberLines(glyph) : glyphLines([glyph]);
}

function BigLines({ lines, intent }: { lines: string[]; intent: ColorIntent }): ReactNode {
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	return (
		<Box flexDirection="column" flexShrink={0}>
			{lines.map((line, row) => (
				<Text key={row} color={color(intent)} backgroundColor={background}>
					{line}
				</Text>
			))}
		</Box>
	);
}

/** A number three rows tall. */
export function BigNumber({
	value,
	intent = "accent",
}: {
	value: number;
	intent?: ColorIntent;
}): ReactNode {
	return <BigLines lines={bigNumberLines(value)} intent={intent} />;
}

/** Text such as "62%" three rows tall: digits and the percent sign; anything else is
 * left out. Each glyph takes six columns, the last five. */
export function BigFigure({
	text,
	intent = "accent",
}: {
	text: string;
	intent?: ColorIntent;
}): ReactNode {
	return <BigLines lines={glyphLines([...text])} intent={intent} />;
}

/** A heading's glyph three rows tall. */
export function BigGlyphBlock({
	glyph,
	intent = "accent",
}: {
	glyph: BigGlyph;
	intent?: ColorIntent;
}): ReactNode {
	return <BigLines lines={bigGlyphLines(glyph)} intent={intent} />;
}
