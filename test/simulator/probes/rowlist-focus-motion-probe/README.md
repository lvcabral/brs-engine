# RowList Focus Motion Probe

This probe records, frame by frame, how `RowList` and `ZoomRowList` move their focus across and within rows, so brs-engine can match the device. Each record carries milliseconds since the scene's `init()`. The probe logs:

- the list fields `itemFocused`, `itemUnfocused`, `rowItemFocused`, `rowFocused`, `rowUnfocused`, `currFocusRow`, `currFocusColumn`, `scrollingStatus`, `vertFocusDirection` and `horizFocusDirection`;
- item `focusPercent`, `rowFocusPercent`, `rowHeightPercent`, `itemHasFocus` and `rowHasFocus` (the row-level fields only for column 0), reported through a scene `callFunc`.

## Shape

The scene is HD and has four lists of 4 rows × 8 items, with 2 rows visible. Only one list is visible at a time:

- `RF`: RowList with its defaults (`floatingFocus` within rows, `fixedFocus` vertically)
- `RW`: RowList, `rowFocusAnimationStyle = fixedFocusWrap`
- `RV`: RowList, `vertFocusAnimationStyle = floatingFocus`
- `ZR`: ZoomRowList

Each list runs these steps, 2 s apart:

1. Right, Right, Left
2. Down, Down, Up
3. `Down_Down` (two presses 150 ms apart)
4. `jumpToRowItem [0,0]`
5. `HoldRight`
6. `jumpToRowItem [0,0]`
7. `HoldDown`
8. `jumpToRowItem [0,0]`
9. `animateToItem` / `animateToRow` = 2
10. `jumpToRowItem [0,0]`
11. `skipFocusAnimations` + Down + Right

The driver is the one described in `../panelset-slide-probe/README.md`.

## Findings (Roku Express 4K+, OS 16.0)

**Timing and values.**

- Every step is a cubic ease-out of **~330–340 ms** on either axis, on both nodes.
- `rowFocusPercent` follows the row fraction: `1 − f` on the row being left, `f` on the next row. The old and new items' `focusPercent` follow the same weights.
- `currFocusRow` and `currFocusColumn` move fractionally, as on lists and grids.

**RowList, row change.**

1. Opening: `scrollingStatus=true`, the old item's `itemHasFocus=false`, `itemUnfocused`, `vertFocusDirection`.
2. Landing: `currFocusRow`, `rowFocusPercent`, `focusPercent`.
3. One frame later: `itemFocused`, the rows' `rowHasFocus` swap, `scrollingStatus=false`, `rowItemFocused`, `itemHasFocus`, `vertFocusDirection=none`.

**RowList, move along a row.**

- Opening: `scrollingStatus=true` and the old item's `itemHasFocus=false`.
- Settle: `rowItemFocused`, `itemHasFocus`, then `scrollingStatus=false`. Here `rowItemFocused` precedes the falling edge.
- There is no `horizFocusDirection` and no `itemUnfocused`.

**RowList, other behavior.**

- An app's `jumpToRowItem` is instant and publishes **no** `itemFocused`/`itemUnfocused`. The field stays stale, so a later `itemUnfocused` reports the stale value.
- While a held key pauses before repeating, a RowList publishes an interim `rowItemFocused` and `itemHasFocus=true`, and drops `itemHasFocus` when the repeat begins.
- `animateToItem` eases ~330 ms per row.

**ZoomRowList.**

- It is not an ArrayGrid on the device: it lacks `vertFocusDirection`, `horizFocusDirection`, `skipFocusAnimations`, `numRows` and `vertFocusAnimationStyle`.
- Row change opening: `scrollingStatus=true`, the old row's `rowHasFocus=false`, the old item's `itemHasFocus=false`, `rowUnfocused`.
- Row change settle: `currFocusRow`, **`scrollingStatus=false`**, the new row's `rowHasFocus` and item's `itemHasFocus`, `rowFocused`, `rowItemFocused`.
- Move along a row: `scrollingStatus=false`, then `rowItemFocused`, then `itemHasFocus`.
- `rowHeightPercent` carries the same values as `rowFocusPercent`.
- `animateToRow` is faster than key steps, **~265 ms per row**.

**Layering.** A RowList draws its moving ring over the cells (`../grid-focus-layer-probe/device-rowlist-glide.jpg`).

## Known engine differences

- The device never writes the leaving row's `rowFocusPercent` all the way to 0 (it stops at its last value above ~0.15). The engine writes 0.
- The device re-writes the final percents after a ZoomRowList settles.
- The CLI's ECP `keypress` holds keys for 300 ms, which drops the second press of `Down_Down`. The device repeats a held key slightly faster (~300 ms per step, vs ~320 ms on the engine).
