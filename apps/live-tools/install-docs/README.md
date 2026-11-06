# install-docs

Interactive terminal docs viewer for LevitateOS, built on `@levitate/tui-kit`.

Style change map: `style-map.md`

## Usage

```bash
bun src/main.ts
bun src/main.ts --slug installation
```

On the live ISO the builder bundles it and launches it as `levitate-install-docs` in the install screen's right pane.

Legacy non-interactive flags (`--list`, `--page`, `--all`) were removed.

## Keybinds

- `q` / `Esc` / `Ctrl-C`: quit
- `h` / `l`: previous/next page
- `j` / `k`: scroll
- `PgUp` / `PgDn`: fast scroll
- `g` / `G`: top/bottom

## Development

```bash
cargo xtask check tui           # typecheck, lint, format, renders, snapshots for every TUI package
cargo xtask check tui --bless   # accept the current renders as the snapshots
cargo xtask inspect install-docs --stdout -- --slug installation
```

Snapshots live in `snapshots/<columns>x<rows>/<page>.txt`; add a file to snapshot another
page or size. The status bar's page count is masked (`levitate.inspect.mask` in
`package.json`), so docs edits elsewhere don't fail them.
