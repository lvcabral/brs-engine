# DrawLine Probe

Checks `ifDraw2D.DrawLine` on a real Roku vs. brs-engine: which pixels a line covers, its end points, and what
happens to the color's alpha with blending off (issues #1340, #1351). Plain Draw2D, no SceneGraph.

Every case draws into a fresh 12x8 `roBitmap` and prints all of its pixels.

| Case | What it checks |
| --- | --- |
| `hv` | A horizontal `(1,2)-(9,2)` and a vertical `(10,1)-(10,6)` line: rows/columns covered, end points. |
| `diag` | A 45° line `(0,0)-(6,6)` and a shallow one `(0,7)-(11,4)`. |
| `shallowDown` / `steepUp` / `diagDownLeft` | Diagonals in other directions. |
| `vertUp` / `horizLeft` | The `hv` lines drawn the other way round. |
| `zeroLen` | `(4,4)-(4,4)`. |
| `alphaOff` / `alphaOn` | `&hFF000040` and `&h00FF0080` lines over opaque blue, blending off then on. |

The coverage cases draw opaque colors with blending off over a transparent bitmap, so a painted pixel is exactly the
line color.

## Readout

Same as `../bitmap-tint-cache-probe`: each readout is `px:<GetPng hex>:<GetByteArray hex>` (the device reads back
zeros from `GetByteArray`), decoded by `../decode-px.mjs`.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
node grids.mjs device-trace-decoded.txt engine-trace-decoded.txt
```

## Results (Roku Ultra, 2026-11-27)

- Lines are stepped, not anti-aliased: every covered pixel gets the full color.
- Horizontal lines cover both end points, in either direction. Vertical lines run from the smaller y up to, not
  including, the larger one, in either direction (`(10,1)-(10,6)` and `(5,6)-(5,1)` both paint rows 1-5).
- Diagonals: x-major lines include the end point, y-major and 45° lines leave out the pixel at the larger y. Each
  pixel is the line's position rounded to the nearest pixel.
- A zero-length line paints nothing.
- With blending off the line replaces the pixels with its color, alpha included (`alphaOff`: `255,0,0,64` over blue);
  with blending on it blends (`64,0,191,255`).

The engine (after #1351) matches `hv`, `vertUp`, `horizLeft`, `zeroLen`, `alphaOff` and `alphaOn` exactly.
Horizontal and vertical lines are filled as one rect; diagonals are stroked through pixel centers, so they follow the
device's path but anti-alias across neighbouring pixels instead of stepping. Stepping them exactly (a rect per run of
pixels) measured 10-20x slower on long diagonals, in Chrome and node-canvas, so it isn't done.
