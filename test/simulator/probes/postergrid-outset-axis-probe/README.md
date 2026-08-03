# PosterGrid outset-axis probe

Isolates **what governs the asymmetric bottom outset** on a `PosterGrid`'s reported rect. Follow-up to
[`postergrid-margins-probe`](../postergrid-margins-probe/README.md), whose case **M4** turned up a
divergence neither it nor the [caption-zone probe](../postergrid-captions-probe/README.md) was designed to
look for.

**Candidate models are pre-registered below, BEFORE the device run.** They stay here after they lose.

## The finding that prompted this

The margins probe measured the grid's reported rect as asymmetric on Y — 14 above the first row and **50**
below the last (HD; 21/75 FHD) — in five of its six cases. The exception was the one 3-column case, which
reported the plain symmetric 14:

| margins-probe case | device HD `bottom` | device HD `h` |
| --- | --- | --- |
| M1. 1 col × 1 row, poster 100x100 | 50 | 164 |
| M2. same, `translation=[300,200]` | 50 | 164 |
| M3. 1 col × 2 rows | 50 | 264 |
| M5. 1 col × 1 row, poster 200x200 | 50 | 264 |
| M6. 1 col × 1 row, `itemSpacing=[0,40]` | 50 | 204 |
| **M4. 3 cols × 1 row** | **14** | **128** |

FHD behaves identically at 1.5× (75 everywhere, **21** for M4). So the extra 36 HD / 54 FHD below the
last row is **not unconditional**, and the engine — which returns `h = 164` for M4 — overcorrects the
multi-column case.

**The problem is that M4 confounds several causes at once.** It is the only case in that set with more
than one column *and* the only one whose content extent is wider than it is tall. Column count, content
aspect, total width, and "does the grid have more than one item per row" all predict the same M4 reading,
and the margins probe cannot separate them. A fix based on any single guess is a coin flip — hence this
probe.

## Design: cross the axes so each is isolated

Entirely numeric — every value is a `boundingRect()` reading over telnet, so unlike the margins probe's
group P there is no screenshot and the app **closes its screen and exits** when it finishes printing.

17 cases in six groups. Poster size is per-case, `itemSpacing = [0,0]` and `translation = [0,0]`
throughout (M2 already established the outset is a margin, not a coordinate-space artifact).

| group | varies | isolates |
| --- | --- | --- |
| **A** (4) | column count 1, 2, 3, 4 at fixed poster | reproduces M1 and M4, and finds the switch point if it is a count |
| **B** (2) | 3 columns, content now **taller** than wide (4 rows; and 1 row of tall posters) | **the decisive cross** — A2 vs B1 is the same column count, opposite shape |
| **C** (3) | 1 column, content wide / tall / square | the mirror: a shape effect must show up with only one column |
| **D** (3) | very wide / very tall single column; 3 narrow columns | separates a width threshold from column count |
| **E** (2) | `caption1NumLines=1` at 3 and 1 columns | is the 36 a mis-attributed caption allowance? |
| **F** (3) | explicit `itemSize`; a short last row (2 items in 3 columns) | declared vs. drawn extent |

The decisive pair is **A2 vs B1**: both are 3 columns, differing only in whether the content extent is
taller than it is wide.

`printSummary` re-lists every case as per-side outsets derived from that case's own declared inputs, with
the content extent and its shape printed alongside — the two leading candidate variables side by side.
Nothing is differenced: differencing is what hid these outsets in the first place.

## Running it

From the repo root:

```bash
cd test/simulator/probes/postergrid-outset-axis-probe
zip -r ../../../../out/postergrid-outset-axis-probe-hd.zip manifest source components
cp manifest manifest-hd && cp manifest-fhd manifest
zip -r ../../../../out/postergrid-outset-axis-probe-fhd.zip manifest source components
cp manifest-hd manifest && rm manifest-hd
```

Sideload each and capture the telnet output (port 8085). Engine side:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-outset-axis-probe
```

**Read the `bottom` column.** Every case has a known content extent, so `bottom` is the whole subject;
`left`/`top`/`right` come along as controls and should stay 14 (HD) / 21 (FHD) everywhere.

## Pre-registered candidate models

`B` = the extra bottom allowance beyond the symmetric margin (36 HD / 54 FHD as measured).

**G1 — column count.** The allowance applies only to a single-column grid. Predicts A1 `50`, A3/A4 `14`,
and — critically — **B1/B2 `14`** (3 columns regardless of shape), C1/C2/C3 all `50`, D3 `14`, F1 `14`.
The most mechanical reading of M4, and the one a careless fix would assume.

**G2 — content shape.** The allowance applies when the content extent is at least as tall as it is wide.
Predicts A2/A3/A4 `14` (all wide) but **B1/B2 `50`** (3 columns, tall) — the opposite of G1 on exactly
that pair — plus **C1 `14`** (one column but wide, which G1 cannot produce) and C2/C3 `50`, D1 `14`,
D2 `50`, D3 `50` (3 columns but only 90 wide).

**G3 — a width threshold.** The allowance switches off past some content width in the 100..300 range.
Predicts A3 or A4 `14` with A1 `50`, **C1/D1 `14`** (single column, wide), D3 `50` (3 narrow columns).
Distinguished from G2 by C3/D2: a 200x200 square and a 100x700 column are both under any such threshold,
so G3 keeps them at `50` regardless of aspect, whereas G2 also keeps them — **G3 and G2 differ only on a
wide-but-narrow-content case**, which is why D3 (90 wide, 3 columns) is in the set.

**G4 — items per row.** Not the declared `numColumns` but the number actually drawn side by side.
Predicts F3 (3 columns, 2 items) to follow the 2-column reading rather than the 3-column one, and D3
`14`. Identical to G1 on every other case, so **F3 is the only case that separates them**.

**G5 — the 36 is a caption allowance in disguise.** The margins probe measured every `bottom = 50` case
*without* captions, and a caption zone is itself appended below the last row. Predicts E1 and E2 to
differ from each other by something other than exactly one caption zone, or the uncaptioned/captioned
gap to differ between 1 and 3 columns.

**G6 — declared vs. drawn extent.** The allowance tracks a declared grid size, not the measured content.
Predicts F1/F2 (explicit `itemSize`) to diverge from A2/A1, and F3 to keep a full row's worth.

**G7 — none of the above; M4 does not reproduce.** Registered deliberately. If every case including A2
reports `50`, then M4 was an artifact of the margins probe's fixture (e.g. its `enableCaptionScrolling`
or content shape) and the finding itself needs re-examining before anything is changed. **This is the
outcome that would let #1144 merge as-is**, so it must be stated up front rather than discovered as a
relief.

## Engine-side baseline (already captured)

Both resolutions run clean, 17/17 cases, no errors. The engine reports the allowance
**unconditionally** — every case `50` (HD) / `75` (FHD), and `93`/`128` for the two captioned cases
(`50 + 23 + 20` HD). So the engine currently implements **no** governing variable at all, and *any* of
G1–G6 winning means a change:

| case | cols | content | shape | engine HD `bottom` | engine FHD `bottom` | device HD | device FHD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1. 1 col × 1 row, 100x100 | 1 | 100x100 | square | 50 | 75 | (M1: **50**) | (M1: **75**) |
| A2. 3 cols × 1 row, 100x100 | 3 | 300x100 | wide | 50 | 75 | (M4: **14**) | (M4: **21**) |
| A3. 2 cols × 1 row | 2 | 200x100 | wide | 50 | 75 | ? | ? |
| A4. 4 cols × 1 row | 4 | 400x100 | wide | 50 | 75 | ? | ? |
| B1. 3 cols × 4 rows | 3 | 300x400 | tall | 50 | 75 | ? | ? |
| B2. 3 cols × 1 row, poster 100x400 | 3 | 300x400 | tall | 50 | 75 | ? | ? |
| C1. 1 col, poster 400x100 | 1 | 400x100 | wide | 50 | 75 | ? | ? |
| C2. 1 col, poster 100x400 | 1 | 100x400 | tall | 50 | 75 | ? | ? |
| C3. 1 col, poster 200x200 | 1 | 200x200 | square | 50 | 75 | (M5: **50**) | (M5: **75**) |
| D1. 1 col, poster 700x100 | 1 | 700x100 | wide | 50 | 75 | ? | ? |
| D2. 1 col, poster 100x700 | 1 | 100x700 | tall | 50 | 75 | ? | ? |
| D3. 3 cols, poster 30x100 | 3 | 90x100 | tall | 50 | 75 | ? | ? |
| E1. 3 cols, caption1=1 | 3 | 300x100 | wide | 93 | 128 | ? | ? |
| E2. 1 col, caption1=1 | 1 | 100x100 | square | 93 | 128 | ? | ? |
| F1. 3 cols, explicit itemSize | 3 | 300x100 | wide | 50 | 75 | ? | ? |
| F2. 1 col, explicit itemSize | 1 | 100x100 | square | 50 | 75 | ? | ? |
| F3. 3 cols, only 2 items | 3 | 300x100 | wide | 50 | 75 | ? | ? |

A1 and C3 have device equivalents already (margins-probe M1 and M5) and must reproduce **50**; A2 must
reproduce **14**. If A2 reads 50 on the device, see G7 — the fixture is the suspect, not the engine.

The `?` columns above are the **pre-run** state, left as written. The device readings are in the RESULT
section below.

## RESULT (device: Streaming Stick, Roku OS 15.2, HD and FHD)

**Every pre-registered candidate lost.** The rule the 34 readings fit is a **conjunction**, which is
exactly why no single-variable model could hold:

```
the extra bottom allowance (36 HD / 54 FHD) is absent  iff  rows == 1 && numColumns > 1
```

i.e. iff the grid is a **horizontal strip**. Verified against all 34 outset-axis readings plus the
margins probe's 8, on **height and width both: zero mismatches.**

| case | device HD `bottom` | device FHD `bottom` | what it settles |
| --- | --- | --- | --- |
| A1. 1 col × 1 row | 50 | 75 | reproduces M1 |
| A2. 3 cols × 1 row | **14** | **21** | reproduces M4 → **kills G7** (fixture is not the suspect, so #1144 cannot merge as-is) |
| A3. 2 cols × 1 row | 14 | 21 | the switch is at >1 column, not at 3 |
| A4. 4 cols × 1 row | 14 | 21 | and it does not come back |
| B1. 3 cols × 4 rows | **50** | **75** | **kills G1** — same 3 columns as A2, allowance present |
| B2. 3 cols × 1 row, tall | 14 | 21 | 300x400 content, still absent → **kills G2** with C1 |
| C1. 1 col, 400x100 wide | **50** | **75** | wide content, one column, allowance PRESENT → **kills G2** |
| C2. 1 col, tall | 50 | 75 | control |
| C3. 1 col, square | 50 | 75 | reproduces M5 |
| D1. 1 col, 700 wide | **50** | **75** | **kills G3** with D3 |
| D2. 1 col, 700 tall | 50 | 75 | control |
| D3. 3 cols, 90 wide | 14 | 21 | narrow but 3 columns → absent. A threshold would need to be both above 700 and below 90 |
| E1. 3 cols captioned | h = **172** | h = 196 | **kills G5** — see below |
| E2. 1 col captioned | h = 208 | h = 250 | the captioned baseline |
| F1. 3 cols, explicit itemSize | 14 | 21 | **kills G6** — matches A2 |
| F2. 1 col, explicit itemSize | 50 | 75 | matches A1 |
| F3. 3 cols, only 2 items | 14 | 21 | **kills G4** — the gate reads DECLARED `numColumns` |

**G5 needed HD to die.** E1 read `h = 172 = 14 + 100 + 23 + 21 + 14`, which requires
zone-present **and** allowance-absent; allowance-present with no zone gives 164. At FHD both readings
give 196, so the two resolutions cross-check each other and the HD one is the proof.

**Incidental find in F3 — a second divergence, also fixed.** Its `right` computed to `-86` in the
summary because that column derives content width from the DECLARED columns. The device reports
`w = 228` = **two** cells: the reported **width follows the items actually drawn**, while the
**allowance gate follows the declared `numColumns`**. Two different notions of "columns" in one node,
both device-backed (`countDrawnColumns` / `rectMarginBottom`), and neither may be unified into the
other. Only reachable when no row is full (`content.length < numColumns`).

**Not separated by any case:** whether `rows` in the gate means the declared `numRows` or the rows
actually displayed. Every case set `numRows` to the number of rows it filled, so the two were always
equal. The implementation uses the **displayed** count (the outset is a property of the laid-out
extent, and the hidden and visible passes must agree). A grid with `numRows = 12`, several columns and
one row's worth of content is therefore a **guess** — recorded as such in `rectMarginBottom`'s
docstring.

## Fixed as a result

In `src/extensions/scenegraph/nodes/PosterGrid.ts`:

1. `rectMarginBottom(displayRows)` — takes the row count and returns the symmetric margin for a strip.
2. `countDrawnColumns` / `computeReportedWidth` — the F3 width finding.
3. `CaptionTextOffset` 12 → **0**, from the margins probe's group P (independent of this probe).

Regression coverage: `test/extensions/scenegraph/PosterGridExtent.test.js`, describe block *"the extra
bottom allowance is gated on the grid being a horizontal strip"* — one test per killed candidate,
named after it, at both resolutions. The losing models stay there as tests so a future
"simplification" to any single variable fails locally rather than on a device.
