# setFocus Return Probe

This probe answers what `setFocus(true)` returns, especially when a `focusedChild` observer moves the focus somewhere else before the call returns.

## Shape

The scene is HD. A Timer runs the cases 0.5 s after `init()`, with no keys needed. Each case calls `setFocus(true)` on one node and prints the return value, the node's `hasFocus()` and `isInFocusChain()`, and the scene's focus chain, by node id.

| Case | Node | What happens |
| --- | --- | --- |
| A | a plain Group | nothing else |
| B | the same Group | it already has the focus |
| C | a Group container | its `focusedChild` observer forwards the focus to its child |
| D | a Group container | its observer moves the focus to a node outside it |
| E | a Group | its own observer moves the focus to another node |
| F | a ButtonGroup | it forwards the focus to its button by itself |
| G | a Group with `focusable="false"` | nothing else |
| A2–E2 | as A–E, with `focusable="true"` Groups | |

A plain Group's `focusable` is false by default, so A–E and A2–E2 tell "returns `focusable`" apart from "returns whether the focus landed on the node".

## Capture

Sideload, launch, and keep the `PROBE|` lines from the console (port 8085). Engine: `brs-cli --root test/simulator/probes/setfocus-return-probe`.

## Findings (Roku Express 4K+, OS 16.0, `device-trace-os16.0.txt`)

- `setFocus(true)` returns the node's `focusable` value, wherever the focus ends up: A–E return false and A2–E2 return true, including C2–E2, where an observer moved the focus away before the call returned.
- A node with `focusable="false"` still takes the focus (G), and `hasFocus()` is true.
- A ButtonGroup returns true and puts the chain on its button: the scene's chain ends `/buttons/` (the button has no id), and the group's `hasFocus()` is false.

## Engine (`engine-trace.txt`)

The engine matches every line but F: it keeps the focus on the ButtonGroup itself (`hasFocus=true`, chain `/buttons`) and points `sgRoot.focused` at the button without writing the links.

The probe's Timer callback was first named `run`. The device ran it; the engine refused the component ("Cannot create a named function with reserved name 'run'"). It is named `runCases` so both run it.
