# Regex PCRE Probe

Checks which PCRE-only patterns `roRegex` accepts on a real Roku and how they match, and what `CreateObject`
does with an invalid pattern. Written for PR #1274 (issue #1255: a PCRE-only pattern crashed brs-engine with an
uncaught JavaScript `SyntaxError`).

| Cases | What they check |
| --- | --- |
| `issue1255`, `emptyMinus`, `emptyGroup` | Empty option-setting groups `(?-)` and `(?)`. |
| `inline*` | Inline options `(?i)` at the start and mid-pattern, scoped `(?i:...)`, `(?-i)` against the `i` flag, `(?s)`, `(?m)`, `(?x)`. |
| `possessive` … `hexBrace` | Possessive quantifiers, atomic groups, `\A`/`\z`, `(?#...)` comments, `(?P<n>...)`/`(?P=n)` and `(?<n>...)`/`\k<n>` named groups, POSIX classes, `\p{Lu}`, lookbehind, `\Q...\E`, `\x{41}`. |
| `classLiteral`, `escapedGroup` | `(?-` spelled inside a character class and escaped, where it is not a group. |
| `invalid*` | Patterns PCRE rejects, inside `try`. |
| `untried` | An invalid pattern outside `try`. |

Each case prints `type()` of what `CreateObject` returns, then `IsMatch` for each subject, or `catch|<number>|<message>`
if it threw.

## Run

Device: `./pack.sh`, sideload `regex-pcre-probe.zip`, connect `telnet <roku-ip> 8085` right after the app launches
(the console drops its clients on launch; the probe waits 5 seconds before printing), keep the `PROBE|` lines as
`device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/regex-pcre-probe
```

## Results (Streaming Stick, OS 15.3.4, 2026-10-23)

What the device does:

- Every PCRE construct in the probe compiles and matches as PCRE documents it, including `(?-)`, `(?)`, inline and
  scoped options, possessive quantifiers, atomic groups, `\A`/`\z`, named groups in both syntaxes, POSIX classes,
  `\p{...}`, `\Q...\E` and `\x{...}`.
- An invalid pattern does not throw, even outside `try`. `CreateObject` prints
  `BRIGHTSCRIPT: ERROR: roRegex: Invalid pattern: pkg:/source/main.brs(<line>)` (the `CreateObject` line) and
  returns `invalid`, and the app keeps running.

Before PR #1274, brs-engine stopped at the first case with an uncaught `SyntaxError: Invalid regular expression`
(`EXIT_BRIGHTSCRIPT_CRASH`). The first version of the PR threw runtime error 8 for every pattern JavaScript
rejects, so `untried` still ended the app.

`engine-trace.txt` is the engine output after issue #1277 (`PcreTranslator.ts`): every `PROBE|` line equals the device
trace. The invalid patterns print the same `Invalid pattern` error as the device, with the `CreateObject` line.

`test/e2e/resources/components/regex-pcre.brs` runs all these cases and pins the device output.
