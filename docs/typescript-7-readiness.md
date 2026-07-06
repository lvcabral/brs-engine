# TypeScript 7 Readiness

TypeScript 7.0 is the Go-native ("Corsa") compiler — same type-checking semantics as 5.x/6.x, ~10× faster.
It is **not yet a drop-in upgrade** for this repo, and this note records why and what to do when it is.

## Why we can't adopt TS 7.0 yet

TS 7.0 ships **without a stable programmatic compiler API until 7.1** (the old "Strada" API is unsupported).
Two build-critical tools call that API and therefore can't run against the native compiler on 7.0:

- **`ts-loader`** — transpiles every webpack bundle in all three packages (`packages/*/config/webpack.config.js`).
- **`@typescript-eslint`** — powers `npm run lint`.

Jest is unaffected (tests are plain `.js`, no `ts-jest`).

## What was already done (forward-compatible under TS 5.x)

TS 7.0 makes `moduleResolution: "node"` **and** `"node10"` hard errors. The bundler-based replacement was
applied ahead of time (webpack is the real module resolver here, so `"bundler"` is the correct target):

- `packages/node/config/tsconfig.json` — `moduleResolution: "node"` → `"bundler"` (module already `ESNext`).
- `packages/node/config/tsconfig.cli.json` — `moduleResolution: "node"` → `"bundler"`, and `module: "CommonJS"`
  → `"ESNext"` (required by `bundler`; webpack still emits `require()` for the `commonjs` externals, so the
  node output is unchanged functionally — full build + `npm test` + CLI smoke confirmed equivalent).
- `tsconfig.json` — added `"types": ["node"]`, because TS 7.0 defaults `types` to `[]` and would otherwise
  drop ambient globals (`Buffer`, `process`, `NodeJS.*`).
- `packages/scenegraph/tsconfig.json` — removed `baseUrl: "."` (TS 7.0 removes `baseUrl`). The `paths` there
  are already written relative to the config directory, so resolution is unchanged. (This is the editor/IDE
  config; the scenegraph build uses `config/tsconfig.json`, which never had `baseUrl`.)
- All `package.json` files — `typescript` pin bumped `^5.7.3` → `^5.9.3` (latest 5.x; stay on 5.x until the
  7.1 trigger conditions below are met). `ts-loader` and `@typescript-eslint` intentionally left unbumped.

The remaining `bundler` configs (root, browser, scenegraph) are already TS7-valid. `strict`, explicit
`module`/`target`, and `esModuleInterop: true` are all fine.

## Trigger conditions for the actual upgrade (7.1)

Flip only when **all** of these hold:

1. `ts-loader` publishes a release supporting the TS 7.1 native compiler API.
2. `@typescript-eslint` publishes TS 7.1-native support.
3. TS 7.x declaration emit is confirmed working for `packages/scenegraph`'s `tsc --project` step (the
   published packages ship `.d.ts` under `types/` — must not regress).

Then: bump `typescript` → `^7.x`, `ts-loader` and `@typescript-eslint/*` to native-compatible versions;
run `npm run build`, `npm test`, `npm run lint`, and `npm run build:sg` (build order caveat: `build:sg`
runs after `build:cli`); verify the CLI and — since the CLI has no task threads — SceneGraph/Task behavior
via `npm start` in the browser.
