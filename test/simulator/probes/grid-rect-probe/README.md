# Grid Rect Probe

This probe measures grid bounding rects on a device for issues #1318–#1321:
- a grid's own `boundingRect` outset;
- RowList `itemX` and the `item<r>_<c>` rects of rows outside the window;
- `ancestorBoundingRect` / `ancestorSubBoundingRect`.

## Shape

`main.brs` runs each case of `GridRectScene.brs` in turn. A case builds its nodes at `[100,100]`. For
each state it applies a change (`act`), waits 1.2 s and prints `tr` (translation), `own` (the three own
rects), each sub part, and the ancestor rects. Items are `ProbeItem`, a 100x100 Rectangle, so a slot
larger than 100 shows whether a sub-rect is the slot or the component.

| cases | what varies |
| --- | --- |
| `mg_*`, `ml_*`, `pg_*` | MarkupGrid / MarkupList / PosterGrid size, rows, columns, spacing, `drawFocusFeedback`, a non-9-patch focus bitmap, `visible=false`, focus, scrolling |
| `rl_*` | RowList item and row sizes, `rowHeights`/`rowSpacings`, a label band, rows vs. `numRows`, focus, scrolling |
| `x_*` | a 2-row window over 6 rows of 10 items (row 2 has 2), in a 600px list, under `floatingFocus`, `fixedFocus`, `fixedFocusWrap` and vertical `floatingFocus`, after `jumpToRowItem` [0,5], [3,7], [5,9] |
| `zr_base` | ZoomRowList, before and after `jumpToRowItem` [1,2] |
| `a_chain` | Groups with an offset sibling, a 0.5 scale, a 90° rotation, and a scale around `scaleRotateCenter` |
| `lg_*` | a MarkupGrid / RowList / PosterGrid between two Rectangles in a vertical LayoutGroup |

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./capture.sh fhd   # device -> device-trace-fhd.txt (hd: manifest-hd)
ENGINE=1 ./capture.sh fhd                       # engine -> engine-trace-fhd.txt (after npm run build:cli)
```

The device traces are from a Roku Express 4K+ on OS 16.0.4.

## Findings (OS 16.0, HD and FHD)

- **Own rects** don't depend on the focus bitmap, `drawFocusFeedback`, focus or visibility. The spacing
  after the last row counts.
  - MarkupGrid: 22 on the left, right and top at both resolutions. Below it: 22 + 36 (HD) / 22 + 54
    (FHD), except for a strip with `numRows` 1 and more than one column, which gets 22. The spacing after
    each column counts, except with a single column.
  - MarkupList: outset once per list, 24/6 HD and 36/9 FHD, with 5× the top outset below.
  - RowList: 22 on every side. Its height is the `min(numRows, rows)` window, and scrolling doesn't
    change it.
  - PosterGrid: the bottom allowance follows the declared `numRows` (`pg_3rows_1content`).
  - ZoomRowList reports its translation plus the screen size.
- **Item sub-rects** are computed from layout: the slot size (`itemSize`/`rowItemSize`), for hidden grids
  too, and for items past the window at their layout positions.
- **RowList `item<r>`** is row r: `{focusX, itemsY, itemSize.x, rowHeight}`. `focusX` is the focused
  item's x, the same in every row. A column past a short row's end is `{0, rowY, 0, 0}`.
- **RowList horizontal scrolling** is relative to the list's width, not the screen's. Floating focus
  keeps the focused item inside `itemSize.x`, a jump scrolls like the equivalent key presses, and each
  row keeps its own offset. `fixedFocusWrap` reports linear positions, like `fixedFocus`.
- **ZoomRowList `item<r>`** is `{0, rowTop, rowWidth, rowHeight}`.
- **Ancestor rects** are in the ancestor's own coordinates: each node in between applies its
  translation, scale and rotation. A node that isn't an ancestor gets `boundingRect()` /
  `subBoundingRect()`.
- **LayoutGroup** places a grid by its outset rect: translation `[22,72]` after a 40px Rectangle with
  spacing 10.

The engine matches all of the above except:
- the flat grids' item sub-rects (slot size, hidden grids, items past the window);
- ZoomRowList's own rect, its wrap-divider spacing and its `fixedFocusWrap` scroll;
- the device printing `-0` for a LayoutGroup child's translation.
