# TUI workspace

Terminal apps built on a shared kit. A variant's `[install_ux]` names the apps its live ISO
carries (`docs` and `apps` in products.toml): today install-docs (LevitateOS) and disk-plan
(both). The builder compiles them into one binary per ISO, for that rootfs's libc, with a
command per app on PATH (`distro/builder/src/tui_binary.rs`). recab-tui ships nowhere yet.
Every app also runs from a checkout (`cargo xtask tui <name>`).

## Apps

The apps are the root workspace members under `tui/apps/`. Each declares itself
once in its `package.json`: its single `bin` entry gives its name (also its
directory and `@levitate/<name>`) and entry file, and a `levitate` block lists the
Rust tools it runs from PATH and its `inspect` arguments.

- `install-docs`: the install guide shown in the right pane of the live ISO's install screen.
- `disk-plan`: interactive disk planning on top of `recpart`.
- `recab-tui`: the A/B slots at a glance (which runs, boots next, is known-good, and how the last trial ended) and `recab`'s changes (try the other slot, commit, roll back, write a new system, reboot), each shown before and after it runs.

Each manifest's `description` is the app's one-line summary, for `tui list` and the app's `--help`.

## Kit

- `kit/core`: runtime, primitives, components, chrome and theme.

Every package is a member of the root JavaScript workspace (root `package.json`
and `bun.lock`): the kit lists `ink` and `react` as peer dependencies so every
app and the kit share one copy. Lint and format use the root `.oxlintrc.json`
and `.oxfmtrc.json`.

`cargo xtask tui list` lists the apps (what each is for, its tools, pages and stories). Run one
with `cargo xtask tui <name>` (it builds the app's Rust tools and puts them on PATH first). Headless runs use stand-ins instead: each app's `levitate.inspect.path`
holds a stand-in for every tool it runs (`fixtures/`), so they never touch a disk or firmware.

- `cargo xtask tui <name> --stand-ins` runs it in your terminal with the stand-ins, to try its
  cases by hand; `--story NAME` starts it in a story's state (its arguments and environment).
  disk-plan's stand-in lists every fixture disk with `RECPART_FIXTURE_DISKS=all`, and plans an
  edited layout nothing recorded with this checkout's recpart against the fixture disk (never
  applying it).
- `cargo xtask inspect <name>` renders one screen (`--story NAME` opens a story, `--input` types keys).
- `cargo xtask check tui` checks every TUI package: typecheck, lint, format, renders (including each
  variant's docs pane at the install screen's sizes), snapshots, and every story.

## Stories

A story is a named state of an app, declared in its manifest's `levitate.inspect.stories`: the
arguments and environment to start it with (for example `RECAB_FIXTURE=fail` to make the stand-in
fail) and the keys that reach the state, each step optionally with text the screen must show.
`check tui` runs them; `cargo xtask inspect <app> --story NAME` renders one.
