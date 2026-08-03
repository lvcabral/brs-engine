# LayoutGroup `itemSpacings` / spacing-placement probe

Third in the series, and it closes the questions the first two left open.

- [`layoutgroup-probe`](../layoutgroup-probe/) — `layoutDirection` is a rejecting enum whose empty
  state lays out **horizontally** (brs-engine PR #1122).
- [`layoutalign-probe`](../layoutalign-probe/) — same storage rule for the alignment fields, plus the
  surprise that a rejected **cross-axis** alignment collapses every child onto the group origin.

Both of those ended with "still unmeasured" lists. This channel measures them.

## Section S — `itemSpacings` and where the space goes

The load-bearing question: **the engine repeats the last array entry for every gap past the end of
the array**, so `itemSpacings="[20]"` spaces every child by 20 no matter how many there are. That has
never been checked against a device, and apps write single-element arrays with many children all the
time. If hardware instead uses 0 once the array runs out, a great many layouts differ.

14 cases, three children of 30×10 with no translations of their own, so spacing is the only variable:

| Case | Asks |
| --- | --- |
| `[]`, `[0]` | baseline — no spacing |
| `[4]` | **short array** — is the last entry repeated, or is the rest 0? |
| `[4,9]` | exact fit for two gaps — which index maps to which gap? |
| `[4,9,15]`, `[4,9,15,20]` | **extra entries** — appended as trailing space (changing the group's own size), or ignored? |
| `[-6]` | negative — overlap, or clamped to 0? |
| `[2.5]` | fractional — honored, rounded, or truncated? |
| the same with `addItemSpacingAfterChild=false` | does the space go **before** each child, including the first — shifting the whole run? |
| `[4]`, `[4,9]` with `layoutDirection=vert` | is the index mapping the same on the other axis? |

Gaps are reported as the measured distance between consecutive children **minus** the child size, so
`0` means touching and a negative number means overlapping. `local` is the group's own
`localBoundingRect()`, which is where trailing space and run-shifting show up.

## Section R — rejected-value combinations

The engine currently **extrapolates** the cross-axis collapse to cases the alignment probe never
measured. Extrapolation is exactly what this series keeps proving wrong, so all eight combinations
are measured: each alignment field rejected alone, both rejected together, and a rejected
`layoutDirection` (which resolves to `horiz`, making `vertAlignment` the cross field) combined with
each.

## Section F — does a device LayoutGroup even *have* `width`/`height`?

Roku's reference does not declare `width`/`height` on `Group` or `LayoutGroup`, yet the engine writes
both on every layout so parent nodes can measure the group. If hardware has no such fields, an app
reading `lg.width` gets `invalid` on device and a number in the simulator — a silent behavioral
difference that would never show up as a crash. Probed with `hasField()` plus the values themselves.

## Running it

**On a Roku device** (developer mode enabled):

```bash
curl -f -u "rokudev:<devpassword>" -F "mysubmit=Install" \
  -F "archive=@/Users/marcelocabral/Projects/Samples/layoutspacing-probe.zip" \
  "http://<roku-ip>/plugin_install"
```

```bash
telnet <roku-ip> 8085
```

**In the simulator:**

```bash
brs-cli --root /Users/marcelocabral/Projects/Samples/layoutspacing-probe
```

## Result

Run on hardware 2026-07-30, stable across all three passes. **23 of the 24 output lines matched the
engine exactly.** The whole of Section S and the whole of Section R were already right — including
every rule that had only ever been an assumption:

- the **last entry repeats** for gaps past the end of the array (`[4]` → gaps `4,4`);
- entries past the last gap are **dropped**, adding no trailing space (`[4,9,15]` lays out exactly
  like `[4,9]`, same group rect);
- negative spacings **overlap**, fractional spacings are used **as-is**;
- `addItemSpacingAfterChild=false` inserts the space **before** each child including the first, so
  the run shifts by `spacings[0]` and gaps come from the *following* entries;
- and every rejected-value combination in Section R behaved as the engine extrapolated — the
  cross-axis collapse rule holds for both-rejected and for a rejected `layoutDirection` too.

The one divergence was **Section F**:

```
                        device                              engine (before)
  hasField(width)       false                               true
  hasField(height)      false                               true
  width / height        invalid / invalid                   98 / 10
  localBoundingRect()   (0,0,98,10)                         (0,0,98,10)
```

A real LayoutGroup has **no `width`/`height` fields at all** — only `localBoundingRect()` reports its
size. The engine published its measurement as real node fields, so an app reading `lg.width` got a
number in the simulator and `invalid` on hardware: a silent difference that never surfaces as a
crash, just as wrong layout in whatever the app computed from it.

**Fix:** the measurement moved to private `layoutWidth`/`layoutHeight`, surfaced by overriding
`getDimensions()` — which is what every internal measurement path already used. One caller was
reading the raw field instead (`StdDlgCustomItem.measureContentHeight`) and would have sized a dialog
to 0 around a LayoutGroup; it now uses `getDimensions()` too. Pinned by
`test/extensions/scenegraph/LayoutSpacing.test.js` and the field-absence cases in
`LayoutAlignment.test.js`.

After the fix, this channel's engine output reproduces all 24 device lines exactly.

## brs-engine baseline BEFORE the fix

Captured from `brs-cli` on `fix/layoutgroup-direction-enum` before the section-F work. Only the last
two lines differ from the device.

```
S)  itemSpacings   (layoutDirection=horiz unless noted)
  case                    c0       gaps          local rect
  [] (default)            (0,0)    0,0           (0,0,90,10)
  [0]                     (0,0)    0,0           (0,0,90,10)
  [4]  <- short           (0,0)    4,4           (0,0,98,10)
  [4,9]  <- exact         (0,0)    4,9           (0,0,103,10)
  [4,9,15]  <- extra      (0,0)    4,9           (0,0,103,10)
  [4,9,15,20]             (0,0)    4,9           (0,0,103,10)
  [-6]  <- negative       (0,0)    -6,-6         (0,0,78,10)
  [2.5]  <- fraction      (0,0)    2.5,2.5       (0,0,95,10)
  [] addAfter=false       (0,0)    0,0           (0,0,90,10)
  [4] addAfter=false      (4,0)    4,4           (4,0,98,10)
  [4,9] addAfter=false    (4,0)    9,9           (4,0,108,10)
  [4,9,15] addAft=false   (4,0)    9,15          (4,0,114,10)
  [4] vert                (0,0)    4,4           (0,0,30,38)
  [4,9] vert              (0,0)    4,9           (0,0,30,43)

R)  rejected-value combinations   (itemSpacings [4])
  case                    c0       c1       c2       local rect
  vert  h=bogus           (0,0)    (0,0)    (0,0)    (0,0,30,10)
  vert  v=bogus           (0,0)    (0,14)   (0,28)   (0,0,30,38)
  vert  both bogus        (0,0)    (0,0)    (0,0)    (0,0,30,10)
  horiz h=bogus           (0,0)    (34,0)   (68,0)   (0,0,98,10)
  horiz v=bogus           (0,0)    (0,0)    (0,0)    (0,0,30,10)
  horiz both bogus        (0,0)    (0,0)    (0,0)    (0,0,30,10)
  dir=bogus  v=bogus      (0,0)    (0,0)    (0,0)    (0,0,30,10)
  dir=bogus  h=bogus      (0,0)    (34,0)   (68,0)   (0,0,98,10)

F)  width/height fields on a LayoutGroup
  hasField(width)=true  hasField(height)=true
  width=98  height=10  local=(0,0,98,10)
```

So brs-engine today:

- **repeats the last spacing** for every gap past the end of the array (`[4]` → gaps 4,4);
- **ignores extra entries** — `[4,9,15]` gives gaps 4,9 with no trailing space, same rect as `[4,9]`;
- honors **negative** spacing as overlap and **fractional** spacing exactly;
- with `addItemSpacingAfterChild=false`, inserts the space **before** each child including the first,
  so the run shifts by `spacings[0]` and the gaps come from the *following* indices (`[4,9]` → c0 at
  4, gaps 9,9);
- uses the same index mapping for `vert`;
- collapses on a rejected cross-axis alignment in every combination, including both-rejected and the
  rejected-`layoutDirection` cases (this is the extrapolation to check);
- **declares `width` and `height`** on a LayoutGroup and keeps them in sync with the layout.

## Series conclusion

Three probes, 94 measured cases, four engine bugs found:

| Probe | Cases | Found |
| --- | --- | --- |
| `layoutgroup-probe` | 22 | `layoutDirection` is a rejecting enum; its empty state lays out **horizontally**, not `vert` |
| `layoutalign-probe` | 48 | same storage rule for the alignment fields; a rejected **cross-axis** alignment **collapses** every child onto the origin |
| `layoutspacing-probe` | 24 | a LayoutGroup has **no `width`/`height` fields** |

The pattern worth keeping: in all three cases the engine's *reasonable* reading — "an unrecognized
value falls back to the documented default", "a group that reports a size must have size fields" —
was the wrong one, and the parts everyone would have called risky assumptions (repeating the last
spacing entry, the exact `custom` fallback, before-vs-after spacing placement) turned out to be
right. Measuring beats reasoning about the docs, and it is cheap: each probe took one channel and one
paste of a telnet log.

## Still unmeasured

- Whether other node types invent fields the device lacks the way LayoutGroup did — `Group` itself is
  the obvious next candidate, since the engine writes `width`/`height` on several nodes that Roku
  documents without them.
- `itemSpacings` entries that are not numbers (the field is a `floatarray`, so this is really a
  field-coercion question, not a layout one).
