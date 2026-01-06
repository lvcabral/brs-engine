# Changelog

All notable changes to `brs-scenegraph` extension will be documented in this file.

<a name="v0.0.5"></a>

## [v0.0.5 - Various Fixes and Improvements](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.5) - 5 January 2026

This release brings several fixes and improvements to the SceneGraph extension, including the implementation of `Animation` and `Interpolator` nodes, as well as various bug fixes related to node creation, focus management, and event handling.

### Release Changes

* (rsg) Fixed `roSGNode` creation using boxed `String` as `nodeType` by [@lvcabral](https://github.com/lvcabral) in [#806](https://github.com/lvcabral/brs-engine/pull/806)
* (rsg) Fixed focus when `initialFocus` is not set by [@lvcabral](https://github.com/lvcabral) in [#810](https://github.com/lvcabral/brs-engine/pull/810)
* (rsg) Fixed: `ArrayGrid` based nodes must reset focused item when `content` is updated by [@lvcabral](https://github.com/lvcabral) in [#811](https://github.com/lvcabral/brs-engine/pull/811)
* (rsg) Fixed `findNode` to prioritize search on `children` by [@lvcabral](https://github.com/lvcabral) in [#812](https://github.com/lvcabral/brs-engine/pull/812)
* (rsg) Implemented `Animation` and `Interpolator` nodes by [@lvcabral](https://github.com/lvcabral) in [#813](https://github.com/lvcabral/brs-engine/pull/813)
* (rsg) Changed `Node` to preserve field name case by [@lvcabral](https://github.com/lvcabral) in [#814](https://github.com/lvcabral/brs-engine/pull/814)
* (rsg) Fixed conflict on `roSGScreen` scene events handling by [@lvcabral](https://github.com/lvcabral) in [#815](https://github.com/lvcabral/brs-engine/pull/815)
* (cli) Fixed CLI loading SceneGraph components on Windows file system by [@lvcabral](https://github.com/lvcabral) in [#816](https://github.com/lvcabral/brs-engine/pull/816)
* (rsg) Optimized `roSGScreen` to only render when changes happened by [@lvcabral](https://github.com/lvcabral) in [#817](https://github.com/lvcabral/brs-engine/pull/817)

[Full Changelog][v0.0.5]

<a name="v0.0.4"></a>

## [v0.0.4 - Various Fixes and Improvements](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.4) - 31 December 2025

This release brings several fixes and improvements to the SceneGraph extension for the BrightScript Simulation Engine, including fixes for `Poster` rendering, `Overhang` logo scaling, and enhancements to `ArrayGrid` based nodes and `Field` handling.

### Release Changes

* (rsg) Fixed `Poster` rendering to match Roku's automatic scaling by [@lvcabral](https://github.com/lvcabral) in [#801](https://github.com/lvcabral/brs-engine/pull/801)
* (rsg) Fixed `Overhang` default logo scaling by [@lvcabral](https://github.com/lvcabral) in [#802](https://github.com/lvcabral/brs-engine/pull/802)
* (rsg) Fixed item component's events on `ArrayGrid` based nodes by [@lvcabral](https://github.com/lvcabral) in [#803](https://github.com/lvcabral/brs-engine/pull/803)
* (rsg) Changed `Field` to allow assign `roPath` to a `String` field by [@lvcabral](https://github.com/lvcabral) in [#804](https://github.com/lvcabral/brs-engine/pull/804)
* (rsg) Fixed `Task` to prevent crash on updated fields with `null` by [@lvcabral](https://github.com/lvcabral) in [#805](https://github.com/lvcabral/brs-engine/pull/805)

[Full Changelog][v0.0.4]

<a name="v0.0.3"></a>


## [v0.0.3 - Node and Task improvements and fixes](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.3) - 24 December 2025

This release brings several fixes and improvements to the SceneGraph extension for the BrightScript Simulation Engine, including support for the `change` field in `Node`, updates to `Task` behavior, and various bug fixes.

### Release Changes

* (rsg) Implemented support for `change` field in `Node` by [@lvcabral](https://github.com/lvcabral) in [#790](https://github.com/lvcabral/brs-engine/pull/790)
* (rsg) Changed `Task` to update existing `Node` fields to preserve references by [@lvcabral](https://github.com/lvcabral) in [#792](https://github.com/lvcabral/brs-engine/pull/792)
* (rsg) Fixed `Node` environment `hostNode` initialization by [@lvcabral](https://github.com/lvcabral) in [#794](https://github.com/lvcabral/brs-engine/pull/794)
* (rsg) Fixed `Node.callFunc()` to not be case sensitive by [@lvcabral](https://github.com/lvcabral) in [#796](https://github.com/lvcabral/brs-engine/pull/796)
* (chore) Renamed factory modules by [@lvcabral](https://github.com/lvcabral) in [#791](https://github.com/lvcabral/brs-engine/pull/791)

[Full Changelog][v0.0.3]

<a name="v0.0.2"></a>

## [v0.0.2 - Various Fixes and Improvements](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.2) - 12 December 2025

This release brings several fixes and improvements to the SceneGraph extension for the BrightScript Simulation Engine, including fixes for video UI handling, custom font management, and enhancements to node behavior.

### Release Changes

* (rsg) Fixes [#769](https://github.com/lvcabral/brs-engine/issues/769) `Video` UI header removed too soon by [@lvcabral](https://github.com/lvcabral) in [#781](https://github.com/lvcabral/brs-engine/pull/781)
* (rsg) Prevent crash when custom fonts are missing by [@lvcabral](https://github.com/lvcabral) in [#783](https://github.com/lvcabral/brs-engine/pull/783)
* (rsg) Made `ArrayGrid` based nodes to be aware of `content` changes by [@lvcabral](https://github.com/lvcabral) in [#784](https://github.com/lvcabral/brs-engine/pull/784)
* (rsg) Fixed `roSGNode` methods `setField` and `addFields` to properly handle `ContentNode` by [@lvcabral](https://github.com/lvcabral) in [#785](https://github.com/lvcabral/brs-engine/pull/785)
* (rsg) Removed usage of reflection to build `subtypeHierarchy` in `Node` by [@lvcabral](https://github.com/lvcabral) in [#786](https://github.com/lvcabral/brs-engine/pull/786)

[Full Changelog][v0.0.2]

<a name="v0.0.1"></a>

## [v0.0.1 - Initial alpha release](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.1) - 05 December 2025

This first alpha delivers the **SceneGraph** runtime as a standalone extension that plugs into the **BrightScript Simulation Engine**. It bundles both browser (`brs-sg.js`) and Node.js (`brs-sg.node.js`) libraries, merges the core `common:/` assets with the SceneGraph-specific resources, and wires the lifecycle hooks (`onInit`, `onBeforeExecute`, `tick`, `execTask`) required for Roku SceneGraph apps.

### Release Changes

* Added XML component parser, inheritance builder, and SceneGraph task execution pipeline so `roSGScreen` apps run without custom host glue.
* Implemented focus management, Draw2D rendering helpers, and device data wiring for the SceneGraph runtime in both worker and Node contexts.
* Added support for the following built-in nodes and components:
  * Core/runtime: `Scene`, `Node`, `RoSGNode`, `Group`, `LayoutGroup`, `ContentNode`, `Field`, `Font`, `Global`, `RSGPalette`.
  * Visual + interaction: `Label`, `ScrollingLabel`, `Poster`, `Rectangle`, `BusySpinner`, `Button`, `ButtonGroup`, `CheckList`, `RadioButtonList`, `LabelList`, `TextEditBox`, `Keyboard`, `MiniKeyboard`, `KeyboardDialog`, `Dialog`, `StandardDialog`, `StandardProgressDialog`, `StdDlgTitleArea`, `StdDlgContentArea`, `StdDlgProgressItem`, `Overhang`, `Panel`, `TrickPlayBar`.
  * Data-driven layouts: `RowList`, `ZoomRowList`, `ArrayGrid`, `MarkupList`, `MarkupGrid`.
  * Media + utility nodes: `Audio`, `Video`, `SoundEffect`, `Task`, `Timer`, `ChannelStore`.
* Published merged `assets/common.zip` so SceneGraph fonts, locale data, dialogs, and imagery are available through the simulated `common:/` volume in both `brs-engine` and `brs-node` packages.

[v0.0.5]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.4...brs-sg-v0.0.5
[v0.0.4]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.3...brs-sg-v0.0.4
[v0.0.3]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.2...brs-sg-v0.0.3
[v0.0.2]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.1...brs-sg-v0.0.2