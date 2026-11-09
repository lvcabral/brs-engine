# MarkupGrid Focus Resize Probe

This probe shows how a device moves and resizes a MarkupGrid's, a MarkupList's and a LabelList's focus indicator between items of different sizes. Draw geometry isn't observable from BrightScript, so the evidence is dev-mode screenshots taken mid-motion.

## Shape

The scene is HD. The MarkupGrid sits at `[100,90]` and has:

- 2 columns, `columnWidths="[120,420]"`;
- 8 rows alternating 60 and 200 px tall (`rowHeights`), with 20 px of spacing, and `numRows="4"`;
- 16 opaque item cells that fill their cell;
- the default focus ring (15 px outset).

The launch parameter `node=mlist` shows instead a MarkupList at the same place: 420 px wide, rows alternating 60 and 200 px tall, 20 px apart, the same opaque cells. `node=llist` shows a LabelList: 420 px wide, rows alternating 40 and 120 px tall, 20 px apart.

The launch parameter `style` sets `vertFocusAnimationStyle` (ECP `launch/dev?node=mlist&style=fixedFocusWrap`); the default is `floatingFocus`.

## Capture

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@markupgrid-focus-resize-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh floatingFocus
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh fixedFocusWrap
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh floatingFocus mlist     # or llist; also with fixedFocusWrap
```

`drive.sh` presses each key and takes a screenshot right away, which catches the motion mid-way, then another after the settle.

## Findings (Roku Express 4K+, OS 16.0)

Fractions are measured from the ring's inner edges (outer box minus the 15 px outset).

| Screenshot | Move | Ring mid-move |
| --- | --- | --- |
| `device-floating-right-moving.jpg` | I0 → I1 (120 → 420 wide) | x at 0.96 of the way, width at 0.95: grows as it moves |
| `device-floating-down-grow.jpg` | I0 → I2 (60 → 200 tall) | top at 0.93, height at 0.89: grows as it moves |
| `device-floating-down-shrink.jpg` | I2 → I4 (200 → 60 tall) | top at 0.60, height at 0.62: shrinks as it moves |
| `device-fixed-down-shrink.jpg` | I2 → I4, `fixedFocusWrap` | stays at the top, height at 0.64; the rows have moved up 0.64 × 220 px (the 200 px row plus its spacing) |
| `device-fixed-up-grow.jpg` | I5 → I3, `fixedFocusWrap` | stays at the top, height at 0.67; the rows have moved 0.68 × 220 px |

The lists do the same with their highlight (measured from its visible edges, so the fractions are approximate):

| Screenshot | Move | Highlight mid-move |
| --- | --- | --- |
| `device-markuplist-floating-shrink.jpg` | MarkupList row 1 → 2 (200 → 60 tall) | top and height both at about 0.89 |
| `device-markuplist-fixed-shrink.jpg` | the same, `fixedFocusWrap` | stays at the top, height at 0.88; the rows have moved 0.88 × 220 px |
| `device-labellist-floating-shrink.jpg` | LabelList row 1 → 2 (120 → 40 tall) | top and height both at about 0.70 |
| `device-labellist-fixed-shrink.jpg` | the same, `fixedFocusWrap` | stays at the top, height at 0.89; the labels have moved 0.89 × 140 px |

The indicator's top-left corner and size take one fraction between the two items' rects, in both directions and both styles, on the grid and both lists. Rows scroll by their own height plus spacing, not by `itemSize`. The engine follows this in `ArrayGrid.motionRowLayout` (MarkupGrid, PosterGrid, MarkupList, LabelList) and `gridMotionFocusRect`.

Not yet matched by the engine: in `fixedFocusWrap` the device draws one row past `numRows` with no bottom clip, at rest and while moving (`device-fixed-rest.jpg` shows a fifth row at the bottom). In `floatingFocus` it draws exactly `numRows` rows.
