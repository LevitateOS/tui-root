import type { ColorIntent, ThemeColor, TuiTheme } from "./tokens";

/**
 * Whether the app draws colour at all. How many colours the terminal has is chalk's
 * business (Ink colours text through it, and it reads TERM/COLORTERM/FORCE_COLOR);
 * chalk does not read NO_COLOR, so this does.
 */
export type ColorRuntime = {
	enabled: boolean;
};

/** https://no-color.org: a non-empty NO_COLOR turns colour off. */
export function detectColorRuntime(env: Record<string, string | undefined>): ColorRuntime {
	return { enabled: !env.NO_COLOR };
}

/** `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha dropped) as lower-case `#rrggbb`, or undefined. */
export function parseHexColor(input: string): `#${string}` | undefined {
	const value = input.trim().toLowerCase();
	if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)) {
		return value.slice(0, 7) as `#${string}`;
	}
	if (/^#[0-9a-f]{3}$/.test(value)) {
		const [, r, g, b] = value;
		return `#${r}${r}${g}${g}${b}${b}`;
	}
	return undefined;
}

/** A colour for Ink's `color`/`backgroundColor`: hex, or undefined for "no colour". */
export function resolveColor(
	color: ThemeColor | string | undefined,
	runtime: ColorRuntime,
): string | undefined {
	if (!runtime.enabled || color === undefined || color === "inherit") {
		return undefined;
	}
	return parseHexColor(color);
}

export function resolveIntentColor(
	theme: TuiTheme,
	intent: ColorIntent,
	runtime: ColorRuntime,
): string | undefined {
	return resolveColor(theme.colors[intent], runtime);
}

/** The colour `share` of the way from `from` to `to` (0 is `from`, 1 is `to`). */
export function mixColors(from: string, to: string, share: number): string {
	const part = (hex: string, i: number) => Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
	const t = Math.min(1, Math.max(0, share));
	return `#${[0, 1, 2]
		.map((i) =>
			Math.round(part(from, i) + (part(to, i) - part(from, i)) * t)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}
