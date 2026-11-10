import chalk from "chalk";
import type { ColorIntent, ThemeColor, TuiTheme } from "./tokens";

/**
 * Whether the app draws colour at all, and how many colours the terminal has. chalk
 * (which Ink colours text through) works the second out from TERM/COLORTERM/FORCE_COLOR;
 * it does not read NO_COLOR, so this does.
 */
export type ColorRuntime = {
	enabled: boolean;
	/** `256` when the terminal has no 24-bit colour: the theme's colours are then matched
	 * to its palette here, since chalk's own conversion turns the dark greens teal. */
	depth: "truecolor" | "256";
};

/** https://no-color.org: a non-empty NO_COLOR turns colour off. */
export function detectColorRuntime(env: Record<string, string | undefined>): ColorRuntime {
	return { enabled: !env.NO_COLOR, depth: chalk.level >= 3 ? "truecolor" : "256" };
}

/** The 256-colour palette past the first 16: a 6x6x6 cube, then 24 greys. */
const CUBE = [0, 95, 135, 175, 215, 255];
const PALETTE: [number, number, number][] = [
	...CUBE.flatMap((r) => CUBE.flatMap((g) => CUBE.map((b): [number, number, number] => [r, g, b]))),
	...Array.from({ length: 24 }, (_, i): [number, number, number] => [
		8 + 10 * i,
		8 + 10 * i,
		8 + 10 * i,
	]),
];

/** The palette index (16..255) of the colour nearest `hex`. */
export function nearest256(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
		number,
		number,
		number,
	];
	let best = 0;
	let least = Infinity;
	PALETTE.forEach(([pr, pg, pb], i) => {
		const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
		if (distance < least) {
			least = distance;
			best = i;
		}
	});
	return 16 + best;
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

/** A colour for Ink's `color`/`backgroundColor`: hex, the nearest palette colour on a
 * 256-colour terminal, or undefined for "no colour". */
export function resolveColor(
	color: ThemeColor | string | undefined,
	runtime: ColorRuntime,
): string | undefined {
	if (!runtime.enabled || color === undefined || color === "inherit") {
		return undefined;
	}
	const hex = parseHexColor(color);
	return hex && runtime.depth === "256" ? `ansi256(${nearest256(hex)})` : hex;
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
