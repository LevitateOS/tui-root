# install-hub

The install's steps in order (preflight, disk, base system, configuration, boot, finish),
each marked done, current or waiting. Enter does the selected step: it starts the step's
app (disk-plan), runs the install guide's commands in this terminal, or opens a shell
with them to type. When that ends the hub comes back and reads where the install stands
from the install state file (`@levitate/install-state`, `/run/levitate-install/state.json`).
`s` is a shell at any time.

Steps without an app of their own yet (base, configuration, boot) run or show the guide's
commands, filled in from the disk step: the target, the slots or the root device.

```bash
cargo xtask tui install-hub
LEVITATE_INSTALL_STATE=fixtures/disk-done.json bun src/main.tsx
```
