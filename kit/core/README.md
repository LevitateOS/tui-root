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
- `surfaces/`: `SurfaceFrame`, the bordered two-pane frame every app uses.
- `chrome/`: box-drawing glyph sets and the renderer that draws pane title rows.
- `theme/`: colour intents, palette, colour runtime, `createTheme`.
- `utils/`: string width/wrap/pad and number helpers.

## Quick Start

```tsx
import { createTuiApp, renderApp, SurfaceFrame, UiText, useHotkeys } from "@levitate/tui-kit";
import { useApp } from "ink";

function Demo() {
	const { exit } = useApp();
	useHotkeys(["q", "C-c"], () => exit());
	return (
		<SurfaceFrame
			showHeader={false}
			leftPane={{ title: "Menu", body: <UiText>one</UiText> }}
			rightPane={{ title: "Demo", body: <UiText>Hello from tui-kit (q quits)</UiText> }}
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
