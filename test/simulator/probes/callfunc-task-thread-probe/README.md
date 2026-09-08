# CallFunc / Task-Thread Probe

A sideloadable Roku app that exercises `callFunc` from the render (main) thread onto a `Task`
node's own worker thread, phase by phase.

It exists to check the assumptions behind a brs-engine fix for a reported crash: a New Relic SDK
`Task` component crashed when the app's main thread called `callFunc` into it
(`m.nrAgent.callFunc("nrSetHarvestTime", seconds)`), because the engine ran the call locally
against the render thread's own incomplete copy of the node instead of rendezvousing to the
Task's actual worker thread — dropping a script-scope reference the Task had populated after
activation. The fix (and this probe) is scoped to exactly that call shape: `callFunc` issued from
the render thread's own, non-nested execution context onto a `Task` node.

> **Finding (device-confirmed, see Results below) — RESOLVED, the engine fix has been revised to
> match:** the render→Task rendezvous itself is real on device — a `callFunc`'d function runs on a
> distinct thread whose backtrace chains back through the render thread's own call site. But that
> dispatch context's `m` is **not** the Task's live, currently-mutating `m` — it's a snapshot taken
> once, right after `init()` completes, and never refreshed. `basic-init` (a node created in
> `init()`) and `basic-post` (a node created in `runTask()`, after `init()` returns) both report the
> *identical* 4-key `m` (`global, initnode, port, top`): `initNode` is there and fully functional (a
> live, working node reference — mutating it through the call really works, confirmed further by
> `refresh`), while `postLaunchNode` never appears at all, not even as a key. `port` (also created
> in `init()`) is present as a key but comes back `invalid` — a live `roMessagePort` apparently
> can't survive whatever snapshot/reconstruction mechanism this is. `latefield` confirmed the
> boundary is specific to *raw* `m` members — a declared field (`m.top.xxx`) set after `init()`
> works regardless of timing, since it crosses via the unrelated, already-correct field-sync path.
>
> `refresh` was the deciding test: the task mutated `m.initNode` **itself**, outside any `callFunc`,
> and a subsequent `callFunc`'d read saw that mutation (`1000 + 1 = 1001`) — proving the
> callFunc-visible node reference is the task's genuine live object, not a disconnected one-time
> copy. That turns "snapshot" into a precise, implementable rule: **freeze the *key set* of `m` at
> `init()`-completion; for a captured key, keep pointing at the exact same live value forever
> after.** The engine now implements exactly this (`Task.captureCallFuncSnapshot`/`callFuncM` in
> `nodes/Task.ts`, captured once from `execTask` right after `init()` runs) — see
> `.claude/docs/threading-and-rendezvous.md` for the full implementation writeup, and
> `test/cli/resources/task-render-callfunc-app` for the CLI regression covering both the positive
> (`init()`-time state) and negative (post-`init()` state, now correctly invisible) cases.

### Why `basic-init`'s readback isn't what it looks like

An earlier version of this probe claimed `basic-init`'s readback of `m.initNode.value` (via
`checkInitNode`/`taskSideInitValue`) *proved* the render→Task rendezvous is genuine — reasoning
that a buggy engine, running `callFunc` locally against render's own copy of the Task node, could
never make the *Task's own later code* see the mutation. That reasoning has a hole: a Task's
`init()` runs synchronously on render too, at construction time, so render's own copy also has an
`m.initNode` — succeeding by accident is possible, and a real user (running this probe both against
a known-buggy engine build and against the fix, with the two producing indistinguishable output)
caught exactly that.

Digging in by instrumenting the engine directly (temporary `fs.appendFileSync` markers inside
`rendezvousCall`/`callFunction`/the `callFunc` dispatch itself, bypassing `console.log`/`print` —
both can be silently dropped depending on which thread emits them) confirmed the mutation really
does run locally on render in the buggy build (0 ms elapsed, `this` bound to render's own node,
never touching the Task thread at all) — and yet `checkInitNode`'s readback still reported `MATCH`.
The reason: the Task thread's own `m.initNode` key, by the time `checkInitNode` runs, resolves
through a **live, address-based cross-thread proxy back to render's own node** — a separate,
pre-existing mechanism unrelated to this callFunc fix (any Node value present in a Task's initial
cross-thread `m` seed can end up proxied like this). Reading `.value` through that proxy genuinely
rendezvouses back to render and fetches render's *current* value — so the readback agrees with
render's local mutation regardless of whether the `callFunc` call itself ever rendezvoused. A
Node-field readback proves nothing either way.

Swapping the readback to a **raw `m` primitive** (`m.rawInitMirror`, mutated by `touchInitNode`
alongside `m.initNode.value`) doesn't fix this either, just for the opposite reason: per the device-
confirmed snapshot model above, a raw primitive touched from inside a `callFunc`'d function is
captured *by value* into the snapshot and never propagates back to the Task's real `m` — so this
readback shows `MISMATCH` even against a **correctly fixed** engine. Verified directly: both the
known-buggy build and the fixed build report `taskSideInitValue=0` against `expected=42`.

The signal that actually survived direct verification against both builds is **timing**:
`elapsed-ms` on the `callFunc` call itself. A call that never leaves render's own thread returns
near-instantly (0 ms, confirmed repeatedly against the known-buggy build); a call that genuinely
rendezvouses to the Task's own thread cannot return before that round trip completes (~520 ms,
confirmed repeatedly against the fixed build — the gap is roughly two orders of magnitude, not
sensitive to normal timing noise). `runBasicInit()` now prints an explicit verdict from this
(`elapsed-ms >= 20` → "genuine cross-thread round trip occurred"; otherwise "SUSPICIOUS ... likely
ran locally on render"). The two readback fields (`taskSideInitValue`/`taskSideNodeValue`) are kept
in the probe as documented diagnostics — each one's handler explains why it isn't a pass/fail
signal — not because they're useless, but because their *expected* result (mismatch for the
primitive, match-regardless-of-correctness for the Node field) is itself worth knowing.

Questions this probe answers against real hardware:

1. Does `callFunc` from the render thread onto a `Task` **rendezvous to the Task's own worker
   thread** (the render thread blocks until the Task services it), or does the device simply run
   it wherever it was called from? — **Confirmed: yes, it rendezvouses** (see finding above).
2. Is a script-scope `m` value visible and mutable from a function invoked this way, and does it
   matter **when** that value was created — in `init()` (`basic-init`) vs. after activation, inside
   the task function itself (`basic-post`, the exact shape that crashed brs-engine)? —
   **Confirmed: yes, it matters, and the boundary is exactly `init()` completion** (see finding
   above). `basic-post` crashes on device (dot-operator on invalid); `basic-init` succeeds.
3. Can a callFunc'd function read **render-owned data** (`m.global`) *during* the call — i.e. does
   a nested, reverse-direction rendezvous back into the render thread work while the render thread
   is itself blocked waiting for the callFunc to return? Or does this deadlock / time out?
4. Does the render thread genuinely **block** (UI frozen, no timers firing) for the duration of the
   call, confirming a true synchronous rendezvous rather than something async/fire-and-forget?
5. Is there a practical bound on how long the render thread will wait for a Task's `callFunc` to
   return, and what happens if that bound is exceeded (error, crash, or does it just hang)?
6. If the Task is executing a **tight, non-yielding loop** (no `wait()`/message-port poll), does
   the render thread's `callFunc` block until the Task reaches a `wait()` safepoint, or can the
   device service it earlier, mid-statement?
7. If a render-side observer of one of the Task's **own** fields calls `callFunc` back into that
   same Task — synchronously, before that field-set's own acknowledgment has been sent — does the
   device **deadlock**, or does it resolve safely? (brs-engine's own render-side wait loop
   deadlocks here; this is a fixture-design hazard the shipped fix doesn't need to handle, since
   the real crash never calls `callFunc` from a field observer of its own target — but it's worth
   knowing whether a device handles a pattern our engine currently can't.)
8. Do all common return-value types (integer, string, boolean, `invalid`, `roAssociativeArray`, an
   `roSGNode`) round-trip correctly through the callFunc return value?
9. Is the node reference a callFunc dispatch resolves for an `init()`-time key genuinely **live and
   shared** with the Task's own copy, or a one-time, disconnected reconstruction? (`refresh`: the
   Task mutates `m.initNode` itself, outside any callFunc, then a callFunc'd read checks whether it
   sees that mutation.)
10. Is the `init()`-completion boundary specific to **raw script-scope `m` members**, or does it
    also apply to a **declared field** (`m.top.xxx`, synced via the field-sync path that already
    works today) set after `init()`? (`latefield`.)

## Build and sideload

```bash
./pack.sh                                       # produces callfunc-task-thread-probe.zip
```

Sideload `callfunc-task-thread-probe.zip` at `http://$ROKU/` with the device in developer mode.

## Phases

Each phase is triggered by one remote key. Wait for a phase's `### PHASE <name> END` print before
starting the next one — `busy` in particular keeps the Task spinning for a full 3 s, and firing
another phase into the middle of that spin queues it behind `busy`'s own callFunc rather than
testing what you think it's testing (harmless, just confusing output — this happened during this
probe's own engine verification and was purely a rapid-fire testing artifact, not a probe bug).

Watch the on-screen **heartbeat** counter (updates every ~100 ms via a render-thread `Timer`) — it
visibly stalls whenever the render thread is blocked inside a `callFunc` wait, which is the most
direct evidence for question 4 without needing a stopwatch.

| Key | Phase | What it does | Answers |
| --- | --- | --- | --- |
| `rewind` | `basic-init` | `callFunc` touches `m.initNode`, a node the Task created **in `init()`**, before activation | 1, 2 |
| `up` | `basic-post` | `callFunc` touches `m.postLaunchNode`, a node the Task created **after** `control=RUN`, inside the task function itself — the exact shape that crashed brs-engine | 1, 2 |
| `down` | `nested` | Called function reads `m.global.probeValue` (render-owned) *during* the call | 3, 4 |
| `left` | `types` | `callFunc` round-trips 6 return types: `int`, `str`, `bool`, `invalid`, `roAssociativeArray`, `roSGNode` | 8 |
| `right` | `busy` | Task starts a 3 s non-yielding spin (`startSpin`); 500 ms later, render calls `callFunc` into it | 4, 5, 6 |
| `fastforward` | `refresh` | Task bumps its own `m.initNode.value` by 1000, outside any callFunc; 300 ms later, render calls `callFunc` to read it | 9 |
| `replay` | `latefield` | `callFunc` touches `m.top.lateValue`, a **declared field** the Task set (to 100) *after* `init()` returned — same timing as `basic-post`'s node, but via the field-sync path instead of a raw `m` member | 10 |
| `options` | *(arms)* | Arms the self-deadlock phase — prints/shows a warning, does nothing else | — |
| `OK` | `selfdeadlock` | **Only after `options`.** Sets the Task's own `trigger` field; the Task writes its own `pulse` field in response; render's `onPulse` observer (firing *inside* that field-set's processing) calls `callFunc` straight back into the same Task | 4, 5, 7 |
| `back` | — | exits the app | |

`basic-post` is expected to break into the Micro Debugger on a device in developer mode
(`'Dot' Operator attempted with invalid BrightScript Component...`) — that break *is* the finding
for question 2, not a probe bug. While suspended, `thread <n>` + `print m` on both the Task's own
thread and the crashed one is worth capturing (see Results row 2b) before `cont`-ing past it or
letting it crash and reloading the channel to continue with the remaining phases.

### ⚠️ Before running `selfdeadlock`

This phase deliberately reproduces a shape brs-engine's own implementation deadlocks on. If the
device behaves the same way, **the app may become permanently unresponsive** (heartbeat frozen,
remote presses ignored) — the render thread would be genuinely blocked, not just busy, so there is
no in-app escape. Run every other phase first. If it hangs:

- Wait at least the length of whatever timeout you'd expect a rendezvous to have (there is no
  documented one — this is itself part of what question 5 is trying to pin down).
- If it never recovers, remove/relaunch the channel from the Developer Application Installer
  (`http://$ROKU/plugin_install`) or power-cycle the device.
- Record whatever happened (froze forever / recovered after N seconds / device or channel crashed
  with an error) in the Results table below — that outcome **is** the finding.

## Reading the output

Connect to the debug console to see the `print` lines:

```bash
telnet $ROKU 8085
```

Every phase brackets itself with `### PHASE <name> BEGIN` / `END`, and each `TASK ...` line comes
from the Task thread while each `RENDER`/`PHASE` line (outside `TASK`) comes from the render
thread — interleaving (or its absence) is itself informative for question 1: if `basic-post` never
prints a `TASK touchPostLaunchNode` line at all, the call did not reach the Task thread.
`basic-init`, `basic-post`, and `latefield` each print an `ENTER m-keys=...` line
(`m.keys().join(",")`) **before** touching the node/field under test, so even a crash still tells
you exactly which keys `m` held in that dispatch context — that list is the direct answer to
question 2, no debugger session required. `refresh` prints the Task's own before/after values for
its direct mutation (`TASK bumpInitNode before=... after=...`) so you can compare against what the
subsequent `callFunc`'d read reports.

## Engine baseline

The same probe runs against brs-engine via the CLI:

```bash
npm run build:cli   # from the repo root, if not already built
brs-cli -z --log probe-cli.log callfunc-task-thread-probe.zip
```

Terminal keys map directly to remote keys for `up`/`down`/`left`/`right`/`OK` (Enter)/`back`
(Escape)/`rewind` (Page Up)/`fastforward` (Page Down)/`replay` (Backspace) — see
`src/cli/keyboard.ts`. The CLI's terminal keyboard has no mapping for `options`; use the ECP server
instead to reach the `arm`/`selfdeadlock` pair. Note the engine's own ECP key name for that button
is `info`, not `options` (it still delivers `key = "options"` to `onKeyEvent`, matching the real
device's documented vocabulary — only the ECP endpoint name differs):

```bash
brs-cli --ecp -z --log probe-cli.log callfunc-task-thread-probe.zip &
curl -d '' http://localhost:8060/keypress/info      # arm (engine ECP name for the Options button)
curl -d '' http://localhost:8060/keypress/select     # fire selfdeadlock
```

Already verified against brs-engine as of this writing, **after** the fix was revised to implement
the `callFuncM` snapshot (`Task.captureCallFuncSnapshot`/`buildCallFuncSnapshot` in `nodes/Task.ts`
— see `.claude/docs/threading-and-rendezvous.md`): `basic-init` now reports the same 4-key
`m` (`global, initnode, port, top`) the device does, and `basic-post` now **crashes identically to
the device** — `'Dot' Operator attempted with invalid BrightScript Component...` on
`m.postLaunchNode.value = ...`, `m-keys` at entry showing only the same 4 keys, `postLaunchNode`
absent. That crash is the *correct*, device-matching result, not a regression — see the Finding
above. `refresh` returns `1001` (the task's own `+1000` bump, then the call's own `+1`), matching
the device exactly and for the same reason: a captured Node reference stays genuinely live.
`latefield` still succeeds regardless of timing (`107`), matching the device — the field-sync path
this goes through was never part of this fix and was never expected to change. `nested` and `types`
are unaffected by any of this (unchanged from before). `busy` still shows the engine servicing
`callFunc` **mid-spin** (`spinRunning=true`), which real hardware may or may not match — see
question 6; its diagnostic fields moved into a small Node (`m.spinState`) created in `init()`
specifically so this callFunc'd read stays meaningful post-fix — a *raw* `m` member holding a
primitive is captured into the snapshot **by value**, so it would otherwise always read back
whatever it held at `init()`-time, never a live, currently-updating count. `selfdeadlock` still
reproduces the engine's own known deadlock and cleanly times out after `sgRoot.rendezvousTimeout`
(~10 s), throwing `ExecutionTimeout` on the render thread rather than hanging forever — that
remains the one phase where engine and device are *expected* to potentially disagree.

## Results

Fill in as you go. "Device" = real Roku hardware; "Engine" = brs-engine via the CLI baseline above.

| # | Question | Device | Engine |
| --- | --- | --- | --- |
| 1 | `basic-post`: does `TASK touchPostLaunchNode` print at all (call reached the Task thread)? | Yes | Yes (prints `ENTER`, then crashes on the next line — see row 2) |
| 1b | Backtrace on a crash chains through the render thread's own call site (`onkeyevent`→`runbasicpost`→`touchpostlaunchnode`), confirming a real rendezvous, not a fire-and-forget dispatch? | Yes | Yes — `#1 touchPostLaunchNode ... #0 runTask` (engine backtraces don't currently include the render-side frames, but the crash itself is on the Task's own thread, at the right line) |
| 2 | `basic-post`: returned value reflects the Task's own live `m.postLaunchNode` (not stale/missing)? | **Crashes** — `'Dot' Operator attempted with invalid BrightScript Component...` on `m.postLaunchNode.value = ...` | **Crashes identically** (post-fix) — same error, same line shape, on `m.postLaunchNode.value = ...` |
| 2a | `basic-post` `ENTER m-keys=` — what keys does `m` actually hold in the callFunc dispatch context? | `global, initnode, port, top` (4 keys — confirmed twice: debugger `count:4`/`print m`, and the `ENTER` print) | `global, initnode, port, top` (4 keys — matches the device exactly, post-fix) |
| 2b | `basic-init`: does `TASK touchInitNode` succeed, and does its `ENTER m-keys=` match `basic-post`'s? Confirms (or refutes) "only init()-time `m` state survives" as the exact rule. | **Confirmed.** Succeeds, result=42; `ENTER m-keys=global,initnode,port,top` — identical to `basic-post`'s. `initNode` (created in `init()`) is a live, working node reference; `postLaunchNode` (created in `runTask()`, after `init()` returns) never appears at all, not even as a key. **Rule: real Roku snapshots the Task's `m` once, right after `init()` completes, and every `callFunc` dispatch runs against that frozen snapshot — never the task's live, currently-mutating `m`.** | Succeeds, result=42; `m-keys=global,initnode,port,top` — matches the device exactly (post-fix; the engine now implements this same rule via `Task.callFuncM`) |
| 2c | `basic-init`: **timing verdict** — is `elapsed-ms` consistent with a genuine cross-thread round trip, or near-instant (never left render's thread)? This is the discriminator that actually distinguishes the fix from the original bug — see "Why `basic-init`'s readback isn't what it looks like" above. | Not yet run against real hardware — worth capturing `elapsed-ms` here to compare against the engine's ~520 ms. | Verified directly against both builds: **known-buggy engine (via `git stash` of the fix) → `elapsed-ms=0`, "SUSPICIOUS"**; **fixed engine → `elapsed-ms≈520-527`, "genuine cross-thread round trip occurred"** — repeatable across multiple runs each. |
| 3 | `nested`: does `TASK readGlobalDuringCall ... END` print (no deadlock reading m.global mid-call)? | | Yes |
| 4 | `nested`: `nested-read-ms` and outer `elapsed-ms` values | | nested-read-ms=105, elapsed-ms=106 |
| 5 | `basic`/`nested`: heartbeat counter visibly stalls during the call? | | Not checked (no display in CLI run) |
| 6 | `types`: any kind whose round-tripped `type()`/value differs from what was sent? | | None — all 6 matched |
| 7 | `busy`: does `duringSpin` print `spinRunning= true` (serviced mid-spin) or `false` (serviced only after)? | | `true` — serviced mid-spin |
| 8 | `busy`: `spinCounter` value and outer `elapsed-ms` — does it match "waited for the spin to reach a safepoint"? | | spinCounter=15, elapsed-ms≈420 (post-fix, using `m.spinState`'s Node fields — see the engine-baseline note on why a raw `m` primitive can't show live progress here) — serviced mid-spin, not at a `wait()` boundary |
| 9 | `selfdeadlock`: does the app hang? For how long, if it ever recovers? | | Does not hang — throws `ExecutionTimeout` after ~10s (`sgRoot.rendezvousTimeout`) |
| 10 | `selfdeadlock`: if it does NOT hang, what does `respondToPulse` return, and what's `elapsed-ms`? | | N/A — times out instead of returning |
| 11 | Any error/crash output on the device console during any phase | `basic-post` breaks into the Micro Debugger as expected (see row 2); nothing else tested yet | `basic-post` throws the matching error (post-fix); otherwise only the expected timeout error during `selfdeadlock` |
| 12 | `refresh`: does the callFunc'd `touchInitNode` read reflect the task's own `+1000` bump (live/shared reference), or does it see the pre-bump value (disconnected reconstruction)? | **Confirmed live/shared.** `TASK bumpInitNode before=0 after=1000`, then `touchInitNode addend=1 value now=1001` — the callFunc dispatch sees the task's own direct mutation. The callFunc-visible node reference is the task's genuine live object, not a one-time copy. | Reflects it — result=1001, same reasoning, now for the correct reason: the engine's `callFuncM` snapshot also keeps a live reference for a captured key (post-fix; matches device). |
| 13 | `latefield`: does `callFunc` see `m.top.lateValue` (a declared field set after `init()`) despite the `init()`-boundary rule found in row 2b, confirming that rule is specific to raw `m` members? | **Confirmed.** `touchLateField` succeeds, `lateValue=100` then `value now=107` — the `init()`-boundary rule is specific to raw script-scope `m` members; a declared field crosses regardless of timing. | Succeeds — result=107 (post-fix: the engine's field-sync path was never touched by this fix, so this was never expected to change). |
