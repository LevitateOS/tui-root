import { RichTextLine, textWidth, type RichTextRun, type ThemeColor } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import { parseSyntaxTokenLine } from "./syntax-markup";

type SyntaxLineProps = {
	line: string;
	/** Text without its own markup colour. */
	color: ThemeColor;
	background: ThemeColor;
	/** Pad the row to this many columns so the background fills it. */
	width?: number;
	bold?: boolean;
};

/** One line of `[[fg=…]]` markup, drawn as styled runs. */
export function SyntaxLine({
	line,
	color,
	background,
	width,
	bold = false,
}: SyntaxLineProps): ReactNode {
	const runs: RichTextRun[] = parseSyntaxTokenLine(line).map((token) => ({
		text: token.text,
		color: token.color ?? color,
		background,
		bold,
	}));
	const used = runs.reduce((total, run) => total + textWidth(run.text), 0);
	if (width !== undefined && width > used) {
		runs.push({ text: " ".repeat(Math.floor(width) - used), color, background });
	}
	return <RichTextLine runs={runs} />;
}
