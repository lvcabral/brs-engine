# Effect Node Demo

A visual demo of the Roku OS 16.0 **`Effect`** node (rounded corners, borders and linear/radial
gradients applied to `Poster` and `Rectangle` via their new `effect` field) — see the Roku OS 16.0
Beta section of `external/dev-doc/docs/DEVELOPER/release-notes/index.md` for the field spec, and
`src/extensions/scenegraph/nodes/Effect.ts` for how brs-engine implements it (Canvas2D, since the
engine has no real GPU/shader pipeline).

Nine panels, each an independent `Effect` configuration:

| # | Demonstrates |
| --- | --- |
| 1 | Uniform `borderRadius` on a `Rectangle` |
| 2 | Per-corner `borderRadius` — proves the field's clockwise-from-top-right ordering |
| 3 | `borderWidth`/`borderColor`/`borderPadding`, no rounding |
| 4 | Rounded corners + border + padding together |
| 5 | `gradientStyle="linear"` with `gradientAngle` |
| 6 | `gradientStyle="radial"` |
| 7 | A gradient applied to both content and border (`gradientFillBorder`) |
| 8 | `borderRadius` clipping a `Poster`'s bitmap |
| 9 | A `Poster` with rounded corners, a border, and a gradient overlay (`gradientFillContent`) |

## Run it

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/effect-demo --ascii 100 --unicode
```

(build the CLI first if `packages/node/bin/` is stale: `npm run build:cli`). Add `--image` instead
of `--ascii`/`--unicode` on a terminal with native graphics support (iTerm2, Kitty) for full color.

Press Home to exit (or Ctrl+D in a plain terminal).

## Assets

`images/icon_hd.png`, `images/icon_fhd.png`, `images/splash_hd.jpg`, `images/splash_fhd.jpg` and
`images/demo_photo.jpg` are original artwork generated for this app (a `node-canvas` script, not
kept in the repo) — the icon/splash echo the same rounded-gradient-bordered look the `Effect` node
itself produces; `demo_photo.jpg` is an abstract sunset used as the `Poster` panels' source image.
