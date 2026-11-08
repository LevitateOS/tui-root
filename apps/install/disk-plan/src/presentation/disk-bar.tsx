/** The disk drawn as one bar of its partitions. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import { ContentWidth, useIntentColor, type ColorIntent } from "@levitate/tui-kit";

/** Colours that tell neighbouring partitions apart. */
const PART_INTENTS: readonly ColorIntent[] = ["accent", "success", "warning", "info", "link"];

export type BarPart = { label: string; detail: string; size: number | null };

/**
 * The disk as one bar, each part as wide as its share (a part with no size takes what is
 * left), with a legend beneath.
 */
export function DiskBar({ parts, total }: { parts: readonly BarPart[]; total: number }): ReactNode {
	const width = useContext(ContentWidth);
	const color = useIntentColor();
	const fixed = parts.reduce((sum, part) => sum + (part.size ?? 0), 0);
	const rest = Math.max(0, total - fixed);
	const sizes = parts.map((part) => part.size ?? rest);
	// Every part gets at least one cell; the rest of the bar is shared by size.
	const spare = Math.max(0, width - parts.length);
	const cells = sizes.map((size) => 1 + Math.floor((spare * size) / Math.max(1, total)));
	const short = width - cells.reduce((a, b) => a + b, 0);
	if (cells.length > 0) cells[sizes.indexOf(Math.max(...sizes))]! += Math.max(0, short);
	const partColor = (i: number) => color(PART_INTENTS[i % PART_INTENTS.length]!);
	return (
		<Box flexDirection="column">
			<Text>
				{cells.map((n, i) => (
					<Text key={i} color={partColor(i)}>
						{"█".repeat(n)}
					</Text>
				))}
			</Text>
			<Box flexDirection="row" flexWrap="wrap" columnGap={3}>
				{parts.map((part, i) => (
					<Text key={part.label}>
						<Text color={partColor(i)}>■ </Text>
						<Text bold>{part.label}</Text>
						<Text color={color("dimText")}> {part.detail}</Text>
					</Text>
				))}
			</Box>
		</Box>
	);
}
