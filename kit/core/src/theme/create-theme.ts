import {
	defaultThemeChrome,
	defaultThemeColors,
	defaultThemeLayout,
	type ThemeChrome,
	type ThemeColor,
	type ThemeColorsOverride,
	type ThemeLayout,
	type TuiTheme,
} from "./tokens";

/** The default theme with an app's overrides on top. */
export function createTheme(
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
	brand = "",
): TuiTheme {
	return {
		brand,
		colors: { ...defaultThemeColors, ...colors },
		layout: { ...defaultThemeLayout, ...layout },
		chrome: { ...defaultThemeChrome, ...chrome },
	};
}

/** What sets one product's apps apart from another's: its name and three colours. */
export type Brand = {
	name: string;
	/** The colour of what is selected, current or yours to press. */
	accent: ThemeColor;
	/** The second accent (see the `highlight` intent). */
	highlight: ThemeColor;
	/** The header band's colour. */
	band: ThemeColor;
};

/** The default theme in a brand's colours, with an app's overrides on top. */
export function brandTheme(
	brand: Brand,
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
): TuiTheme {
	return createTheme(
		{
			accent: brand.accent,
			subheading: brand.accent,
			link: brand.accent,
			linkActiveBackground: brand.accent,
			selectionBackground: brand.accent,
			highlight: brand.highlight,
			band: brand.band,
			...colors,
		},
		layout,
		chrome,
		brand.name,
	);
}
