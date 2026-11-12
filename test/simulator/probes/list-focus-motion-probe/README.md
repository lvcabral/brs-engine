# List Focus Motion Probe

This probe records, frame by frame, how `LabelList` and `MarkupList` move their focus, so brs-engine can match the device. Each record carries milliseconds since the scene's `init()`. The probe logs:

- the list fields `itemFocused`, `itemUnfocused`, `currFocusRow`, `scrollingStatus` and `vertFocusDirection`;
- `focusPercent` and `itemHasFocus` for each MarkupList item, reported through a scene `callFunc` so every record shares one clock;
- a per-frame sample of the focus indicator and item sub-rects.

## Shape

The scene is HD and has four lists with 10 items each, `numRows = 4`, itemSize 400×48. Only one list is visible at a time:

- `LF`: LabelList, `floatingFocus`
- `LW`: LabelList, `fixedFocusWrap`
- `MF`: MarkupList (item component `ProbeItem`), `floatingFocus`
- `MW`: MarkupList (item component `ProbeItem`), `fixedFocusWrap`

Each list runs these steps, 2 s apart:

1. Down ×4
2. `Down_Down` (two presses 150 ms apart)
3. `HoldDown` (ECP keydown, 1.2 s, keyup)
4. `jumpToItem = 0`
5. Up (a boundary press, or a wrap)
6. `animateToItem = 6`
7. `jumpToItem = 1`
8. `skipFocusAnimations = true`, then Down, then back to false

The probe prints `PROBE|await|<Key>`, and a host driver answers with ECP. See `../panelset-slide-probe/README.md` for the driver, which uses `nc` and `curl`.

## Findings (Roku Express 4K+, OS 16.0)

**Field order.**

- The key press emits, at once: `scrollingStatus=true`, the old item's `itemHasFocus=false`, `itemUnfocused`, then `vertFocusDirection` (`down` or `up`).
- The settle comes ~17 ms after `currFocusRow` lands. It emits the new item's `itemHasFocus=true`, `itemFocused`, `scrollingStatus=false`, then `vertFocusDirection=none`.
- `itemFocused` therefore precedes the falling `scrollingStatus` edge, the same order the OS 15.3 RowList trace in `../list-refocus-settle-probe` shows (where `rowItemFocused` follows the edge). The engine uses this order on every path, instant moves included.
- Reading the `itemFocused` field mid-motion returns the old value.

**Motion.**

- Each row is a cubic ease-out of ~200 ms on `currFocusRow`. It snaps once within ~0.01 of the row (0.98 is followed by 1).
- `currFocusRow` wraps with the list: 9.99 is followed by 0.08 going down, and 0 is followed by 9.96 going up.
- `focusPercent` is `1 − fraction` on the item being left and `fraction` on the next one, so it tracks `currFocusRow`. At the settle it ends at 0 and 1.
- `itemHasFocus` is false for every item while moving.

**Repeated input.**

- A press arriving mid-row is queued. The next row starts as soon as the current one lands, under one `scrollingStatus` pulse with one `itemFocused`.
- A held key moves one row, pauses until ~400 ms after the press, then scrolls linearly at ~200 ms per row.
- During a hold, `itemFocused` and `itemUnfocused` don't fire. The settle waits for the release, even after a non-wrapping list has reached its end.

**Programmatic moves.**

- `animateToItem` is a single cubic ease-out over ~200 ms per row: 0→6 takes 1228 ms. On a wrapping list it scrolls down: 9→6 travels 7 rows in 1454 ms.
- `jumpToItem` is instant: `itemUnfocused`, `currFocusRow`, `itemFocused`, and no `scrollingStatus`.
- `skipFocusAnimations=true` is instant, but keeps the `scrollingStatus` true→false pair around the focus fields.

**Not observable.** Neither `localSubBoundingRect("itemN"/"focusIndicator")` nor the item components' `sceneBoundingRect()` moves during the motion. On the device both report the static layout, so `currFocusRow` is the only window onto the visual position.

## Known engine differences

- The CLI's ECP `keypress` holds the key for 300 ms, so on the engine single presses settle ~80 ms later and `Down_Down` loses its second press.
- On first focus the engine emits `itemUnfocused=-1`. On content assignment the device emits `currFocusRow=0`.
- On the engine, observers for a `jumpToItem` written from an observer are dispatched after the caller returns. This is the existing field-deferral behavior.
