import type { Palette } from "./palette";
import {
	defaultThemeChrome,
	defaultThemeLayout,
	paletteColors,
	type ThemeChrome,
	type ThemeColorsOverride,
	type ThemeLayout,
	type TuiTheme,
} from "./tokens";

/** What sets one product's apps apart from another's: its name and its whole palette. */
export type Brand = {
	/** Named at the start of the header band; empty names nobody. */
	name: string;
	palette: Palette;
};

/** The theme in a brand's colours, with an app's overrides on top. */
export function brandTheme(
	brand: Brand,
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
): TuiTheme {
	return {
		brand: brand.name,
		colors: { ...paletteColors(brand.palette), ...colors },
		layout: { ...defaultThemeLayout, ...layout },
		chrome: { ...defaultThemeChrome, ...chrome },
	};
}
