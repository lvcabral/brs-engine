# Group Scale Probe

Checks how a Group's `scale` / `rotation` / `scaleRotateCenter` reach descendants against a real device,
read back through `localBoundingRect()` / `boundingRect()` / `sceneBoundingRect()`, plus a screenshot for
the cases that can only be checked visually. Two pages:

- **Page 1** (`GroupScaleScene`, default): the review findings on PR #1257, cases S1-S9.
- **Page 2** (`GroupScaleReviewScene`, launch param `scene=review`): the review findings on PR #1291,
  cases R1-R4.

## Run

Device:

```bash
zip -r ../group-scale-probe.zip manifest source components images -x '*.DS_Store'
curl --digest -u "rokudev:<devpassword>" -F mysubmit=Install -F "archive=@../group-scale-probe.zip" \
  "http://<roku-ip>/plugin_install"
telnet <roku-ip> 8085
# page 2 (pass any run=<nonce> to tell this run's lines from console replays):
curl -d '' "http://<roku-ip>:8060/launch/dev?scene=review&run=1"
```

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/group-scale-probe
node packages/node/bin/brs.cli.js --root test/simulator/probes/group-scale-probe --deep-link scene=review
```

The trace prints after a settle Timer (1 s on page 1, 1.5 s on page 2). The scene then stays up for 8 s so
a screenshot can be taken (`--snapshot <file>` + Ctrl+S in the engine).

Captured files (screenshots are of the FHD scene):

| File | Page | Source |
| --- | --- | --- |
| `device-trace.txt` / `device-screenshot.jpg` | 1 | Streaming Stick, Roku OS 16.0.4 (1280x720 capture) |
| `device-trace-os15.txt` | 1 | Streaming Stick+, Roku OS 15.3.4: same as OS 16 but for Label font widths |
| `engine-trace-master.txt` / `engine-screenshot-master.png` | 1 | master @ `822383a` |
| `engine-trace-pr1257.txt` / `engine-screenshot-pr1257.png` | 1 | PR #1257 head `f2c1edd` |
| `engine-trace.txt` / `engine-screenshot.png` | 1 | PR #1291 with the review fixes |
| `device-trace-review.txt` / `device-screenshot-review.jpg` | 2 | Streaming Stick+, Roku OS 15.3.4 |
| `engine-trace-review-pr1291.txt` / `engine-screenshot-review-pr1291.png` | 2 | PR #1291 head `52d59cb` |
| `engine-trace-review.txt` / `engine-screenshot-review.png` | 2 | PR #1291 with the review fixes |

## Output format

```
PROBE|<seq>|<case>|<node>|local={...} parent={...} scene={...}
```

## Device rules (measured)

- `localBoundingRect()`: the node's **own** coordinate system. It leaves out the node's own scale and
  every ancestor's. That holds for renderables too: a 200x200 Rectangle or Poster scaled 0.5 reports
  `{0,0,200,200}`, with or without a child covering it (R3).
- `boundingRect()`: the **parent's** system. It includes the node's own translation/scale/rotation and
  leaves out ancestors'. A 64x64 Rectangle in a `scale=0.5` Group reports `64x64`, and the Group reports
  `32x32`.
- `sceneBoundingRect()`: everything composed.
- A node with no rotation and no scale of its own is **not moved by its `scaleRotateCenter`**, even under a
  rotated parent: a 200x40 Label, Rectangle or Group with pivot `[100,20]` inside a Group rotated 90° all
  cover `{T.x, T.y-200, 40, 200}` (R1).
- With its own rotation, a node turns around `translation + scaleRotateCenter` in the parent's space; a
  Label's text turns with its box around that pivot (R1 `l1d`/`l1e`, screenshot).
- A scaled and rotated node keeps its pivot at the unscaled `translation + scaleRotateCenter`: a 200x200
  Poster or Rectangle scaled 0.5, rotated 0.5 around `[100,100]` covers a 136x136 box centered on it (R2).
- A `LayoutGroup` under a scaled Group lays out in **local** units: `itemSpacings=[10]` with 50-tall
  items gives translations `0, 60, 120`.
- A node type that places its own content (TargetGroup items, LabelList rows, PanelSet panels) scales all
  of it around its translation (R4): a LabelList scaled 0.5 draws 300x50 rows at 150x25, 25 apart.
- `inheritParentTransform=false` detaches the node completely. It draws at its own `translation` in
  scene space, unscaled, and its `boundingRect()` / `sceneBoundingRect()` report `{0,0,64,64}`.
- A MaskGroup under `scale=0.5`: the content is scaled, but the mask keeps its unscaled `maskSize`,
  anchored at the scaled origin. The visible result is a quarter circle.

## Page 1: results vs. PR #1257 review findings

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

With the PR #1291 review fixes (`engine-trace.txt`), page 1 differs from the device only in the gaps
below: S4 sub rects, S5 font metrics and S7.

## Page 2: results vs. PR #1291 review findings

| Finding | Case | Device | PR #1291 head | With the fixes |
| --- | --- | --- | --- | --- |
| F1 pivot shift applied to every node type | R1 `l1a` Label text | text in x 200..240, y 150..350 | rect right, **text drawn ~120 px up-left** ✗ | ✓ (rect and text) |
| F1 (control) Rectangle / Group with pivot | R1 `r1b`, `r1c` | `{400,150,40,200}`, `{600,150,40,200}` | ✓ | ✓ |
| F2 Poster image vs. its Effect pivot | R2 `p2` vs `p2e` | both `{x+32,532,136,136}`, same position | `p2e` rect `{632,484,271,271}`, image shifted ✗ | ✓ same box, aligned |
| F3 renderable `localBoundingRect` excludes own scale | R2 `p2`/`r2`, R3 `r3a`/`r3b`/`p3c`/`l3d` local | 200x200 (Label 102x36), with or without child | 100x100 (`l3d` 55x18) ✗ | ✓ (Label width is font metrics) |
| F4 own scale on TargetGroup | R4 `tg4` screenshot | items 100x100, 120 apart | drawn full size ✗ | ✓ |
| F4 own scale on PanelSet | R4 `pn4`/`bx4` scene | `{939,780,75,75}` | `{1058,780,300,300}` ✗ | ✓ |
| F4 own scale on LabelList | R4 `ll4` parent | `{482,816,186,102}` | `{464,814,372,186}` ✗ | `{482,817,186,93}` (height/outset gap below) |

F5 (PosterGridItem child offset), F6 (scale frame vs. a leaked clip) and F7/F8 (per-child field reads) are
engine-internal and have no device-visible case; they are pinned by unit tests
(`test/extensions/scenegraph/ScaleRotateFrame.test.js`, `test/brsTypes/interfaces/IfDraw2D.test.js`).

Also found on page 2: a grid drawn inside a scale frame stopped placing rows at the UNSCALED screen
edge, so a scaled list near the bottom of the screen lost rows the device shows. Fixed with the rest.

## Gaps outside these PRs (wrong on master too)

- A rotated Group's own `boundingRect()` ignores its rotation. Device: `spun` parent `{1332,832}`,
  `g6` parent `y=-21`. Engine: `{1300,800}` / `y=79`.
- `PosterGrid.subBoundingRect("itemR_C")` returns scene coordinates (`{100,560,...}`); the device returns
  `{0,0,100,100}`. On the device, every item also reports the same rect. Same for LabelList
  `sceneSubBoundingRect("itemN")` (device `{500,820,150,25}`, engine the whole list rect).
- Label text widths differ (device 185 on OS 16 / 193 on OS 15.3, engine 207 for "Scaled Label"). These
  are font metrics.
- A Label with its own rotation turns its text around the text origin, not around
  `translation + scaleRotateCenter` (R1 `l1d`/`l1e` screenshots); its bounding rects are right.
- A TargetGroup reports a 0x0 rect; the device reports the union of its targets (`{0,0,440,200}`).
- A LabelList reports 186 tall with a -6 top outset where the device reports 204 and -9; a PanelSet's own
  rect leaves out its arrows/header area (device local `{97,0,1726,300}`).
- On Roku OS 15.3 the `Effect` node exists but its `borderRadius` shows no rounded corners (R2 `p2e`); the
  engine rounds them.
- `inheritParentTransform=false` (S7) is not implemented.
