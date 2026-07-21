# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Overview

**brs-engine** is a BrightScript Simulation Engine: an interpreter that runs Roku apps (channels) in web browsers and Node.js. It simulates the BrightScript runtime, the Draw 2D API (`roScreen`, `roCompositor`, `roRegion`, …), the SceneGraph framework, the Roku file system, registry, remote control, and the Micro Debugger — targeting compatibility up to Roku OS 15. It is a development/automation tool, **not** a Roku OS or hardware emulator. Originally forked from [rokucommunity/brs](https://github.com/rokucommunity/brs).

Node.js **v22+** is required to build and run the CLI.

## Monorepo layout

npm **workspaces** monorepo (root package `brs-engine-workspace`). All TypeScript lives in top-level `src/`, compiled into three packages under `packages/`:

- **brs-engine** (`packages/browser`) — browser / Web Worker interpreter for web, PWA, Electron. Output: `lib/brs.api.js` + `brs.worker.js`, types in `types/`.
- **brs-node** (`packages/node`) — Node.js library plus the `brs-cli` command, ECP + SSDP servers. Output: `bin/{brs.cli.js, brs.ecp.js, brs.node.js}`.
- **brs-scenegraph** (`packages/scenegraph`) — SceneGraph runtime as a standalone **extension** bundle (`brs-sg.js` / `brs-sg.node.js`) that auto-loads when an app contains `pkg:/components/` assets.

### Required deployment asset: `assets/common.zip`

`packages/browser/assets/common.zip` (and the SceneGraph counterpart in `packages/scenegraph/`) is the **`common:/` volume**: default fonts, system audio, CA certificates, and BrightScript library stubs (`LibCore`, `roku_ads`, `roku_analytics`, `roku_browser`). **Any web app embedding the engine must serve this file at `./assets/common.zip` relative to `brs.api.js`** — the API fetches it on startup. Missing it means no fonts or system libraries, and most apps break.

## Commands

Run from the repo root (scripts fan out to workspaces):

```bash
npm install              # install all workspace dependencies

npm run build            # dev build of all packages
npm run build:api        # build only brs-engine (browser)
npm run build:cli        # build only brs-node (CLI/Node library)
npm run build:sg         # build only brs-scenegraph
npm run build:web        # build engine + scenegraph, open example web app
npm run release          # minified production build
npm run clean            # remove compiled lib/ bin/ types/

npm start                # webpack-dev-server for the example web app

npm run lint             # eslint over ./src
npm run prettier         # check formatting (4-space indent, printWidth 120)
npm run prettier:write   # auto-format

npm test                 # jest (config inline in root package.json)
```

Tests live in `test/` (`brsTypes/`, `core/`, `interpreter/`, `lexer/`, `parser/`, `preprocessor/`, `stdlib/`, `extensions/`, `simulator/`, `cli/`). The e2e suite (`test/e2e/E2ETests.js`) compares interpreter output against `.brs` fixtures in `test/e2e/resources/`. Test files are plain `.test.js`.

```bash
npx jest test/e2e/Functions.test.js     # single file
npx jest -t "name of the test"          # by test name
npx jest --updateSnapshot               # refresh snapshots
```

After `npm run build:cli`, link the CLI: `cd packages/node && npm link`, then `brs-cli`.

## Core architecture

### Two-thread split (browser model)

The browser build is two bundles on **separate threads**, communicating via `postMessage` + a shared `Int32Array` over `SharedArrayBuffer`:

- **API library** — entry `src/api/index.ts` → `brs.api.js`. Runs on the **main thread**: manages the worker, renders the display canvas (expects a `canvas` named `display` and a `video` named `player` on `document`), plays audio, routes remote/gamepad input, and exposes the public API (`initialize`, `subscribe`, `execute`, `terminate`, `sendKeyPress`, `debug`, …). See `docs/engine-api.md`.
- **Worker library** — entry `src/core/index.ts` → `brs.worker.js`. Runs in a **Web Worker** (browser) or **Worker Thread** (Node). Its `onmessage` receives a msgpack-encoded `AppPayload`/`TaskPayload` or the `SharedArrayBuffer` for control state (`BrsDevice.setSharedArray`). The interpreter executes here.

The Node build mirrors this two-thread split via `worker_threads`: the CLI main thread is the **host** (`src/node/host.ts` `executeApp` + `src/node/task.ts` task broker — a port of `src/api/task.ts`, keep them in sync), the app runs in a worker whose entry is `bin/brs.node.js` itself (`parentPort` dispatcher in `src/core/index.ts`'s `#else` branch), and each SceneGraph Task gets its own worker. node-canvas `ImageData` doesn't survive the structured clone (width/height are prototype getters), so frames cross as `FrameData` (flatten in the worker shim, revive in the host). Type guards on worker messages must be realm-safe (`isTypeOf`, not `instanceof` — jest's VM sandbox breaks `instanceof SharedArrayBuffer`). The main thread also owns stdin: raw-mode keyboard remote control + Micro Debugger line-mode relay (`src/cli/keyboard.ts`); the worker-side debugger reads commands from the shared array (`BrsDevice.isWorkerThread`). REPL and `--pack` stay in-process (`executeFile`): packaging returns its result as a function value, and the REPL needs a same-isolate interpreter. Regression: `task-app` in `test/cli/cli.test.js` and `test/node/host.test.js`.

### Interpreter pipeline (`src/core/`)

`lex → parse → preprocess → interpret`

- `lexer/` — tokenizer.
- `parser/` — builds the AST (`Expression.ts`, `Statement.ts`).
- `preprocessor/` — conditional compilation (`#const`, `#if`).
- `interpreter/` — tree-walking interpreter (`index.ts`, the execution core), plus `Environment.ts`/`Scope.ts`, `MicroDebugger.ts`, `Network.ts`.
- `LexerParser.ts` — orchestrates lex+parse and decodes precompiled/encrypted token streams.
- `index.ts` — wires the pipeline, handles app/task payloads, package (`.zip`/`.bpk`) loading and AES decryption, re-exports the public surface.

### Runtime types and components

- `brsTypes/` — BrightScript values: primitives (`Int32`, `Float`, `Double`, `BrsString`, `Boolean`), `Callable`, plus `Coercion.ts`/`Boxing.ts`.
- `brsTypes/components/` — the `roXxx` component objects (`RoArray`, `RoAssociativeArray`, `RoBitmap`, …); `BrsObjects.ts` is the `CreateObject` registry.

#### Anonymous functions must round-trip name → callable (`$anon_N`)

An unnamed `Callable` is auto-named `$anon_N` (`Callable.ts`); `toStr()` reports `<Function: $anon_N>`. That name must stay **resolvable back to the same callable**, because some libraries extract a function argument's name from `toStr()` and pass it to `observeField`/`observeFieldScoped` — notably [rokucommunity/promises](https://github.com/rokucommunity/promises), which backs every Rooibos `@SGNode`/node test suite (the observer registered this way advances its promise chain). So every anonymous `Callable` is entered into a **capped registry** (`anonRegistry`, `resolveAnonymousCallable`), and `Interpreter.getCallableFunction` falls back to it for `$anon_*` names when normal resolution fails.

**Invariants:** keep the name **deterministic** (a plain counter — a random/location id breaks stable `toStr()` output and the `roFunction` e2e snapshot; memory is bounded by the cap, not the id scheme), and keep the registry **capped** (anonymous callables are minted per evaluation). Regression: "Resolves an anonymous function observer registered by its toStr() name" in `test/cli/cli.test.js` (`anon-observer-app`).

#### Interfaces are method grouping, not separate types

Roku documents a component's methods under `ifXxx` interfaces, but **we do not implement each `ifXxx` as its own type**. A component implements all its methods and registers them via `registerMethods({ ifXxx: [...callables] })`, where the `ifXxx` key is just **metadata grouping** mirroring the docs. Most methods are defined inline on the component class (e.g. `RoArray`'s `join`/`sort`).

`brsTypes/interfaces/` (`IfArray`, `IfEnum`, `IfHttpAgent`, `IfList`, `IfMessagePort`, `IfSocket`, `IfToStr`, `IfDraw2D`, …) is a **small, deliberate set** of shared method bundles that **reduce duplication** across components exposing the same interface (e.g. `ifHttpAgent`). They're instantiated with the owning component (`new IfArray(this)`) and spread into `registerMethods`. This is **not** a complete mirror of Roku's interface list — only interfaces worth sharing live here; everything else is inline.

### Device, filesystem, stdlib, errors

- `device/BrsDevice.ts` — simulated device state, the shared control array (`sharedArray`, an `Int32Array`), registry, current `threadId`, stdout/stderr.
- `device/FileSystem.ts` — virtual Roku volumes (`pkg:`, `tmp:`, `cachefs:`, `common:`, `ext1:`).
- `stdlib/` — global BrightScript functions.
- `error/` — `BrsError`, `RuntimeError`, `TypeMismatch`, `ArgumentMismatch`.

## Extension model (`src/core/extensions.ts`)

Optional functionality plugs in through the `BrsExtension` contract. Lifecycle hooks (all invoked from `src/core/index.ts`):

| Hook | When it runs |
| --- | --- |
| `onInit(interpreter)` | After the interpreter is constructed (register `CreateObject` types here). |
| `onBeforeExecute(interpreter, payload)` | Before the app's `Main` runs (may be async — e.g. load XML components). |
| `updateSourceMap(sourceMap)` | While building the debug source map. |
| `tick(interpreter)` | Each interpreter tick / event-loop iteration. |
| `execTask(interpreter, payload)` | When the worker spins up to run a SceneGraph `Task` (see Rendezvous). |

Registration / loading:

- `registerExtension(() => new BrightScriptExtension())` adds a factory; `instantiateExtensions()` builds fresh instances per interpreter; `clearExtensions()` resets (tests).
- In the browser worker, `loadExtension()` calls `importScripts()` on the extension's bundle URL (from `DeviceInfo.extensions: Map<SupportedExtension, string>`), exposes the engine via `globalThis.brsEngine = createWorkerExports()`, then reads `globalThis[moduleId].BrightScriptExtension`. The extension imports `"brs-engine"` and is wired to the host's already-loaded engine, not a second copy.
- **Extension paths in `DeviceInfo.extensions` are resolved by the worker, not the page** — `importScripts()` runs inside the Web Worker, so the URL is relative to the worker bundle. If `brs.worker.js` and `brs-sg.js` sit together in `lib/`, the value is `"./brs-sg.js"`, **not** `"./lib/brs-sg.js"`. Getting this wrong silently fails: SceneGraph apps load but `roSGScreen`/`roSGNode` are unregistered. Keep all engine bundles in one folder.
- `brs-node` and the CLI register the SceneGraph extension automatically; `--no-sg` disables it. The core stays SceneGraph-agnostic — it knows only the minimal `ISGNode` interface (`isSceneGraphNode()`), never the concrete node classes.

## SceneGraph extension (`src/extensions/scenegraph/`)

`BrightScriptExtension` (`index.ts`) is the entry. `onInit` registers `roSGScreen`, `roSGNode`, and a SceneGraph-aware `roMessagePort`. `onBeforeExecute` scans `pkg:/components/`, parses every component `.xml`, and stores the results.

Key pieces:

- **`SGRoot.ts`** — singleton (`sgRoot`) holding interpreter, `m.global`, root `Scene`/`RoSGScreen`, focused node, per-thread task map, timers/animations/sfx, and `nodeDefMap` (name → `ComponentDefinition`). Mirrors audio/video/sfx state out of `BrsDevice.sharedArray` via `Atomics.load`.
- **`parser/ComponentDefinition.ts`** — parses `<component>` XML (fields, children, scripts, `extends`) and builds a per-component sub-environment.
- **`factory/NodeFactory.ts`** — `createNode(type, interpreter)` resolves a name to a node: built-ins via `SGNodeFactory.createNode` (a `switch` over `SGNodeType`), or custom XML components via `initializeNode`, which walks the `extends` hierarchy, adds inherited fields/children, sets up `m` (`m.top`, `m.global`), and calls each `init()` base→derived.
- **`factory/Serializer.ts`** — converts nodes/values to/from plain JS for cross-thread transfer (`fromSGNode`, `brsValueOf`, `jsValueOf`).
- **`nodes/`** — one file per node type; `nodes/index.ts` re-exports them and defines the `SGNodeType` enum (types marked `// Not yet implemented` fall back to a plain `Node` with a warning).
- **`components/RoSGNode.ts`** — the `ifSGNodeField` / `ifSGNodeChildren` method surface.

### Creating a new Node type

1. Add the name to the `SGNodeType` enum in `nodes/index.ts` (and re-export the file).
2. Create `nodes/MyNode.ts` extending the closest base (`Node`, `Group`, `ArrayGrid`, …). See `nodes/Rectangle.ts` for a minimal example:
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
       renderNode(interpreter, origin, angle, opacity, draw2D?) { /* ... */ }
   }
   ```
3. Wire it into `SGNodeFactory.createNode`'s `switch` so `CreateObject("roSGNode", "MyNode")` and XML `<MyNode>` resolve.
4. Rendering contract: `renderNode` early-returns via `updateRenderTracking(true)` when not visible, applies translation/rotation/opacity, draws through the passed `IfDraw2D`, updates bounding rects, then calls `renderChildren(...)` and `nodeRenderingDone(...)`.
5. **Visibility vs. measurement:** plain containers (`Group`, `LayoutGroup`, `MaskGroup`) do their invisible early-return through `Group.skipRender(draw2D)`, which lets a **measurement pass** (a render with no `draw2D` — `getBoundingRect`'s refresh) traverse them when invisible: on Roku, layout/bounding rects are independent of visibility, and apps measure UI under a hidden ancestor before revealing it. A measured invisible container propagates opacity 0 and does not union into its parent's bounds. Renderable/complex nodes (Poster, Label, ArrayGrid, …) keep the hard skip of step 4 so hidden UI never loads textures or creates item components. Regression: `test/extensions/scenegraph/HiddenMeasure.test.js`.

External consumers can register node types at runtime without editing the factory: `SGNodeFactory.addNodeTypes([["mynode", (name) => new MyNode([], name)]])`.

### XML `<interface>` field redeclaration — system vs. XML-defined (`addFields`)

When `addFields` builds a custom component's fields, a `<field>` whose name already exists is handled by **who defined the existing field**:

- Inherited from a **built-in base type** (`Group`, `Label`, …) → a **system** field (`field.isSystem()`, set by `registerDefaultFields`). Roku lets a component **redeclare** it: the redeclaration re-applies the XML default/type and `addFields` continues, so a field declared *after* it is still added. Guard: `else if (field && !field.isSystem())` — don't treat this as a duplicate.
- Defined in an **ancestor XML component's** `<interface>` → *not* system (added via `addNodeField`, `system=false`). Redeclaring it **is** a genuine duplicate: `addFields` writes `Attempt to add duplicate field "…"` to `BrsDevice.stderr` and **returns early**, so trailing fields in that component are never added (they read back `invalid`).

`addNodeField` is a no-op when the field exists, so a redeclared system field keeps its `Field` instance; the XML default is applied by the subsequent `setValueSilent`. Regression: `duplicate-system-field-app` in `test/cli/cli.test.js`.

### Per-node memory: lazy fields and lazy methods (large content trees)

A large EPG (e.g. the SGDEX **TimeGridView** sample) creates thousands of `ContentNode`s. Two per-instance costs used to be paid eagerly and could exhaust V8's young generation (`young object promotion failed` OOM on deep scrolling). Both are now **built on demand**; keep them lazy.

1. **Hidden default fields (`Node.registerDefaultFields` / `resolveField`).** `ContentNode` declares ~105 default fields, ~103 of them `hidden: true` metadata — **not** materialized up front. `registerDefaultFields` keeps every `hidden` default in a shared per-class spec (`Node.hiddenSpecCache`, a `WeakMap<constructor, Map<name, FieldModel>>`; only `ContentNode` populates it). Non-hidden defaults are still materialized in the constructor. **`resolveField(mapKey)`** builds the real `Field` on first read/write/observe/probe, preserving `system`+`hidden` flags — so a type-check-only resolve (`canAcceptValue`) does **not** un-hide it, while a genuine read/write does. Any by-name lookup that must see hidden metadata goes through public **`resolveField`** (not `this.fields.get`) and spec-aware **`hasNodeField`** (not `this.fields.has`) — routed sites: `Node` get/getValue/setValue/observers, `ContentNode.hasField`, and `NodeFactory` paths (`addFields`, `addAliases`, `addChildren`, `populateNodeFromAA`, `linkField`). A fresh `ContentNode` materializes ~4 fields instead of ~107. Regression: `test/extensions/scenegraph/HiddenFields.test.js`.

2. **Method Callables (`BrsComponent.buildMethods` / `ensureMethods`).** Each node's ~70 `roSGNode` method Callables (plus `StdlibArgument`s, closures, `BrsInterface` metadata) were the dominant per-node cost (~66 KB), and field access (`node.title`) never needs them. `BrsComponent` exposes a **`buildMethods()`** hook (default no-op — eager components unchanged) invoked at most once by **`ensureMethods()`** on the first `getMethod`/`hasInterface`/`GetInterface`. `RoSGNode`'s methods are **prototype getters** (zero per-instance cost) registered inside its `buildMethods()`; the per-node `RoHttpAgent` is likewise lazy. `ContentNode` overrides `buildMethods()` (`super` first, then `overrideMethods([count, keys, items, hasField])`). A data-only node with no method called allocates none of these. Measured: bare `Node` ~106 KB → ~42 KB, `ContentNode` ~112 KB → ~48 KB. Regression: `test/extensions/scenegraph/LazyMethods.test.js`. **Invariant:** the getters return a fresh Callable per access — reference them only inside `buildMethods()` (via `registerMethods`), never as an identity-stable `this.<method>` field; any new reader of a component's `interfaces` map must call `ensureMethods()` first.

> Still eager, next optimization target: each `setValue` costs ~15 KB (a `Field` + boxed value + dirty/`freshFields` tracking).

### Stack-overflow hot paths (fragile — read before touching)

Three distinct SceneGraph paths can recurse until the JS stack overflows; all surface as `Maximum call stack size exceeded`. They are unrelated — diagnose which before "fixing" the others (the alternating frame pair in the native stack identifies the path). A real overflow's BrightScript backtrace is misleading (often one frame, because `Field.executeCallbacks` pops frames as the error unwinds); capture the **native JS stack** mid-recursion (a temporary depth tripwire dumping `new Error().stack` via `BrsDevice.stderr`).

1. **Observer dispatch — `Field.notifyObservers` + `ContentNode` parentField fan-out.** Regressed repeatedly (#905 → #943 → #904). Dispatch is **synchronous depth-first**, guarded by a per-field `notifying` re-entrancy flag — correct *only because* dispatch is synchronous (`notifying` stays true for the field's entire observer subtree). Do **not** convert to breadth-first/queued: releasing `notifying` between dispatches lets a sibling re-enqueue the field and it never terminates; adding coalescing instead drops a legitimate *second* notification within one cascade and leaves dependent fields stale (the blank-`Label` regression). A `ContentNode` whose own observer writes back into the same node is bounded by a per-`ContentNode` `propagating` guard in `notifyParentFields`. Regression: `button-label-app`, `contentnode-recursion-app`, `contentnode-parentfield-app`, `sharedcontent-recursion-app` in `test/cli/` — all must stay green together.

2. **Re-entrant render — `Node.getBoundingRect`.** `localBoundingRect`/`boundingRect` refresh layout by rendering the whole tree from the root. If BrightScript queries a bounding rect *while a render is running* — e.g. an `ArrayGrid`/`RowList` lazily creating an item whose `init()` or observer measures a `Label` — the refresh re-enters rendering and recurses. Guard: `SGRoot.rendering`, set around the scene/dialog render in `RoSGScreen` **and around `getBoundingRect`'s own refresh render**; `getBoundingRect` skips the full-scene refresh while `rendering` is true (returning already-computed rects, which also matches Roku — layout isn't finalized during `init()`). Keep any new synchronous "render the whole tree to measure" call behind this flag with a `finally` restore. Regression: `grid-measure-app` in `test/cli/`.

3. **Cross-thread serialization — AA/array cycles (`factory/Serializer.ts`).** `fromSGNode` dedupes revisited **nodes** via its `visited` WeakSet, but a plain AA/array cycle (a helper AA back-referencing its own task `m`, e.g. `this._plugin = m` — common in analytics SDKs) recurses `jsValueOf ↔ fromAssociativeArray` forever; the throw also aborts `checkTaskRun` before `started` is set, so the render loop retries every frame → OOM. Guard: containers share the visited set **per descent path** (added on entry, removed in `finally`) — a cyclic reference is dropped (`null`/`{}`, one-shot warning); a container referenced from two sibling paths still serializes both times. Don't "simplify" to whole-pass tracking like nodes — that drops diamond-shaped shared data. Regression: "circular container references" in `test/extensions/scenegraph/NodeSerialization.test.js`.

### Focus chain consistency (`focusedChild` ↔ live focus)

`focusedChild` is a stored, observable field: `Node.setNodeFocus` walks the parent chain (`createPath`) at focus time and points each ancestor's `focusedChild` toward the focused node. The trap is **timing**: a component often calls `m.top.setFocus(true)` in `init()`, which runs (inside `createNode`) **before** the node is appended to its parent (`addChildren`). At that moment the chain is just `[node]`, so ancestors never get `focusedChild` set — and a later `m.top.focusedChild.<anything>` hits `invalid` (dot-on-invalid crash). So `Node.setNodeParent` (the single chokepoint all append paths call) **repairs the chain on attach**: if live `sgRoot.focused` is within the newly parented subtree, it re-points `focusedChild` from the root down. Each attach extends the chain one level. Don't remove that repair as "redundant". Regression: `test/extensions/scenegraph/FocusBeforeAttach.test.js`.

### Rendezvous architecture (multi-threaded Tasks)

SceneGraph `Task` nodes run their `functionName` on a **dedicated worker thread**, mirroring Roku's render-thread / task-thread model. The thread owning and rendering the scene graph is **thread 0 ("Render")**; each Task gets a thread id `> 0`. `sgRoot.threadId` (and `BrsDevice.threadId`) identify the current thread; `sgRoot.inTaskThread()` is `threadId > 0`. Every node records an `owner` thread id (Scene and Global are always thread 0).

A node's authoritative copy lives on its owner thread, so reading/writing a node you don't own must **rendezvous**: a synchronous blocking request to the owner. Implemented in `nodes/Task.ts` + `nodes/Node.ts`:

- **Transport** — each Task owns a `SharedObject` wrapping a `SharedArrayBuffer`. `ThreadUpdate` messages (`action`: `get`/`set`/`call`/`resp`/`ack`/`nil`, plus `type`, `address`, `key`, `value`) are written in; the receiver wakes via `Atomics`-based `taskBuffer.waitVersion(...)`. Lifecycle/state transitions flow over normal `postMessage` (`TaskData`, `TaskState`).
- **Field writes** — `Node.setValue` → `rendezvousSet`; if `shouldRendezvous()` (`inTaskThread() && owner !== threadId`) it forwards via `task.syncRemoteField`. Otherwise, on the render thread, it pushes the change to any Task observing that field's port.
- **Field reads / method calls** — `RoSGNode`/`ContentNode` methods call `rendezvousCall(interpreter, "<method>", [args])`. When `shouldRendezvous()`, it serializes args (node args re-owned by thread 0) and calls `task.requestMethodCall(...)`, which blocks (default 10s timeout, logs "Rendezvous timeout") until `resp`/`nil`. `requestFieldValue` does the same for plain reads.
- **Crossing into a node sends ownership**: a `Node` passed from a task to the render thread is re-owned (`setOwner(0)`), so later access from the task rendezvouses back.
- **Function values cross threads via AST rebuild** — `jsValueOf` serializes a user-defined `Callable` as name + source location; `restoreCallable` (`factory/Serializer.ts`) resolves it from the per-worker anon registry (location-verified — `$anon_N` ids collide across workers) or rebuilds it with `toCallable` from the component AST retained in `ComponentDefinition.scopeStatements` (set by `setupInterpreterWithSubEnvs` — keep it retained). Sound because BrightScript has no lexical closures: `m` binds to the receiver at call time. Unresolvable → stub returning `uninitialized` + one-shot warning. Matches device behavior (a Task's `m` copy keeps functions callable, e.g. analytics-SDK helpers). Regression: `test/extensions/scenegraph/CallableSerialization.test.js`.
- **Task startup** — when `control` becomes `"run"`, `checkTaskRun` posts `TaskData` (shared buffer, serialized `m`, render-thread id, `tmp:`/`cachefs:` volumes). The core spins up a worker → extension's `execTask` → `initializeTask` rebuilds the tree and invokes the task function. The `tick` hook drains incoming updates each iteration via `task.processThreadUpdate()`.
- **Internal presentation children must not cross threads — `Node.serializesChildren()`.** A built-in composite node that builds its **visible children in its constructor** and keeps **private field references** to them (updated every frame) must **not** serialize those children. `fromSGNode` includes a node's `_children_` only when `node.serializesChildren()` is true (default); `updateSGNode` no-ops when `_children_` is absent. Why it matters: when a Task references such a node, its child list crosses over, and the Task's `updateSGNode` reconciliation **replaces** the render-thread children with fresh deserialized copies — but the node's private fields still point at the **originals**, so per-frame updates (`showUI` on `Video`) land on nodes no longer in the render tree and the UI silently stops drawing. Overridden to `false` on **`Video`** (trick-play bar, header labels, spinner, paused icon, overlay, clock timer) and **`TrickPlayBar`** (its own track/fill/ticker/label posters — needed separately because `Video` exposes the bar as a node-typed `trickPlayBar` **field**, serialized independently of the Video's own children). A Task never renders, so it never needs these. Apply the same override to any new built-in node with constructor-built, field-referenced children reachable from a Task (as a child *or* a node-typed field); plain data nodes like `ProgressBar` (no internal children) need nothing. Regression: `test/extensions/scenegraph/VideoCrossThreadChildren.test.js`.

See `docs/extensions.md`, `packages/scenegraph/README.md`, and `docs/scenegraph-rendezvous.md` (design + performance/reliability/memory/fidelity analysis).

### Debugger halts every thread (`DataType.DBT`)

Entering the Micro Debugger (`STOP`, dev-mode crash, or `BREAK`) must freeze **all** threads. The handshake is one shared-array slot `DataType.DBT`: `notifyDebugStarted()` writes the debugging thread's id, `notifyDebugEnded()` clears it, and other threads block on it via **`BrsDevice.pauseIfDebugging()`** (the single definition, called by both `checkBreakCommand` and the Task rendezvous waits). But `DBT` is only *polled*, and a Task parked mid-rendezvous is blocked in `Atomics.wait` on its own response buffer, which can't watch `DBT`. So every blocking loop in `nodes/Task.ts` (`requestFieldValue`, `requestMethodCall`, `waitForFieldAck`, `getNewEvents`) **caps each sleep to `RENDEZVOUS_POLL_MS` (100 ms)** and re-checks `pauseIfDebugging()` each iteration — else a Task mid-rendezvous throws a spurious "Rendezvous timeout" out from under the debugger. **Invariants:** check `pauseIfDebugging()` *before* the timeout break and **reset the deadline** on pause (debug time mustn't count); the pause path **must not re-send** the request; `EXIT` calls `notifyDebugEnded()` (not only `CONT`) so `DBT` is never left set (deadlock). Normal latency is unaffected — a stored response wakes the waiter immediately via `notify`. Gap: `debugThreads` still lists only the current thread.

## App packaging & encryption (`.bpk`)

`brs-cli --pack <password> --out <dir>` turns a plaintext app (`.zip` or `--root` folder) into an **encrypted `.bpk`**. The password is the **raw AES-256-CTR key — exactly 32 chars** (no KDF/salt), and is required to *run* the `.bpk` (`--pack <password>`, or `options.password` in the browser API).

**Two independent encryption layers**, same password:
1. The **source blob** (`source/data`) — precompiled token stream + raw component text.
2. The **whole-package container** — the entire zip wrapped in AES-256-CTR so even plaintext assets are unreadable at rest.

### Package container encryption (`src/core/packageEncryption.ts`)

Standard libs can't do per-entry zip encryption (`fflate` has none; `@lvcabral/zip` documents "No encryption"), so the whole zip is wrapped: `[MAGIC "BRSBPK1\0"][16-byte IV][AES-256-CTR(zip)]`. `encryptPackage` wraps at pack time (CLI `runApp` after `updateAppZip`; exported for browser packers); `decryptPackage` unwraps in `loadAppZip` **before** `unzipSync` (both `src/cli/package.ts` and `src/api/package.ts`, now `async` + password). The password reaches `loadAppZip` from `program.pack` (CLI) / `currentApp.password` (browser).

- **Backward compatible by construction:** a real zip starts with `PK\x03\x04`, never `BRSBPK1`, so `decryptPackage` returns plain zips / legacy `.bpk`s untouched. A wrong password is caught by checking the decrypted bytes start with `PK` → "Invalid password" (CTR has no auth tag).
- **Uses Web Crypto (`globalThis.crypto.subtle`), not Node `crypto`** — the package is unzipped on the main thread / API bundle (`target: web`), which has no `crypto`/`Buffer` polyfill. Web Crypto is native in browsers and Node 22+, so no bundle cost.
- **Performance: negligible.** Hardware AES (~6–8 GB/s): a 3.4 MB package decrypts in ~0.6 ms, 50 MB in ~8 ms. Container adds 24 bytes.

### What gets encrypted, and the blob format

Two things fold into a **single encrypted blob** (`encode({ pcode, files })` → `zlibSync` → AES-256-CTR), written as `source/data` (ciphertext) + `source/var` (IV), originals stripped:

- **`pkg:/source/*.brs`** → lexed/preprocessed to a **token stream** (`pcode`) — long-standing (`runSource` via `lexParseSync`).
- **`pkg:/components/**/*.{brs,xml}`** → stored as **raw text** in `files`, keyed by lowercase package-relative path (`collectComponentFiles`). Covers external scripts *and* inline `<script>` blocks.

Backward compatible: legacy `.bpk`s have no `files` key. Core stays SceneGraph-agnostic — it treats `components/**` as opaque "extra encrypted files".

### Runtime restore — the FileSystem overlay (do not replace with a mounted volume)

On decrypt (`runEncrypted`, and `executeTask` for browser Task threads), `files` is pushed into an **opt-in in-memory overlay** on `FileSystem` via `setSourceOverlay`. `existsSync`/`readFileSync`/`statSync`/`findSync` consult the overlay first **only when non-empty** (zero change for normal apps). The SceneGraph loader (`getComponentDefinitionMap`) and `ComponentScopeResolver` read decrypted components transparently.

**Source protection — the overlay is consumed, then dropped.** `setupInterpreterWithSubEnvs` (from the SceneGraph `onBeforeExecute`) **eagerly parses every component's scripts** before `Main` runs, so `runBeforeExecuteHooks` calls `clearSourceOverlay()` right after. From then on the app's own BrightScript (`ReadAsciiFile`, `roFileSystem`, `MatchFiles`/`ListDir`, …) sees the component `.brs`/`.xml` as absent — matching the protection tokenized `source/` already gives. Also cleared on each `setup()`.

> The overlay was chosen over "decrypt then mount a reorganized `pkg:` volume": zenFS's `CopyOnWrite` can't init through the synchronous `configureSync` the engine uses (async `create()` → `EAGAIN`); manual `CopyOnWriteFS` loses `caseFold:"lower"` (Roku fs is case-insensitive) and crashes `readdir` on the Zip's empty `components/` dir. The synchronous fallbacks cost full-app memory/startup since the Zip backend reads lazily. The overlay is synchronous, case-correct, minimal-memory, and free of zenFS internals.

### Stripping & SceneGraph detection (two `updateAppZip`s + a `components/` marker)

`updateAppZip(source, iv, packedFiles)` rebuilds the package, dropping `source/*` **and** every path in `packedFiles`. **Two copies must stay in sync**: `src/cli/package.ts` (CLI) and `src/api/package.ts` (browser). Both then call `stripEncryptedComponentDirs`, which **prunes the now-empty `components/` subtree** (it would leak app structure) — keeping only dirs holding surviving non-encrypted assets, plus a single top-level `components/` marker.

The marker matters because the **browser** decides whether to load SceneGraph by scanning the package (`loadAppZip`): unencrypted apps are detected by a `components/*.xml` entry, but an encrypted app's XML is gone, so it's detected by the preserved folder (`hasSceneGraph = isEncrypted ? hasComponentsFolder : hasSGComponents`). The CLI registers SceneGraph unconditionally (`--no-sg` to disable), so this detection is browser-only. `TaskPayload.password` is threaded through (`src/core/common.ts`, `src/api/task.ts`) so browser Task threads can decrypt.

Regression: the "SceneGraph .bpk encryption" suite in `test/cli/cli.test.js`.

## CLI

`src/cli/` builds into `packages/node/bin`. `brs-cli` runs `.brs` files, `.zip`/`.bpk` packages, or a REPL (no args). Key flags: `--ascii`/`--unicode` (render the screen as terminal art), `--ecp` (ECP server on port 8060 + SSDP), `--debug` (developer mode), `--no-sg`, `--pack`/`--out` (create `.bpk`), `--root` (mount `pkg:/` from a dir), `--ext-vol` (mount `ext1:`), `--deep-link`, `--registry`. See `docs/run-as-cli.md`.

### Production vs developer mode (`debugOnCrash`)

The engine runs **production by default**; `--debug` (CLI) / `options.debugOnCrash` (API) switches to **developer mode**. The runtime gate is `BrsDevice.tracking` (set in `setDeviceInfo` from `deviceInfo.debugOnCrash`). When off (production), the engine skips debug instrumentation:

- No component (`bscs`), SceneGraph node (`sgnodes`), or lexeme (`stats`) counting, and no texture-registry tracking (`query/r2d2-bitmaps` / `requestBitmaps()` return empty).
- The **Micro Debugger is disabled**: `STOP` exits the app (`EXIT_BRIGHTSCRIPT_STOP`), break requests are ignored (`exit-app` still works), and the crash `BackTrace:` is suppressed.
- The call stack is still maintained, so `try/catch`'s `e.backtrace` works in both modes; reference counting, `dispose()`, and error messages are unchanged.
- **Encrypted `.bpk`s always run in production** — `debugOnCrash` is forced off in `executeFile`/`executeTask` (`isEncryptedPayload`) so a protected app can't be inspected.

Gate any new debug/inspection bookkeeping behind `BrsDevice.tracking` (or `interpreter.options.stopOnCrash`).

### Texture memory (`query/r2d2-bitmaps`)

`src/core/device/Graphics.ts` is a global texture-memory registry modeling Roku's internal `roGraphics`. `RoBitmap` registers/unregisters live bitmaps and `RoFontRegistry` contributes fonts (both gated by `BrsDevice.tracking`). Requested on demand via the shared-array `BufferType.R2D2` flag (served in `checkBreakCommand`) and returned as a `postMessage` `{ graphics }` — surfaced by the CLI ECP endpoint `GET /query/r2d2-bitmaps` and the browser API `requestBitmaps()` + `bitmaps` event.

## Conventions

- **ALWAYS run `npm run lint` and `npm run prettier:write` before every commit.** Both must pass; fix anything they surface first.
- **Conditional compilation:** `/// #if BROWSER` … `/// #endif` blocks (via `ifdef-loader`) tailor `src/` to browser vs. node builds. Keep platform-specific imports inside these guards.
- **ESLint** uses `@typescript-eslint` with the `prettier` config and type-aware rules (`await-thenable`, `promise-function-async`, `no-for-in-array`, `prefer-for-of`, `eqeqeq: smart`, `logical-assignment-operators`, `no-case-declarations`); `import/no-extraneous-dependencies` is enforced.
- **Wrap `switch` `case`/`default` bodies in braces when they declare bindings** — a `let`/`const`/`function`/`class` under a bare `case` leaks into sibling cases. Enforced by ESLint (`no-case-declarations`).
- **Prefer logical-assignment operators** (`??=`, `||=`, `&&=`) over `x = x ?? y` etc. and over `if (!x) x = y`. Enforced (`logical-assignment-operators`), mostly auto-fixable.
- **Never embed an assignment inside a larger expression** — give it its own statement. Write `x ??= []; x.push(y);`, **not** `(x ??= []).push(y)`; same for `=` inside a `return`/condition/argument/ternary. Flagged by SonarCloud (`typescript:S1121`) on every PR, **not** by ESLint, so it won't surface locally.
- **Prefer `for...of` over `Array.prototype.forEach`** — cleaner, supports `break`/`continue`/`await`, no per-element callback. For an index use a `for` loop or `arr.entries()`. Reserve `.map`/`.filter`/`.reduce` for building a new value.
- **Prefer `String.raw` over backslash-escaped string literals** — `` String.raw`C:\folder\file.mp4` ``, `` String.raw`\d+` ``. Enforced (`unicorn/prefer-string-raw`), auto-fixable. It fires only on plain string literals (leaves template literals alone); a lone trailing backslash still needs `"\\"`.
- **Prefer `replaceAll()` over `replace()` with a global regex** — `str.replaceAll(/…/g, …)`. Enforced (`unicorn/prefer-string-replace-all`), auto-fixable; a regex arg still requires the `g` flag. Leave single-match `replace()` (string arg or non-`g` regex) as-is.
- The SceneGraph extension imports the engine as `"brs-engine"`, never via relative `../core` paths — it's a separate bundle bound to the host at load time.
- A detailed `.github/copilot-instructions.md` has additional contributor guidance.

## Documentation

`docs/` is the source of truth for usage: `build-from-source.md`, `integrating.md`, `engine-api.md`, `customization.md`, `run-as-cli.md`, `using-node-library.md`, `extensions.md`, `scenegraph-rendezvous.md`, `remote-control.md`, `limitations.md`, `contributing.md`.

## Roku reference documentation (`external/dev-doc` submodule)

Roku's official docs ([rokudev/dev-doc](https://github.com/rokudev/dev-doc), branch `v2.0`) are vendored as a **git submodule** at `external/dev-doc`. The BrightScript + SceneGraph reference under **`external/dev-doc/docs/REFERENCES/`** (Markdown + YAML frontmatter) is the **authoritative spec** — consult it whenever implementing, fixing, or verifying a feature so simulated behavior matches a real device.

> Pinned to a specific commit; populate with `git submodule update --init external/dev-doc` (a plain checkout leaves it empty). **Reference only** — never make build/runtime code depend on it. Update with `git -C external/dev-doc pull origin v2.0`, then commit the new pointer.

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

Match documented **field names, types, defaults, and access permissions** exactly. Use the `brs-reference` skill to look things up.
