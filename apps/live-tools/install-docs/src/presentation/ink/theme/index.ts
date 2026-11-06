import { createTheme, type ThemeColor, type TuiTheme } from "@levitate/tui-kit";
import type { NoteBlock } from "@levitate/docs-content";

/** Colours used by more than one intent, named once. */
const ink = {
	border: "#5a5870",
	text: "#eceaf4",
	dimText: "#a19ab6",
	link: "#7db3ff",
	white: "#ffffff",
	selection: "#2f5ed7",
	info: "#8ab8ff",
	warning: "#ffc76a",
} as const satisfies Record<string, ThemeColor>;

export function createInstallDocsTheme(): TuiTheme {
	return createTheme(
		{
			background: "inherit",
			border: ink.border,
			sidebarBorder: ink.border,
			sidebarBackground: "inherit",
			contentBackground: "inherit",
			headerBackground: "inherit",
			footerBackground: "inherit",
			sidebarSectionText: ink.text,
			sidebarItemText: "#b8b3c9",
			sidebarItemActiveText: "#f5f7ff",
			sidebarItemActiveBackground: "#1f4acc",
			text: ink.text,
			dimText: ink.dimText,
			accent: ink.link,
			linkText: ink.link,
			linkActiveText: ink.white,
			linkActiveBackground: ink.selection,
			info: ink.info,
			warning: ink.warning,
			code: ink.warning,
			commandBarBackground: "inherit",
			commandPrompt: ink.info,
			sectionHeading: "#9cc4ff",
			sectionSubheading: ink.link,
			cardBorder: "#49455e",
			cardBackground: "inherit",
		},
		{
			sidebarWidth: 32,
			minColumns: 88,
			headerHeight: 1,
			footerHeight: 1,
		},
		{
			borderGlyphSet: "single",
			panePaddingX: 1,
			panePaddingY: 0,
			framePaneGap: 0,
		},
	);
}

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
