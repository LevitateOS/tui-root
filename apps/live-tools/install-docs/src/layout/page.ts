import type { ContentBlock, DocsContent, InlineNode, RichText } from "@levitate/docs-content";
import {
	appendRun,
	runsText,
	textWidth,
	truncateLine,
	wrapRuns,
	type ColorIntent,
	type RichTextRun,
	type ThemeColor,
} from "@levitate/tui-kit";
import { parseSyntaxTokenLine } from "./syntax-markup";
import {
	COMMAND_COLORS,
	DOCS_GLYPHS,
	MARKERS,
	NOTE_COLORS,
	NOTE_GLYPHS,
} from "../presentation/ink/theme/index";

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

/** A column wider than this wraps its cells instead. */
const MAX_TABLE_COLUMN = 32;
const LIST_INDENT = 2;

class Page {
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

function commandLines(
	page: Page,
	lines: readonly Run[][],
	width: number,
	indent: number,
	anchor?: number,
): void {
	const prompt = COMMAND_COLORS.prompt;
	const background = COMMAND_COLORS.background;
	// While selected, every row of the command is highlighted, and the space after its last
	// row says how to copy it (the line's width never changes, so nothing reflows).
	const highlight: Partial<Run> = {
		intent: "linkActive",
		color: undefined,
		backgroundIntent: "linkActiveBackground",
		background: undefined,
	};
	const mark = (run: Run): Run =>
		anchor === undefined ? run : { ...run, anchor, selected: { ...highlight, ...run.selected } };
	const rows: Line[] = [];
	lines.forEach((runs, i) => {
		const lead: Run =
			i === 0 && anchor !== undefined
				? {
						text: "$ ",
						color: prompt,
						background,
						bold: true,
						selected: { text: `${MARKERS.selected} ` },
					}
				: { text: i === 0 ? "$ " : "  ", color: prompt, background, bold: true };
		hardWrap(
			runs.map((run) => ({ ...run, background, bold: true })),
			Math.max(1, width - 2),
		).forEach((row, j) => {
			const head = j === 0 ? lead : { text: "  ", color: prompt, background };
			rows.push([head, ...(row as Line)].map(mark));
		});
	});
	rows.forEach((row, r) => {
		const free = width - textWidth(runsText(row));
		const hint = r === rows.length - 1 ? copyHint(free) : "";
		const fill: Run = { text: " ".repeat(Math.max(0, free)), background };
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
	return [" (c to copy)", " (c)"].find((hint) => hint.length <= free) ?? "";
}

function table(
	page: Page,
	block: Extract<ContentBlock, { type: "table" }>,
	width: number,
	indent: number,
): void {
	const separator = ` ${DOCS_GLYPHS.v} `;
	const header = block.headers.map((cell) =>
		inline(page, cell, "heading").map((run) => ({ ...run, bold: true })),
	);
	// The monospace column (commands, paths) reads as code, as on the website.
	const rows = block.rows.map((row) =>
		row.map((cell, c) =>
			c === block.monospaceCol
				? inline(page, cell, "text").map((run) => ({ ...run, intent: "code" as const }))
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
	const room = Math.max(columns, width - separator.length * (columns - 1));
	const total = natural.reduce((a, b) => a + b, 0);
	const widths =
		total <= room ? natural : natural.map((w) => Math.max(1, Math.floor((w * room) / total)));
	const background = "panelBackground" as const;
	const emit = (cells: Run[][]) => {
		const wrapped = widths.map((w, c) => wrapRuns(cells[c] ?? [], w) as Line[]);
		const height = Math.max(...wrapped.map((lines) => lines.length));
		for (let r = 0; r < height; r += 1) {
			const line: Line = [];
			widths.forEach((w, c) => {
				if (c > 0) line.push({ text: separator, intent: "dimText", backgroundIntent: background });
				line.push(...padTo(wrapped[c]![r] ?? [], w, { backgroundIntent: background }));
			});
			page.push(line, indent);
		}
	};
	emit(header);
	const { h, x } = DOCS_GLYPHS;
	const divider = widths.map((w) => h.repeat(w)).join(`${h}${x}${h}`);
	page.push([{ text: divider, intent: "dimText", backgroundIntent: background }], indent);
	rows.forEach(emit);
}

function code(
	page: Page,
	block: Extract<ContentBlock, { type: "code" }>,
	width: number,
	indent: number,
): void {
	const g = DOCS_GLYPHS;
	const inner = Math.max(1, width - 2);
	const source = block.content.split("\n");
	const digits = Math.max(2, String(source.length).length);
	const gutter = digits + 2;
	const codeWidth = Math.max(1, inner - gutter);
	const border = { intent: "panelBorder" } as const;
	const label = truncateLine(
		[block.language.toUpperCase(), block.filename].filter(Boolean).join(" • "),
		Math.max(1, inner - 2),
	);
	page.push(
		[
			{ ...border, text: g.tl },
			{ text: ` ${label} `, intent: "accent", bold: true },
			{ ...border, text: g.h.repeat(Math.max(0, inner - textWidth(label) - 2)) },
			{ ...border, text: g.tr },
		],
		indent,
	);
	if (block.content.length === 0) {
		page.push(
			[
				{ ...border, text: g.v },
				...padTo([{ text: "(empty code block)", intent: "dimText" }], inner),
				{ ...border, text: g.v },
			],
			indent,
		);
	}
	source.forEach((plain, i) => {
		if (block.content.length === 0) return;
		const rows = hardWrap(codeRuns(block.highlightedLines?.[i], plain, undefined), codeWidth);
		rows.forEach((row, j) => {
			const number = j === 0 ? String(i + 1).padStart(digits) : " ".repeat(digits);
			page.push(
				[
					{ ...border, text: g.v },
					{ text: `${number} ${g.v}`, intent: "dimText" },
					...padTo(row, codeWidth),
					{ ...border, text: g.v },
				],
				indent,
			);
		});
	});
	page.push([{ ...border, text: `${g.bl}${g.h.repeat(inner)}${g.br}` }], indent);
}

function note(
	page: Page,
	block: Extract<ContentBlock, { type: "note" }>,
	width: number,
	indent: number,
): void {
	const colors = NOTE_COLORS[block.variant];
	const intent = ({ info: "info", warning: "warning", danger: "error" } as const)[block.variant];
	const background = colors.backgroundColor;
	const content = inline(page, block.content, intent);
	if (width < 4) {
		page.push(
			[{ text: `${colors.label}: `, color: colors.labelColor, background, bold: true }, ...content],
			indent,
		);
		return;
	}
	const g = NOTE_GLYPHS;
	const inner = width - 4;
	const border = { color: colors.borderColor, background };
	const row = (runs: Line) => [
		{ ...border, text: `${g.v} ` },
		...padTo(runs, inner, { background }),
		{ ...border, text: ` ${g.v}` },
	];
	page.push([{ ...border, text: `${g.tl}${g.h.repeat(width - 2)}${g.tr}` }], indent);
	page.push(
		row([
			{ text: truncateLine(colors.label, inner), color: colors.labelColor, background, bold: true },
		]),
		indent,
	);
	for (const line of wrapRuns(content, inner) as Line[]) {
		page.push(row(line.map((run) => ({ ...run, background }))), indent);
	}
	page.push([{ ...border, text: `${g.bl}${g.h.repeat(width - 2)}${g.br}` }], indent);
}

/** Lays out one docs block at `indent`, in `width` columns counted from the pane's edge. */
function layoutBlock(page: Page, block: ContentBlock, width: number, indent: number): void {
	const w = Math.max(1, width - indent);
	switch (block.type) {
		case "text":
			for (const line of wrapRuns(inline(page, block.content, "text"), w)) page.push(line, indent);
			return;
		case "code":
			return code(page, block, w, indent);
		case "command": {
			for (const line of wrapRuns([{ text: block.description, intent: "dimText" }], w))
				page.push(line, indent);
			const plain = Array.isArray(block.command) ? block.command : block.command.split("\n");
			const anchor = page.anchor({ kind: "command", command: plain.join("\n"), line: -1 });
			commandLines(
				page,
				plain.map((line, i) =>
					codeRuns(block.highlightedCommandLines?.[i], line, COMMAND_COLORS.prompt),
				),
				w,
				indent,
				anchor,
			);
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
				const marker: Run = { text: block.ordered ? `${i + 1}.` : "•", intent: "subheading" };
				const text = typeof item === "string" || Array.isArray(item) ? item : item.text;
				prefixed(page, marker, inline(page, text, "subheading"), w, indent);
				if (typeof item === "object" && !Array.isArray(item)) {
					for (const child of item.children ?? []) {
						prefixed(
							page,
							{ text: "•", intent: "dimText" },
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
				for (const line of wrapRuns(inline(page, block.intro, "dimText"), w))
					page.push(line, indent);
			}
			for (const step of block.steps) {
				// Each step's command can be selected and copied, like a command block's.
				const anchor = page.anchor({ kind: "command", command: step.command, line: -1 });
				commandLines(
					page,
					[[{ text: step.command, color: COMMAND_COLORS.prompt }]],
					w,
					indent,
					anchor,
				);
				for (const line of wrapRuns(inline(page, step.description, "text"), w))
					page.push(line, indent);
			}
			return;
		case "qa":
			block.items.forEach((item, i) => {
				if (i > 0) page.push([]);
				page.push([{ text: "Q >", intent: "heading", bold: true }], indent);
				for (const line of wrapRuns(
					inline(page, item.question, "heading"),
					Math.max(1, w - LIST_INDENT),
				)) {
					page.push(line, indent + LIST_INDENT);
				}
				page.push([{ text: "A >", intent: "subheading", bold: true }], indent);
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

/** The whole page at `width`: intro, then each section's heading and blocks, one blank line between items. */
export function layoutPage(content: DocsContent, width: number): PageLayout {
	const page = new Page();
	const gap = () => {
		if (page.lines.length > 0) page.push([]);
	};
	const intro = inline(page, content.intro, "dimText");
	if (runsText(intro).trim().length > 0) {
		for (const line of wrapRuns(intro, width)) page.push(line);
	}
	for (const section of content.sections) {
		gap();
		const level3 = section.level === 3;
		page.push([
			{
				text: `${level3 ? MARKERS.subheading : MARKERS.heading} ${section.title}`,
				intent: level3 ? "subheading" : "heading",
				bold: true,
			},
		]);
		for (const item of section.content) {
			gap();
			layoutBlock(page, item, width, 0);
		}
	}
	return { lines: page.lines, anchors: page.anchors };
}
