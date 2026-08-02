# PosterGrid Spacing Probe

Settles one question: when `columnSpacings` has **fewer entries than there are gaps**, does the last
entry **repeat** (what brs-engine does — `PosterGrid.resolveSpacingValue` → `values.at(-1)`) or do the
remaining gaps **fall back to `itemSpacing.x`** (what the ArrayGrid reference says)?

Note `LayoutGroup.itemSpacings` is already device-confirmed to repeat its last entry, so "the other one
repeats" is not evidence either way — hence measuring.

## Why a second probe

The first pass (`test/simulator/probes/layout-measure-probe`, case `P`) was **inconclusive**: the device reported
`{x=-14 y=306 w=438 h=324}`, which does not decompose into either candidate. Poster size, focus margins
and gap spacing were all unknown simultaneously, and the fixture used 2 rows so the row axis added a
third unknown. This probe isolates them.

## Run

```
telnet <roku-ip> 8085                                              # device
node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-spacing-probe   # engine baseline
```

Engine baseline is in `engine-trace.txt`. The boot line now prints the UI resolution, which the first
probe did not — margins are resolution-dependent, so record it.

## Decode order

Every fixture is a **single row**, captions are off (`caption1NumLines`/`caption2NumLines` default to 0)
and the content items carry no fields at all, so nothing can widen a cell. Solve top to bottom; by `P4`
there is exactly one unknown left.

| Case | Setup | Solves |
| --- | --- | --- |
| `P1` | 1 column, `itemSpacing=[0,0]` | `width = poster + 2*marginX`, `height = poster + 2*marginY` — gives the margins **and** whether `basePosterSize` is honored |
| `P2` | 1 column, `columnWidths=[200]` | does `columnWidths` override `basePosterSize`? |
| `P3` | 3 columns, no spacing arrays, `itemSpacing.x=50` | is `itemSpacing.x` used for every gap? (`3*poster + 2*50 + 2*marginX`) |
| **`P4`** | 3 columns, `columnSpacings=[10]`, `itemSpacing.x=50` | **the discriminator**: repeat → `10+10`, fall back → `10+50`. The two answers are **40px apart** |
| `P5` | 3 columns, `columnSpacings=[10,20]` | control — both gaps explicit, so the total is unambiguous |

## Engine baseline (`engine-trace.txt`, HD 1280x720)

| Case | Engine | Reading |
| --- | --- | --- |
| `P1` | `w=100 h=100` | marginX = marginY = **0**; `basePosterSize` honored |
| `P2` | `w=200` | `columnWidths` **does** override |
| `P3` | `w=400` | `300 + 2*50` — `itemSpacing.x` used for both gaps |
| `P4` | `w=320` | `300 + 10 + 10` → **repeats the last entry** |
| `P5` | `w=330` | `300 + 10 + 20` — control |

## Reading the device result

Compare `P4` only after `P1`-`P3` have been used to fix `marginX` and the poster width for that device
(they will differ from the engine's zeros — the first probe showed a 14px outset). Then:

- `P4 == P3 - 80` → the last entry repeated (`10+10`), engine is right and the reference is wrong for
  PosterGrid.
- `P4 == P3 - 40` → the remaining gap fell back to `itemSpacing.x` (`10+50`), and
  `PosterGrid.resolveSpacingValue` needs to fall back instead of repeating.
- Anything else → the fixture still has a hidden variable; do not guess, extend the probe.

`P5` must equal `P3 - 70` under either answer. If it does not, the comparison itself is off and `P4`
cannot be trusted.
