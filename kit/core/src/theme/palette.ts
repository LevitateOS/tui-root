/**
 * The kit's colours, referenced by name from the default theme. They are the website's
 * (docs/website: the Field Notes code and dark-surface tokens), so a screenshot of an
 * app sits on a page as part of it.
 */
export const palette = {
	/** Text on the dark surfaces. */
	paper: "#f2eee4",
	/** Secondary text. */
	moss: "#bac5b7",
	lichen: "#9aa89d",
	gutter: "#6e7f73",
	/** Rules and frames, quiet to quieter. */
	rule: "#3a4b40",
	hairline: "#2a3b31",
	/** Surfaces, raised to base. */
	raised: "#1d2d24",
	ink: "#14221a",
	night: "#0d1711",
	/** LevitateOS's accent, and AcornOS's. */
	sage: "#c7d9ba",
	sand: "#e4cba6",
	/** The website's pine, LevitateOS's band. */
	pine: "#214438",
	leaf: "#a9cf9a",
	salmon: "#f0a497",
} as const satisfies Record<string, `#${string}`>;
