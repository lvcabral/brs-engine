# RowList Motion Rect Probe

Question: while a RowList scrolls, does `subBoundingRect("item<row>_<col>")` follow the motion, or does it
report a static layout as a MarkupList does (`list-focus-motion-probe`)?

The list is shaped like a home grid. It has tall poster rows (`rowItemSize [310,442]`, `rowHeights 530`,
labelled) around a one-item banner row 1 (`[1613,120]`, height 160, no label). It uses fixedFocus on both
axes and a `focusXOffset` of 490 on row 0. Every change of `currFocusRow`, `currFocusColumn`,
`scrollingStatus` and `rowItemFocused` logs the rects of `item0_0`, `item0_1`, `item1_0`, `item2_0` and
`item3_0` (x, y, width, height in the list's own space).

Moves: Down, Up, Right, Left, Down, Down, Up. Then `skipFocusAnimations = true` and Up, Right, Left, Down.

## Device result (Roku Express 4K+, OS 16.0.4)

- **Rects follow the motion on every frame.** Down from row 0 reports `item0_0` y at 36 → 1.8 → −40.9 …
  −530, and Right reports its x at 490 → 470 … 164. Each frame fits these exactly:
  - y of the rows: `rowTop(row) − rowsHeight(p) + band(p)`, where `p` is the `currFocusRow` the observer
    receives;
  - x of the sliding row's cells: `cellX − (column progress) × pitch`.
- **`itemsY` uses the focused row's label band for every row.**
  - With row 0 focused (label, band 36), the label-less banner reports y 566 = 530 + 36. A device
    screenshot (`device-rest.jpg`) shows it drawn at 530.
  - With the banner focused (no band), labelled row 2 reports 160, not 196.
  - While the focus moves between two rows, the band blends between theirs: at `p` = 0.0604, item0_0 is at
    −32.0 + 33.83 = 1.83, and the device reports 1.826.
- **`skipFocusAnimations = true` makes only a row change instant.** The order is `scrollingStatus` true,
  `currFocusRow`, `scrollingStatus` false, then `rowItemFocused` twice. A move along a row still animates,
  with fractional `currFocusColumn` and sliding rects. So a device never makes a horizontal RowList move
  instant.

## Engine result

The engine matches on every in-transit frame and at rest (`engine-trace.txt`), through
`RowList.motionScrollY` / `cellX` / `focusBandHeight`. With `skipFocusAnimations` it lands row changes
at once and still slides moves along a row (`RowList.skipsFocusAnimation`). Pinned by "item sub-rects while
moving" in `test/extensions/scenegraph/RowListFocusMotion.test.js`.

Known differences:

- The frame count and easing differ slightly. Each frame still fits the device formulas.
- At the opening `scrollingStatus=true` of a move along a row, the engine already reports the target
  column's rects (device: the column being left). On an instant row change, it reports the rows being
  left (device: a mix, the target row's tops with the old row's band).
- An instant row change publishes `rowItemFocused` once. The device publishes it twice.

## Running

```bash
./pack.sh                                                         # zip to sideload (do not commit it)
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-motion-rect-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh                            # device-trace.txt
python3 drive-engine.py                                           # after npm run build:cli: engine-trace.txt
```
