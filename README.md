# TUI Workspace (Stub)

Centralized TUI workspace for LevitateOS.

## Layout

- `apps/*`: executable TUI applications by role/intent.
- `kit/core`: core runtime/primitives/components/chrome/theme.
- `kit/presets-install`: shared install UX compositions for live-tools and install apps.
- `kit/testing`: shared test harness/snapshot helpers for TUI apps.

## Ownership

- `apps/live-tools/install-docs` is the canonical live-tools session UX/docs app.
- Role-based apps are canonical (for example `apps/install/disk-plan`).
- `apps/recpart` is a temporary compatibility shim only, not a canonical owner.

This tree is scaffold-only and does not replace existing runtime flows yet.
