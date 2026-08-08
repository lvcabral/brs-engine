# Splitting `renderNode` into layout and paint passes

**Status:** implemented (#1120): the layout/paint seam + injectable `sgClock`, per-node
clock/side-effect extraction, LayoutGroup fixed-point convergence, and subtree pruning. Verified
with a temporary `BRS_PRUNE_VERIFY` rect-diff harness against two production apps until silent —
that harness surfaced three real divergence families (scoped-measurement bookkeeping leaks,
convergence passes polluting ancestor unions, `[0,0]` scene-rect clobbering on zero-width
subtrees), each fixed and pinned as regression tests (`LayoutPruning.test.js`), after which the
harness was removed. `BRS_PRUNE_DISABLE=1` remains as a field-debugging escape hatch. The document
below is the original proposal, kept for the analysis and the verification bar; where the
implementation deviated (AnimationBase was already ticked outside render; `renderNode` remains the
single override point with `layoutNode`/`paintNode` as base-class entry points setting
`sgRoot.renderPass`), the PR records why.

## The problem

`Node.getBoundingRect(type, interpreter)` answers a question about **one** node by re-rendering the
**entire scene** from the root (`refreshLayoutFromRoot`). Measuring a component as it is created is an
ordinary app pattern — a field whose `onChange` sizes a focus ring with `boundingRect()` or
`ancestorBoundingRect()` — so a screen build costs O(tree) per component and **O(n²) overall**.

Measured on one app's screen of 72 custom components, against the same app on a Roku device:

| | device | engine |
| --- | --- | --- |
| per component, first → last | 9.8 → 9.6 ms (flat) | 92 → 179 ms (**rising**) |
| full screen build | 1175 ms | 11948 ms |

The rise is the quadratic term. A device is flat because it maintains layout incrementally and a
bounding-rect query is a read.

A synthetic reproduction lives in the probe described under [Tooling](#tooling): 70 components are flat
at 4–8 ms each until one `boundingRect()` call is added to their `value` onChange, after which they rise
10.2 → 17.8 ms.

## Why the obvious optimization does not work

The natural fix is to prune the refresh: skip subtrees nothing has written to since their last pass.
That was implemented on `perf/layout-measurement-passes` (do not merge) and produced the expected win —
screen build 11948 ms → 5744 ms, per-component cost flat — but it is **unsound**, because `renderNode`
does three different jobs at once and a write-based staleness model only sees the first:

1. **Compute layout** — rects, translations, unions into parents.
2. **Advance wall-clock state.** `AnimationBase`, `BusySpinner`, `ScrollingLabel` and `DynamicKeyGrid`
   read `performance.now()`/`Date.now()` *inside* their render. A skipped subtree never advances, so an
   in-flight animation freezes. Observed in a real app: a toast measured at `y=-16` where a full pass
   gave `y=-1.5`, and a countdown timer 5 px too tall.
3. **Converge derived sizes.** A wrapped `Label`'s height comes from measuring its lines; a
   `LayoutGroup`'s from stacking its children — which is why `LayoutGroup.renderNode` runs
   `maxPasses = 2` on a measurement pass. Nothing writes a field between those passes, so a
   write-based model sees a "clean" subtree and freezes it at its pre-convergence size.

Gating the skip on "two consecutive identical passes" fixes (3) in most cases and cut observed
divergences from 44 to 32, but it is not a convergence proof: these layouts creep asymptotically
(observed 659 → 631 → 629, where two passes inside one refresh agree and a third still moves). And
nothing rescues (2).

**Conclusion:** the refresh traversal cannot be pruned while it is also the mechanism that advances
animations. The passes have to be separated first.

## Proposed split

Give every renderable node two entry points instead of one:

```
layoutNode(interpreter, origin, angle, opacity)      // pure: rects only, no clock, no drawing
paintNode(interpreter, origin, angle, opacity, draw2D) // advances time-based state, draws
```

- **`layoutNode`** must be *idempotent* and *clock-free*: calling it twice with the same inputs and an
  unchanged tree must produce identical rects. It computes dimensions, runs container layout, unions
  into parents, and recurses.
- **`paintNode`** does everything else: interpolate animations, advance spinners and marquees, update
  render tracking, create lazily materialized grid items, and draw through `IfDraw2D`. It calls
  `layoutNode` first (or relies on the frame's layout phase having run).

A frame becomes `layout` then `paint`, and `refreshLayoutFromRoot` calls **only** `layoutNode`. Once
that holds, pruning is sound: a clean, converged subtree cannot have changed its layout, and nothing
else is riding on the traversal.

### Suggested order of work

1. **Inventory the clock and side-effect users.** Grep for `performance.now()`, `Date.now()`,
   `updateRenderTracking`, lazy item creation, and `draw2D` use inside `renderNode` implementations.
   That list is the scope. Known: `AnimationBase`, `BusySpinner`, `ScrollingLabel`, `DynamicKeyGrid`,
   `ArrayGrid` (item creation), `Video`/`TrickPlayBar` (per-frame UI), `Poster` (bitmap load).
2. **Introduce `layoutNode` as a wrapper, not a rewrite.** Default implementation: call the existing
   `renderNode` with no `draw2D`, i.e. today's measurement pass. Nothing changes behaviourally; the
   seam exists.
3. **Move clock-driven state out, node type by node type**, each with its own regression test. The
   pattern: read the clock in `paintNode`, store the result in a field or private, and have
   `layoutNode` consume the stored value. `AnimationBase` first — it is the largest correctness risk
   and its tests (`Animation.test.js`) are the tightest.
4. **Make container convergence explicit.** `LayoutGroup`'s `maxPasses = 2` exists because a child's
   settled size differs from the size layout assumed. With a pure `layoutNode`, iterate to a fixed
   point (cap the iterations) and assert in tests that a third pass changes nothing — the asymptotic
   creep observed above is a bug this step should surface and fix, not paper over.
5. **Only then** re-apply pruning, gated on the same two conditions the abandoned branch used
   (`subtreeStale` propagated up on `makeDirty`, plus an unchanged origin/angle/opacity context), and
   keep the skipped-child rect handoff (below).

### Two details worth carrying over from the failed attempt

Both were found the hard way and cost a debugging cycle each:

- **Parent bounds are pushed *up* by children.** `Group.updateParentRects` unions a child's
  `rectToParent` into its parent, and a parent overwrites its own rects at the start of its pass
  (`updateBoundingRects`). A skipped child must therefore still hand its cached rect up, or every
  ancestor's union comes out short — a vertical `LayoutGroup` reports one child's height instead of the
  stack's. `MidRenderParentMeasure.test.js` catches exactly this.
- **Clear a node's stale mark *before* its pass, not after.** BrightScript that runs inside a pass (a
  component's `init()`, a field observer) can write fields; clearing afterwards wipes the mark those
  writes set and strands the change until something unrelated dirties the node again.

## Tooling

Recover the verifier from commit `4f868284` on `perf/layout-measurement-passes` — a
`BRS_PRUNE_VERIFY=1` branch in `refreshLayoutFromRoot` that runs the refresh pruned, then unpruned, and
diffs every rect in the scene:

```
[prune-verify] /Scene[2]/.../Group#videoTileOverlayGroup: pruned=12,-6,958,867.5 full=12,-6,958,839.5
```

It named the exact diverging nodes in an app whose internals were unknown, in one run. Any future
attempt should keep it available and run it against several apps.

The synthetic probe (70 custom components in a `LayoutGroup`, each measuring itself on a field change)
iterates in about a second versus twelve for a real app; it is worth rebuilding as a committed perf
fixture if this work proceeds.

## Verification bar

- The full suite, with particular attention to `MidRenderParentMeasure`, `HiddenMeasure`,
  `ListMeasureStability`, `SubBoundingRect`, `GridMeasureSpacing`, `PanelHeight` and the
  `grid-measure-app` CLI regression.
- The rect verifier, silent, against **at least one app that animates**. A screen with no animations
  gives a false green: one app's 144 `ancestorBoundingRect` values were byte-identical before and after
  a change that visibly broke a different app's menu, because the first app had nothing time-driven on
  screen.
- Device comparison for the numbers. The target is the device's shape — *flat* per-component cost — not
  a particular millisecond count.

## Skips are asymmetric: what paint may skip, layout may not

The two entry points do **not** prune the same subtrees, and the asymmetry is deliberate in both
directions:

| Condition | Layout pass (`layoutNode`) | Paint pass (`paintNode`) |
| --- | --- | --- |
| `visible = false` | traverses (containers soft-skip, renderables measure their extent) | skips |
| accumulated `opacity = 0` | traverses, propagating opacity 0 | **degrades to layout** (`Group.isTransparentPaint` drops `draw2D`) |
| settled subtree, unchanged context | skips (`Group.skipSettledLayout`, pruning) | never skips |

Layout must keep descending into hidden and faded-out subtrees because bounding rects are independent
of visibility on a device, and apps measure and position UI *before* revealing it — a layout-side skip
would make `boundingRect()` return zeros for exactly the UI that is about to be shown. Paint, in turn,
must not depend on the final `ctx.globalAlpha` write to make a transparent subtree invisible; that
single point of failure once painted a grid's focus frame at full strength over a screen the app had
faded out.

The transparent case is a *degrade*, not a skip, and that distinction is load-bearing: an early return
would union a rect the subtree never computed (a node faded out before its first layout has a
`{0,0,0,0}` `rectToParent`, which `unionRect` treats as finite) and inflate every ancestor's bounds,
so paint and layout would disagree about the same tree. Dropping `draw2D` gets layout-identical rects
for free, because every draw call goes through `draw2D?.`.

The general rule when adding a skip on either side: a skipped node must still hand its cached rect up
(`updateParentRects`) whenever the *other* pass kind would have unioned it, and that is only sound when
the rect actually exists — otherwise degrade the traversal instead of skipping it. A paint-side skip
must also not clear `isDirty` or record a layout context, or the subtree stays frozen after a reveal.
Details and the regression tests are in `.claude/docs/scenegraph-invariants.md`.

## Related

- `docs/scenegraph-rendezvous.md` — the other place render-thread timing is analysed in depth.
- Merged already: text measurement is memoized per font (`RoFont.measureCache`), worth 2x on this
  workload. Measuring was 39% of self time because a `LayoutGroup` re-measures its children on every
  layout pass and `Group.isDirty` is only cleared on a real frame draw.
- Next bottleneck after that: allocation. GC is ~39% of samples, from per-node `Callable`/`BrsInterface`
  construction (`registerMethods`). Unrelated to this proposal.
