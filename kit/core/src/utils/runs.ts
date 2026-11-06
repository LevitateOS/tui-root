import type { ColorIntent, ThemeColor } from "../theme/tokens";
import { textWidth, truncateLine } from "./strings";

/** A stretch of text in one style: the one styled-text type every component and app uses. */
export type RichTextRun = {
	text: string;
	intent?: ColorIntent;
	/** A literal colour; wins over `intent`. */
	color?: ThemeColor;
	backgroundIntent?: ColorIntent;
	/** A literal background; wins over `backgroundIntent`. */
	background?: ThemeColor;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
};

/** Same style: every field but the text agrees (so a new style field needs no edit here). */
function sameStyle(a: RichTextRun, b: RichTextRun): boolean {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	keys.delete("text");
	for (const key of keys) {
		if (a[key as keyof RichTextRun] !== b[key as keyof RichTextRun]) return false;
	}
	return true;
}

/** Appends `run`, merging it into the last run when the style matches. */
export function appendRun(target: RichTextRun[], run: RichTextRun): void {
	if (run.text.length === 0) return;
	const last = target.at(-1);
	if (last && sameStyle(last, run)) {
		last.text += run.text;
		return;
	}
	target.push({ ...run });
}

export function runsText(runs: ReadonlyArray<RichTextRun>): string {
	return runs.map((run) => run.text).join("");
}

type Word = { runs: RichTextRun[]; width: number };

const segmenter = new Intl.Segmenter();

function* graphemes(run: RichTextRun): Generator<RichTextRun> {
	for (const { segment } of segmenter.segment(run.text)) yield { ...run, text: segment };
}

function words(runs: ReadonlyArray<RichTextRun>): Word[] {
	const out: Word[] = [];
	let current: Word = { runs: [], width: 0 };
	const flush = () => {
		if (current.width > 0) out.push(current);
		current = { runs: [], width: 0 };
	};
	for (const run of runs) {
		for (const piece of graphemes(run)) {
			if (/^\s+$/.test(piece.text)) {
				flush();
				continue;
			}
			appendRun(current.runs, piece);
			current.width += textWidth(piece.text);
		}
	}
	flush();
	return out;
}

/** Splits a word wider than `width` into pieces that fit. */
function chunk(word: Word, width: number): Word[] {
	if (word.width <= width) return [word];
	const out: Word[] = [];
	let current: Word = { runs: [], width: 0 };
	for (const run of word.runs) {
		for (const piece of graphemes(run)) {
			const w = textWidth(piece.text);
			if (current.width > 0 && current.width + w > width) {
				out.push(current);
				current = { runs: [], width: 0 };
			}
			appendRun(current.runs, piece);
			current.width += w;
		}
	}
	if (current.width > 0) out.push(current);
	return out;
}

/**
 * Word-wraps styled text to `width` terminal cells: `\n` starts a new line, runs of
 * whitespace become one space, words wider than a line are split.
 */
export function wrapRuns(runs: ReadonlyArray<RichTextRun>, width: number): RichTextRun[][] {
	const safe = Math.max(1, Math.floor(width) || 1);
	const paragraphs: RichTextRun[][] = [[]];
	for (const run of runs) {
		run.text.split("\n").forEach((text, i) => {
			if (i > 0) paragraphs.push([]);
			appendRun(paragraphs.at(-1)!, { ...run, text });
		});
	}
	const lines: RichTextRun[][] = [];
	for (const paragraph of paragraphs) {
		let line: RichTextRun[] = [];
		let used = 0;
		for (const word of words(paragraph).flatMap((w) => chunk(w, safe))) {
			if (used > 0 && used + 1 + word.width > safe) {
				lines.push(line);
				line = [];
				used = 0;
			}
			if (used > 0) {
				appendRun(line, { text: " " });
				used += 1;
			}
			for (const run of word.runs) appendRun(line, run);
			used += word.width;
		}
		lines.push(line);
	}
	return lines;
}

/** The first `max` lines of `text`, then "... (n more lines)" if any were cut. */
export function truncateLines(text: string, max: number): string {
	const lines = text.split("\n");
	if (lines.length <= max) return text;
	return [...lines.slice(0, max), `... (${lines.length - max} more lines)`].join("\n");
}

/** Word-wraps plain text to `width` cells (see `wrapRuns`). */
export function wrapText(text: string, width: number): string[] {
	return wrapRuns([{ text }], width).map(runsText);
}

/** Wraps `text` after `prefix ` and indents continuation lines to line up under it. */
export function prefixWrappedText(prefix: string, text: string, width: number): string[] {
	const safe = Math.max(1, Math.floor(width) || 1);
	const lead = prefix.length > 0 ? `${prefix} ` : "";
	const indent = " ".repeat(textWidth(lead));
	return wrapText(text, Math.max(1, safe - textWidth(lead))).map((line, index) =>
		truncateLine(`${index === 0 ? lead : indent}${line}`, safe),
	);
}
