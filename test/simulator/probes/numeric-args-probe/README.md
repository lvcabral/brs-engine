# Numeric Args Probe

Compares how built-in methods with `Integer` parameters treat their arguments on a real Roku vs. brs-engine. It
covers every method whose signature used `ValueKind.Int32 | ValueKind.Float`. `ValueKind` is an ordinal enum, so
that expression is just `ValueKind.Float`, and every argument was coerced to `Float` before the method saw it.

| Section | What it checks |
| --- | --- |
| `slice1` / `slice2` | `roArray.Slice` and `roByteArray.Slice` with one and two arguments. |
| `signedByte` / `signedLong` | `roByteArray.GetSignedByte` / `GetSignedLong`. |
| `crc` / `crc1` / `crc2` | `roByteArray.GetCRC32()` with no, one and two arguments. |
| `resize` | `roByteArray.SetResize(minSize, false)`, then `Capacity()`/`IsResizable()`. |
| `delete` | `roByteArray.Delete`, with `roArray.Delete` alongside. |
| `exif` | `roImageMetadata.GetRawExifTag(ifd, tagnum)` and the tag AA from `GetRawExif()`, on `images/exif.jpg` (generated with Pillow: `Make` in IFD 0, `DateTimeOriginal` in the EXIF IFD, `GPSLatitudeRef` in the GPS IFD). |

Each is called with `Integer`, `Float`, `Double`, `LongInteger` and boxed arguments, a `LongInteger` past 32 bits,
negative and out-of-range values, and string, `invalid` and boolean arguments.

## Run

Device: `./pack.sh`, sideload `numeric-args-probe.zip`, connect `telnet <roku-ip> 8085` right after the app launches
(the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|` lines as
`device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/numeric-args-probe
```

Output format: `PROBE|<case>|<values...>`. Engine output is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-22)

`device-trace.txt` and `engine-trace.txt` match line for line. What the device does:

- Every `Integer` parameter accepts any numeric type, intrinsic or boxed. `Float`/`Double` are truncated toward
  zero, and a `LongInteger` keeps only its low 32 bits. A string, `invalid` or boolean is a Type Mismatch (error
  24), including an explicit `invalid` as `Slice`'s end.
- `Slice` counts a negative start or end from the end of the array (`Slice(-1)` is the last element,
  `Slice(1, -1)` drops the first and last).
- `GetSignedByte`/`GetSignedLong` return 0 for a negative or out-of-range index.
- `GetCRC32` has no one-argument form (error 244, Member Function Not Found). With two arguments, a negative start
  or a length below 1 gives 0 (the CRC of no bytes), and a range past the end is clamped. The result is a signed
  `Integer`.
- `SetResize` never sets the capacity below the current length.
- `Delete` returns `false` for a negative or out-of-range index.
- `GetRawExifTag` returns an empty AA for an unknown IFD (`-1`, `5`) or a missing tag. A tag AA has `tag` (`roInt`)
  and `value` (`roString`), from both `GetRawExifTag` and `GetRawExif`.

Before PR #1270 the engine:

- read a big `LongInteger` as its `Float` value;
- crashed with a JavaScript `RangeError` on `GetSignedLong(-1)`;
- accepted a one-argument `GetCRC32`, returned the whole-array CRC for `(0, 0)`, and saturated CRCs above 2³¹ to
  2147483647;
- fell back to the EXIF IFD for an unknown IFD;
- named the tag value `tagValue` and stored it as a plain `String`.

`test/e2e/resources/components/numeric-args.brs` pins the device output. It embeds `images/exif.jpg` as hex and
writes it to `tmp:/`.
