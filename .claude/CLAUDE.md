# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**brs-engine** is a BrightScript Simulation Engine: an interpreter for the BrightScript language that runs Roku apps (channels) in web browsers and Node.js. It simulates the BrightScript runtime, the Draw 2D API (`roScreen`, `roCompositor`, `roRegion`, …), the SceneGraph framework, the Roku file system, registry, remote control, and the Micro Debugger — targeting compatibility up to Roku OS 15. It is **not** a Roku OS or hardware emulator; it is a development/automation tool. The repo was originally forked from [rokucommunity/brs](https://github.com/rokucommunity/brs).

Node.js **v22 or newer** is required to build and to run the CLI.

## Monorepo layout

This is an npm **workspaces** monorepo (root package `brs-engine-workspace`). All TypeScript source lives in the top-level `src/` directory and is compiled into three published packages under `packages/`:

- **brs-engine** (`packages/browser`) — browser / Web Worker interpreter for web, PWA, and Electron apps. Build output: `packages/browser/lib/brs.api.js` + `brs.worker.js`, types in `packages/browser/types/`.
- **brs-node** (`packages/node`) — Node.js library plus the `brs-cli` command, ECP + SSDP servers. Build output: `packages/node/bin/{brs.cli.js, brs.ecp.js, brs.node.js}`.
- **brs-scenegraph** (`packages/scenegraph`) — SceneGraph runtime shipped as a standalone **extension** bundle (`brs-sg.js` / `brs-sg.node.js`) that auto-loads when an app contains `pkg:/components/` assets.

## Commands

Run from the repo root (scripts fan out to workspaces):

```bash
npm install              # install all workspace dependencies

npm run build            # dev build of all packages (--workspaces)
npm run build:api        # build only brs-engine (browser)
npm run build:cli        # build only brs-node (CLI/Node library)
npm run build:sg         # build only brs-scenegraph
npm run build:web        # build engine + scenegraph, then open the example web app
npm run release          # minified production build of all packages
npm run clean            # remove compiled lib/ bin/ types/ from all packages

npm start                # webpack-dev-server for the example web app (brs-engine)

npm run lint             # eslint over ./src
npm run prettier         # check formatting (4-space indent, printWidth 120)
npm run prettier:write   # auto-format

npm test                 # jest (config is inline in root package.json)
```

Tests live in `test/` (`brsTypes/`, `core/`, `interpreter/`, `lexer/`, `parser/`, `preprocessor/`, `stdlib/`, `extensions/`, `simulator/`, `cli/`). The e2e suite in `test/e2e/` is driven by `test/e2e/E2ETests.js`, comparing interpreter output against `.brs` fixtures in `test/e2e/resources/`. Test files are plain `.test.js`.

```bash
npx jest test/e2e/Functions.test.js     # run a single test file
npx jest -t "name of the test"          # run by test name
npx jest --updateSnapshot               # refresh snapshots
```

After `npm run build:cli`, link the CLI for local use: `cd packages/node && npm link`, then `brs-cli`.

## Core architecture

### Two-thread split (browser model)

The browser build is two bundles that run on **separate threads** and communicate via `postMessage` + a shared `Int32Array` over `SharedArrayBuffer`:

- **API library** — entry `src/api/index.ts`, output `brs.api.js`. Runs on the **main thread**. Creates/manages the worker, renders the display canvas (expects a `canvas` named `display` and a `video` named `player` on `document`), plays audio, routes remote-control/gamepad input, and exposes the public API (`initialize`, `subscribe`, `execute`, `terminate`, `sendKeyPress`, `debug`, …). See `docs/engine-api.md`.
- **Worker library** — entry `src/core/index.ts`, output `brs.worker.js`. Runs in a **Web Worker** (browser) or **Worker Thread** (Node). Its `onmessage` handler receives a msgpack-encoded `AppPayload`/`TaskPayload` (load + run an app) or the `SharedArrayBuffer` for control state (`BrsDevice.setSharedArray`). This is where the interpreter actually executes.

The Node CLI runs the interpreter on a **single thread**; remote control there requires the ECP server (`--ecp`).

### Interpreter pipeline (`src/core/`)

`lex → parse → preprocess → interpret`

- `src/core/lexer/` — tokenizer.
- `src/core/parser/` — builds the AST (`Expression.ts`, `Statement.ts`).
- `src/core/preprocessor/` — BrightScript conditional compilation (`#const`, `#if`).
- `src/core/interpreter/` — tree-walking interpreter (`index.ts`, ~2300 lines, the execution core), plus `Environment.ts`/`Scope.ts` (scoping), `MicroDebugger.ts`, `Network.ts`.
- `src/core/LexerParser.ts` — orchestrates lex+parse and decodes precompiled/encrypted token streams.
- `src/core/index.ts` — wires the pipeline together, handles app/task payloads, package (`.zip`/`.bpk`) loading and AES decryption, and re-exports the public surface.

### Runtime types and components

- `src/core/brsTypes/` — BrightScript values: primitives (`Int32`, `Float`, `Double`, `BrsString`, `Boolean`), `Callable`, plus `Coercion.ts`/`Boxing.ts` rules.
- `src/core/brsTypes/components/` — the `roXxx` component objects (`RoArray`, `RoAssociativeArray`, `RoBitmap`, `RoAudioPlayer`, `RoDeviceInfo`, `RoMessagePort`, …); `BrsObjects.ts` is the `CreateObject` registry.

### Device, filesystem, stdlib, errors

- `src/core/device/BrsDevice.ts` — simulated device state, the shared control array (`BrsDevice.sharedArray`, an `Int32Array`), registry, current `threadId`, stdout/stderr.
- `src/core/device/FileSystem.ts` — virtual Roku volumes (`pkg:`, `tmp:`, `cachefs:`, `common:`, `ext1:`).
- `src/core/stdlib/` — global BrightScript functions.
- `src/core/error/` — `BrsError`, `RuntimeError`, `TypeMismatch`, `ArgumentMismatch`.

## Extension model (`src/core/extensions.ts`)

Optional functionality plugs into the interpreter through the `BrsExtension` contract. An extension implements any of these lifecycle hooks, all invoked from `src/core/index.ts`:

| Hook | When it runs |
| --- | --- |
| `onInit(interpreter)` | After the interpreter is constructed (register `CreateObject` types here). |
| `onBeforeExecute(interpreter, payload)` | Before the app's `Main` runs (may be async — e.g. load XML components). |
| `updateSourceMap(sourceMap)` | While building the debug source map. |
| `tick(interpreter)` | Each interpreter "tick"/event-loop iteration. |
| `execTask(interpreter, payload)` | When the worker is spun up to run a SceneGraph `Task` (see Rendezvous below). |

Registration / loading:

- `registerExtension(() => new BrightScriptExtension())` adds a factory; `instantiateExtensions()` builds fresh instances per interpreter. `clearExtensions()` resets (used in tests).
- In the browser worker, `loadExtension()` in `src/core/index.ts` calls `importScripts()` on the extension's bundle URL (resolved from `DeviceInfo.extensions: Map<SupportedExtension, string>`), exposes the engine to it via `globalThis.brsEngine = createWorkerExports()`, then reads `globalThis[moduleId].BrightScriptExtension`. So the extension imports `"brs-engine"` and at runtime is wired to the host's already-loaded engine, not a second copy.
- `brs-node` and the CLI register the SceneGraph extension automatically; `--no-sg` disables it. The core stays SceneGraph-agnostic: it only knows the minimal `ISGNode` interface (`isSceneGraphNode()`), never the concrete node classes.

## SceneGraph extension (`src/extensions/scenegraph/`)

`BrightScriptExtension` (`index.ts`) is the entry. `onInit` registers `roSGScreen`, `roSGNode`, and a SceneGraph-aware `roMessagePort` with `BrsObjects`. `onBeforeExecute` scans `pkg:/components/`, parses every component `.xml`, and stores the results.

Key pieces:

- **`SGRoot.ts`** — a singleton (`sgRoot`) holding interpreter, `m.global`, the root `Scene`/`RoSGScreen`, focused node, the per-thread task map, timers/animations/sfx, and `nodeDefMap` (component-name → `ComponentDefinition`). It also mirrors audio/video/sfx state out of `BrsDevice.sharedArray` via `Atomics.load` (`processAudio`, `processVideo`, `processSFX`).
- **`parser/ComponentDefinition.ts`** — parses `<component>` XML (fields, children, scripts, `extends`) and builds a sub-environment per component so each component's BrightScript runs in its own scope.
- **`factory/NodeFactory.ts`** — `createNode(type, interpreter)` resolves a type name to a node: built-in types via `SGNodeFactory.createNode` (a big `switch` over `SGNodeType`), or custom XML components via `initializeNode`, which walks the `extends` hierarchy (`updateTypeDefHierarchy` → `subtypeHierarchy`), adds inherited fields/children, sets up the `m` pointer (`m.top`, `m.global`), and calls each component's `init()` from base to derived.
- **`factory/Serializer.ts`** — converts nodes/values to and from plain JS for cross-thread transfer (`fromSGNode`, `brsValueOf`, `jsValueOf`).
- **`nodes/`** — one file per node type; `nodes/index.ts` re-exports them and defines the `SGNodeType` enum (types marked `// Not yet implemented` fall back to a plain `Node` with a warning).
- **`components/RoSGNode.ts`** — the `ifSGNodeField` / `ifSGNodeChildren` method surface exposed to BrightScript.

### Creating a new Node type

1. Add the type name to the `SGNodeType` enum in `nodes/index.ts` (and re-export the file).
2. Create `nodes/MyNode.ts` extending the closest base (`Node`, `Group`, `ArrayGrid`, …). Pattern (see `nodes/Rectangle.ts` for a minimal example):
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
       // Override to draw; renderable nodes draw themselves then renderChildren()
       renderNode(interpreter, origin, angle, opacity, draw2D?) { /* ... */ }
   }
   ```
3. Wire it into `SGNodeFactory.createNode`'s `switch` in `factory/NodeFactory.ts` so `CreateObject("roSGNode", "MyNode")` and XML `<MyNode>` resolve.
4. Rendering contract: `renderNode` should early-return via `updateRenderTracking(true)` when not visible, apply translation/rotation/opacity, draw through the passed `IfDraw2D`, update bounding rects, then call `renderChildren(...)` and `nodeRenderingDone(...)`.

External consumers can also register node types at runtime without editing the factory via `SGNodeFactory.addNodeTypes([["mynode", (name) => new MyNode([], name)]])`.

### Rendezvous architecture (multi-threaded Tasks)

SceneGraph `Task` nodes run their `functionName` on a **dedicated worker thread**, mirroring Roku's render-thread / task-thread model. The thread that owns the scene graph and renders it is **thread 0 ("Render")**; each running Task gets a thread id `> 0`. `sgRoot.threadId` (and `BrsDevice.threadId`) identify the current thread; `sgRoot.inTaskThread()` is `threadId > 0`. Every node records an `owner` thread id (Scene and Global are always owned by thread 0).

Because a node's authoritative copy lives on its owner thread, reading/writing a node you don't own must **rendezvous**: a synchronous, blocking request to the owning thread. This is implemented in `nodes/Task.ts` + `nodes/Node.ts`:

- **Transport** — each Task owns a `SharedObject` wrapping a `SharedArrayBuffer`. `ThreadUpdate` messages (`action`: `get` / `set` / `call` / `resp` / `ack` / `nil`, plus `type`, `address`, `key`, `value`) are written into it; the receiver is woken with `Atomics`-based `taskBuffer.waitVersion(...)`. Task lifecycle/state transitions also flow over normal `postMessage` (`TaskData`, `TaskState`).
- **Field writes** — `Node.setValue` calls `rendezvousSet`; if `shouldRendezvous()` (`inTaskThread() && owner !== threadId`) it forwards the change to the owner via `task.syncRemoteField`. Otherwise, on the render thread, it pushes the change to any Task that observes that field's port.
- **Field reads / method calls** — `RoSGNode`/`ContentNode` methods call `rendezvousCall(interpreter, "<method>", [args])`. When `shouldRendezvous()`, it serializes args (node args are re-owned by thread 0) and calls `task.requestMethodCall(...)`, which blocks (with a default 10s timeout, logging a "Rendezvous timeout" warning) until a `resp`/`nil` comes back. `requestFieldValue` does the same for plain field reads.
- **Crossing into a node sends ownership**: a `Node` value passed from a task to the render thread is re-owned (`setOwner(0)`) so subsequent access from the task rendezvouses back.
- **Task startup** — when a Task's `control` becomes `"run"`, `checkTaskRun` posts a `TaskData` (with the shared buffer, serialized `m`, render-thread id, `tmp:`/`cachefs:` volumes). The core spins up a worker, which calls the extension's `execTask` → `initializeTask` to rebuild the node tree on the new thread and invoke the task function. The extension's `tick` hook drains incoming thread updates each iteration via `task.processThreadUpdate()`.

See `docs/extensions.md` and `packages/scenegraph/README.md` for the consumer-facing view.

## CLI

`src/cli/` builds into `packages/node/bin`. `brs-cli` runs `.brs` files, `.zip`/`.bpk` packages, or a REPL (no args). Key flags: `--ascii`/`--unicode` (render the screen as terminal art), `--ecp` (ECP control server on port 8060 + SSDP discovery), `--no-sg` (disable SceneGraph), `--pack`/`--out` (create encrypted `.bpk`), `--root` (mount `pkg:/` from a directory), `--ext-vol` (mount `ext1:`), `--deep-link`, `--registry`. See `docs/run-as-cli.md`.

## Conventions

- **Conditional compilation:** `/// #if BROWSER` … `/// #endif` blocks (via `ifdef-loader`) tailor the same `src/` to browser vs. node builds. Keep platform-specific imports inside these guards.
- **ESLint** uses `@typescript-eslint` with the `prettier` config and type-aware rules (`await-thenable`, `promise-function-async`, `no-for-in-array`, `prefer-for-of`, `eqeqeq: smart`). `import/no-extraneous-dependencies` is enforced. Run `npm run lint` and `npm run prettier:write` before committing.
- The SceneGraph extension imports the engine as the package `"brs-engine"`, never via relative `../core` paths — it is compiled as a separate bundle and bound to the host engine at load time.
- A detailed `.github/copilot-instructions.md` exists in this repo with additional contributor guidance worth consulting.

## Documentation

`docs/` is the source of truth for usage: `build-from-source.md`, `integrating.md`, `engine-api.md`, `customization.md`, `run-as-cli.md`, `using-node-library.md`, `extensions.md`, `remote-control.md`, `limitations.md`, `contributing.md`.
