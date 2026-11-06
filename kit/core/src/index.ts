// The kit's public surface: exactly what the apps import.
export { useTuiColors, useTuiTheme, useTuiViewport } from "./app/app-provider";
export { createTuiApp } from "./app/create-app";
export { renderApp } from "./app/render-app";
export type { RenderedTuiApp } from "./app/render-app";
export { resolveChromeGlyphSet } from "./chrome/glyph-sets";
export { KeyValue } from "./components/data/key-value";
export {
	keymapStatusSegments,
	SegmentedStatusLine,
	hotkeyStatusSegment,
	scopeStatusSegment,
	textStatusSegment,
} from "./components/feedback/status-line";
export type { StatusSegment } from "./components/feedback/status-line";
export { SectionList } from "./components/navigation/section-list";
export { SelectableGrid } from "./components/navigation/selectable-grid";
export { TreeNav } from "./components/navigation/tree-nav";
export { useFocusPlane } from "./hooks/use-focus-plane";
export type { FocusPlane } from "./hooks/use-focus-plane";
export { useGridNavigation } from "./hooks/use-grid-navigation";
export { useListNavigation } from "./hooks/use-list-navigation";
export { useScrollState } from "./hooks/use-scroll-state";
export { linkRuns } from "./primitives/display/link";
export { RichTextLine } from "./primitives/display/rich-text";
export type { RichTextRun } from "./primitives/display/rich-text";
export { parseSyntaxTokenLine } from "./primitives/display/syntax-token-line";
export { UiText } from "./primitives/display/text";
export { resolveGridColumns } from "./primitives/layout/grid";
export { SurfaceFrame, resolveSurfaceFrameGeometry } from "./surfaces/frame/surface-frame";
export { resolveColor, resolveIntentColor } from "./theme/colors";
export type { ColorRuntime } from "./theme/colors";
export { createTheme } from "./theme/create-theme";
export type { ColorIntent, ThemeColor, TuiTheme } from "./theme/tokens";
export { clampNumber } from "./utils/clamp";
export {
	horizontalRule,
	normalizeTextWidth,
	padRight,
	prefixWrappedText,
	truncateLine,
	wrapBoundedText,
} from "./utils/strings";
export { keyHint, keymapHelp, useKeymap } from "./runtime/keymap";
export type { KeyBinding, KeyHandlers, KeyName, Keymap } from "./runtime/keymap";
