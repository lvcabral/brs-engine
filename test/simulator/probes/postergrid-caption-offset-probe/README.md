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

## Engine-side baseline (already captured)

Both resolutions run clean under `brs-cli`: 0 warnings, rule row found, every column inked, all five
pairs reading 0 — captured in `engine-trace-{hd,fhd}.txt` and `engine-shot-{hd,fhd}.png`. This is
**not** evidence for any answer — it is the engine reproducing its own current constant
(`CaptionTextOffset = 0`), which is circular by construction. Its purpose is to prove the fixture and
decoder work, and to give the device screenshot something known-good to be compared against.

| | engine HD | engine FHD |
| --- | --- | --- |
| control (bold, transparent) | 0 | 0 |
| font weight (plain, transparent) | 0 | 0 |
| default background (plain) | 0 | 0 |
| plain, stacked | 0 | 0 |
| default background (bold) | 0 | 0 |

## Status: awaiting a device run

No device readings yet. Do **not** change `CaptionTextOffset`, `CaptionZoneBase`,
`test/extensions/scenegraph/PosterGridExtent.test.js`, or the caption-zone section of
`.claude/docs/scenegraph-invariants.md` until this probe has been run on real hardware and the five
pairs above are filled in — the same way group P's own RESULT section was written only after its
device run, not before.
