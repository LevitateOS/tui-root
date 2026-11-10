# CLAUDE.md - install-docs

## What is install-docs?

Terminal viewer for the docs in `@levitate/docs-content`. The launcher names the distro (`--os-name`) and the first page (`--slug`); the app holds no distro tables and reads nothing from the running system.

- `src/main.tsx`: flags (`--slug`, `--os-name`, `--pages`, `--pane`), page check, startup.
- `src/docs.ts`: one distro's pages (docs-content's shared pages and that distro's own), in nav order; links and section jumps.
- `src/layout/`: a page laid out as styled lines with link/command anchors.
- `src/presentation/ink/`: the viewer screen, sidebar, status bar, keys and theme.

## What Belongs Here

- Docs UI behavior and navigation
- Docs slug guards and session flow
- Rendering pipeline for docs content blocks

## What Does NOT Belong Here

| Don't put here | Put it in |
|----------------|-----------|
| Documentation content | `docs/content/` |
| Website rendering | `docs/website/` |
| Generic terminal primitives | `tui/kit/core/` |

## Key Rules

1. This app shows every page in the docs navigation from `@levitate/docs-content`, as the distro named by `--os-name` has it; every distro has the same slugs. A missing or unknown `--os-name` exits 2.
2. An unknown `--slug` exits 2; without `--slug` the first page opens.
3. No hidden fallbacks that bypass canonical docs navigation.
4. Keep generic, vocabulary-free UI code in `tui/kit/core` (styled runs and their wrapping, nav lists, the frame, keys); keep docs-specific code (markup parsing, link rendering, command rows, block layout) here.
