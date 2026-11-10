# AGENTS.md

Instructions for coding agents working in Luban-Next. This file is the source of truth. `CLAUDE.md` and `.github/copilot-instructions.md` point here. It stays version-agnostic: do not record releases, dates, or feature history here. `README.md` and the git history hold those. Edit this file only when a standing rule, the repo map, a command, or the backlog changes.

## What this is

Luban-Next is a fork of [Snapmaker Luban](https://github.com/Snapmaker/Luban) (AGPL-3.0-or-later): an Electron app for Snapmaker 3-in-1 machines. It prepares toolpaths and G-code for 3D printing, laser, and CNC, and it talks to the machine. Fork remote: `git@github.com:JPaulMora/Luban-Next.git`.

`README.md`, `CONTRIBUTING.md`, and `docs/Development.md` name the app Luban Next. Use those for install steps and the commit message format. Use this file for how to change the fork.

## Standing rules

### Commit incrementally

Each commit is one coherent slice that leaves the tree consistent: one fix, one behavior change, or one refactor with its caller updates.

- Commit when that slice is correct. Run the lint and tests that cover it first.
- A delete of an old path plus the caller updates belongs in one commit. An unrelated cleanup belongs in another.
- Follow `.commitlintrc.js`. The `commit-msg` hook rejects anything else after `npm install` (Husky 4).
- Format: `Type: Subject`, blank line, optional body. Types are start case: `Feature`, `Improvement`, `Fix`, `Refactor`, `Perf`, `Test`, `Build`, `Chore`, `Docs`. Subject is sentence case, imperative, no trailing period. Header 20–100 characters, subject ≤80, each line ≤80.
- Example: `Refactor: Parse G-code words in one pass`
- Push only when asked. If the hook rejects a commit, fix the problem and make a new commit.

### Keep standards, replace internal code

External contracts stay behavior-compatible. Internal code does not get a compatibility shim.

Keep these working. Add or extend a test when you change them:

- G-code reading and emission. `src/shared/lib/gcodeParser.js` (`parseLine`, `parseString`, `parseFile`, and the sync variants) and `src/shared/lib/gcodeInterpreter.js` must keep accepting the dialects already handled: RepRap-style words, parentheses and semicolon comments, `N` line numbers, `*` checksums, Grbl `$` commands, `%` and `{...}` lines. Luban header comments parsed in `src/server/lib/parseGcodeHeader.js` (`;header_type`, extents, temperatures, speeds) stay valid. Extensions `.gcode`, `.nc`, and `.cnc` still select print, laser, and CNC.
- Machine protocols actually spoken to firmware: Marlin text serial (`src/server/controllers/Marlin/`), SACP serial/TCP/UDP, SSTP HTTP (`src/server/services/machine/channels/`).
- Import formats: STL, 3MF, AMF, SVG, DXF.
- Slicer definition keys consumed by `@snapmaker/snapmaker-lunar` and `snapmaker-luban-engine`.

For everything else, update every caller in this repo and delete the old path in the same change. That includes unused wrappers, dual implementations, obsolete parameter lists, and code kept only so an internal caller still compiles. A slower algorithm stays only when the standard above requires its results. Efficiency work must preserve those results.

Saved project files are user data. Read the project format this version writes. Remove a migration whose only job is an abandoned internal shape.

Three git submodules are upstream repos, not this tree: `packages/luban-print-settings`, `packages/luban-print-settings-docs`, `resources/luban-case-library`. Change them in their own repositories.

## Commands

Submodules are required and are not checked out on a fresh clone. Their URLs are SSH.

```bash
git submodule update --init
npm install
npm run dev          # dev build, webpack, tsc --watch, Electron server
npm run lint         # eslint + stylint
npm run eslint       # JS/TS lint; also the pre-push hook
npm test             # tape test/*.js only
npm run build && npm run build:mac-arm64
```

Renderer port `8080`, server port `8000` (`package.json` `config`). `engines.node` is `>=16`. Electron carries its own Node. Dependency versions live in `package.json`.

`@snapmaker/luban-platform` is TypeScript. The server webpack configs compile it into the server bundle. Node `require()` uses the CommonJS emit in `packages/luban-platform/dist`, produced by `npm run build:platform` (also the first step of `build:server`).

Husky hooks (`commit-msg` commitlint, `pre-push` eslint) activate at `npm install`. Native rebuild (`npm run electron-rebuild`) uses `build/electron-rebuild.sh` and a local Python venv so node-gyp can run on Python 3.12+. Packaging (`build/electron-builder.sh`) installs the packaged app with `--ignore-scripts` and then rebuilds `font-scanner` and `serialport` the same way. `electron-builder.yml` sets `npmRebuild: false` so electron-builder does not rebuild natives again with the system Python. Release packaging runs on GitHub Actions when a release is published, or from `workflow_dispatch`. A draft does not start a build until it is published. Runners: Intel Mac on `macos-15-intel`, Windows on `windows-2022`, Linux on `ubuntu-22.04`. Submodules are fetched over HTTPS. Notarization runs only when Apple credentials are set. The Apple Silicon package is built locally.

## Where code lives

| Path | Role |
| --- | --- |
| `src/main.js` | Electron main process: window, menu, auto-update |
| `src/server/` | Express, Socket.IO, slicing, toolpaths, machine I/O |
| `src/server/services/machine/` | `ConnectionManager`, channels, machine instances (SM2, Artisan, J1, Ray) |
| `src/server/services/task-manager/` | Worker tasks: toolpath, G-code, images, SVG clip, mesh cut |
| `src/server/slicer/` | LunarSlicer bridge |
| `src/server/lib/GcodeGenerator/` | G-code emission |
| `src/server/lib/ToolPathGenerator/` | Laser and CNC toolpaths |
| `src/app/` | React 18 renderer |
| `src/app/flux/` | Redux slices: `printing`, `laser`, `cnc`, `machine`, `workspace`, `project`, `editor` |
| `src/app/ui/pages/` | Home, print, laser, CNC, Ray laser workspace |
| `src/app/machines/` | Machine and toolhead definitions |
| `src/app/workers/` | Renderer workers, including G-code preview geometry |
| `src/shared/lib/` | Parsers shared by server and renderer |
| `test/` | Tape tests. `npm test` does not enter subfolders |

New code follows the language of the module it edits. When you rewrite a `.js` module, convert it to TypeScript in that change. Lint is Airbnb via `eslint-config-snapmaker` (`.eslintrc.js`). Styles are Stylus.

Machine channels and several Redux slices are large and carry hardcoded per-machine branches. The renderer runs with `nodeIntegration` and remote enabled. Renderer workers (`Pool.worker`, `clipperPool.worker`, `ClippingPoolManager.worker`) are webpack entries. Images and fonts use webpack asset modules.

## Goals and pending updates

Standing rules above are permanent. This list is the backlog. Add an item when you find work that should survive the session. Remove it in the commit that finishes it.

1. Cover `src/shared/lib/gcodeParser.js` and `parseGcodeHeader.js` with tape tests before changing parse results.
2. Collapse hardcoded branches in `ConnectionManager`, `SacpChannel`, and the machine instances. Bytes on the wire stay the same.
3. Replace mixed JS/TS one module at a time. The replacement lands with the caller updates; the old file goes away in that commit.
4. Work the dependency upgrade list in `docs/upgrades.md`, one commit per item. Electron 15 and the renderer’s Node integration stay the last project on that list.
5. Extend tests for any standard boundary you touch (Marlin, G-code emit, SVG/DXF/STL). `npm test` only loads `test/*.js`.

## Keeping this file true

Do not update this file to describe a release or a feature. Add a backlog item when the work should survive the session, and remove it in the commit that finishes it.
