import type { BorderStyle } from "../chrome/glyphs";
import { palette } from "./palette";

/**
 * A theme colour: `#rrggbb`, or `"inherit"` to leave the terminal's own colour.
 * Ink hands hex to chalk, which converts it to whatever the terminal supports
 * (256 or 16 colours, or none), so a theme states each colour once.
 */
export type ThemeColor = `#${string}` | "inherit";

export type ColorIntent =
	// text
	| "text"
	| "dimText"
	| "accent"
	| "heading"
	| "subheading"
	| "code"
	| "info"
	| "warning"
	| "error"
	| "success"
	// links
	| "link"
	| "linkActive"
	| "linkActiveBackground"
	// the two-pane frame
	| "navBorder"
	| "contentBorder"
	| "navBackground"
	| "contentBackground"
	| "footerBackground"
	// navigation lists
	| "navHeading"
	| "navItem"
	| "selection"
	| "selectionBackground"
	// boxed blocks inside a pane
	| "panelBorder"
	| "panelBackground";

type ThemeColors = Record<ColorIntent, ThemeColor>;

export type ThemeColorsOverride = Partial<ThemeColors>;

export type ThemeLayout = {
	/** Outer width of the nav pane. */
	navWidth: number;
	/** Narrower terminals show one pane at a time. */
	minColumns: number;
};

export type ThemeChrome = {
	borderGlyphSet: BorderStyle;
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
	text: palette.gray200,
	dimText: palette.slate400,
	accent: palette.sky300,
	heading: palette.slate200,
	subheading: palette.sky300,
	code: palette.yellow,
	info: palette.blue300,
	warning: palette.yellow,
	error: palette.red400,
	success: palette.green300,
	link: palette.sky300,
	linkActive: palette.slate900,
	linkActiveBackground: palette.slate300,
	navBorder: palette.white,
	contentBorder: palette.slate500,
	navBackground: palette.blue900,
	contentBackground: palette.zinc900,
	footerBackground: palette.slate900,
	navHeading: palette.blue100,
	navItem: palette.blue200,
	selection: palette.slate900,
	selectionBackground: palette.slate300,
	panelBorder: palette.slate500,
	panelBackground: palette.zinc800,
};

export const defaultThemeLayout: ThemeLayout = {
	navWidth: 30,
	minColumns: 80,
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
