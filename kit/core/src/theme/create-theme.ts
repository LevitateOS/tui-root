import { toPositiveInt } from "../utils/clamp";

import { normalizeColorValue } from "./colors";
import {
	defaultThemeChrome,
	defaultThemeColors,
	defaultThemeLayout,
	type ColorIntent,
	type ThemeChrome,
	type ThemeColorOverride,
	type ThemeColors,
	type ThemeColorsOverride,
	type ThemeLayout,
	type TuiTheme,
} from "./tokens";

function normalizeThemeLayout(layout: Partial<ThemeLayout>): ThemeLayout {
	const candidate: ThemeLayout = {
		sidebarWidth: toPositiveInt(
			layout.sidebarWidth ?? defaultThemeLayout.sidebarWidth,
			defaultThemeLayout.sidebarWidth,
		),
		headerHeight: toPositiveInt(
			layout.headerHeight ?? defaultThemeLayout.headerHeight,
			defaultThemeLayout.headerHeight,
		),
		footerHeight: toPositiveInt(
			layout.footerHeight ?? defaultThemeLayout.footerHeight,
			defaultThemeLayout.footerHeight,
		),
		minColumns: toPositiveInt(
			layout.minColumns ?? defaultThemeLayout.minColumns,
			defaultThemeLayout.minColumns,
		),
		minRows: toPositiveInt(
			layout.minRows ?? defaultThemeLayout.minRows,
			defaultThemeLayout.minRows,
		),
	};

	const minRowsNeeded = candidate.headerHeight + candidate.footerHeight + 1;
	if (candidate.minRows < minRowsNeeded) {
		candidate.minRows = minRowsNeeded;
	}

	const minColumnsNeeded = candidate.sidebarWidth + 1;
	if (candidate.minColumns < minColumnsNeeded) {
		candidate.minColumns = minColumnsNeeded;
	}

	return candidate;
}

function normalizeThemeChrome(chrome: Partial<ThemeChrome> = {}): ThemeChrome {
	const safePaddingX = Number.isFinite(chrome.panePaddingX)
		? Math.max(0, Math.floor(chrome.panePaddingX ?? 0))
		: defaultThemeChrome.panePaddingX;
	const safePaddingY = Number.isFinite(chrome.panePaddingY)
		? Math.max(0, Math.floor(chrome.panePaddingY ?? 0))
		: defaultThemeChrome.panePaddingY;
	const safeFramePaneGap = Number.isFinite(chrome.framePaneGap)
		? Math.max(0, Math.floor(chrome.framePaneGap ?? 0))
		: defaultThemeChrome.framePaneGap;

	return {
		borderGlyphSet:
			chrome.borderGlyphSet === "double" ||
			chrome.borderGlyphSet === "round" ||
			chrome.borderGlyphSet === "bold" ||
			chrome.borderGlyphSet === "single"
				? chrome.borderGlyphSet
				: defaultThemeChrome.borderGlyphSet,
		panePaddingX: safePaddingX,
		panePaddingY: safePaddingY,
		framePaneGap: safeFramePaneGap,
	};
}

function normalizeColorOverride(
	intent: ColorIntent,
	overrides: ThemeColorsOverride,
	fallback: ThemeColors,
): ThemeColors[ColorIntent] {
	const base = fallback[intent];
	const override = overrides[intent] as ThemeColorOverride | undefined;
	return normalizeColorValue(override, base);
}

function normalizeThemeColors(
	colors: ThemeColorsOverride = {},
	fallback: ThemeColors = defaultThemeColors,
): ThemeColors {
	return {
		border: normalizeColorOverride("border", colors, fallback),
		text: normalizeColorOverride("text", colors, fallback),
		dimText: normalizeColorOverride("dimText", colors, fallback),
		accent: normalizeColorOverride("accent", colors, fallback),
		linkText: normalizeColorOverride("linkText", colors, fallback),
		linkActiveText: normalizeColorOverride("linkActiveText", colors, fallback),
		linkActiveBackground: normalizeColorOverride("linkActiveBackground", colors, fallback),
		info: normalizeColorOverride("info", colors, fallback),
		warning: normalizeColorOverride("warning", colors, fallback),
		error: normalizeColorOverride("error", colors, fallback),
		success: normalizeColorOverride("success", colors, fallback),
		background: normalizeColorOverride("background", colors, fallback),
		sidebarBackground: normalizeColorOverride("sidebarBackground", colors, fallback),
		contentBackground: normalizeColorOverride("contentBackground", colors, fallback),
		headerBackground: normalizeColorOverride("headerBackground", colors, fallback),
		footerBackground: normalizeColorOverride("footerBackground", colors, fallback),
		sidebarSectionText: normalizeColorOverride("sidebarSectionText", colors, fallback),
		sidebarItemText: normalizeColorOverride("sidebarItemText", colors, fallback),
		sidebarItemActiveText: normalizeColorOverride("sidebarItemActiveText", colors, fallback),
		sidebarItemActiveBackground: normalizeColorOverride(
			"sidebarItemActiveBackground",
			colors,
			fallback,
		),
		sidebarBorder: normalizeColorOverride("sidebarBorder", colors, fallback),
		footerSeparator: normalizeColorOverride("footerSeparator", colors, fallback),
		commandBarBackground: normalizeColorOverride("commandBarBackground", colors, fallback),
		commandPrompt: normalizeColorOverride("commandPrompt", colors, fallback),
		sectionHeading: normalizeColorOverride("sectionHeading", colors, fallback),
		sectionSubheading: normalizeColorOverride("sectionSubheading", colors, fallback),
		cardBorder: normalizeColorOverride("cardBorder", colors, fallback),
		cardBackground: normalizeColorOverride("cardBackground", colors, fallback),
	};
}

export function createTheme(
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
): TuiTheme {
	return {
		colors: normalizeThemeColors(colors),
		layout: normalizeThemeLayout(layout),
		chrome: normalizeThemeChrome(chrome),
	};
}
