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
import { BIG_NUMBER_ROWS, BigNumber } from "./big-number";

/** The content pane's text width; pages draw rules, bars and tables to it. */
export const ContentWidth = createContext(80);

function useIntent(intent: ColorIntent): string | undefined {
	return useIntentColor()(intent);
}

/** The page's title, and one line on what this step is for. With `step`, the step's
 * number stands large beside them. */
export function Heading({
	title,
	subtitle,
	step,
}: {
	title: string;
	subtitle?: ReactNode;
	step?: number;
}): ReactNode {
	const words = (
		<Box flexDirection="column">
			<UiText bold intent="heading">
				{title}
			</UiText>
			{subtitle ? <UiText intent="dimText">{subtitle}</UiText> : null}
		</Box>
	);
	if (step === undefined) return <Box marginBottom={1}>{words}</Box>;
	return (
		<Box marginBottom={1} minHeight={BIG_NUMBER_ROWS}>
			<BigNumber value={step} />
			<Box marginLeft={3}>{words}</Box>
		</Box>
	);
}

/** What is being typed to search, on a raised row with a cursor; `trailing` (a count)
 * sits at its end. */
export function SearchField({
	label,
	text,
	trailing,
	width,
}: {
	label: string;
	text: string;
	trailing?: string;
	width: number;
}): ReactNode {
	const color = useIntentColor();
	const used = 1 + textWidth(label) + 2 + textWidth(text) + 1;
	const end = trailing && used + textWidth(trailing) + 2 <= width ? trailing : "";
	return (
		<Text backgroundColor={color("raisedBackground")}>
			<Text color={color("navHeading")}>{` ${label}  `}</Text>
			<Text bold color={color("text")}>
				{text}
			</Text>
			<Text backgroundColor={color("accent")}> </Text>
			<Text color={color("navHeading")}>
				{" ".repeat(Math.max(0, width - used - textWidth(end) - (end ? 1 : 0)))}
				{end}
				{end ? " " : ""}
			</Text>
		</Text>
	);
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
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text>
				<Text bold color={useIntent("subheading")}>
					{title}
				</Text>
				<Text color={useIntent("panelBorder")}> {"─".repeat(rule)}</Text>
				{trailing ? <Text color={useIntent("dimText")}> {trailing}</Text> : null}
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

/**
 * A block set apart as a surface: its own background and, with `edge`, a solid bar of
 * that colour down its left side. Unlike a box drawn with an Ink border (whose cells
 * keep the terminal's background), every cell is painted.
 */
export function Panel({
	edge,
	background = "raisedBackground",
	children,
	...box
}: {
	edge?: ColorIntent;
	background?: ColorIntent;
	children?: ReactNode;
} & Pick<BoxProps, "width" | "flexGrow" | "marginBottom">): ReactNode {
	const color = useIntentColor();
	return (
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
		</Box>
	);
}

/** An outcome or a warning that must not be missed: a panel edged in the tone's colour. */
export function Callout({
	tone,
	title,
	children,
}: {
	tone: Tone;
	title: string;
	children?: ReactNode;
}): ReactNode {
	const { intent, mark } = TONE[tone];
	const color = useIntent(intent);
	return (
		<Panel edge={intent} marginBottom={1}>
			<Text bold color={color}>
				{mark} {title}
			</Text>
			{children}
		</Panel>
	);
}

/** Labels and values in two aligned columns. */
export function Facts({ rows }: { rows: ReadonlyArray<[string, ReactNode]> }): ReactNode {
	const labelWidth = Math.max(0, ...rows.map(([label]) => textWidth(label)));
	const dim = useIntent("dimText");
	const text = useIntent("text");
	return (
		<Box flexDirection="column">
			{rows.map(([label, value], index) => (
				<Text key={`${index}-${label}`} color={text}>
					<Text color={dim}>{label.padEnd(labelWidth)}</Text>
					{"  "}
					{value}
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

/** A table with a dim header; cells are cut to fit the pane. With `selected`, every row
 * gets a marker column and the selected row (an index into `rows`) stands out; `tones`
 * colours rows by intent. */
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
	const marker = selected === undefined ? 0 : 2;
	const width = useContext(ContentWidth) - marker;
	const theme = useTuiTheme();
	const colors = useTuiColors();
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
			<Text color={resolveIntentColor(theme, "dimText", colors)} bold>
				{" ".repeat(marker)}
				{line(columns.map((column) => column.title))}
			</Text>
			{rows.map((row, r) => {
				const isSelected = r === selected;
				const tone = isSelected ? "accent" : (tones?.[r] ?? "text");
				return (
					<Text
						key={r}
						bold={isSelected}
						inverse={isSelected}
						color={resolveIntentColor(theme, tone, colors)}
					>
						{marker ? (isSelected ? "▸ " : "  ") : ""}
						{line(row)}
					</Text>
				);
			})}
		</Box>
	);
}

/** Commands to type, one per line behind a prompt. */
export function Commands({ lines }: { lines: readonly string[] }): ReactNode {
	const prompt = useIntent("accent");
	const code = useIntent("code");
	return (
		<Panel background="panelBackground">
			{lines.map((line) => (
				<Text key={line}>
					<Text color={prompt} bold>
						${" "}
					</Text>
					<Text color={code}>{line}</Text>
				</Text>
			))}
		</Panel>
	);
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

/** How far something has got: a bar to the pane's edge, then the percentage. `fraction`
 * is clamped to 0..1; null draws an empty bar with no figure (not started, or unknown). */
export function ProgressBar({
	fraction,
	tone = "info",
}: {
	fraction: number | null;
	tone?: Tone;
}): ReactNode {
	const width = useContext(ContentWidth);
	const shown = fraction === null ? null : Math.min(1, Math.max(0, fraction));
	const label = shown === null ? "" : ` ${Math.floor(shown * 100)}%`.padStart(5);
	const cells = Math.max(1, width - textWidth(label));
	const filled = shown === null ? 0 : Math.round(shown * cells);
	return (
		<Text>
			<Text color={useIntent(TONE[tone].intent)}>{"█".repeat(filled)}</Text>
			<Text color={useIntent("panelBorder")}>{"░".repeat(cells - filled)}</Text>
			<Text bold>{label}</Text>
		</Text>
	);
}
