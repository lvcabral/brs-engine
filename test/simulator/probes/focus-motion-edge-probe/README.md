# Focus Motion Edge Probe

This probe answers three questions that came up in the PR review of the list focus motion:

1. What does a list publish when the focus is taken away while its focus is moving?
2. What does it publish when the focus comes back while the move is still running?
3. Does an item lose `itemHasFocus` when a hidden list loses the focus?

It also checks how a `limitSize` Poster draws with only one of `width` and `height` set.

## Shape

The scene is HD. It is scripted with a Timer, so no keys are needed.

- A MarkupList at `[60,40]`: 10 items, `itemSize [400,50]`, `floatingFocus`. Its item component (`ProbeItem`) prints every `itemHasFocus` change.
- A focusable Rectangle (`other`) that takes the focus away from the list.
- Four Posters showing a 400x200 image (a circle on a 2:1 canvas) with `loadDisplayMode="limitSize"`, `loadWidth`/`loadHeight` 200. They have only `width` 300 (`pW`), only `height` 300 (`pH`), neither (`pNone`), or both 250 (`pBoth`). A dark Rectangle behind each one marks its set size.

The steps, each logged with the time in ms since `init()` and a sample of the list's fields:

- **A:** `animateToItem = 3`. 150 ms later, `other.setFocus(true)`. After the settle, `list.setFocus(true)`, then `jumpToItem = 0`.
- **B:** `animateToItem = 3`. 150 ms later, `other.setFocus(true)`, and 100 ms after that, `list.setFocus(true)`, so the focus returns before the settle.
- **C:** the list is hidden (`visible = false`), then `other.setFocus(true)`. Then the list is shown and refocused.
- **D:** the list is hidden, then `list.setFocus(false)`. Then it is shown and refocused.

`Main()` sleeps 8 s before it creates the screen, because the device console drops its clients when an app launches.

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh                 # packs, sideloads, captures out/device-trace.txt + out/device-posters.jpg
./pack.sh && brs-cli focus-motion-edge-probe.zip       # engine trace (the PROBE| lines)
```

`drive.sh` reconnects to the console port (8085) until one session lasts the whole run, and takes a screenshot when the probe prints `shot`.

## Findings (Roku Express 4K+, OS 16.0, `device-trace-os16.0.txt`)

**A: focus taken mid-motion.**
- The motion runs to its end. `currFocusRow` reaches 3, and the settle publishes only `scrollingStatus` false.
- No `itemFocused` fires. The field still reads 0, the item the motion left.
- When the focus returns, the target item gets `itemHasFocus` true and `itemFocused` fires 3, with no `itemUnfocused`.

**B: focus regained mid-motion.**
- At the regain, while still moving (`scrollingStatus` true, `currFocusRow` 2.45), the target item gets `itemHasFocus` true and `itemFocused` fires 3.
- The motion goes on, and its settle fires `itemFocused` 3 again, then `scrollingStatus` false.
- The target item keeps `itemHasFocus` true until the settle.

**C and D: a hidden list losing focus.** The focused item's `itemHasFocus` drops to false inside the `setFocus` call, before it returns. This happens both when another node takes the focus and when the list calls `setFocus(false)`. Showing the list again changes nothing. Refocusing it sets `itemHasFocus` true and fires `itemFocused` 0, with no `itemUnfocused`.

**Posters (`device-posters-os16.0.jpg`).** `limitSize` clamps the 400x200 image to 200x100, then a set extent is filled and an unset one keeps the clamped size. The device draws:
- `pW` at 300x100;
- `pH` at 200x300;
- `pNone` at 200x100;
- `pBoth` at 250x250.

The circle is stretched in every case where the set size isn't 2:1. `boundingRect()` reports the same sizes. The engine already draws exactly this (`engine-posters.jpg`, a half-size frame), so the one-extent case needs no change.

## Engine

`engine-trace.txt` is the engine running this probe after the fixes. The engine:
- doesn't write `itemFocused` when a motion settles outside the focus chain, and lands a later focus gain on the motion's target (`ArrayGrid.unfocusedSettleIndex`);
- publishes the target item's `itemHasFocus` and then `itemFocused` when the focus returns mid-motion (`publishMotionRegain`). RowList and ZoomRowList weren't measured, so they keep publishing only at the settle;
- drops the item's `itemHasFocus` when the list's `focusedChild` shows it has left the focus chain, rather than at its next render.

The remaining differences from the device trace are older and outside this probe's questions:

- The engine emits `itemUnfocused` (the current item) on every focus gain. The device emits none in A, C or D. After an unfocused `jumpToItem`, the device did emit `itemUnfocused=-1`, so its rule needs a probe of its own.
- The engine delivers the focus fields raised by a `setFocus` or `jumpToItem` called from inside an observer (the Timer's) after that observer returns. The device delivers them before the call returns.
- On `jumpToItem` while focused, the engine fires the new item's `itemHasFocus` before `itemUnfocused`. The device fires `itemUnfocused` first.
- At startup, the engine fires the list's `itemUnfocused=-1` and `itemFocused=0` before `init()` ends. The device fires `itemFocused=0` after it. The device trace starts at `start`, so anything the device printed before that line isn't captured.
