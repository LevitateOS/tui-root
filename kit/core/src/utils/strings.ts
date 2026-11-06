import stringWidth from "string-width";

/**
 * Text is measured in terminal cells with `string-width`, the same model Ink lays
 * out with, so wide and combining characters truncate, pad and wrap where Ink draws them.
 */
export function textWidth(text: string): number {
	return stringWidth(text);
}

const segmenter = new Intl.Segmenter();

function graphemes(text: string): string[] {
	return Array.from(segmenter.segment(text), (part) => part.segment);
}

function cells(width: number): number {
	return Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
}

/** The longest prefix of `text` that fits in `width` cells. */
function takeWidth(text: string, width: number): string {
	let out = "";
	let used = 0;
	for (const g of graphemes(text)) {
		const w = stringWidth(g);
		if (used + w > width) break;
		out += g;
		used += w;
	}
	return out;
}

export function truncateLine(text: string, width: number): string {
	const safe = cells(width);
	if (textWidth(text) <= safe) return text;
	if (safe === 0) return "";
	return `${takeWidth(text, safe - 1)}…`;
}

export function padRight(text: string, width: number): string {
	const safe = cells(width);
	const fitted = takeWidth(text, safe);
	return fitted + " ".repeat(safe - textWidth(fitted));
}

/** The message of a thrown value, whatever was thrown. */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
