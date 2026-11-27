# DrawPoint Probe

Checks `ifDraw2D.DrawPoint` on a real Roku vs. brs-engine: where the point lands and how big it is, and, with
`DrawRect`, what happens to the color's alpha with blending off (issue #1351). Plain Draw2D, no SceneGraph.

| Case | What it checks |
| --- | --- |
| `size<n>` | One opaque `DrawPoint(5, 5, n, ...)` into a 12x12 bitmap, blending off over transparent, for n = 0.5 to 6. |
| `alphaOff` / `alphaOn` | `&hFF000040` points of sizes 3, 1 and 2.5 and a `&h00FF0080` `DrawRect` over opaque blue, blending off then on. |

## Readout

Same as `../bitmap-tint-cache-probe`: each readout is `px:<GetPng hex>:<GetByteArray hex>`, decoded by `../decode-px.mjs`.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
diff device-trace-decoded.txt engine-trace-decoded.txt
```

## Results (Roku Ultra, 2026-11-27)

- The point is a square **centered** on (x, y), not with its top-left corner there, and isn't anti-aliased. Pixels
  painted for `DrawPoint(5, 5, n)`:

  | n | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 6 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | x | 5 | 5 | 4-5 | 4-5 | 4-5 | 4-6 | 3-6 | 3-6 | 3-7 | 2-7 |
  | y | 5 | 5 | 5 | 4-5 | 4-6 | 4-6 | 4-6 | 3-6 | 3-7 | 2-7 |

  Rows are the pixels whose centers fall in `[y + 0.5 - n/2, y + 0.5 + n/2)`. Columns follow the same rule for whole
  sizes, but a fractional size's width differs from its height (1.5 is 2x1, 2.5 is 2x3, 3.5 is 4x3).
- With blending off a point or rect replaces the pixels with its color, alpha included (`255,0,0,64` over blue);
  with blending on it blends (`64,0,191,255`).

The engine (after #1351) uses the row rule for both axes, so it matches every whole size, every height, and both
alpha cases exactly; a fractional size's width can be a pixel off (`size1.5` is 1 wide, `size2.5` and `size3.5` 3
wide). The engine before put the point's top-left corner at (x, y), anti-aliased fractional sizes, and painted
opaque with blending off.
