# AGENTS.md

Instructions for coding agents working in Luban-Next. This file is the source of truth. `CLAUDE.md` and `.github/copilot-instructions.md` point here. When a change moves the snapshot below, update **Current state** and **Goals and pending updates** in the same series of commits.

## What this is

Luban-Next is a fork of [Snapmaker Luban](https://github.com/Snapmaker/Luban) (AGPL-3.0-or-later): an Electron app for Snapmaker 3-in-1 machines. It prepares toolpaths and G-code for 3D printing, laser, and CNC, and it talks to the machine.

Upstream human docs (`README.md`, `CONTRIBUTING.md`, `docs/Development.md`) still describe `Snapmaker/Luban`. Use those for install steps and the commit message format. Use this file for how to change the fork.

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

Renderer port `8080`, server port `8000` (`package.json` `config`). `engines.node` is `>=16`. Electron 15 carries its own Node.

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

## Current state

As of 2026-10-24:

- Fork remote is `git@github.com:JPaulMora/Luban-Next.git`, branch `main`, version `4.16.0`. History matches upstream through `db573f5df` (`Feature: Update Chinese i18n`). First fork-only commits are the agent instruction files and the Python 3.12+ native rebuild wrapper. No open issues on the fork.
- Stack: Electron 15.5.7, React 18.3.1, Redux 4, Ant Design 4.24, Three 0.124, TypeScript 4.4.4, Webpack 5.112, Gulp 4, Socket.IO 4.5, Stylus. Renderer workers (`Pool.worker`, `clipperPool.worker`, `ClippingPoolManager.worker`) are webpack entries. Images and fonts use webpack asset modules. The renderer still runs with `nodeIntegration` and remote enabled.
- About 313 `.js`, 224 `.jsx`, 252 `.ts`, 148 `.tsx`, and 118 `.styl` files under `src` and `packages`. Machine channels and several Redux slices are large and carry hardcoded per-machine branches.
- Tape covers Marlin replies, the serial sender, and a few utilities. `gcodeParser.js` has no direct tests.
- Submodules are uninitialized until `git submodule update --init`. `docs/Development.md` has no macOS section. Husky hooks (`commit-msg` commitlint, `pre-push` eslint) activate at `npm install`. Native rebuild (`npm run electron-rebuild`) uses `build/electron-rebuild.sh` and a local Python venv so node-gyp 9 can run on Python 3.12+.
- Agent instructions are this file, `CLAUDE.md`, and `.github/copilot-instructions.md`.

## Goals and pending updates

Standing rules above are permanent. This list is the backlog. Add an item when you find work that should survive the session. Remove it in the commit that finishes it.

1. Cover `src/shared/lib/gcodeParser.js` and `parseGcodeHeader.js` with tape tests before changing parse results.
2. Collapse hardcoded branches in `ConnectionManager`, `SacpChannel`, and the machine instances. Bytes on the wire stay the same.
3. Replace mixed JS/TS one module at a time. The replacement lands with the caller updates; the old file goes away in that commit.
4. Plan remaining framework upgrades as their own slices: Electron 15 and the renderer’s Node integration. Each upgrade is a sequence of small commits with a stated behavior check.
5. Point `README.md` and `docs/Development.md` at this fork and add the macOS dev path. The next edit of those files should do it.
6. Extend tests for any standard boundary you touch (Marlin, G-code emit, SVG/DXF/STL). `npm test` only loads `test/*.js`.

## Keeping this file true

Edit **Current state** when the version, layout, toolchain, or test picture changes. Edit **Goals and pending updates** when an item finishes or a new one is real. Keep both short enough to load every session.
