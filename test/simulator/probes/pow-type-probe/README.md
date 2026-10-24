# Pow Type Probe

Compares the type and value of `x ^ y` on a real Roku vs. brs-engine, for every pair of numeric types (`Integer`,
`LongInteger`, `Float`, `Double`), with negative, large and fractional operands. Written for #1283, after
`nan-format-probe` showed `2# ^ -1074` coming out as a `Float` 0 in the engine. `type(r, 3)` gives the exact numeric
type.

## Run

Device: `./pack.sh`, sideload `pow-type-probe.zip`, connect `telnet <roku-ip> 8085` right after the app launches (the
console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|` lines as
`device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/pow-type-probe
```

Output format: `PROBE|pow|<base>|<exponent>|<type>|<value>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-24)

The result type comes from both operands, and for two Integers from the sign of the exponent:

| `x ^ y` | Result |
| --- | --- |
| either is `Double` | `Double` |
| else either is `Float` | `Float` |
| else either is `LongInteger` | `Double` (even `2& ^ 2&`) |
| `Integer ^ Integer`, `y >= 0` | `Integer`, wrapping around like 32-bit multiplication (`2 ^ 31` is -2147483648, `3 ^ 40` is 689956897, the low 32 bits of the exact power) |
| `Integer ^ Integer`, `y < 0` | `Float` (`2 ^ -1` is 0.5, `2 ^ -1074` is 0) |

`^` binds tighter than unary minus (`-2 ^ 2` is -4, `-8# ^ 0.5#` is -2.82843) and is right-associative
(`2 ^ 3 ^ 2` is 512), as the language reference says.

Before #1283 the engine picked the type from the exponent alone (`Double ^ Integer` was a `Float`, `Double ^ LongInteger`
a `LongInteger` from a truncated base, `Integer ^ Integer` always a `Float`), parsed unary minus before `^`
(`-2 ^ 2` was 4, `-2 ^ 0.5` was nan) and made `^` left-associative (`2 ^ 3 ^ 2` was 64).

`engine-trace.txt` now matches `device-trace.txt` except for `1.1! ^ 2` with `%.17g`: the device prints the float32
value `1.2100000381469727`, the engine `1.21`, because it keeps a `Float` rounded to 7 significant digits. The e2e
fixture (`test/e2e/resources/pow-types.brs`) leaves that line out.
