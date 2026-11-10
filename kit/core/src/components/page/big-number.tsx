/** A number three rows tall, drawn with half blocks: the step you are on, beside its page's heading. */
import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useIntentColor } from "../../app/app-provider";
import type { ColorIntent } from "../../theme/tokens";

/** Each digit as five columns by six rows of pixels, read row by row. */
const DIGITS: Record<string, readonly string[]> = {
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
};

export const BIG_NUMBER_ROWS = 3;

/** The three text rows of `value`: two pixel rows to a cell, a column between digits. */
export function bigNumberLines(value: number): string[] {
	const digits = [...String(Math.max(0, Math.trunc(value)))].map((digit) => DIGITS[digit]!);
	return Array.from({ length: BIG_NUMBER_ROWS }, (_, row) =>
		digits
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

export function BigNumber({
	value,
	intent = "accent",
}: {
	value: number;
	intent?: ColorIntent;
}): ReactNode {
	const color = useIntentColor()(intent);
	return (
		<Box flexDirection="column" flexShrink={0}>
			{bigNumberLines(value).map((line, row) => (
				<Text key={row} color={color}>
					{line}
				</Text>
			))}
		</Box>
	);
}
