import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useTuiColors, useTuiTheme, useTuiViewport } from "../app/app-provider";
import type { FocusPlane } from "../hooks/use-focus-plane";
import { mixColors, parseHexColor, resolveColor, resolveIntentColor } from "../theme/colors";
import type { ColorIntent, TuiTheme } from "../theme/tokens";
import { statusLines, type StatusSegment } from "../components/feedback/status-line";
import { RichTextLine } from "../primitives/display/rich-text";
import type { RichTextRun } from "../utils/runs";
import { textWidth, truncateLine } from "../utils/strings";

/** Below this the shell shows "Terminal too small" instead of a pane. */
const MIN_COLUMNS = 24;
const MIN_ROWS = 8;
/** The header: the band, then a rule; or, with steps, a row of space, the step line (a
 * full row thick) and another row of space. */
const HEADER_ROWS = 2;
const HEADER_ROWS_WITH_STEPS = 4;
/** A pane: a blank row, the body, a blank row; a column of padding beside its own. */
const PANE_TOP_ROWS = 1;
const PANE_BOTTOM_ROWS = 1;
const SIDE_COLUMNS = 2;
/** The footer's rows before `fitFooter`, its side padding, and the share of the terminal it may take. */
const FOOTER_ROWS = 1;
const FOOTER_PADDING_X = 1;
/** A row of the footer's surface under the keys, so they do not sit on the screen's edge. */
const FOOTER_PADDING_BOTTOM = 1;
const FOOTER_MAX_SHARE = 1 / 2;
/** The band fades from the brand's colour into the surface over this share of the width. */
const BAND_FADE = 0.7;

export type PaneLayout = {
	outerWidth: number;
	outerHeight: number;
	/** The text area inside the border and padding: what a pane body can draw into. */
	textColumns: number;
	textRows: number;
};

export type ShellLayout = {
	/** One pane at a time (the focused one) because two don't fit. */
	narrow: boolean;
	tooSmall: boolean;
	columns: number;
	rows: number;
	/** Undefined when narrow. */
	nav?: PaneLayout;
	content: PaneLayout;
	gap: number;
	/** The nav body draws to the pane's edges (no side padding). */
	navFlush: boolean;
	/** The header's rows: more when it carries a step line. */
	headerRows: number;
	/** The footer's lines (set by `fitFooter`). */
	footer: RichTextRun[][];
};

function pane(theme: TuiTheme, outerWidth: number, outerHeight: number, flush = false): PaneLayout {
	const { panePaddingX, panePaddingY } = theme.chrome;
	return {
		outerWidth,
		outerHeight,
		textColumns: flush ? outerWidth : Math.max(1, outerWidth - SIDE_COLUMNS - 2 * panePaddingX),
		textRows: Math.max(1, outerHeight - PANE_TOP_ROWS - PANE_BOTTOM_ROWS - 2 * panePaddingY),
	};
}

/**
 * The frame's geometry for the current terminal: under the header, a nav pane of the
 * theme's `navWidth` beside a content pane when the terminal is at least
 * `layout.minColumns` wide, else one full-width pane. Apps size what they draw from the
 * pane layouts this returns. `navFlush` gives the nav body the pane's whole width (a
 * list that draws its own selection bar to both edges). `steps` makes room in the header
 * for the step line the app gives `AppShell` as `progress`.
 */
export function useShellLayout(
	options: { navWidth?: number; navFlush?: boolean; steps?: boolean } = {},
): ShellLayout {
	const theme = useTuiTheme();
	const { columns, rows } = useTuiViewport();
	const headerRows = options.steps ? HEADER_ROWS_WITH_STEPS : HEADER_ROWS;
	const paneHeight = Math.max(1, rows - FOOTER_ROWS - FOOTER_PADDING_BOTTOM - headerRows);
	const gap = theme.chrome.framePaneGap;
	const narrow = columns < theme.layout.minColumns;
	const navWidth = Math.min(
		options.navWidth ?? theme.layout.navWidth,
		Math.max(1, columns - gap - 1),
	);
	const navFlush = options.navFlush ?? false;
	return {
		narrow,
		tooSmall: columns < MIN_COLUMNS || rows < MIN_ROWS,
		columns,
		rows,
		gap,
		navFlush,
		headerRows,
		nav: narrow ? undefined : pane(theme, navWidth, paneHeight, navFlush),
		content: pane(theme, narrow ? columns : columns - navWidth - gap, paneHeight),
		footer: [],
	};
}

/**
 * The layout with this footer: the segments wrapped onto as many lines as the width needs
 * (up to half the terminal), the panes shorter by the extra lines. Apps size what
 * they draw from the layout this returns.
 */
export function fitFooter(
	layout: ShellLayout,
	segments: ReadonlyArray<StatusSegment>,
): ShellLayout {
	const most = Math.max(FOOTER_ROWS, Math.floor(layout.rows * FOOTER_MAX_SHARE));
	const footer = statusLines(segments, layout.columns - 2 * FOOTER_PADDING_X).slice(0, most);
	const extra = Math.max(FOOTER_ROWS, footer.length) - FOOTER_ROWS;
	const shorter = (pane: PaneLayout): PaneLayout => ({
		...pane,
		outerHeight: Math.max(1, pane.outerHeight - extra),
		textRows: Math.max(1, pane.textRows - extra),
	});
	return {
		...layout,
		nav: layout.nav && shorter(layout.nav),
		content: shorter(layout.content),
		footer,
	};
}

type PaneProps = {
	layout: PaneLayout;
	body: ReactNode;
	backgroundIntent: ColorIntent;
	/** The body draws to the pane's edges. */
	flush?: boolean;
};

/** A pane is a surface: its background, a blank row above and below the body, padding
 * beside it. Every cell carries the pane's background. */
function Pane({ layout, body, backgroundIntent, flush = false }: PaneProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	return (
		<Box
			flexDirection="column"
			width={layout.outerWidth}
			height={layout.outerHeight}
			flexShrink={0}
			backgroundColor={resolveIntentColor(theme, backgroundIntent, colors)}
		>
			<Box flexShrink={0} height={PANE_TOP_ROWS} />
			{/* A body taller than the pane is clipped. */}
			<Box
				flexDirection="column"
				flexGrow={1}
				flexShrink={1}
				minHeight={0}
				overflow="hidden"
				paddingX={flush ? 0 : theme.chrome.panePaddingX + SIDE_COLUMNS / 2}
				paddingY={theme.chrome.panePaddingY}
			>
				{body}
			</Box>
			<Box flexShrink={0} height={PANE_BOTTOM_ROWS} />
		</Box>
	);
}

/** How far a run of steps has got, for the line under the band. */
export type Progress = {
	total: number;
	/** The steps finished, counted from the first. */
	done: number;
	/** The step being done (0-based), when it is one of them. */
	current?: number;
};

type Cell = { text: string; intent: ColorIntent; bold?: boolean };

/**
 * The band: whose app this is, then the app and where in it you are, on the brand's
 * colour fading into the surface. Under it one segment a step, or a rule.
 */
function Header({
	columns,
	rows,
	app,
	place,
	progress,
}: {
	columns: number;
	/** The rows the layout gave the header; the step line needs `HEADER_ROWS_WITH_STEPS`. */
	rows: number;
	app: string;
	place: string;
	progress?: Progress;
}) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const color = (intent: ColorIntent) => resolveIntentColor(theme, intent, colors);
	const surface = color("navBackground");

	// The line as cells, so each takes its place on the fade.
	const cells: Cell[] = Array.from({ length: columns }, () => ({ text: " ", intent: "text" }));
	const write = (at: number, text: string, intent: ColorIntent, bold = false) => {
		[...text].forEach((ch, i) => {
			if (at + i >= 0 && at + i < columns) cells[at + i] = { text: ch, intent, bold };
		});
		return at + [...text].length;
	};
	let left = 1;
	if (theme.brand) {
		left = write(left, "◆", "accent", true);
		left = write(left + 1, theme.brand, "text", true);
	}
	const room = Math.max(0, columns - left - 4);
	const where = truncateLine(place, Math.max(0, room - textWidth(app) - 3));
	const right = `${app}${where ? `   ${where}` : ""} `;
	if (textWidth(right) <= room) {
		const at = columns - textWidth(right);
		write(write(at, app, "text", true), where ? `   ${where}` : "", "dimText");
	}

	const fade = Math.max(1, Math.floor(columns * BAND_FADE));
	// The fade is mixed from the theme's colours, then matched to the terminal's.
	const from = parseHexColor(theme.colors.band);
	const to = parseHexColor(theme.colors.navBackground);
	const background = (column: number) =>
		from && to ? resolveColor(mixColors(from, to, column / fade), colors) : undefined;
	// Runs of cells that share a style, two columns of the fade at a time.
	const runs: { key: number; text: string; cell: Cell; background?: string }[] = [];
	cells.forEach((cell, column) => {
		const last = runs.at(-1);
		const step = column - (column % 2);
		if (
			last &&
			last.key === step &&
			last.cell.intent === cell.intent &&
			last.cell.bold === cell.bold
		)
			last.text += cell.text;
		else runs.push({ key: step, text: cell.text, cell, background: background(step) });
	});

	const steps = progress && rows >= HEADER_ROWS_WITH_STEPS ? progress : undefined;
	const segments = steps ? Math.max(1, steps.total) : 0;
	const width = segments ? Math.max(1, Math.floor((columns - 2 - (segments - 1)) / segments)) : 0;
	const blank = <Text backgroundColor={surface}>{" ".repeat(columns)}</Text>;
	return (
		<Box flexDirection="column" flexShrink={0} height={rows} width={columns}>
			<Text>
				{runs.map((run, i) => (
					<Text
						key={i}
						color={color(run.cell.intent)}
						backgroundColor={run.background}
						bold={run.cell.bold}
					>
						{run.text}
					</Text>
				))}
			</Text>
			{steps ? (
				<>
					{blank}
					<Text backgroundColor={surface}>
						<Text backgroundColor={surface}> </Text>
						{Array.from({ length: segments }, (_, i) => (
							<Text
								key={i}
								backgroundColor={surface}
								color={color(
									i < steps.done ? "success" : i === steps.current ? "accent" : "navBorder",
								)}
							>
								{"█".repeat(width)}
								{i < segments - 1 ? " " : ""}
							</Text>
						))}
						<Text backgroundColor={surface}>
							{" ".repeat(Math.max(0, columns - 1 - segments * width - (segments - 1)))}
						</Text>
					</Text>
					{blank}
				</>
			) : (
				<Text backgroundColor={surface} color={color("navBorder")}>
					{"─".repeat(columns)}
				</Text>
			)}
		</Box>
	);
}

type AppShellProps = {
	layout: ShellLayout;
	/** Which pane is shown when only one fits. */
	focus: FocusPlane;
	/** The app's name in the band. */
	navTitle: string;
	nav: ReactNode;
	/** Where in the app you are, after its name in the band. */
	contentTitle: string;
	content: ReactNode;
	/** Steps for the line under the band (the layout must be made with `steps`); without
	 * them it is a rule. */
	progress?: Progress;
};

/** The frame every app uses: the header band, the nav and content panes, and the footer lines `fitFooter` set. */
export function AppShell({
	layout,
	focus,
	navTitle,
	nav,
	contentTitle,
	content,
	progress,
}: AppShellProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	if (layout.tooSmall) {
		return (
			<Text color={resolveIntentColor(theme, "warning", colors)}>
				Terminal too small: got {layout.columns}x{layout.rows}, need {MIN_COLUMNS}x{MIN_ROWS}.
			</Text>
		);
	}
	const navPane = (paneLayout: PaneLayout, flush: boolean) => (
		<Pane layout={paneLayout} body={nav} backgroundIntent="navBackground" flush={flush} />
	);
	const contentPane = (
		<Pane layout={layout.content} body={content} backgroundIntent="contentBackground" />
	);
	return (
		<Box flexDirection="column" width={layout.columns} height={layout.rows}>
			<Header
				columns={layout.columns}
				rows={layout.headerRows}
				app={navTitle}
				place={contentTitle}
				progress={progress}
			/>
			<Box flexDirection="row" flexShrink={0}>
				{layout.nav ? navPane(layout.nav, layout.navFlush) : null}
				{layout.nav && layout.gap > 0 ? (
					<Box
						width={layout.gap}
						flexShrink={0}
						backgroundColor={resolveIntentColor(theme, "contentBackground", colors)}
					/>
				) : null}
				{layout.nav || focus === "content" ? contentPane : navPane(layout.content, false)}
			</Box>
			<Box
				flexDirection="column"
				height={Math.max(FOOTER_ROWS, layout.footer.length) + FOOTER_PADDING_BOTTOM}
				flexShrink={0}
				paddingX={FOOTER_PADDING_X}
				paddingBottom={FOOTER_PADDING_BOTTOM}
				backgroundColor={resolveIntentColor(theme, "footerBackground", colors)}
			>
				{layout.footer.map((line, i) => (
					<RichTextLine key={i} runs={line} fallbackIntent="dimText" />
				))}
			</Box>
		</Box>
	);
}
