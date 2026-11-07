# base-system

The install's base step on top of `recstrap` and `recfstab`: check the target, copy the
system onto it with a progress bar, review the fstab entries (and any lines already in
the target's fstab they would replace), write them, and record the step in the install
state file. `install-hub` starts it once the disk step is done; both live ISOs ship it.

## Layout

- `src/domain/base.ts`: the session (the check, the copy as its events arrive, the fstab
  read and write), how far each step has got for the rail, and the formatting.
- `src/app/runner.ts`: the command lines, reading recfstab's document and the tools'
  error documents (with the generated readers), the target from `--target` or the disk
  step, and recording the base step.
- `src/presentation/use-base.ts`: runs the tools (the copy streams `recstrap --json`
  events through the kit's `startCommand` `onLine`); `pages.tsx`: one component per page;
  `base-screen.tsx`: keys, the step rail and the frame.
- `src/generated/recstrap.ts`: written by `cargo xtask gen` from recstrap's Rust types
  (`tools/recstrap/src/output.rs`).

recstrap and recfstab own the checks, the copy and the fstab; this app owns the flow and
shows every command it ran.

## Run

```bash
cargo xtask tui base-system -- --target /mnt
cargo xtask tui list base-system
```

Without `--target` it takes the disk step's target from the install state file
(`LEVITATE_INSTALL_STATE`, default `/run/levitate-install/state.json`). Headless runs
use `fixtures/recstrap` and `fixtures/recfstab`, stand-ins that print the tools' JSON
and touch nothing; their header comments list the failures they can play.
