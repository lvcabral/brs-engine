# return-value-probe

Checks how a `return` leaves a function on paths that don't go through a normal BrightScript call:
a component's `init()` and `callFunc`.

| Line | Case |
| --- | --- |
| `plainInit` | `init()` ends on `if true then return`; `CreateObject` must still return the node. |
| `plainTypedFloat` | `callFunc` on a function declared `as float` that returns `1`. |
| `plainTypedBool` | `callFunc` on a function declared `as boolean` that returns `1`. |
| `gotoInit` | `init()` jumps to a label inside an `if` with `goto`, then `return`s. |
| `typedFloatCallFunc` | Same as `plainTypedFloat`, on the `goto` component. |
| `directGotoReturn` | A direct call to a function `as float` that `goto`s a label, then `return 2`. |

## Results

Device: Roku Express 4K+, OS 16.0 (`device-trace-os16.0.txt`). Engine: `engine-trace.txt`.

- `init()` returns the node in both forms. Before PR #1336, the engine crashed on any `return` in
  `init()` (`Return must return a value`); with the PR alone, the `goto` form still crashed.
- `callFunc` converts the returned value to the declared return type, and the caller gets it boxed
  (`roFloat`, `roBoolean`). **The engine still returns the raw `Integer`**: this is the one known
  difference, left for a separate fix.

## Running

```sh
ROKU_IP=<ip> ROKU_PASS=<password> ./run-device.sh   # writes device-trace.txt
cd test/simulator/probes/return-value-probe && zip -qr /tmp/rvp.zip manifest source components && brs-cli /tmp/rvp.zip
```
