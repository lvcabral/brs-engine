# SceneGraph invariants (`src/extensions/scenegraph/`)

Deep detail for the SceneGraph extension. Read this **before** changing node rendering,
field/observer dispatch, focus handling, `NodeFactory`/`addFields`, `Serializer.ts`, or the
lazy-field/lazy-method memory paths. Companion: [threading-and-rendezvous.md](threading-and-rendezvous.md).

## Rendering contract (`renderNode`)

`renderNode` early-returns via `updateRenderTracking(true)` when not visible, applies
translation/rotation/opacity, draws through the passed `IfDraw2D`, updates bounding rects, then calls
`renderChildren(...)` and `nodeRenderingDone(...)`.

**Visibility vs. measurement:** plain containers (`Group`, `LayoutGroup`, `MaskGroup`) do their
invisible early-return through `Group.skipRender(draw2D)`, which lets a **measurement pass** (a render
with no `draw2D` — `getBoundingRect`'s refresh) traverse them when invisible: on Roku, layout/bounding
rects are independent of visibility, and apps measure UI under a hidden ancestor before revealing it. A
measured invisible container propagates opacity 0 and does not union into its parent's bounds.
Renderable/complex nodes (Poster, Label, ArrayGrid, …) keep the hard skip so hidden UI never loads
textures or creates item components. Regression:
`test/extensions/scenegraph/HiddenMeasure.test.js`.

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
