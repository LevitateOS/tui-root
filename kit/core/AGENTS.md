# TUI Kit Guidelines

These rules apply recursively to all descendants and submodules. Follow the repository's development guidelines. Unit tests and mandatory process gates are prohibited.

- The kit owns reusable React/Ink components, hooks, terminal input, focus, layout, and themes.
- Apps own product flows, docs schemas, navigation semantics, and backend orchestration. The kit must not import apps.
- Public exports are `@levitate/tui-kit` and `@levitate/tui-kit/theme`; keep ESM-only loading.
- Use React lifecycle and composable TSX components. Fix visual behavior in the component that owns it.
- Keep changes proportional to the defect. Use the observed terminal output to assess rendering fixes.
- Use typechecking or a focused terminal run when useful; do not require decision matrices, reclassification gates, or extra approval rounds.
