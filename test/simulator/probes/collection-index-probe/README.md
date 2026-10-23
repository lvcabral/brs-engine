# Collection Index Probe

Compares indexed reads and writes on `roByteArray`, `roArray`, `roList` and `roXMLList` on a real Roku vs.
brs-engine, for every numeric index type, through both `c[i]` and `GetEntry`/`SetEntry`. Written for the
follow-up to PR #1267 (issue #1249), which changed how `roByteArray` reads an element.

| Section | What it checks |
| --- | --- |
| `read` | `c[i]` and `c.GetEntry(i)` with `Integer`, `Float`, `Double`, `LongInteger` and boxed (`Box()`) indexes, negative indexes (`-1`, `-0.5`, `-1.5`), out of range (`3`), and `4294967297` as `LongInteger` and `Double`. |
| `write` | `c[i] = v` and `c.SetEntry(i, v)` with `Integer`, `Float`, `Double`, `LongInteger` and boxed `LongInteger` indexes, then every slot read back. |
| `entryType` / `entryCopy` | `type()` of a `roByteArray` element, and that changing it does not change the array. |
| `entryArgs` | `GetEntry`/`SetEntry` with `4294967297&` and with string, `invalid` and boolean indexes. |
| `stored` | `type()` of `invalid`, a boolean, `Float`, `Double`, a string literal (direct or through a variable) and a computed string stored by `SetEntry` vs. `c[i] = v`. |
| `print` | `print` of a 102-byte `roByteArray` (the 100-entry display limit). |

## Run

Device: `./pack.sh`, sideload `collection-index-probe.zip`, connect `telnet <roku-ip> 8085` right after the app
launches (the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|`
lines as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/collection-index-probe
```

Output format: `PROBE|<case>|<values...>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-22)

`device-trace.txt` and `engine-trace.txt` match line for line. What the device does:

- Every numeric index type works on all four collections, for reads and writes, through `c[i]` and
  `GetEntry`/`SetEntry`. `Float`/`Double` indexes are truncated toward zero, so `-0.5` reads element 0 and `-1.5`
  is out of range. A `LongInteger` keeps only its low 32 bits (`4294967297&` reads element 1). A `Double` past the
  32-bit range is out of range.
- Negative and out-of-range indexes read `invalid`.
- A string, `invalid` or boolean index to `GetEntry`/`SetEntry` is a Type Mismatch (error 24).
- `SetEntry` stores like `Push`: `roInteger`, `roBoolean`, `roFloat` (also for a `Double`), `roInvalid`, and
  `roString` for a string literal.
- `c[i] = v` stores the plain type: `Integer`, `Boolean`, `Float`, `Double`, `Invalid`, and `String` even for a
  string literal. A computed string is `String` either way.
- A `roByteArray` element is an `Integer` copy of the byte.
- The `print` output matches the engine.

Before PR #1270 the engine read `invalid` for every `Double` and `LongInteger` index through `c[i]`, ignored
`c[i] = v` with those indexes on `roArray`/`roList`/`roXMLList`, coerced `GetEntry`/`SetEntry` indexes to `Float`
(so `4294967297&` missed, and `roByteArray.SetEntry(4294967297&, v)` tried to grow the array to 4 GB), stored
`SetEntry` values with their plain type, and stored index-assigned string literals as `roString`.

`test/e2e/resources/components/collection-index.brs` pins the device output.
