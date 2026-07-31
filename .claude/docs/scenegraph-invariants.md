# SceneGraph invariants (`src/extensions/scenegraph/`)

Deep detail for the SceneGraph extension. Read this **before** changing node rendering,
field/observer dispatch, focus handling, `NodeFactory`/`addFields`, `Serializer.ts`, or the
lazy-field/lazy-method memory paths. Companion: [threading-and-rendezvous.md](threading-and-rendezvous.md).

## Rendering contract (`renderNode`)

`renderNode` early-returns via `updateRenderTracking(true)` when not visible, applies
translation/rotation/opacity, draws through the passed `IfDraw2D`, updates bounding rects, then calls
`renderChildren(...)` and `nodeRenderingDone(...)`.

**Layout passes are pure (docs/scenegraph-layout-passes.md).** `Node.layoutNode` /
`Node.paintNode` wrap `renderNode`, setting `sgRoot.renderPass`; `Node.isPaintPass(draw2D)` is the
gate. A `renderNode` call with no `draw2D` (a bounding-rect refresh, `measureUnsizedChildren`)
must be **idempotent and clock-free**: no `Date.now`/`performance.now` reads (use `sgClock`, which
tests replace via `setSource`), no field writes that aren't a pure function of layout state, no
`sgRoot.makeDirty()`, no popups/focus moves/postMessage. Time-driven nodes (BusySpinner,
ScrollingLabel, TextEditBox, TrickPlayBar, Video, DynamicKeyGrid, TimeGrid) advance state only
under `isPaintPass` and render stored state otherwise — regressions: `LayoutPurity.test.js`,
`BusySpinnerClock.test.js`, `ScrollingLabelClock.test.js`. This purity is what makes **pruned
refreshes** sound: `refreshLayoutFromRoot` skips subtrees whose `subtreeStale` is false under an
unchanged origin/angle/opacity context (`Group.skipSettledLayout`). Invariants, each learned from
a real-app divergence: a skipped child still hands its cached rect up (`updateParentRects`); the
stale mark is cleared **before** a node's pass (writes made inside it must survive) and **only by
the pruned refresh itself** — scoped `[0,0]` measurements (`measureUnsizedChildren`, the
mid-render fallback, detached-root `getMeasured()`) must not clear marks or record skip contexts,
and after clobbering a subtree's `rectToScene` with origin-less values they must
`markSubtreeStaleDeep()` so the refresh re-descends; `Group.isDirty = true` routes through a
setter that also stale-marks; `ContentNode.makeDirty` hops the field boundary to stale-mark the
consuming node (content trees aren't parented into the render tree); and LayoutGroup restores its
**parent's** rects between convergence passes (each inner pass unions into the parent — without
the restore, a re-centered child leaves both positions in every ancestor's union). Regressions:
`LayoutPruning.test.js` (including the two real-app scenarios) and the pruned-vs-`BRS_PRUNE_DISABLE=1`
CLI comparison in `test/cli/cli.test.js`. `BRS_PRUNE_DISABLE=1` turns pruning off (field
debugging). LayoutGroup converges to a fixed point on layout passes (`MAX_LAYOUT_PASSES` is a
divergence backstop only) — regression: `LayoutConvergence.test.js`.

**Visibility vs. measurement:** plain containers (`Group`, `LayoutGroup`, `MaskGroup`) do their
invisible early-return through `Group.skipRender(draw2D)`, which lets a **measurement pass** (a render
with no `draw2D` — `getBoundingRect`'s refresh) traverse them when invisible: on Roku, layout/bounding
rects are independent of visibility, and apps measure UI under a hidden ancestor before revealing it. A
measured invisible container propagates opacity 0 and does not union into its parent's bounds.
Renderable/complex nodes (Poster, Label, ArrayGrid, …) keep the hard skip so hidden UI never loads
textures or creates item components. Regression:
`test/extensions/scenegraph/HiddenMeasure.test.js`.

## `LayoutGroup.layoutDirection` is an enum, and its rejected state is HORIZONTAL

**Device-measured** (probe channel: `Samples/layoutgroup-probe`, 12 spellings × XML-attribute and
runtime-write paths × 3 passes — every row agreed). Roku does **not** treat `layoutDirection` as free
text:

| Written | Reads back | Lays out |
| --- | --- | --- |
| never written | `"vert"` | **vert** |
| `horiz` / `HORIZ` / `Horiz` | `"horiz"` | horiz |
| `vert` | `"vert"` | vert |
| `horz`, `horizontal`, `vertical`, `bogus`, `""` | `""` | **horiz** |

Two counter-intuitive consequences, both easy to "simplify" away:

1. An unrecognized value is **rejected, not stored-and-ignored** — the field reads back as `""`, and a
   rejected write **clobbers** a previously valid one (`horiz` then `horz` → `""`).
2. That empty state lays out **horizontally**, while the untouched `"vert"` default lays out
   vertically. So `<LayoutGroup layoutDirection="horz" />` is a horizontal row on hardware. Do **not**
   "fix" `getLayoutDirection` to fall back to the documented `vert` default — that silently stacks real
   apps' menu bars (this is exactly the bug that prompted the probe).

`horizontal`/`vertical` are **not** aliases, despite reading like the obvious long forms; the engine
used to accept them and mapped `vertical` → vert, the opposite of hardware. Canonicalization happens on
write (`canonicalizeEnumField`, applied in `setValue`, `setValueSilent`, and `registerInitializedFields`
— the last because XML/deserialized fields are written straight into the field map, bypassing
`setValue`); `getLayoutDirection` then only has to ask whether the stored value is `"vert"`. Use
`isBrsString`, not `instanceof BrsString`, so a boxed `roString` normalizes too. `ButtonGroup` extends
`LayoutGroup` and inherits all of this while keeping its `vert` default. Regression:
`test/extensions/scenegraph/LayoutDirection.test.js`.

## `horizAlignment`/`vertAlignment` are the same enum — and a rejected CROSS value collapses the layout

**Device-measured** (probe channel: `Samples/layoutalign-probe`, 48 cases — 12 spellings × the four
`layoutDirection`/field combinations × 3 passes; the engine now reproduces all 48 rows exactly).

Storage works exactly like `layoutDirection` and shares `canonicalizeEnumField`: documented values
(`left`/`center`/`right`/`custom`, `top`/`center`/`bottom`/`custom`) match case-insensitively and store
lowercase; anything else is rejected to `""`; a rejected write clobbers a valid one. A value belonging
to the **sibling** field is rejected too (`horizAlignment = "top"` → `""`), so the two fields do **not**
share one value table.

Geometry, however, splits by axis — and this is the part that is not guessable:

| Stored value | Field governs the PRIMARY axis | Field governs the CROSS axis |
| --- | --- | --- |
| documented value | aligns the whole run | aligns each child independently |
| `custom` | falls back to `left`/`top` (as documented) | honors each child's own translation |
| rejected (`""`) | falls back to `left`/`top` | **collapses: every child at (0,0)** |

The collapse (`collapseChildren`) is the surprise: a rejected cross-axis alignment makes the device
**abandon layout entirely** — no primary-axis stacking, no item spacing, and the children's own
translations are discarded (they land at exactly `(0,0)`, not at their authored offsets), even though
the primary-axis alignment is still perfectly valid. It is almost certainly a device bug, but the
engine reproduces it deliberately: an app with a typo'd alignment piles its children on the origin on
hardware, and a simulator that quietly laid them out neatly would hide that until it shipped.

Two implementation notes: `applyLayout` must check `isCrossAlignmentRejected` **before** measuring
anything (nothing downstream runs), and `collapseChildren` must write **no** `metricsUsedThisPass`
entries — zeroed expectations compared against real child sizes would re-dirty the layout on every
pass and burn the whole `MAX_LAYOUT_PASSES` budget. Regression:
`test/extensions/scenegraph/LayoutAlignment.test.js`.

## A LayoutGroup has NO `width`/`height` fields — read `getDimensions()`

**Device-measured** (`Samples/layoutspacing-probe`): on a real LayoutGroup `hasField("width")` and
`hasField("height")` are **false** and `lg.width` reads `invalid`, while `localBoundingRect()` reports
the correct size. Roku declares neither field on `Group` or `LayoutGroup`.

The engine used to publish its measurement by writing real `width`/`height` fields (`setValueSilent`
creates a field that does not exist), so an app reading `lg.width` got a number here and `invalid` on
hardware. The measurement now lives in the private `layoutWidth`/`layoutHeight` and is surfaced by
overriding **`getDimensions()`**.

So: **never read a LayoutGroup's size with `getValueJS("width")`** — use `getDimensions()`, which
works for every node type (`Group.getDimensions` reads the fields; `LayoutGroup` overrides). This bit
`StdDlgCustomItem.measureContentHeight`, which measured its children with the raw field and silently
sized a dialog to 0 around a LayoutGroup once the fields went away. Regressions:
`test/extensions/scenegraph/LayoutAlignment.test.js` (field absence) and the
`StdDlgCustomItem` case in `StandardDialogNodes.test.js`.

## `itemSpacings` — the last entry repeats, extra entries are dropped

**Device-measured** (`Samples/layoutspacing-probe`, three children, all rows reproduced):

- The **last entry repeats** for every gap past the end of the array, so `itemSpacings="[4]"` spaces
  *every* gap by 4. Apps rely on this constantly; it was an assumption in `getSpacingValue` until the
  probe confirmed it.
- Entries **past the last gap are dropped** — `[4,9,15]` with three children lays out exactly like
  `[4,9]` and produces the same group size. No trailing space is added, which matters because the
  group's measured size is what parents lay out against.
- Negative spacings **overlap** (not clamped); fractional spacings are used **as-is** (not rounded).
- With `addItemSpacingAfterChild=false` the space is inserted **before** each child *including the
  first*, so the whole run shifts by `spacings[0]` and the gaps come from the *following* entries
  (`[4,9]` → run starts at 4, both gaps 9). A third entry is then genuinely used (`[4,9,15]` → gaps
  9, 15) where the `true` case would have dropped it.

Regression: `test/extensions/scenegraph/LayoutSpacing.test.js`.

## XML `<interface>` field redeclaration — system vs. XML-defined (`addFields`)

When `addFields` builds a custom component's fields, a `<field>` whose name already exists is handled by
**who defined the existing field**:

- Inherited from a **built-in base type** (`Group`, `Label`, …) → a **system** field (`field.isSystem()`,
  set by `registerDefaultFields`). Roku lets a component **redeclare** it: the redeclaration re-applies
  the XML default/type and `addFields` continues, so a field declared *after* it is still added. Guard:
  `else if (field && !field.isSystem())` — don't treat this as a duplicate.
- Defined in an **ancestor XML component's** `<interface>` → *not* system (added via `addNodeField`,
  `system=false`). Redeclaring it **is** a genuine duplicate: `addFields` writes
  `Attempt to add duplicate field "…"` to `BrsDevice.stderr` and **returns early**, so trailing fields in
  that component are never added (they read back `invalid`).

`addNodeField` is a no-op when the field exists, so a redeclared system field keeps its `Field` instance;
the XML default is applied by the subsequent `setValueSilent`. Regression:
`duplicate-system-field-app` in `test/cli/cli.test.js`.

## Per-node memory: lazy fields and lazy methods (large content trees)

A large EPG (e.g. the SGDEX **TimeGridView** sample) creates thousands of `ContentNode`s. Two
per-instance costs used to be paid eagerly and could exhaust V8's young generation
(`young object promotion failed` OOM on deep scrolling). Both are now **built on demand**; keep them lazy.

1. **Hidden default fields (`Node.registerDefaultFields` / `resolveField`).** `ContentNode` declares ~105
   default fields, ~103 of them `hidden: true` metadata — **not** materialized up front.
   `registerDefaultFields` keeps every `hidden` default in a shared per-class spec
   (`Node.hiddenSpecCache`, a `WeakMap<constructor, Map<name, FieldModel>>`; only `ContentNode` populates
   it). Non-hidden defaults are still materialized in the constructor. **`resolveField(mapKey)`** builds
   the real `Field` on first read/write/observe/probe, preserving `system`+`hidden` flags — so a
   type-check-only resolve (`canAcceptValue`) does **not** un-hide it, while a genuine read/write does.
   Any by-name lookup that must see hidden metadata goes through public **`resolveField`** (not
   `this.fields.get`) and spec-aware **`hasNodeField`** (not `this.fields.has`) — routed sites: `Node`
   get/getValue/setValue/observers, `ContentNode.hasField`, and `NodeFactory` paths (`addFields`,
   `addAliases`, `addChildren`, `populateNodeFromAA`, `linkField`). A fresh `ContentNode` materializes ~4
   fields instead of ~107. Regression: `test/extensions/scenegraph/HiddenFields.test.js`.

2. **Method Callables (`BrsComponent.buildMethods` / `ensureMethods`).** Each node's ~70 `roSGNode` method
   Callables (plus `StdlibArgument`s, closures, `BrsInterface` metadata) were the dominant per-node cost
   (~66 KB), and field access (`node.title`) never needs them. `BrsComponent` exposes a
   **`buildMethods()`** hook (default no-op — eager components unchanged) invoked at most once by
   **`ensureMethods()`** on the first `getMethod`/`hasInterface`/`GetInterface`. `RoSGNode`'s methods are
   **prototype getters** (zero per-instance cost) registered inside its `buildMethods()`; the per-node
   `RoHttpAgent` is likewise lazy. `ContentNode` overrides `buildMethods()` (`super` first, then
   `overrideMethods([count, keys, items, hasField])`). A data-only node with no method called allocates
   none of these. Measured: bare `Node` ~106 KB → ~42 KB, `ContentNode` ~112 KB → ~48 KB. Regression:
   `test/extensions/scenegraph/LazyMethods.test.js`. **Invariant:** the getters return a fresh Callable
   per access — reference them only inside `buildMethods()` (via `registerMethods`), never as an
   identity-stable `this.<method>` field; any new reader of a component's `interfaces` map must call
   `ensureMethods()` first.

> Still eager, next optimization target: each `setValue` costs ~15 KB (a `Field` + boxed value +
> dirty/`freshFields` tracking).

## Stack-overflow hot paths (fragile — read before touching)

Three distinct SceneGraph paths can recurse until the JS stack overflows; all surface as
`Maximum call stack size exceeded`. They are unrelated — diagnose which before "fixing" the others (the
alternating frame pair in the native stack identifies the path). A real overflow's BrightScript backtrace
is misleading (often one frame, because `Field.executeCallbacks` pops frames as the error unwinds);
capture the **native JS stack** mid-recursion (a temporary depth tripwire dumping `new Error().stack` via
`BrsDevice.stderr`).

1. **Observer dispatch — `Field.notifyObservers` + `ContentNode` parentField fan-out.** Regressed
   repeatedly (#905 → #943 → #904). Dispatch is **synchronous depth-first**, guarded by a per-field
   `notifying` re-entrancy flag — correct *only because* dispatch is synchronous (`notifying` stays true
   for the field's entire observer subtree). Do **not** convert to breadth-first/queued: releasing
   `notifying` between dispatches lets a sibling re-enqueue the field and it never terminates; adding
   coalescing instead drops a legitimate *second* notification within one cascade and leaves dependent
   fields stale (the blank-`Label` regression). A `ContentNode` whose own observer writes back into the
   same node is bounded by a per-`ContentNode` `propagating` guard in `notifyParentFields`. Regression:
   `button-label-app`, `contentnode-recursion-app`, `contentnode-parentfield-app`,
   `sharedcontent-recursion-app` in `test/cli/` — all must stay green together.

   > **`notifyParentFields` must also fan out cross-thread.** It is the one notification path that starts
   > from a `Field` rather than from the node holding it, so it bypasses the fan-out `Node.setValue` does
   > through `rendezvousSet`. On a device the parent field's port observer *is* the port the task waits
   > on, so a task mutating content held by an observed field (a rendezvous call applied on the render
   > thread) wakes itself; here the task holds its own copy and the render thread has to push the change
   > back. That is what `Field.container` (recorded by `Node.setValue`/`setValueSilent`, first writer
   > wins) exists for — it is the field's only route back to its owner's `syncType`/address. Regression:
   > `task-contentcache-app` in `test/cli/`.

   > **Two deferral mechanisms coexist in `Field` — keep them consistent.** Besides the synchronous
   > dispatch above, `Field` carries *two* separate deferral paths, gated by five interacting statics
   > (`observerDepth`, `internalUpdateDepth`, `initDepth`, `focusEmissionDepth`, `draining`).
   > (a) **`deferredQueue`** — *callback-level*, for reentrant engine emissions (grid
   > `itemFocused`/`rowItemFocused` under `enterInternalUpdate`); queued while another observer runs
   > (`observerDepth > 0`) and drained when the outermost dispatch unwinds (`observerDepth === 1`).
   > (b) **`pendingInitFocusFields`** — *field-level*, for `focusedChild` emissions raised during a
   > component's `init()` (`initDepth > 0 && focusEmissionDepth > 0`); the reacting observer is often
   > registered *after* the `setFocus` call, so a field (not a callback) is recorded and re-notified from
   > the extension `tick` hook after init unwinds (`deliverPendingInitFocus`, render-thread only). The
   > split is intentional (callback-level reentrant-unwind vs. field-level message-loop delivery) — do
   > **not** naively merge them. `notifyObservers` **consumes** a field from `pendingInitFocusFields` as
   > it dispatches so an inline re-focus of a still-pending ancestor doesn't double-fire; and `invoke`
   > stashes/zeroes both `internalUpdateDepth` and `focusEmissionDepth` so a handler's own writes are
   > treated as app-initiated. Any change to dispatch semantics must be re-checked against *both* paths
   > and all five counters. Regression: `init-focus-observer-app` (deferred delivery + no double-fire)
   > plus the cascade apps above.

2. **Re-entrant render — `Node.getBoundingRect`.** `localBoundingRect`/`boundingRect` refresh layout by
   rendering the whole tree from the root. If BrightScript queries a bounding rect *while a render is
   running* — e.g. an `ArrayGrid`/`RowList` lazily creating an item whose `init()` or observer measures a
   `Label` — the refresh re-enters rendering and recurses. Guard: `SGRoot.rendering`, set around the
   scene/dialog render in `RoSGScreen` **and around `getBoundingRect`'s own refresh render**;
   `getBoundingRect` skips the full-scene refresh while `rendering` is true (returning already-computed
   rects, which also matches Roku — layout isn't finalized during `init()`). Keep any new synchronous
   "render the whole tree to measure" call behind this flag with a `finally` restore. Regression:
   `grid-measure-app` in `test/cli/`.

3. **Cross-thread serialization — AA/array cycles (`factory/Serializer.ts`).** `fromSGNode` dedupes
   revisited **nodes** via its `visited` WeakSet, but a plain AA/array cycle (a helper AA back-referencing
   its own task `m`, e.g. `this._plugin = m` — common in analytics SDKs) recurses
   `jsValueOf ↔ fromAssociativeArray` forever; the throw also aborts `checkTaskRun` before `started` is
   set, so the render loop retries every frame → OOM. Guard: containers share the visited set **per
   descent path** (added on entry, removed in `finally`) — a cyclic reference is dropped (`null`/`{}`,
   one-shot warning); a container referenced from two sibling paths still serializes both times. Don't
   "simplify" to whole-pass tracking like nodes — that drops diamond-shaped shared data. Regression:
   "circular container references" in `test/extensions/scenegraph/NodeSerialization.test.js`.

## Focus chain consistency (`focusedChild` ↔ live focus)

`focusedChild` is a stored, observable field: `Node.setNodeFocus` walks the parent chain (`createPath`) at
focus time and points each ancestor's `focusedChild` toward the focused node. The trap is **timing**: a
component often calls `m.top.setFocus(true)` in `init()`, which runs (inside `createNode`) **before** the
node is appended to its parent (`addChildren`). At that moment the chain is just `[node]`, so ancestors
never get `focusedChild` set — and a later `m.top.focusedChild.<anything>` hits `invalid` (dot-on-invalid
crash). So `Node.setNodeParent` (the single chokepoint all append paths call) **repairs the chain on
attach**: if live `sgRoot.focused` is within the newly parented subtree, it re-points `focusedChild` from
the root down. Each attach extends the chain one level. Don't remove that repair as "redundant".
Regression: `test/extensions/scenegraph/FocusBeforeAttach.test.js`.
