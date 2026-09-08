# Node-Owned-By-Task CallFunc Probe

A sideloadable Roku app built to verify the _actual_ New Relic Roku SDK crash shape against real
hardware, using the SDK's real source structure (fetched from
[newrelic/video-agent-roku](https://github.com/newrelic/video-agent-roku), tag `3.2.4`,
`components/NewRelicAgent/{NRAgent.xml,.brs}`) rather than a guessed one.

## Why this probe exists

The engine's render→Task `callFunc` rendezvous fix (see
[`.claude/docs/threading-and-rendezvous.md`](../../../.claude/docs/threading-and-rendezvous.md) and
the sibling probe `test/simulator/probes/callfunc-task-thread-probe/`) was built against an
_assumed_ repro shape: the app directly `CreateObject()`s a `Task` on render and calls `callFunc`
on it. That assumption turned out to be **wrong** for the actual reported crash. Reading the real
SDK source revealed:

-   `com.newrelic.NRAgent` (`NRAgent.xml`) is a **plain `Node`**, not a `Task`. `nrSetHarvestTime` is
    one of its `callFunc`-invoked wrapped functions.
-   `m.nrHarvestTimerEvents = m.top.findNode("nrHarvestTimerEvents")` (the reference that crashed:
    `m.nrHarvestTimerEvents.duration = seconds`) happens inside `NewRelicInit()` — itself a
    `callFunc`-invoked function — **not** `init()`.
-   The actual `Task` in the SDK is a _child_ of `NRAgent` (`com.newrelic.NRTask`, id `NRTaskEvents`),
    used for background HTTP posting — `bgTaskEvents` in the crash report's dropped-reference warning
    is this child.

None of this matches "render calls `callFunc` on a `Task` it directly constructed." The plausible
real shape — and the one this probe builds — is: **the app's own business-logic `Task` constructs
the agent `Node` on its own worker thread (not render) and publishes it as a `m.global` singleton**
(`CreateObject` once, store a handle other components/threads reach it through — a very common SDK
integration pattern), and **render** later reads that handle back out of `m.global` and calls
`callFunc` on it.

## Status: RESOLVED — root cause found, fixed, and confirmed against a real Roku device

Built the exact shape (`AppTask`, a `Task`, constructs `AgentNode`, a plain `Node` with a child
`<Timer id="harvestTimer">` found via `findNode()`, then publishes it via `m.global.nrAgent`) and
verified this end to end:

1. **Reproduced the exact crash on `master`, and confirmed on a real Roku device it does NOT
   crash there** — this was the deciding piece of evidence: the engine's `master` build produced
   a crash that real hardware does not, confirming this was a genuine engine bug rather than
   device-accurate behavior an app would need to work around.
2. **Found two distinct root causes, both in `Task.ts`/`Node.ts`, both fixed:**
    - `Task.syncRemoteField` unconditionally re-owned any `Node` value synced from a task thread to
      render to render (`fieldValue.setOwner(0)`) — correct for a task reporting/handing off a
      result through its **own** interface field (`m.top.xxx = someNode`, the receiver needs to run
      `callFunc` against its own copy), but wrong for a task merely **publishing a reference** to a
      node it keeps using itself (`m.global.someHandle = someNode`). The node's true owning thread
      never changes in that case, so re-owning it broke every later same-thread access on the
      owning task — confirmed via same-thread isolation (STEP1/STEP2 below) and, decisively, absent
      on the real device. Fixed by gating the re-own on `address === this.address` (the task setting
      _its own_ field) rather than firing unconditionally.
    - `Node.callFuncThread()`'s base unconditionally returned `undefined`, so even with the above
      fixed, a render-initiated `callFunc` onto a correctly task-owned plain `Node` (not itself a
      `Task`) never rendezvoused: `shouldRendezvous()`/`rendezvousCall()` only ever fire for a
      **task**-initiated caller (`sgRoot.inTaskThread()`), never a render-initiated one, regardless
      of the target's owner. Fixed by generalizing the base case to check `this.owner` against
      `sgRoot.getThreadTask()` and route through the same `rendezvousCallFunc`/
      `requestTaskMethodCall` machinery the Task-specific fix already used.
3. **Re-verified the full repro end to end with both fixes applied**: STEP1/STEP2 isolation both
   succeed, and the actual `render-call` phase (the reported bug shape) returns `42` with no crash.
   `npm test` (full suite, 221 files / 2929 tests) and `npm run lint` both pass.

See `test/cli/resources/task-owned-node-callfunc-app/` and the corresponding
`it("Rendezvouses a callFunc from the render thread onto a plain Node owned by a Task thread", ...)`
in `test/cli/cli-scenegraph.test.js` for the automated CLI regression — verified with `git
stash`/rebuild cycles isolating `src/` to fail on `master` and pass with the fix, the same rigor
applied throughout this investigation.

## Build and sideload

```bash
./pack.sh                                          # produces node-owned-by-task-callfunc-probe.zip
```

Sideload at `http://$ROKU/` with the device in developer mode.

## What to expect / how to read it

**STEP1/STEP2 fire automatically at startup, no key press needed.** Watch the debug console
(`telnet $ROKU 8085`) or the on-screen status label. With the fix applied, both succeed
(`STEP2 (post-publish) result=22 -> OK`) and the app proceeds to the phase keys:

| Key      | Phase          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rewind` | `task-call`    | `AppTask` calls `callFunc` on its own local agent again, later, from its normal wait loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `up`     | `foreign-call` | A _different_ Task (`ForeignTask`) reads the agent back from `m.global` and calls `callFunc` on it — Task-to-Node, not render-to-Node. **Fails, but not for a `callFunc` reason**: `m.global.nrAgent` itself reads back `Invalid` on `ForeignTask`, before `callFunc` is ever reached — see [issue #1219](https://github.com/lvcabral/brs-engine/issues/1219), a confirmed simulator bug (not device-accurate — real Roku succeeds here) where a field another task adds to `m.global` _after_ this task's own launch is invisible to it. Unrelated to this PR's own fix (reproduces identically on `master` in isolation, no `callFunc`/ownership involved). This kills the app (uncaught Task error), so run `down` before `up` if you want to see `render-call` succeed in the same session. |
| `down`   | `render-call`  | **The actual reported bug shape**: render reads the agent back from `m.global` and calls `callFunc` on it, matching `m.nrAgent.callFunc("nrSetHarvestTime", seconds)` from the main thread exactly. With the fix: succeeds, `result=42`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `back`   | —              | exit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The `[sg] Dropped script-scope reference "harvesttimer"` warning still fires once, harmlessly —
it's render's own, unused reconstructed copy of the agent failing to resolve a reference it never
needs, since the fixed dispatch correctly routes to the real, task-owned copy instead. It does not
indicate a problem.

## Real-device verification

Confirmed on a real Roku, pressing `rewind`, `down`, then `up` in sequence: STEP1/STEP2 isolation,
`task-call`, and `render-call` (the actual reported bug shape, this PR's fix) all succeed with no
crash — matching the simulator with the fix applied. `foreign-call` also succeeds on device; the
simulator still crashes there, but for the separate, unrelated `m.global` bug tracked in
[issue #1219](https://github.com/lvcabral/brs-engine/issues/1219), not this PR's fix.

## Engine baseline

```bash
npm run build:cli   # from the repo root, if not already built
brs-cli --ecp -z --log probe-cli.log node-owned-by-task-callfunc-probe.zip
```

With the fix (current `src/`): STEP1 succeeds (`11`), STEP2 succeeds (`22`, "OK"), `render-call`
succeeds (`42`). Reverting `src/` to `master` (`git stash push -- src/`) and rebuilding reproduces
the original crash exactly: STEP2 throws `Invalid value for left-side of expression` (preceded by
the `Dropped script-scope reference "harvesttimer"` warning) and terminates the app before
`render-call` is ever reachable.
