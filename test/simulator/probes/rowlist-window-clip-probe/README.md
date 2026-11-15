# RowList Window Clip Probe

Screenshots of where a RowList **at rest** cuts its rows: at the bottom of its `numRows` window (with or without
the trailing row spacing), and whether the focus ring of a focused bottom row is cut. Complements
`../rowlist-clip-probe`, which covers motion.

## Run

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-window-clip-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
```

The driver answers `PROBE|<seq>|await|shot|name=<n>` with a `plugin_inspect` screenshot saved as
`device-<n>.jpg`, and `await|Down` with an ECP keypress.

## Shape

FHD scene. A RowList at y=100 with `itemSize=[1720,200]`, `itemSpacing=[0,40]`, `numRows=2`,
`rowItemSize=[[300,190]]` and floating focus on both axes; 4 rows, so rows 0 and 1 fill the window (100–300 and
340–540) and row 2 would start at 580. Each `ClipItem` draws its 300×190 poster and a 20×400 red marker
column. Guide lines: green 300 (row 0's bottom), yellow 500 (2 × row height), cyan 540 (the window without the
trailing spacing), magenta 580 (with it).

## Findings (Roku Express 4K+, OS 16.0.4)

| Screenshot | Focus | What is cut |
| --- | --- | --- |
| `device-rest.jpg` | row 0 | row 0's markers at 300 (the focused row at its row height); **row 1's markers at 580**; the ring above row 0 pokes above the list top (y≈88) |
| `device-row1.jpg` | row 1 (Down, no scroll) | row 1's markers at 540 (the focused row at its row height); row 0's markers run to their own end (500) |

- **At rest the rows are cut at the bottom of the window**, i.e. `numRows` rows and their spacings **including
  the trailing one** (580). This is the same window the device cuts while the rows scroll
  (`../rowlist-clip-probe`), but at rest the top is not cut.
- The focused row is also cut at its row height, a separate clip (`docs/limitations.md`).

The engine cuts the window bottom at rest too (`RowList.renderContent`, `windowLayoutHeight`). It still doesn't
cut the focused row at its row height.

Not measured: a window slot with no row, e.g. below the last row of a `fixedFocus` list (hero-grid-channel's
`numRows=9` grid on its last row). The engine counts such a slot at the default pitch (`itemSize.y` + row
spacing), so the window still spans all `numRows` slots and the last row's posters and focus ring are not cut at
the row's own height.
