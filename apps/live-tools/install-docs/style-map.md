# Style map

Where to change how install-docs looks.

- Colours, glyphs and markers: `src/presentation/ink/theme/index.ts`. Each intent is one
  `#rrggbb` (or `"inherit"` for the terminal's own colour); admonition colours are
  `NOTE_COLORS` there. Every colour goes through the kit's `resolveColor`, so chalk adapts it
  to the terminal (256 or 16 colours) and `NO_COLOR` turns all of it off. No component holds a
  colour literal.
- How each content block becomes lines (text, code, command, table, list, conversation,
  interactive, qa, note): `layoutBlock` in `src/layout/page.ts`, one case per block kind.
- Shell syntax colouring in code and command lines: `src/layout/syntax-markup.ts`.
- The page list: `src/presentation/ink/components/sidebar.tsx`.
- The status line: `src/presentation/ink/components/status-bar.tsx`.
- The frame (panes, titles, scrolling): the kit's `AppShell`, used by
  `src/presentation/ink/screens/install-viewer.tsx`.
