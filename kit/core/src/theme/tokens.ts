import { palette } from "./palette";

/**
 * A theme colour: `#rrggbb`, or `"inherit"` to leave the terminal's own colour.
 * Ink hands hex to chalk, which converts it to whatever the terminal supports
 * (256 or 16 colours, or none), so a theme states each colour once.
 */
export type ThemeColor = `#${string}` | "inherit";

export type ColorIntent =
	| "border"
	| "text"
	| "dimText"
	| "accent"
	| "linkText"
	| "linkActiveText"
	| "linkActiveBackground"
	| "info"
	| "warning"
	| "error"
	| "success"
	| "background"
	| "sidebarBackground"
	| "contentBackground"
	| "headerBackground"
	| "footerBackground"
	| "sidebarSectionText"
	| "sidebarItemText"
	| "sidebarItemActiveText"
	| "sidebarItemActiveBackground"
	| "sidebarBorder"
	| "footerSeparator"
	| "commandBarBackground"
	| "commandPrompt"
	| "sectionHeading"
	| "sectionSubheading"
	| "cardBorder"
	| "cardBackground"
	| "code";

export type ThemeColors = Record<ColorIntent, ThemeColor>;

export type ThemeColorsOverride = Partial<ThemeColors>;

export type ThemeLayout = {
	sidebarWidth: number;
	headerHeight: number;
	footerHeight: number;
	minColumns: number;
	minRows: number;
};

export type ThemeChrome = {
	borderGlyphSet: "single" | "double" | "round" | "bold";
	panePaddingX: number;
	panePaddingY: number;
	framePaneGap: number;
};

export type TuiTheme = {
	colors: ThemeColors;
	layout: ThemeLayout;
	chrome: ThemeChrome;
};

export const defaultThemeColors: ThemeColors = {
	border: palette.white,
	text: palette.gray200,
	dimText: palette.slate400,
	accent: palette.sky300,
	linkText: palette.sky300,
	linkActiveText: palette.slate900,
	linkActiveBackground: palette.slate300,
	info: palette.blue300,
	warning: palette.yellow,
	error: palette.red400,
	success: palette.green300,
	code: palette.yellow,
	background: palette.zinc950,
	sidebarBackground: palette.blue900,
	contentBackground: palette.zinc900,
	headerBackground: palette.slate800,
	footerBackground: palette.slate900,
	sidebarSectionText: palette.blue100,
	sidebarItemText: palette.blue200,
	sidebarItemActiveText: palette.slate900,
	sidebarItemActiveBackground: palette.slate300,
	sidebarBorder: palette.white,
	footerSeparator: palette.gray500,
	commandBarBackground: palette.zinc800,
	commandPrompt: palette.yellow200,
	sectionHeading: palette.slate200,
	sectionSubheading: palette.sky300,
	cardBorder: palette.slate500,
	cardBackground: palette.zinc800,
};

export const defaultThemeLayout: ThemeLayout = {
	sidebarWidth: 30,
	headerHeight: 2,
	footerHeight: 2,
	minColumns: 80,
	minRows: 24,
};

export const defaultThemeChrome: ThemeChrome = {
	borderGlyphSet: "single",
	panePaddingX: 1,
	panePaddingY: 0,
	framePaneGap: 1,
};

export const defaultTuiTheme: TuiTheme = {
	colors: defaultThemeColors,
	layout: defaultThemeLayout,
	chrome: defaultThemeChrome,
};
