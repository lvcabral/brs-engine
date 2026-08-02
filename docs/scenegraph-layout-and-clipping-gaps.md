# SceneGraph layout/clipping gaps: three unresolved divergences

Three device-measured (or measurement-blocked) gaps surfaced while fixing PosterGrid's extent (#1138)
and RowList/LabelList row layout (#1137). Each was deliberately left unfixed at the time — either the
measurement was incomplete, or fixing it needs data no probe has gathered yet. This records what is
known, what a probe or a fix would need to do, and why guessing is the wrong move for each.

Related: `.claude/docs/scenegraph-invariants.md` (the `PosterGrid` extent and per-row layout sections
this follows on from), [`scenegraph-render-fields.md`](scenegraph-render-fields.md) (the sibling plan
for declared-but-unimplemented render fields — same shape of problem, different fields).

---

## 1. `PosterGrid` caption zone — blocked on a device probe

### What is measured

Via `out/postergrid-rows-probe` (Streaming Stick, Roku OS 15.2, HD 1280×720): a one-column,
one-row `PosterGrid` with `basePosterSize=[100,100]` and **no captions requested**
(`caption1NumLines`/`caption2NumLines` default to `0`) reports a **136-tall cell**, not 100 — a
constant **+36** the poster's own height does not account for. Requesting one caption line
(`caption1NumLines=1`, real title text) grows the cell to 168 — **+32** for that one line.

```
R1 (no captions, showBackgroundForEmptyCaptions default true): cell = 136   (+36)
R2 (no captions, showBackgroundForEmptyCaptions = false):       cell = 136   (+36, UNCHANGED)
R3 (caption1NumLines = 1, real title):                          cell = 168   (+32 more)
```

### What the engine does

`PosterGrid.computeCaptionMetrics` (`nodes/PosterGrid.ts:708-731`) computes `totalHeight = 0` when both
`caption1Lines` and `caption2Lines` are 0 — no reserved zone at all — and adds
`captionVerticalMargin * 2` (24 HD / 36 FHD) only once a caption line is requested. So the engine is 36
short with no captions and, per the one measured data point, likely still short by some amount even
with captions (`captionVerticalMargin*2 = 24`, but the device's marginal cost for one line was 32).

### One hypothesis already ruled out

The empty-caption background (`showBackgroundForEmptyCaptions`, default `true`) looked like an obvious
candidate — a reserved zone for the caption _background_ image even when there is no caption text. `R2`
tested this directly by setting `showBackgroundForEmptyCaptions=false`: **the cell height did not
change.** Whatever reserves the +36, it is not that field.

### Why this needs a probe, not a guess

Two data points (0 lines → +36, 1 line → +32 marginal) cannot distinguish between several plausible
models:

-   a fixed base zone (e.g. one font-line height) plus per-line growth that is _smaller_ than the base
    line, which would mean 2 lines and 3 lines grow by a different increment than line 1 did;
-   the zone tracking `captionVerticalMargin` under a different multiplier than `* 2`;
-   something driven by the default caption font's line height (`caption1Font`/`caption2Font`, default
    `font:SmallerBoldSystemFont`) rather than a fixed constant;
-   FHD scaling is completely unmeasured — this run was HD only, and PosterGrid's margins turned out to
    be resolution-specific (`rectMargins()`, `.claude/docs/scenegraph-invariants.md`), so FHD cannot be
    assumed to be 1.5×.

A flat `+36` would **over-correct** the one-caption case (the engine's per-line height is already close
but not identical to the device's), and get zero-caption and two-plus-caption cases wrong in unknown
directions.

### Probe to build

Extend `out/postergrid-rows-probe` (or a new sibling) with:

1. `caption1NumLines = 2` and `= 3` — isolates the true per-line increment from the base zone.
2. `caption2NumLines` set independently, and both fields set together — the engine sums two independent
   heights (`height1 + height2 + lineSpacing` when both present); confirm the device does too, and at
   what gap.
3. The same matrix at **FHD** (`ui_resolutions="fhd"` in the manifest) — margins are resolution-specific
   elsewhere in this node, so assume nothing.
4. `captionLineSpacing` set to a non-zero value, to isolate its contribution from the base per-line
   height.
5. A non-default `caption1Font`, to test whether the reserved zone is font-metric-driven.

### Fix shape once measured

Almost certainly a change to `computeCaptionMetrics`'s `verticalMargins`/base-zone term and possibly
`captionVerticalMargin` itself — contained to that one method and its constants, not a structural
change. Cross-check against `out/postergrid-spacing-probe`'s already-fixed column-axis rules first: if
the base zone turns out to be `basePosterSize`-relative rather than a flat constant, that would be a
new axis of the same "what does this depend on" question the spacing work went through.

---

## 2. `LabelList` marginY — measured, not yet applied (small, contained)

### What is measured

Via `out/layout-measure-probe`, case `L`: a `LabelList` with `rowHeights=[100,50,200]` and
`rowSpacings=[10,20]` over `itemSize.y=40` reported total height **416**, which decomposes exactly as
`350 (Σ rowHeights) + 30 (gaps after rows 0,1) + 36 (3 rows × 2 × marginY)` — i.e. **marginY = 6**. The
no-overrides control (`156 = 120 + 0 + 36`) confirms the same marginY independently. `marginX` matched
the engine's existing value (24) in both cases, so **only marginY diverges**.

### What the engine does

`LabelList` does not set its own `marginX`/`marginY` or override `rectMargins()` — it inherits
`ArrayGrid`'s constructor defaults (`nodes/ArrayGrid.ts:164-174`): HD `marginX=24, marginY=4`, FHD
`marginX=36, marginY=6`. So the engine's **HD** marginY (4) undershoots the device's measured value (6)
by 2px per row-pair (×2 per row, so 6px difference over 3 rows before spacing — consistent with the
measured 416 vs. what marginY=4 would give: `350+30+24=404`, the value #1137 shipped with).

Notably, the device's HD value (6) equals the engine's own **FHD** default — i.e. `LabelList` may need
a `rectMargins()` override reporting the _FHD_ margin pair at _both_ resolutions, or its own
resolution-keyed pair that happens to coincide with FHD's default at HD. Only one resolution was
measured, so which of those it is remains open.

### Why this was deliberately left unfixed

`ArrayGrid`'s `marginX`/`marginY` are the shared default for every list/grid node that doesn't override
them — currently `LabelList`, `CheckList`, `RadioButtonList`. Changing the constructor defaults would
silently change all three at once, untested. The narrower fix — a `rectMargins()` (or constructor)
override scoped to `LabelList` alone, following the pattern `MarkupGrid`/`RowList`/`PosterGrid` already
use for their own margin pairs — was out of scope for #1137, which was about row _layout_ (heights and
spacings), not the focus-margin outset.

### Probe needed before fixing

Only HD was measured. Before writing a `LabelList.rectMargins()` override:

1. Confirm the **FHD** value — is it also 6 (i.e. `LabelList` uses a flat 6/24 pair regardless of
   resolution, unlike every other grid margin pair in this codebase, which is resolution-scaled), or a
   different value that would make it resolution-keyed like everywhere else?
2. Confirm `CheckList` and `RadioButtonList` — do they share `LabelList`'s marginY, or does each of the
   three `ArrayGrid`-default consumers have its own value? (`RowList`, `MarkupGrid`, `PosterGrid` are
   already known to each set their own pair, so there is precedent for "every grid type differs.")

### Fix shape once measured

A `protected rectMargins(): { x: number; y: number }` override on `LabelList`, mirroring
`MarkupGrid.rectMargins()`/`PosterGrid.rectMargins()`. Small, contained, no structural change — the
`updateRect`/`getBoundingRect` plumbing that consumes `rectMargins()` already exists and is exercised by
`GridMeasureSpacing.test.js` and `PosterGridExtent.test.js`.

---

## 3. `RowList` item-cell clipping — never probed (visual, needs a device screenshot)

### What is measured

Nothing yet — this is a **code-inspection finding**, not a device measurement, surfaced while
documenting the other two and re-reading `RowList`/`ArrayGrid`'s clip paths side by side.

### What the engine does

`ArrayGrid.renderItemClipped` (`nodes/ArrayGrid.ts:655-676`) clips **every individual grid item** to its
own cell before rendering it:

```ts
if (draw2D) {
    draw2D.pushClip({ x: itemRect.x, y: itemRect.y, width: itemRect.width, height: itemRect.height });
}
try {
    itemComp.renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
} finally {
    if (draw2D) {
        draw2D.popClip();
    }
}
```

`MarkupGrid`/`MarkupList`/`PosterGrid` all route through this (or an equivalent per-item clip) — see
`test/extensions/scenegraph/GridItemClipping.test.js`, which pins the SGDEX-style vertical button bar
whose title label collapses by being clipped at the item's own cell edge.

`RowList.renderRowItemComponent` (`nodes/RowList.ts:1006-1082`) never calls `renderItemClipped` — it
calls `itemComp.renderNode(...)` directly (line 1078), with **no per-cell clip**. `RowList` has a
_row-level_ clip instead (`RowList.ts:799-816`), but it activates only when the row's total content is
wider than the row's own bounds (`xOffset + rowWidth > context.itemSize[0]`), and it clips to the
**row's** horizontal bounds — not to each item's individual cell within the row.

So: a `MarkupGrid` item that draws content past its own cell edge is clipped at that edge (device- and
engine-confirmed, `GridItemClipping.test.js`). A `RowList` item doing the same thing draws unclipped, as
long as the row as a whole still fits its bounds.

### Why this needs a device screenshot, not a boundingRect probe

Unlike the other two gaps in this document, clipping is **purely visual** — `boundingRect()` is
unaffected by clipping (a clipped subtree still reports its full unclipped extent; see
`ClippingRect.test.js`'s "a measurement pass is unaffected" case), so nothing here is measurable through
the field-reading probe pattern the other two use. A `telnet` debug-console trace cannot see pixels.

### Probe to build

A visual fixture, run on both device and engine (`brs-cli --image 100`):

1. A `RowList` item component (via `itemComponentName`) with a child element (e.g. a `Label`)
   deliberately positioned to extend past the item's own cell width — mirroring
   `GridItemClipping.test.js`'s SGDEX button-bar scenario, but in a `RowList` instead of a
   `MarkupGrid`/`MarkupList`.
2. Two screenshots: item content that stays within the row's _overall_ bounds (tests whether the
   per-item edge clips even when the row-level clip never activates) and item content that also
   overflows the row's bounds (tests whether the two clip mechanisms compose, if the per-item one turns
   out to exist).
3. Compare against the same fixture in a `MarkupGrid`, which is already known-clipped, as a same-run
   control.

### Fix shape if confirmed

If the device does clip per-item in `RowList` the way `ArrayGrid` does, `renderRowItemComponent` needs
the same `pushClip`/`try`/`finally` bracket `renderItemClipped` uses, scoped to `itemRect` — structurally
a copy of the existing pattern, not a new mechanism. It would need to compose with the existing row-level
clip (both active, nested, when both conditions hold) rather than replace it — the row-level clip's own
regression coverage (`RowList.test.js`'s "clips row items to the list's own bounds" case) must keep
passing unchanged.

If the device does **not** clip per-item in `RowList`, this is not a bug — `RowList`'s design already
diverges from grid nodes in several other ways (`rowItemSize` vs `itemSize`, `variableWidthItems`,
`rowHeights`/`rowSpacings` vs the grid nodes' `columnWidths`/`rowHeights`), and per-item clipping could
legitimately be one more. Either outcome should be recorded as an invariant once measured — the "needs
device verification" state should not persist past the first probe run.

---

## Suggested order

1. **`LabelList` marginY** — smallest probe (extend an existing programmatic probe with an FHD case),
   smallest fix (one `rectMargins()` override), lowest risk.
2. **`RowList` item-cell clipping** — needs new probe infrastructure (visual/screenshot, not
   programmatic), but the fix — if confirmed — is a known, small, existing pattern to replicate.
3. **`PosterGrid` caption zone** — highest probe cost (5+ new cases across two resolutions to
   disambiguate several candidate models) and the fix shape depends entirely on what the probe finds,
   so it should not be started until the measurement is in hand.
