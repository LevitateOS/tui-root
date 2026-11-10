# install-hub

The install's steps in order, each marked done, current or waiting. The steps, their
commands and the guide section of each are the install procedure
(`@levitate/docs-content/install`); the hub renders them for the distro the launcher names
(`--os-name`). Enter does the selected step: it starts the step's app (disk-plan,
base-system, system-setup) or runs the step's commands in this terminal. When that ends
the hub comes back and reads where the install stands from the install state file
(`@levitate/install-state`; `--help` names its path). `s` is a shell at any time; the
configuration step typed there from the guide is marked done with `d`.

Run it with `cargo xtask tui install-hub`.
