# Region Draw Probe

Checks, on a real Roku vs. brs-engine, three things left open by the PR #1356 review: how an `roRegion`'s
AlphaEnable relates to its bitmap's, what happens when you draw past a region's edges, and what `DrawPoint` does
with a zero or negative size. Plain Draw2D, no SceneGraph.

| Case | What it checks |
| --- | --- |
| `regionOfOff` / `regionOfOn` | An 8x8 bitmap with AlphaEnable false / true, and a region over x 0-3. Prints both `GetAlphaEnable()` values, then draws a translucent `&hFF000040` rect, point and line through the region and a `&h00FF0080` rect on the bitmap at x 4-6, over opaque blue. |
| `regionSetOff` / `regionSetOn` | The same, after `SetAlphaEnable(false)` / `(true)` on the region: does that change the bitmap's flag? |
| `edgePoint` / `edgeRect` / `edgeLine` | A 4x4 region at (4,4) of a 12x12 bitmap, with points, rects and lines drawn past each of its edges. |
| `size<n>` | `DrawPoint(5, 5, n)` for n = 0, -0.5, -1, -2, -3, -4, and its return value. |

## Readout

Same as `../drawpoint-probe`: each readout is `px:<GetPng hex>:<GetByteArray hex>`, decoded by `../decode-px.mjs`.
`../draw2d-grids.mjs` prints device and engine side by side.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
node ../draw2d-grids.mjs device-trace-decoded.txt engine-trace-decoded.txt
```

## Results (Roku Express 4K+, OS 16.1, 2026-11-27)

- **A region's AlphaEnable is its own.** It starts `false` whatever the bitmap's is. `SetAlphaEnable` on the
  region doesn't change the bitmap's flag. Drawing through the region follows the region's flag, and drawing on the
  bitmap follows the bitmap's. So by default a region replaces pixels (`255,0,0,64`) even over an alpha-enabled
  bitmap.
  - Engine: a region starts `true` and `SetAlphaEnable` on it also sets the bitmap's flag, so all four cases
    differ.
- **Edges aren't clipped the same way for every call.**
  - Points and rects are cut at the region's left and top edges, but paint past its right and bottom ones into the
    bitmap.
  - A horizontal line is cut at both the left and right edges. Vertical and diagonal lines aren't cut at all, so
    they paint above and below the region.
  - Engine: `edgePoint` matches (after the PR #1356 follow-up). `edgeRect` paints past the left and top edges.
    `edgeLine` isn't cut anywhere, and its diagonal anti-aliases.
- **A zero or negative `DrawPoint` size paints one pixel** at (x, y), for every size tried, and returns `true`.
  Together with `../drawpoint-probe`, where 0.5 also paints one pixel, the size behaves as if it were clamped to at
  least 1.
  - Engine: paints nothing for these sizes.
