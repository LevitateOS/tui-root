# TUI workspace

Terminal apps built on a shared kit. Only install-docs ships today: the live ISO's install
screen shows it. disk-plan and recab-tui run from a checkout (`cargo xtask tui <name>`).

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
them on PATH first). Headless runs use stand-ins instead: each app's `levitate.inspect.path`
holds a stand-in for every tool it runs (`fixtures/`), so they never touch a disk or firmware.

- `cargo xtask inspect <name>` renders one screen (`--story NAME` opens a story, `--input` types keys).
- `cargo xtask check tui` checks every TUI package: typecheck, lint, format, renders (including each
  variant's docs pane at the install screen's sizes), snapshots, and every story.
- `cargo xtask stories` serves a page of live terminals (xterm.js), one per story, each running the
  real app; it also has each variant's whole install screen. From another machine, tunnel the port:
  `ssh -L 7681:127.0.0.1:7681 <this host>`, then open http://127.0.0.1:7681/.

## Stories

A story is a named state of an app, declared in its manifest's `levitate.inspect.stories`: the
arguments and environment to start it with (for example `RECAB_FIXTURE=fail` to make the stand-in
fail) and the keys that reach the state, each step optionally with text the screen must show. The
gallery and `check tui` run the same real app with the same stories; there is no separate story UI.
