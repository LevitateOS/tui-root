import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useTuiColors, useTuiTheme, useTuiViewport } from "../app/app-provider";
import { glyphs, inkBorderStyle } from "../chrome/glyphs";
import type { FocusPlane } from "../hooks/use-focus-plane";
import { resolveIntentColor } from "../theme/colors";
import type { ColorIntent, TuiTheme } from "../theme/tokens";
import { padRight } from "../utils/strings";

/** Below this the shell shows "Terminal too small" instead of a pane. */
const MIN_COLUMNS = 24;
const MIN_ROWS = 8;
/** A titled pane: top border, title row and divider above the body, border below. */
const TITLE_ROWS = 3;
const BOTTOM_ROWS = 1;
const SIDE_COLUMNS = 2;
const FOOTER_ROWS = 1;

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
			<Text
				color={border}
				backgroundColor={background}
			>{`${g.tl}${g.h.repeat(inner)}${g.tr}`}</Text>
			<Text backgroundColor={background}>
				<Text color={border}>{g.v}</Text>
				<Text color={resolveIntentColor(theme, titleIntent, colors)} bold>
					{padRight(title, inner)}
				</Text>
				<Text color={border}>{g.v}</Text>
			</Text>
			<Text color={border} backgroundColor={background}>{`${g.l}${g.h.repeat(inner)}${g.r}`}</Text>
			<Box
				flexDirection="column"
				flexGrow={1}
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
	footer: ReactNode;
};

/** The two-pane frame every app uses: nav pane, content pane, one footer row. */
export function AppShell({
	layout,
	focus,
	navTitle,
	nav,
	contentTitle,
	content,
	footer,
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
				height={FOOTER_ROWS}
				flexShrink={0}
				paddingX={1}
				backgroundColor={resolveIntentColor(theme, "footerBackground", colors)}
			>
				{footer}
			</Box>
		</Box>
	);
}
