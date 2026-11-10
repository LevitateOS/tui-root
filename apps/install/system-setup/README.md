# system-setup

The install's configuration step on top of `recsetup`: read the new system, ask for the
keyboard layout, time zone, language, hostname, root password and a user, show the exact
commands recsetup would run, apply them after a yes, and record the step in the install
state file. `install-hub` starts it once the base step is done; both distros' live ISOs
ship it.

The keyboard comes first and is loaded on the live console (`loadkeys`) as soon as it is
chosen (or tried), so the passwords typed after it come out the same on the installed system.
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
- `src/domain/keyboard.ts`: the families of layouts and their letter rows;
  `src/domain/locale.ts`: a locale's formats.
- `src/domain/zones.ts`: a zone's clock now, the letters a search matched, and the world
  map; `src/app/zones.ts` reads where each zone is from the tz database's own tables
  (the target's, else the live system's).
- `src/domain/land.ts`: where there is land, a bitmap written by `scripts/land-mask.ts`
  from Natural Earth's 1:110m land polygons (public domain).
- `src/presentation/use-setup.ts`: the question being asked and the runs;
  `pages.tsx`: one component per kind of page; `cards.tsx`: the machine card, the cards
  beside the questions and the command sheet; `setup-screen.tsx`: keys, the step path
  and the frame.

## Pages

Every page opens with a heading (a step's number beside it on the questions) and ends
with one bar to press or one quiet line, on the same row (`AppShell`'s action).

- **Overview, Review and Done** are one card: the machine, six lines (keyboard, time
  zone, language, hostname, root password, user), empty at the start, filled as each is
  answered, and with its bar in the accent once all six are. On the review page a number
  before each line is the key that jumps to that question (`1` to `6`), and `space` turns
  the page to the commands recsetup would run, each inside the new system, and back. A
  yes-or-no goes above the card; a stopped apply shows the commands with the failed one
  raised, what it printed and recsetup's fix.
- **Every question is two columns of one height**: the list or the field at the left, a
  card at the right (`src/presentation/cards.tsx`, drawn cell by cell). With too little
  width the card goes under a field or, beside a list, is left out.
  - Keyboard: the family of the selected layout, its letter rows with the keys that
    differ from QWERTY marked (a layout that differs in more than five shows none), and a
    line to try the layout on: `Tab` loads the layout on this console and moves typing to
    that line, and back. The family comes from where the map's file lies under the target's
    keymaps (`usr/share/kbd/keymaps/.../qwertz/de.map.gz`), else the live system's
    (`src/app/keymaps.ts`); a family not known here shows no keys.
  - Time zone: the zone's clock beside each name, and a card with the city, its distance
    from UTC, the zone on a dotted map and its clock now. The map needs braille
    characters, which a terminal emulator has and the bare Linux console's font may not.
  - Language: how the locale writes today's date, a time (in the chosen zone) and a number,
    from `Intl` (`src/domain/locale.ts`).
  - Hostname: the login line, a prompt and the network name with the typed name in them.
    A refusal marks the offending character in the field and shows recsetup's message and
    fix under it. recsetup says which character: the app asks it whether the name would do
    with each character replaced by a letter, and marks the one whose replacement does.
  - Root password and the user's: both entries, a line that fills with the length, and
    what each choice means.
  - User: the account as it will exist.

recsetup owns every rule: a typed hostname or user name is checked by planning it, and
the app shows recsetup's message and fix. This app owns the order of the questions and
shows every command before it runs.

Run it with `cargo xtask tui system-setup`; `--help` lists flags and keys. Headless runs
use `fixtures/recsetup` and `fixtures/loadkeys`, stand-ins that print the tool's JSON and
touch nothing; their header comments list the failures they can play.
