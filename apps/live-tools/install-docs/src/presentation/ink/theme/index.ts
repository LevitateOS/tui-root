import {
	brandTheme,
	glyphs,
	type BorderStyle,
	type ThemeColor,
	type TuiTheme,
} from "@levitate/tui-kit";
import type { NoteBlock } from "@levitate/docs-content";
import { brandOf } from "@levitate/docs-content/brand";
import type { Distro } from "@levitate/docs-content/distros";

/** Box-drawing style of the panes and of code blocks and tables inside them. */
const BORDER: BorderStyle = "single";
export const DOCS_GLYPHS = glyphs(BORDER);
/** Note admonitions are drawn round to set them apart from code blocks. */
export const NOTE_GLYPHS = glyphs("round");

/** Markers drawn in front of headings and the selected command. */
export const MARKERS = {
	heading: "◆",
	subheading: "›",
	selected: "▸",
} as const;

/** The distro's colours, with the docs' own widths (the pages beside the install steps). */
export function createInstallDocsTheme(distro: Distro | undefined): TuiTheme {
	return brandTheme(
		brandOf(distro),
		{},
		{
			navWidth: 32,
			minColumns: 88,
		},
		{
			borderGlyphSet: BORDER,
			panePaddingX: 1,
			panePaddingY: 0,
			framePaneGap: 0,
		},
	);
}

/** Command rows: the prompt and command text, and the row behind them. */
export const COMMAND_COLORS = {
	prompt: "#a9cf9a",
	background: "inherit",
} as const satisfies Record<string, ThemeColor>;

export type NoteColors = {
	label: string;
	labelColor: ThemeColor;
	backgroundColor: ThemeColor;
	borderColor: ThemeColor;
};

/** Admonition colours per note variant. */
export const NOTE_COLORS: Record<NoteBlock["variant"], NoteColors> = {
	info: {
		label: "INFO",
		labelColor: "#a9cf9a",
		backgroundColor: "#1d2d24",
		borderColor: "#a9cf9a",
	},
	warning: {
		label: "WARNING",
		labelColor: "#e4cba6",
		backgroundColor: "#1d2d24",
		borderColor: "#e4cba6",
	},
	danger: {
		label: "DANGER",
		labelColor: "#f0a497",
		backgroundColor: "#1d2d24",
		borderColor: "#f0a497",
	},
};
