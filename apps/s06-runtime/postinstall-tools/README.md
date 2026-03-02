# s06-postinstall-tools

Stage 06 runtime A/B operations TUI for `recab`.

## Scope

- Runtime slot inspection (`recab status --json`)
- Runtime slot operations:
  - `recab set-next A`
  - `recab set-next B`
  - `recab commit`
  - `recab rollback`

This app is a thin TUI shell over `recab`. It does not perform package
composition, disk partitioning, or install-time bootstrapping.

## Usage

```bash
bun run src/index.ts
bun run src/index.ts -- --recab-bin /usr/bin/recab
```

## Hotkeys

- `j/k` or arrows: select action
- `enter`: execute selected action
- `r`: refresh runtime slot status
- `q`, `esc`, `ctrl-c`: quit
