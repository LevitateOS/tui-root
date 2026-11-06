# CLAUDE.md - install-docs

## What is install-docs?

Terminal viewer for the docs in `@levitate/docs-content`. The launcher names the docs (`--title`) and the first page (`--slug`); the app holds no distro tables.

- `src/main.tsx`: flags, page check, startup.
- `src/docs.ts`: the pages docs-content has, in nav order; links and section jumps.
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

1. This app shows every page in the docs navigation from `@levitate/docs-content` (no scoping by product or distro).
2. An unknown `--slug` exits 2; without `--slug` the first page opens.
3. No hidden fallbacks that bypass canonical docs navigation.
4. Keep generic, vocabulary-free UI code in `tui/kit/core` (styled runs and their wrapping, nav lists, the frame, keys); keep docs-specific code (markup parsing, link rendering, command rows, block layout) here.
