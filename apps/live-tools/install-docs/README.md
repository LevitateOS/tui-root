# install-docs

Terminal viewer for the docs in `@levitate/docs-content`, built on `@levitate/tui-kit`. The install screen's launcher passes `--os-name` (the distro whose docs to show; there is no default) and the page flag its manifest declares (`--slug`).

Style change map: `style-map.md`

## Usage

`bun src/main.tsx --help` lists the flags and keys. On the live ISO the builder bundles it as `install-docs`, which the install screen runs in its right pane. `--pages` prints every page slug.

## Pages

The frame is the kit's: a band (`Guide`, then the page's title), a step line, a rail and the page.

- **The rail** is the grouped list of pages. The current section lists its pages; the others are one row each with a `▸` (`m` lists every section). Within the install guide (the first section) the pages before the current one are ticked.
- **The step line** has one segment per page of the current section, the current one lit; in the install guide the segments before it are done.
- **The page** opens with a heading (the page's title, its section and place in it; a large number beside it in the install guide), then the docs content at a reading measure of 56 columns at most. Section titles starting with `N.` show the number in the accent and the words in bold. Commands are blocks of the panel surface behind a `$`; the selected one is the selection bar, with `(c to copy)` after it. Code is the same block with its language, file and line numbers. Tables have a quiet header and no lines. Notes are plain quiet text; warnings and dangers are in colour with a lead word.
- **The action row** says what Enter does when a link is selected, or shows the last note (copied, opened, invalid link).

`--pane` draws the band flat, with no brand colour and no distro name, for the second pane of the install screen. The launcher passes it; this app only reads it.

## Keys

`bun src/main.tsx --help` lists every key; the status bar shows the ones that work in
the focused pane. Both come from `src/presentation/ink/keymap.ts`.

## Development

`cargo xtask check tui` checks it with every other TUI package (`--bless` accepts the current renders); `cargo xtask inspect install-docs` renders a page. Snapshots live in `snapshots/<columns>x<rows>/<page>.txt`; add a file to snapshot another page or size. The status bar's page count is masked (`levitate.inspect.mask` in `package.json`).
