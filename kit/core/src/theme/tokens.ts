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
	/** The quietest text: small titles over groups, hints at a row's end, a field's label. */
	| "faintText"
	| "accent"
	| "heading"
	| "subheading"
	| "code"
	| "info"
	| "warning"
	| "error"
	| "success"
	/** A second accent: the letters a search matched, a pin on a map. */
	| "highlight"
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
	/** The header band's colour at its start; it fades into the nav background. */
	| "band"
	/** A row or field lifted off its pane: the step you are at, a search field. */
	| "raisedBackground"
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
	/** Whose app this is, named at the start of the header band; empty names nobody. */
	brand: string;
	colors: ThemeColors;
	layout: ThemeLayout;
	chrome: ThemeChrome;
};

export const defaultThemeColors: ThemeColors = {
	text: palette.paper,
	dimText: palette.lichen,
	faintText: palette.gutter,
	accent: palette.sage,
	heading: palette.paper,
	subheading: palette.sage,
	code: palette.sand,
	info: palette.moss,
	warning: palette.sand,
	error: palette.salmon,
	success: palette.leaf,
	highlight: palette.sand,
	link: palette.sage,
	linkActive: palette.night,
	linkActiveBackground: palette.sage,
	navBorder: palette.rule,
	contentBorder: palette.hairline,
	navBackground: palette.ink,
	contentBackground: palette.night,
	footerBackground: palette.ink,
	band: palette.pine,
	raisedBackground: palette.raised,
	navHeading: palette.lichen,
	navItem: palette.moss,
	selection: palette.night,
	selectionBackground: palette.sage,
	panelBorder: palette.rule,
	panelBackground: palette.ink,
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
	brand: "",
	colors: defaultThemeColors,
	layout: defaultThemeLayout,
	chrome: defaultThemeChrome,
};
