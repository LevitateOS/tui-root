# install-docs

Terminal viewer for the docs in `@levitate/docs-content`, built on `@levitate/tui-kit`. The install screen's launcher passes `--os-name` (the distro whose docs to show; there is no default) and the page flag its manifest declares (`--slug`).

Style change map: `style-map.md`

## Usage

```bash
bun src/main.tsx --os-name LevitateOS
bun src/main.tsx --os-name AcornOS --slug installation
```

On the live ISO the builder bundles it as `install-docs`, which the install screen (`install-ux`) runs in its right pane.

`--pages` prints every page slug, one per line.

## Keys

`bun src/main.tsx --help` lists every key; the status bar shows the ones that work in
the focused pane. Both come from `src/presentation/ink/keymap.ts`.

## Development

```bash
cargo xtask check tui           # typecheck, lint, format, renders, snapshots for every TUI package
cargo xtask check tui --bless   # accept the current renders as the snapshots
cargo xtask inspect install-docs --stdout -- --os-name AcornOS --slug installation
```

Snapshots live in `snapshots/<columns>x<rows>/<page>.txt`; add a file to snapshot another
page or size. The status bar's page count is masked (`levitate.inspect.mask` in
`package.json`), so docs edits elsewhere don't fail them.
