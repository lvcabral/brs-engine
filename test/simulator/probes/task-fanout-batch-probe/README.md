# task-fanout-batch-probe

Engine-only probes for the render→Task fan-out batching in PR #1264 (`fix/task-port-observer-fanout`,
fix for #1263). Each folder is a standalone app; every one prints a `TASK SAW:` line with what the
Task received. They are engine-vs-engine comparisons (PR build vs. `master`), not device diffs.

| App | What it does | PR #1264 | master |
| --- | --- | --- | --- |
| `dup-launch` | A 1ms repeating Timer launches 20 Tasks; each `fire` sets `control="run"` and then writes a port-observed field. The timer usually fires inside the render loop's frame-cap wait, where `flushFanouts()` hands the write to the slot before `checkTaskRun`'s launch replay sweeps the same event. | `ROUNDS=20 DUPLICATED=18` (e.g. `[r18,r18]`) | `DUPLICATED=0` |
| `batch-drop` | After launch, 99 writes of 10K chars and then one 15.8M-char write. Each fits the 16MB `SharedObject` alone; packed into one batch they don't. | `small=0 big=0` + `Update dropped: payload of 16799019 bytes exceeds the 16777216-byte buffer limit` | `small=99 big=1` |
| `reentrant-onchange` | 3000 strictly increasing writes streamed from a Timer. The field has an XML `onChange`, which runs BrightScript **on the task thread** while a batch is applied, so `tick` → `processThreadUpdate` loads the next batch in the middle of the current one. | `port: n=2400 inversions=3` (20k writes: `n=18800–19400`, 3–5 inversions) | `port: n=2998 inversions=0` |
| `reentrant-control` | Same as above, but with a function `observeField` (runs on the writer/render thread), so no BrightScript runs on the task thread mid-batch. | `port: n=3000 inversions=0` | `port: n=3000 inversions=0` |
| `batch-throw` | 100 writes (1..100) after launch; the task-side `onChange` throws on value 5, caught by the task's `try/catch` around `wait()`. | `onChange ran=5 port events=4` (95 updates lost) | keeps delivering past 5 (`port events=40` in the 4s window, one update per frame) |

```bash
# from this folder, with a built CLI (npm run build:cli)
node ../../../../packages/node/bin/brs.cli.js -r dup-launch source/main.brs -c 0
```

Replace `dup-launch` with any of the other folder names. `master` runs `reentrant-onchange` and
`reentrant-control` in ~50s (one fan-out update per frame); the PR build takes ~5s.
