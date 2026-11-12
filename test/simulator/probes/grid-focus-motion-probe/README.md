# Grid Focus Motion Probe

This probe records, frame by frame, how `MarkupGrid` and `PosterGrid` move their focus on both axes, so brs-engine can match the device. Each record carries milliseconds since the scene's `init()`. The probe logs:

- the grid fields `itemFocused`, `itemUnfocused`, `currFocusRow`, `currFocusColumn`, `scrollingStatus`, `vertFocusDirection` and `horizFocusDirection`;
- `focusPercent` and `itemHasFocus` for each MarkupGrid item, reported through a scene `callFunc`.

## Shape

The scene is HD and has four grids with 15 items each, `numColumns = 3` and `numRows = 2`, so vertical moves scroll. Only one grid is visible at a time:

- `GF`: MarkupGrid, `floatingFocus`
- `GW`: MarkupGrid, default style (`fixedFocusWrap`)
- `PF`: PosterGrid, `floatingFocus`
- `PW`: PosterGrid, default style

Each grid runs these steps, 2 s apart:

1. Right ×3 (the third press is at the end of the row)
2. Left
3. Down ×3
4. `Down_Down` (two presses 150 ms apart)
5. `HoldDown` (ECP keydown, 1.2 s, keyup)
6. `jumpToItem = 0`
7. Up
8. `HoldRight`
9. `animateToItem = 7` (a diagonal move)
10. `jumpToItem = 1`
11. `skipFocusAnimations = true`, then Down, then back to false

The driver is the one described in `../panelset-slide-probe/README.md`.

## Findings (Roku Express 4K+, OS 16.0)

**Same model as the lists, slower, on two axes.**

- Each step is a cubic ease-out of **~330 ms** on either axis: `currFocusColumn` is 0.5 at +70 ms and 0.94 at +204 ms, and lands at +337 ms. A wrapping (`fixedFocusWrap`) row step takes **~315 ms**.
- As on lists, the field stops changing near the target and lands when the step's time is up. The settle follows ~17 ms later.

**Directions.**

- `horizFocusDirection` exists on the device (`left`/`right`/`none`). It is not in the reference.
- It is emitted for column moves exactly where `vertFocusDirection` is emitted for row moves: after `itemUnfocused`, and back to `none` after the falling `scrollingStatus` edge.

**Field order.** It is the list order:

1. `scrollingStatus=true`, the old item's `itemHasFocus=false`, `itemUnfocused`, the direction
2. in-transit values
3. `currFocusRow` or `currFocusColumn` lands
4. the new item's `itemHasFocus=true`, `itemFocused`, `scrollingStatus=false`, the direction back to `none`

**Boundaries.** Right at the end of a row does nothing: no wrap to the next row, no notifications. A floating grid's Up at the top and Down at the bottom do nothing either.

**`focusPercent`** is the step fraction, split between the cell being left and the next one. A cell's value reads 0 once it falls below ~0.05 (0.063 is followed by 0).

**Held key.**

- One step, then a pause until ~530 ms after the press (lists pause ~400 ms).
- Repeats follow at the step pace. The first repeat accelerates from rest (~370 ms); later ones run at a steady ~315 ms per row.
- A repeat into the last cell of a row eases out from rest (~300 ms).
- On release, the step in flight eases out over the remaining distance. `itemFocused` fires only after the release.

**`animateToItem`** moves both axes at once, each over `cells × step` (7 from 2: one column in ~330 ms and two rows in ~680 ms).

- Both directions open (`horizFocusDirection=left`, then `vertFocusDirection=down`).
- The column's direction resets as soon as that axis lands. The row's direction resets after the settle.
- During the diagonal, `focusPercent` appears to follow the row axis only. The engine uses the product of both axes, an approximation for this rare case.

**Other.** `jumpToItem` is instant and emits no `scrollingStatus`. `skipFocusAnimations` is instant, but keeps the pulse.

**Side notes.**

- `focusRow` and `focusColumn` read back as arrays on the device.
- `wrapDividerHeight` reads 36 in HD (the engine uses 24).

## Known engine differences

- When an app writes `jumpToItem` from an observer (here, a Timer's), the device dispatches the focus observers synchronously, before the writer continues. The engine defers them until the caller returns. This is the existing field-deferral design (`Field.enterInternalUpdate`), and it is worth probing on its own.
- The CLI's ECP `keypress` holds the key for 300 ms, which drops the second press of `Down_Down`.
- On first focus the engine emits `itemUnfocused=-1`. On content assignment the device emits `currFocusRow`/`currFocusColumn=0`.
