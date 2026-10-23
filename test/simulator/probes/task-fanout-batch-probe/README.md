# task-fanout-batch-probe

Probes for the render→Task fan-out batching in PR #1264 (`fix/task-port-observer-fanout`, fix for
#1263). Each folder is a standalone app; every one prints a `TASK SAW:` line with what the Task
received. Engine columns compare the PR build against `master`; the device column is a Roku Streaming
Stick on Roku OS 15.3.4.

## Device facts these probes established

- **A Task's XML `onChange` for a field written by the render thread runs only on the render thread**,
  with the render-side `m` (`ONCHANGE ... inTask=false` in `single-reentrant` and `wait-in-handler`;
  `observer: n=0` in `reentrant-onchange`). The engine, on both `master` and the PR, runs it on the
  render thread **and again** on the task thread (`inTask=false` and `inTask=true` lines for the same
  value). The task-thread run is what makes the re-entrancy cases below reachable at all.
- **After launch, the render-side `m.port` is `Invalid`.** `render-port-read` prints
  `PORT in init: type=roMessagePort`, then `PORT on render: type=Invalid` from a function observer
  running on the render thread; an unguarded `m.port.getMessage()` there crashes with
  `Interface not a member of BrightScript Component (runtime error &hf3)`. The engine keeps a live
  `roMessagePort` in the render-side `m`.
- A 15.8M-char string written to a Task field arrives truncated to ≤ 1M chars (`batch-drop`:
  `small=100 big=0`); the engine delivers it whole.

## Results

PR columns: `a02fd883` is the first PR commit, `b5ff1100` the review-fix commit.

| App | What it does | PR `a02fd883` | PR `b5ff1100` | master | Device (OS 15.3.4) |
| --- | --- | --- | --- | --- | --- |
| `dup-launch` | A 1ms repeating Timer launches 20 Tasks; each `fire` sets `control="run"` and then writes a port-observed field, usually inside the render loop's frame-cap wait. | `DUPLICATED=18` | `DUPLICATED=0` (6/6 runs) | `DUPLICATED=0` | `DUPLICATED=0` |
| `batch-drop` | After launch, 99 writes of 10K chars and then one 15.8M-char write. Each fits the 16MB `SharedObject` alone; packed into one batch they don't. | `small=0 big=0` + `Update dropped` | `small=99 big=1` | `small=99 big=1` | `small=100 big=0` (big string truncated) |
| `reentrant-onchange` | 3000 strictly increasing writes streamed from a Timer to a field with an XML `onChange`. | `port: n=2400 inversions=3` | `port: n=3000 inversions=0` | `port: n=2998 inversions=0` | `port: n=3000`, `observer: n=0` (runs on render) |
| `reentrant-control` | Same, with a function `observeField` (runs on the writer/render thread). | `port: n=3000` | `port: n=3000` | `port: n=3000` | `port: n=3000` |
| `batch-throw` | 100 writes after launch; the task-side `onChange` throws on value 5, caught by the task's `try/catch` around `wait()`. | `onChange ran=5` (95 lost) | `onChange ran=100 caught=1` | keeps delivering | `onChange ran=0` (runs on render), `port events=41` |
| `single-reentrant` | The task-side XML `onChange` busy-loops 500ms on value 1 while the Scene sends 2..30 one per 20ms, so each hand-off carries a single update. | — | `onChange n=5`, `port n=5` of 30 | `onChange n=6`, `port n=6` of 30 | runs on render only, `port n=30` |
| `wait-in-handler` | The task-side XML `onChange` calls `wait(1, m.port)` on the port observing the same field; 1000 writes in bursts of 50. | — | `onChange n=12–14`, `port n=12–14` of 1000 | `n=1000`, `port n=1000` | runs on render only, `port n=1000` |
| `render-port-read` | Port and function observer registered in the Task's `init()`; the function observer (render thread) reads `m.port`. | — | `port messages=0` of 10 | `port messages=10` | `m.port` is `Invalid` on render |
| `stale-slot-restart` | Run 1 sleeps with a write of 1 handed to its slot but never read; stop, write 2, restart. | — | `start=2 onChange=[]` | `start=2 onChange=[]` | `start=2 onChange=[]` |

`batch-throw`'s `port events` is capped by its 41-pass `wait()` loop.

### Reading the new rows

- `single-reentrant` and `wait-in-handler` lose **port** events on the engine, not just `onChange`
  calls; the device delivers every port event. Both need BrightScript running on the task thread in
  the middle of a fan-out update, which only happens because the engine also runs XML `onChange`
  there. `single-reentrant` loses events on `master` too; `wait-in-handler` is new in `b5ff1100`
  (its `fromWait` path applies the rest of the batch inside the running handler).
- `render-port-read` differs between `master` and the PR, but neither matches the device, which has
  no readable port on the render side at all.

## Running

```bash
# from this folder, with a built CLI (npm run build:cli)
node ../../../../packages/node/bin/brs.cli.js -r dup-launch source/main.brs -c 0
```

Replace `dup-launch` with any of the other folder names. `master` runs `reentrant-onchange`,
`reentrant-control` and `wait-in-handler` in ~20–50s (one fan-out update per frame); the PR build
takes ~5s.

On a device, zip `manifest`, `source/` and `components/` of one app, sideload it, and read the
console:

```bash
curl --digest -u "rokudev:<devpassword>" -F "mysubmit=Install" -F "archive=@<app>.zip" \
  "http://<roku-ip>/plugin_install"
telnet <roku-ip> 8085
```
