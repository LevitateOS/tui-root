# TUI Kit Guidelines

These rules apply recursively to all descendants and submodules. Follow the repository's development guidelines. Unit tests and mandatory process gates are prohibited.

- The kit owns reusable React/Ink components, hooks, terminal input, focus, layout, and themes.
- Apps own product flows, docs schemas, navigation semantics, and backend orchestration. The kit must not import apps or carry their vocabulary (no docs, sidebar, command-row or disk names in kit code or theme intents).
- The only public entry is `@levitate/tui-kit` (`src/index.ts`), which exports exactly what the apps use; delete what no app imports. Keep ESM-only loading.
- Use React lifecycle and composable TSX components. Fix visual behavior in the component that owns it.
- Keep changes proportional to the defect. Use the observed terminal output to assess rendering fixes.
- Use typechecking or a focused terminal run when useful; do not require decision matrices, reclassification gates, or extra approval rounds.
