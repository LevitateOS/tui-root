# TUI workspace

Terminal apps built on a shared kit. A variant's `install_ux` (in its `distro.toml`) names the apps its live ISO carries; the builder compiles them into one binary per ISO (`distro/builder/src/tui_binary.rs`). Every app also runs from a checkout.

## Where things live

- **Apps:** root workspace members under `tui/apps/`. Each declares itself once in its `package.json`: the `bin` entry gives its name and entry file, `description` is its one-line summary, and a `levitate` block lists the Rust tools it runs and its `inspect` arguments, stand-ins and stories. Each app's README says what it is for.
- **Kit:** `tui/kit/core` (generic runtime, components, theme), and `tui/kit/install-state` (the state file the install apps share).
- **Commands:** `cargo xtask tui list` lists the apps; `cargo xtask tui --help`, `cargo xtask inspect --help` and `cargo xtask check --help` are the reference for running, rendering and checking them.
- **Stand-ins and stories:** headless runs use the stand-ins named by an app's `levitate.inspect.path` (`fixtures/`) instead of real tools; a story is a named state declared in `levitate.inspect.stories`.
- **JavaScript workspace:** every package is a member of the root workspace (`package.json`, `bun.lock`); lint and format use the root `.oxlintrc.json` and `.oxfmtrc.json`.
