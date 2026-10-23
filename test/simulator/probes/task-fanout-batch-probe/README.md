# task-fanout-batch-probe

Probes for render→Task field delivery: the fan-out batching added in #1264 (fix for #1263), and the
Task observer-thread and `m`-clone rules its review uncovered. Each folder is a standalone app; every
one prints a `TASK SAW:` line with what the Task received. Device column: Roku Streaming Stick,
Roku OS 15.3.4.

## Device facts these probes established

Both are also stated in Roku's `threads.md` ("Task node objects ownership", "Component global
associative array").

- **A Task's XML `onChange` runs only on the render thread**, with render's `m`, whichever thread wrote
  the field (`onchange-thread`: `fromRender` and `fromTask` both print `inTask=false`). Before the fix
  the engine ran it on render **and** again on the task thread, which is what let fan-out apply re-enter
  a running handler (`single-reentrant`, `wait-in-handler`).
- **On launch, render keeps a clone of the Task's `m` without its message ports.** The port created in
  `init()` reads `Invalid` on render after launch (`render-port-read`; an unguarded
  `m.port.getMessage()` there crashes with `&hf3`) and on a re-run of the same task (`rerun-port`);
  arrays and timespans are cloned, and the re-run's counters restart from render's clone.
- A 15.8M-char string written to a Task field arrives truncated to ≤ 1M chars (`batch-drop`); the
  engine delivers it whole. Not addressed.

## Results

Columns: `pre` is master before #1264; `a02fd883` and `b5ff1100` are #1264's two commits (`b5ff1100`
is what merged); `fix` is the follow-up that runs a Task's XML `onChange` only on render and detaches
the launched ports.

| App | What it does | pre | `a02fd883` | `b5ff1100` | fix | Device |
| --- | --- | --- | --- | --- | --- | --- |
| `dup-launch` | A 1ms Timer launches 20 Tasks; each `fire` sets `control="run"`, then writes a port-observed field. | `DUPLICATED=0` | `DUPLICATED=18` | `0` | `0` | `0` |
| `batch-drop` | 99 writes of 10K chars, then one of 15.8M chars. | `small=99 big=1` | `small=0 big=0` (dropped) | `99/1` | `99/1` | `small=100 big=0` (truncated) |
| `reentrant-onchange` | 3000 increasing writes to a field with an XML `onChange`. | `port n=2998` (~50s) | `port n=2400`, 3 inversions | `port n=3000` (~5s) | `port n=3000`, `observer n=0` | `port n=3000`, `observer n=0` |
| `reentrant-control` | Same, with a function `observeField`. | `port n=3000` | `3000` | `3000` | `3000` | `3000` |
| `batch-throw` | 100 writes; the task-side `onChange` throws on 5. | keeps delivering | `onChange ran=5` | `ran=100 caught=1` | `ran=0`, `port events=41` | `ran=0`, `port events=41` |
| `single-reentrant` | Task-side `onChange` busy-loops 500ms on 1 while 2..30 arrive one per 20ms. | — | — | `port n=5` of 30 | `port n=30` | `port n=30` |
| `wait-in-handler` | Task-side `onChange` calls `wait(1, m.port)`; 1000 writes in bursts. | `port n=1000` | — | `port n=12` of 1000 | `port n=1000` | `port n=1000` |
| `render-port-read` | A render-thread function observer reads the port the Task created in `init()`. | `port messages=10` | — | `0` of 10 | `m.port` Invalid | `m.port` Invalid |
| `stale-slot-restart` | Stop with a write left in the slot, write 2, restart. | `start=2 onChange=[]` | — | `start=2 onChange=[]` | same | same |
| `onchange-thread` | XML `onChange` on a field written by render and one written by the task. | both threads, port live | — | both threads, port live | render only, `port=Invalid` | render only, `port=Invalid` |
| `rerun-port` | Re-run a task whose port was created in `init()`. | run 2 `port=roMessagePort` | — | run 2 `port=roMessagePort` | run 2 `port=Invalid` | run 2 `port=Invalid` |

`batch-throw`'s `port events` is capped by its 41-pass `wait()` loop. In the `fix`/device columns the
`onChange`/`observer` counts are 0 because those handlers run on render, where the probe's `m.inTask`
gate (or the task-side counter) never sees them.

## Running

```bash
# from this folder, with a built CLI (npm run build:cli)
node ../../../../packages/node/bin/brs.cli.js -r dup-launch source/main.brs -c 0
```

Replace `dup-launch` with any of the other folder names.

On a device, zip `manifest`, `source/` and `components/` of one app, sideload it, and read the
console:

```bash
curl --digest -u "rokudev:<devpassword>" -F "mysubmit=Install" -F "archive=@<app>.zip" \
  "http://<roku-ip>/plugin_install"
telnet <roku-ip> 8085
```
