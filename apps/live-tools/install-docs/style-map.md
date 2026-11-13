# Style map

Where to change how install-docs looks.

- Colours: the kit's theme intents (text, info, dimText, faintText, highlight, accent,
  panelBackground, selection); this app names no literal colour except the syntax colours
  a code block's content carries. The distro's dark palette (terminal apps are dark on both distros) and the flat band of `--pane`: `src/presentation/ink/theme/index.ts`, which also
  holds the pane widths.
- How each content block becomes lines (text, code, command, table, list, conversation,
  interactive, qa, note): `layoutBlock` in `src/layout/page.ts`, one case per block kind.
- The reading measure (`MEASURE`), the command block and the numbered titles: `src/layout/page.ts`.
- Syntax colouring in code blocks: `src/layout/syntax-markup.ts` reads the markup; the docs
  build bakes the dark colouring only (`highlightedLines`, a plain list of lines).
- The page list: `src/presentation/ink/components/sidebar.tsx`.
- The status line: `src/presentation/ink/components/status-bar.tsx`.
- The frame (panes, titles, scrolling): the kit's `AppShell`, used by
  `src/presentation/ink/screens/install-viewer.tsx`.
