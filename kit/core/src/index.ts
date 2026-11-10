// The kit's public surface: exactly what the apps import.
export {
	useHandOff,
	useIntentColor,
	useTuiColors,
	useTuiTheme,
	useTuiViewport,
} from "./app/app-provider";
export { glyphs, inkBorderStyle } from "./chrome/glyphs";
export type { BorderStyle } from "./chrome/glyphs";
export {
	Callout,
	Commands,
	ContentWidth,
	Facts,
	Heading,
	Panel,
	ProgressBar,
	SearchField,
	Section,
	StepList,
	Table,
} from "./components/page/blocks";
export { StepPath } from "./components/navigation/step-path";
export type { PathState, PathStep } from "./components/navigation/step-path";
export type { Column, StepStatus, Tone } from "./components/page/blocks";
export { PAGE_SCROLL_KEYS, usePageHeight, usePageScroll } from "./components/page/page-scroll";
export type { PageHeight } from "./components/page/page-scroll";
export { keymapStatusSegments, textStatusSegment } from "./components/feedback/status-line";
export type { StatusSegment } from "./components/feedback/status-line";
export { SelectableGrid } from "./components/navigation/selectable-grid";
export { useFocusPlane } from "./hooks/use-focus-plane";
export type { FocusPlane } from "./hooks/use-focus-plane";
export { useGridNavigation } from "./hooks/use-grid-navigation";
export { useListNavigation } from "./hooks/use-list-navigation";
export { useScrollState } from "./hooks/use-scroll-state";
export { useAsyncTask } from "./hooks/use-async-task";
export { RichTextLine } from "./primitives/display/rich-text";
export { NavList } from "./components/navigation/nav-list";
export type { NavListMode } from "./components/navigation/nav-list";
export { UiText } from "./primitives/display/text";
export { AppShell, fitFooter, useShellLayout } from "./surfaces/shell";
export type { Progress } from "./surfaces/shell";
export { parseHexColor, resolveIntentColor } from "./theme/colors";
export { brandTheme, createTheme } from "./theme/create-theme";
export type { Brand } from "./theme/create-theme";
export { readOsRelease } from "./app/os-release";
export type { ColorIntent, ThemeColor, TuiTheme } from "./theme/tokens";
export { errorMessage, textWidth, truncateLine } from "./utils/strings";
export { formatBytes, formatCount, shortDevice } from "./utils/format";
export { appendRun, runsText, truncateLines, wrapRuns } from "./utils/runs";
export type { RichTextRun } from "./utils/runs";
export { keyFor, movesBack, useKeymap } from "./runtime/keymap";
export type { Keymap } from "./runtime/keymap";
export { runApp, UsageError } from "./app/run-app";
export { runDir } from "./app/run-dir";
export type { Args } from "./app/run-app";
export {
	describeTerminalRun,
	runCommand,
	runInTerminal,
	startCommand,
	waitForEnter,
} from "./app/command";
export type { CommandOptions, CommandResult, RunningCommand, TerminalRun } from "./app/command";
