# MarkupGrid Item Index Probe

Records which list and grid item components get the `index` field, when they get it, and how it follows a recycled
component while the list scrolls. `index` is documented for MarkupGrid items ("the index of this item in the
data model") but not for MarkupList items.

## Run

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@markupgrid-item-index-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh      # device
ENGINE=1 ./drive.sh                         # engine, after npm run build:cli
```

`drive.sh` answers each `PROBE|<seq>|await|Down|` line with an ECP keypress and writes `$OUT_DIR/trace.txt`.
Committed: `device-trace-os16.0.txt` (Roku Express 4K+, OS 16.0.4) and `engine-trace.txt`.

## Shape

`IndexItem` declares `index` and `rowIndex` (both default `-1`). Each instance takes a serial in `init()` and
prints `PROBE|item|<case>|index|…` on every `index` change and `PROBE|item|<case>|content|…` on every
`itemContent` change.

| Case | Node | Content |
| --- | --- | --- |
| G | MarkupGrid, 3 columns × 2 rows | 30 items `G0`…`G29` |
| S | MarkupGrid, 3 columns × 2 rows | 2 sections (`contentType = "SECTION"`) of 4 items, `S<section>.<i>` |
| L | MarkupList, 3 rows | 30 items `L0`…`L29` |

Each case renders, then gets Down ×4.

## Findings (device, OS 16.0.4)

- **`index` is set before `itemContent`**, on MarkupGrid **and on MarkupList**: every component prints its
  `index` change and then its content, which already shows the index (`serial=1 index=0`, then
  `content=G0 index=0`).
- **With sections, `index` counts items across sections**, not dividers. `S1.0` gets 4.
- **A recycled component gets its new `index` before its new content.** In case L, serial 57 shows `L22` with
  `index=22`, then `index=16`, then `L16` with `index=16`.
- `rowIndex` is never set on MarkupGrid or MarkupList items.
- The device creates components ahead of the visible window (case G creates 30 at `idle`, case L creates its
  wrap-around neighbour `L29` at once). The engine creates one per item drawn and keeps it in its position,
  so it sets `index` once, at creation (`ArrayGrid.renderItemComponent`).
