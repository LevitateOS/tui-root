# system-setup

The install's configuration step on top of `recsetup`: read the new system, ask for the
keyboard layout, time zone, language, hostname, root password and a user, show the exact
commands recsetup would run, apply them after a yes, and record the step in the install
state file. `install-hub` starts it once the base step is done; both distros' live ISOs
ship it.

The keyboard comes first and is loaded on the live console (`loadkeys`) as soon as it is
chosen, so the passwords typed after it come out the same on the installed system.
Passwords are typed twice, shown as dots, and go to `recsetup apply --passwords-stdin`
on its standard input: never into a command line, a file or the install state.

## Layout

- `src/domain/setup.ts`: the session (the system, the answers, the plan, the apply), the
  questions in order, how far each has got for the rail, and narrowing a list.
- `src/domain/recsetup.ts`: recsetup's JSON documents as far as the app reads them,
  written by hand from its Rust types (`tools/recstrap/src/bin/recsetup`) until
  `cargo xtask gen` writes them.
- `src/app/runner.ts`: the command lines, reading the documents, the target from
  `--target` or the disk step, and recording the setup step.
- `src/presentation/use-setup.ts`: the question being asked and the runs;
  `pages.tsx`: one component per kind of page; `setup-screen.tsx`: keys, the step rail
  and the frame.

recsetup owns every rule: a typed hostname or user name is checked by planning it, and
the app shows recsetup's message and fix. This app owns the order of the questions and
shows every command before it runs.

Run it with `cargo xtask tui system-setup`; `--help` lists flags and keys. Headless runs
use `fixtures/recsetup` and `fixtures/loadkeys`, stand-ins that print the tool's JSON and
touch nothing; their header comments list the failures they can play.
