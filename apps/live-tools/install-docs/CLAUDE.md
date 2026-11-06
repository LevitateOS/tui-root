# CLAUDE.md - install-docs

## What is install-docs?

Terminal documentation viewer for LevitateOS.

Built with a layered architecture:
- CLI/app orchestration
- domain filtering/policy
- React + Ink presentation
- text rendering pipeline

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

1. This app renders the full docs navigation tree from `@levitate/docs-content`.
2. Requested slugs must fail fast with explicit error when not in docs navigation.
3. No hidden fallbacks that bypass canonical docs navigation.
4. Keep generic, vocabulary-free UI code in `tui/kit/core` (styled runs and their wrapping, nav lists, the frame, keys); keep docs-specific code (markup parsing, link rendering, command rows, block layout) here.
