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
  per page, each opening with the kit's `Heading` (the step's number, or a tick or warning
  where the page says how it ended); `pictures.tsx`: the parts the kit does not carry (the
  overview's line, the disks to choose from, the slot cards, the layout's needs, the labels
  under a bar) and the functions that turn recpart's documents into `DiskBar` parts;
  `partition-editor.tsx`: the Partitions page; `disk-plan-screen.tsx`: state, keys, the
  step path, the step line, the action row and the frame. A page taller than its pane
  scrolls with space/b.
- `src/generated/recpart.ts`: written by `cargo xtask gen` from recpart's Rust types.

recpart owns partitioning, its safety checks and its JSON; this app owns the flow and
shows every command it ran.

Run it with `cargo xtask tui disk-plan`; `bun src/main.tsx --help` lists flags and keys. Headless runs (`cargo xtask inspect`,
`cargo xtask check tui`) use `fixtures/recpart`, a stand-in that answers from recorded
documents for a fake disk and never touches a device.

## Pages

Each page is laid out as its mock-up in `docs/tui-design` (`check.py app:disk-plan`):

- Overview: the line where writing starts (choose and review are safe, apply writes).
- Disk: each disk as a bar as long as its share of the largest disk, its name and size,
  one line about it; the chosen one has the accent edge.
- System: A/B and Mutable as the slots each leaves, one sentence each.
- Disk use: the disk now, then each answer as the disk it leaves (erasing: the template's
  plan; keeping: what is there, with the free space).
- Partitions: the bar with the selected stretch marked, the table with the selected row as
  a bar, what the layout still needs beside it; the row's actions are the footer's keys.
- Plan and Confirm: the disk now over the disk after; Plan then lists only what changes.
- Commands, Apply: the run sheet; while recpart writes, the progress bar is empty, because
  recpart reports the commands only when it ends.
- Checks: recpart's one verdict and what its dry run says (commands listed, disk checks).
- Confirm: one sentence of what it costs and the word typed a cell a letter.
- Done: the bar of the disk it made with where each part is mounted.
