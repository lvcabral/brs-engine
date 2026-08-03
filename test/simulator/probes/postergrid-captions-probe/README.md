# PosterGrid caption-zone probe

Measures how much vertical space a real device reserves per `PosterGrid` cell for captions.
Unblocked the "Still divergent — the caption zone" note in
`.claude/docs/scenegraph-invariants.md` (PR #1139).

**RUN AND DECODED** — see [RESULT](#result--measured-on-device-both-resolutions) at the bottom, and the
captured output in `device-trace-{hd,fhd}.txt` / `engine-trace-{hd,fhd}.txt`. Everything from here to
that section is the **pre-run** record, left verbatim on purpose: the point of pre-registering models is
that it stays auditable afterwards, including the part where all six candidates lost.

**Candidate models are pre-registered below, BEFORE the run.** That discipline is what caught the
`columnWidths`-ignored asymmetry in the earlier probes and what killed the
`showBackgroundForEmptyCaptions` hypothesis. Do not read the results first and then pick a model.

## What was already known, before the run

| | device (HD) | engine (HD) |
| --- | --- | --- |
| 100-tall poster, `caption1NumLines = 0` | cell 136 (**+36**) | cell 100 (+0) |
| 100-tall poster, `caption1NumLines = 1` | cell 168 (**+32**/line) | cell 144 (+44) |

So the engine is **36 short** with no captions and **12 too tall** per line. Two data points
cannot distinguish a base-zone-plus-per-line model from a font-metric-driven or
different-multiplier one, and FHD is entirely unmeasured. Ruled out already:
`showBackgroundForEmptyCaptions = false` changed nothing on device.

> Both framings in this section turned out to be **wrong**, which is the point of writing them down: the
> "+36 with no captions" is not a caption zone at all, and `computeCaptionMetrics` was only half the
> story. See [RESULT](#result--measured-on-device-both-resolutions).

Engine side, the zone came from `computeCaptionMetrics` in `src/extensions/scenegraph/nodes/PosterGrid.ts`
(pre-fix):

```
height_n        = measureFontHeight(font_n) * lines_n + lineSpacing * (lines_n - 1)
textHeight      = height1 + height2 + (both blocks present ? lineSpacing : 0)
verticalMargins = (any lines ? captionVerticalMargin * 2 : 0)     # 12 HD / 18 FHD
totalHeight     = textHeight + verticalMargins
```

`measureFontHeight` falls back to 24 HD / 36 FHD; the default `caption1Font` is
`font:SmallerBoldSystemFont` (20pt HD / 30pt FHD).

## Running it

From the repo root, build one zip per resolution into gitignored `out/` (the `.zip`s are build
artifacts and are not tracked):

```bash
cd test/simulator/probes/postergrid-captions-probe
zip -r ../../../../out/postergrid-captions-probe-hd.zip manifest source components
# FHD run: swap the manifest
cp manifest manifest-hd && cp manifest-fhd manifest
zip -r ../../../../out/postergrid-captions-probe-fhd.zip manifest source components
cp manifest-hd manifest && rm manifest-hd
```

Sideload each zip to the device and capture the telnet output (port 8085). Run the **same** zip
under the engine for the engine-side column:

```bash
node packages/node/bin/brs.cli.js out/postergrid-captions-probe-hd.zip
```

The four captures from the decoding run are checked in next to this file:
`device-trace-{hd,fhd}.txt` and `engine-trace-{hd,fhd}.txt` (the latter taken **after** the fix, so the
zero-caption cases match the device exactly and the remainder is the font-metric residual).

## How to read the output

Every case prints `h1` (1 row), `h2` (2 rows) and `CELL = h2 - h1`. **Read `CELL`, not `h1`.**
Differencing the row counts cancels the grid's own reported outset (`rectMargins`, HD 14) and the
trailing-gap rule — both already measured, neither the subject here. `printSummary` then re-lists
every `CELL` against the case-0 baseline so the increments read off directly, and
`printFontHeights` prints the device's own `Label` line height for each font used, so a
font-metric model can be checked against real metrics instead of assumed ones.

Every case isolates **one** unknown. Poster is 100x100, `itemSpacing = [0,0]`, `numColumns = 1`
throughout (except case G, which varies the poster deliberately).

## Cases and what each one decides

| case | varies | decides |
| --- | --- | --- |
| 0 | nothing | re-confirms the +36 baseline; anchors everything else |
| A1–A2 | `captionVertAlignment` = center / above | **is the +36 a caption zone at all?** center/top/bottom draw over the poster, so no zone is needed. `CELL` still 136 ⇒ it is cell padding, not a caption zone, and the fix is in cell-height arithmetic, not `computeCaptionMetrics` |
| B1–B3 | `caption1NumLines` = 1, 2, 3 | separates a base zone from a per-line height — 2 points can't, 4 can |
| C1–C2 | same, with no `shortDescriptionLine*` | is reservation **declared** (`caption1NumLines`) or **content-driven**? The engine only reads the field |
| D1–D4 | `caption2NumLines` alone, and both blocks | does caption2 cost the same as caption1, and does stacking cost exactly the sum or add an unmodelled gap? |
| E1–E3 | `captionLineSpacing = 20` | per **gap** (engine: `n-1` within a block, once between blocks) or per **line**? E1 is a single line, so it must be unaffected if the engine's model is right |
| F1–F4 | `caption1Font` / `caption2Font` (Largest = 3x default, Tiny) | is the zone font-metric-driven or a constant? Compare against the printed `Label` heights |
| G1–G3 | `basePosterSize` 200x200, 100x300 | is the base zone flat or **poster-relative**? If relative, that is a new axis and its own follow-up |
| — | FHD manifest | PosterGrid's `rectMargins` turned out resolution-specific (14 HD; the 21 FHD is an *inference*, not a measurement), so assume **no** scaling until measured |

## Pre-registered candidate models

Written before the run. `L` = per-line height, `S` = `captionLineSpacing`, `M` =
`captionVerticalMargin` (12 HD / 18 FHD), `F` = the caption font's line height.

**H1 — flat base zone, always present.** `zone = 36 + 32 * lines`.
Predicts `CELL(0)=136`, `CELL(1)=168`, `CELL(2)=200`, `CELL(3)=232`; B-differences constant at 32;
A1/A2 unchanged at 136; F1–F4 unchanged (font-independent); G1 `CELL=236`, G3 `CELL=336`.
Engine fix: add a flat base term to `totalHeight` that does **not** depend on `lines > 0`, and drop
`measureFontHeight` in favour of 32. A flat `+36` alone would over-correct the one-caption case.

**H2 — base zone plus font-metric lines.** `zone = 36 + (F + something) * lines`.
Same as H1 for the default font, but F1/F2 (`LargestSystemFont`, 3x) grow and F3 (`Tiny`) shrinks.
Distinguished from H1 **only** by case F. Engine fix: keep `measureFontHeight` but correct its
per-line constant and add the unconditional base.

**H3 — the +36 is cell padding, not a caption zone.** Some fixed vertical padding is added to every
cell regardless of captions. Predicts A1/A2 also `136` (a center-aligned caption needs no zone) and
`CELL(1) = 136 + one line`. Distinguished from H1/H2 **only** by case A. Engine fix moves out of
`computeCaptionMetrics` entirely into the row-height arithmetic in `renderContent`.

**H4 — content-driven reservation.** The zone appears only when the ContentNode actually carries
caption text. Predicts C1/C2 collapse toward the baseline while B1/B2 do not. Would make
`resolveCaptionLines` the wrong input (it reads the field, never the content).

**H5 — poster-relative base.** `base = k * basePosterSize.y` (e.g. `k = 0.36`).
Predicts G1 `CELL = 200 + 72` and G3 `CELL = 300 + 108`, versus H1's `+36` flat. New axis;
would need its own follow-up before any fix lands.

**H6 — `2*M` is right but the base is on top.** `zone = base + 2*M + L*lines`, i.e. the engine's
`verticalMargins` term is correct and only unconditional. Predicts E1 unchanged and the B-differences
equal to `L` exactly, with `CELL(1) - CELL(0)` also equal to `L` (no extra `2*M` step at the
0→1 boundary). If instead `CELL(1) - CELL(0) > CELL(2) - CELL(1)`, the margins **are** gated on
`lines > 0` as the engine has them, and only the base is missing.

## Engine-side baseline (already captured)

Both zips run clean under `brs-cli` today, so only the **device** column is missing. `CELL` here, with
the device's two known HD readings alongside:

| case | engine HD | device HD | engine FHD | device FHD |
| --- | --- | --- | --- | --- |
| 0. baseline | 100 | **136** | 100 | ? |
| A1. vertAlignment=center | 100 | ? | 100 | ? |
| A2. vertAlignment=above | 100 | ? | 100 | ? |
| B1. caption1=1 | 144 | **168** | 166 | ? |
| B2. caption1=2 | 164 | ? | 196 | ? |
| B3. caption1=3 | 184 | ? | 226 | ? |
| C1. caption1=1, no text | 144 | ? | 166 | ? |
| C2. caption1=2, no text | 164 | ? | 196 | ? |
| D1. caption2=1 only | 144 | ? | 166 | ? |
| D2. caption2=2 only | 164 | ? | 196 | ? |
| D3. caption1=1 + caption2=1 | 164 | ? | 196 | ? |
| D4. caption1=2 + caption2=2 | 204 | ? | 256 | ? |
| E1. caption1=1, lineSpacing=20 | 144 | ? | 166 | ? |
| E2. caption1=2, lineSpacing=20 | 184 | ? | 216 | ? |
| E3. 1+1, lineSpacing=20 | 184 | ? | 216 | ? |
| F1. caption1=1, Largest | 184 | ? | 226 | ? |
| F2. caption1=2, Largest | 244 | ? | 316 | ? |
| F3. caption1=1, Tiny | 140 | ? | 160 | ? |
| F4. 1+1, caption2=Largest | 204 | ? | 256 | ? |
| G1. baseline, poster 200 | 200 | ? | 200 | ? |
| G2. caption1=1, poster 200 | 244 | ? | 266 | ? |
| G3. baseline, poster 300 tall | 300 | ? | 300 | ? |

Engine `Label` line heights: HD 20 / 60 / 16 and FHD 30 / 90 / 24 for
SmallerBold / Largest / Tiny — exactly the `system-fonts.json` point sizes, so the engine's per-line
term currently **is** the font size, and `measureFontHeight`'s 24/36 fallback never fires for a named
font. Decoding the engine column against `computeCaptionMetrics`:

- **B**: `zone = 20*n + 2*12` HD (`30*n + 2*18` FHD) — increments of exactly one font size, plus a
  one-off `2*captionVerticalMargin` at the 0→1 boundary (44 then +20 then +20).
- **A**: `captionVertAlignment` does **not** change the reserved height. The engine gates the zone on
  `requiresCaptionZone` for *placement*, but the row height still comes from `computeCaptionMetrics`
  regardless, so it reserves for an overlaid caption too. If the device differs, that is a second bug.
- **C**: identical to B — reservation is declared, never content-driven.
- **D**: caption2 costs the same as caption1 (`164` = `20*2 + 24`, one shared margin pair, no gap).
- **E**: `lineSpacing` is per *gap* — E1 unchanged, E2 `+20`, E3 `+20` between the two blocks.
- **F/G**: font-driven (`184 = 60 + 24`), poster-independent (`G1/G3` track the poster exactly).

So HD is short by **36** at n=0 and by **24** at n=1, and every hypothesis below now has a concrete
engine number to be measured against.

## RESULT — measured on device, both resolutions

**None of H1–H6 won. All six were wrong in the same way: there is no base caption zone.** The +36 is
the grid's own **bottom** outset, i.e. `rectMargins` is asymmetric on Y. Model, reproducing **all 88
readings exactly** (22 cases × 2 row counts × 2 resolutions, zero mismatches):

```
height = rows * (posterHeight + captionZone) + rowSpacing terms + topOutset + bottomOutset
captionZone = 0 if (caption1NumLines + caption2NumLines) == 0
            = 23 + Σ lineHeight(font_i) * lines_i + captionLineSpacing * gaps
gaps        = max(0, lines1-1) + max(0, lines2-1) + (both blocks present ? 1 : 0)
```

| | device HD | device FHD | engine now |
| --- | --- | --- | --- |
| top outset | 14 | 21 | 14 / 21 ✅ |
| **bottom outset** | **50** | **75** | 14 / 21 ❌ |
| caption base | 23 | **23** (no scaling) | 24 / 36 |
| per line | `lineHeight(font)` | same | font point size (1–2px short) |

Which case killed what:

- **Case 0 + A1/A2** killed H1, H2, H4 and H6 outright: the +36 is present with
  `caption1NumLines = 0` *and* unchanged when the caption is drawn over the poster
  (`captionVertAlignment` center/above), where no zone is needed at all. H3 ("cell padding") was
  closest but still wrong on placement — see next.
- **`h2 - h1` being exactly one cell everywhere** killed H3 and the per-cell framing generally: the
  allowance appears **once per grid**, not per row. Solving `h1 - poster - 2*top` and
  `h2 - 2*poster - 2*top` both give 36 HD / 54 FHD, which is only consistent with a grid-level outset.
- **Case B (3 points)** gave a clean per-line increment of 21 HD / 31 FHD with **no** base step at the
  0→1 boundary beyond 23 — so the base is 23, not `2 * captionVerticalMargin` (24/36).
- **Case F** confirmed the zone is font-metric-driven (H2's one correct instinct): Largest → 61/91,
  Tiny → 18/26, matching the printed device `Label` heights exactly.
- **Case G** killed H5: the zone is poster-independent (G1/G3 track the poster 1:1).
- **FHD** does scale 1.5× for the vertical **sum** (`top + bottom`: 64 → 96). The caption **base** is the
  lone non-scaling value: 23 at both.

  This is all a height-only run can show, and an earlier version of this section overstated it as
  confirming "the previously inferred FHD 21" — a claim about the **split**, which no reading here
  touches. Any split summing to 96 keeps every height in the table correct while moving every `y`, and
  the horizontal outset is invisible to heights entirely. That gap is what
  [`postergrid-margins-probe`](../postergrid-margins-probe/README.md) was built to close; it measured
  both axes directly and the 21 does hold (`x=-21 y=-21 w=142`) — but as a measurement taken there, not
  as something inferable from here.

Two secondary divergences the run also exposed, both unmodelled:

1. **The per-line term is a measured line height, not a point size.** Device `Label` heights sit 1–2px
   above the engine's at every size, so the engine is additionally short by `lines × 1..2`.
2. **`caption2`'s per-line increment differs from `caption1`'s** — 20/29 vs 21/31, but *equal* when both
   are set explicitly (F4). This section originally read that as "the device's caption2 default is the
   non-bold face". **That inference was measured false.** The margins probe set `caption2Font` explicitly
   to each face in turn (its group N) and the device returned identical heights — `SmallerSystemFont` and
   `SmallerBoldSystemFont` share a point size, so height cannot separate them and the increment gap was
   never evidence about the font. The gap is fully accounted for by divergence 1: the device's real
   `Label` line heights are 21/26 HD and 31/38 FHD against the engine's point sizes. The engine's
   `font:SmallerBoldSystemFont` default is correct and stands.

## After the run — done

1. ✅ Measured table recorded in `.claude/docs/scenegraph-invariants.md` ("The caption zone: there is no
   base caption zone"), replacing the "Still divergent — the caption zone" paragraph. PR #1139's item 1
   updated.
2. ✅ No hypothesis won; the section above names which case ruled out which.
3. ✅ Fix landed — **not** in `computeCaptionMetrics`'s base term as expected, but as a new
   `PosterGrid.rectMarginBottom()` (50 HD / 75 FHD) plus a flat `CaptionZoneBase = 23` replacing
   `captionVerticalMargin * 2`. Pinned in `test/extensions/scenegraph/PosterGridExtent.test.js`
   (`describe("caption zone")`), with each expectation naming the probe case behind it.
4. ✅ FHD's vertical **sum** does scale 1.5×; the caption base (23) is the lone non-scaling value. The
   **split** between top and bottom, and the horizontal outset, are not readable from heights and were
   measured separately by [`postergrid-margins-probe`](../postergrid-margins-probe/README.md).

Follow-ups, and what became of them:

- ✅ **The `caption2` default font** — resolved by the margins probe's group N: the engine's bold default
  is **correct**, and this README's non-bold inference was wrong. See divergence 2 above.
- ✅ **The bottom outset is not unconditional** — the margins probe's M4 and then
  [`postergrid-outset-axis-probe`](../postergrid-outset-axis-probe/README.md) measured it absent for a
  horizontal strip (`rows == 1 && numColumns > 1`). The flat 50/75 this run's fix introduced was
  over-broad.
- ✅ **`CaptionTextOffset`** — the 12 introduced alongside that fix was an inference; the margins probe's
  group P measured it as **0**.
- ⬜ **Still open:** `RoFont.measureTextHeight` returns the font's point size where a device returns its
  real line height (1–2px short at every size). Engine-wide — it moves every `Label`, not just captions —
  so captioned expectations in `PosterGridExtent.test.js` are written as increments to hold either way.
  Its own PR.
