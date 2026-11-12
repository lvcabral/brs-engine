# Focus Footprint Layer Probe

This probe shows what a list draws on its focused item after it loses the focus (the "footprint"), and whether that footprint is drawn over or under the item. Every item is an opaque blue box with white text, so a footprint drawn over it tints or hides it, and one drawn under it shows only where it is larger than the box. The evidence is dev-mode screenshots.

## Shape

The scene is HD. A Button (`other`) holds the focus, so every list is unfocused:

- `grid`: MarkupGrid, one column
- `mlist`: MarkupList
- `list`: LabelList (plain text items)
- `rows`: RowList, one row
- `pgrid`: PosterGrid, opaque orange posters, no captions

Launch parameters, passed through ECP `launch/dev?…`:

- `target=<id>` focuses that node (default `other`).
- `fp=green` sets every list's `focusFootprintBitmapUri` to an opaque green image.
- `ontop=false|true` writes `drawFocusFeedbackOnTop` on every list from BrightScript.

The probe prints each list's `focusFootprintBitmapUri`, `focusFootprintBlendColor` and `drawFocusFeedbackOnTop`.

## Capture

Sideload, then for each case: `keypress/Home`, `launch/dev?<params>`, wait ~4 s, and take a `plugin_inspect` screenshot (see `../focus-opaque-layer-probe/README.md`).

## Findings (Roku Express 4K+, OS 16.0)

`focusFootprintBitmapUri` reads `""` and `focusFootprintBlendColor` reads `-1` on every list.

| Screenshot | Case | What the device draws |
| --- | --- | --- |
| `device-default.jpg` | default footprint | MarkupList and LabelList: a gray footprint **under** the item. MarkupGrid, RowList, PosterGrid: **nothing**. |
| `device-default-ontop-true.jpg` | default footprint, `ontop=true` | MarkupList's footprint moves **over** its box. MarkupGrid, RowList, PosterGrid: still **nothing**. |
| `device-green.jpg` | opaque footprint, unwritten | MarkupGrid, RowList, PosterGrid: **over** (text hidden). MarkupList and LabelList: **under**. |
| `device-green-ontop-false.jpg` | opaque footprint, written `false` | every node **under** |
| `device-green-ontop-true.jpg` | opaque footprint, written `true` | every node **over** |
| `device-rows-focused.jpg` | RowList focused | reference: the focus ring, and the lists' default footprints |

**Rule:**

- The footprint layers like the focus indicator (see `../focus-opaque-layer-probe`).
- Only lists have a built-in footprint. Grids and row lists draw one only when the app sets `focusFootprintBitmapUri`.

Two smaller differences seen here are not addressed yet: the device draws a RowList's set footprint 22 px left of the item (x=18 for an item at x=40), and a PosterGrid's exactly over the poster, where the engine outsets it.

## Engine

`ArrayGrid.builtinFootprintUri` is seeded only by LabelList, MarkupList and TimeGrid (TimeGrid not probed). `engine-default.jpg`, `engine-default-ontop-true.jpg` and `engine-green.jpg` are the engine after the fix (`snap.js`-style capture of the last frame).
