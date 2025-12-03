# BrightScript Engine Extensions

The BrightScript Simulation Engine now supports plug-in style extensions that can hook into the interpreter lifecycle without forking the core runtime. Extensions are regular JavaScript/TypeScript modules that implement the `BrsExtension` interface and register themselves with `registerExtension`. Each interpreter instance receives the registered extensions before executing BrightScript code, which allows you to add new host objects, preprocess app packages, or respond to worker ticks.

```ts
import { registerExtension, BrsExtension } from "brs-engine";

class MyExtension implements BrsExtension {
    name = "MyExtension";

    onInit(interpreter) {
        // Set up custom CreateObject factories, global functions, etc.
    }

    async onBeforeExecute(interpreter, payload) {
        // Inspect payload.manifest, add files to the virtual FS, etc.
    }

    tick(interpreter) {
        // Receive periodic callbacks on the worker thread.
    }
}

registerExtension(() => new MyExtension());
```

## SceneGraph extension (`brs-scenegraph`)

The SceneGraph runtime ships as a standalone extension located under `packages/scenegraph`. It owns the XML component parser, `RoSGScreen`, nodes, and task execution helpers.

### Browser integrations

1. Ship `brs.worker.js`, `brs.api.js`, and `brs-sg.js` together under the `lib/` folder.
2. Copy `assets/common.zip` from this package to replace the default one, providing SceneGraph fonts and resources.
3. When an app package contains a `pkg:/components/` folder the packaging layer pushes `{ moduleId: "brs-scenegraph", modulePath: "./brs-sg.js" }` into the worker payload.
4. The worker calls `importScripts("./brs-sg.js")`, finds `BrightScriptExtension`, and calls `registerExtension` before executing the app.

No extra glue code is required as long as `brs-sg.js` is served next to the worker bundle. If you want to preload the extension even when no components are present, call `registerExtension(() => new BrightScriptExtension())` manually in your host code.

### Node.js and CLI

- The `brs-node` CLI registers the SceneGraph extension by default. Pass `--no-sg` to skip loading it.
- When embedding the Node.js library you can register the extension yourself:

```ts
import { registerExtension } from "brs-engine";
import { BrightScriptExtension } from "brs-scenegraph";

registerExtension(() => new BrightScriptExtension());
```

Once registered, every interpreter you create (via `createPayloadFromFiles`, CLI runs, tests, etc.) will run SceneGraph components.

### Common volume assets

SceneGraph needs fonts, locale tables, and imagery that do not ship with the core interpreter. During `npm run build` or `npm run release` inside `packages/scenegraph` so this package's assets build step runs:

- Copy the base assets from `src/core/common` and merge them with the extension overrides under `src/extensions/scenegraph/common` (extension files win on name collisions).
- Zip the merged tree to `packages/scenegraph/assets/common.zip`, which mirrors Roku's `common:/` volume.
- In the development environment it overwrites `packages/browser/assets/common.zip` so the browser package example uses the SceneGraph-aware asset bundle.

Note: In production environments you must copy `assets/common.zip` from this package to replace the default `common:/` volume.

## Creating your own extension

1. **Implement `BrsExtension`** – the interface lives in `src/core/extensions.ts` and exposes lifecycle hooks:
   - `onInit` – called once per interpreter before any payload runs. Use it to register new `CreateObject` factories or global functions.
   - `onBeforeExecute` – called for each payload (apps and tasks) before execution. Use it to prepare resources, parse manifests, or update `BrsDevice` state.
   - `updateSourceMap` – push extra files into the debugger/source map.
   - `tick` – receive a callback on each interpreter tick (good for polling or background work).
   - `execTask` – handle `Task` thread payloads if your extension owns custom task nodes.

2. **Register a factory** – call `registerExtension(() => new MyExtension())` exactly once before you spin up interpreters. The factory pattern ensures each interpreter gets a fresh instance.

3. **Bundle for each runtime** – browser workers expect an ES5 bundle that can be loaded through `importScripts`, while Node.js integrations can rely on CommonJS/ESM modules. The SceneGraph package emits `lib/brs-sg.js` (browser) and `lib/brs-sg.node.js` (Node) as a reference implementation.

4. **Distribute assets** – if your extension needs fonts, bitmaps, or configuration files, package them with your module in a common volume zip (e.g. `assets/common.zip`). Document how hosts should copy the zip to replace the default `common:/` volume.

5. **Document activation** – explain how hosts should copy your bundle next to `brs.worker.js` or how they should call `registerExtension`. The worker only loads modules that you add to the `extensions` array inside the payload.

## Recommended workflow

- Use the `brs-scenegraph` repository layout as a starting point (Webpack config + TypeScript build that targets both runtimes).
- Keep `brs-engine` as a dependency or peer dependency so that your extension always compiles against the same `BrsExtension` interface.
- Write integration tests using the Node.js runtime; you can spin up interpreters with mocks and assert that your hooks run when expected.
- Share your extension plans! The roadmap already includes Roku SDK1 and BrightSign compatibility layers built as extensions, so aligning your design with the shared system helps everyone.
