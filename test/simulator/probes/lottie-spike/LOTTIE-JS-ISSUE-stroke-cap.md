# `ImageSurface` renders Butt/Square stroke caps as rounded near short adjacent segments

## Summary

`ImageSurface`'s stroke rasterizer (`strokeRing` in `src/surface/image/...`) always draws a
full-radius round "join" disk at every polyline vertex, including ones close to a path endpoint —
even when the path's `lc` (line cap) is `1` (Butt) or `3` (Square), not `2` (Round). When one or
more of those vertices are within the stroke's half-width of an endpoint (common on
tightly-sampled curves, e.g. a bezier-flattened ellipse arc, where several consecutive points can
sit closer together than the stroke is wide), each such disk's radius extends past the intended
flat/projecting cap plane, so the stroke renders with a rounded end regardless of the declared
`lc` value — not just the disk at the single nearest vertex, but potentially several in a row.

`CanvasSurface` is unaffected — it sets `ctx.lineCap` directly and lets the native Canvas2D
renderer handle caps correctly.

## Repro

An open 4-point polyline stroke, `lc: 1` (Butt), where the first three segments are each shorter
than the stroke's half-width — so **two** consecutive vertices (not just one) have disks that
bulge past the cap plane:

```js
import { parse, ImageSurface } from "lottie.js";

const doc = {
  v: "5.7.0", fr: 30, ip: 0, op: 1, w: 20, h: 20,
  layers: [{
    ddd: 0, ind: 1, ty: 4, nm: "line", sr: 1,
    ks: {
      o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
      p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [{
      ty: "gr", nm: "g",
      it: [
        {
          ty: "sh", nm: "p",
          ks: { a: 0, k: {
            c: false,
            v: [[5, 10], [6, 10], [7, 10], [8, 10]],   // open polyline, 1-unit segments
            i: [[0, 0], [0, 0], [0, 0], [0, 0]],
            o: [[0, 0], [0, 0], [0, 0], [0, 0]],
          } },
        },
        { ty: "st", nm: "s", c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 6 }, lc: 1, lj: 1 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ],
    }],
    ip: 0, op: 1, st: 0,
  }],
};

const anim = parse(doc);
const surface = new ImageSurface(anim.width, anim.height);
const { data, width } = surface.render(anim, 0);
const px = (x, y) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

console.log(px(3, 10)); // expected [0,0,0,0] (transparent, past the flat cap plane at x=5)
console.log(px(4, 10)); // expected [0,0,0,0] — the disk at vertex 2 (x=7, radius 3) reaches to x=4
```

**Actual**: both `px(3, 10)` and `px(4, 10)` come back opaque-ish red — well past where a Butt cap
at `x=5` should have already cut off.

**Expected**: both transparent. The stroke should end flush at `x=5` (the endpoint).

Note stroke half-width is 3 here; vertex 1 (`x=6`, path-distance 1 from the endpoint) *and* vertex
2 (`x=7`, path-distance 2) are both within that half-width — an initial fix that clipped only the
single nearest vertex (index 1) still left vertex 2's disk unclipped, still bulging to `x=4`.

## More realistic repro (the case we actually hit)

An ellipse stroke (`lc: 1`) animated via a growing Trim Path — a common "circular progress/loading
border" pattern — shows the same rounding at both ends of the arc as it grows, because a
bezier-flattened ellipse arc packs multiple vertices within the stroke's half-width of each cut
end:

```js
// stroke width 20, lc: 1, ellipse radius 70 on a 200x200 canvas, trim "e" animating 0 -> 100
```

Rendered mid-growth, both arc ends are visibly rounded instead of flat. See the attached
`stroke-cap-bug-frame10.png` (buggy) vs `stroke-cap-fixed-frame10.png` (after the fix below) for a
visual comparison — [screenshots attached when filing].

## Root cause

`strokeRing(ring2, halfW, cap, out)`:

```js
const from = cap === 1 ? 1 : 0;
const to = cap === 1 ? n - 1 : n;
for (let i = from; i < to; i++) {
  // draws a full disk of radius halfW centered at ring2[i]
}
```

This correctly skips the disk at the true endpoint indices (`0` and `n-1`) when `cap === 1`, but
every *other* index gets a full, unclipped disk regardless of how close it sits to an endpoint. Any
vertex whose cumulative path-distance to an endpoint is less than `halfW` produces a disk that
extends past that endpoint's cap plane — and on a finely-tessellated curve, that can be several
consecutive vertices, not just the immediate neighbor.

## Suggested fix

For `cap !== 2` (Round doesn't need this — Round already draws a full disk at the endpoint
itself), clip **every** disk whose cumulative path-distance to an endpoint is less than `halfW`
against that endpoint's cap plane — scoped by path distance, not vertex index, and not just the
single nearest vertex. For `cap === 3` (Square/projecting), offset the clip plane outward by
`halfW` instead of cutting flush at the endpoint. Path-distance scoping (rather than "always clip
against both planes") also matters for a near-closed loop: a Trim Path close to 100% has its two
ends geometrically near each other in space despite being topologically far apart along the path,
and clipping by geometric proximity alone would wrongly cut into the wrong end.

```js
function capDir(ring2, fromIdx, toIdx) {
  const dx = ring2[toIdx * 2] - ring2[fromIdx * 2];
  const dy = ring2[toIdx * 2 + 1] - ring2[fromIdx * 2 + 1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function clipDiskAtCap(disk, ex, ey, dx, dy, project) {
  // Sutherland-Hodgman single-plane clip: keep points on the path side of the plane through
  // (ex - dx*project, ey - dy*project) with inward normal (dx, dy). A no-op when the disk is
  // already entirely on the keep side (the common case for disks far from either endpoint).
  const px = ex - dx * project;
  const py = ey - dy * project;
  const n = disk.length / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x0 = disk[i * 2], y0 = disk[i * 2 + 1];
    const j = (i + 1) % n;
    const x1 = disk[j * 2], y1 = disk[j * 2 + 1];
    const d0 = (x0 - px) * dx + (y0 - py) * dy;
    const d1 = (x1 - px) * dx + (y1 - py) * dy;
    if (d0 >= 0) out.push(x0, y0);
    if ((d0 >= 0) !== (d1 >= 0)) {
      const t = d0 / (d0 - d1);
      out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }
  return out;
}
```

In `strokeRing`, precompute cumulative path distance from each end (`distFromStart[i]`,
`distFromEnd[i]`) once per ring, then for each disk at index `i`:

```js
if (cap !== 2) {
  if (distFromStart[i] < halfW) {
    disk = clipDiskAtCap(disk, ring2[0], ring2[1], ...capDir(ring2, 0, 1), cap === 3 ? halfW : 0);
  }
  if (distFromEnd[i] < halfW) {
    disk = clipDiskAtCap(disk, ring2[(n-1)*2], ring2[(n-1)*2+1], ...capDir(ring2, n-1, n-2), cap === 3 ? halfW : 0);
  }
}
```

Full working patch (against `dist/lottie.js`/`dist/lottie.cjs` built from `lottie.js@0.4.0`) is
available on request — we're carrying it as a local `patch-package` patch in our own project
(`brs-engine`, https://github.com/lvcabral/brs-engine) until this lands upstream.

## Related, not filed separately

Line **joins** (`lj`) also don't appear to be respected at all in `ImageSurface` — every
intermediate vertex always gets a round-join disk regardless of the declared `Miter`/`Round`/`Bevel`
value. Not the focus of this issue, but likely worth a look while in this code.
