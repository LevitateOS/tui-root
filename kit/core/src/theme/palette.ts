import type { ThemeColor } from "./tokens";

/** The mode a theme is drawn in: its surfaces are light or dark. */
export type Appearance = "light" | "dark";

/**
 * One mode's colours, as `#rrggbb`: the only colours a theme is made of. Each distro
 * declares one per mode in its `distro.toml` (`[look.light]`, `[look.dark]`), and
 * `@levitate/docs-content`'s `brandOf` hands the one for its starting mode to `brandTheme`.
 */
export type Palette = {
	/** The base surface: the nav pane, panels, the footer. */
	surface: HexColor;
	/** A row or field lifted off the surface. */
	surfaceRaised: HexColor;
	/** The content pane: the surface's other side from the raised one. */
	surfaceSunken: HexColor;
	/** Text, and the strongest. */
	text: HexColor;
	textSecondary: HexColor;
	/** The quietest text: hints, labels, comments. */
	textMuted: HexColor;
	/** Rules and frames, then the quieter lines. */
	rule: HexColor;
	hairline: HexColor;
	/** The colour of what is selected, current or yours to press. Text on it is `surface`. */
	accent: HexColor;
	/** The second accent. Text on it is `surface`. */
	highlight: HexColor;
	/** The header band's colour; text on it is `onBand`. */
	band: HexColor;
	onBand: HexColor;
	/** Status colours; text on a fill of them is `surface`. */
	ok: HexColor;
	warn: HexColor;
	bad: HexColor;
};

type HexColor = Extract<ThemeColor, `#${string}`>;
