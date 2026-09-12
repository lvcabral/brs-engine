# Pong Multi-Controller Probe

A small playable two-player Pong game used to exercise the `multi_controllers=1` manifest flag
(issue #1214): multiple simultaneous remotes without clobbering, the expanded game pad button
map, and the `roUniversalControlEvent.GetValue()` analog extension.

-   **Player 1** (left paddle, blue) is always the **Keyboard** - remote id `WD:0`.
-   **Player 2** (right paddle, red) is the first **Game Pad** that sends any input - remote id
    `BT:<n>`, bound dynamically from `GetRemoteID()` the first time it fires an event.

Both paddles can move at the same time without either player's key state getting clobbered or
delayed by the other's (the per-remote debounce/dedup fix in `BrsDevice.updateKeysBuffer()`), and
Player 2's paddle speed is driven by the live left-stick analog value via `GetValue()`, falling
back to fixed-speed digital Up/Down when no analog reading is available (flag off, or before the
pad's first input).

Before ever calling `GetValue()`, `main.brs` checks `roRemoteInfo.HasFeature("multi_controllers", 0)`,
a brs-engine capability flag that's `true` whenever this simulator build has the method at all,
independent of the manifest flag. That's what lets the same source keep running safely (falling back
to digital-only Player 2 control) on an older simulator build that predates issue #1214 and has no
`GetValue()` method to call.

Not a device-diffing probe - `GetValue()` and this flag have no real-Roku equivalent to diff
against (see `.claude/docs` guidance on probes). This one exists to explore/exercise the new
capability interactively, per the `test/simulator/probes/` convention in the repo's `CLAUDE.md`.

## Controls

| Action           | Player 1 (Keyboard) | Player 2 (Game Pad)                              |
| ---------------- | ------------------- | ------------------------------------------------ |
| Move paddle up   | Up Arrow            | Left stick up (analog) or D-Pad Up (digital)     |
| Move paddle down | Down Arrow          | Left stick down (analog) or D-Pad Down (digital) |
| Exit             | Esc / Backspace     | Back / Select button (index 8 in extended mode)  |

## Run it under the CLI (Player 1 only - keyboard)

`brs-cli` has no physical game pad polling (browser-only, see `docs/remote-control.md`), so under
the CLI only Player 1 is controllable interactively; Player 2's paddle just sits idle until it
sees synthetic input (e.g. via `sendKeyDown`/ECP). Still useful to confirm the app runs, renders,
and that the `multi_controllers=1` manifest flag round-trips correctly:

```sh
node packages/node/bin/brs.cli.js --root test/simulator/probes/pong-multi-controller-probe -a 120
```

Add `-i` instead of `-a 120` to render frames as terminal images, or `-d` for developer mode (Micro
Debugger on crash). With a TTY, the keyboard drives Player 1 directly - see
`docs/run-as-cli.md#controlling-the-app`.

## Run it in the browser (both players, real game pad)

1. Zip the probe (from this folder):

    ```sh
    cd test/simulator/probes/pong-multi-controller-probe
    zip -r ../pong-multi-controller-probe.zip manifest source images
    ```

2. `npm run build:web` from the repo root to build the engine and open the example web app.
3. Drag the `pong-multi-controller-probe.zip` file onto the page (or use the file picker) to load
   it - see `packages/browser/index.js` for the app-loading logic.
4. Connect a Bluetooth/USB game pad to the browser, press any button on it to bind it as
   Player 2, and play both paddles at once.

## What to look for

-   Press and hold Player 1's Up/Down (keyboard) at the same time Player 2 moves the stick/D-Pad -
    both paddles should track independently and instantly, with no stutter or dropped input on
    either side (that's the Bug 2/3 clobbering fix from issue #1214).
-   Tilting the left stick partway should move Player 2's paddle proportionally slower than a full
    D-Pad press or full stick deflection - that's `GetValue()` returning a live analog reading
    in `[-1, 1]` rather than the digital fallback of `0`/`1`.
-   Removing `multi_controllers=1` from the `manifest` reverts Player 2 to legacy behavior: digital
    Up/Down only (no analog speed control), and the pre-existing single-remote debounce clobbering
    returns if both players hold a direction at once.
