# LayoutGroup `horizAlignment` / `vertAlignment` probe

Companion to [`layoutgroup-probe`](../layoutgroup-probe/), which measured `layoutDirection` on
hardware and found the engine had it wrong: the field is an **enum**, an unrecognized value is
**rejected** (reads back `""`), and that rejected state lays out **horizontally** — the opposite of
the documented `vert` default. That fix shipped in brs-engine PR #1122.

`horizAlignment` and `vertAlignment` are the same shape of field: a documented closed set of string
values (`left`/`center`/`right`/`custom`, `top`/`center`/`bottom`/`custom`). brs-engine currently
falls back to `left`/`top` for anything it doesn't recognize — an assumption that has not been
checked against a device, and that the `layoutDirection` result says not to trust.

## The two questions

1. **Storage** — is an unrecognized value stored verbatim, canonicalized to lowercase, or rejected
   to `""`? Is matching case-sensitive? Does an invalid write **clobber** an already-valid one? Is a
   value valid for the *sibling* field accepted (`horizAlignment="top"`)?
2. **Geometry** — what does the layout actually *do* for each value, including rejected ones, and
   for `custom` on the axis where Roku documents it as invalid?

## Method

Each case is a `LayoutGroup` holding two deliberately **different** children, plus a 2×2 marker
rectangle placed at exactly the group's translation:

```
child 0: 30 x  8, own translation [7, 13]
child 1: 50 x 16, own translation [11, 17]
itemSpacings: [4]
```

Offsets are measured as `child.sceneBoundingRect() − marker.sceneBoundingRect()`, so nothing depends
on how the device computes a LayoutGroup's *own* bounding rect. The children carry non-zero
translations of their own so a `custom` (unmanaged) axis is distinguishable from an aligned one.

Those offsets are then **classified** into the behavior the geometry demonstrates — `left`/`top`,
`center`, `right`/`bottom`, `custom`, or `other` — computed from the child sizes rather than
hard-coded. So each row reads as *"`centre` → stored `""` → behaves `left`"* with no coordinate
arithmetic required of the reader.

### Four case groups

Each field's meaning depends on `layoutDirection`: the field controlling the **layout axis** aligns
the run *as a whole* (primary), while the field controlling the other axis aligns **each child
independently** (cross). All four combinations are covered:

| | layoutDirection | field varied | axis |
| --- | --- | --- | --- |
| A | `vert` | `horizAlignment` | cross |
| B | `horiz` | `horizAlignment` | primary |
| C | `vert` | `vertAlignment` | primary |
| D | `horiz` | `vertAlignment` | cross |

12 spellings per group (48 cases): the documented values, case variants (`LEFT`, `Center`), a
plausible misspelling (`centre`), a plausible synonym (`middle`), the empty string, junk (`bogus`), a
value belonging to the **sibling** field (`top` in `horizAlignment`), and a `center` **then** `bogus`
double write to test clobbering.

`layoutDirection` itself is always set to a valid value here, so the enum behavior found by the other
probe cannot interfere.

## What the docs say

From `external/dev-doc/.../LayoutGroup.md`, alignment sets the LayoutGroup's **local coordinate
origin**:

- **cross axis** — `left`/`top` aligns those edges of each child at the origin; `center` aligns each
  child's center on the origin; `right`/`bottom` aligns those edges at the origin; `custom` means the
  app sets each child's translation on that axis.
- **primary axis** — the origin sits at the start / center / end of the whole run.
- `custom` is documented as valid **only on the cross axis**: "If the layoutDirection is `horiz`,
  custom is not a valid setting; `left` is used instead" (and the mirror for `vertAlignment`).

That documented `custom` fallback is itself worth confirming — it is exactly the kind of "invalid
value falls back to the default" claim that turned out to be wrong for `layoutDirection`.

## Running it

**On a Roku device** (developer mode enabled):

```bash
curl -f -u "rokudev:<devpassword>" -F "mysubmit=Install" \
  -F "archive=@/Users/marcelocabral/Projects/Samples/layoutalign-probe.zip" \
  "http://<roku-ip>/plugin_install"
```

Results render on screen (each row shows its own mini-layout beside its numbers) and print to the
console:

```bash
telnet <roku-ip> 8085
```

The probe re-runs three times, 1.2s apart, then stops.

**In the simulator**, for the side-by-side comparison:

```bash
brs-cli --root /Users/marcelocabral/Projects/Samples/layoutalign-probe
```

## Result

Run on hardware 2026-07-30, stable across all three passes. Two findings — one expected, one not.

### 1. Storage: the same rejecting enum as `layoutDirection`

| Written | Reads back |
| --- | --- |
| `left` / `center` / `right` / `custom` (and `top`/`bottom`) | verbatim |
| `LEFT`, `TOP`, `Center` | canonical lowercase — `"left"`, `"top"`, `"center"` |
| `centre`, `middle`, `bogus`, `""` | `""` (rejected) |
| a value valid for the **sibling** field (`horizAlignment="top"`) | `""` (rejected) |
| `center` then `bogus` | `""` — the invalid write **clobbers** the valid one |

So the two alignment fields do **not** share one value table, and near-misses get no leniency. The
engine stored everything verbatim and was wrong on all of these.

### 2. Geometry: a rejected CROSS-axis alignment collapses the whole layout

Valid values behaved exactly as documented, and exactly as the engine already had them — including
`custom` falling back to `left`/`top` on the primary axis. But look at the rejected rows in groups
**A** and **D** (where the varied field governs the *cross* axis):

```
A) layoutDirection=vert   horizAlignment (cross)
  left     "left"   left   c0=(0,0)   c1=(0,12)     <- normal: stacked 8+4 apart
  bogus    ""       left   c0=(0,0)   c1=(0,0)      <- both children ON the origin
```

A `left` fallback would still stack the children on the primary axis (`c1=(0,12)`). The device puts
**both at (0,0)** — it abandons the layout entirely: no stacking, no item spacing, and the children's
own translations (`[7,13]` and `[11,17]`) are discarded too. The primary-axis alignment is ignored
even though it is perfectly valid.

Groups **B** and **C**, where the varied field governs the *primary* axis, do **not** do this — a
rejected value there simply falls back to `left`/`top`. So the trigger is specifically a rejected
**cross-axis** alignment.

This looks like a device bug. brs-engine now reproduces it anyway (`collapseChildren`), on the
grounds that an app with a typo'd alignment piles its children on the origin on hardware — and a
simulator that quietly laid them out neatly would hide the breakage until it shipped.

**Verdict:** storage was wrong for every non-canonical value; geometry was right for all valid values
and wrong for the rejected cross-axis case. Fixed in `src/extensions/scenegraph/nodes/LayoutGroup.ts`
(`canonicalizeEnumField`, `isCrossAlignmentRejected`, `collapseChildren`), pinned by
`test/extensions/scenegraph/LayoutAlignment.test.js`. Re-running this channel under `brs-cli` after
the fix reproduces all 48 device rows exactly.

## brs-engine baseline BEFORE the fix (what was wrong)

Captured from `brs-cli` on `fix/layoutgroup-direction-enum` before the alignment work. Condensed:

| Spelling | Stored | A (vert/horiz cross) | B (horiz/horiz primary) | C (vert/vert primary) | D (horiz/vert cross) |
| --- | --- | --- | --- | --- | --- |
| `left` / `top` | verbatim | left | left | top | top |
| `center` | verbatim | center | center | center | center |
| `right` / `bottom` | verbatim | right | right | bottom | bottom |
| `custom` | verbatim | **custom** | left | top | **custom** |
| `LEFT` / `TOP` | verbatim | left | left | top | top |
| `Center` | verbatim | center | center | center | center |
| `centre` | verbatim | left | left | top | top |
| `middle` | verbatim | left | left | top | top |
| (empty) | `""` | left | left | top | top |
| `bogus` | verbatim | left | left | top | top |
| sibling value | verbatim | left | left | top | top |
| `center` then `bogus` | `"bogus"` | left | left | top | top |

So brs-engine today: **stores every string verbatim** (never canonicalizes, never rejects), matches
the documented values **case-insensitively**, falls back to **`left`/`top`** for everything else, and
honors `custom` only on the cross axis (matching the documented fallback).

Sample raw geometry (group A, `layoutDirection=vert`, cross axis) — this is what the classifier is
reading:

```
  spelling            stored        behavior    c0 offset      c1 offset
  left                "left"        left        (0,0)          (0,12)
  center              "center"      center      (-15,0)        (-25,12)
  right               "right"       right       (-30,0)        (-50,12)
  custom              "custom"      custom      (7,0)          (11,12)
```

## A note on the `behavior` column and the collapse

The classifier reports the collapsed rows as `left`/`top`, because both children sitting at the
origin *does* satisfy "start-aligned" on the measured axis. The collapse is only visible in the raw
`c1` offset — `(0,0)` where a real `left` gives `(0,12)`. That is why the raw offsets are printed
next to every verdict rather than the verdict alone: the classification is a convenience, the
coordinates are the evidence. Worth remembering if this channel is extended.

## Still unmeasured

- Both alignment fields rejected **at once** — the engine applies the cross-axis collapse, which is
  an extrapolation, not a measurement.
- The LayoutGroup's **own** bounding rect in the collapsed state. The engine reports the union of the
  children at the origin (max width × max height); the probe never read the group's own rect.
- `itemSpacings` and `addItemSpacingAfterChild` value handling (negative spacings, short arrays,
  non-numeric entries) — a third probe's worth of questions.
