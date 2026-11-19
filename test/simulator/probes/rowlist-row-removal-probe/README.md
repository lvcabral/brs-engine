# RowList Row Removal Probe

Question: when an app removes a row from a RowList's content in place (`content.removeChildren([row])`) and
leaves the per-row `rowItemSize` / `rowHeights` / `showRowLabel` arrays as they were, which sizes do the rows
that move up get?

This mirrors an app's home grid: a one-item "banner" row 1 (`rowItemSize[1] = [1600,100]`) was removed by the
app, and the next row was then drawn as a single stretched item in the banner's slot.

## Cases

Both build a RowList with 5 rows (`featured`, `banner` (1 item), `recommended`, `movies`, `more`), per-row
`rowItemSize` `[[400,240],[1600,100],[220,300],[220,300],[220,300]]`, `rowHeights` `[320,140,380,380,380]`,
`showRowLabel` `[true,false,true,true,true]`, fixedFocus, focus on row 0.

- **A**: remove row 1 and leave the arrays alone, then press Down.
- **B** (control): remove row 1, then re-assign `rowItemSize`/`rowHeights` for the 4 rows left, then press Down.

Each phase dumps every item component (`rowIndex`, `index`, `itemContent.title`, `width`, `height`) and takes
a screenshot.

## Device result (Roku Express 4K+, OS 16.0.4)

- The per-row arrays stay indexed by **absolute row**. After the removal in A, the new row 1 (`recommended`)
  uses `rowItemSize[1]`: its items report `w=1600 h=100`, and `recommended-0` is drawn stretched in the old
  banner slot with `recommended-1` peeking at its right (`device-A-removed.jpg`). Down focuses it at that size
  (`device-A-down.jpg`).
- `showRowLabel` follows the same rule: in B the new row 1 has no label because `showRowLabel[1]` is still
  `false` (`device-B-removed.jpg`).
- The device recycles item components by content: the old banner component is reused for `more-0`, and
  the moved rows keep their components with `rowIndex` updated. Invisible item components report
  `sceneBoundingRect` `[0,0,w,h]`.

## Engine result

Matches the device on screen in A and B: same stretched cell, same focus landing, same missing label
(`engine-trace.txt`). Not matched (internal only, nothing visible): the engine keeps item components keyed by
position, so it re-pushes `itemContent` into the existing slot components instead of moving them, and it reports
scene coordinates for every item's `sceneBoundingRect`.

So the app's "stretched poster on the banner" is device behavior for content the app left inconsistent; it showed
up in the engine only because an ISO 8601 date with microseconds parsed as epoch 0, which made the app treat the
live event as ended and remove the banner row (fixed in `normalizeISO8601`).

## Running

```bash
./pack.sh                                                         # zip to sideload (do not commit it)
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-row-removal-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh                            # device-trace.txt + device-*.jpg
python3 drive-engine.py                                           # after npm run build:cli: engine-trace.txt + engine-*.png
```
