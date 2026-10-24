# Luban-Next

Full instructions, repo map, current state, and backlog: [AGENTS.md](../AGENTS.md). Change policy there.

This is a fork of Snapmaker Luban (Electron + React + a Node server) for 3D print, laser, and CNC. `README.md` still describes the upstream repo.

## Commits

Commit each coherent slice when it is correct. One fix, one behavior change, or one refactor plus its caller updates. Push only when asked.

`Type: Subject` per `.commitlintrc.js`. Types: `Feature`, `Improvement`, `Fix`, `Refactor`, `Perf`, `Test`, `Build`, `Chore`, `Docs`. Sentence-case imperative subject, no trailing period. Header 20–100 characters.

## Compatibility

Keep G-code reading and emission, Luban `;header_*` comments, Marlin text, SACP, SSTP, and STL/3MF/AMF/SVG/DXF import behavior. Cover parser changes with tape tests in `test/*.js`.

Update every caller in this repo and delete the old internal path in the same change. Keep a slower implementation only when one of those standards requires its results.

Do not edit the git submodules (`packages/luban-print-settings`, `packages/luban-print-settings-docs`, `resources/luban-case-library`) from this repo.

## Layout

- `src/main.js` Electron main
- `src/app/` React renderer, Redux in `src/app/flux/`
- `src/server/` Express, Socket.IO, slicer, machine I/O
- `src/shared/lib/gcodeParser.js` G-code parse boundary

`npm run dev` after `git submodule update --init` and `npm install`. `npm test` runs tape on `test/*.js` only. `npm run eslint` is the pre-push hook.
