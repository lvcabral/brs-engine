# Group Subtype Hierarchy Probe

Confirms `isSubtype()`/`parentSubtype()` results for multi-level built-in SceneGraph class chains
against a real Roku device, after fixing `subtypeHierarchy`'s "first write wins" bug (see
`setExtendsType`'s doc comment in `src/extensions/scenegraph/nodes/Node.ts`).

## Why

Before the fix, every built-in node beyond a direct `Group` child had its class hierarchy collapse
straight to `"Node"`: `Rectangle.isSubtype("Group")`, `RowList.isSubtype("ArrayGrid")`,
`CheckList.isSubtype("LabelList")` all incorrectly returned `false`, and `parentSubtype()` skipped
every intermediate ancestor. A second, related bug (also fixed) let a custom XML component's
`extends`-chain registration get silently overwritten by the underlying built-in class's own
constructor chain when `extends` targeted a multi-level built-in type (e.g.
`<component extends="RowList">`).

This probe exercises every affected built-in chain, plus the separate `RenderableNode`
alias-for-`Group` feature (since it shares the same `isSubtypeCheck`/`subtypeHierarchy` machinery),
to confirm the fixed engine behavior matches a real device - not just our own assumptions about the
documented hierarchy.

## Running

Device (sideload this directory as a zip via the Roku dev installer, then capture the console):

```
telnet <roku-ip> 8085
```

Engine:

```bash
npm run build:cli && npm run build:sg
node ./packages/node/bin/brs.cli.js --root ./test/simulator/probes/group-subtype-hierarchy-probe
```

Baseline engine output is committed alongside as `engine-trace.txt`.

## Output format

```
PROBE|<type>|subtype=<subtype()>|parentSubtype=<parentSubtype(type)>|isSubtype(<T1>)=<bool>|isSubtype(<T2>)=<bool>|...
```

Each `probeChain` call prints `subtype()`, `parentSubtype(typeName)`, and `isSubtype()` against
every ancestor in the expected chain, from the immediate parent up to `Node`. `probeNegative` prints
a single `isSubtype()` check expected to be `false`. `probeRenderableNode` and `probeCustomExtends`
follow the same `isSubtype()` pattern for the `RenderableNode` alias and for two custom XML
components (`MyRowList extends="RowList"`, `MyRenderable extends="RenderableNode"`).

## Cases

| Family | Chain probed |
| --- | --- |
| Direct Group children | Rectangle, Poster, Label -> Group -> Node |
| ArrayGrid | ArrayGrid, RowList, ZoomRowList, MarkupGrid, MarkupList, TimeGrid, PosterGrid, LabelList -> ArrayGrid -> Group -> Node |
| LabelList | CheckList, RadioButtonList -> LabelList -> ArrayGrid -> Group -> Node |
| LayoutGroup | ButtonGroup -> LayoutGroup -> Group -> Node; StdDlgButtonArea -> ButtonGroup -> LayoutGroup -> Group -> Node |
| Label | MonospaceLabel, ScrollingLabel -> Label -> Group -> Node |
| TextEditBox / TargetGroup / Scene / PinPad / Panel / Button | one-child hubs, each -> Group -> Node |
| Dialog | KeyboardDialog, PinDialog, ProgressDialog -> Dialog -> Group -> Node |
| StandardDialog | StandardPinPadDialog, StandardKeyboardDialog, StandardMessageDialog, StandardProgressDialog -> StandardDialog -> Group -> Node |
| DynamicKeyboardBase | DynamicKeyboard, DynamicPinPad, DynamicMiniKeyboard, DynamicCustomKeyboard -> DynamicKeyboardBase -> Group -> Node |
| Animation (control - NOT part of the Group tree) | Animation, ParallelAnimation, SequentialAnimation -> AnimationBase -> Node |
| Negative controls | Rectangle-not-ArrayGrid, RowList-not-Rectangle, RowList-not-LabelList, CheckList-not-MarkupGrid, ButtonGroup-not-ArrayGrid |
| RenderableNode alias | `CreateObject("roSGNode","RenderableNode")` subtype/isSubtype, and `Group.isSubtype("RenderableNode")` |
| Custom XML components | `MyRowList extends="RowList"`, `MyRenderable extends="RenderableNode"` |

The `Animation` family is included only as a control: brs-engine still collapses it straight to
`Node` (skipping the documented `AnimationBase` hop) since it is a separate, Node-direct hierarchy
untouched by this fix - the probe checks whether Roku does the same or actually resolves
`AnimationBase`, to see if that's worth fixing separately.

## Result — measured on a Roku Streaming Stick 4K+ (model 3930X), Roku OS 16.0 (`device-trace.txt`)

**The fix itself is confirmed correct, not a regression.** Every multi-level chain this session's fix
targets matches the device exactly, including the two headline cases: `RowList.isSubtype("ArrayGrid")`
and the 4-level `CheckList -> LabelList -> ArrayGrid -> Group -> Node` walk. Full list of exact matches:
`Rectangle`/`Poster` -> `Group`; `RowList`/`MarkupGrid`/`MarkupList`/`TimeGrid`/`PosterGrid`/`LabelList`
-> `ArrayGrid`; `CheckList`/`RadioButtonList` -> `LabelList`; `ButtonGroup` -> `LayoutGroup`;
`VoiceTextEditBox` -> `TextEditBox`; `TargetList` -> `TargetGroup`; `OverhangPanelSetScene` -> `Scene`;
`GridPanel`/`ListPanel` -> `Panel`; the `Dialog` and `StandardDialog` families; the
`DynamicKeyboardBase` family; and the custom component `MyRowList extends="RowList"` (the exact
clobbering regression this session's fix also caught and fixed). Every negative control
(`Rectangle-not-ArrayGrid`, etc.) is also `false` on both sides.

Several node types report a different immediate `parentSubtype()` on device (`Label` ->
`LabelBase`, `TextEditBox`/`Scene`/`DynamicKeyboardBase` -> `PaletteGroup`, `Panel` -> `MaskGroup`,
`Dialog`/`StandardDialog` -> `DialogBase`, `GridPanel`/`ListPanel` -> `ArrayGridPanel`) via
undocumented internal base classes brs-engine doesn't model - but `isSubtype("Group")`/
`isSubtype("Node")` still agree in every one of these cases, so behavior is unaffected.

**Separate, pre-existing findings surfaced by this probe (not caused by this session's fix - these
are about which built-in class each node registers as its parent, not the walking mechanism):**

| Node | brs-engine says | Device says | Device parentSubtype |
| --- | --- | --- | --- |
| `ZoomRowList` | subtype of `ArrayGrid` | **not** a subtype of `ArrayGrid` | `ItemScrollerBase` |
| `StdDlgButtonArea` | subtype of `ButtonGroup`/`LayoutGroup` | **neither** | `StdDlgAreaBase` |
| `MonospaceLabel` | subtype of `Label` | **not** a subtype of `Label` | `Group` |
| `ScrollingLabel` | subtype of `Label` | **not** a subtype of `Label` | `Group` |
| `StdDlgButton` | subtype of `Button` | **not** a subtype of `Button` | `Group` |

These five all reuse a built-in class's TypeScript implementation (`class MonospaceLabel extends
Label`, etc.) for code reuse, and that reuse leaked into the public `isSubtype()` hierarchy - Roku's
own internal reuse (if any) is invisible to scripts.

`RenderableNode` is also asymmetric on device: `Group.isSubtype("RenderableNode")` is `true` (as
brs-engine already has it), but a node *created* via `RenderableNode` (or a custom component
extending it) reports `subtype()="Group"` and yet `isSubtype("Group")` is **`false`** - brs-engine
currently returns `true`. `ParentalControlPinPad` shows the same family of internal-class quirk even
more sharply: its device `parentSubtype` is the namespaced `SceneGraph::RenderableNode`, and
`isSubtype()` against `PinPad`, `Group`, **and even `Node`** all report `false` - Roku's own
hierarchy is seemingly incomplete for this specific Standard Dialog Framework internal node.

**Bonus finding:** the `Animation` family (a separate, `Node`-direct hierarchy this fix
deliberately left untouched) resolves `isSubtype("AnimationBase")=true` on device, confirming
brs-engine's existing gap here (still flattened to `Node`) is a real bug fixable with the same
technique - just out of scope for this fix.

**Also confirmed, unrelated to this session:** `CreateObject("roSGNode", "ArrayGrid")` fails on a
real device (`ArrayGrid` is not a directly-instantiable public type) while brs-engine currently
allows it to succeed.
