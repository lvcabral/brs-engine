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

### Required deployment asset: `assets/common.zip`

`packages/browser/assets/common.zip` (and its SceneGraph-aware counterpart in `packages/scenegraph/assets/common.zip`) is the **`common:/` volume** — it contains the default fonts, system audio, CA certificates, and BrightScript library stubs (`LibCore`, `roku_ads`, `roku_analytics`, `roku_browser`) that all BrightScript apps expect to be present. **Any web app that embeds the engine must serve this file at `./assets/common.zip` relative to `brs.api.js`.** The API library fetches it automatically on startup via `fetch('./assets/common.zip')` — if the file is missing, fonts and system libraries will be unavailable and most apps will fail or look broken.

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

#### Interfaces are method grouping, not separate types

Roku documents a component's methods under `ifXxx` interfaces, but **we do not implement each `ifXxx` as its own type/contract**. A component implements all its methods and registers them via `registerMethods({ ifXxx: [...callables] })`, where the `ifXxx` key is just **metadata grouping** that mirrors the docs. Most methods are defined inline on the component class itself (e.g. `RoArray`'s `join`/`sort`, all of `RoVideoPlayer`'s `ifVideoPlayer` methods).

`src/core/brsTypes/interfaces/` (`IfArray`, `IfEnum`, `IfHttpAgent`, `IfList`, `IfMessagePort`, `IfSocket`, `IfToStr`, `IfDraw2D`, …) holds a **small, deliberate set** of helper classes — effectively abstract/shared method bundles to **reduce duplication** across components that expose the same interface (e.g. `ifHttpAgent` is shared by many `roXxx`). They are instantiated with the owning component (`new IfArray(this)`) and their callables are spread into `registerMethods`. This is **not** a complete mirror of Roku's interface list — only the interfaces worth sharing live here; everything else is inline.

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
- **Extension paths in `DeviceInfo.extensions` are resolved by the worker (`brs.worker.js`), not the page.** Because `importScripts()` runs inside the Web Worker, the URL is relative to the worker bundle's location — not to `index.html`. If your worker lives at `lib/brs.worker.js` and `brs-sg.js` sits next to it (`lib/brs-sg.js`), the correct value is `"./brs-sg.js"`, **not** `"./lib/brs-sg.js"`. Getting this wrong produces a silent failure: SceneGraph apps load but `roSGScreen` / `roSGNode` are unregistered. The simplest layout is to keep all engine bundles in the same folder so the relative path is just `./brs-sg.js`.
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

### XML `<interface>` field redeclaration — system vs. XML-defined (`addFields`)

When `addFields` (in `factory/NodeFactory.ts`) builds a custom component's fields, a `<field>` whose name already exists on the node is handled by **who defined the existing field**, not merely that it collides:

- A field inherited from a **built-in base type** (`Group`, `Label`, …) is a **system** field — created by `registerDefaultFields` with the `Field` `system` flag set (`field.isSystem()`). Roku lets a component **redeclare** such a field: the redeclaration re-applies the XML default/type and `addFields` continues, so a field declared *after* it is still added. Do **not** treat this as a duplicate — the guard is `else if (field && !field.isSystem())`.
- A field defined in an **ancestor XML component's** `<interface>` is *not* a system field (added via `addNodeField`, `system=false`). Redeclaring it **is** a genuine duplicate: `addFields` writes the `Attempt to add duplicate field "…"` warning to `BrsDevice.stderr` and **returns early**, so the trailing fields in that component are never added (they read back as `invalid`).

Because `addNodeField` is a no-op when the field already exists, a redeclared system field keeps its existing `Field` instance; the XML default is applied by the subsequent `setValueSilent`. Regression coverage: the `duplicate-system-field-app` fixture + test in `test/cli/cli.test.js` (system-field redeclaration applies the new default and adds the trailing field; an ancestor-XML-field redeclaration still warns and drops the trailing field).

### Per-node memory: lazy fields and lazy methods (large content trees)

A large EPG (e.g. the SGDEX **TimeGridView** sample) creates thousands of `ContentNode`s. Two per-instance costs used to be paid eagerly for every node and could exhaust V8's young generation (`young object promotion failed` OOM on deep vertical scrolling). Both are now **built on demand**; keep them lazy when touching this code.

1. **Hidden default fields (`Node.registerDefaultFields` / `resolveField`).** `ContentNode` declares ~105 default fields, ~103 of them `hidden: true` metadata. These are **not** materialized as `Field` objects up front. `registerDefaultFields` keeps every `hidden` default in a shared per-class spec — `Node.hiddenSpecCache`, a `WeakMap<constructor, Map<name, FieldModel>>` (only `ContentNode` populates it). Non-hidden defaults are still materialized in the constructor. **`resolveField(mapKey)`** builds the real `Field` on first read/write/observe/probe, preserving the model's `system`+`hidden` flags — so a type-check-only resolve (`canAcceptValue`) does **not** un-hide it, while a genuine read/write does (matching the pre-lazy behavior). Any by-name lookup that must see hidden metadata goes through the public **`resolveField`** (instead of `this.fields.get`) and the public spec-aware **`hasNodeField`** (instead of `this.fields.has`) — routed sites include `Node` get/getValue/setValue/observers, `ContentNode.hasField`, and the external `NodeFactory` paths (`addFields` redeclaration, `addAliases`, `addChildren`, `populateNodeFromAA`, `linkField`). A fresh `ContentNode` now materializes ~4 fields instead of ~107. Regression coverage: `test/extensions/scenegraph/HiddenFields.test.js`.

2. **Method Callables (`BrsComponent.buildMethods` / `ensureMethods`).** Each node's ~70 `roSGNode` method Callables (plus their `StdlibArgument`s, `impl` closures, and `BrsInterface` metadata) were the dominant per-node cost (~66 KB/node), and field access (`node.title`) never needs them — they back method calls (`addField`, `observeField`, `getChild`…). `BrsComponent` now exposes a **`buildMethods()`** hook (default no-op — eager components are unchanged) invoked at most once by **`ensureMethods()`** on the first `getMethod`/`hasInterface`/`GetInterface`. `RoSGNode`'s ~70 methods are **prototype getters** (zero per-instance cost) registered inside its `buildMethods()`; the per-node `RoHttpAgent` is likewise lazy (a getter — rendering still reads `httpAgent.customHeaders`, but data nodes never build it). `ContentNode` overrides `buildMethods()` (calls `super.buildMethods()` first, then `overrideMethods([count, keys, items, hasField])`, also getters). A data-only node that never has a method called on it allocates none of these Callables. Measured: bare `Node` ~106 KB → ~42 KB, `ContentNode` ~112 KB → ~48 KB per node. Regression coverage: `test/extensions/scenegraph/LazyMethods.test.js`. **Invariant:** the method getters return a fresh Callable per access — only reference them inside `buildMethods()` (via the `registerMethods` lists), never as an identity-stable `this.<method>` field elsewhere; and any new reader of a component's `interfaces` map must call `ensureMethods()` first.

> Still eager, and the next optimization target: each `setValue` costs ~15 KB (a `Field` + boxed value + dirty/`freshFields` tracking) — independent of the two lazy paths above.

### Stack-overflow hot paths (fragile — read before touching)

Two distinct SceneGraph code paths can recurse until the JS call stack overflows; both surface to BrightScript as `roSGNode.Set (unhandled exception): "...": Maximum call stack size exceeded`. They are unrelated — diagnose which one before "fixing" the other. A real overflow's BrightScript backtrace is misleading (it often shows a single frame, because `Field.executeCallbacks` pops stack frames as the error unwinds); capture the **native JS stack** mid-recursion (a temporary depth tripwire dumping `new Error().stack` via `BrsDevice.stderr`) to see the real cycle.

1. **Observer dispatch — `Field.notifyObservers` + `ContentNode` parentField fan-out.** This area has regressed repeatedly (#905 → #943 → #904 follow-up). Dispatch is **synchronous depth-first**, guarded by a per-field `notifying` re-entrancy flag. That guard is only correct *because* dispatch is synchronous — `notifying` stays true for the field's entire observer subtree. Do **not** convert it to a breadth-first/queued ("trampoline") dispatcher: releasing `notifying` between dispatches lets a sibling re-enqueue the field and (without coalescing) it never terminates; adding coalescing instead drops a field's legitimate *second* notification within one cascade and leaves dependent fields stale (the blank-`Label` regression). A `ContentNode` whose own field-change observer writes back into the same node is bounded by a per-`ContentNode` `propagating` guard in `notifyParentFields` (`ContentNode.ts`). Regression coverage lives in `test/cli/` (`button-label-app`, `contentnode-recursion-app`, `contentnode-parentfield-app`, `sharedcontent-recursion-app`) and these must all stay green together.

2. **Re-entrant render — `Node.getBoundingRect`.** `localBoundingRect`/`boundingRect` refresh layout by rendering the whole tree from the root (`root.renderNode(...)`). If BrightScript queries a bounding rect *while a render is already running* — e.g. an `ArrayGrid`/`RowList` lazily creating an item component whose `init()` or a field observer measures a `Label` — the refresh re-enters rendering, which creates/measures more items, and recurses. Guard: `SGRoot` exposes a `rendering` flag, set around the scene/dialog render in `RoSGScreen`; `getBoundingRect` skips the full-scene refresh while `sgRoot.rendering` is true (returning the rects already computed by the active pass, which also matches Roku — layout isn't finalized during `init()`). Keep any new synchronous "render the whole tree to measure" call behind this flag.

### Focus chain consistency (`focusedChild` ↔ live focus)

`focusedChild` is maintained as a stored, observable field: `Node.setNodeFocus` walks the parent chain (`createPath`) at focus time and points each ancestor's `focusedChild` at the next node down toward the focused node. The trap is **timing**: a custom component commonly calls `m.top.setFocus(true)` in its `init()`, and `init()` runs (inside `createNode`) **before** the node is appended to its parent (`addChildren` in `factory/NodeFactory.ts`). At that moment the chain is just `[node]`, so ancestors never get their `focusedChild` set — and a later `m.top.focusedChild.<anything>` from BrightScript then hits `invalid` (dot-on-invalid crash). `Node.setNodeParent` (the single chokepoint all append paths call) therefore **repairs the chain on attach**: if the live `sgRoot.focused` is within the newly parented subtree, it re-points `focusedChild` from the root down to the focused node. As the tree assembles, each attach extends the chain one level, matching a real device where `focusedChild` is always consistent with the live focus. Don't remove that repair as "redundant" — it's what makes set-focus-before-attach work. Regression coverage: `test/extensions/scenegraph/FocusBeforeAttach.test.js`.

### Rendezvous architecture (multi-threaded Tasks)

SceneGraph `Task` nodes run their `functionName` on a **dedicated worker thread**, mirroring Roku's render-thread / task-thread model. The thread that owns the scene graph and renders it is **thread 0 ("Render")**; each running Task gets a thread id `> 0`. `sgRoot.threadId` (and `BrsDevice.threadId`) identify the current thread; `sgRoot.inTaskThread()` is `threadId > 0`. Every node records an `owner` thread id (Scene and Global are always owned by thread 0).

Because a node's authoritative copy lives on its owner thread, reading/writing a node you don't own must **rendezvous**: a synchronous, blocking request to the owning thread. This is implemented in `nodes/Task.ts` + `nodes/Node.ts`:

- **Transport** — each Task owns a `SharedObject` wrapping a `SharedArrayBuffer`. `ThreadUpdate` messages (`action`: `get` / `set` / `call` / `resp` / `ack` / `nil`, plus `type`, `address`, `key`, `value`) are written into it; the receiver is woken with `Atomics`-based `taskBuffer.waitVersion(...)`. Task lifecycle/state transitions also flow over normal `postMessage` (`TaskData`, `TaskState`).
- **Field writes** — `Node.setValue` calls `rendezvousSet`; if `shouldRendezvous()` (`inTaskThread() && owner !== threadId`) it forwards the change to the owner via `task.syncRemoteField`. Otherwise, on the render thread, it pushes the change to any Task that observes that field's port.
- **Field reads / method calls** — `RoSGNode`/`ContentNode` methods call `rendezvousCall(interpreter, "<method>", [args])`. When `shouldRendezvous()`, it serializes args (node args are re-owned by thread 0) and calls `task.requestMethodCall(...)`, which blocks (with a default 10s timeout, logging a "Rendezvous timeout" warning) until a `resp`/`nil` comes back. `requestFieldValue` does the same for plain field reads.
- **Crossing into a node sends ownership**: a `Node` value passed from a task to the render thread is re-owned (`setOwner(0)`) so subsequent access from the task rendezvouses back.
- **Task startup** — when a Task's `control` becomes `"run"`, `checkTaskRun` posts a `TaskData` (with the shared buffer, serialized `m`, render-thread id, `tmp:`/`cachefs:` volumes). The core spins up a worker, which calls the extension's `execTask` → `initializeTask` to rebuild the node tree on the new thread and invoke the task function. The extension's `tick` hook drains incoming thread updates each iteration via `task.processThreadUpdate()`.

See `docs/extensions.md` and `packages/scenegraph/README.md` for the consumer-facing view, and `docs/scenegraph-rendezvous.md` for the rendezvous design (broker → direct render→task channel) and its performance/reliability/memory/fidelity analysis.

## App packaging & encryption (`.bpk`)

`brs-cli --pack <password> --out <dir>` turns a plaintext app (`.zip` or `--root` folder) into an **encrypted `.bpk`**. The password is the **raw AES-256-CTR key — it must be exactly 32 chars** (no KDF/salt). The same password is required to *run* the `.bpk` (`--pack <password>` on launch, or `options.password` in the browser API).

There are **two independent encryption layers** with the same password:
1. The **source blob** (`source/data`) — precompiled token stream + raw component text (below).
2. The **whole-package container** — the entire zip is wrapped in AES-256-CTR so even the plaintext assets (images, fonts, data, manifest) are unreadable at rest (below).

### Package container encryption (`src/core/packageEncryption.ts`)

The standard libraries can't do per-entry zip encryption — **`fflate` (packer) has none and the `@lvcabral/zip` mount backend documents "No encryption."** So instead the whole zip is wrapped in a container: `[MAGIC "BRSBPK1\0"][16-byte IV][AES-256-CTR(zip)]`. `encryptPackage` wraps at pack time (CLI `runApp` after `updateAppZip`; exported for browser packers); `decryptPackage` unwraps in `loadAppZip` **before** `unzipSync` (both `src/cli/package.ts` and `src/api/package.ts`, which became `async` and take a `password`). The password reaches `loadAppZip` from `program.pack` (CLI) / `currentApp.password` (browser).

- **Backward compatible by construction:** a real zip always starts with the `PK\x03\x04` header, never the `BRSBPK1` magic, so `decryptPackage` returns plain zips / legacy `.bpk`s untouched (no password needed). A wrong password is caught by checking the decrypted bytes start with `PK` → "Invalid password" (CTR has no auth tag).
- **Uses Web Crypto (`globalThis.crypto.subtle`), not Node `crypto`.** The package is unzipped on the **main thread / API bundle (`target: web`), which has no `crypto`/`Buffer` polyfill** (only the worker does). Web Crypto is native in browsers (secure context already required) and Node 22+, so no polyfill/bundle-size cost. This layer is self-contained — same algorithm/params encrypt and decrypt.
- **Performance: negligible.** Hardware AES (~6–8 GB/s): a 3.4 MB package decrypts in ~0.6 ms at load, a 50 MB one in ~8 ms — on par with the adjacent `unzip` and dwarfed by splash/parse. Container adds 24 bytes; no size change otherwise.

### What gets encrypted, and the blob format

Two things are folded into a **single encrypted blob** (`encode({ pcode, files })` → `zlibSync` → AES-256-CTR), written to the package as `source/data` (ciphertext) + `source/var` (IV), with the originals stripped:

- **`pkg:/source/*.brs`** → lexed/preprocessed to a **token stream** (`pcode`), the long-standing behavior (`runSource` in `src/core/index.ts`, via `lexParseSync`).
- **`pkg:/components/**/*.{brs,xml}`** (SceneGraph) → stored as **raw text** in `files`, keyed by lowercase package-relative path (`collectComponentFiles` in `src/core/index.ts`). This covers external scripts *and* inline `<script>` blocks inside component XML.

The format is **backward compatible**: legacy `.bpk`s have no `files` key and load unchanged. Core stays SceneGraph-agnostic — it treats `components/**` as opaque "extra encrypted files".

### Runtime restore — the FileSystem overlay (do not replace with a mounted volume)

On decrypt (`runEncrypted`, and `executeTask` for browser Task threads), the `files` map is pushed into an **opt-in in-memory overlay** on `FileSystem` via `setSourceOverlay` (`src/core/device/FileSystem.ts`). `existsSync`/`readFileSync`/`statSync`/`findSync` consult the overlay first **only when it's non-empty** (zero behavior change for normal apps). The SceneGraph loader (`getComponentDefinitionMap` → `findSync`/`readFileSync`) and `ComponentScopeResolver` then read the decrypted components transparently.

**Source protection — the overlay is consumed, then dropped.** `setupInterpreterWithSubEnvs` (run from the SceneGraph `onBeforeExecute`) **eagerly parses every component's scripts** before the app's `Main` runs, so `runBeforeExecuteHooks` calls `clearSourceOverlay()` immediately after the hooks finish. From then on the app's own BrightScript (`ReadAsciiFile`, `roFileSystem`, `MatchFiles`/`ListDir`, …) sees the component `.brs`/`.xml` as absent — matching the protection that tokenized `source/` already gives (you can't read back the source you shipped). The overlay is also cleared on each `setup()`.

> The overlay was chosen deliberately over "decrypt then mount a reorganized `pkg:` volume". zenFS's `CopyOnWrite` backend **cannot be initialized through the synchronous `configureSync`** the engine uses (its `create()` is async → `EAGAIN`), and manual `CopyOnWriteFS` construction **loses `caseFold:"lower"`** (Roku fs is case-insensitive) and **crashes `readdir`** on the Zip's empty `components/` dir entry. The synchronous fallbacks (seed an InMemory volume with every entry, or rebuild+remount the zip) cost full-app memory/startup since the Zip backend otherwise reads lazily. The overlay is synchronous, case-correct (keyed on `getPath`'s lowercased path), minimal-memory, and free of zenFS internals.

### Stripping & SceneGraph detection (two `updateAppZip`s + a `components/` marker)

`updateAppZip(source, iv, packedFiles)` rebuilds the package, dropping `source/*` **and** every path in `packedFiles`. There are **two copies** that must stay in sync: `src/cli/package.ts` (CLI pack) and `src/api/package.ts` (browser pack). Both then call `stripEncryptedComponentDirs`, which **prunes the now-empty `components/` subdirectory tree** (it would otherwise leak the app's structure) — keeping only directories that still hold surviving non-encrypted assets, plus a single top-level `components/` marker.

That marker matters because the **browser** decides whether to load the SceneGraph extension by scanning the package (`loadAppZip` in `src/api/package.ts`): an *unencrypted* app is detected by a `components/*.xml` entry, but an encrypted app's XML is gone — so it's detected by the preserved `components/` folder instead (`hasSceneGraph = isEncrypted ? hasComponentsFolder : hasSGComponents`). The CLI registers SceneGraph unconditionally (`--no-sg` to disable), so this detection is browser-only. `TaskPayload.password` is threaded through (`src/core/common.ts`, `src/api/task.ts`) so browser Task threads can decrypt the overlay.

Regression coverage: the "SceneGraph .bpk encryption" suite in `test/cli/cli.test.js` (asserts the container is encrypted/not a readable zip, components stripped + `components/` marker kept, runs with correct password, fails cleanly on wrong password at the container layer, prunes the nested component directory tree, and confirms a packed app's BrightScript cannot read its own component source back).

## CLI

`src/cli/` builds into `packages/node/bin`. `brs-cli` runs `.brs` files, `.zip`/`.bpk` packages, or a REPL (no args). Key flags: `--ascii`/`--unicode` (render the screen as terminal art), `--ecp` (ECP control server on port 8060 + SSDP discovery), `--debug` (developer mode — see below), `--no-sg` (disable SceneGraph), `--pack`/`--out` (create encrypted `.bpk`), `--root` (mount `pkg:/` from a directory), `--ext-vol` (mount `ext1:`), `--deep-link`, `--registry`. See `docs/run-as-cli.md`.

### Production vs developer mode (`debugOnCrash`)

The engine runs in **production mode by default**; `--debug` (CLI) / `options.debugOnCrash` (API) switches to **developer mode**. The single runtime gate is `BrsDevice.tracking` (set in `BrsDevice.setDeviceInfo` from `deviceInfo.debugOnCrash`). When off (production), the engine skips all debug instrumentation to avoid per-object/per-node overhead:

- No component (`bscs`), SceneGraph node (`sgnodes`), or lexeme (`stats`) counting, and no texture-registry tracking (so `query/r2d2-bitmaps` / `requestBitmaps()` return empty).
- The **Micro Debugger is disabled**: a `STOP` statement exits the app (`EXIT_BRIGHTSCRIPT_STOP`), break requests are ignored (the `exit-app` command still works), and the crash `BackTrace:` is suppressed.
- The call stack is still maintained, so `try/catch`'s `e.backtrace` works in both modes; reference counting, `dispose()`, and error messages are unchanged.
- **Encrypted `.bpk` packages always run in production mode** — `debugOnCrash` is forced off in `executeFile`/`executeTask` (`isEncryptedPayload`) so a protected app can't be inspected.

When adding new debug/inspection bookkeeping, gate it behind `BrsDevice.tracking` (or `interpreter.options.stopOnCrash`).

### Texture memory (`query/r2d2-bitmaps`)

`src/core/device/Graphics.ts` is a global texture-memory registry modeling Roku's internal `roGraphics`. `RoBitmap` registers/unregisters live bitmaps and `RoFontRegistry` contributes fonts (both gated by `BrsDevice.tracking`). The data is requested on demand via the shared-array `BufferType.R2D2` flag (served in `BrsDevice.checkBreakCommand`) and returned as a `postMessage` `{ graphics }` object — surfaced by the CLI ECP endpoint `GET /query/r2d2-bitmaps` and the browser API `requestBitmaps()` + `bitmaps` event.

## Conventions

- **ALWAYS run `npm run lint` and `npm run prettier:write` before every commit.** Both must pass with no errors; fix any issues they surface before committing.
- **Conditional compilation:** `/// #if BROWSER` … `/// #endif` blocks (via `ifdef-loader`) tailor the same `src/` to browser vs. node builds. Keep platform-specific imports inside these guards.
- **ESLint** uses `@typescript-eslint` with the `prettier` config and type-aware rules (`await-thenable`, `promise-function-async`, `no-for-in-array`, `prefer-for-of`, `eqeqeq: smart`, `logical-assignment-operators`, `no-case-declarations`). `import/no-extraneous-dependencies` is enforced. Run `npm run lint` and `npm run prettier:write` before committing.
- **Wrap `switch` `case`/`default` bodies in braces when they declare bindings.** A `let`/`const` (or `function`/`class`) declared directly under a `case`/`default` leaks into the sibling cases of the same `switch`; always scope it with a block (`case X: { const y = ...; break; }`). This is enforced by ESLint (`no-case-declarations`).
- **Prefer logical-assignment operators** (`??=`, `||=`, `&&=`) over the equivalent `x = x ?? y` / `x = x || y` / `x = x && y` and over `if (!x) x = y` guards. This is enforced by ESLint (`logical-assignment-operators` with `enforceForIfStatements`); most violations are auto-fixable with `eslint --fix`.
- **Prefer `for...of` over `Array.prototype.forEach`** for iteration. `for...of` reads cleaner, supports `break`/`continue`/`await`, and avoids per-element callback allocation. For an index, use `for (let i = 0; i < arr.length; i++)` or `arr.entries()`. Reserve `.map`/`.filter`/`.reduce` for building a new value (not side effects).
- **Prefer `String.raw` over string literals that escape backslashes.** Write `` String.raw`C:\folder\file.mp4` `` and `` String.raw`\d+` `` instead of `"C:\\folder\\file.mp4"` / `"\\d+"` — the raw literal has no doubled backslashes, so what you read is what you get. This is enforced by ESLint (`unicorn/prefer-string-raw`) and is auto-fixable with `eslint --fix`. The rule only fires on plain string literals; it leaves template literals alone (so `` `\\u${hex}` `` stays a normal template — `String.raw` can't be used there anyway because `\u${` collides with the `\u{…}` code-point escape). A lone trailing backslash also can't use `String.raw` (it would escape the closing backtick), so keep `"\\"` as a regular literal.
- **Prefer `replaceAll()` over `replace()` with a global regex.** Use `str.replaceAll(/…/g, …)` (or a plain-string first arg when the pattern is a literal) instead of `str.replace(/…/g, …)` — it states the intent to replace every match. This is enforced by ESLint (`unicorn/prefer-string-replace-all`) and is auto-fixable with `eslint --fix`. `replaceAll` with a regex still **requires** the `g` flag (a non-global regex throws), which the auto-fix preserves. Leave single-match `replace()` calls (string arg, or a non-`g` regex) as-is — they are not equivalent.
- The SceneGraph extension imports the engine as the package `"brs-engine"`, never via relative `../core` paths — it is compiled as a separate bundle and bound to the host engine at load time.
- A detailed `.github/copilot-instructions.md` exists in this repo with additional contributor guidance worth consulting.

## Documentation

`docs/` is the source of truth for usage: `build-from-source.md`, `integrating.md`, `engine-api.md`, `customization.md`, `run-as-cli.md`, `using-node-library.md`, `extensions.md`, `scenegraph-rendezvous.md`, `remote-control.md`, `limitations.md`, `contributing.md`.

## Roku reference documentation (`external/dev-doc` submodule)

Roku's official, open-sourced developer docs ([rokudev/dev-doc](https://github.com/rokudev/dev-doc), branch `v2.0`) are vendored as a **git submodule** at `external/dev-doc`. The BrightScript + SceneGraph reference lives under **`external/dev-doc/docs/REFERENCES/`** (Markdown with YAML frontmatter). **This is the authoritative spec** for what each component, interface, event, node, and global function should do — consult it whenever implementing, fixing, or verifying a missing/incomplete feature so the simulated behavior matches a real Roku device.

> The submodule is pinned to a specific commit and only populated after `git submodule update --init external/dev-doc` (a plain checkout leaves the folder empty). It is **reference only** — never make build/runtime code depend on it. Update it with `git -C external/dev-doc pull origin v2.0`, then commit the new pointer.

Layout under `external/dev-doc/docs/REFERENCES/` and how it maps to the source tree:

| Reference path | Documents | Implement / verify in |
| --- | --- | --- |
| `brightscript/components/roXxx.md` | `roXxx` component: how it's created, which interfaces/events it supports | `src/core/brsTypes/components/RoXxx.ts` (registered in `BrsObjects.ts`) |
| `brightscript/interfaces/ifXxx.md` | An interface's method signatures, args, return types, defaults | methods on the component, grouped under the `ifXxx` key in `registerMethods` (see "Interfaces are method grouping" above) — **not** a standalone type |
| `brightscript/events/roXxxEvent.md` | Event objects returned via `roMessagePort` | the matching event component |
| `brightscript/language/*.md` | Language spec: statements, expressions/types, error handling, conditional compilation, format strings, reserved words, and the global Math/String/Utility/Runtime functions | `src/core/lexer/`, `src/core/parser/`, `src/core/preprocessor/`, `src/core/stdlib/` |
| `scenegraph/**/<node>.md` | SceneGraph node fields (name/type/default/access) and behavior, grouped by category (renderable, layout, list-and-grid, dialog, animation, media, …) | `src/extensions/scenegraph/nodes/<Node>.ts` (see "Creating a new Node type") |
| `scenegraph/xml-elements/*.md`, `scenegraph/component-functions/*.md` | Component XML (`<component>`/`<interface>`/`<children>`/`<script>`) and `init`/`onKeyEvent` | `src/extensions/scenegraph/parser/`, `factory/` |
| `deprecated-apis.md` | APIs Roku has deprecated — check before adding/relying on one | n/a (informational) |

When implementing a node or component, match the documented **field names, types, defaults, and access permissions** exactly (e.g. a node's `defaultFields` should mirror the reference's Fields table). Use the `brs-reference` skill to look things up.
