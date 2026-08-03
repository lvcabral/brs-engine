# `RoFont.measureTextHeight` returns a point size where a device returns a line height

`RoFont.measureTextHeight()` — and therefore `ifFont.GetOneLineHeight()`, `RoFont.measureText().height`
and every node that sizes text from them — reports **the font's point size** where a real Roku device
reports the font's **real line height**. The engine is short by **1–2px at every system font size, at
both resolutions**.

This is device-measured, not suspected. It is left unfixed for now because it is **engine-wide** (it
moves every text node, not one node's layout) and because the exact formula the device uses is
**not yet pinned** — seven measured sizes admit four different formulas that agree on all seven and
disagree on eight of the other sizes. Fixing it needs its own PR and one more probe run. This document
records what is known, what a fix would touch, and what the probe has to measure first.

Related: `.claude/docs/scenegraph-invariants.md` (the `PosterGrid` caption-zone section, where this
divergence surfaced), [`scenegraph-layout-and-clipping-gaps.md`](scenegraph-layout-and-clipping-gaps.md)
(the sibling "known gaps" note this was split out of), and the three probe READMEs under
`test/simulator/probes/postergrid-*-probe/`.

---

## The defect

```ts
// src/core/brsTypes/components/RoFont.ts
measureTextHeight() {
    return Math.round(this.metrics.lineHeight * this.size);
}
```

`metrics.lineHeight` comes from `RoFontRegistry.registerFont`:
`(ascender - descender + hhea.lineGap) / unitsPerEm`. For the SceneGraph system fonts — Metropolis,
`hhea` 795 / −205, `lineGap` 0, `unitsPerEm` 1000 — that ratio is **exactly 1.0**. So for every
`font:XxxSystemFont`, `measureTextHeight()` returns the point size verbatim: 20 for
`SmallerSystemFont` at HD, 24 for `MediumSystemFont`, 90 for `LargestSystemFont` at FHD.

The formula is not wrong in the abstract — for the Draw 2D default (`DejaVuSansCondensed`, ratio
1.1640625) it returns something larger than the point size. It is wrong for the fonts SceneGraph
actually uses, because those fonts' `hhea` metrics sum to exactly one em and carry no line gap, so
"ascent + descent + gap" collapses to "size". A device evidently does **not** derive its line advance
from those table values the same way.

## The measurements

From `test/simulator/probes/postergrid-captions-probe` and `postergrid-margins-probe` (Streaming Stick,
Roku OS 15.2). Each reading is `Label.boundingRect().height` for a single-line `Label` with that
`font:` value — a device number on the left, the engine's on the right:

| system font | point size | device `Label` height | engine `measureTextHeight()` | short by |
| --- | --- | --- | --- | --- |
| `TinySystemFont` (HD) | 16 | **18** | 16 | 2 |
| `SmallerSystemFont` / `SmallerBoldSystemFont` (HD) | 20 | **21** | 20 | 1 |
| `MediumSystemFont` / `MediumBoldSystemFont` (HD), `TinySystemFont` (FHD) | 24 | **26** | 24 | 2 |
| `SmallerSystemFont` / `SmallerBoldSystemFont` (FHD) | 30 | **31** | 30 | 1 |
| `MediumSystemFont` / `MediumBoldSystemFont` (FHD) | 36 | **38** | 36 | 2 |
| `LargestSystemFont` (HD) | 60 | **61** | 60 | 1 |
| `LargestSystemFont` (FHD) | 90 | **91** | 90 | 1 |

Two facts worth stating explicitly, because both constrain a fix:

- **The shortfall is not a constant and not a ratio.** The deltas are 2, 1, 2, 1, 2, 1, 1 and the ratios
  1.125 … 1.011. No `k * size`, `size + c` or `round/ceil/floor(k * size + c)` reproduces the column —
  every single-term form was tried and rejected numerically. It behaves like **two separately rounded
  components** (an ascent and a descent) summed, which is why the correct fix reaches for
  `getAscent`/`getDescent` rather than tuning `lineHeight`.
- **Bold and regular at the same point size measure identically.** `SmallerSystemFont` and
  `SmallerBoldSystemFont` are both hd 20 / fhd 30 in `system-fonts.json`, and the device returned the
  same height for both — as did `MediumSystemFont` vs `MediumBoldSystemFont`. So weight does not enter
  the line height, and **height cannot be used to identify a face** (see
  ["the second-order damage"](#the-second-order-damage-this-already-caused) below).

## Where it is consumed (the blast radius)

`measureTextHeight()` is the single source of "one line is this tall" for the whole engine. Every site
below is short by 1–2px per line today, and every one of them moves when this is fixed:

| Site | Uses it for |
| --- | --- |
| `RoFont.ts:111` (`measureText`) | the `height` of every measured string — the widest fan-out of all |
| `RoFont.ts:144` (`getOneLineHeight`) | the BrightScript-visible `ifFont.GetOneLineHeight()` |
| `Group.ts:441` (`refreshLines`) | wrapped-text line advance and total block height — backs `Label` |
| `MultiStyleLabel.ts:418`, `:576` | per-span line height, and the ellipsis span |
| `ScrollableText.ts:191` | `this.lineHeight`, i.e. the scroll step |
| `ScrollingLabel.ts:181` | the scrolled text's height |
| `MonospaceLabel.ts:74` | line advance |
| `RowList.ts:130` | `this.titleHeight` — row title band, which offsets every row below it |
| `ZoomRowList.ts:722`, `:772` | `height: measureTextHeight() + this.gap` for the row title area |
| `InfoPane.ts:311` | line advance |
| `PosterGrid.ts:946` (`measureFontHeight`) | the per-line term of the caption zone, hence cell height |

Indirect consumers ride on the same value through `measureText().height`: `SimpleLabel.ts:121`,
`Button.ts:117`, `RowList.ts:1109`/`:1134`, and the wrap machinery in `Group.ts:485-513`.

`getTopAdjust()` (`RoFont.ts:115`) is a *second* function of the same metrics — `(lineHeight − ascent) *
size / 2` — and it is what `IfDraw2D.doDrawText`/`doDrawRotatedText` add to place a glyph inside its
line box. For Metropolis it is currently **0** (lineHeight == ascent + descent, and `ascent` is floored
at `size`). Any change to how the line box is computed has to keep `getTopAdjust` consistent with it, or
text will be correctly *spaced* and incorrectly *positioned* inside that spacing. `MultiStyleLabel`
(`:202`, `:244`, `:278`) and `SimpleLabel` (`:133`) both back out an ascent as
`height − 2 * getTopAdjust()`, so they read the two together and would break if they diverged.

## Why it must be fixed in `RoFont`, not per node

The tempting local fix is to add the missing pixel where the symptom was noticed — a
`+ 1` in `PosterGrid.measureFontHeight`, or a fudge in `RowList.titleHeight`. Do not. The value is
wrong for **every** font at **every** size, so a per-node correction is a shape-specific constant that:

- leaves the other ten sites wrong, and leaves `GetOneLineHeight()` — which apps call directly to lay
  out their own text — wrong;
- has to be re-derived per node, per resolution, and would drift the moment the real fix lands;
- reads as a grid/list layout constant to the next person, hiding a font-metrics bug behind geometry.

This is exactly the pattern `.claude/docs/scenegraph-invariants.md` records for the `PosterGrid` extent:
a compensating constant in a consumer is invisible until the producer is corrected, and then it
double-counts.

## The likely shape of the fix, and the four candidates

`ifFont` already exposes the ingredients on the same interface: `GetAscent()`, `GetDescent()` and
`GetMaxAdvance()` (`RoFont.ts:161-191`), each currently `Math.round(metric * size)`. The deltas above
behave like two independently rounded components, which points at

```
lineHeight = round-up(ascent * size) + round-up(descent * size) [+ gap]
```

Fitting the seven readings exactly, over all combinations of `floor`/`ceil`/`round` on each component
and a constant of 0–2, leaves a family of ~70 parameterizations. Reduced to plausible round numbers,
four candidates survive **all seven measurements** and the engine's current formula fails **all seven**:

| point size | system font(s) | device | L1 `⌈.8s⌉+⌈.2s⌉+1` | L2 `⌈.7s⌉+⌈.3s⌉+1` | L3 `⌈.9s⌉+⌈.1s⌉+1` | L4 `⌈.6s⌉+⌈.4s⌉+1` | L5 `⌈.795s⌉+⌈.205s⌉` | engine `round(1.0·s)` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14 | Badge (HD) | **?** | 16 | 16 | 16 | 16 | 15 | 14 |
| 16 | Tiny (HD) | 18 | 18 | 18 | 18 | 18 | 17 ✗ | 16 ✗ |
| 18 | Smallest (HD) | **?** | 20 | 20 | 20 | 20 | 19 | 18 |
| 20 | Smaller (HD) | 21 | 21 | 21 | 21 | 21 | 21 | 20 ✗ |
| 21 | Badge (FHD) | **?** | 23 | 23 | 23 | 23 | 22 | 21 |
| 22 | Small (HD) | **?** | 24 | 24 | 24 | 24 | 23 | 22 |
| 24 | Medium (HD), Tiny (FHD) | 26 | 26 | 26 | 26 | 26 | 25 ✗ | 24 ✗ |
| 27 | Smallest (FHD) | **?** | 29 | 29 | 29 | 29 | 28 | 27 |
| 30 | Large (HD), Smaller (FHD) | 31 | 31 | 31 | 31 | 31 | 31 | 30 ✗ |
| 33 | Small (FHD) | **?** | 35 | 35 | 35 | 35 | 34 | 33 |
| 36 | ExtraLarge (HD), Medium (FHD) | 38 | 38 | 38 | 38 | 38 | 37 ✗ | 36 ✗ |
| 45 | Large (FHD) | **?** | **46** | **47** | **47** | **46** | 46 | 45 |
| 54 | ExtraLarge (FHD) | **?** | 56 | 56 | 56 | 56 | 55 | 54 |
| 60 | Largest (HD) | 61 | 61 | 61 | 61 | 61 | 61 | 60 ✗ |
| 90 | Largest (FHD) | 91 | 91 | 91 | 91 | 91 | 91 | 90 ✗ |

L5 is the one that uses Metropolis's **actual** `hhea` ratios (795/205 per 1000 em) with each component
rounded up independently. It is wrong at 16, 24 and 36 — the sizes whose 0.795/0.205 split lands far
from a pixel boundary — so **the device is not simply ceil-ing the font's own ascent and descent**.
There is a `+1` (or an equivalent gap term) that the font tables do not contain.

**Do not pick one of L1–L4 from this table.** They agree on all seven measured sizes by construction and
that is the whole problem: the value they are being fit to is a *sum*, and a sum cannot separate the
split. What distinguishes them is the **unmeasured** sizes — the whole surviving family splits at
**14, 21, 22, 27, 33, 45, 54** (and 18 stays unanimous). A single reading at **45** (`LargeSystemFont`
at FHD) separates L1/L4 (46) from L2/L3 (47); 14, 21, 22, 27, 33 and 54 each separate the wider family.
This is the same trap as the `PosterGrid` FHD vertical split, where every candidate summing to 96 kept
every measured height correct while moving every `y`.

## What the probe has to measure

A small standalone probe app under `test/simulator/probes/font-line-height-probe/`, following the
established discipline (candidates pre-registered in the README **before** the run, and kept there after
they lose):

1. **Every system font at both resolutions.** `test/simulator/probes/font-test/components/font-scene.xml`
   already lists all 14 by name and is the obvious starting fixture. Print
   `Label.boundingRect().height` for each with a single-line, non-wrapping text. That alone fills in the
   eight unmeasured rows above and reduces the family to at most one member per rounding form.
2. **`GetAscent()`, `GetDescent()`, `GetMaxAdvance()` and `GetOneLineHeight()` from BrightScript**, per
   font, via `CreateObject("roFontRegistry")`. The `Label` height is the *node's* interpretation of the
   metric; these four are the metric itself, and they decide whether the correct model is
   `ascent + descent`, `ascent + descent + 1`, or something that reads a table the engine ignores. It
   also settles whether the engine's `getAscent`/`getDescent` are independently wrong — they have never
   been measured either, and `getTopAdjust` is derived from them.
3. **A non-system font** registered from the app's own `.ttf` via `roFontRegistry.Register` +
   `GetFont(family, size, bold, italic)`, at several sizes. Metropolis's metrics are unusually round
   (exactly one em, zero line gap); a font with a real line gap and a non-unit sum is what separates
   "the device adds a constant" from "the device reads `OS/2`/`hhea` differently". Metropolis has no
   `sTypoLineGap` and its `usWinAscent`/`usWinDescent` equal its `hhea` values, so it cannot distinguish
   those table choices at all.
4. **Multi-line spacing, not just one line.** `GetOneLineHeight` is documented as "the number of pixels
   from one line to the next", so it is a line *advance*. Measure a 2-line and 3-line `Label` and check
   whether the advance equals the single-line height or differs from it — the engine assumes they are
   the same value (`Group.refreshLines` uses one number for both), and if a device separates them, that
   is a second divergence hiding inside this one.
5. **Both resolutions**, for the same reason as every other probe in this family: nothing in this node
   graph is safely assumed to scale.

## The second-order damage this already caused

This metric being wrong produced a *false* finding that survived one full probe round.

`postergrid-captions-probe` derived caption1's per-line cost as 21 HD / 31 FHD and caption2's, when
left at its default, as 20 HD / 29 FHD — and concluded from the gap that **`caption2Font` defaults to
the non-bold face**, contradicting the engine's `font:SmallerBoldSystemFont` default. Both numbers were
differences between *derived* quantities, each carrying this metric's 1–2px error in both terms.
`postergrid-margins-probe` then set `caption2Font` explicitly to each face and measured **identical**
device heights — because the bold and regular Smaller fonts share a point size, so height cannot
separate them at all. The engine's default was right the whole time.

The lesson, recorded in `.claude/docs/scenegraph-invariants.md` alongside it: **an inference drawn from
a difference between two derived quantities inherits every error in both.** With a known-wrong metric in
the pipeline, differences are the least trustworthy readings a probe produces, not the most.

## What this currently costs, and what changes when it is fixed

- **Every captioned `PosterGrid` cell is short by `lines × 1..2`.** This is why the caption-zone
  expectations in `test/extensions/scenegraph/PosterGridExtent.test.js` are written as **increments**
  (the 1→2 line step, the 1→2 row step) rather than absolute pixel counts: the increments are
  font-metric-independent and hold under either metric, while an absolute captioned height would bake
  the wrong one into the file. The zero-caption cases *are* pinned exactly, and so is the one captioned
  case whose value contains no per-line term (case E1 HD **172** = `14 + 100 + 23 + 21 + 14`). Once the
  metric is correct, those increments can become absolute — that is the visible acceptance criterion for
  the fix.
- **Wrapped text fits more lines than it should.** `Group.refreshLines` computes
  `maxRenderedLines = floor((rect.height + lineSpacing) / (lineHeight + lineSpacing))`; too small a
  `lineHeight` admits an extra line into a fixed-height box, and ellipsizes one line later than a
  device. Correcting the metric will *remove* a line from some labels — expect layout diffs, not just
  height diffs.
- **`RowList`/`ZoomRowList` title bands are 1–2px short**, which offsets every row beneath them.
- **`ScrollableText`/`ScrollingLabel` scroll by a slightly wrong step**, accumulating over a long scroll.
- **Apps that call `GetOneLineHeight()` to lay out their own text** inherit the error directly, and no
  engine-side node fix helps them.

Expect a fix to move a **large** number of existing expectations. That is the point of it, but it means
the change should land on its own, with the moved numbers reviewed one by one against device readings
rather than accepted wholesale from a snapshot update.

## Scope note

Only `RoFont`'s vertical metrics are in question here. `measureTextWidth` measures through the canvas
(`ctx.measureText`) and is unaffected; so is its memoization. Nothing in this document is a reason to
touch the measurement cache, `toFontString()`, or `RoFontRegistry`'s font loading.
