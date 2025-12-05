# BrightScript SceneGraph Extension

This package publishes the Roku SceneGraph support as a standalone extension for the **BrightScript Simulation Engine**. It delivers the `roSGScreen` interpreter, component parser, node factory, tasks, and drawing pipeline as a plug-in so browser and Node.js hosts can enable RSG support on demand.

[![NPM Version](https://img.shields.io/npm/v/brs-scenegraph?logo=npm&label=brs-scenegraph&color=blue)](https://www.npmjs.com/package/brs-scenegraph)
[![License](https://img.shields.io/github/license/lvcabral/brs-engine?logo=github)](https://github.com/lvcabral/brs-engine/blob/master/LICENSE)
[![Build](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## Overview

- Implements the shared `BrsExtension` contract and hooks into interpreter lifecycle events (`onInit`, `onBeforeExecute`, `tick`, `execTask`).
- Parses component XML files, builds inheritance trees, and spins up sub-interpreter environments for each component script.
- Registers `RoSGScreen`, `RoSGNode`, built-in SceneGraph nodes, events, and task helpers so Roku apps can execute unmodified.
- Ships both browser (`lib/brs-sg.js`) and Node.js (`lib/brs-sg.node.js`) builds plus TypeScript definitions.
- Bundles SceneGraph-specific assets (fonts, locale data, images) into `assets/common.zip`, merging the core `src/core/common` tree with the extension's overrides under `src/extensions/scenegraph/common`.

> ⚠️ Note:
>
> SceneGraph support is in active development and currently released as **alpha** builds.
> See the current state of the SceneGraph implementation and other limitations of the **engine** in the [Current Limitations](https://github.com/lvcabral/brs-engine/blob/master/docs/limitations.md) document.

## Project packages

This module belongs to the [BrightScript Simulation Engine](https://github.com/lvcabral/brs-engine) monorepo. Related npm packages:

| Package | Description |
| --- | --- |
| [brs-engine](https://www.npmjs.com/package/brs-engine) | Browser/WebWorker build used by PWAs, Electron apps, and the web simulator |
| [brs-node](https://www.npmjs.com/package/brs-node) | Node.js CLI and automation runtime |
| **brs-scenegraph** (this package) | Optional SceneGraph extension consumed by the other packages |

## Installation

```bash
npm install brs-scenegraph
```

The extension depends on `brs-engine` so the runtime contracts stay in sync. When designing your own extension consider adding `brs-engine` (or `brs-node`) as a peer dependency as well.

## Usage

### Browser builds (`brs-engine`)

1. Deploy `lib/brs.worker.js`, `lib/brs.api.js`, and `lib/brs-sg.js` together.
2. Replace `assets/common.zip` with the one from this package to provide SceneGraph fonts and resources.
3. Tell the engine that SceneGraph is available by adding it to `DeviceInfo.extensions` when you call `brs.initialize`. The map key is the `SupportedExtension` enum value and the value is the worker-relative path to the bundle:

   ```ts
   import { SupportedExtension, DeviceInfo } from "brs-engine";

   const deviceOverrides: Partial<DeviceInfo> = {
	   extensions: new Map([[SupportedExtension.SceneGraph, "./brs-sg.js"]]),
   };

   brs.initialize(deviceOverrides, { debugToConsole: true });
   ```

4. When an app package contains a `pkg:/components/` folder the packaging layer checks the map above and, if the extension is registered, injects `{ moduleId: "brs-scenegraph", modulePath: "./brs-sg.js" }` into the worker payload.
5. The worker loads the script via `importScripts`, creates `BrightScriptExtension`, and registers it before running the app.

No extra glue is required if the file sits next to the worker bundle, but you can preload it manually by importing the module and calling `registerExtension` yourself if desired.

### Node.js / CLI (`brs-node`)

- The `brs-node` CLI enables the extension by default (pass `--no-sg` to skip it for CLI runs).
- For custom Node.js scripts register it manually:

```ts
import { registerExtension } from "brs-engine";
import { BrightScriptExtension } from "brs-scenegraph";

registerExtension(() => new BrightScriptExtension());
```

Call `registerExtension` before constructing or executing interpreters so tasks and nodes are ready.

## Development scripts

```bash
# build development artifacts
npm run build

# emit production bundles and declaration files
npm run release

# clean generated outputs
npm run clean
```

The build emits `lib/brs-sg.js` (browser) and `lib/brs-sg.node.js` (Node.js) plus `types/` declarations referenced by the package exports.

During the build we also merge `src/core/common` with `src/extensions/scenegraph/common`, zip the results to `assets/common.zip`, and copy that archive into both `packages/browser/assets` and `packages/node/assets` so the main packages pick up the SceneGraph-ready `common:/` volume automatically.

## Documentation

- [Main project README](../../README.md)
- [Extensions guide](../../docs/extensions.md)
- [SceneGraph source code](../../src/extensions/scenegraph/)

### Changelog

- Read the [package changelog](./CHANGELOG.md) to view the release notes.

## License

Copyright © 2019-2025 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](https://github.com/lvcabral/brs-engine/blob/master/LICENSE) license.
