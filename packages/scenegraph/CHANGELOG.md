# Changelog

All notable changes to `brs-scenegraph` extension will be documented in this file.

<a name="v0.1.0"></a>

## [v0.1.0 - Rendezvous and other major improvements and fixes](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.1.0) - 11 February 2026

This release brings major improvements both to the SceneGraph extension, including better support for Task threads, introducing real Rendezvous, support for new node components, and various bug fixes and optimizations. Read the full release notes below for more details.

### Release Changes

* (rsg) Fixed `Scene` set fields before initialization by [@lvcabral](https://github.com/lvcabral) in [#819](https://github.com/lvcabral/brs-engine/pull/819)
* (rsg) Prevent block `setValue` when in the task thread by [@lvcabral](https://github.com/lvcabral) in [#820](https://github.com/lvcabral/brs-engine/pull/820)
* (rsg) Fixed `Scenegraph` crash handling and stack trace by [@lvcabral](https://github.com/lvcabral) in [#823](https://github.com/lvcabral/brs-engine/pull/823)
* (rsg) Implemented support for debugging Task threads by [@lvcabral](https://github.com/lvcabral) in [#825](https://github.com/lvcabral/brs-engine/pull/825)
* (rsg) Fixed line numbers on embedded XML scripts by [@lvcabral](https://github.com/lvcabral) in [#826](https://github.com/lvcabral/brs-engine/pull/826)
* (rsg) Properly handle `Task` function errors and prevent crash when `functionName` is not found by [@lvcabral](https://github.com/lvcabral) in [#827](https://github.com/lvcabral/brs-engine/pull/827)
* (rsg) Added `PosterGrid` and improved focus style handling on `ArrayGrid` based nodes by [@lvcabral](https://github.com/lvcabral) in [#828](https://github.com/lvcabral/brs-engine/pull/828)
* (rsg) Fixed `ScrollingLabel` to handle `horizAlign` and actually scroll when needed by [@lvcabral](https://github.com/lvcabral) in [#829](https://github.com/lvcabral/brs-engine/pull/829)
* (rsg) Added `InfoPane` node by [@lvcabral](https://github.com/lvcabral) in [#830](https://github.com/lvcabral/brs-engine/pull/830)
* (rsg) Fixed handling of boxed numbers on `setValue()` in several nodes by [@lvcabral](https://github.com/lvcabral) in [#831](https://github.com/lvcabral/brs-engine/pull/831)
* (rsg) Removed the interpreter parameter from `setNodeFocus` by [@lvcabral](https://github.com/lvcabral) in [#832](https://github.com/lvcabral/brs-engine/pull/832)
* (rsg) Fixed the handling of `OK` key in `RowList` and `ZoomRowList` by [@lvcabral](https://github.com/lvcabral) in [#833](https://github.com/lvcabral/brs-engine/pull/833)
* (rsg) Added `setNodeFocus` method to `ArrayGrid` to reset `itemFocused` when getting the focus by [@lvcabral](https://github.com/lvcabral) in [#834](https://github.com/lvcabral/brs-engine/pull/834)
* (rsg) Added `sgnodes` command to `MicroDebugger` to list node type statistics by [@lvcabral](https://github.com/lvcabral) in [#835](https://github.com/lvcabral/brs-engine/pull/835)
* (rsg) Added `MaskGroup` draft and fixed several issues with field assignment by [@lvcabral](https://github.com/lvcabral) in [#836](https://github.com/lvcabral/brs-engine/pull/836)
* (rsg) Fixed component XML parsing of `interface` to handle attributes as case-insensitive by [@lvcabral](https://github.com/lvcabral) in [#838](https://github.com/lvcabral/brs-engine/pull/838)
* (rsg) Improved parsing of field types: `StringArray`, `Vector2D` and `Vector2DArray` by [@lvcabral](https://github.com/lvcabral) in [#839](https://github.com/lvcabral/brs-engine/pull/839)
* (rsg) Fixed XML parsing to support `alias` field to be set without `type` by [@lvcabral](https://github.com/lvcabral) in [#841](https://github.com/lvcabral/brs-engine/pull/841)
* (rsg) Added support for default item component on `RowList` and item focus callback in `ArrayGrid` by [@lvcabral](https://github.com/lvcabral) in [#842](https://github.com/lvcabral/brs-engine/pull/842)
* (rsg) Implemented all `PanelSet` related nodes by [@lvcabral](https://github.com/lvcabral) in [#837](https://github.com/lvcabral/brs-engine/pull/837)
* (rsg) Fixed `role` fields to not be case sensitive by [@lvcabral](https://github.com/lvcabral) in [#847](https://github.com/lvcabral/brs-engine/pull/847)
* (rsg) Implemented the context expansion for the Main thread by [@lvcabral](https://github.com/lvcabral) in [#848](https://github.com/lvcabral/brs-engine/pull/848)
* (rsg) Allowed replacing hidden fields when extending `ContentNode` by [@lvcabral](https://github.com/lvcabral) in [#849](https://github.com/lvcabral/brs-engine/pull/849)
* (rsg) Prevent issues with `Video` node on startup (after the Splash) by [@lvcabral](https://github.com/lvcabral) in [#851](https://github.com/lvcabral/brs-engine/pull/851)
* (rsg) Improved handling of manifest entries `ui_resolutions` and `uri_resolution_autosub` by [@lvcabral](https://github.com/lvcabral) in [#852](https://github.com/lvcabral/brs-engine/pull/852)
* (rsg) Enhance autoSub URI replacement to support regex patterns by [@lvcabral](https://github.com/lvcabral) in [#853](https://github.com/lvcabral/brs-engine/pull/853)
* (rsg) Improved de-serialization of `Scene` and other nodes in `Task` threads by [@lvcabral](https://github.com/lvcabral) in [#854](https://github.com/lvcabral/brs-engine/pull/854)
* (rsg) Fixed crash when `m.top.getScene()` is used on `init()` in a `Task` thread by [@lvcabral](https://github.com/lvcabral) in [#857](https://github.com/lvcabral/brs-engine/pull/857)
* (rsg) Fixed handling of `Node` alias to support child changes by [@lvcabral](https://github.com/lvcabral) in [#859](https://github.com/lvcabral/brs-engine/pull/859)
* (rsg) Implemented `ancestorBoundingRect()` method by [@lvcabral](https://github.com/lvcabral) in [#860](https://github.com/lvcabral/brs-engine/pull/860)
* (rsg) Fixed `Node` field string assignment to keep the current value when parse fails by [@lvcabral](https://github.com/lvcabral) in [#861](https://github.com/lvcabral/brs-engine/pull/861)
* (rsg) Fixed rendering to prevent `rectBound` calculation to clear `isDirty` flag by [@lvcabral](https://github.com/lvcabral) in [#862](https://github.com/lvcabral/brs-engine/pull/862)
* (rsg) Added support for multiple `Node` field aliases (CSV) by [@lvcabral](https://github.com/lvcabral) in [#863](https://github.com/lvcabral/brs-engine/pull/863)
* (rsg) Fixed `Node.setValue()` signature to prevent field creation on assignment by [@lvcabral](https://github.com/lvcabral) in [#864](https://github.com/lvcabral/brs-engine/pull/864)
* (rsg) Fixed item component handling to not fail when fields are not defined in XML by [@lvcabral](https://github.com/lvcabral) in [#865](https://github.com/lvcabral/brs-engine/pull/865)
* (rsg) Fixed `Node` field aliases observer trigger by [@lvcabral](https://github.com/lvcabral) in [#866](https://github.com/lvcabral/brs-engine/pull/866)
* (rsg) Fixed `Node.setValue()` to update its field before the aliases by [@lvcabral](https://github.com/lvcabral) in [#867](https://github.com/lvcabral/brs-engine/pull/867)
* (rsg) Fixed `Poster`, `BusySpinner`, `Video` and `TrickPlayBar` to properly handle child nodes `uri` update by [@lvcabral](https://github.com/lvcabral) in [#868](https://github.com/lvcabral/brs-engine/pull/868)
* (rsg) Fixed `BusySpinner` dimensions calculation by [@lvcabral](https://github.com/lvcabral) in [#869](https://github.com/lvcabral/brs-engine/pull/869)
* (rsg) Fixed circular dependency issue when `Node` has child with its same `id` in `alias` by [@lvcabral](https://github.com/lvcabral) in [#870](https://github.com/lvcabral/brs-engine/pull/870)
* (rsg) Improved `Node.setValue()` exception handling by [@lvcabral](https://github.com/lvcabral) in [#871](https://github.com/lvcabral/brs-engine/pull/871)
* (rsg) Fixed `StandardDialog` focus and `back` key press handling by [@lvcabral](https://github.com/lvcabral) in [#872](https://github.com/lvcabral/brs-engine/pull/872)
* (rsg) Fixed observables serialization and handling of `InfoFields` by [@lvcabral](https://github.com/lvcabral) in [#874](https://github.com/lvcabral/brs-engine/pull/874)
* (rsg) Fixed `Serializer` to prevent circular dependency by [@lvcabral](https://github.com/lvcabral) in [#875](https://github.com/lvcabral/brs-engine/pull/875)
* (rsg) Changed `handleThreadUpdate` to preserve update id on relay to other threads by [@lvcabral](https://github.com/lvcabral) in [#879](https://github.com/lvcabral/brs-engine/pull/879)
* (rsg) Added `nodeType` to `RoSGNode` and updated stats call by [@lvcabral](https://github.com/lvcabral) in [#880](https://github.com/lvcabral/brs-engine/pull/880)
* (rsg) Fixed `BusySpinner` image size handling for resolution mismatch by [@lvcabral](https://github.com/lvcabral) in [#882](https://github.com/lvcabral/brs-engine/pull/882)
* (rsg) Implement thread updates similar to SceneGraph Rendezvous  by [@lvcabral](https://github.com/lvcabral) in [#856](https://github.com/lvcabral/brs-engine/pull/856)

[Full Changelog][v0.1.0]

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

[v0.1.0]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.5...brs-sg-v0.1.0
[v0.0.5]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.4...brs-sg-v0.0.5
[v0.0.4]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.3...brs-sg-v0.0.4
[v0.0.3]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.2...brs-sg-v0.0.3
[v0.0.2]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.1...brs-sg-v0.0.2