/**
 * The building blocks every app's pages are made of, so all of them share one hierarchy: a
 * heading with what the page is for, titled sections under a rule, callouts for outcomes,
 * tables and command blocks for data. Pages draw to `ContentWidth`, which the app provides
 * from its content pane.
 */
import { Box, Text, type BoxProps } from "ink";
import { createContext, useContext, type ReactNode } from "react";
import { useIntentColor, useTuiColors, useTuiTheme } from "../../app/app-provider";
import { UiText } from "../../primitives/display/text";
import { resolveIntentColor } from "../../theme/colors";
import type { ColorIntent } from "../../theme/tokens";
import { textWidth, truncateLine } from "../../utils/strings";
import {
	CellGrid,
	CellRows,
	SurfaceBackground,
	useSurfaceBackground,
} from "../../primitives/display/cells";
import { wrapText } from "../../utils/wrap";
import { BigGlyphBlock, type BigGlyph } from "./big-number";
import { Field } from "./field";

/** The content pane's text width; pages draw rules, bars and tables to it. */
export const ContentWidth = createContext(80);

/** The rows a heading takes, with or without a glyph: the title, up to two lines under
 * it, the rest blank; so every page's body starts on the same row. */
export const HEADING_ROWS = 4;
/** The columns between a heading's glyph and its words. */
const GLYPH_GAP = 3;

/** The page's title, and up to two lines on what the page is for. With `glyph` (or
 * `step`, the same as a number) a figure three rows tall stands beside them in `tone`:
 * a step's number, a tick at the end, a warning when something stopped. */
export function Heading({
	title,
	subtitle,
	step,
	glyph,
	tone = "accent",
}: {
	title: string;
	subtitle?: ReactNode;
	step?: number;
	glyph?: BigGlyph;
	tone?: ColorIntent;
}): ReactNode {
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	const shown = glyph ?? step;
	return (
		<Box height={HEADING_ROWS} flexShrink={0} overflow="hidden">
			{shown === undefined ? null : (
				<>
					<BigGlyphBlock glyph={shown} intent={tone} />
					<Box width={GLYPH_GAP} flexShrink={0} />
				</>
			)}
			<Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
				<Text bold color={color("heading")} backgroundColor={background} wrap="truncate">
					{title}
				</Text>
				{subtitle ? (
					<Box height={2} overflow="hidden">
						<Text color={color("dimText")} backgroundColor={background}>
							{subtitle}
						</Text>
					</Box>
				) : null}
			</Box>
		</Box>
	);
}

/** What is being typed to search: a `Field` with the count at its end. */
export function SearchField(props: {
	label: string;
	text: string;
	trailing?: string;
	width: number;
}): ReactNode {
	return <Field {...props} />;
}

/** A titled part of a page: the title, then a rule to the pane's edge. */
export function Section({
	title,
	children,
	trailing,
}: {
	title: string;
	children: ReactNode;
	/** Text at the end of the rule, e.g. a count. */
	trailing?: string;
}): ReactNode {
	const width = useContext(ContentWidth);
	const rule = Math.max(0, width - textWidth(title) - 1 - (trailing ? textWidth(trailing) + 2 : 0));
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text backgroundColor={background}>
				<Text bold color={color("subheading")} backgroundColor={background}>
					{title}
				</Text>
				<Text color={color("panelBorder")} backgroundColor={background}>
					{" "}
					{"─".repeat(rule)}
				</Text>
				{trailing ? (
					<Text color={color("dimText")} backgroundColor={background}>
						{"  "}
						{trailing}
					</Text>
				) : null}
			</Text>
			{children}
		</Box>
	);
}

export type Tone = "danger" | "warning" | "success" | "info";

const TONE: Record<Tone, { intent: ColorIntent; mark: string }> = {
	danger: { intent: "error", mark: "!" },
	warning: { intent: "warning", mark: "!" },
	success: { intent: "success", mark: "✓" },
	info: { intent: "info", mark: "i" },
};

/** A panel's left edge: a solid cell, so the edge leaves no cell of its own unpainted. */
const EDGE = {
	topLeft: "",
	top: "",
	topRight: "",
	right: "",
	bottomRight: "",
	bottom: "",
	bottomLeft: "",
	left: "█",
};

/** Pairs of a key and what it does, such as `[["y", "apply"], ["n", "go back"]]`. */
export type KeyPairs = ReadonlyArray<readonly [string, string]>;

/** Labels and values, such as `[["Disk", "/dev/nvme0n1"]]`. */
export type FactRows = ReadonlyArray<readonly [string, ReactNode]>;

/** The keys of a question as keycaps in the panel's tone, each followed by what it does. */
function PanelKeys({ keys, tone }: { keys: KeyPairs; tone: ColorIntent }): ReactNode {
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	return (
		<Text backgroundColor={background}>
			{keys.map(([key, label], i) => (
				<Text key={i} backgroundColor={background}>
					<Text bold color={color("contentBackground")} backgroundColor={color(tone)}>
						{` ${key} `}
					</Text>
					<Text color={color("text")} backgroundColor={background}>
						{` ${label}${i < keys.length - 1 ? "   " : ""}`}
					</Text>
				</Text>
			))}
		</Text>
	);
}

/**
 * A block set apart as a surface: its own background and, with `edge`, a solid bar of
 * that colour down its left side. Unlike a box drawn with an Ink border (whose cells
 * keep the terminal's background), every cell is painted. `facts` adds label and value
 * rows under the children; `keys` adds the keycaps of a question (the yes-or-no) on the
 * last line, in the edge's colour.
 */
export function Panel({
	edge,
	background = "raisedBackground",
	facts,
	keys,
	children,
	...box
}: {
	edge?: ColorIntent;
	background?: ColorIntent;
	facts?: FactRows;
	keys?: KeyPairs;
	children?: ReactNode;
} & Pick<BoxProps, "width" | "flexGrow" | "marginBottom">): ReactNode {
	const color = useIntentColor();
	return (
		<SurfaceBackground.Provider value={background}>
			<Box
				flexDirection="column"
				paddingX={1}
				backgroundColor={color(background)}
				{...(edge
					? {
							borderStyle: EDGE,
							borderTop: false,
							borderRight: false,
							borderBottom: false,
							borderColor: color(edge),
						}
					: {})}
				{...box}
			>
				{children}
				{facts && facts.length > 0 ? <Facts rows={facts} /> : null}
				{keys && keys.length > 0 ? <PanelKeys keys={keys} tone={edge ?? "accent"} /> : null}
			</Box>
		</SurfaceBackground.Provider>
	);
}

/** An outcome, a warning or a question that must not be missed: a panel edged in the
 * tone's colour, its title after the tone's mark, then the children, `facts` and `keys`
 * (see `Panel`). */
export function Callout({
	tone,
	title,
	facts,
	keys,
	children,
}: {
	tone: Tone;
	title: string;
	facts?: FactRows;
	keys?: KeyPairs;
	children?: ReactNode;
}): ReactNode {
	const { intent, mark } = TONE[tone];
	const color = useIntentColor();
	return (
		<Panel edge={intent} marginBottom={1} facts={facts} keys={keys}>
			<Text bold color={color(intent)} backgroundColor={color("raisedBackground")}>
				{mark} {title}
			</Text>
			{children}
		</Panel>
	);
}

/** Labels and values in two aligned columns, on the surface they sit on. A value that is
 * not a string must name its own background (see the README on nested Text). */
export function Facts({ rows }: { rows: FactRows }): ReactNode {
	const labelWidth = Math.max(0, ...rows.map(([label]) => textWidth(label)));
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	return (
		<Box flexDirection="column">
			{rows.map(([label, value], index) => (
				<Text key={`${index}-${label}`} color={color("text")} backgroundColor={background}>
					<Text color={color("dimText")} backgroundColor={background}>
						{label.padEnd(labelWidth)}
						{"  "}
					</Text>
					{typeof value === "string" || typeof value === "number" ? (
						<Text color={color("text")} backgroundColor={background}>
							{value}
						</Text>
					) : (
						value
					)}
				</Text>
			))}
		</Box>
	);
}

export type Column = {
	title: string;
	align?: "left" | "right";
	/** Left out, from the right, when the table is too wide for the pane. */
	optional?: boolean;
};

/** A table with a dim header; cells are cut to fit the pane. With `selected` (an index
 * into `rows`), the rows move a column right and the selected one is drawn as a bar in
 * the selection colours across the table's width; `tones` colours rows by intent. */
export function Table({
	columns,
	rows,
	selected,
	tones,
}: {
	columns: readonly Column[];
	rows: ReadonlyArray<ReadonlyArray<string>>;
	selected?: number;
	tones?: ReadonlyArray<ColorIntent | null>;
}): ReactNode {
	const marker = selected === undefined ? 0 : 1;
	const full = useContext(ContentWidth);
	const width = full - marker;
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	const natural = columns.map((column, c) =>
		Math.max(textWidth(column.title), ...rows.map((row) => textWidth(row[c] ?? ""))),
	);
	const shown = columns.map((_, c) => c);
	const total = (w = natural) => shown.reduce((sum, c) => sum + w[c]!, 0) + 2 * (shown.length - 1);
	for (let c = columns.length - 1; c >= 0 && total() > width; c--) {
		if (columns[c]!.optional) shown.splice(shown.indexOf(c), 1);
	}
	// Still too wide: the widest columns give way, down to a few cells each.
	const widths = [...natural];
	const MIN_CELLS = 6;
	for (let over = total(widths) - width; over > 0; over--) {
		const widest = shown.reduce((a, c) => (widths[c]! > widths[a]! ? c : a), shown[0]!);
		if (widths[widest]! <= MIN_CELLS) break;
		widths[widest]!--;
	}
	const cell = (text: string, c: number) => {
		const fitted = truncateLine(text, widths[c]!);
		const pad = " ".repeat(Math.max(0, widths[c]! - textWidth(fitted)));
		return columns[c]!.align === "right" ? pad + fitted : fitted + pad;
	};
	const line = (cells: ReadonlyArray<string>) =>
		truncateLine(shown.map((c) => cell(cells[c] ?? "", c)).join("  "), width);
	return (
		<Box flexDirection="column">
			<Text color={color("dimText")} backgroundColor={background} bold>
				{" ".repeat(marker)}
				{line(columns.map((column) => column.title))}
			</Text>
			{rows.map((row, r) => {
				const isSelected = r === selected;
				const text = line(row);
				return (
					<Text
						key={r}
						bold={isSelected}
						color={color(isSelected ? "selection" : (tones?.[r] ?? "text"))}
						backgroundColor={isSelected ? color("selectionBackground") : background}
					>
						{" ".repeat(marker)}
						{text}
						{isSelected ? " ".repeat(Math.max(0, width - textWidth(text))) : ""}
					</Text>
				);
			})}
		</Box>
	);
}

/** Commands to type: a block of the panel surface, each command behind a prompt, long
 * ones wrapped; `label` sits quietly at the block's top right. */
export function Commands({
	lines,
	label,
}: {
	lines: readonly string[];
	label?: string;
}): ReactNode {
	const width = useContext(ContentWidth);
	const body = lines.flatMap((line) =>
		wrapText(line, Math.max(1, width - 6)).map((part, i) => ({ first: i === 0, part })),
	);
	const grid = new CellGrid(width, body.length, "panelBackground");
	if (label && body.length > 0) grid.put(0, width - textWidth(label) - 2, label, "faintText");
	body.forEach(({ first, part }, row) => {
		if (first) grid.put(row, 2, "$", "accent", undefined, true);
		grid.put(row, 4, part, "highlight");
	});
	return <CellRows grid={grid} />;
}

export type StepStatus = "planned" | "running" | "ok" | "failed";

const STEP_MARK: Record<StepStatus, { mark: string; intent: ColorIntent }> = {
	planned: { mark: "○", intent: "dimText" },
	running: { mark: "◐", intent: "warning" },
	ok: { mark: "✓", intent: "success" },
	failed: { mark: "✗", intent: "error" },
};

/** Steps grouped under their phase (an empty phase gets no header), each with its status mark. */
export function StepList({
	steps,
}: {
	steps: ReadonlyArray<{ phase: string; command: string; status: StepStatus }>;
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const phases = [...new Set(steps.map((step) => step.phase))];
	return (
		<Box flexDirection="column">
			{phases.map((phase, p) => (
				<Box key={phase} flexDirection="column" marginBottom={p < phases.length - 1 ? 1 : 0}>
					{phase ? (
						<UiText bold intent="subheading">
							{phase.charAt(0).toUpperCase() + phase.slice(1)}
						</UiText>
					) : null}
					{steps
						.filter((step) => step.phase === phase)
						.map((step, i) => {
							const { mark, intent } = STEP_MARK[step.status];
							return (
								<Text key={i}>
									{"  "}
									<Text color={resolveIntentColor(theme, intent, colors)}>{mark}</Text>
									{"  "}
									<Text
										color={resolveIntentColor(
											theme,
											step.status === "failed" || step.status === "running" ? intent : "text",
											colors,
										)}
									>
										{step.command}
									</Text>
								</Text>
							);
						})}
				</Box>
			))}
		</Box>
	);
}

/** How far something has got: one row of full blocks to the pane's edge, the part done
 * in `tone` (the accent when none is given), then the percentage. `fraction` is clamped
 * to 0..1; null draws an empty bar with no figure (not started, or unknown). */
export function ProgressBar({
	fraction,
	tone,
}: {
	fraction: number | null;
	tone?: Tone;
}): ReactNode {
	const width = useContext(ContentWidth);
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	const shown = fraction === null ? null : Math.min(1, Math.max(0, fraction));
	const label = shown === null ? "" : ` ${Math.floor(shown * 100)}%`.padStart(5);
	const cells = Math.max(1, width - textWidth(label));
	const filled = shown === null ? 0 : Math.round(shown * cells);
	return (
		<Text backgroundColor={background}>
			<Text color={color(tone ? TONE[tone].intent : "accent")} backgroundColor={background}>
				{"█".repeat(filled)}
			</Text>
			<Text color={color("panelBorder")} backgroundColor={background}>
				{"█".repeat(cells - filled)}
			</Text>
			<Text bold color={color("text")} backgroundColor={background}>
				{label}
			</Text>
		</Text>
	);
}
