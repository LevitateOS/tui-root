import { toPositiveInt } from "../utils/clamp";

import {
	defaultThemeChrome,
	defaultThemeColors,
	defaultThemeLayout,
	type ThemeChrome,
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

export function createTheme(
	colors: ThemeColorsOverride = {},
	layout: Partial<ThemeLayout> = {},
	chrome: Partial<ThemeChrome> = {},
): TuiTheme {
	return {
		colors: { ...defaultThemeColors, ...colors },
		layout: normalizeThemeLayout(layout),
		chrome: normalizeThemeChrome(chrome),
	};
}
