# Group Scale Probe

Checks the review findings on PR #1257 ("apply Group scale and rotation pivot to descendants and their
clippingRect") against a real device. It covers how a Group's `scale` / `rotation` / `scaleRotateCenter`
reach descendants, read back through `localBoundingRect()` / `boundingRect()` / `sceneBoundingRect()`, plus
a screenshot for the cases that can only be checked visually.

## Run

Device (Streaming Stick, Roku OS 16.0.4):

```bash
zip -r ../group-scale-probe.zip manifest source components images -x '*.DS_Store'
curl --digest -u "rokudev:<devpassword>" -F mysubmit=Install -F "archive=@../group-scale-probe.zip" \
  "http://<roku-ip>/plugin_install"
telnet <roku-ip> 8085
```

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/group-scale-probe
```

The trace prints after a 1 s settle Timer. The scene then stays up for 8 s so a screenshot can be taken.

Captured files: `device-trace.txt` / `device-screenshot.jpg`, `engine-trace-master.txt` /
`engine-screenshot-master.png` (master @ `822383a`), `engine-trace-pr1257.txt` /
`engine-screenshot-pr1257.png` (PR head `f2c1edd`). Screenshots are 1280x720 of the FHD scene.

## Output format

```
PROBE|<seq>|<case>|<node>|local={...} parent={...} scene={...}
```

## Device rules (measured)

- `localBoundingRect()`: the node's **own** coordinate system. It leaves out the node's own scale and
  every ancestor's.
- `boundingRect()`: the **parent's** system. It includes the node's own translation/scale/rotation and
  leaves out ancestors'. A 64x64 Rectangle in a `scale=0.5` Group reports `64x64`, and the Group reports
  `32x32`.
- `sceneBoundingRect()`: everything composed.
- A `LayoutGroup` under a scaled Group lays out in **local** units: `itemSpacings=[10]` with 50-tall
  items gives translations `0, 60, 120`.
- `inheritParentTransform=false` detaches the node completely. It draws at its own `translation` in
  scene space, unscaled, and its `boundingRect()` / `sceneBoundingRect()` report `{0,0,64,64}`.
- A MaskGroup under `scale=0.5`: the content is scaled, but the mask keeps its unscaled `maskSize`,
  anchored at the scaled origin. The visible result is a quarter circle.

## Results vs. review findings

| Finding | Case | Device | master | PR #1257 | Verdict |
| --- | --- | --- | --- | --- | --- |
| F1 rects include ancestor scale | S1/S3/S9 `c1`, `shade`, `dot` local/parent | 64x64 | 64x64 ✓ | 32x32 / 16x16 ✗ | **Confirmed, PR regression** |
| F1 Group's own `localBoundingRect` | S1 `g1` local | `{20,10,64,64}` | ✓ | `{10,5,32,32}` ✗ | **Confirmed, PR regression** |
| F1 Group's own parent/scene rect | S1 `g1`, S9 `ball` | 32x32 | 64x64 ✗ | 32x32 ✓ | PR fix is correct |
| F1 LayoutGroup under scale | S2 `b2`,`c2` translation | `0,60` / `0,120` | ✓ | `0,70` / `0,140` ✗ | **Confirmed, PR regression** (visible gaps) |
| F2 pass scale cache / pivot | S3 Poster with own pivot | scene `{700,100,50,50}` | ✗ (unscaled) | ✓ | Not reproduced in this setup |
| F3 containers placing items | S4 PosterGrid under scale | 3 tiles at 60 px pitch, rect 201x71 | unscaled | tiles 50 px at 120 px pitch, rect 402x142 ✗ | **Confirmed** (looks worse than master) |
| F4 MultiStyleLabel | S5 `ms5` scene | 130x18 | unscaled | 275x36 drawn full size, overlaps ✗ | **Confirmed** |
| F4 MonospaceLabel | S5 `mo5` scene | 171x19 | unscaled | 165x18 ✓ (local wrong per F1) | Not an issue |
| F5 own rotation in rotated parent | S6 `r6` vs `gc6` | diamond y ≈ −21..120, child at its bottom | both wrong (in different places) | child ✓ `{1436,92}`, diamond still at y 79..220 ✗, `r6` scene rect 191x162 ✗ | **Confirmed**: content and children come apart. The diamond position was already wrong on master |
| F6 MaskGroup under scale | S8 | quarter circle | full unscaled circle, wrong place | thin sliver ✗ | **Confirmed** (mismatch on both, PR worse) |
| F7 `inheritParentTransform=false` | S7 `r7` | drawn at (40,40) in the scene, unscaled; rect `{0,0,64,64}` | `{1440,460}` ✗ | `{1440,460}` ✗ | **Confirmed, existed before the PR** |
| PR's own rotation pivot | S9 `chip` | `{1332,832}` | `{1268,768}` ✗ | ✓ | PR fix is correct |

Gaps found along the way, outside the PR's scope (wrong on master too):

- A rotated Group's own `boundingRect()` ignores its rotation. Device: `spun` parent `{1332,832}`,
  `g6` parent `y=-21`. Engine: `{1300,800}` / `y=79`.
- `PosterGrid.subBoundingRect("itemR_C")` returns scene coordinates (`{100,560,...}`); the device returns
  `{0,0,100,100}`. On the device, every item also reports the same rect.
- A scaled PosterGrid's `boundingRect()` / `sceneSubBoundingRect()` are not scaled.
- Label text widths differ (device 185, engine 207 for "Scaled Label"). These are font metrics, not
  related to this PR.
