# Claude Code

Read and follow [AGENTS.md](./AGENTS.md). That file holds the repo map, current state, and backlog. Policy changes go there.

@AGENTS.md

Standing rules, in short:

- Commit each coherent slice as soon as it is correct. Message format is `Type: Subject` with start-case types (`Feature`, `Improvement`, `Fix`, `Refactor`, `Perf`, `Test`, `Build`, `Chore`, `Docs`). See `.commitlintrc.js`. Push only when asked.
- Keep external standards working: G-code read/emit, Luban header comments, Marlin, SACP, SSTP, and STL/3MF/AMF/SVG/DXF import. Update in-repo callers and delete the old internal path in the same commit. Leave a slower path in place only when a standard requires its results.
