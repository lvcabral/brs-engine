# Grid OK Mid-Motion Probe

This probe answers what a MarkupGrid publishes when OK is pressed while its focus is still moving. It came from a Rokanban regression: the team screen tracks the focused board from `itemFocused` and opens it on `itemSelected`, so an OK pressed before the motion settled opened the board focused before the move.

## Shape

The scene is HD. A 4-column, 3-row MarkupGrid holds 16 items; its item component (`ProbeItem`) is a box with a label. The scene logs, with the ms since `init()`: `itemFocused`, `itemUnfocused`, `itemSelected`, `scrollingStatus`, `currFocusColumn`, `currFocusRow`, and every key that reaches its `onKeyEvent`.

## Capture

`ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh . out.txt` sideloads the probe, opens one long console session, and sends key pairs through ECP with tight gaps. ECP `keypress` calls sent back to back land OK about 60–200 ms into a step, which takes about 330 ms on a grid.

- `device-trace-midmotion-os16.0.txt`: the pairs were Right+OK, Right then OK after 120 ms, Down+OK, and Left, Left+OK. That run used an earlier version of the driver with these pairs.
- `device-trace-rest-os16.0.txt`: the pairs are Right+OK, Right then OK after 600 ms (the step has settled), then OK alone. This is what `drive.sh` sends now.

## Findings (Roku Express 4K+, OS 16.0)

**OK during a move lands it first.** In every mid-motion pair:

1. The settle goes out at once: `itemFocused` (the target), `scrollingStatus` false, the final `currFocusColumn`/`currFocusRow`.
2. `itemFocused` is published again, with the same value.
3. `itemSelected` (the target).
4. Then OK reaches the scene's `onKeyEvent`.

With a queued press (Left, Left+OK), the motion lands on the queued target.

**OK at rest publishes only `itemSelected`.** This holds both after a settled move and with no move at all: there is no extra `itemFocused`.

## Engine

`ArrayGrid.handleKey` lands a running motion before OK reaches `handleOK` (`landMotionForSelect`). On lists and grids it then publishes `itemFocused` again. RowList and ZoomRowList weren't measured, so they only land the motion. Regression: "OK during a move lands it before itemSelected" in `test/extensions/scenegraph/GridFocusMotion.test.js`.
