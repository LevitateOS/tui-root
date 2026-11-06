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

export function horizontalRule(width: number, char = "─"): string {
	return char.repeat(cells(width));
}

/** Splits a word that is wider than `width` into pieces that fit. */
function chunkWord(word: string, width: number): string[] {
	const chunks: string[] = [];
	let rest = word;
	while (textWidth(rest) > width) {
		const piece = takeWidth(rest, width) || graphemes(rest)[0];
		chunks.push(piece);
		rest = rest.slice(piece.length);
	}
	return rest.length > 0 ? [...chunks, rest] : chunks;
}

/** Word-wraps `text` to `width` cells; `\n` starts a new line. */
export function wrapText(text: string, width: number): string[] {
	const safe = Math.max(1, cells(width));
	const output: string[] = [];
	for (const line of text.split("\n")) {
		let current = "";
		for (const word of line.split(/\s+/).filter((w) => w.length > 0)) {
			for (const chunk of chunkWord(word, safe)) {
				const candidate = current.length === 0 ? chunk : `${current} ${chunk}`;
				if (textWidth(candidate) <= safe) {
					current = candidate;
				} else {
					output.push(current);
					current = chunk;
				}
			}
		}
		output.push(current);
	}
	return output;
}

/** Wraps `text` after `prefix ` and indents continuation lines to line up under it. */
export function prefixWrappedText(prefix: string, text: string, width: number): string[] {
	const safe = Math.max(1, cells(width));
	const lead = prefix.length > 0 ? `${prefix} ` : "";
	const indent = " ".repeat(textWidth(lead));
	return wrapText(text, Math.max(1, safe - textWidth(lead))).map((line, index) =>
		truncateLine(`${index === 0 ? lead : indent}${line}`, safe),
	);
}
