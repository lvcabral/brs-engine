# Sparse Array Probe

Compares what `roArray` holes (entries never set, e.g. `a = []: a[1] = 1` leaves index 0 unset) yield on a real
Roku vs. brs-engine.

| Case | What it checks |
| --- | --- |
| `forEach` / `manualNext` | `for each` and `IsNext`/`Next` over `[<hole>, 1, <hole>, 3]`. |
| `index` / `getEntry` | `a[i]` and `GetEntry(i)` on a hole and past the end. |
| `peekShift` / `popTail` | `Peek`, `Shift` and `Pop` returning a hole. |
| `deleteHole` / `deleteHoleDuring` | `Delete` on a hole: return value and count, and where a `for each` continues. |
| `join` / `isInvalid` / `append` / `json` | `Join` with a hole, `= invalid`, `Append` of a sparse array, `FormatJson`. |

## Run

Device: `./pack.sh`, sideload `sparse-array-probe.zip`, connect `telnet <roku-ip> 8085` right after the app
launches (the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|`
lines as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/sparse-array-probe
```

Output format: `PROBE|<case>|<values...>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-24)

- A hole reads as `invalid` (`Type` `Invalid`) everywhere: `for each`, `Next()`, `a[i]`, `GetEntry`, `Shift`,
  `Pop`.
- `Delete` on a hole returns `true` and removes it; a `for each` stays on the same element
  (`deleteHoleDuring`: `invalid,1,invalid,3`).
- `Append` skips holes (`[9]` plus `[<hole>,1,<hole>,3]` has 3 entries), `FormatJson` writes them as `null`
  (`[null,1,null,3]`), and `Join` warns and returns an empty string.

Before this probe the engine crashed on a hole in a `for each` (it yielded a JavaScript `undefined`), `Delete` on a
hole returned `false`, and `FormatJson` wrote `[,1,,3]`.

`engine-trace.txt` matches the device except the `Join` warning text, which goes to stderr (engine: `roArray.Join:
Array contains non-string value(s).`; device: `BRIGHTSCRIPT: ERROR: roArray.Join: non-string value at index 0:`).

`test/e2e/resources/components/sparse-array.brs` pins the device output.
