# SubRect Space Probe

This probe finds which coordinate space `subBoundingRect`, `localSubBoundingRect` and
`sceneSubBoundingRect` use for a grid's sub parts (issue #1262).

## Shape

The scene is FHD. Every grid has 100x100 items, 20 px apart, at a non-zero translation:

| id | node | where |
| --- | --- | --- |
| `pgScene` | PosterGrid, 3 columns | directly under the Scene, at [100,80] |
| `pgHolder` | PosterGrid, 3 columns, focused | at [100,40] in a Group at [700,40] |
| `mgHolder` | MarkupGrid, 3 columns | at [100,300] in the Group |
| `rlHolder` | RowList, `numRows=1`, 2 content rows | at [100,560] in the Group |
| `pgScaled` | PosterGrid, `scale=[0.5,0.5]` | at [500,40] in the Group |
| `rl2` | RowList, `numRows=2`, `itemSpacing=[0,20]` | at [100,780] under the Scene |
| `rectNode` | Rectangle (not a grid) | at [900,560] in the Group |

Each grid prints its own rects, then all three sub-rect variants for `item0`–`item2`, `item0_0`,
`item0_1`, `item1_0`, `item1_2`, `focusItem`, `focusIndicator` and `bogus`. It prints them once after
a 2.5 s settle (`before`), then again after focusing the second item (`after`: `jumpToItem=1`, or
`jumpToRowItem` [0,1] / [1,2]).

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./capture.sh          # device -> trace.txt
brs-cli --root . source/main.brs                   # engine (Ctrl+D after PROBE|done)
```

`device-trace-os16.0.txt` is from a Roku Express 4K+ on OS 16.0.4. `engine-trace.txt` is the engine
after the fix.

## Findings (OS 16.0)

| method | result for item 1 of `pgHolder` | space |
| --- | --- | --- |
| `sceneSubBoundingRect` | `{920,80,100,100}` | scene |
| `subBoundingRect` | `{120,0,100,100}` | the grid's own, from its translation origin, unscaled |
| `localSubBoundingRect` | `{0,0,100,100}` | the item's own |

- The device returns the same result for every grid type and translation, and under the grid's own
  scale (`pgScaled`: `{120,0,100,100}`, scene `{1260,80,50,50}`). `subBoundingRect` is **not** the
  grid's parent space, despite the spec's wording.
- A sub part the grid does not have (`bogus`, `item2` on `rl2`) is a zero-size rect at the grid's
  origin: `{0,0,0,0}`, and scene `{originX,originY,0,0}`. A Rectangle returns its own rect instead,
  as the spec says.
- `itemX_Y` on a PosterGrid or MarkupGrid parses as `itemX`, so `item0_1` is item 0.

Engine and device now agree on everything above. These differences are still open:

- **`focusIndicator`** is the focus frame on a device: the focused item outset by 21 (PosterGrid) or
  22 (MarkupGrid/RowList). It is reported even when the grid is unfocused, and its `local` rect is the
  outset (`{-21,-21,142,142}`). The engine returns the focused item.
- **RowList `itemX`** is row X on a device (`{focusX, rowY, 600, 100}`), not that row's focused item.
- **RowList rows outside the visible window**: the device reports `rlHolder` row 1 (beyond
  `numRows=1`) and `rl2` row 0 after scrolling (y=-120). The engine has no rect, or a stale one.
- **Own rects**: the device outsets MarkupGrid by 22 on every side (engine: none), and RowList by 22
  (engine: 33/6). `rl2` keeps its height after scrolling (284). The engine's shrinks from 232 to 112.
