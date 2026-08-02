# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Deep-dive docs — read the matching file BEFORE touching that area

This file is the map; the fragile invariants live in `.claude/docs/`. Each file below records
*why* code is shaped the way it is and which regression tests pin it. **Read the relevant one before
editing that area** — several of these behaviors have regressed more than once from changes that looked
like harmless simplifications.

| Read this | Before changing |
| --- | --- |
| [`.claude/docs/scenegraph-invariants.md`](docs/scenegraph-invariants.md) | Node rendering / `renderNode`, visibility vs. measurement, `Field` observer dispatch & deferral, `getBoundingRect`, focus chain, `ArrayGrid` focus/`scrollingStatus` emission order, `NodeFactory`/`addFields`, `Serializer.ts`, lazy fields/methods |
| [`.claude/docs/threading-and-rendezvous.md`](docs/threading-and-rendezvous.md) | `src/node/{host,task}.ts`, worker messaging, termination, `nodes/Task.ts` rendezvous, shared control array, debugger multi-thread halt |
| [`.claude/docs/packaging-encryption.md`](docs/packaging-encryption.md) | `--pack`/`.bpk`, `packageEncryption.ts`, `src/{cli,api}/package.ts`, FileSystem source overlay |
| [`.claude/docs/cli-terminal-rendering.md`](docs/cli-terminal-rendering.md) | `src/cli/display.ts`, terminal frame output (`-a`/`-u`/`-i`), `--log`, anything printing mid-run |

`docs/` (repo-level, user-facing) is the source of truth for usage: `build-from-source.md`,
`integrating.md`, `engine-api.md`, `customization.md`, `run-as-cli.md`, `using-node-library.md`,
`extensions.md`, `scenegraph-rendezvous.md`, `scenegraph-layout-passes.md`, `remote-control.md`,
`limitations.md`, `contributing.md`. `scenegraph-layout-and-clipping-gaps.md` records three
device-measured-or-blocked layout/clipping divergences and what each probe/fix needs — `LabelList`
marginY and `RowList` item-cell clipping still open; the `PosterGrid` caption zone is fixed, and its
section is kept as a worked example of a probe disproving every model that was proposed for it.

## Overview

**brs-engine** is a BrightScript Simulation Engine: an interpreter that runs Roku apps (channels) in web
browsers and Node.js. It simulates the BrightScript runtime, the Draw 2D API (`roScreen`, `roCompositor`,
`roRegion`, …), the SceneGraph framework, the Roku file system, registry, remote control, and the Micro
Debugger — targeting compatibility up to Roku OS 15. It is a development/automation tool, **not** a Roku
OS or hardware emulator. Originally forked from [rokucommunity/brs](https://github.com/rokucommunity/brs).

Node.js **v22+** is required to build and run the CLI.

## Monorepo layout

npm **workspaces** monorepo (root package `brs-engine-workspace`). All TypeScript lives in top-level
`src/`, compiled into three packages under `packages/`:

- **brs-engine** (`packages/browser`) — browser / Web Worker interpreter for web, PWA, Electron. Output:
  `lib/brs.api.js` + `brs.worker.js`, types in `types/`.
- **brs-node** (`packages/node`) — Node.js library plus the `brs-cli` command, ECP + SSDP servers. Output:
  `bin/{brs.cli.js, brs.ecp.js, brs.node.js}`; `brs.node.js` is both the package `main` and the **worker
  entry** for app/Task threads. The scenegraph build also copies `brs-sg.node.js` into `bin/` so the
  published package is self-contained (guaranteed version match + same-module-instance binding — a
  separately installed copy could resolve a second `brs-node` instance and silently fail).
- **brs-scenegraph** (`packages/scenegraph`) — SceneGraph runtime as a standalone **extension** bundle
  (`brs-sg.js` / `brs-sg.node.js`) that auto-loads when an app contains `pkg:/components/` assets. The npm
  package is what **browser** integrators install (to copy `lib/brs-sg.js` next to `brs.worker.js`); Node
  consumers use the copy bundled in `brs-node/bin/`.

### Required deployment asset: `assets/common.zip`

`packages/browser/assets/common.zip` (and the SceneGraph counterpart in `packages/scenegraph/`) is the
**`common:/` volume**: default fonts, system audio, CA certificates, and BrightScript library stubs
(`LibCore`, `roku_ads`, `roku_analytics`, `roku_browser`). **Any web app embedding the engine must serve
this file at `./assets/common.zip` relative to `brs.api.js`** — the API fetches it on startup. Missing it
means no fonts or system libraries, and most apps break.

**Build-order dependency (overwrite chain):** each package build zips a core-only `common.zip` from
`src/core/common/`, but the **scenegraph** build creates a superset (core +
`src/extensions/scenegraph/common/**` — Metropolis fonts, `system-fonts.json`, focus/dialog/keyboard
9-patches, video overlays) and its `afterEmit` hook copies that merged zip **over**
`packages/{browser,node}/assets/common.zip`. So `npm run build:node` alone **downgrades** the node
package's `common.zip` to core-only — always run `npm run build:sg` after `build:node` (the
`npm run build:cli` and the full `npm run build` orders this correctly; `prepublishOnly` too). Symptom of a
stale/core-only zip: ~20 `test/cli/cli.test.js` failures with `ENOENT: /common:/fonts/system-fonts.json`.

## Commands

Run from the repo root (scripts fan out to workspaces):

```bash
npm install              # install all workspace dependencies

npm run build            # dev build of all packages
npm run build:api        # build only brs-engine (browser)
npm run build:node       # build only brs-node (CLI/Node library)
npm run build:sg         # build only brs-scenegraph
npm run build:web        # build engine + scenegraph, open example web app
npm run build:cli        # build brs-node + scenegraph
npm run release          # minified production build
npm run clean            # remove compiled lib/ bin/ types/

npm start                # webpack-dev-server for the example web app

npm run lint             # eslint over ./src
npm run prettier         # check formatting (4-space indent, printWidth 120)
npm run prettier:write   # auto-format

npm test                 # vitest (config in vitest.config.mts)
```

Tests live in `test/` (`brsTypes/`, `core/`, `interpreter/`, `lexer/`, `parser/`, `preprocessor/`,
`stdlib/`, `extensions/`, `simulator/`, `cli/`). The e2e suite (`test/e2e/E2ETests.js`) compares
interpreter output against `.brs` fixtures in `test/e2e/resources/`. Test files are plain `.test.js`.

```bash
npx vitest run test/e2e/Functions.test.js   # single file
npx vitest run -t "name of the test"        # by test name
npx vitest run --update                     # refresh snapshots
```

After `npm run build:cli`, link the CLI: `cd packages/node && npm link`, then `brs-cli`.

## Core architecture

### Two-thread split (browser model)

The browser build is two bundles on **separate threads**, communicating via `postMessage` + a shared
`Int32Array` over `SharedArrayBuffer`:

- **API library** — entry `src/api/index.ts` → `brs.api.js`. Runs on the **main thread**: manages the
  worker, renders the display canvas (expects a `canvas` named `display` and a `video` named `player` on
  `document`), plays audio, routes remote/gamepad input, and exposes the public API (`initialize`,
  `subscribe`, `execute`, `terminate`, `sendKeyPress`, `debug`, …). See `docs/engine-api.md`.
- **Worker library** — entry `src/core/index.ts` → `brs.worker.js`. Runs in a **Web Worker** (browser) or
  **Worker Thread** (Node). Its `onmessage` receives a msgpack-encoded `AppPayload`/`TaskPayload` or the
  `SharedArrayBuffer` for control state (`BrsDevice.setSharedArray`). The interpreter executes here.

The Node build mirrors this split via `worker_threads` — host on the main thread, app and each SceneGraph
Task in workers. Details and its invariants (workers never print, host-driven termination, EXIT unwinding
`wait()` loops, realm-safe type guards): **[`.claude/docs/threading-and-rendezvous.md`](docs/threading-and-rendezvous.md)**.

### Interpreter pipeline (`src/core/`)

`lex → parse → preprocess → interpret`

- `lexer/` — tokenizer.
- `parser/` — builds the AST (`Expression.ts`, `Statement.ts`).
- `preprocessor/` — conditional compilation (`#const`, `#if`).
- `interpreter/` — tree-walking interpreter (`index.ts`, the execution core), plus
  `Environment.ts`/`Scope.ts`, `MicroDebugger.ts`, `Network.ts`.
- `LexerParser.ts` — orchestrates lex+parse and decodes precompiled/encrypted token streams.
- `index.ts` — wires the pipeline, handles app/task payloads, package (`.zip`/`.bpk`) loading and AES
  decryption, re-exports the public surface.

### Runtime types and components

- `brsTypes/` — BrightScript values: primitives (`Int32`, `Float`, `Double`, `BrsString`, `Boolean`),
  `Callable`, plus `Coercion.ts`/`Boxing.ts`.
- `brsTypes/components/` — the `roXxx` component objects (`RoArray`, `RoAssociativeArray`, `RoBitmap`, …);
  `BrsObjects.ts` is the `CreateObject` registry.

#### Anonymous functions must round-trip name → callable (`$anon_N`)

An unnamed `Callable` is auto-named `$anon_N` (`Callable.ts`); `toStr()` reports `<Function: $anon_N>`.
That name must stay **resolvable back to the same callable**, because some libraries extract a function
argument's name from `toStr()` and pass it to `observeField`/`observeFieldScoped` — notably
[rokucommunity/promises](https://github.com/rokucommunity/promises), which backs every Rooibos
`@SGNode`/node test suite (the observer registered this way advances its promise chain). So every anonymous
`Callable` is entered into a **capped registry** (`anonRegistry`, `resolveAnonymousCallable`), and
`Interpreter.getCallableFunction` falls back to it for `$anon_*` names when normal resolution fails.

**Invariants:** keep the name **deterministic** (a plain counter — a random/location id breaks stable
`toStr()` output and the `roFunction` e2e snapshot; memory is bounded by the cap, not the id scheme), and
keep the registry **capped** (anonymous callables are minted per evaluation). Regression: "Resolves an
anonymous function observer registered by its toStr() name" in `test/cli/cli.test.js`
(`anon-observer-app`).

#### Interfaces are method grouping, not separate types

Roku documents a component's methods under `ifXxx` interfaces, but **we do not implement each `ifXxx` as
its own type**. A component implements all its methods and registers them via
`registerMethods({ ifXxx: [...callables] })`, where the `ifXxx` key is just **metadata grouping** mirroring
the docs. Most methods are defined inline on the component class (e.g. `RoArray`'s `join`/`sort`).

`brsTypes/interfaces/` (`IfArray`, `IfEnum`, `IfHttpAgent`, `IfList`, `IfMessagePort`, `IfSocket`,
`IfToStr`, `IfDraw2D`, …) is a **small, deliberate set** of shared method bundles that **reduce
duplication** across components exposing the same interface (e.g. `ifHttpAgent`). They're instantiated with
the owning component (`new IfArray(this)`) and spread into `registerMethods`. This is **not** a complete
mirror of Roku's interface list — only interfaces worth sharing live here; everything else is inline.

### Device, filesystem, stdlib, errors

- `device/BrsDevice.ts` — simulated device state, the shared control array (`sharedArray`, an
  `Int32Array`), registry, current `threadId`, stdout/stderr.
- `device/FileSystem.ts` — virtual Roku volumes (`pkg:`, `tmp:`, `cachefs:`, `common:`, `ext1:`).
- `stdlib/` — global BrightScript functions.
- `error/` — `BrsError`, `RuntimeError`, `TypeMismatch`, `ArgumentMismatch`.

## Extension model (`src/core/extensions.ts`)

Optional functionality plugs in through the `BrsExtension` contract. Lifecycle hooks (all invoked from
`src/core/index.ts`):

| Hook | When it runs |
| --- | --- |
| `onInit(interpreter)` | After the interpreter is constructed (register `CreateObject` types here). |
| `onBeforeExecute(interpreter, payload)` | Before the app's `Main` runs (may be async — e.g. load XML components). |
| `updateSourceMap(sourceMap)` | While building the debug source map. |
| `tick(interpreter)` | Each interpreter tick / event-loop iteration. |
| `execTask(interpreter, payload)` | When the worker spins up to run a SceneGraph `Task`. |

Registration / loading:

- `registerExtension(() => new BrightScriptExtension())` adds a factory; `instantiateExtensions()` builds
  fresh instances per interpreter; `clearExtensions()` resets (tests).
- In the browser worker, `loadExtension()` calls `importScripts()` on the extension's bundle URL (from
  `DeviceInfo.extensions: Map<SupportedExtension, string>`), exposes the engine via
  `globalThis.brsEngine = createWorkerExports()`, then reads `globalThis[moduleId].BrightScriptExtension`.
  The extension imports `"brs-engine"` and is wired to the host's already-loaded engine, not a second copy.
- **Extension paths in `DeviceInfo.extensions` are resolved by the worker, not the page** —
  `importScripts()` runs inside the Web Worker, so the URL is relative to the worker bundle. If
  `brs.worker.js` and `brs-sg.js` sit together in `lib/`, the value is `"./brs-sg.js"`, **not**
  `"./lib/brs-sg.js"`. Getting this wrong silently fails: SceneGraph apps load but `roSGScreen`/`roSGNode`
  are unregistered. Keep all engine bundles in one folder.
- `brs-node` and the CLI register the SceneGraph extension automatically; `--no-sg` disables it. The core
  stays SceneGraph-agnostic — it knows only the minimal `ISGNode` interface (`isSceneGraphNode()`), never
  the concrete node classes.

See `docs/extensions.md`.

## SceneGraph extension (`src/extensions/scenegraph/`)

`BrightScriptExtension` (`index.ts`) is the entry. `onInit` registers `roSGScreen`, `roSGNode`, and a
SceneGraph-aware `roMessagePort`. `onBeforeExecute` scans `pkg:/components/`, parses every component
`.xml`, and stores the results.

Key pieces:

- **`SGRoot.ts`** — singleton (`sgRoot`) holding interpreter, `m.global`, root `Scene`/`RoSGScreen`,
  focused node, per-thread task map, timers/animations/sfx, and `nodeDefMap` (name → `ComponentDefinition`).
  Mirrors audio/video/sfx state out of `BrsDevice.sharedArray` via `Atomics.load`.
- **`parser/ComponentDefinition.ts`** — parses `<component>` XML (fields, children, scripts, `extends`) and
  builds a per-component sub-environment.
- **`factory/NodeFactory.ts`** — `createNode(type, interpreter)` resolves a name to a node: built-ins via
  `SGNodeFactory.createNode` (a `switch` over `SGNodeType`), or custom XML components via `initializeNode`,
  which walks the `extends` hierarchy, adds inherited fields/children, sets up `m` (`m.top`, `m.global`),
  and calls each `init()` base→derived.
- **`factory/Serializer.ts`** — converts nodes/values to/from plain JS for cross-thread transfer
  (`fromSGNode`, `brsValueOf`, `jsValueOf`).
- **`nodes/`** — one file per node type; `nodes/index.ts` re-exports them and defines the `SGNodeType` enum
  (types marked `// Not yet implemented` fall back to a plain `Node` with a warning).
- **`components/RoSGNode.ts`** — the `ifSGNodeField` / `ifSGNodeChildren` method surface.

**Before editing node rendering, fields/observers, focus, factory, or serialization, read
[`.claude/docs/scenegraph-invariants.md`](docs/scenegraph-invariants.md)** — it covers the `renderNode`
contract and the visibility-vs-measurement rule, XML field redeclaration (system vs. XML-defined), the
lazy-field/lazy-method memory design, the three stack-overflow hot paths (observer dispatch, re-entrant
`getBoundingRect`, AA/array cycles), focus-chain repair on attach, and the `ArrayGrid`
`scrollingStatus`-vs-focus-settle emission order.

For the multi-threaded Task model (rendezvous transport, ownership, startup, cross-thread serialization
rules, the silence-based timeout, and the all-thread debugger halt), read
[`.claude/docs/threading-and-rendezvous.md`](docs/threading-and-rendezvous.md) and
`docs/scenegraph-rendezvous.md`. Also see `packages/scenegraph/README.md`.

### Creating a new Node type

1. Add the name to the `SGNodeType` enum in `nodes/index.ts` (and re-export the file).
2. Create `nodes/MyNode.ts` extending the closest base (`Node`, `Group`, `ArrayGrid`, …). See
   `nodes/Rectangle.ts` for a minimal example:
   ```ts
   export class MyNode extends Group {
       readonly defaultFields: FieldModel[] = [
           { name: "width", type: "float", value: "0.0" },
           { name: "color", type: "color", value: "0xFFFFFFFF" },
       ];
       constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MyNode) {
           super([], name);
           this.setExtendsType(name, SGNodeType.Group);
           this.registerDefaultFields(this.defaultFields);
           this.registerInitializedFields(initializedFields);
       }
       // Override renderNodeContent, NOT renderNode: renderNode is a template on Group that applies
       // the node's clippingRect around this body. Position drawing via this.getDrawTranslation(...).
       protected renderNodeContent(interpreter, origin, angle, opacity, draw2D?) { /* ... */ }
   }
   ```
3. Wire it into `SGNodeFactory.createNode`'s `switch` so `CreateObject("roSGNode", "MyNode")` and XML
   `<MyNode>` resolve.
4. Follow the `renderNodeContent` contract and the visibility/measurement rule in
   [`.claude/docs/scenegraph-invariants.md`](docs/scenegraph-invariants.md). If the node draws its own
   geometry under an inherited rotation, override `rotatesDrawTranslation()` to `true`; if its layout
   assigns its **own** `translation`, do that in `prepareRender` so the clip is positioned from the
   settled value.
5. If the node builds visible children in its constructor and keeps private references to them, override
   `serializesChildren()` to `false` — see
   [`.claude/docs/threading-and-rendezvous.md`](docs/threading-and-rendezvous.md).

External consumers can register node types at runtime without editing the factory:
`SGNodeFactory.addNodeTypes([["mynode", (name) => new MyNode([], name)]])`.

## App packaging & encryption (`.bpk`)

`brs-cli --pack <password> --out <dir>` produces an **encrypted `.bpk`**: the password is the raw
AES-256-CTR key (exactly 32 chars, no KDF) and is required to run it. Two independent layers, same
password — the source blob (`source/data`: tokenized `source/*.brs` + raw `components/**` text) and the
whole-zip container (`BRSBPK1` magic + IV + AES-256-CTR). At runtime the component files are restored into
an opt-in `FileSystem` **source overlay** that is consumed during startup and then cleared, so the app
can't read its own component sources. Encrypted apps always run in production mode.

Full details — container format, Web Crypto rationale, blob format, why an overlay instead of a mounted
volume, the two in-sync `updateAppZip` copies and the `components/` marker that drives browser SceneGraph
detection: **[`.claude/docs/packaging-encryption.md`](docs/packaging-encryption.md)**.

## CLI

`src/cli/` builds into `packages/node/bin`. `brs-cli` runs `.brs` files, `.zip`/`.bpk` packages, or a REPL
(no args). Key flags: `--ascii`/`--unicode` (render the screen as terminal art), `--image [percent]`
(render frames as terminal images — iTerm2/Kitty protocols or ANSI fallback — at an optional % of terminal
width, 10-100), `--log [file]` (redirect all text output to a log file, ANSI stripped),
`--snapshot [file]` (Ctrl+S saves the screen as PNG), `--ecp` (ECP server on port 8060 + SSDP), `--debug`
(developer mode), `--no-sg`, `--pack`/`--out` (create `.bpk`), `--root` (mount `pkg:/` from a dir),
`--ext-vol` (mount `ext1:`), `--deep-link`, `--registry`. See `docs/run-as-cli.md`. With a TTY, the
keyboard is the remote control while the app runs (`src/cli/keyboard.ts`): arrows/select/back, Home exits
via `terminateApp`, Ctrl+B breaks into the debugger (Ctrl+C too in `--debug` mode, like a `STOP`), Ctrl+D
terminates (Ctrl+C too in production mode).

Terminal frame output is flicker-sensitive: opaque-black flattening, DEC 2026 synchronized output,
identical-frame skipping, and `writeTerminalText` deferral must stay together — never
`process.stdout.write`/`console.log` mid-run. See
**[`.claude/docs/cli-terminal-rendering.md`](docs/cli-terminal-rendering.md)**.

### Production vs developer mode (`debugOnCrash`)

The engine runs **production by default**; `--debug` (CLI) / `options.debugOnCrash` (API) switches to
**developer mode**. The runtime gate is `BrsDevice.tracking` (set in `setDeviceInfo` from
`deviceInfo.debugOnCrash`). When off (production), the engine skips debug instrumentation:

- No component (`bscs`), SceneGraph node (`sgnodes`), or lexeme (`stats`) counting, and no texture-registry
  tracking (`query/r2d2-bitmaps` / `requestBitmaps()` return empty).
- The **Micro Debugger is disabled**: `STOP` exits the app (`EXIT_BRIGHTSCRIPT_STOP`), break requests are
  ignored (`exit-app` still works), and the crash `BackTrace:` is suppressed.
- The call stack is still maintained, so `try/catch`'s `e.backtrace` works in both modes; reference
  counting, `dispose()`, and error messages are unchanged.
- **Encrypted `.bpk`s always run in production** — `debugOnCrash` is forced off in
  `executeFile`/`executeTask` (`isEncryptedPayload`) so a protected app can't be inspected.

Gate any new debug/inspection bookkeeping behind `BrsDevice.tracking` (or
`interpreter.options.stopOnCrash`).

### Texture memory (`query/r2d2-bitmaps`)

`src/core/device/Graphics.ts` is a global texture-memory registry modeling Roku's internal `roGraphics`.
`RoBitmap` registers/unregisters live bitmaps and `RoFontRegistry` contributes fonts (both gated by
`BrsDevice.tracking`). Requested on demand via the shared-array `BufferType.R2D2` flag (served in
`checkBreakCommand`) and returned as a `postMessage` `{ graphics }` — surfaced by the CLI ECP endpoint
`GET /query/r2d2-bitmaps` and the browser API `requestBitmaps()` + `bitmaps` event.

## Conventions

- **ALWAYS run `npm run lint` and `npm run prettier:write` before every commit.** Both must pass; fix
  anything they surface first.
- **Conditional compilation:** `/// #if BROWSER` … `/// #endif` blocks (via `ifdef-loader`) tailor `src/` to
  browser vs. node builds. Keep platform-specific imports inside these guards.
- **ESLint** uses `@typescript-eslint` with the `prettier` config and type-aware rules (`await-thenable`,
  `promise-function-async`, `no-for-in-array`, `prefer-for-of`, `eqeqeq: smart`,
  `logical-assignment-operators`, `no-case-declarations`); `import/no-extraneous-dependencies` is enforced.
- **Wrap `switch` `case`/`default` bodies in braces when they declare bindings** — a
  `let`/`const`/`function`/`class` under a bare `case` leaks into sibling cases. Enforced by ESLint
  (`no-case-declarations`).
- **Prefer logical-assignment operators** (`??=`, `||=`, `&&=`) over `x = x ?? y` etc. and over
  `if (!x) x = y`. Enforced (`logical-assignment-operators`), mostly auto-fixable.
- **Never embed an assignment inside a larger expression** — give it its own statement. Write
  `x ??= []; x.push(y);`, **not** `(x ??= []).push(y)`; same for `=` inside a
  `return`/condition/argument/ternary. Flagged by SonarCloud (`typescript:S1121`) on every PR, **not** by
  ESLint, so it won't surface locally.
- **Prefer `for...of` over `Array.prototype.forEach`** — cleaner, supports `break`/`continue`/`await`, no
  per-element callback. For an index use a `for` loop or `arr.entries()`. Reserve
  `.map`/`.filter`/`.reduce` for building a new value.
- **Prefer `String.raw` over backslash-escaped string literals** — `` String.raw`C:\folder\file.mp4` ``,
  `` String.raw`\d+` ``. Enforced (`unicorn/prefer-string-raw`), auto-fixable. It fires only on plain
  string literals (leaves template literals alone); a lone trailing backslash still needs `"\\"`.
- **Prefer `replaceAll()` over `replace()` with a global regex** — `str.replaceAll(/…/g, …)`. Enforced
  (`unicorn/prefer-string-replace-all`), auto-fixable; a regex arg still requires the `g` flag. Leave
  single-match `replace()` (string arg or non-`g` regex) as-is.
- The SceneGraph extension imports the engine as `"brs-engine"`, never via relative `../core` paths — it's a
  separate bundle bound to the host at load time.
- A detailed `.github/copilot-instructions.md` has additional contributor guidance.

## Roku reference documentation (`external/dev-doc` submodule)

Roku's official docs ([rokudev/dev-doc](https://github.com/rokudev/dev-doc), branch `v2.0`) are vendored as
a **git submodule** at `external/dev-doc`. The BrightScript + SceneGraph reference under
**`external/dev-doc/docs/REFERENCES/`** (Markdown + YAML frontmatter) is the **authoritative spec** —
consult it whenever implementing, fixing, or verifying a feature so simulated behavior matches a real
device.

> Pinned to a specific commit; populate with `git submodule update --init external/dev-doc` (a plain
> checkout leaves it empty). **Reference only** — never make build/runtime code depend on it. Update with
> `git -C external/dev-doc pull origin v2.0`, then commit the new pointer.

Layout and mapping to the source tree:

| Reference path | Documents | Implement / verify in |
| --- | --- | --- |
| `brightscript/components/roXxx.md` | `roXxx` component: creation, interfaces/events | `src/core/brsTypes/components/RoXxx.ts` (registered in `BrsObjects.ts`) |
| `brightscript/interfaces/ifXxx.md` | Method signatures, args, returns, defaults | methods on the component, grouped under the `ifXxx` key in `registerMethods` — **not** a standalone type |
| `brightscript/events/roXxxEvent.md` | Event objects returned via `roMessagePort` | the matching event component |
| `brightscript/language/*.md` | Language spec: statements, expressions/types, error handling, conditional compilation, format strings, reserved words, global functions | `src/core/{lexer,parser,preprocessor,stdlib}/` |
| `scenegraph/**/<node>.md` | Node fields (name/type/default/access) and behavior | `src/extensions/scenegraph/nodes/<Node>.ts` |
| `scenegraph/xml-elements/*.md`, `scenegraph/component-functions/*.md` | Component XML (`<component>`/`<interface>`/`<children>`/`<script>`) and `init`/`onKeyEvent` | `src/extensions/scenegraph/{parser,factory}/` |
| `deprecated-apis.md` | APIs Roku has deprecated — check before relying on one | n/a (informational) |

Match documented **field names, types, defaults, and access permissions** exactly. Use the `brs-reference`
skill to look things up.
