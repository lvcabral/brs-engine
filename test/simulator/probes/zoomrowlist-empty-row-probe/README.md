# ZoomRowList Empty Row Probe

The ZoomRowList version of `../rowlist-empty-row-probe`: how content rows with no items are treated. It uses the
same content and steps; the ZoomRowList has `rowWidth=1720`, 200 px rows and 300×140 items, with titles and
counters on.

## Run

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@zoomrowlist-empty-row-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh      # device: trace + device-rest.jpg, device-down2.jpg
ENGINE=1 ./drive.sh                         # engine, after npm run build:cli
```

Committed: `device-trace-os16.0.txt` (Roku Express 4K+, OS 16.0.4), `engine-trace.txt`, `device-rest.jpg` and
`device-down2.jpg`.

## Findings (device, OS 16.0.4)

- **An empty row is a row**, as in a RowList. Items report their content row index (`R3C0 rowIndex=3`), and
  `jumpToRowItem=[3,1]` lands on `[3,1]`.
- **An empty row takes the focus with column 0, not -1** (a RowList reports -1). The list starts at `[0,0]` on
  the empty row 0, and Down from row 1 goes to `[2,0]`.
- **It keeps its slot and its title**, with no counter, and a focused empty row draws the focus ring in its
  first item slot (`device-rest.jpg`, `device-down2.jpg`).

The engine used to drop empty rows; it now matches all of the above. Not measured: OK on an empty row (the engine
leaves it unhandled).

Other differences in the trace, not about empty rows:

- `jumpToRowItem` publishes `rowItemFocused` twice on the device, the row first at column 0, then the target
  (`[3,0]`, `[3,1]`). The engine publishes it once.
- The device creates the items of the row below the window (row 4) at load; the engine creates them when drawn.
