# @levitate/tui-kit

Reusable React + Ink primitives for LevitateOS terminal applications.

## What belongs here

Generic, vocabulary-free code that any of the apps could use: app lifecycle, keys,
the two-pane frame, navigation lists, styled text, theme and colour. Anything that
names docs, pages of one app, or one app's data (docs markup, link rendering rules,
command rows, disk or slot vocabulary) lives in that app. Theme intents are generic
too (`navItem`, `heading`, `panelBorder`); an app's own colours sit in its theme file.

## Layout

- `src/index.ts`: the public surface, exactly what the apps import (one entry, no subpaths).
- `app/`: create and mount an app (`createTuiApp`, `renderApp`, the app provider and its hooks).
- `runtime/`: key input and terminal size.
- `hooks/`: hotkeys, focus between panes, list/grid navigation, scroll state.
- `primitives/`: text, rich text, grid layout.
- `components/`: navigation lists and grids, status line, key/value table.
- `surfaces/`: `useShellLayout` and `AppShell`, the two-pane frame every app uses.
- `chrome/`: the one box-drawing glyph table (and the same glyphs as an Ink `borderStyle`).
- `theme/`: colour intents, palette, colour runtime, `createTheme`.
- `utils/`: string width/wrap/pad and number helpers.

## The frame

`useShellLayout()` computes the frame once from the terminal size and the theme
(`layout.navWidth`, `layout.minColumns`, `chrome.*`): a nav pane and a content pane
side by side, or, below `minColumns`, one full-width pane (the focused one). Each
pane's `textColumns`/`textRows` is what its body may draw into, so apps size their
content from it instead of repeating the geometry. `AppShell` draws exactly that
layout. A titled pane is a top border, a title row and a divider (text rows from
the glyph table) above an Ink box whose borders use the same glyphs. Text is
measured in terminal cells with `string-width`, as Ink does.

## Quick Start

```tsx
import { AppShell, createTuiApp, renderApp, UiText, useShellLayout } from "@levitate/tui-kit";

function Demo() {
	const layout = useShellLayout();
	return (
		<AppShell
			layout={layout}
			focus="content"
			navTitle="Menu"
			nav={<UiText>one</UiText>}
			contentTitle="Demo"
			content={<UiText>Hello from tui-kit (Ctrl-C quits)</UiText>}
			footer={<UiText intent="dimText">demo</UiText>}
		/>
	);
}

await renderApp(<Demo />, { app: createTuiApp() }).waitUntilExit();
```

## Scripts

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

The kit emits nothing: apps import its TypeScript sources directly.
