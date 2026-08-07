# TextEditBox Vertical Anchor Probe

**RESOLVED - device-confirmed CENTER-ANCHORED.** See "Device reading" at the bottom
(`device-trace-fhd.txt`, Roku Express 4K+, OS 15.3): `y=-18` for every custom-background case,
not `y=0` - the device's own `boundingRect()` rules out top-anchored and matches the engine's
prediction, including the non-trivial `22 == 40 - 18` case. brs-engine's `TextEditBox.ts` needs
no change. Kept for reference / to re-check on another device or OS version if this ever regresses.

Settles one question: when a `TextEditBox`'s built-in background is hidden (`backgroundUri` set
to a real, non-empty URI - the common pattern for apps that draw their own background), where
does the rendered text land relative to the box's own `translation.y`?

-   **TOP-ANCHORED** - text starts _at_ `translation.y` and extends downward (the standard
    SceneGraph top-left translation convention every other node follows).
-   **CENTER-ANCHORED** - `translation.y` is the vertical _center_ of the rendered line; text
    extends both above and below it.

`TextEditBox` has no documented `height` field
(`external/dev-doc/docs/REFERENCES/scenegraph/widget-nodes/texteditbox.md`), so there's no spec
answer. brs-engine currently assumes **center-anchored** for this case - inferred from a real
app's (Jellyfin's Sign In form) own layout numbers looking suspiciously exact under that theory,
not from a device reading. See `.claude/docs` / PR history on `TextEditBox.ts` for the full
writeup. This probe exists to replace that inference with a measurement.

The **default/built-in background** case (no `backgroundUri` override) is NOT the open question

-   it's already believed correct (top-anchored, matching the engine's original fixed-height
    behavior) and is only included as a control.

## Run

```
telnet <roku-ip> 8085                                                        # device
node packages/node/bin/brs.cli.js --root test/simulator/probes/texteditbox-vertical-anchor-probe # engine baseline
```

The screen stays up indefinitely (no auto-exit) so there's time to take a device screenshot
(Developer Settings > "Enable screensaver..." screen has the screenshot option, or the classic
Home x3 / secret remote combo depending on OS version - whichever this device normally uses).
Press Home or Back afterward to exit. The numeric `boundingRect()` readings print to telnet a
moment after boot, no interaction needed for those.

Engine baseline is in `engine-trace.txt` (FHD).

## What's on screen

| Case  | What it is                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | Ruler + `TextEditBox` with a custom (hidden) background, typed text `"Wgy"` (an ascender and a descender, so the font's full vertical extent shows against the ruler)                                                                                                    |
| **B** | Same ruler, but hint text only (no `text` set) - confirms hint text follows the same vertical anchor as typed text                                                                                                                                                       |
| **J** | "Jellyfin analog": reproduces the _exact_ numbers from the real app this probe exists to verify - a sibling background `Rectangle` height=60 at y=8, `TextEditBox` translated to y=40. No ruler; just look at whether "Erika" looks vertically centered in the white box |
| **D** | Control: default/built-in background (no override). Not the open question - included so the same screenshot also confirms this case is unaffected                                                                                                                        |

## Reading the ruler (cases A/B)

The **red** tick is offset 0 - the box's own `translation.y`. Labeled ticks run every 25px
(`font:TinySystemFont`), with unlabeled fine ticks every 5px in between for reading an exact
pixel value by counting from the nearest label. **Cyan** ticks mark every 50px for fast counting
at a glance.

-   Glyphs starting **at or just below the red tick**, extending only downward → **top-anchored**.
-   Glyphs **straddling the red tick** with roughly equal space above and below → **center-anchored**
    (what brs-engine currently assumes).
-   Note where the top of "W" and the bottom of "y" fall - write down the two offset numbers (e.g.
    "top ≈ -18, bottom ≈ +18") rather than just "looks centered", so the exact line height/anchor
    can be checked against the boundingRect() reading below instead of just eyeballed.

## Reading the printed `boundingRect()` values

```
PROBE|001|bounds|A-typed-text|customBg text=Wgy | rect={x=... y=... w=... h=...}
PROBE|002|bounds|B-hint-only|...
PROBE|003|bounds|J-jellyfin-analog|...
PROBE|004|bounds|D-default-bg|...
```

For each custom-background case (A, B, J), compare the reported `y` to `-height/2`:

-   `y == -height/2` (roughly) → confirms center-anchored, matching the engine.
-   `y == 0` → top-anchored; the engine's `applyChrome`/`contentOffsetY` centering in
    `src/extensions/scenegraph/nodes/TextEditBox.ts` needs to be reverted for this mode.
-   Anything else → neither guess is right; report the raw numbers, don't try to fit them to one
    of the two theories.

Also compare `D`'s `height` (should be a device-specific fixed-looking number, analogous to the
engine's `72` at FHD - the built-in chrome height) against `A`'s/`B`'s `height` (the engine's is
`36`, the font's plain line height with no padding) - a large device difference between the two
would suggest the _ratio_ the engine uses for the default case (`lineHeight * 2`) may also be
worth re-checking, though that's not this probe's primary question.

## Engine baseline (`engine-trace.txt`, FHD)

| Case | Engine `rect`                  | Reading                                                 |
| ---- | ------------------------------ | ------------------------------------------------------- |
| A    | `y=-18 h=36`                   | centered: `y == -height/2`                              |
| B    | `y=-18 h=36`                   | same as A - hint text matches                           |
| J    | `y=22 h=36` (translation.y=40) | `22 == 40 - 18` - centered on the real translation used |
| D    | `y=0 h=72`                     | top-anchored, unaffected (control)                      |

## Device reading (`device-trace-fhd.txt`, Roku Express 4K+, OS 15.3, FHD)

| Case | Device `rect`                  | vs. engine                    | Reading                                                         |
| ---- | ------------------------------ | ----------------------------- | --------------------------------------------------------------- |
| A    | `y=-18 h=38`                   | `y` matches exactly; `h` +2px | centered                                                        |
| B    | `y=-18 h=38`                   | same as A                     | hint text matches typed text                                    |
| J    | `y=22 h=38` (translation.y=40) | `y` matches exactly           | `22 == 40 - 18` - centered on a real, non-symmetric translation |
| D    | `y=0 h=73`                     | `y` matches; `h` +1px         | top-anchored, control unaffected                                |

**Verdict: center-anchored, confirmed.** The `y` offset - the actual open question - matches the
engine's prediction on every case, including the non-trivial `J` case where a wrong theory would
have been off by tens of pixels, not one. The small height differences (36→38, 72→73) are the
font itself (device system font vs. the engine's bundled Metropolis approximation), not the
anchor logic - a pre-existing, already-tracked engine-wide font-metric gap unrelated to this
question. `TextEditBox.ts`'s `applyChrome`/`contentOffsetY` centering is correct as implemented;
no follow-up change needed.
