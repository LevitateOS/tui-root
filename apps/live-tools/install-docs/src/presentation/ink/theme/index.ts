import {
	createTheme,
	glyphs,
	type BorderStyle,
	type ThemeColor,
	type TuiTheme,
} from "@levitate/tui-kit";
import type { NoteBlock } from "@levitate/docs-content";

/** Colours used by more than one intent, named once. */
const ink = {
	border: "#5a5870",
	text: "#eceaf4",
	dimText: "#a19ab6",
	link: "#7db3ff",
	white: "#ffffff",
	selection: "#2f5ed7",
	panel: "#49455e",
	info: "#8ab8ff",
	warning: "#ffc76a",
} as const satisfies Record<string, ThemeColor>;

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

export function createInstallDocsTheme(): TuiTheme {
	return createTheme(
		{
			navBorder: ink.border,
			navBackground: "inherit",
			contentBackground: "inherit",
			footerBackground: "inherit",
			navHeading: ink.text,
			navItem: "#b8b3c9",
			selection: "#f5f7ff",
			selectionBackground: "#1f4acc",
			text: ink.text,
			dimText: ink.dimText,
			accent: ink.link,
			link: ink.link,
			linkActive: ink.white,
			linkActiveBackground: ink.selection,
			info: ink.info,
			warning: ink.warning,
			code: ink.warning,
			heading: "#9cc4ff",
			subheading: ink.link,
			contentBorder: ink.panel,
			panelBorder: ink.panel,
			panelBackground: "inherit",
		},
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
	prompt: ink.info,
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
		labelColor: "#b6ffe7",
		backgroundColor: "#0d2b22",
		borderColor: "#6decc9",
	},
	warning: {
		label: "WARNING",
		labelColor: "#ffe8a6",
		backgroundColor: "#47310b",
		borderColor: "#ffd36e",
	},
	danger: {
		label: "DANGER",
		labelColor: "#ffd0d0",
		backgroundColor: "#371010",
		borderColor: "#ff7d7d",
	},
};
