# Animated Image Tint Probe

Checks tinted `roAnimatedImage` draws (`DrawObject` with an `rgba`) on a real Roku vs. brs-engine, and times them, for
issue #1341: a BrightScript-driven `roAnimatedImage` re-copied its frame and re-tinted it on every draw, so the
`TintCache` (`src/core/brsTypes/components/TintCache.ts`) never got a hit. Plain Draw2D, no SceneGraph.

`images/anim.webp` (made by `make-anim.py`) has four solid 400x400 frames of 100 ms: white, grey (128), orange
(255,128,0), cyan (0,255,255). Each case draws the image onto an opaque black bitmap and prints the pixel.

| Case | What it checks |
| --- | --- |
| `manual\|state` | `GetState()` once the `ready` event arrived and 300 ms passed. |
| `manual\|f0` | Frame 0 untinted, red, green, red, twice through. |
| `manual\|f1` … `f0-wrap` | After each `Update()` that moves to another frame, the new frame untinted and tinted (red, green); `f1-again` is an `Update(0)` that stays on the frame. |
| `auto\|first` | Automatic mode before it plays: untinted, then red twice. |
| `time` | 500 draws of the 400x400 image per pattern: `plain` (no tint), `single` (one tint), `alt2` (two tints alternating), with the image `paused` (never played), playing in a `loop` (wall clock), or `manual` (`Update(16000)` before every draw). Reference numbers, not compared. |

Readouts are `px:<GetPng hex>:<GetByteArray hex>` (the device reads back zeros from `GetByteArray`); `../decode-px.mjs`
turns them into `r,g,b,a`.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # npm-linked brs-cli, after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
diff <(grep -v '|time|' device-trace-decoded.txt) <(grep -v '|time|' engine-trace-decoded.txt)
```

`engine-trace-before.txt` is the engine before the fix.

## Results (Roku Express 4K+, OS 16.0.4, 2026-11-24)

- Tinting multiplies the frame's RGB, as for `roBitmap`. Every `manual` case matches, before and after the fix
  (the fix changes no pixel).
- `roAnimatedImage` needs an `roScreen` on the device: without one, automatic mode fails with
  `{error: "Failed to create screen"}` and manual mode reports `ready` but draws nothing. The engine draws either way.
- `roAnimatedImage` has no drawing methods on the device (see `../animated-image-surface-probe`).
- The device shows a frame one draw after it is due: after `Update()` moves to a new frame, the next draw still shows
  the old one. The probe makes a discarded draw after each frame change.
- Known difference, `auto|first`: in automatic mode before it plays, only the first draw shows the frame (untinted,
  even with a tint); every later draw draws nothing (`0,0,0`). The engine draws the first frame every time.

Timings for 500 draws, in ms (engine: Node CLI on an Apple-silicon Mac, three runs each, same within ~5%):

| Pattern | Device | Engine before | Engine after |
| --- | ---: | ---: | ---: |
| paused, plain | 8 | 37 | 30 |
| paused, single tint | 9 | 282 | 28 |
| paused, two tints alternating | 9 | 274–294 | 28 |
| loop, plain | 9 | 33 | 25 |
| loop, single tint | 9 | 278 | 26 |
| loop, two tints alternating | 9 | 276–300 | 27 |
| manual, plain | 10 | 53 | 43 |
| manual, single tint | 10 | 300–331 | 83–118 |
| manual, two tints alternating | 10 | 293–307 | 117–124 |

The device costs the same tinted or not. Before the fix, the engine re-tinted on every draw, about 8x the untinted
cost. Now a frame is tinted once per tint, and draws that repeat it cost the same as untinted ones. The `manual`
rows still re-tint when the frame changes (about every 6 draws there). Untinted draws also got faster: the image now
draws straight from the frame source's canvas instead of copying each frame onto its own.
