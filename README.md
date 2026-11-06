# TUI workspace

Terminal apps for the LevitateOS live ISO and installer, built on a shared kit.

## Apps

The apps are the root workspace members under `tui/apps/`. Each declares itself
once in its `package.json`: its single `bin` entry gives its name (also its
directory and `@levitate/<name>`) and entry file, and a `levitate` block lists the
Rust tools it runs from PATH and its `inspect` arguments.

- `install-docs`: the install guide shown in the right pane of the live ISO's install screen.
- `disk-plan`: interactive disk planning on top of `recpart`.
- `recab-tui`: A/B slot status and switching on top of `recab`.

## Kit

- `kit/core`: runtime, primitives, components, chrome and theme.

Every package is a member of the root JavaScript workspace (root `package.json`
and `bun.lock`): the kit lists `ink` and `react` as peer dependencies so every
app and the kit share one copy. Lint and format use the root `.oxlintrc.json`
and `.oxfmtrc.json`.

Run any app with `cargo xtask tui <name>` (it builds the app's Rust tools and puts
them on PATH first), render one headlessly with `cargo xtask inspect <name>` (`--input` types keys),
and typecheck everything with `cargo xtask check`.
