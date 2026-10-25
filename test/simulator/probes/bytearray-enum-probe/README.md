# ByteArray Enum Probe

Compares `for each` and `ifEnum` (`IsNext`/`Next`/`Reset`/`IsEmpty`) on `roByteArray` on a real Roku vs.
brs-engine, with `roArray` and `roList` as baselines. Written for PR #1273 (issue #1251: `for each` over a `roByteArray`
skipped the first byte and ended with `nan`).

| Section | What it checks |
| --- | --- |
| `each*` | `for each` over 4 bytes, 1 byte, empty, and high bytes (`00 7F 80 FE`); two loops in a row; nested loops over the same object; `exit for` and re-entering; `for each` after a manual `Next()`. |
| `fresh` / `next*` / `afterReset` | `IsEmpty`/`IsNext` on a new object, `Next()` through the end and twice past it, then `Reset()`. |
| `empty*` / `push*` | `Next()` on an empty object, before and after `Reset()`; `Push` after enumeration ended, with and without `Reset()`. |
| `*During` / `loopVarCopy` | `Push`, `Pop` and `c[i] = v` inside a `for each`; changing the loop variable. |
| `r2.<op>` / `r1.<op>` | One mutation (`Pop`, `Shift`, `Delete`, `Clear`, `Append`, `Unshift`, `Push`, `c[0] =`, and on `roByteArray` also `SetResize`, `FromHexString`, `FromAsciiString`, `FromBase64String`, `ReadFile`) applied once inside a `for each` over `01020304`, on reading the second (`r2`) or first (`r1`) element: does the loop restart, continue, or follow the element? Written for issue #1275. |
| `r3.<op>` | `Delete(1)`, `Delete(2)` and `Delete(last)` on reading the third element: before, at and after the current position. |
| `manualPop` / `nextThenPop` | `Pop` during a manual `IsNext`/`Next` loop, and after two `Next()` calls outside a loop. |
| `unshiftAfterEnd` / `unshiftEmpty` / `unshiftCleared` / `afterEnd.*` / `zeroPopShift` | `Unshift` after the enumeration ended and onto an empty or cleared object; `Delete`, `Pop` and `Shift` after it ended; `Pop` and `Shift` returning a `0` element. |

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
- On `roByteArray`, `Pop`, `Shift`, `Delete` (at any index) and `Unshift` restart the enumeration at the first
  element, inside a `for each` and in a manual `Next()` loop alike (`ba.popDuring`: `1,1,1` and 0 left; `ba.r2.pop`:
  `1,2,1,2,3`). `Clear`, `Append`, `Push`, `c[i] =`, `SetResize`, `FromHexString`, `FromAsciiString`,
  `FromBase64String` and `ReadFile` don't: the enumeration continues at the same index into the new contents.
- On `roArray`, nothing restarts. `Pop`, `Shift`, `Clear`, `Append`, `Push` and `c[i] =` keep the index; `Delete(i)`
  at or before the current element and `Unshift` move it so the enumeration continues at the same element
  (`arr.r2.delete0`: `1,2,3,4`; `arr.r3.delete2`: `1,2,3,4`; `arr.r2.unshift`: `1,2,3,4`). `Unshift` after the
  enumeration ended, or onto an empty or cleared array, leaves it ended (`IsNext()` `false`), unlike `Push`;
  so do `Delete`, `Pop` and `Shift` after the enumeration ended (`arr.afterEnd.*`).
- `roList` behaves like `roArray`, except that `Shift` also keeps the enumeration on the same element
  (`list.r2.shift`: `1,2,3,4`; `arr.r2.shift`: `1,2,4`).
- `Pop` and `Shift` on a `roByteArray` return a `0` byte as `Integer:0`.

`engine-trace.txt` matches the device. Before PR #1273 the engine skipped the first byte in every `for each` and
ended it with `nan` (`2,3,4,nan`), and `Next()` returned `Integer:nan` past the end and on an empty array. Before
issue #1275 the engine didn't restart a `roByteArray` enumeration on `Pop`/`Shift`/`Delete`/`Unshift`, kept the
`roArray` index on `Delete`/`Unshift`, restarted an ended `roArray` enumeration on `Delete`/`Pop`/`Shift`, and returned `invalid` for a `0` byte from `roByteArray` `Pop`/`Shift`.

`test/e2e/resources/components/bytearray-enum.brs` pins the device output.
