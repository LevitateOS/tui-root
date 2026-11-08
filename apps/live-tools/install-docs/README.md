# install-docs

Terminal viewer for the docs in `@levitate/docs-content`, built on `@levitate/tui-kit`. The install screen's launcher passes `--os-name` (the distro whose docs to show; there is no default) and the page flag its manifest declares (`--slug`).

Style change map: `style-map.md`

## Usage

`bun src/main.tsx --help` lists the flags and keys. On the live ISO the builder bundles it as `install-docs`, which the install screen runs in its right pane. `--pages` prints every page slug.

## Keys

`bun src/main.tsx --help` lists every key; the status bar shows the ones that work in
the focused pane. Both come from `src/presentation/ink/keymap.ts`.

## Development

`cargo xtask check tui` checks it with every other TUI package (`--bless` accepts the current renders); `cargo xtask inspect install-docs` renders a page. Snapshots live in `snapshots/<columns>x<rows>/<page>.txt`; add a file to snapshot another page or size. The status bar's page count is masked (`levitate.inspect.mask` in `package.json`).
