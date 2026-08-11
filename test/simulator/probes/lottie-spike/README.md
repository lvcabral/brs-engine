# lottie.js spike

Throwaway probe (no `brs-engine` import) validating whether a pure-JS, no-WASM, no-DOM Lottie
renderer is viable for the upcoming `roAnimatedImage`/`AnimatedImage` (Roku OS 15.3) work, per the
plan at `.claude/plans/the-roku-os-15-3-cryptic-curry.md`. Candidate: [`lottie.js`](https://lottie.js.org)
(npm `lottie.js@0.4.0`, MIT, zero runtime deps).

## Result: PASS — via `ImageSurface`, not `CanvasSurface`

`lottie.js` ships **two** rendering surfaces, and they are not equally viable here:

- **`CanvasSurface`** (draws into a `CanvasRenderingContext2D`) — **fails** against this engine's
  Node `BrsCanvas` backend (the `canvas` npm package). It calls the browser-only global
  `new Path2D()` internally (`opPath`, `lottie.js/dist/lottie.js`), which `canvas` does not
  provide (confirmed: `Object.keys(require('canvas'))` has no `Path2D`). Making this path work
  would require an extra `path2d-polyfill` dependency (which itself depends on `path2d`) — the
  opposite of the "pure-JS, minimal-dependency" precedent every existing decoder in this repo sets
  (`@lvcabral/libwebp`, `@lvcabral/upng`, `jpeg-js`, `gifuct-js`, `decode-bmp`). See
  `node-spike.mjs`'s comment header for the exact failure.
- **`ImageSurface`** (rasterizes straight to RGBA pixels, no canvas API at all — the README's own
  "server-side rendering with no native code and no browser" path) — **passes** in every tested
  context, and is also the *correct* integration shape regardless: `AnimatedFrameSource.renderAt()`
  only needs RGBA bytes to hand to `context.createImageData()`/`putImageAtPos()`, exactly like
  `RoBitmap`'s existing PNG/JPEG/WebP decoders already do. **`decodeLottie` should target
  `ImageSurface`, not `CanvasSurface`.**

## Per-context results

| Context | Script | Result |
| --- | --- | --- |
| Plain Node, `ImageSurface` | `node node-spike.mjs` | **PASS** — no `document`/`window`, renders correct RGBA, PNG output verified visually |
| Plain Node, `CanvasSurface` (`canvas` package ctx) | (removed from `node-spike.mjs` after the finding above) | **FAIL** — `Path2D is not defined` |
| `worker_threads` Worker (mirrors this engine's real Node runtime — see `docs/threading-and-rendezvous.md`) | `node worker-spike.mjs` | **PASS** — identical render, no DOM globals |
| Browser `Worker` + `ImageSurface` | `browser-spike.html` / `browser-worker.mjs` | **Not runnable in this sandbox** — see below. Mitigated with a static-analysis check (below) that reaches an equivalent conclusion. |

### Why the browser check didn't run live

This session's sandbox isolates network namespaces per tool invocation: a background static
file server (Python `http.server`, then a plain Node `http` server) started in one Bash call was
unreachable from `curl` in a subsequent call, and would be equally unreachable from the real Chrome
instance `claude-in-chrome` drives (a separate OS process outside this sandbox). A same-process
Node `listen()` + `http.get()` round-trip *did* work, confirming this is a cross-process sandbox
artifact, not a real networking failure.

**Mitigation**: since our actual integration path (`ImageSurface`) needs no `OffscreenCanvas` at
all, the only real question for a browser Worker is "does the bundle touch DOM globals" — answered
directly by grepping the built ESM bundle:

```
$ grep -noE "\b(document|window)\.[a-zA-Z]+|require\(['\"]node:|from ['\"]node:" lottie.esm.js
2872:document.createElement
```

The one hit is `scratch()`, a helper used only by `bakeImage()` for tinting **image-asset color
filters** — guarded (`typeof document !== "undefined"`, else `typeof OffscreenCanvas !== "undefined"`,
else `null`) and gracefully degrades to an untinted image when neither exists (exactly the case in
`worker_threads`, confirmed by `worker-spike.mjs` passing). No other DOM/`node:`-module reference
exists anywhere in the 4605-line bundle. Combined with the two live headless passes, this is
sufficient to confirm the "no hard DOM dependency" requirement without a live browser run.

`browser-spike.html`/`browser-worker.mjs` are left in place, runnable manually
(`python3 -m http.server` from this directory, then open `http://localhost:<port>/browser-spike.html`)
for anyone who wants to confirm it directly in a real browser tab.

## Fidelity spot-check

`sample.json` is a minimal hand-written Lottie/Bodymovin document (one shape layer, a filled 80x80
rect, keyframed 0°→360° rotation over 60 frames @ 30fps). Rendered via `ImageSurface`:

- `out-image-frame0.png` / `out-image-frame15.png` — 0° and 90° (visually identical for a square,
  expected — 4-fold symmetry, not a bug).
- `out-image-frame8-45deg.png` — ~48° rotation, renders as a visually correct rotated diamond,
  confirming shape geometry, fill color, and keyframe interpolation all work correctly.

## Fallback (not needed)

Per the plan, a minimal in-house shape-layer renderer was the fallback if this spike failed. It
did not — `lottie.js` via `ImageSurface` is the path forward for `decodeLottie`.

## Caveats for the real implementation

- Package is young (published ~2 weeks before this probe, single maintainer) — worth re-checking
  maintenance status/version before depending on it in `package.json`.
- Pre-1.0, "covers a growing subset of the format" per its own README — precomps, mattes, masks,
  and expressions are not confirmed supported; `decodeLottie` should be tested against real
  app-authored Lottie assets (spinners/loaders are the common case) before considering it complete.
- Image-asset color filters silently degrade to untinted outside a DOM/OffscreenCanvas context
  (see `scratch()` above) — acceptable for v1, worth a code comment where `decodeLottie` is added.
- **Confirmed against a real Roku sample app** (`rokudev/dynamic-voice-enabled-keyboards`'s
  `images/lottie.json`, layer 10 "Line" — a growing-circle Trim Path border): stroke line caps
  (`lc`) other than Round render rounded anyway — see `LOTTIE-JS-ISSUE-stroke-cap.md` below.

## Known bug: Butt/Square stroke caps render rounded (patched locally)

`ImageSurface`'s stroke rasterizer always draws a full round join-disk at every polyline vertex,
including ones near a path endpoint, even for `lc: 1` (Butt) or `lc: 3` (Square) — when one or more
of those nearby vertices are within the stroke's half-width of the endpoint (common on
tightly-sampled curves, e.g. an animated Trim Path on an ellipse — the "growing circular border"
pattern — can pack several vertices within the half-width, not just the nearest one), each such
disk bulges past the intended flat cap plane and the end renders rounded regardless of `lc`. Full
writeup, repro, and suggested fix:
[`LOTTIE-JS-ISSUE-stroke-cap.md`](LOTTIE-JS-ISSUE-stroke-cap.md) (file this upstream at
https://github.com/sanyok12345/lottie.js/issues).

- `trim-cap-repro.mjs` — the ellipse+Trim-Path repro; `stroke-cap-bug-frame10.png` /
  `stroke-cap-fixed-frame10.png` show the before/after.
- We're carrying the fix as a local `patches/lottie.js+0.4.0.patch` (via `patch-package`, applied
  automatically on `npm install` through the root `postinstall` script) until it lands upstream —
  drop the patch and this section once a released `lottie.js` version includes the fix. Regression
  test: `test/brsTypes/components/AnimatedFrameSource.test.js`'s "respects a Butt (lc=1) line cap"
  case, using `test/brsTypes/resources/sample-lottie-buttcap.json`.
