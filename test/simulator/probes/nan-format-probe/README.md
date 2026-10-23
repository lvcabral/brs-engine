# NaN Format Probe

Compares how NaN, infinite and negative-zero `Float`/`Double` values are written, and what `Val()` returns, on a
real Roku vs. brs-engine. Written for PR #1270, after `numeric-args-probe` showed the engine printing `-NaN` and
`Infinity` and returning 0 for `Val("nan")`.

| Section | What it checks |
| --- | --- |
| `float-*` / `double-*` | `nan` (`Sqr(-1)`), `-nan` (negated), `inf` (`1e38 * 1e38`, `1e308# * 10#`), `-inf` and `-0`, through `ToStr()`, `Str()`, a boxed `ToStr()`, `ToStr("%f")`/`%g`/`%e`/`%5.2f`, `FormatJson`, `print` and `print` of an array. |
| `plain` | `print` of ordinary Float, Double and Integer values, for the spacing. |
| `val` / `val10` | `Val(s)`, `Val(s, 10)` and `Val(s, 16)` for numbers with trailing text, whitespace, exponents, hex, signs, `nan`/`inf`/`infinity` spellings, and out-of-range values. |
| `radix` | `Val(s, radix)` overflow, negatives, radix 0 (auto), 2, 8, 36 and invalid radixes. |

`0! / 0!` is a divide-by-zero error (20) on the device, so NaN comes from `Sqr(-1)`.

## Run

Device: `./pack.sh`, sideload `nan-format-probe.zip`, connect `telnet <roku-ip> 8085` right after the app launches
(the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|` and printed
lines as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/nan-format-probe
```

Output format: `PROBE|<case>|<values...>`, with `print` output between `print-begin`/`print-end`. Engine output is
`engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-22)

`device-trace.txt` and `engine-trace.txt` match except for whitespace in `print` (see Open). What the device does:

- NaN is `nan`, or `-nan` when its sign bit is set (`-Sqr(-1)`, `Val("-nan")`); infinity is `inf`/`-inf`; negative
  zero is `-0`. This holds for `ToStr()`, boxed values, `print`, arrays and `FormatJson` (`[nan]`, `[-inf]`).
- `Str()` adds a leading space only without a negative sign: ` nan`, ` inf`, `-nan`, `-0`. `print` does the same.
- Format strings write `nan`/`inf` for `%f`/`%g`/`%e`, honoring the width (`%5.2f` is `  nan`); `-0` keeps its sign
  (`-0.000000`, `-0`, `-0.000000e+00`, `-0.00`).
- `Val(s)` reads the longest numeric prefix like C's `strtod`: leading whitespace, a sign, decimal or `0x` hex,
  an exponent, `inf`/`infinity`/`nan` in any case (`"12abc"` is 12, `"1e"` is 1, `"nanx"` is nan, `"1e999"` is inf,
  `"&h1A"` and `"--5"` are 0). The result is a `Float`.
- `Val(s, radix)` reads the longest prefix like C's `strtol` and returns an `Integer`, even with a `.` in the string
  (`Val("1.5", 10)` is 1). Radix 0 picks 16 for `0x`, 8 for a leading `0`, else 10; radix 16 accepts `0x`; a radix
  outside 0 and 2-36 gives 0. Radix 10 clamps to the Integer range; other radixes keep the low 32 bits, saturating
  past 32 unsigned bits (`"ffffffff"` and `"100000000"` hex are -1, `"-ffffffff"` hex is -2147483648). Overflow with
  radix 0 is not tested; the engine treats it by the radix it resolves to.

Before PR #1270 the engine wrote `-NaN`/`NaN`/`Infinity`, lost the sign of a negated NaN and of `-0` (the `Float`
constructor and unary minus dropped them), returned 0 for any `Val(s)` that `Number()` rejects, and parsed
`Val(s, radix)` as a float whenever `s` contained a `.`.

Open: `print` writes a space after every `Float`/`Double` on the device (` 5.5 `, `print a; "|"; b` is
` 5.5 | 2.25 | 7`), not after an `Integer`. The engine does not, for any float, so the e2e fixture
(`test/e2e/resources/stdlib/nan-format.brs`) leaves out the `print a; "|"; b` lines.
