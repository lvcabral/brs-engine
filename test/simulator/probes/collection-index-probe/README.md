# Collection Index Probe

Compares indexed reads and writes on `roByteArray`, `roArray`, `roList` and `roXMLList` on a real Roku vs.
brs-engine, for every numeric index type, through both `c[i]` and `GetEntry`/`SetEntry`. Written for the
follow-up to PR #1267 (issue #1249), which changed how `roByteArray` reads an element.

| Section | What it checks |
| --- | --- |
| `read` | `c[i]` and `c.GetEntry(i)` with `Integer`, `Float`, `Double`, `LongInteger` and boxed (`Box()`) indexes, negative indexes (`-1`, `-0.5`, `-1.5`), out of range (`3`), and `4294967297` as `LongInteger` and `Double`. |
| `write` | `c[i] = v` and `c.SetEntry(i, v)` with `Integer`, `Float`, `Double`, `LongInteger` and boxed `LongInteger` indexes, then every slot read back. |
| `entryType` / `entryCopy` | `type()` of a `roByteArray` element, and that changing it does not change the array. |
| `print` | `print` of a 102-byte `roByteArray` (the 100-entry display limit). |

## Run

Device: `./pack.sh`, sideload `collection-index-probe.zip`, capture `telnet <roku-ip> 8085`, keep the `PROBE|`
lines as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/collection-index-probe
```

Output format: `PROBE|<case>|<values...>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-22)

What the device does:

- Every numeric index type works on all four collections, for reads and writes. `Float`/`Double` indexes are
  truncated toward zero, so `-0.5` reads element 0 and `-1.5` is out of range. A `LongInteger` keeps only its
  low 32 bits (`4294967297&` reads element 1). A `Double` past the 32-bit range is out of range.
- Negative and out-of-range indexes read `invalid`.
- `SetEntry` stores a number like `Push` does (`roInteger`); `c[i] = v` stores it as `Integer`.
- A `roByteArray` element is an `Integer` copy of the byte.
- The `print` output matches the engine.

Before the fix the engine read `invalid` for every `Double` and `LongInteger` index through `c[i]`, ignored
`c[i] = v` with those indexes on `roArray`/`roList`/`roXMLList`, and stored `SetEntry` values as `Integer`.

Open: `GetEntry(4294967297&)` reads `invalid` in the engine (element 1 on the device). Built-in method
arguments are coerced to one numeric kind (`ValueKind.Int32 | ValueKind.Float` is `Float`, since `ValueKind`
is not a bit set), so the `LongInteger` loses its low bits before `GetEntry` sees it.

`test/e2e/resources/components/collection-index.brs` pins the device output, apart from the open case.
