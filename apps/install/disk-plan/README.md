# disk-plan

Interactive disk planning on top of `recpart`: choose a disk and mode, review the plan
and the exact commands, pass the preflight, type the confirmation token, apply, and get
the handoff. It ships on no ISO yet (the variant decides; see the builder's TUI-app action).

## Layout

- `src/flow.ts`: the pages, each page's gate (the welcome page lists them), and where
  Next and Back lead, including the branch after the apply.
- `src/app/plan-runner.ts`: the recpart command lines and reading recpart's documents
  (with the generated `readRecpartOutput`).
- `src/presentation/use-recpart.ts`: runs recpart for a page; `pages.tsx`: one component
  per page; `disk-plan-screen.tsx`: state, keys and the frame.
- `src/generated/recpart.ts`: written by `cargo xtask gen` from recpart's Rust types.

recpart owns partitioning, its safety checks and its JSON; this app owns the flow and
shows every command it ran.

## Run

```bash
cargo xtask tui disk-plan [-- --disk /dev/sdX --mode ab]
```

`bun src/main.tsx --help` lists flags and keys. Headless runs (`cargo xtask inspect`,
`cargo xtask check tui`) use `fixtures/recpart`, a stand-in that answers from recorded
documents for a fake disk and never touches a device.
