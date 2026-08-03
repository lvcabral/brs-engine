# LayoutGroup `layoutDirection` probe

A one-screen Roku channel that answers a single question empirically:

> **Which `layoutDirection` spellings does a real Roku device treat as horizontal, and what
> does it do with a value it does not recognize?**

The trigger was JellyRock's top menu. Two of its LayoutGroups spell the value `"horz"` instead of
`"horiz"` (`components/ui/tabbar/JRTabBar.xml`, `components/ui/dropdown/JRDropdown.xml`), and in
brs-engine they lay out vertically — the Favorites tab lands under Home, the user name under the
avatar. Roku's reference docs list only `horiz` and `vert`, so brs-engine falls back to the
documented default. Whether hardware does the same is what this channel measures.

## What it tests

Twelve cases, each a `LayoutGroup` holding three colored bars:

| # | Spelling | Why it's here |
| --- | --- | --- |
| 0 | attribute absent | Baseline: the documented default (`vert`) |
| 1 | `horiz` | Documented horizontal |
| 2 | `vert` | Documented vertical |
| 3 | `horz` | **The JellyRock value** |
| 4 | `horizontal` | brs-engine accepts this beyond spec — does hardware? |
| 5 | `vertical` | Same, vertical side |
| 6 | `HORIZ` | Case sensitivity |
| 7 | `Horiz` | Mixed case |
| 8 | empty string | Degenerate value |
| 9 | `bogus` | Unrecognized value with no near-miss |
| 10 | `horiz` then `horz` | Is an invalid write **rejected** (keeps `horiz`) or **accepted and ignored**? |
| 11 | `vert` then `horiz` | Control for case 10 — a valid re-write must re-layout |

Cases 0–9 run **twice**, in two columns, because the XML parser and a runtime field write may
validate differently:

- **Left column** — the spelling is hard-coded as an XML attribute in `MainScene.xml`
- **Right column** — the node is created in code and the field assigned from BrightScript

Cases 10–11 are runtime-only (two sequential writes can't be expressed in XML).

## How it decides

It does not eyeball the boxes. After the layout settles, it reads the first two children's
`sceneBoundingRect()` and reports which axis advanced:

- `HORIZ` — children advanced along x
- `VERT` — children advanced along y
- `STACKED` / `MIXED` — neither or both (would itself be a finding)

It also prints the **stored value** — what reading the field back returns. If that differs from
what was written, the device *rejected* the value rather than storing it and ignoring it. That
distinction matters for how brs-engine should behave.

The probe re-runs three times (1.2s apart) so a pre-layout first read can't produce a false
result, then stops. Results are drawn on screen **and** printed to the console.

## Running it

**On a Roku device** (developer mode enabled):

```bash
cd /Users/marcelocabral/Projects/Samples/layoutgroup-probe
zip -r ../layoutgroup-probe.zip . -x '*.DS_Store' 'README.md'
curl -f -u "rokudev:<devpassword>" -F "mysubmit=Install" -F "archive=@../layoutgroup-probe.zip" \
  "http://<roku-ip>/plugin_install"
```

Then read the results on screen, or capture the console table:

```bash
telnet <roku-ip> 8085
```

A prebuilt `layoutgroup-probe.zip` sits next to this folder.

**In the simulator**, for the side-by-side comparison:

```bash
brs-cli --root /Users/marcelocabral/Projects/Samples/layoutgroup-probe
```

## Result

Run on hardware 2026-07-30. Stable across all three passes, and the XML and runtime columns agreed
on every row — so the XML parser and a runtime field write validate identically.

| # | Spelling | Stored | Laid out as | brs-engine before | brs-engine after |
| --- | --- | --- | --- | --- | --- |
| 0 | (absent) | `"vert"` | VERT | ✅ match | ✅ |
| 1 | `horiz` | `"horiz"` | HORIZ | ✅ match | ✅ |
| 2 | `vert` | `"vert"` | VERT | ✅ match | ✅ |
| 3 | **`horz`** | `""` | **HORIZ** | ❌ `"horz"` / VERT | ✅ |
| 4 | `horizontal` | `""` | HORIZ | ❌ `"horizontal"` / HORIZ | ✅ |
| 5 | `vertical` | `""` | HORIZ | ❌ `"vertical"` / **VERT** | ✅ |
| 6 | `HORIZ` | `"horiz"` | HORIZ | ❌ stored verbatim | ✅ |
| 7 | `Horiz` | `"horiz"` | HORIZ | ❌ stored verbatim | ✅ |
| 8 | (empty) | `""` | HORIZ | ❌ VERT | ✅ |
| 9 | `bogus` | `""` | HORIZ | ❌ `"bogus"` / VERT | ✅ |
| 10 | `horiz` then `horz` | `""` | HORIZ | ❌ `"horz"` / VERT | ✅ |
| 11 | `vert` then `horiz` | `"horiz"` | HORIZ | ✅ match | ✅ |

**The device rule.** `layoutDirection` is an enum, not free text:

- `horiz` and `vert` match **case-insensitively** and are stored **lowercase-canonical** — writing
  `"HORIZ"` reads back `"horiz"`.
- Anything else is **rejected**, not stored-and-ignored: the field reads back `""`. A rejected write
  **clobbers** a previously valid one (case 10).
- The rejected/empty state lays out **HORIZONTALLY** — even though a never-written field keeps its
  `"vert"` default and lays out vertically (case 0 vs case 8).
- `horizontal` and `vertical` get no leniency; `vertical` laying out *horizontally* (case 5) is the
  sharpest illustration that near-misses are not fuzzy-matched.

**Verdict:** the divergence was brs-engine's, not JellyRock's. `layoutDirection="horz"` is a
horizontal row on hardware, so the JellyRock tab bar and user dropdown were correct all along; the
engine was mapping every unrecognized value to `vert` and stacking them. Fixed in
`getLayoutDirection`/`canonicalizeDirection` in `src/extensions/scenegraph/nodes/LayoutGroup.ts`,
pinned by `test/extensions/scenegraph/LayoutDirection.test.js`, and documented in
`.claude/docs/scenegraph-invariants.md`.

Re-running this channel under `brs-cli` after the fix reproduces the device table exactly, row for
row, in both columns.

## Possible follow-up probes

The same enum question applies to the other LayoutGroup string fields, which this channel does not
cover: `horizAlignment` / `vertAlignment` (`left`/`center`/`right`/`custom`, `top`/`center`/
`bottom`/`custom`). brs-engine currently falls back to `left`/`top` for unrecognized values — worth
measuring before trusting it, given how this one turned out.
