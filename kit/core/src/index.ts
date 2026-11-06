// The kit's public surface: exactly what the apps import.
export { useAppName, useTuiColors, useTuiTheme, useTuiViewport } from "./app/app-provider";
export { glyphs, inkBorderStyle } from "./chrome/glyphs";
export type { BorderStyle, Glyphs } from "./chrome/glyphs";
export { KeyValue } from "./components/data/key-value";
export {
	keymapStatusSegments,
	SegmentedStatusLine,
	hotkeyStatusSegment,
	scopeStatusSegment,
	textStatusSegment,
} from "./components/feedback/status-line";
export type { StatusSegment } from "./components/feedback/status-line";
export { SelectableGrid } from "./components/navigation/selectable-grid";
export type { GridItemContext } from "./components/navigation/selectable-grid";
export { useFocusPlane } from "./hooks/use-focus-plane";
export type { FocusPlane } from "./hooks/use-focus-plane";
export { useGridNavigation } from "./hooks/use-grid-navigation";
export { useListNavigation } from "./hooks/use-list-navigation";
export { useScrollState } from "./hooks/use-scroll-state";
export { RichTextLine } from "./primitives/display/rich-text";
export { NavList } from "./components/navigation/nav-list";
export type { NavListItem, NavListMode } from "./components/navigation/nav-list";
export { UiText } from "./primitives/display/text";
export { AppShell, useShellLayout } from "./surfaces/shell";
export type { PaneLayout, ShellLayout } from "./surfaces/shell";
export { parseHexColor, resolveColor, resolveIntentColor } from "./theme/colors";
export type { ColorRuntime } from "./theme/colors";
export { createTheme } from "./theme/create-theme";
export type { ColorIntent, ThemeColor, TuiTheme } from "./theme/tokens";
export { clampNumber } from "./utils/clamp";
export { horizontalRule, padRight, textWidth, truncateLine } from "./utils/strings";
export {
	appendRun,
	prefixWrappedText,
	runsText,
	truncateLines,
	wrapRuns,
	wrapText,
} from "./utils/runs";
export type { RichTextRun } from "./utils/runs";
export { keyHint, keymapHelp, useKeymap } from "./runtime/keymap";
export type { KeyBinding, KeyHandlers, KeyName, Keymap } from "./runtime/keymap";
export { errorMessage, runApp, UsageError } from "./app/run-app";
export type { AppSpec, Args, Flag } from "./app/run-app";
export { runCommand, startCommand } from "./app/command";
export type { CommandResult, RunningCommand } from "./app/command";
