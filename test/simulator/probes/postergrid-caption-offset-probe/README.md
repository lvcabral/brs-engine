# PosterGrid caption offset probe

Re-measures `CaptionTextOffset` — the distance between a PosterGrid caption's text and the poster's
bottom edge, for `captionVertAlignment = "below"` (the field default) — under two conditions the
original [`postergrid-margins-probe`](../postergrid-margins-probe/README.md) group P never tested.

## Why this probe exists

Group P measured `CaptionTextOffset = 0` (text flush against the poster, the whole 23px
`CaptionZoneBase` reserved *below* it) by subtracting a real PosterGrid cell's first inked caption
row from a hand-built reconstruction's, on a real device (Streaming Stick, Roku OS 15.2), at both
resolutions, for two caption-block counts. That result is what shipped in
`src/extensions/scenegraph/nodes/PosterGrid.ts` (PR #1144).

Testing against Roku's own
[`PosterGridExample`](https://github.com/rokudev/samples/tree/master/ux%20components/lists%20and%20grids/PosterGridExample)
sample app on real hardware showed a visible top margin above the caption — the flush placement
`CaptionTextOffset = 0` does not reproduce. That sample's field configuration differs from group P's
fixture in exactly two ways:

| | group P's fixture | `PosterGridExample` |
| --- | --- | --- |
| `caption1Font` | `font:SmallerBoldSystemFont` | `font:SmallerSystemFont` (non-bold) |
| `captionBackgroundBitmapUri` | overridden to a transparent bitmap | unset — uses the device default `common:/images/<res>/caption_background.9.png` |

Group P deliberately controlled both of those (bold font, transparent background) to keep its
red-ink detection clean — see that probe's README for why. Neither was ever varied, so neither was
ever ruled out as the actual cause of a non-zero offset. This probe holds group P's method fixed and
varies exactly those two things.

## Design: 8 columns, 5 pairs, same subtraction method as group P

```
CaptionTextOffset = firstInkedRow(real column) - firstInkedRow(offset-0 reconstruction)
```

Both columns in a pair render the same glyphs, in the same font, in a box of the same height, with
the same vertical alignment, over posters whose bottom edges share a scene y — so the unknown "where
does ink sit inside its own box" term is identical on both sides and cancels, as does anti-aliasing.
Captions are pure red (`0xFF0000FF`) on red-free grey posters, so locating ink is a channel test, not
a visual judgement. `decode-caption-offset.js` does the reading; see
`components/CaptionOffsetScene.brs` for the full column layout.

| pair | real column | recon column | tests |
| --- | --- | --- | --- |
| control | C1 (bold, transparent bg) | C2 (bold, offset 0) | reproduces group P's known **0** — a sanity check that this fixture and decoder agree with the original before trusting the new columns |
| font weight | C3 (plain, transparent bg) | C4 (plain, offset 0) | does `caption1Font` weight change the offset? |
| default background | C5 (plain, DEFAULT bg) | C4 (plain, offset 0) | does the default caption background asset change the offset? |
| plain, stacked | C6 (plain, transparent bg, caption1+caption2) | C7 (plain, offset 0, caption1+caption2) | does the plain-font reading hold across block count, the way group P's bold reading did? |
| default background, bold | C8 (bold, DEFAULT bg) | C2 (bold, offset 0) | does the default background change the offset independent of font weight? |

All eight columns use `captionVertAlignment = "below"` (unset, the field default — what
`PosterGridExample` uses) and `caption1NumLines = 1`.

**The control pair matters as much as the other four.** If it does not read 0, something about this
fixture (not group P's) is broken, and the other four pairs cannot be trusted until that is fixed.

## Running it

From the repo root, build one zip per resolution into gitignored `out/` (the `.zip`s are build
artifacts and are not tracked):

```bash
cd test/simulator/probes/postergrid-caption-offset-probe
zip -r ../../../../out/postergrid-caption-offset-probe-hd.zip manifest source components images
cp manifest manifest-hd && cp manifest-fhd manifest
zip -r ../../../../out/postergrid-caption-offset-probe-fhd.zip manifest source components images
cp manifest-hd manifest && rm manifest-hd
```

Sideload each zip. The app prints the column layout and both resolutions' `Label` line heights over
telnet, then leaves the ladder on screen — **it does not close automatically**. Take the device
screenshot from the dev console (`http://<device>/plugin_inspect` → *Screenshot*) while it is up,
then exit with Back/Home.

Then decode:

```bash
node test/simulator/probes/postergrid-caption-offset-probe/decode-caption-offset.js <shot.png> [--design=1920]
```

`--design` is the **app's** width, not the image's — a Roku device's screenshot utility captures HD
(1280x720) even for an FHD app:

| capture | invocation | scale |
| --- | --- | --- |
| HD app, engine or device | (default) | 1 |
| FHD app, engine `--snapshot` (1920 wide) | `--design=1920` | 1 |
| FHD app, **device** screenshot (1280 wide) | `--design=1920` | 0.667 |

The decoder prints the scale it used and the raw row indices, so a wrong scale is visible rather than
silent.

### Engine side

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-caption-offset-probe \
    --snapshot /tmp/caption-offset-hd.png --log /tmp/eng-hd.txt
```

Ctrl+S takes the snapshot and needs a TTY, so under automation drive it through a pty (e.g. `expect`,
sending `\x13` then `\x04`) rather than a plain pipe.

## What to report back

For each of the five pairs, the design-px `CaptionTextOffset` the decoder prints, at **both**
resolutions. In particular:

- Does the **control** pair read 0, matching group P? (If not, stop — the fixture itself needs
  fixing before the other four numbers mean anything.)
- Do the **font weight** and **default background** pairs differ from the control, and from each
  other?
- Does the **plain, stacked** pair agree with the **font weight** pair (both plain/transparent, one
  block vs. two)? If not, the offset depends on block count the same way group P's T5 candidate
  would have, and a single constant cannot express it.

## Engine-side baseline (post-fix)

Both resolutions run clean under `brs-cli`: 0 warnings, rule row found, every column inked —
captured in `engine-trace-{hd,fhd}.txt` and `engine-shot-{hd,fhd}.png`. These now reflect the FIX
(below), not the pre-fix `CaptionTextOffset = 0` constant: they are the engine reproducing its own
current logic, which is circular by construction for the numbers it derives from this probe's own
device run. Their purpose is to prove the fixture, decoder, and fix agree with each other.

| | engine HD | engine FHD |
| --- | --- | --- |
| control (bold, transparent) | 0 | 0 |
| font weight (plain, transparent) | 0 | 0 |
| default background (plain) | 11 | 17 |
| plain, stacked | 0 | 0 |
| default background (bold) | 11 | 17 |

## RESULT (device: HD screenshot, `device-shot-hd.png`)

**The font-weight hypothesis was wrong; the default-background hypothesis was right.**

| pair | device HD |
| --- | --- |
| control (bold, transparent) | 0 — matches group P |
| font weight (plain, transparent) | 0 — font weight is not the cause |
| default background (plain) | **11** |
| plain, stacked | 0 — agrees with the font-weight pair |
| default background (bold) | **12** (1px from the plain reading, within ink-detection noise — see below) |

The control and font-weight pairs read exactly 0, so `CaptionTextOffset = 0` is confirmed correct
for a flat/non-9-patch background — group P's own result stands unmodified. The default-background
pairs are what diverges: `captionBackgroundBitmapUri` unset (the sample's condition, and the
majority of real apps') resolves to `common:/images/<res>/caption_background.9.png`, a genuine
`.9.png`. A device insets the caption text by that bitmap's own content-margin instead of drawing it
flush — the same mechanism `ArrayGrid.focusMargins()` already uses for a focus bitmap's content
margin over its flat marginX/marginY fallback (`src/extensions/scenegraph/nodes/ArrayGrid.ts`), just
never wired up for caption placement.

The bold/plain default-background readings (12 vs. 11) are one device pixel apart despite both fonts
sharing the same declared point size — most likely ink-detection rounding (a bolder stroke's
anti-aliased top edge crosses the red-dominance threshold up to a pixel earlier), not a real
font-dependent term; a flat per-resolution offset does not need to model it separately.

### Fixed as a result

- `src/extensions/scenegraph/nodes/PosterGrid.ts`: added `resolveCaptionTextOffset()`, which reads
  the resolved caption-background bitmap's 9-patch `margins.top` (via `RoBitmap.getPatchSizes()`)
  when it is a valid 9-patch, falling back to the flat `CaptionTextOffset` (0) otherwise.
  `buildItemLayout`'s below/above branch now calls it instead of using the constant directly; the
  on-poster (top/center/bottom) branch is unaffected — a caption drawn over the poster has no zone
  to be inset from.
- `src/extensions/scenegraph/common/images/{HD,FHD}/caption_background.9.png`: recalibrated the
  content-margin marker (a few 1px alpha-only border pixels, no visible change) so the DEFAULT
  background's own `margins.top` reads 11 (HD) — matching this device run — instead of the asset's
  previous, never-measured 7. FHD (17) is scaled 1.5×, the same inference other margins in this node
  use, not separately device-measured.
- Regression coverage: `test/extensions/scenegraph/PosterGridExtent.test.js`, "below: the text
  offset follows the caption background's own 9-patch content-margin" — asserts 11/17 for the
  default background and 0 for an explicit non-9-patch override, at both resolutions.

### Still open

- FHD's 17 is an inference, not a device reading — this probe has not been run on an FHD device.
- A CUSTOM `captionBackgroundBitmapUri` that is itself a 9-patch inherits this same mechanism by
  construction, but that path is untested — no probe case used one.
- The 1px bold/plain spread is attributed to ink-detection noise rather than measured as a genuine
  font-dependent term; a probe designed to separate the two (e.g. reading sub-pixel coverage instead
  of a hard threshold) could settle it, but the practical impact of being off by ≤1px did not
  justify one here.
