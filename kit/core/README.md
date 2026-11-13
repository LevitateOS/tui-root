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
- `components/`: navigation lists and grids, the rail (step path and grouped list), the marks, status line, the page blocks (headings, panels, fields, tables) and pictures (disk bar, word slots, checks, run sheet, from-to, surface).
- `primitives/`: text, rich text, and `CellGrid` for drawing a part cell by cell.
- `surfaces/`: `useShellLayout` and `AppShell`, the two-pane frame every app uses.
- `chrome/`: the one box-drawing glyph table (and the same glyphs as an Ink `borderStyle`).
- `theme/`: colour intents, the `Palette` a theme is made of, colour runtime, contrast, and `brandTheme`.
- `utils/`: string width, rich-text runs and wrapping, number clamping, error messages.

## The frame

`useShellLayout()` computes the frame once from the terminal size and the theme
(`layout.navWidth`, `layout.minColumns`, `chrome.*`): a nav pane and a content pane
side by side, or, below `minColumns`, one full-width pane (the focused one). Each
pane's `textColumns`/`textRows` is what its body may draw into, so apps size their
content from it instead of repeating the geometry. `AppShell` draws exactly that
layout, under a header and over the footer:

- **The header** is a band on the brand's colour, fading into the surface: whose app it
  is (`theme.brand`), then the app's name and where in it you are. Under it is a rule,
  or, for an app that asks the layout for `steps` and passes its `progress`, a step
  line a full row thick with a row of space above and below.
- **A pane** is a surface, not a box: its background, a blank row above and below the
  body, padding beside it. Every cell carries the pane's background, so a screenshot
  shows no terminal colour.
- **The footer** shows each key as a keycap, with a row of its surface under them; a
  segment marked `end` sits at the end of its line.
- **The step line** (`progress`) is either `{ total, done, current }` (a segment a step:
  done in success, current in the accent, the rest in the rule colour) or a list of named
  segments `{ label, state }`, where `state` is `on` (accent), `next` (second accent) or
  `off` (rule colour) and the label is written inside the segment (recab's two slots).
- **The action row.** A page has at most one thing to press, always on the same row at
  the foot of the content pane. `useShellLayout({ action: true })` keeps three rows there
  (a blank row, the action row, a blank row; the action lands where the mock-ups put it)
  and leaves them out of `content.textRows`. `AppShell`'s `action` is either
  `{ label, key }` (a bar in the accent, the label at its left, the key as an inverted
  keycap at its right) or `{ note, intent? }` (one quiet line, dim text by default), drawn
  in the pane's text columns. The kit only draws it: the app's keymap still handles the
  key. A page without either leaves the rows blank.

`AppShell` provides `ContentWidth` (the content pane's `textColumns`) to the content, and
each pane's background as the surface (`useSurfaceBackground`), so the parts below fit
the pane and paint their empty cells in its colour.

## Colour: one palette, both modes

Every colour of a theme comes from one `Palette`, the fifteen roles of a distro's
`[look.<mode>]` table in `distro/variants/<id>/distro.toml`: `surface`, `surfaceRaised`,
`surfaceSunken`, `text`, `textSecondary`, `textMuted`, `rule`, `hairline`, `accent`,
`highlight`, `band`, `onBand`, `ok`, `warn`, `bad`. A distro starts in the mode its
`profile.appearance` names (LevitateOS light, AcornOS dark), and the kit has no colours of
its own: nothing assumes the surface is dark.

`brandTheme({ name, appearance, palette })` makes the whole theme (the apps pass
`brandOf(distro)` from `@levitate/docs-content/brand`, which is exactly that for the
distro's starting mode; `brandOf(undefined)` is LevitateOS's, nameless). There is no
default theme: `runApp` needs `theme`. `theme.appearance` says which mode the palette is
in, for what has its own light and dark sets (install-docs picks the light or the dark
syntax colouring by it). `paletteColors` (`theme/tokens.ts`) is the one place a role
becomes intents:

| Intents | Role |
|---|---|
| `navBackground`, `panelBackground`, `footerBackground`, `linkActive`, `selection`, `onFill` | `surface` |
| `contentBackground` | `surfaceSunken` |
| `raisedBackground` | `surfaceRaised` |
| `text`, `heading` | `text` |
| `info`, `navItem` | `textSecondary` |
| `dimText`, `faintText`, `navHeading` | `textMuted` |
| `navBorder`, `panelBorder` | `rule` |
| `contentBorder` | `hairline` |
| `accent`, `subheading`, `link`, `linkActiveBackground`, `selectionBackground` | `accent` |
| `highlight`, `code` | `highlight` |
| `band` / `onBand` | `band` / `onBand` |
| `success` / `warning` / `error` | `ok` / `warn` / `bad` |

**Text on a fill.** The accent is light in dark mode and dark in light mode, so text on a
filled accent, second accent or status colour is never `text`: it is `onFill` (the surface
colour), which contrasts with each of them in both modes. Selection bars, the active
link, the action bar, step-line segments, keycaps inside a panel, badges and disk-bar names
all take it; text on the band is `onBand`. The header picks per cell: its own colour
where that reads on the fade there (`contrastRatio` at 4.5), else the better of it and
`onBand`.

**The key bar** (the footer) is drawn from the same roles, so a program that draws its own
(the install screen's split-pane host) reads the distro's `[look.<profile.appearance>]`
table: the bar is `surface`; each keycap is `text` bold on `rule`; the labels, the
separators between them and a note at the end of a line are `text_muted`.

On a terminal without 24-bit colour each colour is matched to the nearest of the
256-colour palette here (`nearest256`): left to chalk, dark greens come out teal.

**The Ink background pitfall.** Inside a pane, Ink gives a `Text` nested in another the
pane's background, not the outer `Text`'s. A row or block with its own background must
set that background on every nested `Text`, spaces included. The kit's parts do this by
drawing through `CellGrid` (below) or by naming the surface on every `Text`. A part an
app draws itself should do the same: draw it on a `CellGrid`, or read
`useSurfaceBackground()` and set it on each `Text`. Every glyph must name a colour too:
a bold `Text` with no `color` shows the terminal's own.

## The parts

Colours are theme intents, never literal colours: `contentBackground` (night),
`navBackground`/`panelBackground` (ink), `raisedBackground`, `contentBorder` (hairline),
`panelBorder`/`navBorder` (rule), `faintText` (gutter, the quietest text), `dimText`
(lichen), `info`/`navItem` (moss), `text` (paper), `accent`, `highlight` (the second
accent), `success`, `warning`, `error`, and `selection` on `selectionBackground` for a
selected row.

Marks are one vocabulary (`PathState`): `done` ✓, `ready` ●, `waiting` ○, `running` ◐,
`failed` ✗, `none` (no mark); the row you are at in `StepPath` shows ◉.

- `Heading` `{ title, subtitle?, glyph?, tone?, step? }`: always four rows (title, up to
  two lines of subtitle, blank). `glyph` is a number, `"check"` or `"bang"`, three rows
  tall in `tone` (accent by default); `step={n}` is `glyph={n}`.
- `StepPath` `{ steps, selected, width, rows }`: the rail as a path.
- `RailList` `{ groups: [{ title?, items: [{ id, label, state, hint? }] }], selected, width }`:
  the rail as a grouped list (recab, the guide).
- `Panel` `{ edge?, background?, facts?, keys?, width?, flexGrow?, marginBottom? }` and
  `Callout` `{ tone, title, facts?, keys? }`: verdicts and questions; `keys` are keycaps
  in the edge's colour (the yes-or-no), `facts` label and value rows.
- `Facts`, `Section`, `Table` (the selected row a bar in the selection colours), `Commands`
  `{ lines, label? }`, `StepList`, `ProgressBar` `{ fraction, tone? }` (one row of full
  blocks and the figure).
- `Field` `{ label, text, width, trailing?, secret?, cursor? }`: a raised row being typed
  into; `SearchField` is a `Field`.
- `DiskBar` `{ parts: [{ name, size, intent }], total?, width?, label?, selected? }` and
  `diskBarSpans(parts, width, total?, label?)`: each part's columns, to label under it.
- `BigFigure` `{ text, intent? }` ("62%") and `BigNumber` `{ value, intent? }`.
- `WordSlots` `{ word, typed }`, `Checks` `{ columns: [{ title, items: [{ state, text }] }] }`,
  `RunSheet` `{ steps: [{ phase, command, state }] }`, `FromTo` `{ from, to }`.
- `Surface` `{ background?, width?, height?, flexGrow?, paddingX?, paddingY?, marginBottom? }`:
  a block that paints every cell, for an app's own content (cards, tiles).
- `CellGrid` and `CellRows`: draw a part cell by cell, as `docs/tui-design/kit.py` does
  (`put(row, col, text, fg, bg?, bold?)`, `fill(row, col, width, bg)`); for the mock-up
  parts the kit does not carry (cards, gauges, slot blocks, timelines).

Text is measured in terminal cells with `string-width`, as Ink does.

## Quick Start

```tsx
import { brandOf } from "@levitate/docs-content/brand";
import { AppShell, brandTheme, runApp, UiText, useShellLayout } from "@levitate/tui-kit";

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

runApp({
	name: "demo",
	summary: "kit demo",
	theme: brandTheme(brandOf(undefined)),
	run: () => <Demo />,
});
```

## Scripts

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

The kit emits nothing: apps import its TypeScript sources directly.
