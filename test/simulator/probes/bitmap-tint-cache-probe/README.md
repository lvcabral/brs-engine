# Bitmap Tint Cache Probe

Checks tinted `roBitmap` draws (`DrawObject` and friends with an `rgba`) on a real Roku vs. brs-engine, for the
multi-tint cache in `src/core/brsTypes/components/TintCache.ts` (PR #1334). Plain Draw2D, no SceneGraph.

Every case draws a source tinted onto an opaque black bitmap and prints the resulting pixel, so a stale tint (pixels
from before the source was drawn into) shows up as a wrong value.

| Case | What it checks |
| --- | --- |
| `alt` | Two tints alternating on one source. |
| `alpha` / `fade` / `long` | The same RGB at several blend-color alphas; `&hFF0000FF&` (LongInteger) vs. `&hFF0000FF`. |
| `regions` | Two regions of one bitmap drawn with alternating tints. |
| `write.<op>` | A bitmap tinted with two colors, then written by `<op>` (Clear, DrawRect, DrawPoint, DrawLine, the four DrawObject variants, roCompositor, a region's DrawRect/DrawObject, SetAlphaEnable), then tinted again. |
| `many` | 200 draws with 100 distinct tints, twice through (more than the cache holds). |
| `self.<variant>` | A bitmap drawn tinted into itself (whole, scaled, rotated, transformed), a region of it drawn into it (`self.region`), and a region drawn into another region of it (`self.regiondst`). Each runs in its own launch (`contentId=<case>`). |
| `time` | 500 draws of a 400x400 bitmap per tint pattern (reference numbers, not compared). |

## Readout

The device's `GetByteArray` returns all zeros on bitmaps (and `invalid` on `roScreen`), so each readout is
`px:<GetPng hex>:<GetByteArray hex>`, and `../decode-px.mjs` uses whichever one holds the pixels.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
diff <(grep -v -e '|time|' -e device-crash device-trace-decoded.txt) <(grep -v '|time|' engine-trace-decoded.txt)
```

## Results (Roku Express 4K+, OS 16.0.4, 2026-11-22)

- A blend color's alpha is only the blit transparency: `&hFF000080` over black gives `128,0,0`, the fade steps
  give `204/153/102/51/0`. Tints that differ only in alpha draw the same tinted pixels, so the engine keys its
  cache on RGB. LongInteger and Integer colors draw the same.
- Drawing a region of a bitmap tinted into that bitmap (`self.region`) works, and later tinted draws show the new
  pixels. The engine before the fix returned the tints of the old pixels (`green=0,255,0`, `red=255,0,0`).
- Drawing a bitmap into itself, by any DrawObject variant, or a region into another region of the same bitmap,
  crashes the device (`EXIT_SYSTEM_KILL`, app core captured) and is logged as `device-crash`. The engine does not
  crash and draws the expected pixels.
- Every `write.<op>` re-tints from the new pixels on both. `many` matches.
- Known unrelated difference: `DrawLine(0, 0, 15, 0, ...)` covers pixel row 0 at full strength on the device
  (`128`), but anti-aliased on the engine (`191`).
- Device timings for 500 draws of 400x400: single tint 9 ms, two alternating 10 ms, eight cycling 8 ms, alpha
  ramp 5 ms, 500 distinct tints 5 ms, source changed before every draw 19 ms.
