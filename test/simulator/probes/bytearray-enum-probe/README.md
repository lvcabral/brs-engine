# ByteArray Enum Probe

Compares `for each` and `ifEnum` (`IsNext`/`Next`/`Reset`/`IsEmpty`) on `roByteArray` on a real Roku vs.
brs-engine, with `roArray` as a baseline. Written for PR #1273 (issue #1251: `for each` over a `roByteArray`
skipped the first byte and ended with `nan`).

| Section | What it checks |
| --- | --- |
| `each*` | `for each` over 4 bytes, 1 byte, empty, and high bytes (`00 7F 80 FE`); two loops in a row; nested loops over the same object; `exit for` and re-entering; `for each` after a manual `Next()`. |
| `fresh` / `next*` / `afterReset` | `IsEmpty`/`IsNext` on a new object, `Next()` through the end and twice past it, then `Reset()`. |
| `empty*` / `push*` | `Next()` on an empty object, before and after `Reset()`; `Push` after enumeration ended, with and without `Reset()`. |
| `*During` / `loopVarCopy` | `Push`, `Pop` and `c[i] = v` inside a `for each`; changing the loop variable. |

## Run

Device: `./pack.sh`, sideload `bytearray-enum-probe.zip`, connect `telnet <roku-ip> 8085` right after the app
launches (the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|`
lines as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/bytearray-enum-probe
```

Output format: `PROBE|<case>|<values...>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-23)

What the device does:

- `for each` over a `roByteArray` yields every byte in order as `Integer` (`1,2,3,4`; `0,127,128,254`), the same
  sequence `roArray` yields as `roInteger`. Every loop starts from the first element, also after `exit for` or a
  manual `Next()`, and nested loops each see the whole array.
- `Next()` past the end, and on an empty array, returns `invalid` on both types; `IsNext()` stays `false`.
- `Push` onto an exhausted or empty enumeration makes `IsNext()` `true` and `Next()` return the new element,
  without `Reset()`.
- `Pop` inside a `for each` behaves differently: `roArray` gives `1,2` and leaves 2 elements, while `roByteArray`
  gives `1,1,1` and leaves 0, as if each `Pop` restarts the byte array's enumeration.

`engine-trace.txt` matches the device except `ba.popDuring` (engine: `1,2,|2`, device: `1,1,1,|0`). Before PR
#1273 the engine skipped the first byte in every `for each` and ended it with `nan` (`2,3,4,nan`), and `Next()`
returned `Integer:nan` past the end and on an empty array.

`test/e2e/resources/components/bytearray-enum.brs` pins the device output, leaving out `ba.popDuring`.
