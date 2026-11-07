import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useTuiColors, useTuiTheme, useTuiViewport } from "../app/app-provider";
import { glyphs, inkBorderStyle } from "../chrome/glyphs";
import type { FocusPlane } from "../hooks/use-focus-plane";
import { resolveIntentColor } from "../theme/colors";
import type { ColorIntent, TuiTheme } from "../theme/tokens";
import { statusLines, type StatusSegment } from "../components/feedback/status-line";
import { RichTextLine } from "../primitives/display/rich-text";
import type { RichTextRun } from "../utils/runs";
import { padRight } from "../utils/strings";

/** Below this the shell shows "Terminal too small" instead of a pane. */
const MIN_COLUMNS = 24;
const MIN_ROWS = 8;
/** A titled pane: top border, title row and divider above the body, border below. */
const TITLE_ROWS = 3;
const BOTTOM_ROWS = 1;
const SIDE_COLUMNS = 2;
/** The footer's rows before `fitFooter`, its side padding, and the share of the terminal it may take. */
const FOOTER_ROWS = 1;
const FOOTER_PADDING_X = 1;
const FOOTER_MAX_SHARE = 1 / 2;

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
	/** The footer's lines (set by `fitFooter`). */
	footer: RichTextRun[][];
};

function pane(theme: TuiTheme, outerWidth: number, outerHeight: number): PaneLayout {
	const { panePaddingX, panePaddingY } = theme.chrome;
	return {
		outerWidth,
		outerHeight,
		textColumns: Math.max(1, outerWidth - SIDE_COLUMNS - 2 * panePaddingX),
		textRows: Math.max(1, outerHeight - TITLE_ROWS - BOTTOM_ROWS - 2 * panePaddingY),
	};
}

/**
 * The frame's geometry for the current terminal: a nav pane of the theme's `navWidth`
 * beside a content pane when the terminal is at least `layout.minColumns` wide, else
 * one full-width pane. Apps size what they draw from the pane layouts this returns.
 */
export function useShellLayout(options: { navWidth?: number } = {}): ShellLayout {
	const theme = useTuiTheme();
	const { columns, rows } = useTuiViewport();
	const paneHeight = Math.max(1, rows - FOOTER_ROWS);
	const gap = theme.chrome.framePaneGap;
	const narrow = columns < theme.layout.minColumns;
	const navWidth = Math.min(
		options.navWidth ?? theme.layout.navWidth,
		Math.max(1, columns - gap - 1),
	);
	return {
		narrow,
		tooSmall: columns < MIN_COLUMNS || rows < MIN_ROWS,
		columns,
		rows,
		gap,
		nav: narrow ? undefined : pane(theme, navWidth, paneHeight),
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
	title: string;
	body: ReactNode;
	borderIntent: ColorIntent;
	titleIntent: ColorIntent;
	backgroundIntent: ColorIntent;
};

function Pane({ layout, title, body, borderIntent, titleIntent, backgroundIntent }: PaneProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const g = glyphs(theme.chrome.borderGlyphSet);
	const border = resolveIntentColor(theme, borderIntent, colors);
	const background = resolveIntentColor(theme, backgroundIntent, colors);
	const inner = Math.max(0, layout.outerWidth - SIDE_COLUMNS);
	return (
		<Box
			flexDirection="column"
			width={layout.outerWidth}
			height={layout.outerHeight}
			flexShrink={0}
		>
			{/* The chrome rows never shrink: a body taller than the pane is clipped instead. */}
			<Box flexShrink={0}>
				<Text
					color={border}
					backgroundColor={background}
				>{`${g.tl}${g.h.repeat(inner)}${g.tr}`}</Text>
			</Box>
			<Box flexShrink={0}>
				<Text backgroundColor={background}>
					<Text color={border}>{g.v}</Text>
					<Text color={resolveIntentColor(theme, titleIntent, colors)} bold>
						{padRight(title, inner)}
					</Text>
					<Text color={border}>{g.v}</Text>
				</Text>
			</Box>
			<Box flexShrink={0}>
				<Text
					color={border}
					backgroundColor={background}
				>{`${g.l}${g.h.repeat(inner)}${g.r}`}</Text>
			</Box>
			<Box
				flexDirection="column"
				flexGrow={1}
				flexShrink={1}
				minHeight={0}
				overflow="hidden"
				borderStyle={inkBorderStyle(theme.chrome.borderGlyphSet)}
				borderTop={false}
				borderColor={border}
				backgroundColor={background}
				paddingX={theme.chrome.panePaddingX}
				paddingY={theme.chrome.panePaddingY}
			>
				{body}
			</Box>
		</Box>
	);
}

type AppShellProps = {
	layout: ShellLayout;
	/** Which pane is shown when only one fits. */
	focus: FocusPlane;
	navTitle: string;
	nav: ReactNode;
	contentTitle: string;
	content: ReactNode;
};

/** The two-pane frame every app uses: nav pane, content pane, and the footer lines `fitFooter` set. */
export function AppShell({ layout, focus, navTitle, nav, contentTitle, content }: AppShellProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	if (layout.tooSmall) {
		return (
			<Text color={resolveIntentColor(theme, "warning", colors)}>
				Terminal too small: got {layout.columns}x{layout.rows}, need {MIN_COLUMNS}x{MIN_ROWS}.
			</Text>
		);
	}
	const navPane = (paneLayout: PaneLayout) => (
		<Pane
			layout={paneLayout}
			title={navTitle}
			body={nav}
			borderIntent="navBorder"
			titleIntent="navHeading"
			backgroundIntent="navBackground"
		/>
	);
	const contentPane = (
		<Pane
			layout={layout.content}
			title={contentTitle}
			body={content}
			borderIntent="contentBorder"
			titleIntent="heading"
			backgroundIntent="contentBackground"
		/>
	);
	return (
		<Box flexDirection="column" width={layout.columns} height={layout.rows}>
			<Box flexDirection="row" flexShrink={0}>
				{layout.nav ? navPane(layout.nav) : null}
				{layout.nav && layout.gap > 0 ? <Box width={layout.gap} flexShrink={0} /> : null}
				{layout.nav || focus === "content" ? contentPane : navPane(layout.content)}
			</Box>
			<Box
				flexDirection="column"
				height={Math.max(FOOTER_ROWS, layout.footer.length)}
				flexShrink={0}
				paddingX={FOOTER_PADDING_X}
				backgroundColor={resolveIntentColor(theme, "footerBackground", colors)}
			>
				{layout.footer.map((line, i) => (
					<RichTextLine key={i} runs={line} fallbackIntent="dimText" />
				))}
			</Box>
		</Box>
	);
}
