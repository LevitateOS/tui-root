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
- `app/`: `runApp` (flags and `--help`, TTY check, providers, exit status), `startCommand`/`runCommand` (the one way to run a backend tool), the app provider and its hooks.
- `runtime/`: key input: keymaps, `useKeymap`, the keyboard provider.
- `hooks/`: focus between panes, list/grid navigation, scroll state, async tasks.
- `primitives/`: text and rich text.
- `components/`: navigation lists and grids, the step path, status line, the page blocks (headings with a large step number, search field, tables).
- `surfaces/`: `useShellLayout` and `AppShell`, the two-pane frame every app uses.
- `chrome/`: the one box-drawing glyph table (and the same glyphs as an Ink `borderStyle`).
- `theme/`: colour intents, palette, colour runtime, `createTheme` and `brandTheme`.
- `utils/`: string width, rich-text runs and wrapping, number clamping, error messages.

## The frame

`useShellLayout()` computes the frame once from the terminal size and the theme
(`layout.navWidth`, `layout.minColumns`, `chrome.*`): a nav pane and a content pane
side by side, or, below `minColumns`, one full-width pane (the focused one). Each
pane's `textColumns`/`textRows` is what its body may draw into, so apps size their
content from it instead of repeating the geometry. `AppShell` draws exactly that
layout, under a header and over the footer:

- **The header** is a band on the brand's colour, fading into the surface: whose app it
  is (`theme.brand`), then the app's name and where in it you are. Under it is one
  segment a step when the app passes its `progress`, else a rule.
- **A pane** is a surface, not a box: its background, a blank row above and below the
  body, padding beside it. Every cell carries the pane's background, so a screenshot
  shows no terminal colour.
- **The footer** shows each key as a keycap; a segment marked `end` sits at the end of
  its line.

A brand (`brandTheme`) is a name and three colours on top of the default theme: the
accent, a second accent and the band. The default colours are the website's. Text is
measured in terminal cells with `string-width`, as Ink does.

## Quick Start

```tsx
import { AppShell, runApp, UiText, useShellLayout } from "@levitate/tui-kit";

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

runApp({ name: "demo", summary: "kit demo", run: () => <Demo /> });
```

## Scripts

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

The kit emits nothing: apps import its TypeScript sources directly.
