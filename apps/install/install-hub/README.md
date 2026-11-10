# install-hub

The install's steps in order, each marked done, current or waiting. The steps, their
commands and the guide section of each are the install procedure
(`@levitate/docs-content/install`); the hub renders them for the distro the launcher names
(`--os-name`). Enter does the selected step: it starts the step's app (disk-plan,
base-system, system-setup) or runs the step's commands in this terminal. When that ends
the hub comes back and reads where the install stands from the install state file
(`@levitate/install-state`; `--help` names its path). `s` is a shell at any time; the
configuration step typed there from the guide is marked done with `d`.

Each page is drawn from the install state file. The rail is the six steps as a path, each
with what it left at its end. Preflight is one tile per check, and a failed check shows its
fix as a line, with nothing to press. The step you are at shows from what onto what and the
bar that starts its app (`d` marks the configuration step done when it was typed by hand).
A finished step shows what it left: the mounts and slots, the copy, the setup, the boot
entries. A step that waits shows what it will leave and one quiet line saying what it waits
for. Finish shows the machine as a card. The hub runs in half of the install screen, so both
panes stay side by side down to 60 columns.

Run it with `cargo xtask tui install-hub`.
