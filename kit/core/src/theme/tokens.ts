import type { BorderStyle } from "../chrome/glyphs";
import type { Palette } from "./palette";

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
	/** Text on a filled accent, second accent or status colour: the surface colour, which
	 * contrasts with each of them (the accents are light, the surface dark). */
	| "onFill"
	// the two-pane frame
	| "navBorder"
	| "contentBorder"
	| "navBackground"
	| "contentBackground"
	| "footerBackground"
	/** The header band's colour at its start; it fades into the nav background. */
	| "band"
	/** Text on the band's own colour, where the fade has not left it yet. */
	| "onBand"
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

/** Every colour of a theme, from one palette. */
export function paletteColors(p: Palette): ThemeColors {
	return {
		text: p.text,
		dimText: p.textMuted,
		faintText: p.textMuted,
		accent: p.accent,
		heading: p.text,
		subheading: p.accent,
		code: p.highlight,
		info: p.textSecondary,
		warning: p.warn,
		error: p.bad,
		success: p.ok,
		highlight: p.highlight,
		link: p.accent,
		linkActive: p.surface,
		linkActiveBackground: p.accent,
		onFill: p.surface,
		navBorder: p.rule,
		contentBorder: p.hairline,
		navBackground: p.surface,
		contentBackground: p.surfaceSunken,
		footerBackground: p.surface,
		band: p.band,
		onBand: p.onBand,
		raisedBackground: p.surfaceRaised,
		navHeading: p.textMuted,
		navItem: p.textSecondary,
		selection: p.surface,
		selectionBackground: p.accent,
		panelBorder: p.rule,
		panelBackground: p.surface,
	};
}

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
