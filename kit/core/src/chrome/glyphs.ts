import type { BoxProps } from "ink";

/** The one border-style name set, used by the theme, frames and Ink boxes. */
export type BorderStyle = "single" | "double" | "round" | "bold";

/** Box-drawing glyphs: horizontal, vertical, corners, side tees and cross. */
export type Glyphs = {
	h: string;
	v: string;
	tl: string;
	tr: string;
	bl: string;
	br: string;
	/** ├ and ┤: a divider meeting the left and right sides. */
	l: string;
	r: string;
	/** ┼: a divider crossing a vertical line. */
	x: string;
};

const SINGLE: Glyphs = {
	h: "─",
	v: "│",
	tl: "┌",
	tr: "┐",
	bl: "└",
	br: "┘",
	l: "├",
	r: "┤",
	x: "┼",
};

const GLYPHS: Record<BorderStyle, Glyphs> = {
	single: SINGLE,
	round: { ...SINGLE, tl: "╭", tr: "╮", bl: "╰", br: "╯" },
	bold: { h: "━", v: "┃", tl: "┏", tr: "┓", bl: "┗", br: "┛", l: "┣", r: "┫", x: "╋" },
	double: { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝", l: "╠", r: "╣", x: "╬" },
};

export function glyphs(style: BorderStyle): Glyphs {
	return GLYPHS[style];
}

type InkBoxStyle = Exclude<NonNullable<BoxProps["borderStyle"]>, string>;

/** The same glyphs as an Ink `borderStyle`, so text-drawn rows and Ink borders meet exactly. */
function toInkBoxStyle(g: Glyphs): InkBoxStyle {
	return {
		topLeft: g.tl,
		top: g.h,
		topRight: g.tr,
		right: g.v,
		bottomRight: g.br,
		bottom: g.h,
		bottomLeft: g.bl,
		left: g.v,
	};
}

// One object per glyph set, never a new one per render: when Ink sees `borderStyle`
// change on a re-render it turns every border edge back on except those set to false in
// the same update, so a box with `borderTop={false}` grows its top border back (a blank
// row, the contents pushed down).
const INK_BOX_STYLES = Object.fromEntries(
	Object.entries(GLYPHS).map(([name, g]) => [name, toInkBoxStyle(g)]),
) as Record<BorderStyle, InkBoxStyle>;

export function inkBorderStyle(style: BorderStyle): InkBoxStyle {
	return INK_BOX_STYLES[style];
}
