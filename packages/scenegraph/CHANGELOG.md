# Changelog

All notable changes to `brs-scenegraph` extension will be documented in this file.

<a name="v0.0.1"></a>

## [v0.0.1 - Initial alpha release](https://github.com/lvcabral/brs-engine/releases/tag/brs-scenegraph-v0.0.1) - 05 December 2025

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
