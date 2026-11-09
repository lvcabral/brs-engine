# RowList Hero Grid Probe

This probe reproduces the RowList of Roku's hero-grid-channel sample with local content. It shows how the focus indicator changes size between rows of different item sizes, whether the row counter is drawn during a row change, and which column a row change lands on in "The Grid", a block of rows whose items all fit on screen.

## Shape

The scene is FHD. The RowList has the sample's fields: `rowFocusAnimationStyle="FixedFocusWrap"`, `focusXOffset="[165]"`, `rowHeights="[800,300,615]"`, `rowItemSize="[[1600,700],[375,197],[375,526],[375,197]]"`, `rowItemSpacing="[[30,0]]"`, labels on every row but the first, counters on the first three rows. The rows are:

- row 0: 15 hero items (1600x700);
- row 1, "Action": 15 landscape items (375x197);
- row 2, "Drama": 15 portrait items (375x526);
- rows 3 to 6, "The Grid": 4, 4, 4 and 3 landscape items, which all fit on screen.

Each cell is an opaque colored rectangle labeled with its row and column. The scene prints `PROBE|rowItemFocused=<row>,<col>` on every change.

## Capture

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-hero-grid-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
```

`drive.sh` presses each key and takes a screenshot right away, which catches a row change mid-way, and saves the console trace to `trace.txt`.

## Findings (Roku Express 4K+, OS 16.0)

`device-trace-os16.0.txt` is the trace of the full scenario: Down into Action, Right three times, Down into Drama and The Grid, Right twice, Down twice and back Up into Drama, then Down into The Grid again, Right three times and Down to the 3-item row.

| Step | Lands on |
| --- | --- |
| The Grid row 3 at column 2, Down, Down | 4,2 then 5,2: grid rows keep the column |
| back Up from row 5 at column 2 | 4,2 then 3,2 |
| Up from row 3 into Drama | 2,0: a long row keeps its own column |
| Down from Drama into row 3, left at column 2 before | 3,0: the column at the indicator's slot, not the remembered one |
| row 5 at column 3, Down into the 3-item row | 6,2: clamped to the last item |

A fitting `fixedFocusWrap` row is entered at the indicator's screen slot, clamped to its items. From a long row the indicator is at slot 0, so that is column 0 (as `../rowlist-short-row-probe` found).

Mid-move screenshots (the ring's outset is 12 px):

| Screenshot | Move | Ring mid-move |
| --- | --- | --- |
| `device-hero-to-action-moving.jpg` | 1600x700 → 375x197 | 1102x495: width and height both 0.41 of the way; the rows have scrolled 0.41 of the 800 px row |
| `device-action-to-drama-moving.jpg` | 375x197 → 375x526 | 375x456: 0.79 of the way; the rows have scrolled 0.79 of the way |
| `device-drama-to-grid-moving.jpg` | 375x526 → 375x197 | 375x301: 0.68 of the way; the rows have scrolled 0.68 of the way |

The ring grows or shrinks from the old row's item size to the new row's at the pace of the row change. Its top is the target row's item top from the start. No row counter is drawn during a row change: compare the mid-move screenshots with `device-drama-rest.jpg`, which shows "1 of 15".

The engine follows this in `RowList.columnAtIndicator`, `glideIndicator` and `renderRowCounter`.
