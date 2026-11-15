# TUI workspace

Terminal apps built on a shared kit, and what the live ISO's install screen runs.

## The install screen

There is no menu in front of the shell. Each live console starts the install screen, which is two panes: a root shell on the left and the installation guide (`install-docs`) on the right. The guide presents the helper apps and the manual commands as alternatives: use `disk-plan`, `base-system` and `system-setup`, or type the commands yourself. Running the three helpers is not a finished installation. Each one ends by saying so and naming the next step, through the guide's Boot and Finish steps. The install screen contract (`distro/contract/src/install_ux.rs`) names the apps every live ISO carries; the builder compiles them into one binary per ISO (`distro/builder/src/tui_binary.rs`). Every app also runs from a checkout.

## Where things live

- **Apps:** root workspace members under `tools/tui/apps/`. Each declares itself once in its `package.json`: the `bin` entry gives its name and entry file, `description` is its one-line summary, and a `levitate` block lists the Rust tools it runs and its `inspect` arguments, stand-ins and stories. Each app's README says what it is for.
- **Kit:** `tools/tui/kit/core` (generic runtime, components, theme), and `tools/tui/kit/install-state` (the state file the install apps share).
- **Commands:** `cargo xtask tui list` lists the apps; `cargo xtask tui --help`, `cargo xtask inspect --help` and `cargo xtask check --help` are the reference for running, rendering and checking them.
- **Stand-ins and stories:** headless runs use the stand-ins named by an app's `levitate.inspect.path` (`fixtures/`) instead of real tools; a story is a named state declared in `levitate.inspect.stories`.
- **JavaScript workspace:** every package is a member of the root workspace (`package.json`, `bun.lock`); lint and format use the root `.oxlintrc.json` and `.oxfmtrc.json`.
