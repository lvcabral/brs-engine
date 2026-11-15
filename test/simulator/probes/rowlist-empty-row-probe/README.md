# RowList Empty Row Probe

How a RowList treats content rows that have no items. It records the `rowIndex` of the items, `rowItemFocused`
while Down moves the focus across an empty row, `jumpToRowItem` aimed at content row indexes, and the layout.

## Run

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-empty-row-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh      # device: trace + device-rest.jpg, device-down2.jpg
ENGINE=1 ./drive.sh                         # engine, after npm run build:cli
```

Committed: `device-trace-os16.0.txt` (Roku Express 4K+, OS 16.0.4), `engine-trace.txt`, `device-rest.jpg` and
`device-down2.jpg`.

## Shape

FHD scene. A RowList at `[100,100]` with `itemSize=[1720,200]`, `numRows=4`, `rowItemSize=[[300,140]]`, labels
and counters on and the default `fixedFocus`. The content rows are `empty0` (no items), `row1` (3 items),
`empty2` (no items), `row3` (2 items) and `row4` (3 items). Items are titled with their **content** row index
(`R3C0` is child 0 of content row 3). The steps are: rest, Down, Down, `jumpToRowItem=[3,1]`, then
`jumpToRowItem=[1,1]`.

## Findings (device, OS 16.0.4)

- **An empty row is a row.** Items report their content row index as `rowIndex` (`R3C0 rowIndex=3`), and
  `rowItemFocused` and `jumpToRowItem` use content row indexes too.
- **An empty row takes the focus, with column -1.** The list starts at `[0,-1]` on the empty row 0. Down goes
  to `[1,0]`, then to the empty row 2 at `[2,-1]`. `jumpToRowItem=[3,1]` lands on `[3,1]`.
- **It keeps its slot and its label.** In `device-rest.jpg`, `empty0` and `empty2` each take a full 200 px slot
  with their label. There is no counter on an empty row, and the focus ring of a focused empty row is drawn
  where its first item would be (`device-rest.jpg` on `empty0`, `device-down2.jpg` on `empty2`).

The engine used to drop empty rows from its row model, which shifted every later row's `rowIndex`,
`rowItemFocused` and `jumpToRowItem`. It now matches the trace above record for record.

Not measured: OK on a focused empty row. The engine leaves the key unhandled, since there is no item to
select. ZoomRowList still drops empty rows; it has not been probed.
