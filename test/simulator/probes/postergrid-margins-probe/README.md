# PosterGrid margins / caption-placement probe

Settles the four `PosterGrid` values that the earlier
[caption-zone probe](../postergrid-captions-probe/README.md) left as **inferences rather than
measurements**, even though its 88 readings reproduced the device exactly. That probe only ever printed
`boundingRect().height`, so anything that is not a height rode along unmeasured:

| # | value | status after the captions probe | why it is open |
| --- | --- | --- | --- |
| 1 | FHD vertical split: `rectMargins().y = 21` / `rectMarginBottom() = 75` | inferred | only the **sum** (96) is measured. Any split summing to 96 keeps every FHD *height* correct and moves every *y*. |
| 2 | FHD horizontal outset: `rectMargins().x = 21` | never measured | the captions probe printed neither `x` nor `width`, at either resolution. |
| 3 | `CaptionTextOffset = 12` | inferred | the zone's **size** (23) is device-measured; how it divides above/below the text is not. `12` is `round(23/2)`. |
| 4 | the `caption2` default font | inferred | from two per-line increments (20/29 defaulted vs 21/31, but *equal* when both set explicitly), not from a measured font identity. |

**Candidate models are pre-registered below, BEFORE the run**, and stay here after they lose — the same
discipline that killed all six hypotheses in the captions probe and made that outcome auditable. Do not
read the results first and then pick a model.

## Design: three values are numeric, one is not

Values 1, 2 and 4 are readable over telnet. Value 3 is **not**, and no amount of care with
`boundingRect` will change that: on a device the caption `Label` lives inside an internal item
component, and `ArrayGrid.resolveSubpart` maps an item sub-rect to the item component itself, so neither
`findNode` nor `localSubBoundingRect` can reach the Label. A screenshot is the only route.

So the probe has three groups:

| group | reads | settles |
| --- | --- | --- |
| **M** (6 cases) | full rect — `x`, `y`, `width`, `height` | 1 and 2 |
| **N** (5 cases) | heights, plus the device's own `Label` line heights | 4 |
| **P** (4 columns, left on screen) | a **screenshot** | 3 |

Group M prints every rect in full and `printSummary` re-lists each as **per-side outsets**, derived from
that case's own declared inputs. Do **not** difference row counts the way the captions probe did:
differencing is exactly what cancelled the outsets, and the outsets are the subject this time.

### Group P is read by subtraction, never by judging alignment

Each pair is a real `PosterGrid` cell beside a hand-built reconstruction of the same cell — identical
poster bitmap, font, text, box width, box height, `vertAlign` and `lineSpacing` — differing *only* in
that the reconstruction's caption box sits at a known offset of exactly **0** below the poster's bottom
edge. Then:

```
CaptionTextOffset = firstInkedRow(real column) - firstInkedRow(offset-0 reconstruction)
```

The unknown "where does ink sit inside its own line box" term is identical on both sides and cancels, as
does anti-aliasing. That term is the one thing a screenshot cannot otherwise reveal, and it is precisely
what an eyeballed ladder of candidate offsets would be guessing at. Captions are drawn **pure red** on
deliberately red-free grey posters, so locating ink is a channel test rather than a visual judgement.

Two pairs, on purpose: P1/P2 use `caption1` alone, P3/P4 stack `caption1` + `caption2`. **Both pairs must
agree.** If they do not, the offset depends on how many caption blocks are present and a single
`CaptionTextOffset` constant cannot express the device's behavior — a finding, not a decode error.

The 1px green rule along the posters' bottom edges is a **registration mark only** — the decoder reports
it so a reader can confirm from the screenshot alone that all four posters were flush. The answer does
not depend on it.

Three things the fixture learned the hard way and now guards:

- Stacked single-line captions are used instead of `caption1NumLines = 2`, because a wrapped 2-line
  caption needs text narrower than the poster at **both** resolutions, and a 5-glyph word is not — it
  ellipsized at FHD and silently turned P4 into a 1-line column.
- Every reconstruction Label checks `isTextEllipsized` and prints `!! WARNING: ... group P INVALID`.
  **A run with any WARNING line is void**, however plausible its numbers look.
- `captionBackgroundBitmapUri` is pointed at a fully transparent 9x9 PNG. `showBackgroundForEmptyCaptions
  = false` is **not** sufficient: these cells do have caption text, so the default
  `common:/images/<res>/caption_background.9.png` still draws a black band behind the real column's
  glyphs that the reconstruction — drawn straight onto the scene — does not have. Anti-aliased red edges
  then cross the decoder's threshold at a different alpha on each side, biasing the first inked row by up
  to a pixel. This subtraction has to separate 12 from 11 (T1 from T3), so both sides must render over
  the same backdrop. Caught by *looking at* `engine-shot-hd.png`, not by reading the decoder's output —
  the engine's numbers were unaffected, but a device's antialiasing need not be.

## Running it

From the repo root, build one zip per resolution into gitignored `out/` (the `.zip`s are build artifacts
and are not tracked):

```bash
cd test/simulator/probes/postergrid-margins-probe
zip -r ../../../../out/postergrid-margins-probe-hd.zip manifest source components images
cp manifest manifest-hd && cp manifest-fhd manifest
zip -r ../../../../out/postergrid-margins-probe-fhd.zip manifest source components images
cp manifest-hd manifest && rm manifest-hd
```

Sideload each zip and capture the telnet output (port 8085) for groups M and N. Unlike the captions
probe, **this app does not close its screen when it finishes printing** — group P stays on screen to be
photographed. Take the device screenshot from the dev console
(`http://<device>/plugin_inspect` → *Screenshot*) while it is up, then exit with Back/Home.

Then decode group P:

```bash
node test/simulator/probes/postergrid-margins-probe/decode-caption-offset.js <shot.png> [--design=1920]
```

`--design` is the **app's** width, not the image's. A Roku device's screenshot utility captures HD
(1280x720) even for an FHD app, so:

| capture | invocation | scale |
| --- | --- | --- |
| HD app, engine or device | (default) | 1 |
| FHD app, engine `--snapshot` (1920 wide) | `--design=1920` | 1 |
| FHD app, **device** screenshot (1280 wide) | `--design=1920` | 0.667 |

The decoder prints the scale it used and the raw row indices, so a wrong scale is visible rather than
silent.

### Engine side

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-margins-probe \
    --snapshot /tmp/margins-hd.png --log /tmp/eng-hd.txt
```

Ctrl+S takes the snapshot and needs a TTY, so under automation drive it through `script -q` with raw
control bytes (`0x13` = Ctrl+S, `0x04` = Ctrl+D) rather than a plain pipe.

## Pre-registered candidate models

### 1. The FHD vertical split (group M, case M1)

Measured already: HD is **14 top / 50 bottom**, and the FHD **sum is 96**. So the sum scales exactly
1.5×; only the split is open. Every candidate below sums to 96 and is therefore invisible to every
reading the captions probe took.

| | predicts M1 FHD | rationale |
| --- | --- | --- |
| **S1 — both scale 1.5×: 21 / 75** | `y = -21`, `h = 196` | the engine's current inference; the plainest reading. |
| **S2 — the top does not scale: 14 / 82** | `y = -14`, `h = 196` | not far-fetched: `CaptionZoneBase = 23` is device-measured as identical at both resolutions, so this node already has one non-scaling constant. |
| **S3 — the top scales, the top→bottom *difference* does not: 30 / 66** | `y = -30`, `h = 196` | HD bottom = top + 36. If that 36 is the non-scaling part instead, the split lands here. |
| **S4 — the split is not a constant** | M1–M6 disagree with each other | if the bottom outset tracked the poster, the row count or the item spacing, M3/M5/M6 would break constancy. Registered so a non-constant result is a recognised outcome rather than a confusing one. |

M2 (`translation=[300,200]`) is the control that proves the outset is a margin and not a coordinate-space
artifact; M3–M6 vary rows, columns, poster size and item spacing, so each holds the outset fixed against
a different axis. **HD is re-measured too** — S1–S3 all reproduce the known HD 14/50, so an HD run that
disagrees invalidates the fixture rather than the model.

### 2. The FHD horizontal outset (group M, all cases)

HD `left = right = 14`, measured here for the first time as well.

| | predicts M1 FHD | rationale |
| --- | --- | --- |
| **X1 — 21, equal to the top outset** | `x = -21`, `w = 142` | the engine's inference: one `rectMargins()` value per axis, both 21. |
| **X2 — 14, non-scaling** | `x = -14`, `w = 128` | same reasoning as S2. |
| **X3 — scales, but not to the same value as the top** | `x` ≠ `y` | would need a second FHD constant; `rectMargins()` already returns `{x, y}` separately, so the engine can express it. |
| **X4 — asymmetric on X** | `right ≠ left` | Y is already asymmetric (14 vs 50), so X might be too. This is what `printSummary`'s separate `left`/`right` columns exist to catch — a `width`-only reading could not. |

### 3. `CaptionTextOffset` (group P)

The zone is 23 tall (device-measured, same at both resolutions). Where inside it the text starts:

| | predicts | rationale |
| --- | --- | --- |
| **T1 — 12** | both pairs `12` at both resolutions | the engine's value, `round(23/2)`: the zone splits evenly, rounded up because `23/2` would put a baseline on a half-pixel. |
| **T2 — 0** | both pairs `0` | the text starts immediately below the poster and all 23 sits underneath. |
| **T3 — 11** | both pairs `11` | `floor(23/2)`: an even split rounded the other way. Distinguished from T1 by 1px, which is exactly why the method must be subtraction and not eyeballing. |
| **T4 — scales with resolution** | HD ≠ FHD after scaling | would contradict the non-scaling 23 it divides, so it is worth stating as a distinct outcome rather than assuming it away. |
| **T5 — depends on block count** | P1−P2 ≠ P3−P4 | a single constant cannot express it. The second pair exists only to test this. |

### 4. The `caption2` default font (group N)

`SmallerSystemFont` and `SmallerBoldSystemFont` are the **same point size** (20 HD / 30 FHD in
`system-fonts.json`) and differ only in weight. That is what makes the question decidable by height
alone:

| | reading | conclusion |
| --- | --- | --- |
| **F1 — the default is the non-bold face** | `N1 == N2` and `N1 != N3` | confirms the captions probe's inference; the engine's `caption2Font` default (`font:SmallerBoldSystemFont`) is wrong. |
| **F2 — the default is bold** | `N1 == N3` | the inference is wrong and the 20/29-vs-21/31 gap has some other cause entirely. |
| **F3 — the default is a third font** | `N1` differs from both | needs its own identification pass. |

`printFontHeights` gives an independent cross-check that does not depend on N at all: the captions probe
measured caption1's per-line cost at **21 HD / 31 FHD** and defaulted caption2's at **20 HD / 29 FHD**.
If the device's `Label` height for `SmallerBoldSystemFont` is 21/31 and for `SmallerSystemFont` is 20/29,
then each caption's per-line term is exactly its font's real line height and F1 follows from the font
metrics alone. That would also quantify the separate, still-open
`RoFont.measureTextHeight` shortfall (the engine returns the point size, 20/30).

## Engine-side baseline (already captured)

Both resolutions run clean under `brs-cli`: **0 warnings, 0 errors**, rule row found, both group-P pairs
agreeing. Captured in `engine-trace-{hd,fhd}.txt`, with the group-P frames in
`engine-shot-{hd,fhd}.png` — those are checked in so the device's screenshot can be compared against a
known-good layout rather than against a description of one. This column is **not** evidence for any
candidate — for values 1–3 it is the engine
reproducing its own inferred constants, which is circular by construction. Its purpose is different and
worth stating plainly: it proves the **fixture and the decoder work**, and it is the column the device's
numbers get diffed against.

| | engine HD | engine FHD | device HD | device FHD |
| --- | --- | --- | --- | --- |
| M1 rect | `x=-14 y=-14 w=128 h=164` | `x=-21 y=-21 w=142 h=196` | ? | ? |
| M1–M6 per-side outsets | left/top/right **14**, bottom **50** | left/top/right **21**, bottom **75** | ? (HD 14/50 known) | ? |
| N1 defaulted caption2 | 207 | 249 | ? | ? |
| N2 caption2 = non-bold | 207 | 249 | ? | ? |
| N3 caption2 = bold | 207 | 249 | ? | ? |
| N4/N5 caption1 anchors | 207 | 249 | ? | ? |
| `Label` height Smaller / SmallerBold | 20 / 20 | 30 / 30 | ? | ? |
| `Label` height Medium / MediumBold | 24 / 24 | 36 / 36 | ? | ? |
| group P, caption1 only | 12 | 12 | ? | ? |
| group P, caption1+caption2 | 12 | 12 | ? | ? |

N1–N5 are **all identical** under the engine, at both resolutions. That is not a null result — it *is*
the divergence: the engine defaults both caption fonts to `SmallerBoldSystemFont` and its `Label` heights
are the font's point size, so it cannot tell the non-bold face from the bold one. Any device run where
N1, N2 and N3 are not all equal settles value 4 immediately.

### The group-P method was mutation-tested

A decoder that prints the expected number is worth nothing until it is shown to be reading the constant
rather than a coincidence. `CaptionTextOffset` was temporarily edited in
`src/extensions/scenegraph/nodes/PosterGrid.ts` and the engine rebuilt:

| mutation | decoder output (both pairs) |
| --- | --- |
| none | 12 / 12 |
| `CaptionTextOffset = 20` | **20 / 20** — tracks the constant |
| `startY + (caption1Lines > 1 ? 4 : CaptionTextOffset)` | **12 / 4** — pairs disagree, exactly as T5 predicts |

So the reading follows the real constant, and a block-count-dependent offset would be **caught** rather
than averaged into a plausible single number. The source was restored with `git checkout` afterwards.

## RESULT (device: Streaming Stick, Roku OS 15.2, HD and FHD)

**Two of the four values were wrong in the engine, and a fifth finding fell out of the run.**

| value | candidate that won | engine before | verdict |
| --- | --- | --- | --- |
| 1. FHD vertical split | **S1** (both scale 1.5× → 21 / 75) | 21 / 75 | ✅ correct, now measured rather than inferred |
| 2. FHD horizontal outset | **X1** (21, equal to the top) | 21 | ✅ correct, and `left == right == top` confirmed |
| 3. `CaptionTextOffset` | **T2** (0) | 12 | ❌ **wrong** — fixed |
| 4. `caption2` default font | **F2** (the default IS bold) | bold | ✅ engine correct; the captions probe's inference was wrong |

**Value 1/2 — S1 and X1 win.** M1 read `x=-21 y=-21 w=142 h=196` at FHD, killing S2/X2 (non-scaling) and
S3 (30/66) directly, since those move `y` while keeping `h = 196`. M1–M6 agree on all four sides, so S4
(non-constant) is out too, and X4 is out because `left == right` in every case. The two axes are now
measured independently — the captions probe had only ever pinned the vertical **sum**.

**Value 3 — T2 wins: the offset is 0.** Both group-P pairs differenced to **0** at both resolutions, with
two caption-block counts. So the text starts immediately below the poster and the whole 23px
`CaptionZoneBase` sits **below** it, rather than being split around it. T1 (12, the engine's value) and T3
(11) are both dead, and T5 is out because the two pairs agree. Note this could not have been measured with
a rect: a caption `Label` lives inside an internal item component and `ArrayGrid.resolveSubpart` maps an
item sub-rect to that component, so no `findNode`/`localSubBoundingRect` path reaches it — hence the
screenshot subtraction, [mutation-tested](#the-group-p-method-was-mutation-tested) beforehand.

**Value 4 — F2 wins, reversing the captions probe's inference.** N1 == N2 == N3 on device. Since
`SmallerSystemFont` and `SmallerBoldSystemFont` are the same point size, N2 == N3 means this probe
*cannot* distinguish bold from non-bold by height — so the earlier "caption2 defaults to the non-bold
face" reading has no support, and the engine's `font:SmallerBoldSystemFont` default stands. The
20/29-vs-21/31 gap that prompted the inference is fully explained by the separate `measureTextHeight`
shortfall: the device's `Label` heights came back **21/26 HD, 31/38 FHD** where the engine returns the
font's point size (20/24, 30/36). **No engine change for value 4**; the line-height shortfall is
engine-wide (it moves every `Label`, not just a caption) and gets its own PR.

**Fifth finding — case M4 diverged, and this probe could not explain it.** M4 (3 columns × 1 row) reported
the plain symmetric **14** at the bottom where M1/M2/M3/M5/M6 all reported 50. M4 was the only
multi-column case *and* the only one whose content was wider than tall, so column count, content shape,
total width and items-per-row all predicted it equally. That confound is what
[`postergrid-outset-axis-probe`](../postergrid-outset-axis-probe/README.md) was built for; it measured the
rule as a conjunction (`rows == 1 && numColumns > 1`).

### Incidental notes from the device captures

- The device draws the 1px green registration rule **anti-aliased across two rows** at partial intensity
  and a varying blend (HD row 360 ranges over `g = 40..190`, with r and b lifted alongside it:
  `[36,114,55]`, `[85,198,96]`) where the engine writes one clean `[0,255,0]` row. The decoder's original
  absolute `g > 150` test therefore reported NOT FOUND on both device shots — for a rule that was in fact
  drawn correctly. **Fixed**: the test is now dominance by a fixed margin (`g > 40 && g > r+15 &&
  g > b+15`), which catches every blend without firing on the grey poster (`r == g == b`). A `g > 2r &&
  g > 2b` ratio was tried first and still missed half the row. All four captures now report a rule row
  (engine 360/360, device 360 HD / 359 FHD — the 1px difference is which anti-aliased row crosses first),
  and every group-P reading is unchanged. This was only ever a cross-check; the subtraction does not
  depend on it.
- The device's HD poster measured **99** rows tall where FHD and the engine give 100 — sub-pixel rounding
  in the device's HD scaler. It cancels in the subtraction, since P1 and P2 share it.

## Fixed as a result

`CaptionTextOffset` 12 → **0** in `src/extensions/scenegraph/nodes/PosterGrid.ts`, and the `rectMargins`
docstring upgraded from a one-axis inference to a both-axes measurement. Regression coverage for the
placement is in `test/extensions/scenegraph/PosterGridExtent.test.js` ("caption text is placed inside the
zone that was reserved").
