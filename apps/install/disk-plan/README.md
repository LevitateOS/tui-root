# disk-plan

Interactive disk planning on top of `recpart`: choose a disk and mode, review the plan
and the exact commands, pass the preflight, type the confirmation token, apply, and get
the handoff. `install-hub` starts it on the live ISO.

## Layout

- `src/flow.ts`: the pages (title, phase, gate), where Next and Back lead, including the
  branch after the apply, and how the rail marks each step.
- `src/app/plan-runner.ts`: the recpart command lines and reading recpart's documents
  (with the generated `readRecpartOutput`).
- `src/presentation/use-recpart.ts`: runs recpart for a page; `pages.tsx`: one component
  per page, built from `blocks.tsx` (heading, section, callout, table, disk bar, step list,
  command block), so every page has the same hierarchy; `disk-plan-screen.tsx`: state, keys,
  the step rail and the frame. A page taller than its pane scrolls with space/b.
- `src/generated/recpart.ts`: written by `cargo xtask gen` from recpart's Rust types.

recpart owns partitioning, its safety checks and its JSON; this app owns the flow and
shows every command it ran.

Run it with `cargo xtask tui disk-plan`; `bun src/main.tsx --help` lists flags and keys. Headless runs (`cargo xtask inspect`,
`cargo xtask check tui`) use `fixtures/recpart`, a stand-in that answers from recorded
documents for a fake disk and never touches a device.
