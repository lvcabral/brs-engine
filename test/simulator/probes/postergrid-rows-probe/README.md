# PosterGrid Row-Axis Probe

Completes the PosterGrid extent picture. The **column axis is already solved** by
`test/simulator/probes/postergrid-spacing-probe` (device, Streaming Stick / Roku OS 15.2, HD 1280x720):

```
width      = Σ over ALL N columns of (posterWidth + spacing_i) + 2 * marginX
spacing_i  = columnSpacings[i] ?? itemSpacing.x     <- FALLS BACK, does not repeat the last entry
marginX = marginY = 14 ;  basePosterSize honored ;  columnWidths IGNORED
```

Every fixture there was a **single row**, so the row axis was untouched. This probe settles it, and
the two together are meant to land as one fix — a PosterGrid that is right on one axis and wrong on
the other is worse than either state.

## Open questions

1. **Does the row axis mirror the column axis?** i.e. a trailing gap after the **last** row, and
   `rowSpacings` falling back to `itemSpacing.y` rather than repeating its last entry.
2. **Is `rowHeights` honored, or ignored** the way `columnWidths` turned out to be? PosterGrid took its
   cell width from `basePosterSize` and ignored `columnWidths` entirely — the height may or may not
   follow the same rule.
3. **What is the unexplained `+36`?** On device a 100-tall poster produced a **136-tall cell** with
   captions nominally off (`caption1NumLines` defaults to 0). The hypothesis is a reserved caption zone
   from `showBackgroundForEmptyCaptions` (defaults to `true`); `R2`/`R3` test it directly.

## Run

```
telnet <roku-ip> 8085                                            # device
node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-rows-probe   # engine baseline
```

Engine baseline is in `engine-trace.txt`. The boot line records the UI resolution — margins are
resolution-dependent, so check it matches the column-axis run (HD 1280x720) before comparing.

## Decode order

Every fixture is **one column**, so the width is a known constant (device: `100 + 2*14 = 128`) and only
the height has to be decoded. Content items carry no fields except in `R3`, which needs real captions.

| Case | Setup | Solves |
| --- | --- | --- |
| `R1` | 1 row, no spacing | `height = cell + 2*marginY` — the baseline cell height, and confirms marginY |
| `R2` | same, `showBackgroundForEmptyCaptions=false` | is the extra height a reserved empty-caption zone? |
| `R3` | same, `caption1NumLines=1`, items have titles | does a real caption line grow the cell further? |
| **`R4`** | 3 rows, no arrays, `itemSpacing.y=50` | **trailing gap?** mirror → 3 gaps, N−1 → 2 gaps (**50px apart**) |
| **`R5`** | 3 rows, `rowSpacings=[10]`, `itemSpacing.y=50` | **the discriminator:** fall back → `10+50+50`, repeat → `10+10+10` (**80px apart**) |
| **`R6`** | 3 rows, `rowHeights=[200,50,100]` | honored → 350, ignored → 300 (**50px apart**) |

## Engine baseline (`engine-trace.txt`, HD 1280x720)

| Case | Engine | Reading |
| --- | --- | --- |
| `R1` | `h=100` | cell = poster exactly; **marginY = 0** (device: 14) |
| `R2` | `h=100` | empty-caption background has no effect |
| `R3` | `h=144` | one caption line adds 44 |
| `R4` | `h=400` | `3*100 + 2*50` → **N−1 gaps**, no trailing gap |
| `R5` | `h=320` | `300 + 10 + 10` → **repeats** the last entry |
| `R6` | `h=350` | `200+50+100` → **`rowHeights` honored** |

Note `R6` is where the engine may already be right while the column axis is wrong — the device ignores
`columnWidths` but might still honor `rowHeights`. Don't assume symmetry in either direction.

## Reading the device result

Fix `marginY` and the cell height from `R1`-`R3` first, then read `R4`-`R6`. Each has exactly one
unknown by that point, and each pair of candidate answers is at least 50px apart, so no case can be
decided by rounding.

If `R4` shows a trailing gap and `R5` shows fall-back, the row axis mirrors the column axis and both
can be fixed with the same helper. If they disagree, the two axes genuinely differ and the fix must
keep them separate — which is exactly the kind of asymmetry that already showed up between
`columnWidths` (ignored) and `basePosterSize` (honored).
