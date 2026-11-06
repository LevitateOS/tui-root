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
bun install            # at the repo root: one workspace, one lockfile
bun run typecheck
bun run lint
bun run format:check
bun run test:e2e
bun run inspect:check
```
