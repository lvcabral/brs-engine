# RowList Clip Probe

This probe shows whether a device clips a RowList's item components, at rest and while the focus moves. Clipping isn't observable from BrightScript, so the evidence is dev-mode screenshots.

## Shape

The scene is HD. A RowList at y = 200 has `itemSize = [1160, 150]`, `itemSpacing = [0, 20]`, `numRows = 2` and `rowItemSize = [[160, 100]]`, so its two visible rows span y 200 to 520. Thin green bars behind the list mark y = 196 and y = 520. Each `ProbeItem` cell draws:

- a 160x100 blue poster stand-in;
- a caption at y 104 to 134, below the poster (outside `rowItemSize`, inside the row height);
- an orange 40x30 marker at y 140 to 170, crossing the row's bottom edge (150).

Play switches the list to `floatingFocus`, so the focus can rest on the bottom row.

## Capture

The same technique as `../grid-focus-layer-probe/README.md`: relaunch, hold the key with ECP `keydown`, take a `plugin_inspect` screenshot, then `keyup`.

## Findings (Roku Express 4K+, OS 16.0)

| Screenshot | State | What is clipped |
| --- | --- | --- |
| `device-rest.jpg` | at rest, focus on row 0 | the **focused row** at its row height (its markers show 10 px); row 1 draws in full |
| `device-hold-right.jpg` | moving along row 0 | the same as at rest; captions are intact |
| `device-floating-row1.jpg` | at rest, `floatingFocus`, focus on row 1 | row 1 (the focused row) at its row height; row 0 draws in full |
| `device-hold-down.jpg` | scrolling down | **no row**; one window clip from the list's top to the bottom of the last row **plus** one row spacing (y 540 here), cutting the row entering from below |

- The focus ring is drawn outside the row clip: at rest it pokes above the row top.
- Every row is also cut at the list's right edge (x = 1220). The engine already does this.

## Engine

- A move along a row pushes no clip. A row change clips the scrolling rows to the window: each visible row's layout height (the row height, grown by the label/counter band when the band doesn't fit) plus its spacing, the last one included (`RowList.windowLayoutHeight`). ZoomRowList also clips only on a row change.
- Known difference: the engine doesn't clip the focused row to its row height, at rest or while moving along it. Drawing that clip needs the focus ring moved out of the row's item pass.
