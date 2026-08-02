# Layout Measure Probe

Settles four layout/measurement questions brs-engine currently guesses at. Everything is read back
through `boundingRect()` / `sceneBoundingRect()` or a plain field read — **no screenshots needed**.

## Run

Device (sideload the folder or zip, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine baseline, committed alongside as `engine-trace.txt`:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/layout-measure-probe
```

Runs for ~1 s after a settle delay and self-terminates. Measurements are taken from a Timer, not
`init()` — a bounding rect is only meaningful after the node has been laid out once, and reading in
`init()` reports pre-layout zeros on both a device and the engine.

## Output format

```
PROBE|<seq>|<phase>|<case>|<key=value ...>
```

Rects print as `{x= y= w= h=}` rounded to whole pixels; sub-pixel differences are not what any of these
cases are about.

## Cases

### `L-labellist` — does LabelList honor `rowHeights` / `rowSpacings`?

`LabelList`'s render loop advances by `itemSize.y + 1` (`LabelList.ts:132`) — honoring neither
`rowHeights` nor `rowSpacings` nor `itemSpacing.y`, and that `+1` is undocumented.

**This case also covers a coherence bug shipped in #1134.** That PR made `updateRect` sum `rowHeights`
for *every* caller, LabelList included — so today the list **measures** per-row heights while its layout
still draws uniform rows:

| | engine |
| --- | --- |
| `with-overrides` (rowHeights `[100,50,200]`, rowSpacings `[10,20]`) | `h=404` — measured as `380 + margins` |
| what the loop actually draws | `3 × 41 = 123` |
| `no-overrides` control | `h=144` |

So `boundingRect()` currently over-reports by ~3× for a LabelList with `rowHeights` set. Which way to
fix it depends entirely on the device:

- **Device honors `rowHeights` in a LabelList** → the measurement is right and `LabelList`'s render loop
  needs the same per-row treatment `MarkupList` got.
- **Device ignores them** → the render loop is right and `updateRect` must be gated for LabelList
  (an `honorsRowHeights()` hook alongside the existing `usesColumnWidths()`).

`rows-*` sample `subBoundingRect("0"/"1"/"2")`. The engine returns the whole-list rect for every row
(per-item subparts are not resolved for LabelList), so those rows are uninformative *in the baseline*.
If a device returns distinct per-row rects they give the real row pitch directly, which answers the
`+1` question outright.

### `P-postergrid` — short spacing arrays: repeat the last entry, or fall back?

3 columns, `columnSpacings = [10]`, `itemSpacing.x = 50`:

- last entry repeats (engine, `PosterGrid.resolveSpacingValue` → `values.at(-1)`) → width `300+10+10 = 320`
- falls back to `itemSpacing` (ArrayGrid reference) → width `300+10+50 = 360`

Engine reports **320**. Note this may legitimately differ from `LayoutGroup.itemSpacings`, which is
already device-confirmed to repeat its last entry — so "the other one repeats" is not evidence either
way, which is why this is measured rather than assumed.

The row axis is not discriminating here (2 rows = 1 gap, both readings agree); only the width matters.

### `R-rotation` — does an inherited rotation rotate a child's own translation?

Two **identical** hosts: a `Group` at `rotation = 90°` with a child translated `[100, 0]`. Only the
child's node type differs. In the engine `Group` does not rotate its own translation while `Rectangle`
does (`rotatesDrawTranslation()`), so the two rows disagree:

| Case | Engine | Meaning |
| --- | --- | --- |
| `group-child` | `{x=700 y=320}` | translation **not** rotated |
| `rectangle-child` | `{x=900 y=200}` | translation **rotated** |

**On a device these two rows should agree with each other.** Whichever value they agree on tells us
which of the engine's two behaviors is correct, and the other set of node types gets fixed. If they
disagree on hardware too, the split is real and needs recording as an invariant.

(Both hosts sit at the same y and are 300px apart horizontally, so the x offset is just the fixture
position — compare the *relationship* between each child and its own host, not the raw numbers.)

### `T-tracking` — does `clippingRect` participate in `renderTracking`?

`REFERENCES/scenegraph/layout-group-nodes/group.md:118-122`:

> "With respect to render tracking, although the node could be completely within the bounds of the
> specified `clippingRect`, its `renderTracking` field could be set to `"none"` if the portion of the
> `clippingRect` it occupies is completely offscreen."

`Group.updateRenderTracking` never reads `clippingRect` — it only intersects the node's own scene rect
with the screen.

| Case | Engine | Reference |
| --- | --- | --- |
| `inside-onscreen-clip` (control) | `full` | `full` |
| **`inside-offscreen-clip`** | **`full`** | **`none`** |
| `offscreen-no-clip` (control) | `none` | `none` |

The middle row is the divergence: the node itself is fully on screen, but the `clippingRect` containing
it is parked at `y = -4000`, so nothing it draws can be visible. Both controls must match between
device and engine — if they don't, the comparison is off rather than the behavior.

## Not covered here

**RowList item-cell clipping** (whether a RowList clips item components to their cell the way
`ArrayGrid.renderItemClipped` does) is *visual* — BrightScript cannot read pixels, and `boundingRect()`
is unaffected by clipping. It needs a screenshot: an item component with a child deliberately drawn past
the cell's right edge, on both a device and `brs-cli --image`. Worth folding into whichever probe session
also answers the `childRenderOrder` question from
[`docs/scenegraph-render-fields.md`](../../docs/scenegraph-render-fields.md), since that one is visual too.

**Scalar `color` coercion via `setValueSilent`** (left open in #1130) is **not** device-probeable:
`setValueSilent` is an engine-internal path with no BrightScript equivalent. From an app there is only
`node.color = "0x0D1117"`, which already works. It is an internal-consistency issue, to be settled by
reading the code rather than measuring hardware.
