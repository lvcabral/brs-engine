# Animated Image Node Probe

Checks the SceneGraph `AnimatedImage` node on a real Roku vs. brs-engine: the size a node with no `uri` reports, and
whether a node that loaded but never played shows its first frame.

`images/anim.webp` (made by `make-anim.py`) has four solid 200x200 frames of 100 ms: white, grey (128), orange
(255,128,0), cyan (0,255,255). The scene (dark blue background) has:

| Node | Setup |
| --- | --- |
| `empty`, `emptySized` | No `uri`; the second with `width`/`height` 100. |
| `idle`, `idleSized` | `uri` set, no `control`; the second with `width`/`height` 100. |
| `played` | `uri` and `control="play"` (single-shot). |
| `inRow` | No `uri`, in a horizontal `LayoutGroup` between two 50x50 rectangles with `itemSpacings="[10]"`. |

It prints each node's `state`, `mediaWidth`x`mediaHeight`, `boundingRect()` and `localBoundingRect()` in `init()`
and 2 s later, plus the second rectangle's translation, then `PROBE|shot`, where `run-device.sh` takes a screenshot
(`device-shot.jpg`).

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt and device-shot.jpg
./run-engine.sh                                 # npm-linked brs-cli, after npm run build:cli; writes engine-trace.txt
diff device-trace.txt engine-trace.txt
```

`engine-trace-before.txt` is the engine before the idle node showed its first frame (readouts are the same).

## Results (Roku Express 4K+, OS 16.0.4, 2026-11-24)

- A node with no `uri` is 0x0: `boundingRect()` is `40,40,0,0`, and in the `LayoutGroup` it takes no width but
  keeps its spacing (the second rectangle is at x 70 = 50 + 10 + 0 + 10). With `width`/`height` set it is that size.
  The engine matches (it used to report 1x1).
- A node that loaded but never played is in state "first" and shows its first frame (white in `device-shot.jpg`),
  at its natural size or scaled to `width`/`height`. The engine used to draw nothing until `control` was set.
- Not yet matched: `played` (`control="play"`, state "stop" after the run) holds the **second** frame (grey), not
  the last one (cyan) the engine holds.
- Timing only: in `init()` the device is still "downloading" with no size and has not laid out the `LayoutGroup`;
  the engine loads and lays out synchronously, so it already reports the sizes.
