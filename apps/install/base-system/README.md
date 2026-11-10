# base-system

The install's base step on top of `recstrap` and `recfstab`: check the target, copy the
system onto it with a progress bar, review the fstab entries (and any lines already in
the target's fstab they would replace), write them, and record the step in the install
state file. `install-hub` starts it once the disk step is done; both distros' live ISOs ship it.

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

## Pages

Each page is laid out after the mock-ups in `docs/tui-design` (the "base-system" set):
the rail is the kit's `StepPath`, the step line shows the three steps, and the page's one
action is the bar at the foot (`pageAction` in `pages.tsx`).

- Overview: `FromTo` (the live image onto the target) and the disk step's mount table.
- Check: a gauge of the image's size against the target's free space and the count of
  checks that passed (recstrap reports a count, not names). A refusal is plain text under
  a warning heading: recstrap's message in the error colour, its remediation under it.
- Copy: `BigFigure` for the percentage beside four facts, then the bar.
- fstab: the file as a diff built from recfstab's result (entries coming in, conflicting
  lines going out, other lines staying); the replace question is a `Callout` with its two
  keys over the lines it is about.
- Done: three figures (files, written, taken) and where the step was recorded.

recstrap and recfstab own the checks, the copy and the fstab; this app owns the flow and
shows every command it ran.

Run it with `cargo xtask tui base-system`; `--help` lists flags and the install state file's path. Headless runs use `fixtures/recstrap` and `fixtures/recfstab`, stand-ins that print the tools' JSON and touch nothing; their header comments list the failures they can play.
