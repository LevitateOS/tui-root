# install-docs

Interactive terminal docs viewer for LevitateOS, built on `@levitate/tui-kit`.

Style change map: `style-map.md`

## Usage

```bash
bun src/main.tsx
bun src/main.tsx --slug installation
```

On the live ISO the builder bundles it and launches it as `levitate-install-docs` in the install screen's right pane.

Legacy non-interactive flags (`--list`, `--page`, `--all`) were removed.

## Keys

`bun src/main.tsx --help` lists every key; the status bar shows the ones that work in
the focused pane. Both come from `src/presentation/ink/keymap.ts`.

## Development

```bash
cargo xtask check tui           # typecheck, lint, format, renders, snapshots for every TUI package
cargo xtask check tui --bless   # accept the current renders as the snapshots
cargo xtask inspect install-docs --stdout -- --slug installation
```

Snapshots live in `snapshots/<columns>x<rows>/<page>.txt`; add a file to snapshot another
page or size. The status bar's page count is masked (`levitate.inspect.mask` in
`package.json`), so docs edits elsewhere don't fail them.
