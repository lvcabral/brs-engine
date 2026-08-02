# SceneGraph invariants (`src/extensions/scenegraph/`)

Deep detail for the SceneGraph extension. Read this **before** changing node rendering,
field/observer dispatch, focus handling, `NodeFactory`/`addFields`, `Serializer.ts`, or the
lazy-field/lazy-method memory paths. Companion: [threading-and-rendezvous.md](threading-and-rendezvous.md).

## Rendering contract (`renderNode` is a template — override `renderNodeContent`)

`Group.renderNode` is a **template method and must not be overridden**. It calls `prepareRender`, derives
the node's draw translation via `getDrawTranslation`, pushes the node's `clippingRect`, and runs
`renderNodeContent` inside a `try/finally` that pops it. **A node type implements `renderNodeContent`**,
which early-returns via `updateRenderTracking(true)` when not visible, applies translation/rotation/
opacity, draws through the passed `IfDraw2D`, updates bounding rects, then calls `renderChildren(...)`
and `nodeRenderingDone(...)`.

**Why the clip lives in the template.** `clippingRect` is declared on `Group`, so every Group-derived
node inherits it, and the reference says it limits *"all drawing by this node **and** its children"* —
so it has to bracket the node's own geometry, not just the child traversal. It used to sit inside
`Group.renderNode` and `ArrayGrid.renderNode` around `renderChildren` only, which meant (a) the ~25 node
types that override the entry point ignored their own rect entirely, and because `Rectangle`/`Poster`/
`Label` also render children, an ignored rect leaked the whole subtree; (b) even for `Group` it never
covered self-drawn geometry. Putting it in the parent's `renderChildren` instead does **not** work: eight
call sites render a child directly (`PanelSet`'s ordered panels, the grid/list item renderers,
`TargetGroup`), and `RoSGScreen` paints the Scene and the active Dialog through `paintNode` with no
parent above them. Regression: `ClippingRect.test.js`.

**Sub-invariants, each of which broke something while this was being written:**

- **Measurement passes stay unclipped.** `pushClippingRect` no-ops without a `draw2D`, so
  `boundingRect()` still computes under a clip. Unchanged by the template, and load-bearing.
- **The clip pops in a `finally`.** `pushClip`/`popClip` are `ctx.save()`/`ctx.restore()`, so a leaked
  clip is *permanent canvas state* — every later frame draws inside it. Arbitrary app BrightScript runs
  inside the bracket (an item component's `init()`, a field observer), so the pop cannot be a plain
  trailing statement. Same reasoning for the four inner clip brackets that are not the template's:
  `ArrayGrid.renderItemClipped`, `RowList.renderSingleRow`, `ScrollableText`, `ScrollingLabel`. Backstop:
  `IfDraw2D.resetClips()` in a `finally` around the per-frame paint in `RoSGScreen`, so one bad frame
  cannot poison the next.
- **Every node positions its drawing through `getDrawTranslation`.** Nothing may compute its own
  `drawTrans` inline — if it did, the clip position could drift from the paint position. `rotateTranslation`
  now appears only in `Group.getDrawTranslation` (plus one unrelated use in `MonospaceLabel`).
- **An inherited rotation rotates EVERY node type's own translation.** **Device-measured** (Streaming
  Stick / Roku OS 15.2, probe `out/layout-measure-probe` case `R`): two identical hosts rotated 90° with
  a child translated `[100, 0]` put the child at the same rotated position whether that child is a
  `Group` or a `Rectangle`. The engine used to rotate for 18 renderable types but not for `Group` or the
  keyboard/text-entry containers — a `rotatesDrawTranslation()` hook that this measurement removed. The
  two behaviors are identical whenever the inherited angle is 0, which is why the split survived so
  long. Regression: `RotatedTranslation.test.js`.

  **Still open, and NOT the same bug:** a *container's* reported extent under rotation is off. With the
  translation fixed, a `Group` wrapping a 20×20 marker under a 90°-rotated host reports scene y = 220
  where the device says 200 — the container's union of a rotated child's *extent* (`updateParentRects`
  → `rotateRect`) does not account for the child's own rotated bounding box. Only the translation half
  was fixed; this residual needs its own measurement before anyone touches the union math.
- **The visibility gates stay inside each `renderNodeContent`.** They differ per node type (soft skip for
  containers, hard skip for renderables, hidden-extent measurement for grids) — see the
  visibility-vs-measurement rule below. Only the cheap `isVisible()` guard on the *push* lives in the
  template.
- **A node that self-translates during layout must do it in `prepareRender`.** The template derives
  `drawTrans` before the content hook, so a node whose layout assigns its own `translation` would
  otherwise get a clip at its pre-layout position. `StandardDialog.layoutStandardDialog` recenters the
  dialog, so its relayout gate lives in `prepareRender` — and because the four `Standard*Dialog`
  subclasses build content that *drives* that layout, their preambles moved into chained
  `prepareRender` overrides too. Getting this order wrong sizes a dialog from stale content
  (regressions in `StandardDialogNodes.test.js` caught exactly that).
- **Subclass delegation calls `super.renderNodeContent`, never `super.renderNode`** — the latter would
  push the clip a second time. `LayoutGroup` matters most: it calls super inside a convergence loop, so
  the mistake shows up as N clips per pass.

External node types registered via `SGNodeFactory.addNodeTypes` may still override `renderNode`; they
simply bypass the clip, exactly as every node did before.

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

   > **Argument binding is device-measured — `Field.satisfiedByEvent` (do not "generalize" it).** An
   > observer registered by *name* is invoked with the `roSGNodeEvent` **only when it declares exactly one
   > parameter whose declared type accepts an object**; otherwise it is called with **no arguments** (every
   > parameter taking its declared default), which requires that no parameter is required; otherwise it is
   > **not invoked at all, silently**. There is no coercion and no partial binding, so a callback declaring
   > more than one parameter *never* receives the event — not even when the extras are optional and the
   > first is `as object`. A default on the single parameter is irrelevant: `sub cb(e = invalid as object)`
   > still receives the event, not its default. This is not BrightScript's normal call-binding rule (which
   > would happily fill trailing optionals), so it cannot be delegated to `Callable.call` /
   > `getFirstSatisfiedSignature([event])` alone — that fallback matched the *zero-argument* satisfaction
   > while the binding loop still assigned the event to parameter 0, which is how
   > `sub cb(state = "update" as string)` observing a Timer `fire` got an object in `state` and raised a
   > `Type Mismatch` on a later `state = "stop"` — a crash impossible on a device. Measured across 16
   > signature shapes × `observeField` / `observeFieldScoped` / `Timer.fire` / a string-typed field on Roku
   > OS 15.2 (all four identical); the probe app and its device trace are in
   > `out/observer-signature-probe/`. Regression: "Binds an observer callback's parameters the way a device
   > does" in `test/cli/cli.test.js` (`observer-signature-app`).

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

## Animation `control` — containers relay everything, `none` is inert, a pending `delay` reads "stopped"

**Device-measured** (probe channel: `out/animation-control-probe`, Streaming Stick / Roku OS 15.2; the
engine reproduces all 37 records on states and value buckets). Four rules, each of which the engine got
wrong and none of which is guessable from the reference alone.

> The probe and its device/engine traces live in **gitignored** `out/` scratch (`.gitignore:14`), same
> as `out/observer-signature-probe` — they are not committed, so re-measuring means rebuilding the
> channel from this section plus the trace format described in its README. The four rules below are the
> durable artifact; treat them as the record, not the traces.

1. **`control = "none"` is inert.** Writing it to a *running* animation leaves it running and its
   interpolated fields keep advancing (opacity went 0.58 → 0.88 across the write). It used to route to
   `stop()`. The reference calls `none` the "initial state with no associated action" — which reads like
   it only describes the initial value, so this needed measuring.
2. **A container relays the whole control vocabulary, not just `start`/`stop`.** `ParallelAnimation` and
   `SequentialAnimation` forward `pause`, `resume` and `finish` too. This matters because a container's
   `updateAnimation` is a **no-op** — it animates nothing itself — so an un-forwarded `finish` flips only
   the container's own `state` and leaves every target field untouched, directly contradicting
   "All animated fields will be immediately set to their final values as if the animation had completed".
3. **`SequentialAnimation.finish` fast-forwards children that never ran.** Finishing during child 1 put
   children 2 *and* 3 on their final values. Capture the cursor **before** calling `super.setValue`:
   `finishImmediately()` → `stop()` → this node's `stop()` override resets `currentChildIndex` to −1, so
   afterwards the active child is unknown. Sending `finish` to an already-stopped child still lands its
   target, because `finishImmediately` applies fraction 1 regardless of state.
4. **A pending `delay` keeps the PUBLIC `state` at `"stopped"`.** With `delay = 1`, `state` read
   `stopped` at start and through the delay, flipping to `running` only once it elapsed. The internal
   `_state` must still be `running` so `tick()` counts the delay down — hence the split between `_state`
   and `updateStateField`. **Only the initial delay was measured**: the repeat path re-seeds
   `delayRemaining` between iterations and deliberately does *not* re-publish `"stopped"`, because what a
   repeating delayed animation reports between cycles is unmeasured. Don't "make it consistent" without a
   probe.

**Rule 4 has a sharp edge that bit twice during implementation.** A container polls its children to
decide when the group is finished, and if it reads the *public* `state` field it sees a delay-pending
child as `"stopped"` — so it tears the whole group down before anything runs (`ParallelAnimation`), or
skips straight past the delayed child (`SequentialAnimation`). Containers must poll
**`AnimationBase.isSettled()`** (internal `_state`), never the field. For the same reason the
delay-pending publication is gated on `countsOwnDelay()`: both containers override `tick()` and never
decrement `delayRemaining`, so publishing `"stopped"` on them would stick forever. A container's own
`delay` is effectively ignored today (it relays `start` to its children immediately) — pre-existing and
**unmeasured**, so don't infer container delay semantics from this section.

Related edge: `resume` may only be relayed to children that are actually **paused**
(`AnimationBase.isPaused()`). `handleControl("resume")` restarts a non-paused animation from the
beginning, so relaying it blindly makes a child that had already *completed* before the pause replay its
settled part — visible as a flicker in a mixed-duration parallel group.

Two things the probe **cleared**, so don't "fix" them: a device does **not** snap the target to
`keyValue[0]` when an animation with a delay starts (it stays at its authored value, as the engine
already did), and `pause` leaves each child's own `state` reading `paused`.

Regression: `test/extensions/scenegraph/AnimationControl.test.js`. Note the `resume` test asserts the
*paused precondition* first — without pause propagation the children were never paused, so "they run
after resume" would pass vacuously.

## `ArrayGrid.scrollingStatus` — a lazy pulse, ordered ahead of the focus settle

Per `zoomrowlist.md` the field is "set to true whenever the list is scrolling the focus horizontally or
vertically". It is documented only under `ZoomRowList` but exists on **every** `ArrayGrid`-derived node on
a device, and apps alias it up from a plain `RowList`. On a device the scroll spans several frames: the
field goes true, the focus fields pass through in-transit values, and it goes **false before the focus
finally settles**. Our scroll is instant, so both edges land in one frame — which makes their **order
relative to the focus fields the entire contract**, and the two rules below easy to get backwards. Both
were regressed once each while this was being written.

1. **The falling edge must precede the settled focus fields.** Apps depend on the interleave in both
   directions: the falling edge is where they tear transient scroll state down (hiding a shared
   overlay/preview container that belongs to the *outgoing* item), and the **settle** emission of the focus
   fields (`itemFocused`/`rowItemFocused`/`currFocusRow`…) is what rebuilds it at the new position. Put the
   pulse *after* the settle and the teardown runs last: the app is left with its overlay torn down and
   nothing to restore it — the symptom is the focused item's poster **and** its preview player both
   vanishing. The edges are therefore emitted **outside** the `Field.enterInternalUpdate()` bracket on
   purpose: inside it, a reentrant falling edge would defer past the very settle it must precede.

2. **A key that scrolls nothing must emit NOTHING.** Hence the pulse is *armed* by `handleKey`
   (`armScrollPulse`) and only *emitted* by the settle paths (`emitScrollPulse`, idempotent per press),
   rather than opened before the handler and closed after it. A boundary press on a non-wrapping list, or
   any key while the grid is outside the focus chain, publishes **no** focus fields at all — so a pulse
   there is a teardown with no settle behind it, the same failure as rule 1. (Reachable in practice:
   `StandardDialog`/`Dialog`/`PanelSet` forward keys to children without checking focus.) It is not
   `alwaysNotify`, so a device emits nothing on those paths; don't add `alwaysNotify` — the pulse always
   changes value, so both edges notify without it, and adding it resurrects the spurious same-value
   notification that `ZoomRowList`'s old redeclaration produced.

`handleKey` arms **inside** its `try` and disarms in the `finally`: an exception from either edge's
observers must not strand the field at `true`, which would silently suppress every later notification.

Every path that publishes settled focus fields must call `emitScrollPulse()` first — `ArrayGrid`.
`setFocusedItem`, `RowList.setFocusedItem` *and* `setRowItemFocused` (the horizontal handlers reach the
latter directly, bypassing the former), `ZoomRowList.setFocusedItem` *and* its direct `rowItemFocused`
write in `handleLeftRight`, and `TimeGrid.focusCell` *plus* the three paths that bypass it
(entering/leaving the channel-info column, moving within it, panning the time window). Adding a new
navigation path means adding the call. Programmatic focus writes (`jumpToItem`/`jumpToRowItem`/
`animateToItem`) deliberately do **not** pulse: those are content-loading paths and don't scroll the focus
on a device.

Related trap in the same area: `ZoomRowList.handleUpDown` must **not** pre-assign `this.focusIndex` before
calling `setFocusedItem`, which reads it as the *outgoing* row to emit `rowUnfocused` (and assigns it
itself). Pre-assigning made that emission dead, so an app collapsing the outgoing row never got the
callback.

Regression: `test/extensions/scenegraph/ArrayGridFields.test.js` (asserts on a merged notification log, so
values *and* order are pinned — including three no-pulse cases) and the channel-info/time-pan test in
`test/extensions/scenegraph/TimeGrid.test.js`.

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

### A focus transaction commits before it notifies, and a focus-loss observer can't re-grab

Two rules, both **device-measured** on a Roku Express 4K+ (OS 15.3) with `out/focus-probe*`. They exist
because an app that re-grabs focus from its own `focusedChild` observer (sgRouter's outlet, and the same
`OnFocusedChildChange` shape in several media apps) behaves on a device and used to corrupt the chain here.

1. **Commit, then notify.** `setNodeFocus` stages *every* `focusedChild` write (`stageFocusedChild`) and
   dispatches the observers only afterwards (`notifyStagedFocus`), losing subtree first. An observer must
   therefore read the **finished** chain. Writing-and-notifying node by node — what the code did before —
   let the losing subtree's observer see a half-rewritten chain (`sceneFC` still pointing at the old
   subtree). Dispatch is still **synchronous**, inside the `setFocus` call: Roku commits atomically, it
   does not defer these to the message loop. (Init-time focus emissions are the one exception — see
   `pendingInitFocusFields` above.) `restoreFocusChainOnAttach` stages its repair the same way.

   Staging holds back only the **notification**: the write itself goes through the regular virtual
   `setValue` (suppressed via `focusStagingSink`), because subclasses override it — `Group.setValue`
   marks the node dirty so focus visuals repaint, `ScrollableText.setValue` tracks its focused state.
   Writing the `Field` directly instead silently freezes every focus visual (a `Button` keeps its
   unfocused font, a `ScrollableText` its unfocused scrollbar thumb) while `hasFocus()` still reports
   true.

2. **A focus request raised from a focus-LOSS notification is dropped** (`isFocusRequestDropped`, keyed
   off the `focusNotifyOwners` stack). A Roku honors `setFocus` from a `focusedChild` observer only while
   the observed node is still in the focus chain — the "forward focus" pattern where a container that
   just *gained* focus hands it to an inner widget. The mirror case, a node re-grabbing focus as it
   *loses* it, leaves the chain and the remote with the node the in-flight transaction focused.

   Scoped to transactions where a node is **taking** focus (`notifyStagedFocus`'s `gaining` flag). The
   unfocus paths notify without classifying: with no competing target there is nothing to defend, and
   swallowing an unfocus observer's restore would leave the app with **no focused node at all**. The
   dropped path returns `false`, not `isFocusable()`, so a subclass override gated on
   `super.setNodeFocus(...)` skips its own bookkeeping too (an `ArrayGrid` must not move `itemFocused`
   for a grid that never took focus).

   Don't "simplify" this to dropping all nested focus changes: forward focus is how every custom dialog
   highlights its buttons (`dialog-buttongroup-focus-app`). And don't drop only the chain writes while
   letting `sgRoot.focused` move — that hybrid (live focus on one node, `focusedChild` on another) is the
   original bug: the remote drove the old subtree while the chain said otherwise, so a key handler
   returned `true` (playing the "handled" navigation sound) without focus visibly moving, and a
   `scene.dialog` drew unfocused with up/down/OK falling through to the scene behind it.

   **Deliberately not modeled:** on a device the node that lost the race keeps reporting `hasFocus() =
   true` until the next focus transaction, so two nodes report focus at once. Reproducing that would make
   both render focused. We report `hasFocus()` only for the live focus.

   Regression: `focus-steal-app` in `test/cli/`, which must stay green alongside
   `dialog-buttongroup-focus-app` and `init-focus-observer-app`.
