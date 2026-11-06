# TUI workspace

Terminal apps for the LevitateOS live ISO and installer, built on a shared kit.

## Apps

- `apps/live-tools/install-docs`: the live ISO's install guide and split-pane install session.
- `apps/install/disk-plan`: interactive disk planning on top of `recpart`.
- `apps/runtime/recab`: A/B slot status and switching on top of `recab`.

## Kit

- `kit/core`: runtime, primitives, components, chrome and theme.
- `kit/presets-install`: install UX compositions shared by the apps.
- `kit/testing`: test harness and snapshot helpers.

Run an app with `cargo xtask tui <app>`, render one headlessly with
`cargo xtask inspect tui <app>`, and typecheck everything with `cargo xtask check`.
