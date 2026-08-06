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
  Stick / Roku OS 15.2, probe `test/simulator/probes/layout-measure-probe` case `R`): two identical hosts rotated 90° with
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
CLI comparison in `test/cli/cli-scenegraph.test.js`. `BRS_PRUNE_DISABLE=1` turns pruning off (field
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
`duplicate-system-field-app` in `test/cli/cli-scenegraph.test.js`.

## `TimeGrid.channelParseCache` must invalidate on in-place program mutation, not just count

`TimeGrid` doesn't cache item *components* like `ArrayGrid`/`RowList` do — it draws its program cells
directly — but it does cache each channel's **parsed** program model:
`TimeGrid.channelParseCache` (a `WeakMap<ContentNode, ChannelParse>`) holds the flattened
`programs`/`starts`/`durations`/`gaps` derived from a channel's program children, and the invalidation
gate used to be the channel's program **count** alone. That misses two real in-place mutations that
keep the count unchanged:

- **`replaceChildAtIndex`** swapping a program for a different object at the same position —
  `ContentNode.makeDirty` only dirties the **container** (the channel), never the replaced child, so a
  count-only gate kept serving the stale (removed) program object — its title (read live from the
  object at draw time) stayed wrong indefinitely, with no self-correcting path (unlike `ArrayGrid`'s
  item cache, nothing here is refreshed by a focus move).
- **A field edit on an existing program object** (e.g. a schedule correction to
  `PLAYSTART`/`PLAYDURATION`) — count unchanged again, and the edit sets the **program's own**
  `.changed`, not the channel's or the root's.

Fix: `channelParseStale` also compares the channel's current program children against the cached
`rawPrograms` by **object identity per index** and by each program's own `.changed` flag, re-parsing
only that channel when either differs — preserving the cache's whole reason to exist (avoiding O(N²)
reparsing while incrementally loading N channels; see the comment on `channelParseCache`'s
declaration). Consumed programs have their `.changed` reset to `false` at the end of `parseChannel` —
a `ContentNode`'s `.changed` is otherwise never cleared, since content trees aren't part of the render
tree's per-frame reset (`Node.renderChildren`). Regression: the "channel parse cache invalidates on
in-place program mutation" tests in `TimeGrid.test.js`.

## `Group.drawText`'s per-index text cache and `TimeGrid.refreshContent`

`Group.drawText` caches each drawn string by a **running per-frame index** the caller passes in
(`cachedLines[index]`), reused across paints unless `this.isDirty`:

```ts
if (this.isDirty || this.cachedLines[index] === undefined) {
    // ...measure fresh...
    this.cachedLines[index] = measured;
} else {
    measured = this.cachedLines[index]; // stale reuse
}
```

`TimeGrid.renderContent` draws every channel-info/time-label/program-title string through this with
**one running counter (`textIndex`) across the whole grid** — so the logical string bound to a given
index depends on exactly how many `drawText` calls preceded it: the time-bar labels, then each row's
channel-info draw followed by its program-title draws. `isDirty` is set by `Group.setValue` (any field
write on the node itself) — never by an **in-place mutation of the `content` tree** (append/replace on
a `ContentNode` already held by an assigned `content` field only marks that node's own `.changed` and
`markSubtreeStale()`, per the `channelParseCache` section above — `isDirty` is a distinct flag).

So: if a channel's program **count** shifts between two paints — e.g. an SGDEX-style content manager
assigns `content` once as soon as the channel list loads, then streams each row's programs in
afterward via an in-place append to the SAME already-assigned tree (never rewriting the `content`
field) — every `textIndex` from that row onward maps to a **different** logical string than what the
earlier (already-painted, `isDirty` now `false`) pass cached there. Device-observed symptom (SGDEX
**TimeGridView** sample): a program cell whose row was still loading on the first paint later showed
the **next row's channel name** instead of its own (now-loaded) program title — because that row grew
from 0 draws (channel-info only) to 2 (channel-info + program title), pushing every following index up
by one, and the stale cache at the shifted index still held what a later row's channel-info text used
to be there. Any key press "fixed" it only because navigation writes a field through `Group.setValue`
(`isDirty = true`), incidentally invalidating the whole cache.

Fix: `TimeGrid.refreshContent` sets `this.isDirty = true` unconditionally at its own start — every
reparse (the only time the channel/program model, and therefore the `textIndex` sequence, can have
changed) forces fresh `drawText` measurement for the whole node that frame. Regression: "a content
reparse forces fresh text draws" in `TimeGrid.test.js`.

## `TimeGrid` vertical navigation is always fixed-focus and wraps — there is no `vertFocusAnimationStyle`

**Device-observed**, and confirmed against the reference (`external/dev-doc/.../timegrid.md`), which
documents no `vertFocusAnimationStyle` field for `TimeGrid` at all (unlike `RowList`/`MarkupList`,
where it's app-configurable). The engine used to give `TimeGrid` `ArrayGrid`'s inherited
`floatingFocus` default and no wrap — the highlighted channel row floated down through the visible
window before the window started scrolling, and up/down stopped dead at the first/last channel. A
real device instead pins the focused channel at the **top** of the visible window unconditionally
(`updateTopRow` — content scrolls, the highlight never moves within the viewport) and **wraps**: up
from channel 0 goes to the last channel, down from the last goes to channel 0
(`handleUpDown`/`wrapIndex`), for both the main grid and the channel-info column. `renderContent`'s row
loop indexes channels with `(topRow + r) % channels.length` instead of a linear `topRow + r` with an
end-of-list `break`, capped at `Math.min(visible, channels.length)` so a channel count smaller than the
visible window doesn't repeat a row within one frame. A single-channel grid's wrap-to-self resolves to
a no-op and reports the key **unhandled**, matching `MarkupList`'s single-item wrap rule, so it bubbles
to an ancestor. Regression: "vertical navigation is fixed-focus and wraps" in `TimeGrid.test.js`.

## `TimeGrid` automatic per-row loading feedback (`automaticLoadingDataFeedback`)

The reference documents `automaticLoadingDataFeedback` (default `true`) as replacing "the program data
region of the grid... automatically... whenever the content field has not been set **or the user
scrolls to a time where the content has not yet been loaded**." The engine already handled the first
half (`channels.length === 0`, via `shouldShowLoading`/`renderLoading`) and the fully-manual
`showLoadingDataFeedback` whole-grid override, but never the per-row case — once at least one channel
had loaded, no row ever showed loading feedback again, even one with zero programs. This matters
because `TimeGrid` combined with wrap reaches unloaded rows immediately (e.g. one "up" press from
channel 0 jumps straight to the last channel), and a row-by-row lazy content loader (SGDEX's
`ContentManagerTimeGrid` sample) keeps most rows empty until their own async load completes.

Fix: the row loop in `renderContent` tracks whether **any** program cell actually intersected the
visible time window (`anyProgramVisible`) — false both for a channel with zero programs and for one
whose programs exist but don't cover the current window (scrolled to an unloaded time). When
`automaticLoadingDataFeedback` is true, an empty row draws `loadingDataText` across its own
program-grid width instead of staying blank; `showLoadingDataFeedback` stays a whole-grid manual
toggle, ignored while automatic feedback is on (per the reference). `renderLoading` takes an explicit
`textIndex` from the same running counter every other string in this render pass uses (previously a
hardcoded `99999` sentinel, safe only because there was ever at most one call per frame) — now that a
frame can call it once per unloaded row, each call needs its own slot in `Group.drawText`'s
`cachedLines` cache (see the section above) or they'd collide. Regression: "automatic per-row loading
feedback" in `TimeGrid.test.js`.

**The loading text also needs a background panel, or it can be invisible.** Every other row's own
cell drawing gives `programTitleColor` (default opaque white) something to contrast against — a plain
translucent-white panel (`0xffffff0f`) or `programBackgroundBitmapUri`. The per-row loading branch
skips ALL normal cell drawing (that's the whole point — there's no cell to draw), so without also
painting that same panel first, the text sits directly on whatever's behind the grid (often the
scene's own background), and white-on-a-light-background is invisible. Regression: "the loading text
gets a background panel for contrast" in `TimeGrid.test.js`.

## `TimeGrid.programIndexAtTime` must check whether the candidate has already ENDED, not just started

`programIndexAtTime(ch, time)` binary-searches `programStart[ch]` (ascending) for the LAST program
starting at or before `time`, and is the shared primitive behind both the render loop's per-row
scan-start optimization and every focus-targeting call (`handleUpDown`'s vertical move/wrap,
`jumpToChannel`, `jumpToTime`, `jumpToNow`). Checking START alone is wrong whenever `time` falls in a
genuine gap — an unfilled schedule gap (`fillProgramGaps=false`, the default) or a channel whose guide
data simply hasn't loaded that far: the nearest earlier program may have already **ended** before
`time`, in which case it will never actually be drawn there (it fails the row loop's own start/end
visibility check), yet `focusCell` would still park focus on it.

Symptom (reported): the focus indicator sometimes vanished after a vertical **wrap** — wrap jumps to a
channel that can have a very different, sparser schedule than the one just left, making a gap at the
anchor time much more likely than an adjacent-row move — and the same failure then persisted on
subsequent moves (pressing left from the now-invisible "focused" program), since the engine's own
notion of "current program" was already wrong. Fix: after the binary search, if the candidate's own
`start + duration <= time` (already ended), advance to the NEXT program instead, when one exists.
Provably safe for the render-loop's `time = viewStartTime` scan-start usage too: a candidate that has
already ended by `viewStartTime` is by definition entirely off-screen to the left, which the loop's own
`continue` would have skipped anyway — the fix just avoids landing there in the first place.
Regression: `programIndexAtTime` tests in `TimeGrid.test.js`.

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
   > `test/simulator/probes/observer-signature-probe/`. Regression: "Binds an observer callback's parameters the way a device
   > does" in `test/cli/cli-scenegraph.test.js` (`observer-signature-app`).

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

**Device-measured** (probe channel: `test/simulator/probes/animation-control-probe`, Streaming Stick / Roku OS 15.2; the
engine reproduces all 37 records on states and value buckets). Four rules, each of which the engine got
wrong and none of which is guessable from the reference alone.

> The probe and its device/engine traces live in `test/simulator/probes/animation-control-probe`, same
> as `test/simulator/probes/observer-signature-probe` — re-measuring means rebuilding the
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
## `PosterGrid` extent — asymmetric axes, trailing gaps, fall-back spacing

**Device-measured** (Streaming Stick / Roku OS 15.2, HD 1280x720 and FHD 1920x1080; probes
`postergrid-spacing-probe`, `postergrid-rows-probe`, `postergrid-captions-probe`,
`postergrid-margins-probe` and `postergrid-outset-axis-probe` under `test/simulator/probes/`, each fixture
isolating one unknown). The engine reproduces every width, every x/y offset and every uncaptioned height
exactly:

```
width  = Σ over DRAWN cols of (basePosterSize.x + colSpacing_i) + marginX + marginX
height = Σ over ALL N rows of (rowHeight_i + captionZone_i + rowSpacing_i) + marginTop + marginBottom
spacing_i = (column|row)Spacings[i] ?? itemSpacing.(x|y)
marginX = marginTop = 14 (HD) / 21 (FHD)
marginBottom = 50 (HD) / 75 (FHD),  but == marginTop when rows == 1 && numColumns > 1
```

Seven rules, each of which the engine had wrong:

1. **Short spacing arrays fall back to `itemSpacing`, they do not repeat the last entry.**
   `columnSpacings=[10]` across 3 columns measured 438 (`10 + 50 + 50`); repeating would have given
   358. Note `LayoutGroup.itemSpacings` **is** device-confirmed to repeat — the two genuinely differ,
   which is why this was measured rather than reasoned by analogy. Watch the *fallback value* too: it
   is `itemSpacing`, not the array's first entry (the old `defaultColumnSpacing` derived from
   `columnSpacings[0]`, which silently made short arrays behave like a repeat).
2. **The gap AFTER the last track counts**, on both axes — matching the reference's "the spacing after
   each row" wording. 3 columns of 100 at `itemSpacing.x = 50` measure 478, not 428.
3. **The axes are NOT symmetric.** `columnWidths` is **ignored** (cell width always comes from
   `basePosterSize.x`) while `rowHeights` **is** honored. Do not unify them into one helper.
4. **`rectMargins` is 14/14 (HD) and 21/21 (FHD)**, not `ArrayGrid`'s shared 24/4 — now measured on
   **both axes at both resolutions** by `postergrid-margins-probe` (`x=-14 y=-14 w=128` HD,
   `x=-21 y=-21 w=142` FHD), with `left == right == top` in all six of its cases. The FHD pair used to be
   an inference: the caption probe reads `boundingRect().height` only, so at FHD it pinned the vertical
   *sum* (`21 + 75 = 96`) and nothing about x or about where the split falls. Any split summing to 96
   keeps every FHD height correct while moving every `y`, which is why that inference had to be closed by
   a probe printing the whole rect rather than argued from the design scale.
5. **The vertical outset is asymmetric: 14 above the first row, 50 below the last** (21/75 FHD), where
   the horizontal one is 14 on both sides. See the caption-zone section below — this was the "+36" that
   masqueraded as a missing caption zone for two rounds of probing.
6. **That extra bottom allowance is *conditional*** — absent exactly when the grid is a **horizontal
   strip**:

   ```
   marginBottom == marginTop   iff   displayed rows == 1 && numColumns > 1
   ```

   A **conjunction**, which is why no single variable explains it. `postergrid-outset-axis-probe` crossed
   17 cases × both resolutions specifically to kill the plausible single-axis rules, and killed all of
   them: **not** the column count (3 columns × 4 rows keeps the allowance, 3 × 1 loses it), **not** the
   content shape (one column 400 wide *keeps* it; 3 columns of 100×400 lose it), **not** a width
   threshold (700 wide keeps it, 90 wide over 3 columns loses it — a threshold would have to be both
   above 700 and below 90), **not** the drawn item count (see rule 7), and **not** a mis-attributed
   caption allowance (a captioned 3×1 grid reads HD 172 = `14 + 100 + 23 + 21 + 14`, so the zone and the
   allowance are independent terms). That last one is only decidable at **HD**: at FHD,
   zone-present/allowance-absent and zone-absent/allowance-present both give 196. Run both resolutions —
   they cross-check each other.

   The one thing no case separates: whether `rows` means the declared `numRows` or the rows actually
   displayed. Every case set them equal. The implementation uses the **displayed** count, so that the
   hidden and visible passes agree and because the outset is a property of the laid-out extent — but a
   grid with `numRows = 12`, several columns and one row of content is a **guess**, flagged as such in
   `rectMarginBottom`'s docstring.
7. **Width counts the columns actually drawn; the allowance gate counts the columns declared.** A grid
   with `numColumns = 3` holding only 2 items reports a rect **two** cells wide (HD 228) — yet the
   allowance is still absent, which only a gate reading the declared `numColumns` produces. Two different
   notions of "columns" in one node, both device-measured (`countDrawnColumns` vs. `rectMarginBottom`).
   **Do not unify them.** Only reachable when no row is full (`content.length < numColumns`), which is
   why it went unnoticed until a probe case deliberately under-filled a row.

**Related general fix:** `Group.updateBoundingRects` built `rectToParent` from the node's *translation*,
discarding `drawRect.x/y`. Identical for an ordinary node, but a grid's `updateRect` outsets `drawRect`
by its focus margins — and a device reports that outset — so a grid's reported rect had the widened
width/height with un-offset x/y. It now derives the position from `drawRect` too.

The lesson below ("fixing two of three spaces is worse than fixing none, because the disagreement is
silent") has a corollary that this fix went on to demonstrate: **a *compensating* error in a consumer is
equally silent, and repairing the producer is what surfaces it.** The leaked `+marginY` above was being
cancelled downstream by a `-focusMargins().top` subtraction in `RowList.getSubBoundingRect` (see the
grid-sub-rect section below). Both were wrong; together they read as correct. So when you fix a geometry
producer, audit its consumers for adjustments that were calibrated against the broken value — the tell is
a consumer-side correction whose magnitude happens to match the producer's error.

**All three coordinate spaces have to move together.** `rectLocal` stayed at `{0,0}` in the first cut,
so `localBoundingRect()`/`localSubBoundingRect()` disagreed with the parent and scene rects by the
margin (`Node.getSubBoundingRect` bases its `"local"` variant on `rectLocal`). Local is parent-space
minus the node's own translation; fixing two of three spaces is worse than fixing none, because the
disagreement is silent.

**`Overhang` was the one node not positioning through `getDrawTranslation`** — it built its rect from
`origin` alone and passed `origin` to its children, ignoring its own `translation`. That made the
general fix above report `{0,0}` for a translated Overhang (previously `{30,40}` from the translation
path, which disagreed with where it actually painted). It now uses `getDrawTranslation` like every
other node, so its paint position and its reported rect agree. Regression: `OverhangLayout.test.js`.

**Per-track arrays: `rowHeights` follows the same fall-back rule as the spacing arrays.** It used to
resolve through `ArrayGrid.resolveNumber`, which *repeats* the last entry — so `rowHeights=[200]` over
3 rows measured `3 x 200` instead of `200 + 100 + 100`. `resolveNumber` itself is left alone:
`ZoomRowList` depends on it and its behavior there is unmeasured.

**The trailing gap belongs to the reported extent, not to drawn geometry.** `computeRowWidth` feeds
both the reported width and the section/wrap divider rect; letting the trailing gap into the divider
drew it past the last poster's right edge. The divider takes the content-only width
(`includeTrailingGap: false`).

### The caption zone: there is no base caption zone

The "+36 the device reserves per cell with `caption1NumLines = 0`" recorded here for two rounds **was not
a caption zone at all** — it is the grid's own asymmetric **bottom** outset (rule 5 above). The
`postergrid-captions-probe` decoded it across 22 field combinations × {1 row, 2 rows} × {HD, FHD} = **88
readings, all reproduced exactly**:

```
height      = rows * (posterHeight + captionZone) + rowSpacing terms + marginTop + marginBottom
captionZone = 0                                            when caption1NumLines + caption2NumLines == 0
            = 23 + Σ lineHeight(font_i) * lines_i + captionLineSpacing * gaps
gaps        = max(0, lines1-1) + max(0, lines2-1) + (both blocks present ? 1 : 0)
```

**Why every pre-registered hypothesis lost, and to what.** Six candidate models were written down before
the run (five of them some form of "base zone + per-line"). All six were wrong the same way:

- **The allowance is per *grid*, not per cell.** `h2 − h1` is exactly one cell in every one of the 22
  cases, so solving for the residue from the 1-row and the 2-row readings independently gives the same
  number (36 HD / 54 FHD). Only a grid-level term can do that. This is what a "cell padding" or
  "caption zone" model cannot fit, and it is invisible if you only ever measure one row count.
- **It is not caption-related.** It is present with `caption1NumLines = 0`, and unchanged when
  `captionVertAlignment` is `center`/`above` — which draw the caption *over* the poster, so no zone is
  needed at all. (Also already known not to be the empty-caption background:
  `showBackgroundForEmptyCaptions = false` changed nothing.)
- **It is not poster-relative.** A 200- or 300-tall poster grows the cell 1:1 and nothing more.

**The caption base is 23, and it does not scale.** Three line counts (1, 2, 3) put the intercept at 23
with no extra step at the 0→1 boundary, and it measured **23 at both HD and FHD** — the lone non-scaling
value in this node, where every other margin goes 1.5×. It replaced a `captionVerticalMargin * 2` term
that gave 24 HD / 36 FHD. Above that base the zone is font-metric-driven (Largest → 61/line HD, Tiny →
18/line HD, matching the device's own `Label` heights), and `captionLineSpacing` is charged **per gap** —
`n−1` within a block plus one between the two blocks — which the engine already had right.

**Still divergent, but not here: the per-line term is 1–2px short.** The engine asks for the right thing
(the caption font's line height) but `RoFont.measureTextHeight` returns the font's *point size*, where a
device returns its real line height: device `Label` heights are SmallerBold 21/31, Largest 61/91, Tiny
18/26 against the engine's 20/30, 60/90, 16/24. So a captioned PosterGrid is still short by
`lines × 1..2`. That is an **engine-wide font-metric** gap — it moves every `Label`, `MultiStyleLabel`
and `ScrollableText` too, not just a caption — so it is deliberately **not** patched inside PosterGrid,
where it would hide behind a grid-shaped fudge factor. `PosterGridExtent.test.js` therefore pins the
uncaptioned heights absolutely and the captioned ones as *increments*, which hold under either metric.

**One inference from that run was later measured false, and is worth keeping as a worked example.**
caption2's per-line cost measured 20/29 against caption1's 21/31 with both fields defaulted, yet the two
were *equal* when set explicitly to the same font — read at the time as the device defaulting
`caption2Font` to the non-bold face while the engine defaults both to `font:SmallerBoldSystemFont`. The
margins probe set `caption2Font` explicitly to each face in turn (group N) and the device returned
**identical heights for both**. `SmallerSystemFont` and `SmallerBoldSystemFont` share a point size, so
height cannot separate them and the increment gap was never evidence about a font identity at all. It is
fully explained by the metric gap in the previous paragraph: the device's real `Label` line heights are
21/26 HD and 31/38 FHD against the engine's point sizes. **The engine's bold default is correct.** The
lesson: an inference drawn from a *difference between two derived quantities* inherits every error in
both, and here one of those errors was already known and documented one paragraph up.

**The probe measures heights, so anything that is not a height is unpinned by it.** Three values in this
node rode along on the 88 readings without being measured by them — the FHD `rectMargins` split, the FHD
**x** margin, and `CaptionTextOffset`. All three were marked as inferences in code, and
`postergrid-margins-probe` then measured all three directly. **Two of the four things it checked were
wrong**, which is the argument for marking inferences rather than letting them read as measurements:

- the FHD split (21/75) and the FHD x margin (21) were **right** — the plain 1.5× scale wins, and
  `left == right == top`;
- `CaptionTextOffset` was **wrong**: device-measured **0**, not `round(23 / 2)` = 12. The text starts
  immediately below the poster and the entire 23px base sits *below* it, rather than being split around
  it.

Why heights could not have settled the split: any pair summing to 96 keeps every FHD height in the 88
readings correct while moving every `y`. Measuring `CaptionTextOffset` needed a **screenshot**, not a
rect — a caption `Label` lives inside an internal item component and `ArrayGrid.resolveSubpart` maps an
item sub-rect to that component, so no `findNode`/`localSubBoundingRect` path reaches the Label. The
probe renders a real cell beside a reconstruction whose caption box is placed at a known offset of 0 and
subtracts the two columns' first inked rows, so the glyph-box-vs-line-box term and the antialiasing
cancel instead of being eyeballed; the decoder was mutation-tested first (`CaptionTextOffset = 20` → the
subtraction reads 20; a block-count-dependent offset → the two pairs disagree). The test suite still
asserts integrality and containment rather than only the constant, because those hold under any offset.

**`CaptionTextOffset = 0` was still only half the answer: it holds for a flat background, not the
DEFAULT one.** `postergrid-margins-probe`'s group P fixture always overrode
`captionBackgroundBitmapUri` to a transparent, non-`.9.png` bitmap to keep its ink detection clean — so
it never saw what happens with the field left unset, which is what most real apps do (including Roku's
own `PosterGridExample` sample). `postergrid-caption-offset-probe` re-ran the same subtraction crossed
against caption font weight (bold vs. plain) and background (transparent override vs. default),
8 columns / 5 pairs, one HD device run:

```
control (bold, transparent)        0   — reproduces group P exactly
font weight (plain, transparent)   0   — NOT the cause
default background (plain)         11
default background (bold)          12  — 1px from the plain reading, attributed to ink-detection
                                          noise (bolder strokes cross the threshold earlier), not a
                                          real font-dependent term
```

Font weight was never the variable; **the default caption background is a real `.9.png`, and a device
insets the caption text by that bitmap's own content-margin instead of drawing it flush** — the same
mechanism `ArrayGrid.focusMargins()` already uses for a focus bitmap's content-margin over its flat
`marginX`/`marginY` fallback, just never wired up for caption placement. `PosterGrid.ts` now resolves
this via `resolveCaptionTextOffset()`: when the resolved caption-background bitmap is a valid 9-patch
(`RoBitmap.ninePatch`), the offset is that bitmap's own `getPatchSizes().margins.top`; otherwise it
falls back to the flat `CaptionTextOffset` (0). This only applies to the below/above (zone-reserving)
branch — an on-poster caption (`top`/`center`/`bottom`) has no zone to be inset from.

Because most real apps never set `captionBackgroundBitmapUri`, the DEFAULT case matters more than the
override group P tested — so `caption_background.9.png`
(`src/extensions/scenegraph/common/images/{HD,FHD}/`) was recalibrated to make its own `margins.top`
match the reading (11 HD; a few 1px alpha-only marker pixels, no visible change). FHD (17) is the same
1.5× inference this node uses for its other margins, **not** separately device-measured — this probe
has not been run on an FHD device. A CUSTOM `captionBackgroundBitmapUri` that is itself a 9-patch
inherits `resolveCaptionTextOffset()` by construction, but no probe case exercised one, so that path is
also unmeasured.

### A hidden PosterGrid must measure what a visible one measures

`ArrayGrid.measureHiddenExtent` re-derives the extent arithmetically for the case it exists for — an app
assigns content to a still-hidden grid, sizes sibling UI from `boundingRect()`, then reveals it. Its
generic path adds `itemSize[1] + margin.y * 2` **per row**, which is device-correct for a grid whose
outset is symmetric and per-row (`LabelList` measured `Σ rowHeights + gaps + rows × 2 × marginY`) but
cannot agree with PosterGrid's once-per-grid asymmetric outset at more than one row count, and cannot see
a caption zone at all. So `PosterGrid` **overrides** `measureHiddenExtent`, and both paths derive their
per-row terms from the same helper (`accumulateRowExtent`).

**The override is reached from the hidden branch of `renderNodeContent`, which runs none of the setup the
visible branch does below it.** So everything the visible pass does before laying out a row, the hidden
pass has to do for itself, and the list is longer than it looks:

| shared step | why the hidden pass needs it | symptom when it's missing |
| --- | --- | --- |
| `content.changed` → `refreshContent()` | `renderNodeContent` runs it only on the visible path (the inherited `measureHiddenExtent` does it itself, so overriding it drops the step) | content appended *after* `content` was assigned is invisible to the measurement — a feed arriving late measures the stale row count |
| `currRow` ← `isFixedFocusMode() ? updateCurrRow() : updateListCurrRow()` | `getRenderRowIndex(r)` maps a row *position* to a content index through `currRow` | a grid scrolled past its first page measures its ORIGINAL rows: wrong height under per-row `rowHeights`, and under fixedFocus a wrong drawn-column count, so a wrong width too |
| `numCols` ← declared-or-inferred column count | `rectMarginBottom` and `computeReportedWidth` both read it | the strip gate and the reported width read 0 columns |
| rows actually **covered**, not rows requested | the bottom allowance is gated on the count, and a row can drop out at either end (out-of-range index, scene-edge cutoff) | fixedFocus with a partial last page: 50 charged where the visible pass charged 14 |
| wrap/section divider between rows | `wrapDividerHeight`/`sectionDividerHeight` are plain field reads — nothing about them needs laid-out items | fixedFocusWrap short by one divider (HD 24) once the window wraps past the last row |

`resolveLayoutTerms` holds the first three and both passes call it, so they cannot drift again;
`accumulateRowExtent` holds the last two and returns `renderedRows` alongside the extent.

The trap worth remembering: before the override, the inherited arithmetic agreed with the visible pass at
**exactly one row** and diverged in *both* directions either side of it (HD: 0 at 1 row, −28 at 2, −56 at
3). A single-row regression test would have passed and proved nothing. Any test here must vary the row
count *and* the scroll position *and* the focus style — the divergences above hid behind a grid measured
unscrolled at `focusIndex` 0, which is exactly where all the paths coincide. Pinned by
`PosterGridExtent.test.js` ("a hidden grid picks up content appended after the content node was assigned",
"a hidden %s grid measures the same extent as a visible one after scrolling").

## A grid's reported rect is outset — its item sub-rects are NOT

Three outsets meet on `subBoundingRect("item<r>_<c>")` and only two of them exist. Keep them apart:

| outset | applied by | shows up in |
| --- | --- | --- |
| `rectMargins()` → `marginX`/`marginY` | `ArrayGrid.updateRect` | the **grid's own** reported rect (device-measured) |
| `focusMargins(bmp)` → the 9-patch's declared content margins | `ArrayGrid.renderFocus` | the **drawn** focus frame — paint only, nothing reports it |
| *(none)* | — | an **item sub-rect** |

The calibrated invariant is **`subBoundingRect("item<r>_<c>")` == the item component's own rect** — the
bare poster, in all three coordinate spaces, focused cell included. `PosterGridItem` corroborates it
independently (its sub-rect lands exactly on its poster). Pinned end-to-end over
{HD,FHD} × {`RowList`,`ZoomRowList`} × translations by `RowListItemSubRect.test.js`, which asserts the
*composition* rather than either mechanism, plus the CLI fixture `rowlist-subrect-app` (which derives its
own expectation from its declared `translation`/`rowItemSize`, so no pixel constant can drift).

**The grid's own outset does not leak into an item sub-rect only because it cancels.**
`Node.getSubBoundingRect` re-expresses the item rect as `base.y + (subScene.y - this.rectToScene.y)`,
where `base` is `rectToParent`/`rectLocal`. That subtraction cancels the outset **only if `base` and
`rectToScene` carry it identically** (`Node.ts:1219-1226`). Any future per-space adjustment must therefore
be applied to all three spaces, or it reappears as a residue in every sub-rect.

### Worked example: two compensating errors that read as correct

An app positioned a home-screen preview overlay from a `RowList`'s focused-item sub-rect. Three PRs each
chased the same device symptom ("the overlay sits too low"), and two of them subtracted the *same* outset:

| state | `sub.y − focusedPoster.y` |
| --- | --- |
| `marginY` = 33/22 (square, unmeasured) | +33 |
| `marginY` → 6/4 (device-measured) | +6 |
| plus a `− focusMargins(bmp).top` in `RowList.getSubBoundingRect` | **0** ← aligned, by two errors cancelling |
| minus the `+marginY` leak, once `updateBoundingRects` was fixed | **−6** ← regression: overlay one margin too high |

Why it stayed invisible: the cancellation was *exact* for that app, whose focus 9-patch declares 6px
content margins — the same number as `RowList`'s FHD `marginY`. The default `focus_grid.9.png` declares
19px, so the CLI fixture (HD, `marginY` 4) had visibly *un*-cancelled arithmetic all along, and that
expectation was simply moved (`−15` → `−19`) rather than questioned. The footprint outset's own regression
test asserted only the *shape* of the outset (`top > 0`), never a pixel count, so it never disagreed with
a device either.

Two facts settled which side was wrong: `sceneSubBoundingRect` was *already* `poster − top` before the
producer fix (the three spaces silently disagreed by `marginY`, and the fix only made `toParent`/`local`
agree with the space that already leaked), and `PosterGridItem`'s sub-rect independently moved onto its
poster. The consumer-side subtraction was deleted; `RowList` now inherits `Node.getSubBoundingRect`
verbatim, like `MarkupGrid`, `MarkupList`, `LabelList` and `ZoomRowList`. Its `resolveSubpart` override
stays — mapping `item<row>_<col>` into the 2-D `rowItemComps[row][col]` is what makes the API work at all
(the flat `itemComps[]` stays empty on row lists) — and carries a negative comment recording that the
outset must not come back.

Do not "fix" a misplaced focused-item overlay by adjusting this rect: the painted frame legitimately sits
outside the reported rect, and that asymmetry is what makes the wrong fix look right.

### Known fallout from the `updateBoundingRects` fix, still awaiting device measurements

Each needs its own probe and PR; none is fixed:

- **`LayoutGroup` displaces grid children.** `chooseActiveRect` (`LayoutGroup.ts:521-522`) prefers
  `child.rectToParent` and `measureChild` derives `primaryStart`/`crossStart` from it, so a child now
  measured with its outset gets *positioned* by it. Measured: a `LabelList` in a vertical LayoutGroup moved
  from `translation [0,50]` to `[24,54]` — exactly `(marginX, marginY)`, and **stable**, so
  `LayoutConvergence.test.js` does not catch it. A LayoutGroup positions by *paint* geometry, so the fix is
  a paint-rect hook subtracted in `measureChild`, not a revert.
- **`renderTracking` flips on the ancestor.** `updateParentRects` (`Group.ts:674-696`) unions the moved
  `rectToParent` into the parent: a plain `Group` wrapping a `LabelList` went `{0,0,348,216}`/`"full"` →
  `{-24,-4,348,216}`/`"partial"`. Apps gating viewable-impression work on `renderTracking == "full"`
  silently stop firing.
- **Two untested side effects**, both arguably now *correct* by the fix's own rationale and worth locking
  in with a test rather than reverting: `SimpleLabel` reports the anchored glyph box (a center/center label
  at `[500,300]` reports `{473,288}`), and `PosterGridItem`'s sub-rect landed on its poster (`sub.y` 4 → 0).

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

Two rules, both **device-measured** on a Roku Express 4K+ (OS 15.3) with `test/simulator/probes/focus-probe*`. They exist
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
