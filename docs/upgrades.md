# Dependency upgrades

Tracked list for Luban Next, ordered from shortest to longest. Check an item when its commit is on `main`. Re-check the target version on npm before starting an unchecked item. The versions below were current on 10 Nov 2026.

One commit per item. Message format is `Chore: Update <package> to <version>` (see `.commitlintrc.js`). Install with `npm install <pkg>@<version> --save-exact --ignore-scripts` so the Electron native rebuild does not run. If `src/package.json` already lists the package, change that version string in the same commit. Do not run `build/pkgsync.js` for a version bump. It rewrites the whole dependency list.

Leave these alone until their own item says otherwise: Webpack 5.112, React 18.3.1, `@snapmaker/snapmaker-lunar`, `snapmaker-luban-engine`, the SACP SDK, Stylus, and the G-code, Marlin, SACP, and SSTP behavior.

After the commits through bcryptjs, `npm audit` reported 144 findings (11 critical), down from 167 (11 critical) just after `expr-eval` was removed.

## Hours

- [x] Remove `expr-eval`. Nothing under `src/` imported it.
- [x] Ant Design 4.24.16
- [x] Redux 4.2.1
- [x] jQuery 3.7.1
- [x] Moment 2.31.0
- [x] canvg 3.0.11
- [x] jsonwebtoken 9.0.3
- [x] shortid 2.2.17
- [x] Lodash 4.18.1
- [x] minimatch 3.1.5
- [x] semver 5.7.3
- [x] fs-extra 11.4.1
- [x] RxJS 7.8.2
- [x] JSZip 3.10.2
- [x] classnames 2.5.1
- [x] prop-types 15.8.1
- [x] async 3.2.6
- [x] loglevel 1.9.2
- [x] ESLint 7.32.0. Lint reported 0 errors and 311 existing warnings.
- [x] Commitizen 4.3.2
- [x] cookie-parser 1.4.7
- [x] compression 1.8.2
- [x] morgan 1.12.1
- [x] Babel 7.29.13 (`@babel/core` and `@babel/runtime` only)
- [x] Socket.IO 4.8.4 (server and client together)
- [x] React Router 5.3.4 and `history` 4.10.1
- [x] Replace `bcrypt-nodejs` with `bcryptjs` 3.0.3. Live call is `genSaltSync` in `src/server/index.js`.

## A day or two

- [ ] Express 4.22.3, `body-parser` 1.20.9, and `express-session` 1.19.0. Stay on Express 4. Retest the local server.
- [ ] `i18next-http-middleware` 3.10.0. Retest language detection. It is mounted in `src/server/app.js`.
- [ ] `@xmldom/xmldom` 0.9.12. Retest SVG, 3MF, and AMF import.
- [ ] `tar` 6.1.11 to 7.5.22. The caller is `src/server/lib/archive.js`.
- [ ] Replace `connect-multiparty` with `busboy`. The advisory has no patched release. `src/server/app.js` already names `busboy`.
- [ ] Replace `xlsx` with `exceljs` in the i18n scripts (`scripts/i18n-import-excel.js`, `scripts/i18n-export-excel.js`, `scripts/swap2.js`). `xlsx` 0.18.5 is still the latest and is unfixed.
- [ ] Gulp 4.0.2 to 5.0.1. `npm run build` is the check.
- [ ] Sign and notarize an arm64 release. The manual PR workflow already has the Apple secrets and `build:mac-arm64`. The release job still builds an unsigned Intel app. This does not require a new Electron.

## About a week

- [ ] `express-jwt` 6 to 8. The export and error shape change in `src/server/app.js`.
- [ ] `jimp` 0.16 to 1.x. Image stitch, relief, and the server image API.
- [ ] `i18next` 22 to 27, with `react-i18next` and `i18next-http-backend`.
- [ ] `xterm` to `@xterm/xterm` 6 and `@xterm/addon-fit`. One console widget.
- [ ] `webpack-dev-server` to 6, with `webpack-cli`. Dev server only.
- [ ] `uuid` 8 to a current major, or replace `shortid` with `nanoid`. The cost is CommonJS versus ESM.
- [ ] Replace `socketio-jwt` with Socket.IO middleware plus `jsonwebtoken` 9.
- [ ] Replace Moment with `dayjs` (or `date-fns`). One UI import, `src/app/ui/widgets/GCode/GCode.jsx`.
- [ ] `dexie` 3 to 4, `opentype.js` 0.9 to 2, and `workerpool` 6 to 10. Three separate commits.

## A few weeks

- [ ] TypeScript 4.4.4 to 5.9.3. Stop there before 6 and 7. This unblocks Redux 5 and current `@types/node`.
- [ ] Redux 4.2.1 to 5 and `react-redux` 7 to 9, after TypeScript 5.9.
- [ ] ESLint 7 to 9 or 10 with flat config, plus Husky 4 to 9. `eslint-config-snapmaker` 0.0.3 has no newer release, so that config has to be replaced or inlined.
- [ ] Ant Design 4 to 5.29.3, then 6.7.0. React 18 can stay. The Stylus overrides under `src/app/styles/` are the long part, because v5 drops Less variables for CSS-in-JS.

## The long projects

- [ ] Three.js 0.124 to 0.187, with `@react-three/fiber` and `three-mesh-bvh`. `THREE.Geometry` is gone after r125 and this repo still constructs it. Fiber 9 wants React 19, so the React 18 to 19 move lands here. Plan on the preview, SVG, and calibration views.
- [ ] Electron 15.5.7 to 45, with `electron-builder` 26, `electron-updater` 6.8 or newer, `@electron/rebuild` 4, `serialport` 13, and a `font-scanner` rebuild proof. In the same project: turn on `contextIsolation`, remove `@electron/remote`, and replace the home-screen `<webview>`. Electron 44 and 45 drop 32-bit builds, so `build:linux-ia32` goes away. This is also the upgrade that makes a supported macOS 27 build. Publish the signed arm64 artifact from the item above first if that box is still open.
