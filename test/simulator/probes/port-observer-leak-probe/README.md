# port-observer-leak-probe

Repro for lvcabral/brs-engine#1263: a Task `observeFieldScoped(field, port)` in `init()` while the
render thread writes that field 200,000 times (the shape of the rooibos code-coverage collector).

Device (4850CA, Roku OS 15.3.4): writes in ~3.9s, `RESULT received=200000`.

Engine:

- Before the fix: every write also queued an `roSGNodeEvent` on the render-side copy of the task's
  port (never drained while the task runs), and fan-out handed the task one update per frame.
- After: post-launch writes skip the render-side port and fan-out is batched (see the #1263 note in
  `.claude/docs/threading-and-rendezvous.md`). This probe's writes all land in `init()`, **before**
  the Task launches, so they still go through the launch replay: completes (`received=200000`) but
  peaks ~1.7 GB. Moving the loop into a Timer callback (post-launch) peaks ~490 MB for 50,000 writes.

```bash
cd test/simulator/probes/port-observer-leak-probe && zip -qr ../../../../out/port-observer-leak-probe.zip . -x README.md
cd ../../../.. && /usr/bin/time -l node packages/node/bin/brs.cli.js out/port-observer-leak-probe.zip
```
