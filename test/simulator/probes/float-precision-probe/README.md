# Float Precision Probe

Compares how a real Roku and brs-engine store a `Float` (the float32 value, or a 7-digit decimal), and how `Float`
and `Double` values are written by `Str()`, `ToStr()`, `ToStr(format)`, `print`, `FormatJson` and boxed objects.
Also covers conversion between `Float` and `Double`, comparisons, `Int()`/`Cint()`, math functions, subnormal results
of `^`, and `Str()` of `Integer`/`LongInteger`. Written for #1286. `type(x, 3)` gives the exact numeric type.

## Run

Device: `./pack.sh`, sideload `float-precision-probe.zip`, connect `telnet <roku-ip> 8085` right after the app
launches (the console drops its clients on launch; the probe waits 5 seconds before printing), keep the lines from
`PROBE|start` to `PROBE|done` as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/float-precision-probe
```

Output format: `PROBE|<case>|<type>|str=|tostr=|g9=|g17=|json=|boxed=`, plus `print` output between markers. Engine
output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-24)

- A `Float` holds its exact float32 value: `1.1!` is `1.1000000238418579` with `%.17g`, `16777217!` is `16777216`,
  `1.1! = 1.1#` is false, and `1 / 3 * 3 = 1` is true (float32 arithmetic). A `Float` assigned to a `Double`
  (`d# = 1.1!`, `1.1! + 1#`) keeps that value. Subnormal results (`10 ^ -45`, `7 ^ -53`) round to float32 like
  `Math.fround` of the double result.
- `ToStr()`, the boxed `ToStr()` and `print` of a `Float` use `%g` (6 significant digits). `ToStr()` of a `Double`
  also uses `%g`; `print` of a `Double` uses `%.14g` (`0.33333333333333`, `9.007199254741e+15`), also inside arrays
  and associative arrays.
- `Str()` converts its argument to a `Float` and writes `%.7g`, for every numeric type: `Str(1# / 3#)` is
  ` 0.3333333`, `Str(1e300#)` is ` inf`, `Str(2166136261&)` is ` 2.166136e+09`, `Str(16777217)` is ` 1.677722e+07`.
- `FormatJson` of a `Float` or `Double`: a whole number is written in full when it is small enough (`123456792`,
  `2147483648`, `12345678848`, `-16777217`), other whole numbers with 10 significant digits (`9.999999981e+18`,
  `1.23456789e+300`, and `9.007199255e+15` for 2^53), and anything else with `%g` (`1.23457e+11` for
  `123456789012.5#`). The engine writes whole numbers in full below 2^53; the probe only shows that the device's limit
  is between `12345678848` and 2^53.
- A literal of 10 or more digits with a `!` suffix is a `Float` (`0.000123456789!`, `12345678901!`).

Before #1286 the engine stored a `Float` rounded to 7 decimal digits (so `%.9g`/`%.17g`, comparisons with `Double`,
`Int(16777217!)` and values above 2^24 differed, and `16777217!` was 16777220, which is not a float32), wrote a
`Double` with all its digits in `print`, `Str()` and `FormatJson`, kept every digit of a `LongInteger` in `Str()`,
and rejected `!` after a literal of 10 or more digits.

`engine-trace.txt` matches `device-trace.txt` except for the two `print a; b` lines: a device prints a space after
every `Float`/`Double` there (see `nan-format-probe`). The e2e fixture (`test/e2e/resources/stdlib/float-precision.brs`)
leaves them out.
