# Focus Opaque Layer Probe

This probe shows how a device layers the focus indicator against an item's content, at rest and while the focus moves. Every node uses a fully opaque orange focus bitmap (`images/solid.png`, or the 9-patch `images/solid.9.png`), and every item is plain white text. If the indicator is drawn over an item, its text disappears. Layering isn't observable from BrightScript, so the evidence is dev-mode screenshots.

## Shape

The scene is HD, with these nodes:

- `side`: MarkupGrid, one column, `floatingFocus`
- `side2`: MarkupGrid, one column, default style, with `drawFocusFeedbackOnTop="false"` in its XML
- `mlist`: MarkupList, `floatingFocus`
- `list`: LabelList, `floatingFocus`
- `rows`: RowList, one row
- `pgrid`: PosterGrid, one row (no poster images, so it shows only the indicator)

Launch parameters, passed through ECP `launch/dev?…`:

- `target=<id>` focuses that node.
- `ontop=false|true` writes `drawFocusFeedbackOnTop` on every node from BrightScript.
- `bitmap=9` switches every node to the opaque 9-patch.

The probe prints each node's `drawFocusFeedbackOnTop` value to the console.

## Capture

Relaunch with the parameters, hold Down (or Right for `rows`/`pgrid`) with ECP `keydown`, take a `plugin_inspect` screenshot, then `keyup`. This is the same technique as `../grid-focus-layer-probe/README.md`.

## Findings (Roku Express 4K+, OS 16.0)

Every node **reads** `drawFocusFeedbackOnTop=false` until the app writes it.

| Screenshot | Node, `drawFocusFeedbackOnTop` | Indicator vs. item text |
| --- | --- | --- |
| `device-default-rest.jpg` | MarkupGrid, never written | **over** (text hidden) |
| `device-default-moving.jpg` | MarkupGrid, never written | **over** |
| `device-written-false-rest.jpg` | MarkupGrid, written `false` | **under** (text visible) |
| `device-written-false-moving.jpg` | MarkupGrid, written `false` | **under** |
| `device-xml-false-moving.jpg` | MarkupGrid, `false` in XML | **under** |
| `device-written-true-moving.jpg` | MarkupGrid, written `true` | **over** |
| `device-rowlist-default.jpg` | RowList, never written | **over** |
| `device-rowlist-written-false-moving.jpg` | RowList, written `false` | **under** |
| `device-markuplist-default-moving.jpg` | MarkupList, never written | **under** |
| `device-markuplist-written-true-moving.jpg` | MarkupList, written `true` | **over** |

- The 9-patch bitmap (`bitmap=9`) layers the same way as the plain one.
- LabelList matches MarkupList.
- PosterGrid draws over while unwritten.

**Rule:**

- A written value (XML attribute or BrightScript) is honored on every node, at rest and while moving.
- Left unwritten, grids and row lists draw the indicator over their items, and lists draw it under.

## Engine

`ArrayGrid.focusFeedbackOnTop()` implements the rule (`focusOnTopWritten`, plus `focusOnTopByDefault()`, which is `false` for LabelList and MarkupList), and every rest and motion draw site asks it.

MarkupGrid's field default was `true` in the engine; it is now `false`, as on the device and in the reference.
