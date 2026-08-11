# Changelog

All notable changes to `brs-scenegraph` extension will be documented in this file.

<a name="v0.4.0"></a>

## [v0.4.0 (beta) - Task Hardening and Rendering Fixes](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.4.0) - 10 August 2026

This release hardens the multi-threaded `Task` runtime: script-scope `m`, `m.global`/`m.top` references, `findNode()`, field sync and pre-launch port delivery all now survive a `Task` launch correctly. `renderNode` is split into separate layout and paint passes that prune settled subtrees for a major performance gain, and dozens of focus, layout and rendering fixes land across `LayoutGroup`, `PosterGrid`, `RowList`, `ArrayGrid`, `TextEditBox`, `ScrollingLabel`, `TimeGrid`, `Animation` and the Dynamic Keyboards. Read the full release notes below for more details.

### Release Changes

* (rsg) Defer init-time `focusedChild` notifications to the message loop by [@lvcabral](https://github.com/lvcabral) in [#1090](https://github.com/lvcabral/brs-engine/pull/1090)
* (rsg) Correct mid-render `boundingRect()` measurement of composite nodes by [@lvcabral](https://github.com/lvcabral) in [#1091](https://github.com/lvcabral/brs-engine/pull/1091)
* (rsg) Carry a custom node's script-scope `m` across threads by [@lvcabral](https://github.com/lvcabral) in [#1092](https://github.com/lvcabral/brs-engine/pull/1092)
* (rsg) Deliver a `Task`'s pre-launch port events to its thread by [@lvcabral](https://github.com/lvcabral) in [#1093](https://github.com/lvcabral/brs-engine/pull/1093)
* (rsg) Let `m.global.findNode()` reach the scene tree by [@lvcabral](https://github.com/lvcabral) in [#1094](https://github.com/lvcabral/brs-engine/pull/1094)
* (rsg) Parent the global node to the `Scene` by [@lvcabral](https://github.com/lvcabral) in [#1095](https://github.com/lvcabral/brs-engine/pull/1095)
* (rsg) Keep `m.global`'s own descendants out of its `findNode()` search by [@lvcabral](https://github.com/lvcabral) in [#1096](https://github.com/lvcabral/brs-engine/pull/1096)
* (rsg) Resolve `findNode()` against the executing component's scope by [@lvcabral](https://github.com/lvcabral) in [#1097](https://github.com/lvcabral/brs-engine/pull/1097)
* (rsg) Cross script-scope `m` as live references, only on owner transfer by [@lvcabral](https://github.com/lvcabral) in [#1098](https://github.com/lvcabral/brs-engine/pull/1098)
* (rsg) Repair the release build broken by the `findNode()` global check by [@lvcabral](https://github.com/lvcabral) in [#1099](https://github.com/lvcabral/brs-engine/pull/1099)
* (rsg) Reference `m.global`'s node fields in the `Task` launch payload by [@lvcabral](https://github.com/lvcabral) in [#1100](https://github.com/lvcabral/brs-engine/pull/1100)
* (rsg) Stop `findNode()` searching a node that has no component ancestor by [@lvcabral](https://github.com/lvcabral) in [#1101](https://github.com/lvcabral/brs-engine/pull/1101)
* (rsg) Don't crash when a `Task` sets a node-valued field to invalid by [@lvcabral](https://github.com/lvcabral) in [#1102](https://github.com/lvcabral/brs-engine/pull/1102)
* (rsg) Made cross-thread `Task` field sync and port observers work between threads by [@lvcabral](https://github.com/lvcabral) in [#1105](https://github.com/lvcabral/brs-engine/pull/1105)
* (rsg) Notify observing `Task` threads when content held by a field changes by [@lvcabral](https://github.com/lvcabral) in [#1108](https://github.com/lvcabral/brs-engine/pull/1108)
* (rsg) Deliver a `Task` field set made just before launch exactly once by [@lvcabral](https://github.com/lvcabral) in [#1110](https://github.com/lvcabral/brs-engine/pull/1110)
* (rsg) Time out a rendezvous only when the render thread stops running by [@lvcabral](https://github.com/lvcabral) in [#1115](https://github.com/lvcabral/brs-engine/pull/1115)
* (rsg) Split `renderNode` into layout/paint passes and prune settled subtrees (major performance gain) by [@lvcabral](https://github.com/lvcabral) in [#1120](https://github.com/lvcabral/brs-engine/pull/1120)
* (rsg) Match device behavior for `LayoutGroup`'s enum fields, spacing and size by [@lvcabral](https://github.com/lvcabral) in [#1122](https://github.com/lvcabral/brs-engine/pull/1122)
* (rsg) Keep script-scope references to `global`/`top` alive across a `Task` launch by [@lvcabral](https://github.com/lvcabral) in [#1123](https://github.com/lvcabral/brs-engine/pull/1123)
* (rsg) Resolve script-scope references into the `top`/`global` subtrees on `Task` launch by [@lvcabral](https://github.com/lvcabral) in [#1124](https://github.com/lvcabral/brs-engine/pull/1124)
* (rsg) Stop a directional key on an empty `RowList` from crashing the app by [@lvcabral](https://github.com/lvcabral) in [#1125](https://github.com/lvcabral/brs-engine/pull/1125)
* (rsg) Commit a focus change before notifying, and ignore a re-grab from a focus-loss observer by [@lvcabral](https://github.com/lvcabral) in [#1127](https://github.com/lvcabral/brs-engine/pull/1127)
* (rsg) Bind observer callback parameters the way a device does by [@lvcabral](https://github.com/lvcabral) in [#1129](https://github.com/lvcabral/brs-engine/pull/1129)
* (rsg) Normalize hex-string elements in `colorarray` fields by [@lvcabral](https://github.com/lvcabral) in [#1130](https://github.com/lvcabral/brs-engine/pull/1130)
* (rsg) `RowList` honors `vertFocusAnimationStyle` when scrolling rows by [@lvcabral](https://github.com/lvcabral) in [#1131](https://github.com/lvcabral/brs-engine/pull/1131)
* (rsg) Emit `scrollingStatus` on `ArrayGrid` key navigation by [@lvcabral](https://github.com/lvcabral) in [#1132](https://github.com/lvcabral/brs-engine/pull/1132)
* (rsg) Honor `clippingRect` on every renderable node by [@lvcabral](https://github.com/lvcabral) in [#1133](https://github.com/lvcabral/brs-engine/pull/1133)
* (rsg) Report per-row extents in a grid's `boundingRect` by [@lvcabral](https://github.com/lvcabral) in [#1134](https://github.com/lvcabral/brs-engine/pull/1134)
* (rsg) Made `Animation` `control` conform to a device by [@lvcabral](https://github.com/lvcabral) in [#1136](https://github.com/lvcabral/brs-engine/pull/1136)
* (rsg) Honor per-row layout in `LabelList` and rotate every node's translation by [@lvcabral](https://github.com/lvcabral) in [#1137](https://github.com/lvcabral/brs-engine/pull/1137)
* (rsg) Match a device's `PosterGrid` extent by [@lvcabral](https://github.com/lvcabral) in [#1138](https://github.com/lvcabral/brs-engine/pull/1138)
* (rsg) Match Roku's console format for rendezvous tracing by [@lvcabral](https://github.com/lvcabral) in [#1140](https://github.com/lvcabral/brs-engine/pull/1140)
* (rsg) Report a grid item's sub-rect as the bare item component by [@lvcabral](https://github.com/lvcabral) in [#1142](https://github.com/lvcabral/brs-engine/pull/1142)
* (rsg) Report a `PosterGrid`'s asymmetric vertical outset by [@lvcabral](https://github.com/lvcabral) in [#1144](https://github.com/lvcabral/brs-engine/pull/1144)
* (rsg) Report an alias field's own name in observer events by [@lvcabral](https://github.com/lvcabral) in [#1151](https://github.com/lvcabral/brs-engine/pull/1151)
* (rsg) Add missing documented `ContentNode` fields by [@lvcabral](https://github.com/lvcabral) in [#1152](https://github.com/lvcabral/brs-engine/pull/1152)
* (rsg) `ScrollingLabel` reports the full `maxWidth` as its measured width by [@lvcabral](https://github.com/lvcabral) in [#1154](https://github.com/lvcabral/brs-engine/pull/1154)
* (rsg) Fixed a `PosterGrid` caption placement regression from [#1144](https://github.com/lvcabral/brs-engine/pull/1144) by [@lvcabral](https://github.com/lvcabral) in [#1156](https://github.com/lvcabral/brs-engine/pull/1156)
* (rsg) Fixed the `Overhang` default logo overlapping the title/divider on a resolution-mismatched device by [@lvcabral](https://github.com/lvcabral) in [#1157](https://github.com/lvcabral/brs-engine/pull/1157)
* (rsg) `LayoutGroup` counts a hidden child's height in a vertical stack by [@lvcabral](https://github.com/lvcabral) in [#1158](https://github.com/lvcabral/brs-engine/pull/1158)
* (rsg) Fixed cross-thread `AppendChildren` duplicating a node instead of moving it by [@lvcabral](https://github.com/lvcabral) in [#1160](https://github.com/lvcabral/brs-engine/pull/1160)
* (rsg) Fixed stale item visuals after an in-place `ArrayGrid`/`RowList` content reorder by [@lvcabral](https://github.com/lvcabral) in [#1161](https://github.com/lvcabral/brs-engine/pull/1161)
* (rsg) Fixed `TimeGrid` content-mutation staleness, navigation, and loading feedback by [@lvcabral](https://github.com/lvcabral) in [#1162](https://github.com/lvcabral/brs-engine/pull/1162)
* (rsg) Fixed `TextEditBox` text/cursor mispositioning with a custom `backgroundUri` by [@lvcabral](https://github.com/lvcabral) in [#1165](https://github.com/lvcabral/brs-engine/pull/1165)
* (rsg) Fixed `TextEditBox` discarding the app-provided height with a custom background by [@lvcabral](https://github.com/lvcabral) in [#1167](https://github.com/lvcabral/brs-engine/pull/1167)
* (rsg) Update `currFocusRow`/`currFocusColumn` before `itemFocused` fires by [@lvcabral](https://github.com/lvcabral) in [#1168](https://github.com/lvcabral/brs-engine/pull/1168)
* (rsg) Normalize key actions/icons and add a `keySelected()` handler for the Dynamic Keyboards by [@lvcabral](https://github.com/lvcabral) in [#1169](https://github.com/lvcabral/brs-engine/pull/1169)
* (rsg) Stop painting fully transparent subtrees, and honor a 0-alpha blend color by [@lvcabral](https://github.com/lvcabral) in [#1172](https://github.com/lvcabral/brs-engine/pull/1172)
* (rsg) Gave `ArrayGrid` a `focusRect` hook so subclasses specialize geometry only by [@lvcabral](https://github.com/lvcabral) in [#1174](https://github.com/lvcabral/brs-engine/pull/1174)
* (rsg) Distinguish a layout pass from a paint frame whose drawing was suppressed by [@lvcabral](https://github.com/lvcabral) in [#1175](https://github.com/lvcabral/brs-engine/pull/1175)
* (rsg) Drop a backwards focus steal raised via a container redirect by [@lvcabral](https://github.com/lvcabral) in [#1177](https://github.com/lvcabral/brs-engine/pull/1177)
* (rsg) Apply the `scale` field to drawn content, bounding rect, and remaining text nodes by [@lvcabral](https://github.com/lvcabral) in [#1179](https://github.com/lvcabral/brs-engine/pull/1179)
* (rsg) Implemented `Poster` `loadDisplayMode="limitSize"` by [@lvcabral](https://github.com/lvcabral) in [#1180](https://github.com/lvcabral/brs-engine/pull/1180)

[Full Changelog][v0.4.0]

<a name="v0.3.0"></a>

## [v0.3.0 (beta) - SceneGraph Node Complete](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.3.0) - 25 July 2026

With this release we graduate the extension from `alpha` to `beta` stage, it completes the SceneGraph node set: every **concrete** node documented by Roku is now implemented, including the whole **Standard Dialog Framework**, the dynamic voice keyboards, the `TimeGrid` (EPG), the `Target*` nodes, the typographic labels and `MaskGroup` alpha-mask compositing. It also brings **Component Libraries**, `roRenderThreadQueue`, a hardened cross-thread rendezvous with direct render→task responses, and a large reduction of the per-node memory footprint for big content trees. Read the full release notes below for more details.

### Release Changes

* (rsg) Added `width`/`height` fields to the `Video` node and suppress its UI when windowed by [@lvcabral](https://github.com/lvcabral) in [#928](https://github.com/lvcabral/brs-engine/pull/928)
* (rsg) Index `RowList` per-row arrays by the absolute row index by [@lvcabral](https://github.com/lvcabral) in [#930](https://github.com/lvcabral/brs-engine/pull/930)
* (rsg) Implemented `MaskGroup` alpha-mask compositing by [@lvcabral](https://github.com/lvcabral) in [#931](https://github.com/lvcabral/brs-engine/pull/931)
* (rsg) Apply the `uri_resolution_autosub` manifest config more robustly by [@lvcabral](https://github.com/lvcabral) in [#932](https://github.com/lvcabral/brs-engine/pull/932)
* (rsg) Update the global focus pointer before clearing the old focus chain by [@lvcabral](https://github.com/lvcabral) in [#934](https://github.com/lvcabral/brs-engine/pull/934)
* (rsg) Implemented support for **Component Libraries** by [@lvcabral](https://github.com/lvcabral) in [#936](https://github.com/lvcabral/brs-engine/pull/936)
* (rsg) Added the `allowBackgroundTask` field to `Scene` with a warning for unsupported Instant Resume by [@lvcabral](https://github.com/lvcabral) in [#937](https://github.com/lvcabral/brs-engine/pull/937)
* (rsg) Load Component Libraries created at runtime by [@lvcabral](https://github.com/lvcabral) in [#938](https://github.com/lvcabral/brs-engine/pull/938)
* (rsg) Hardened the cross-thread rendezvous (fidelity and reliability) by [@lvcabral](https://github.com/lvcabral) in [#939](https://github.com/lvcabral/brs-engine/pull/939)
* (rsg) Rendezvous Phase 2 — `roRenderThreadQueue` and device-accurate timeouts by [@lvcabral](https://github.com/lvcabral) in [#940](https://github.com/lvcabral/brs-engine/pull/940)
* (rsg) Rendezvous Phase 3a — direct render→task responses (feature-flagged) by [@lvcabral](https://github.com/lvcabral) in [#941](https://github.com/lvcabral/brs-engine/pull/941)
* (rsg) Rendezvous Phase 3 — finalized the direct render→task responses by [@lvcabral](https://github.com/lvcabral) in [#942](https://github.com/lvcabral/brs-engine/pull/942)
* (rsg) Restored synchronous (depth-first) observer dispatch with a per-field re-entrancy guard, fixing blank button labels by [@lvcabral](https://github.com/lvcabral) in [#943](https://github.com/lvcabral/brs-engine/pull/943)
* (rsg) Implemented the **Standard Dialog Framework** nodes by [@lvcabral](https://github.com/lvcabral) in [#944](https://github.com/lvcabral/brs-engine/pull/944)
* (rsg) Implemented the `SimpleLabel` node by [@lvcabral](https://github.com/lvcabral) in [#945](https://github.com/lvcabral/brs-engine/pull/945)
* (rsg) Implemented the `MultiStyleLabel` and `StdDlgMultiStyleTextItem` nodes by [@lvcabral](https://github.com/lvcabral) in [#947](https://github.com/lvcabral/brs-engine/pull/947)
* (rsg) Implemented the `MonospaceLabel` node by [@lvcabral](https://github.com/lvcabral) in [#948](https://github.com/lvcabral/brs-engine/pull/948)
* (rsg) Implemented the `TimeGrid` node (EPG) by [@lvcabral](https://github.com/lvcabral) in [#949](https://github.com/lvcabral/brs-engine/pull/949)
* (rsg) Implemented the `TargetSet`, `TargetGroup` and `TargetList` nodes by [@lvcabral](https://github.com/lvcabral) in [#951](https://github.com/lvcabral/brs-engine/pull/951)
* (rsg) Implemented the Dynamic voice keyboard nodes by [@lvcabral](https://github.com/lvcabral) in [#952](https://github.com/lvcabral/brs-engine/pull/952)
* (rsg) Use the Dynamic keyboards in the Standard dialog framework by [@lvcabral](https://github.com/lvcabral) in [#953](https://github.com/lvcabral/brs-engine/pull/953)
* (rsg) Implemented the `roRenderThreadQueue` component (OS 15) by [@lvcabral](https://github.com/lvcabral) in [#954](https://github.com/lvcabral/brs-engine/pull/954)
* (rsg) Prevent a stack overflow from re-entrant render and the `ContentNode` `parentField` cascade by [@lvcabral](https://github.com/lvcabral) in [#959](https://github.com/lvcabral/brs-engine/pull/959)
* (rsg) Trim `script.val` in `getScripts()` to ignore whitespace-only bodies by [@markwpearce](https://github.com/markwpearce) in [#961](https://github.com/lvcabral/brs-engine/pull/961)
* (rsg) Added support for `associativearray` in `FieldKind` and the value type checks by [@lvcabral](https://github.com/lvcabral) in [#963](https://github.com/lvcabral/brs-engine/pull/963)
* (rsg) Give focus to a custom `StandardDialog`'s buttons by [@lvcabral](https://github.com/lvcabral) in [#968](https://github.com/lvcabral/brs-engine/pull/968)
* (rsg) Corrected `UserSelect` focus traversal, button centering and grid focus feedback by [@lvcabral](https://github.com/lvcabral) in [#970](https://github.com/lvcabral/brs-engine/pull/970)
* (rsg) Attach a list item component to its parent before `init()` by [@lvcabral](https://github.com/lvcabral) in [#971](https://github.com/lvcabral/brs-engine/pull/971)
* (rsg) Implemented the `Video` node `bufferingBar` and `retrievingBar` fields by [@lvcabral](https://github.com/lvcabral) in [#972](https://github.com/lvcabral/brs-engine/pull/972)
* (rsg) Hug the `LabelList` focus frame instead of overflowing rows by [@lvcabral](https://github.com/lvcabral) in [#976](https://github.com/lvcabral/brs-engine/pull/976)
* (rsg) Only prevent duplicate fields when those are defined in XML by [@lvcabral](https://github.com/lvcabral) in [#978](https://github.com/lvcabral/brs-engine/pull/978)
* (rsg) Box AA/Array node-field content the way Roku does (literal-aware) by [@lvcabral](https://github.com/lvcabral) in [#979](https://github.com/lvcabral/brs-engine/pull/979)
* (rsg) Fixed issues rendering Task-loaded content in grids by [@lvcabral](https://github.com/lvcabral) in [#982](https://github.com/lvcabral/brs-engine/pull/982)
* (rsg) Cut per-node memory for large content trees with lazy fields and lazy method Callables by [@lvcabral](https://github.com/lvcabral) in [#983](https://github.com/lvcabral/brs-engine/pull/983)
* (rsg) SceneGraph list, animation and format fixes for the hero-grid and living-room samples by [@lvcabral](https://github.com/lvcabral) in [#984](https://github.com/lvcabral/brs-engine/pull/984)
* (rsg) `RowList` rendering fixes — item sizing, counter, spacing, labels, wrap and clipping by [@lvcabral](https://github.com/lvcabral) in [#985](https://github.com/lvcabral/brs-engine/pull/985)
* (rsg) Added the Roku OS 15.3 `Video.captionRenderArea` field with render-thread caption positioning; captions now only render during full-screen playback, as on a device by [@lvcabral](https://github.com/lvcabral) in [#991](https://github.com/lvcabral/brs-engine/pull/991)
* (rsg) Added regression coverage for `double` SceneGraph fields (OS 15.3) by [@lvcabral](https://github.com/lvcabral) in [#992](https://github.com/lvcabral/brs-engine/pull/992)
* (rsg) Resolve cross-thread nodes by address via a registry by [@lvcabral](https://github.com/lvcabral) in [#996](https://github.com/lvcabral/brs-engine/pull/996)
* (rsg) Added the `ifSGNodeBoundingRect` sub-part methods by [@lvcabral](https://github.com/lvcabral) in [#999](https://github.com/lvcabral/brs-engine/pull/999)
* (rsg) Guard the bounding-rect refresh renders against re-entrancy by [@lvcabral](https://github.com/lvcabral) in [#1000](https://github.com/lvcabral/brs-engine/pull/1000)
* (rsg) Mirror a remote field add/remove on the local node copy by [@lvcabral](https://github.com/lvcabral) in [#1001](https://github.com/lvcabral/brs-engine/pull/1001)
* (rsg) Added the `scrollingStatus` field to the `ArrayGrid` based nodes by [@lvcabral](https://github.com/lvcabral) in [#1002](https://github.com/lvcabral/brs-engine/pull/1002)
* (rsg) Compute bounding rects for nodes under invisible ancestors by [@lvcabral](https://github.com/lvcabral) in [#1003](https://github.com/lvcabral/brs-engine/pull/1003)
* (rsg) A failed interface field alias no longer aborts the component's remaining fields by [@lvcabral](https://github.com/lvcabral) in [#1004](https://github.com/lvcabral/brs-engine/pull/1004)
* (rsg) Skip grid slots whose item component failed to create by [@lvcabral](https://github.com/lvcabral) in [#1005](https://github.com/lvcabral/brs-engine/pull/1005)
* (rsg) `findNode()` searches breadth-first per the `ifSGNodeDict` spec by [@lvcabral](https://github.com/lvcabral) in [#1006](https://github.com/lvcabral/brs-engine/pull/1006)
* (rsg) The media-node serialization proxy no longer hijacks the singleton player by [@lvcabral](https://github.com/lvcabral) in [#1007](https://github.com/lvcabral/brs-engine/pull/1007)
* (rsg) `Video` node prebuffer, configurable autoplay, buffering-step delivery and active-player routing by [@lvcabral](https://github.com/lvcabral) in [#1008](https://github.com/lvcabral/brs-engine/pull/1008)
* (rsg) `Poster` commits the `uri` field before its synchronous load and notification by [@lvcabral](https://github.com/lvcabral) in [#1010](https://github.com/lvcabral/brs-engine/pull/1010)
* (rsg) `RowList` keeps `currFocusRow`/`currFocusColumn` in sync with the focused item by [@lvcabral](https://github.com/lvcabral) in [#1011](https://github.com/lvcabral/brs-engine/pull/1011)
* (rsg) Implemented the `ifSGNodeBoundingRect` method `ancestorSubBoundingRect()` by [@lvcabral](https://github.com/lvcabral) in [#1013](https://github.com/lvcabral/brs-engine/pull/1013)
* (rsg) `DynamicKeyboard` palette support and shared palette resolution by [@lvcabral](https://github.com/lvcabral) in [#1014](https://github.com/lvcabral/brs-engine/pull/1014)
* (rsg) Corrected button and list layout — 9-patch width, variable-width rows, icon measure and item focus by [@lvcabral](https://github.com/lvcabral) in [#1015](https://github.com/lvcabral/brs-engine/pull/1015)
* (rsg) Reliable `PanelSet` next-panel creation and focusable-based navigation by [@lvcabral](https://github.com/lvcabral) in [#1017](https://github.com/lvcabral/brs-engine/pull/1017)
* (rsg) Re-apply the grid item size each frame and fixed WebP images with dropped bottom rows by [@lvcabral](https://github.com/lvcabral) in [#1019](https://github.com/lvcabral/brs-engine/pull/1019)
* (rsg) `update()` converts a nested `{subtype:...}` AA to a node on any field, not just `children[]` by [@markwpearce](https://github.com/markwpearce) in [#1020](https://github.com/lvcabral/brs-engine/pull/1020)
* (rsg) Include the inter-item spacing in the grid `boundingRect()` extent by [@lvcabral](https://github.com/lvcabral) in [#1021](https://github.com/lvcabral/brs-engine/pull/1021)
* (rsg) Honor `clippingRect` to limit node and children rendering by [@lvcabral](https://github.com/lvcabral) in [#1022](https://github.com/lvcabral/brs-engine/pull/1022)
* (rsg) Re-measure a degenerate bounding rect (either dimension zero) mid-render by [@lvcabral](https://github.com/lvcabral) in [#1023](https://github.com/lvcabral/brs-engine/pull/1023)
* (rsg) Silence the local mirror of a rendezvous field add so observers fire once by [@lvcabral](https://github.com/lvcabral) in [#1025](https://github.com/lvcabral/brs-engine/pull/1025)
* (rsg) Don't apply `Label` `vertAlign` when wrapped text has no explicit height by [@lvcabral](https://github.com/lvcabral) in [#1026](https://github.com/lvcabral/brs-engine/pull/1026)
* (rsg) Apply an interface field's default value through its alias targets by [@lvcabral](https://github.com/lvcabral) in [#1027](https://github.com/lvcabral/brs-engine/pull/1027)
* (rsg) Emit `vertFocusDirection` with settle-last focus order and honor `Video.asyncStopSemantics` by [@lvcabral](https://github.com/lvcabral) in [#1028](https://github.com/lvcabral/brs-engine/pull/1028)
* (rsg) Resolve the `RowList`/`ZoomRowList` focused-item `subBoundingRect()` and corrected the vertical outset by [@lvcabral](https://github.com/lvcabral) in [#1029](https://github.com/lvcabral/brs-engine/pull/1029)
* (rsg) Span the focus-feedback footprint in a `RowList` focused item's `subBoundingRect()` by [@lvcabral](https://github.com/lvcabral) in [#1030](https://github.com/lvcabral/brs-engine/pull/1030)
* (rsg) Defer reentrant field observers and refresh `subBoundingRect()` on a pending focus change by [@lvcabral](https://github.com/lvcabral) in [#1032](https://github.com/lvcabral/brs-engine/pull/1032)
* (rsg) Honor `vertAlign` in `ScrollingLabel` by centering against the node height by [@lvcabral](https://github.com/lvcabral) in [#1034](https://github.com/lvcabral/brs-engine/pull/1034)
* (rsg) Honor numeric-string writes to `ArrayGrid` `numColumns`/`numRows` by [@lvcabral](https://github.com/lvcabral) in [#1035](https://github.com/lvcabral/brs-engine/pull/1035)
* (rsg) Honor descending key arrays in the `FieldInterpolator` segment resolution by [@lvcabral](https://github.com/lvcabral) in [#1036](https://github.com/lvcabral/brs-engine/pull/1036)
* (rsg) Fire the initial `itemFocused` when list/grid content is populated after assignment by [@lvcabral](https://github.com/lvcabral) in [#1037](https://github.com/lvcabral/brs-engine/pull/1037)
* (rsg) Clip `ArrayGrid`/`PosterGrid` items to their cell so overflow is hidden by [@lvcabral](https://github.com/lvcabral) in [#1038](https://github.com/lvcabral/brs-engine/pull/1038)
* (rsg) Fire `itemFocused` only when the list/grid is in the focus chain by [@lvcabral](https://github.com/lvcabral) in [#1039](https://github.com/lvcabral/brs-engine/pull/1039)
* (rsg) Fixed the regression caused by [#1037](https://github.com/lvcabral/brs-engine/pull/1037) affecting `ArrayGrid` by [@lvcabral](https://github.com/lvcabral) in [#1040](https://github.com/lvcabral/brs-engine/pull/1040)
* (rsg) Only defer reentrant observers for engine-initiated field emissions by [@lvcabral](https://github.com/lvcabral) in [#1042](https://github.com/lvcabral/brs-engine/pull/1042)
* (rsg) Honor `Library` statements in component scripts and completed the RAF mock by [@lvcabral](https://github.com/lvcabral) in [#1043](https://github.com/lvcabral/brs-engine/pull/1043)
* (rsg) Detach a node from its previous parent when it is attached elsewhere by [@lvcabral](https://github.com/lvcabral) in [#1044](https://github.com/lvcabral/brs-engine/pull/1044)
* (rsg) `ButtonBar` sample — `RowList` fit check, `LayoutGroup` re-alignment and single-row grid key propagation by [@lvcabral](https://github.com/lvcabral) in [#1045](https://github.com/lvcabral/brs-engine/pull/1045)
* (rsg) `ZoomRowList` vertical-wrap flag and row-title/poster spacing by [@lvcabral](https://github.com/lvcabral) in [#1046](https://github.com/lvcabral/brs-engine/pull/1046)
* (rsg) Only the owning, presenting `Video` node renders the video plane by [@lvcabral](https://github.com/lvcabral) in [#1047](https://github.com/lvcabral/brs-engine/pull/1047)
* (rsg) Added the missing `secondaryTitle` field to `ContentNode` by [@lvcabral](https://github.com/lvcabral) in [#1048](https://github.com/lvcabral/brs-engine/pull/1048)
* (rsg) Changed the `ContentNode.subtitleTracks` type from `assocarray` to `array` by [@lvcabral](https://github.com/lvcabral) in [#1051](https://github.com/lvcabral/brs-engine/pull/1051)
* (rsg) Properly handle boxed `String` in `PosterGrid`, `ScrollableText` and `ZoomRowList` by [@lvcabral](https://github.com/lvcabral) in [#1052](https://github.com/lvcabral/brs-engine/pull/1052)
* (rsg) Position the `PanelSet` right panel using the left panel's `leftPosition` by [@lvcabral](https://github.com/lvcabral) in [#1053](https://github.com/lvcabral/brs-engine/pull/1053)
* (rsg) Guard the cross-thread serialization against circular container references by [@lvcabral](https://github.com/lvcabral) in [#1055](https://github.com/lvcabral/brs-engine/pull/1055)
* (rsg) Paint a black plane while a full-screen `Video` with UI enabled is buffering by [@lvcabral](https://github.com/lvcabral) in [#1056](https://github.com/lvcabral/brs-engine/pull/1056)
* (rsg) Restore function values across `Task` threads from the component AST by [@lvcabral](https://github.com/lvcabral) in [#1057](https://github.com/lvcabral/brs-engine/pull/1057)
* (rsg) Keep a `Video`'s internal children off the cross-thread serialization by [@lvcabral](https://github.com/lvcabral) in [#1059](https://github.com/lvcabral/brs-engine/pull/1059)
* (rsg) Keep `ButtonGroup` from managing custom (non-`Button`) `Group` children by [@lvcabral](https://github.com/lvcabral) in [#1060](https://github.com/lvcabral/brs-engine/pull/1060)
* (rsg) Restore the `m` context on rebuilt custom nodes and fixed the quit debugger loop by [@lvcabral](https://github.com/lvcabral) in [#1061](https://github.com/lvcabral/brs-engine/pull/1061)
* (rsg) Honor the app-managed visibility/opacity of a dynamic keyboard's `textEditBox` by [@lvcabral](https://github.com/lvcabral) in [#1062](https://github.com/lvcabral/brs-engine/pull/1062)
* (rsg) Resolve the `fixed` `vertFocusAnimationStyle` to the non-wrapping `fixedFocus` by [@lvcabral](https://github.com/lvcabral) in [#1063](https://github.com/lvcabral/brs-engine/pull/1063)
* (rsg) Return the measured size from a detached `Label`'s `boundingRect()` mid-render by [@lvcabral](https://github.com/lvcabral) in [#1064](https://github.com/lvcabral/brs-engine/pull/1064)
* (rsg) Move the live focus when a managed `ButtonGroup`'s `focusButton` changes by [@lvcabral](https://github.com/lvcabral) in [#1065](https://github.com/lvcabral/brs-engine/pull/1065)
* (rsg) Measure hidden grids, flush `MarkupGrid` rects and reorder on re-append by [@lvcabral](https://github.com/lvcabral) in [#1066](https://github.com/lvcabral/brs-engine/pull/1066)
* (rsg) Keep the video plane presenting through a mid-stream re-buffer by [@lvcabral](https://github.com/lvcabral) in [#1067](https://github.com/lvcabral/brs-engine/pull/1067)
* (rsg) `PanelSet` full-screen preview position, focus handling and back-navigation panel retention by [@lvcabral](https://github.com/lvcabral) in [#1068](https://github.com/lvcabral/brs-engine/pull/1068)
* (rsg) `PanelSet` sets the attached `Panel` height per the Roku spec by [@lvcabral](https://github.com/lvcabral) in [#1069](https://github.com/lvcabral/brs-engine/pull/1069)
* (rsg) Let single-row `MarkupGrid` vertical keys bubble and honor `horizFocusAnimationStyle` `fixedFocus` by [@lvcabral](https://github.com/lvcabral) in [#1070](https://github.com/lvcabral/brs-engine/pull/1070)
* (rsg) Decouple the `Timer` polling from the frame-rate-limiting busy-wait by [@markwpearce](https://github.com/markwpearce) in [#1076](https://github.com/lvcabral/brs-engine/pull/1076)
* (rsg) `parentSubtype()` returns `Invalid` instead of `""` at the hierarchy root by [@markwpearce](https://github.com/markwpearce) in [#1077](https://github.com/lvcabral/brs-engine/pull/1077)
* (rsg) Reset the key buffer when `roSGScreen` closes, to prevent a stale key leaking into the next screen by [@markwpearce](https://github.com/markwpearce) in [#1081](https://github.com/lvcabral/brs-engine/pull/1081)
* Node types added in this release:
  * Standard Dialog Framework: `StandardDialog`, `StandardMessageDialog`, `StandardKeyboardDialog`, `StandardPinPadDialog`, `StdDlgTitleArea`, `StdDlgContentArea`, `StdDlgButtonArea`, `StdDlgSideCardArea`, `StdDlgActionCardItem`, `StdDlgBulletTextItem`, `StdDlgButton`, `StdDlgCustomItem`, `StdDlgDeterminateProgressItem`, `StdDlgItemBase`, `StdDlgKeyboardItem`, `StdDlgMultiStyleTextItem`, `StdDlgTextItem`.
  * Typographic labels: `SimpleLabel`, `MonospaceLabel`, `MultiStyleLabel`.
  * Dynamic voice keyboards: `DynamicKeyboard`, `DynamicKeyboardBase`, `DynamicCustomKeyboard`, `DynamicMiniKeyboard`, `DynamicKeyGrid`, `DynamicPinPad`.
  * Targets and layout: `TargetSet`, `TargetGroup`, `TargetList`, `MaskGroup`.
  * Data-driven layouts: `TimeGrid` (EPG).
  * Components: `roRenderThreadQueue`, `ComponentLibrary`.
* Only the **abstract** base nodes remain mocked as `Group`: `StdDlgAreaBase`, `StdDlgGraphicItem` and `StdDlgItemGroup`.

[Full Changelog][v0.3.0]

<a name="v0.2.0"></a>

## [v0.2.0 (alpha) - Added ScrollableText, PinPad, PinDialog and ProgressDialog](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.2.0) - 12 April 2026

This release introduces the `ScrollableText`, `PinPad`, `PinDialog` and `ProgressDialog` nodes to the SceneGraph extension, along with various bug fixes and improvements. Read the full release notes below for more details.

### Release Changes

* (rsg) Fixed handling of `Node` field `role` attribute and a crash in `ZoomRowList`with empty content by [@lvcabral](https://github.com/lvcabral) in [#884](https://github.com/lvcabral/brs-engine/pull/884)
* (rsg) Improve `Node` ownership management in rendezvous by [@lvcabral](https://github.com/lvcabral) in [#883](https://github.com/lvcabral/brs-engine/pull/883)
* (rsg) Implemented support for `renderTracking` field by [@lvcabral](https://github.com/lvcabral) in [#887](https://github.com/lvcabral/brs-engine/pull/887)
* (rsg) Fixed `ButtonGroup` to handle custom buttons defined in XML and fixed `StringArray` field parsing by [@lvcabral](https://github.com/lvcabral) in [#888](https://github.com/lvcabral/brs-engine/pull/888)
* (rsg) Added support for multiple `roMessagePort` to be used in `Main` thread by [@lvcabral](https://github.com/lvcabral) in [#889](https://github.com/lvcabral/brs-engine/pull/889)
* (rsg) Refactored `NodeFactory` functions to streamline node creation process by [@lvcabral](https://github.com/lvcabral) in [#890](https://github.com/lvcabral/brs-engine/pull/890)
* (rsg) Fixed `RowList` that was not setting `itemSelected` when OK was pressed by [@lvcabral](https://github.com/lvcabral) in [#891](https://github.com/lvcabral/brs-engine/pull/891)
* (rsg) Removed `scene` from `TaskData` by [@lvcabral](https://github.com/lvcabral) in [#892](https://github.com/lvcabral/brs-engine/pull/892)
* (rsg) Added `StandardKeyboardDialog` and `VoiceTextEditBox` nodes by [@lvcabral](https://github.com/lvcabral) in [#893](https://github.com/lvcabral/brs-engine/pull/893)
* (rsg) Implemented `ScrollableText` node by [@lvcabral](https://github.com/lvcabral) in [#895](https://github.com/lvcabral/brs-engine/pull/895)
* (rsg) Implemented `PinPad` widget node by [@lvcabral](https://github.com/lvcabral) in [#896](https://github.com/lvcabral/brs-engine/pull/896)
* (rsg) Implemented `PinDialog` and added literal keys support to `PinPad` by [@lvcabral](https://github.com/lvcabral) in [#898](https://github.com/lvcabral/brs-engine/pull/898)
* (rsg) Implemented ProgressDialog node by [@lvcabral](https://github.com/lvcabral) in [#899](https://github.com/lvcabral/brs-engine/pull/899)
* (rsg) Set `Poster` loadStatus to "loading" when URI is updated by [@lvcabral](https://github.com/lvcabral) in [#900](https://github.com/lvcabral/brs-engine/pull/900)
* (rsg) Fixed focus handling in `Node` to ensure global focus reference is set correctly by [@lvcabral](https://github.com/lvcabral) in [#901](https://github.com/lvcabral/brs-engine/pull/901)
* (rsg) Fix stack overflow from ContentNode parentField notification cascade by [@jeremy-albinet](https://github.com/jeremy-albinet) in https://github.com/lvcabral/brs-engine/pull/905
* (rsg) Support rendering during wait() on local roMessagePort by [@cewert](https://github.com/cewert) in https://github.com/lvcabral/brs-engine/pull/913

[Full Changelog][v0.2.0]

<a name="v0.1.0"></a>

## [v0.1.0 (alpha) - Rendezvous and other major improvements and fixes](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.1.0) - 11 February 2026

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

## [v0.0.5 (alpha) - Various Fixes and Improvements](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.5) - 5 January 2026

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


## [v0.0.3 (alpha) - Node and Task improvements and fixes](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.3) - 24 December 2025

This release brings several fixes and improvements to the SceneGraph extension for the BrightScript Simulation Engine, including support for the `change` field in `Node`, updates to `Task` behavior, and various bug fixes.

### Release Changes

* (rsg) Implemented support for `change` field in `Node` by [@lvcabral](https://github.com/lvcabral) in [#790](https://github.com/lvcabral/brs-engine/pull/790)
* (rsg) Changed `Task` to update existing `Node` fields to preserve references by [@lvcabral](https://github.com/lvcabral) in [#792](https://github.com/lvcabral/brs-engine/pull/792)
* (rsg) Fixed `Node` environment `hostNode` initialization by [@lvcabral](https://github.com/lvcabral) in [#794](https://github.com/lvcabral/brs-engine/pull/794)
* (rsg) Fixed `Node.callFunc()` to not be case sensitive by [@lvcabral](https://github.com/lvcabral) in [#796](https://github.com/lvcabral/brs-engine/pull/796)
* (chore) Renamed factory modules by [@lvcabral](https://github.com/lvcabral) in [#791](https://github.com/lvcabral/brs-engine/pull/791)

[Full Changelog][v0.0.3]

<a name="v0.0.2"></a>

## [v0.0.2 (alpha) - Various Fixes and Improvements](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.2) - 12 December 2025

This release brings several fixes and improvements to the SceneGraph extension for the BrightScript Simulation Engine, including fixes for video UI handling, custom font management, and enhancements to node behavior.

### Release Changes

* (rsg) Fixes [#769](https://github.com/lvcabral/brs-engine/issues/769) `Video` UI header removed too soon by [@lvcabral](https://github.com/lvcabral) in [#781](https://github.com/lvcabral/brs-engine/pull/781)
* (rsg) Prevent crash when custom fonts are missing by [@lvcabral](https://github.com/lvcabral) in [#783](https://github.com/lvcabral/brs-engine/pull/783)
* (rsg) Made `ArrayGrid` based nodes to be aware of `content` changes by [@lvcabral](https://github.com/lvcabral) in [#784](https://github.com/lvcabral/brs-engine/pull/784)
* (rsg) Fixed `roSGNode` methods `setField` and `addFields` to properly handle `ContentNode` by [@lvcabral](https://github.com/lvcabral) in [#785](https://github.com/lvcabral/brs-engine/pull/785)
* (rsg) Removed usage of reflection to build `subtypeHierarchy` in `Node` by [@lvcabral](https://github.com/lvcabral) in [#786](https://github.com/lvcabral/brs-engine/pull/786)

[Full Changelog][v0.0.2]

<a name="v0.0.1"></a>

## [v0.0.1 (alpha) - Initial release](https://github.com/lvcabral/brs-engine/releases/tag/brs-sg-v0.0.1) - 05 December 2025

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

[v0.4.0]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.3.0...brs-sg-v0.4.0
[v0.3.0]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.2.0...brs-sg-v0.3.0
[v0.2.0]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.1.0...brs-sg-v0.2.0
[v0.1.0]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.5...brs-sg-v0.1.0
[v0.0.5]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.4...brs-sg-v0.0.5
[v0.0.4]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.3...brs-sg-v0.0.4
[v0.0.3]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.2...brs-sg-v0.0.3
[v0.0.2]: https://github.com/lvcabral/brs-engine/compare/brs-sg-v0.0.1...brs-sg-v0.0.2