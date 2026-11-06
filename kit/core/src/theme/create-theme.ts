import {
	defaultThemeChrome,
	defaultThemeColors,
	defaultThemeLayout,
	type ThemeChrome,
	type ThemeColorsOverride,
	type ThemeLayout,
	type TuiTheme,
} from "./tokens";

/** The default theme with an app's overrides on top. */
export function createTheme(
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
): TuiTheme {
	return {
		colors: { ...defaultThemeColors, ...colors },
		layout: { ...defaultThemeLayout, ...layout },
		chrome: { ...defaultThemeChrome, ...chrome },
	};
}
