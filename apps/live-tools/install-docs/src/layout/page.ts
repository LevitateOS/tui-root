import type { ContentBlock, DocsContent, InlineNode, RichText } from "@levitate/docs-content";
import { CONTENT_KEYS } from "../presentation/ink/keymap";
import {
	keyFor,
	appendRun,
	runsText,
	textWidth,
	wrapRuns,
	type Appearance,
	type ColorIntent,
	type RichTextRun,
	type ThemeColor,
} from "@levitate/tui-kit";
import { parseSyntaxTokenLine } from "./syntax-markup";

/**
 * A styled run of a laid-out page. `anchor` ties it to an action (a link or a
 * command); `selected` restyles it while that action is selected. Selection never
 * changes text width, so selecting something never moves the layout.
 */
export type Run = RichTextRun & { anchor?: number; selected?: Partial<RichTextRun> };
export type Line = Run[];

export type Anchor =
	| { kind: "link"; href: string; label: string; line: number }
	| { kind: "command"; command: string; line: number };

/** A page laid out for one width: what is drawn, counted and scrolled. */
export type PageLayout = { lines: Line[]; anchors: Anchor[] };

/** The reading measure: the widest a line of the page runs, however wide the pane is. */
export const MEASURE = 56;
/** A column wider than this wraps its cells instead. */
const MAX_TABLE_COLUMN = 32;
const LIST_INDENT = 2;
/** Columns between the cells of a table. */
const TABLE_GAP = 2;
/** The prompt's column and the command's, inside a command block. */
const PROMPT_COLUMN = 2;
const COMMAND_COLUMN = 4;
/** The surface of command and code blocks. */
const BLOCK = "panelBackground" as const;

class Page {
	/** The theme's mode: which of the docs build's two syntax colourings code is drawn in. */
	constructor(readonly appearance: Appearance) {}

	lines: Line[] = [];
	anchors: Anchor[] = [];

	/** Adds `line` behind `indent` spaces; anchors seen for the first time start here. */
	push(line: Line, indent = 0): void {
		const index = this.lines.length;
		for (const run of line) {
			const anchor = run.anchor === undefined ? undefined : this.anchors[run.anchor];
			if (anchor && anchor.line < 0) anchor.line = index;
		}
		this.lines.push(indent > 0 ? [{ text: " ".repeat(indent) }, ...line] : line);
	}

	anchor(anchor: Anchor): number {
		this.anchors.push(anchor);
		return this.anchors.length - 1;
	}
}

/** Inline docs text as runs; each link becomes an action. */
function inline(page: Page, content: string | RichText | undefined, intent: ColorIntent): Run[] {
	if (content === undefined) return [];
	if (typeof content === "string") return [{ text: content, intent }];
	const runs: Run[] = [];
	for (const node of content as InlineNode[]) {
		if (typeof node === "string") {
			appendRun(runs, { text: node, intent });
		} else if (node.type === "link") {
			const anchor = page.anchor({
				kind: "link",
				href: node.href.trim(),
				label: node.text.trim() || node.href,
				line: -1,
			});
			const selected = {
				intent: "linkActive",
				backgroundIntent: "linkActiveBackground",
				bold: true,
			} as const;
			runs.push({ text: node.text, intent: "link", underline: true, anchor, selected });
			if (node.href.trim().length > 0 && node.href !== node.text) {
				runs.push({
					text: ` (${node.href})`,
					intent: "link",
					anchor,
					selected: { ...selected, bold: false },
				});
			}
		} else if (node.type === "bold") {
			appendRun(runs, { text: node.text, intent, bold: true });
		} else if (node.type === "code") {
			appendRun(runs, { text: node.text, intent: "code" });
		} else {
			appendRun(runs, { text: node.text, intent, italic: true });
		}
	}
	return runs;
}

function padTo(line: Line, width: number, fill: Partial<Run> = {}): Line {
	const used = textWidth(runsText(line));
	return used >= width ? line : [...line, { ...fill, text: " ".repeat(width - used) }];
}

/** `prefix` then wrapped `runs`, continuation lines indented under the text. */
function prefixed(page: Page, prefix: Run, runs: Run[], width: number, indent: number): void {
	const lead = textWidth(prefix.text) + 1;
	wrapRuns(runs, Math.max(1, width - lead)).forEach((line, i) => {
		const head = i === 0 ? [prefix, { text: " " }] : [{ text: " ".repeat(lead) }];
		page.push([...head, ...(line as Line)], indent);
	});
}

const segmenter = new Intl.Segmenter();

/** Cuts runs into rows of `width` cells, keeping every space (code is not word-wrapped). */
function hardWrap(runs: readonly Run[], width: number): Line[] {
	const rows: Line[] = [[]];
	let used = 0;
	for (const run of runs) {
		for (const { segment } of segmenter.segment(run.text)) {
			const w = textWidth(segment);
			if (used > 0 && used + w > width) {
				rows.push([]);
				used = 0;
			}
			appendRun(rows.at(-1)!, { ...run, text: segment });
			used += w;
		}
	}
	return rows;
}

/** Tab stops in code, as in a terminal. */
const TAB_WIDTH = 8;

/**
 * Tabs as spaces up to the next tab stop, counted from the start of the line. A tab is
 * zero cells wide to Ink, and the terminal's own tab stops don't line up with the block.
 */
function expandTabs(runs: Run[]): Run[] {
	let column = 0;
	return runs.map((run) => {
		let text = "";
		for (const char of run.text) {
			if (char === "\t") {
				const spaces = TAB_WIDTH - (column % TAB_WIDTH);
				text += " ".repeat(spaces);
				column += spaces;
			} else {
				text += char;
				column += textWidth(char);
			}
		}
		return { ...run, text };
	});
}

/** `[[fg=…]]` markup when the docs build highlighted it, else the plain text. */
function codeRuns(
	highlighted: string | undefined,
	plain: string,
	color: ThemeColor | undefined,
): Run[] {
	if (highlighted === undefined) return expandTabs([{ text: plain, color }]);
	return expandTabs(
		parseSyntaxTokenLine(highlighted).map((token) => ({
			text: token.text,
			color: token.color ?? color,
		})),
	);
}

/** How a selected command or link is drawn: the selection bar. */
const SELECTED_BAR = {
	intent: "selection",
	color: undefined,
	backgroundIntent: "selectionBackground",
	background: undefined,
	bold: true,
} as const satisfies Partial<Run>;

/**
 * A command as a block of the darker surface behind a prompt. While selected, every row
 * is the selection bar, and the space after the last row says how to copy it (the line's
 * width never changes, so nothing reflows).
 */
function commandLines(
	page: Page,
	lines: readonly string[],
	width: number,
	indent: number,
	anchor?: number,
): void {
	const mark = (run: Run): Run =>
		anchor === undefined ? run : { ...run, anchor, selected: { ...SELECTED_BAR, ...run.selected } };
	const rows: Line[] = [];
	lines.forEach((text) => {
		hardWrap(
			expandTabs([{ text, intent: "highlight", backgroundIntent: BLOCK }]),
			Math.max(1, width - COMMAND_COLUMN - 1),
		).forEach((row, j) => {
			const head: Run[] =
				j === 0 && rows.length === 0
					? [
							{ text: " ".repeat(PROMPT_COLUMN), backgroundIntent: BLOCK },
							{ text: "$", intent: "accent", backgroundIntent: BLOCK, bold: true },
							{ text: " ".repeat(COMMAND_COLUMN - PROMPT_COLUMN - 1), backgroundIntent: BLOCK },
						]
					: [{ text: " ".repeat(COMMAND_COLUMN), backgroundIntent: BLOCK }];
			rows.push([...head, ...(row as Line)].map(mark));
		});
	});
	rows.forEach((row, r) => {
		const free = width - textWidth(runsText(row));
		const hint = r === rows.length - 1 ? copyHint(free) : "";
		const fill: Run = { text: " ".repeat(Math.max(0, free)), backgroundIntent: BLOCK };
		const padded =
			free > 0
				? [
						...row,
						anchor === undefined
							? fill
							: mark({ ...fill, selected: { text: hint + " ".repeat(free - hint.length) } }),
					]
				: row;
		page.push(padded, indent);
	});
}

/** The copy hint that fits in `free` cells after a selected command, or none. */
function copyHint(free: number): string {
	const key = keyFor(CONTENT_KEYS, "copy");
	return [` (${key} to copy)`, ` (${key})`].find((hint) => hint.length <= free) ?? "";
}

/** Data in columns: a quiet bold header, rows in the text colour, no lines between. */
function table(
	page: Page,
	block: Extract<ContentBlock, { type: "table" }>,
	width: number,
	indent: number,
): void {
	const header = block.headers.map((cell) =>
		inline(page, cell, "faintText").map((run) => ({ ...run, bold: true })),
	);
	// The monospace column (commands, paths) reads as code, as on the website.
	const rows = block.rows.map((row) =>
		row.map((cell, c) =>
			c === block.monospaceCol
				? inline(page, cell, "text").map((run) => ({ ...run, intent: "highlight" as const }))
				: inline(page, cell, "text"),
		),
	);
	const columns = Math.max(header.length, ...rows.map((row) => row.length));
	if (columns === 0) return;
	const natural = Array.from({ length: columns }, (_, c) =>
		Math.min(
			MAX_TABLE_COLUMN,
			Math.max(1, ...[header, ...rows].map((row) => textWidth(runsText(row[c] ?? [])))),
		),
	);
	const room = Math.max(columns, width - TABLE_GAP * (columns - 1));
	const total = natural.reduce((a, b) => a + b, 0);
	const widths =
		total <= room ? natural : natural.map((w) => Math.max(1, Math.floor((w * room) / total)));
	const emit = (cells: Run[][]) => {
		const wrapped = widths.map((w, c) => wrapRuns(cells[c] ?? [], w) as Line[]);
		const height = Math.max(...wrapped.map((lines) => lines.length));
		for (let r = 0; r < height; r += 1) {
			const line: Line = [];
			widths.forEach((w, c) => {
				if (c > 0) line.push({ text: " ".repeat(TABLE_GAP) });
				line.push(...padTo(wrapped[c]![r] ?? [], w));
			});
			page.push(line, indent);
		}
	};
	emit(header);
	rows.forEach(emit);
}

/** Code as a block of the darker surface: its language and file, then numbered lines. */
function code(
	page: Page,
	block: Extract<ContentBlock, { type: "code" }>,
	width: number,
	indent: number,
): void {
	const background = { backgroundIntent: BLOCK } as const;
	const source = block.content.split("\n");
	const digits = Math.max(2, String(source.length).length);
	const gutter = digits + 3;
	const codeWidth = Math.max(1, width - gutter - 1);
	const label = [block.language.toUpperCase(), block.filename].filter(Boolean).join(" · ");
	const row = (runs: Line) => page.push(padTo(runs, width, background), indent);
	row([
		{ text: " ", ...background },
		{ text: label, intent: "faintText", bold: true, ...background },
	]);
	if (block.content.length === 0) {
		row([
			{ text: " ".repeat(gutter), ...background },
			{ text: "(empty code block)", intent: "dimText", ...background },
		]);
		return;
	}
	source.forEach((plain, i) => {
		const rows = hardWrap(
			codeRuns(block.highlightedLines?.[page.appearance][i], plain, undefined),
			codeWidth,
		);
		rows.forEach((cells, j) => {
			const number = j === 0 ? String(i + 1).padStart(digits) : " ".repeat(digits);
			row([
				{ text: ` ${number}  `, intent: "faintText", ...background },
				...(cells as Line).map((run) => ({ intent: "text" as const, ...run, ...background })),
			]);
		});
	});
}

/** A note is plain text: quiet for information, in colour with a word for a warning. */
function note(
	page: Page,
	block: Extract<ContentBlock, { type: "note" }>,
	width: number,
	indent: number,
): void {
	const intent = ({ info: "dimText", warning: "warning", danger: "error" } as const)[block.variant];
	const lead: Run[] =
		block.variant === "info"
			? []
			: [{ text: `${block.variant === "danger" ? "Danger" : "Warning"}  `, intent, bold: true }];
	const content = [...lead, ...inline(page, block.content, intent)];
	for (const line of wrapRuns(content, width) as Line[]) page.push(line, indent);
}

/** Lays out one docs block at `indent`, in `width` columns counted from the pane's edge. */
function layoutBlock(page: Page, block: ContentBlock, width: number, indent: number): void {
	const w = Math.max(1, width - indent);
	switch (block.type) {
		case "text":
			for (const line of wrapRuns(inline(page, block.content, "info"), w)) page.push(line, indent);
			return;
		case "code":
			return code(page, block, w, indent);
		case "command": {
			for (const line of wrapRuns([{ text: block.description, intent: "info" }], w))
				page.push(line, indent);
			const plain = Array.isArray(block.command) ? block.command : block.command.split("\n");
			const anchor = page.anchor({ kind: "command", command: plain.join("\n"), line: -1 });
			commandLines(page, plain, w, indent, anchor);
			if (block.output) {
				for (const line of block.output.split("\n")) {
					for (const row of wrapRuns([{ text: line, intent: "dimText" }], w))
						page.push(row, indent);
				}
			}
			return;
		}
		case "table":
			return table(page, block, w, indent);
		case "list":
			block.items.forEach((item, i) => {
				const marker: Run = { text: block.ordered ? `${i + 1}.` : "•", intent: "accent" };
				const text = typeof item === "string" || Array.isArray(item) ? item : item.text;
				prefixed(page, marker, inline(page, text, "info"), w, indent);
				if (typeof item === "object" && !Array.isArray(item)) {
					for (const child of item.children ?? []) {
						prefixed(
							page,
							{ text: "•", intent: "faintText" },
							inline(page, child, "dimText"),
							w - LIST_INDENT,
							indent + LIST_INDENT,
						);
					}
				}
			});
			return;
		case "interactive":
			if (block.intro) {
				for (const line of wrapRuns(inline(page, block.intro, "info"), w)) page.push(line, indent);
			}
			for (const step of block.steps) {
				// Each step's command can be selected and copied, like a command block's.
				const anchor = page.anchor({ kind: "command", command: step.command, line: -1 });
				commandLines(page, [step.command], w, indent, anchor);
				for (const line of wrapRuns(inline(page, step.description, "info"), w))
					page.push(line, indent);
			}
			return;
		case "qa":
			block.items.forEach((item, i) => {
				if (i > 0) page.push([]);
				page.push([{ text: "Q", intent: "accent", bold: true }], indent);
				for (const line of wrapRuns(
					inline(page, item.question, "text").map((run) => ({ ...run, bold: true })),
					Math.max(1, w - LIST_INDENT),
				)) {
					page.push(line, indent + LIST_INDENT);
				}
				page.push([{ text: "A", intent: "dimText", bold: true }], indent);
				if (item.answer.length === 0) {
					page.push([{ text: "(no answer provided)", intent: "dimText" }], indent + LIST_INDENT);
				}
				for (const answer of item.answer) layoutBlock(page, answer, width, indent + LIST_INDENT);
			});
			return;
		case "note":
			return note(page, block, w, indent);
	}
}

/** A section title: a leading "2." as a number in the accent, the words in bold. */
function sectionTitle(title: string, level: number | undefined): Line {
	const numbered = /^(\d+)\.\s+(.*)$/.exec(title);
	if (numbered) {
		return [
			{ text: numbered[1]!, intent: "accent", bold: true },
			{ text: `  ${numbered[2]}`, intent: "text", bold: true },
		];
	}
	return [{ text: title, intent: level === 3 ? "info" : "text", bold: true }];
}

/**
 * The whole page at the reading measure (or `width`, when that is narrower): intro, then
 * each section's title and blocks, one blank line between blocks. Code is coloured for
 * the theme's `appearance`.
 */
export function layoutPage(
	content: DocsContent,
	columns: number,
	appearance: Appearance,
): PageLayout {
	const width = Math.min(columns, MEASURE);
	const page = new Page(appearance);
	const gap = () => {
		if (page.lines.length > 0) page.push([]);
	};
	const intro = inline(page, content.intro, "info");
	if (runsText(intro).trim().length > 0) {
		for (const line of wrapRuns(intro, width)) page.push(line);
	}
	for (const section of content.sections) {
		gap();
		page.push(sectionTitle(section.title, section.level));
		section.content.forEach((item, i) => {
			if (i > 0) gap();
			layoutBlock(page, item, width, 0);
		});
	}
	return { lines: page.lines, anchors: page.anchors };
}
