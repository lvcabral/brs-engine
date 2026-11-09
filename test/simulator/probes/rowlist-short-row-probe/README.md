# RowList Short Row Probe

This probe shows which column a RowList row change lands on when it enters a row whose items all fit on screen (a "short" row), and where the focus indicator travels during the change.

## Shape

The scene is HD. A RowList with `numRows = 3`, `rowItemSize = [[160, 100]]` and `rowItemSpacing = [[20, 0]]` has rows of 20, 2, 30 and 2 items; the 2-item rows fit on screen. The launch parameter `style` sets `rowFocusAnimationStyle` (ECP `launch/dev?style=fixedFocus`), and the console logs every `rowItemFocused` and `currFocusColumn`.

`drive.sh <style>` runs the scenario:

1. Right ×5 on row 0
2. Down into the short row
3. Right
4. Down into the 30-item row
5. Up back into the short row
6. Up into row 0

It takes a screenshot right after each row change and another once the change has settled. Set `ROKU_IP` and `ROKU_PASS` before running it.

## Findings (Roku Express 4K+, OS 16.0)

`rowItemFocused` after each step (`device-trace-<style>-os16.0.txt`):

| Step | `fixedFocusWrap` | `fixedFocus` | `floatingFocus` |
| --- | --- | --- | --- |
| row 0 col 5, Down into the short row | 1,0 | 1,0 | 1,1 (same screen slot, clamped) |
| Right | 1,1 | 1,1 | 1,1 (already last) |
| Down into the 30-item row | 2,0 | 2,0 | 2,1 |
| Up, back into the short row | **1,0** | 1,1 | 1,1 |
| Up into row 0 | 0,5 | 0,5 | 0,1 |

- **`fixedFocusWrap`**: a short row floats its focus (`device-wrap-short-row-right.jpg`), and it is entered on its **first item**, the one at the fixed focus slot, even after the focus left it on another item (`device-wrap-back-to-short-row.jpg`). A long row keeps its own column, which is the one at the slot.
- **`fixedFocus`**: a short row doesn't float. It scrolls so the focused item stays at slot 0, hiding item 0 (`device-fixed-back-to-short-row.jpg`), and it keeps its column.
- **`floatingFocus`**: the focus keeps its screen slot, clamped to the row.
- **During a row change**, the indicator glides sideways from its old screen slot to the target's at the pace of the change, crossing empty space when the slots differ. `device-floating-glide.jpg` catches it mid-way, moving from column 5 of row 0 toward column 1 of the short row.

## Engine

- `RowList.handleUpDown` enters a fitting `fixedFocusWrap` row on column 0.
- `glideIndicatorX` interpolates the indicator's x between its old position and the target slot during a row change.

Regressions are in `test/extensions/scenegraph/RowListFocusMotion.test.js`.
