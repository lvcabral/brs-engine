# dynamic-keyboard-modes-probe

Drives a `DynamicKeyboard` through its shift, caps-lock and character-set keys and records the
`keyGrid.mode` and `text` after each selection, plus a screenshot of every step.

Each step is one host round trip: ECP `Play` makes the scene move focus to the step's key
(`keyGrid.jumpToKey`) and print `PROBE|ready|<n>|<name>`, then ECP `Select` presses that key.
`run-device.sh <ip> <password> <outdir>` sideloads the probe, runs every step, saves
`<outdir>/NN.jpg` (taken after step NN-1) and the console trace.

## Device result (Roku Express 4K+, OS 16.0.4, `device-trace.txt`)

Shift and caps lock are separate states:

- **Shift is one-shot.** In lower case it toggles `<Set>Lower` ↔ `<Set>Shift` (letters shown in
  uppercase, the caps-lock key stays unchecked: `device-ABC123Shift.jpg`). The next key of any
  other kind — a character, digit, space, delete or a cursor key — clears it back to `<Set>Lower`.
- **Shift under caps lock** keeps `<Set>Upper`; the device rewrites the mode (observers fire) on
  the shift press and again on the key that consumes it.
- **Caps lock** toggles `<Set>Upper` ↔ `<Set>Lower`, also from `<Set>Shift` (→ `<Set>Upper`).
- **Character-set keys** (`abc123` / `symbols` / `accents`) keep caps lock and drop shift
  (`ABC123Shift` → `SymbolsLower`, `SymbolsUpper` → `AccentsUpper`).

Navigation: the scene also prints each Dynamic keyboard's `keyGrid` wrap fields at start-up. Only
`DynamicKeyboard` turns on `horizWrap` (`true`, `vertWrap=false`); `DynamicMiniKeyboard`,
`DynamicPinPad` and `DynamicCustomKeyboard` keep the spec defaults (both `false`). On Roku's
dynamic-voice-enabled-keyboards sample, left/right move within the current row and wrap to its
far key (Left on shift → caps lock, Left on the cursor-left key → accents, and back with Right);
up/down at the top/bottom edge are not handled and reach the scene's `onKeyEvent`.

Every mode keeps the full grid of each section: short rows keep their column widths and missing
keys/rows are drawn as empty cells (`device-SymbolsUpper.jpg`, `device-AccentsLower.jpg`,
`device-AccentsUpper.jpg`), matching Roku's reference Wi-Fi KDF, which pads them with blank `{}`
keys.

Engine: `DynamicKeyboardBase.applyKey` implements the shift/caps model, and the built-in
`dynamicKeyboardKDF` (`nodes/kdf/builtinKDFs.ts`) pads its rows like the reference. Regressions:
the "shift and caps lock" tests and "every mode lays out each section as a full grid" in
`test/extensions/scenegraph/DynamicKeyboard.test.js`.
