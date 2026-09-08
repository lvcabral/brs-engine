# Threading: node host, rendezvous, debugger halt

Deep detail on the multi-threaded model. Read this **before** changing `src/node/{host,task}.ts`,
`src/extensions/scenegraph/nodes/Task.ts`, worker message plumbing, termination, or anything touching the
shared control array. Companion: [scenegraph-invariants.md](scenegraph-invariants.md) and
`docs/scenegraph-rendezvous.md` (design + performance/reliability/memory/fidelity analysis).

## Node host mirrors the browser two-thread split

The CLI main thread is the **host** (`src/node/host.ts` `executeApp` + `src/node/task.ts` task broker — a
port of `src/api/task.ts`, keep them in sync), the app runs in a worker whose entry is `bin/brs.node.js`
itself (`parentPort` dispatcher in `src/core/index.ts`'s `#else` branch), and each SceneGraph Task gets its
own worker. node-canvas `ImageData` doesn't survive the structured clone (width/height are prototype
getters), so frames cross as `FrameData` (flatten in the worker shim, revive in the host). Type guards on
worker messages must be realm-safe (`isTypeOf`, not `instanceof` — a VM-sandboxed test runner pool breaks
`instanceof SharedArrayBuffer`, which is why `vitest.config.mts` pins `pool: "forks"` instead of
`vmThreads`). The main thread also owns stdin: raw-mode keyboard remote control + Micro Debugger
line-mode relay (`src/cli/keyboard.ts`); the worker-side debugger reads commands from the shared array
(`BrsDevice.isWorkerThread`). REPL and `--pack` stay in-process (`executeFile`): packaging returns its
result as a function value, and the REPL needs a same-isolate interpreter. Regression: `task-app` in
`test/cli/cli-scenegraph.test.js` and `test/node/host.test.js`.

Node-host invariants (all mirror the browser API):

- **Workers never write to the terminal.** `host.ts`/`task.ts` spawn every worker with
  `{ stdout: true, stderr: true }` and surface the piped streams as host `stdout`/`stderr` events — a
  `console.log` inside a worker (engine internals, third-party libs) inheriting the process fds would
  land inside the frame region in `-i`/`-a` modes and flicker graphics terminals (text over image cells
  erases them on iTerm2/Kitty).
- **Termination is host-driven** (`terminateApp(reason = UserNav, timeoutMs = 3000)`): write
  `DebugCommand.EXIT` for a graceful exit, then force-`terminate()` the app worker + all Task workers on
  timeout, and report the host's `reason` on `end` (the worker unwinding via the debugger EXIT path
  reports `EXIT_BRIGHTSCRIPT_STOP`, not `EXIT_USER_NAV`). The CLI home/poweroff key goes through this path
  — do **not** "simplify" it back to a bare `DBG=EXIT` write: a worker idling in `wait()` can miss it (see
  next point) and there is no backstop.
- **EXIT must unwind `wait()` loops.** `RoMessagePort.wait` consumes the EXIT command, sets
  `debugMode = EXIT` and *returns* (it can't throw through the callable boundary);
  `Interpreter.checkDebugger` therefore **throws `BlockEnd("debug-exit")` when already in EXIT mode**
  instead of returning — otherwise an app in `while true : wait(0, port)` live-locks with `wait` returning
  instantly (the pre-fix home-key hang).
- **`getMessage()`/`peekMessage()` must thread the live `Interpreter` through `updateMessageQueue`,
  exactly like `wait()` does.** They dispatch through the same generic `callbackMap` as `wait()`
  (`RoMessagePort.ts`), and `RoSGScreen`'s callback (`getNewEvents`) early-returns with no work done when
  its `interpreter` argument is falsy — it needs a live interpreter to service timers/animations/
  tasks/rendering. A refactor once made `getMessage`/`peekMessage` call `updateMessageQueue()` with no
  arguments, which silently stopped SceneGraph from ever being serviced through those two calls (a real
  app driving its main loop with `sleep()+getMessage()` instead of `wait()` never rendered a frame, with
  no error) — nothing caught it because the only prior test only asserted `getMessage()` "doesn't crash."
  A distinct non-blocking sentinel (`PORT_NO_WAIT`, not `0` — `0` already means "block indefinitely" by
  this codebase's convention, see `wait()` above) marks the call as a poll rather than a wait; `Task.ts`'s
  `getNewEvents` must treat that sentinel as "poll once, don't block" rather than converting it to an
  infinite `Atomics.wait`. Regression: "Services SceneGraph timers/rendering through a sleep()+
  getMessage() poll loop" in `test/cli/cli-scenegraph.test.js`.

## Rendezvous architecture (multi-threaded Tasks)

SceneGraph `Task` nodes run their `functionName` on a **dedicated worker thread**, mirroring Roku's
render-thread / task-thread model. The thread owning and rendering the scene graph is
**thread 0 ("Render")**; each Task gets a thread id `> 0`. `sgRoot.threadId` (and `BrsDevice.threadId`)
identify the current thread; `sgRoot.inTaskThread()` is `threadId > 0`. Every node records an `owner`
thread id (Scene and Global are always thread 0).

A node's authoritative copy lives on its owner thread, so reading/writing a node you don't own must
**rendezvous**: a synchronous blocking request to the owner. Implemented in `nodes/Task.ts` +
`nodes/Node.ts`:

- **Transport** — each Task owns a `SharedObject` wrapping a `SharedArrayBuffer`. `ThreadUpdate` messages
  (`action`: `get`/`set`/`call`/`resp`/`ack`/`nil`, plus `type`, `address`, `key`, `value`) are written in;
  the receiver wakes via `Atomics`-based `taskBuffer.waitVersion(...)`. Lifecycle/state transitions flow
  over normal `postMessage` (`TaskData`, `TaskState`).
- **Field writes** — `Node.setValue` → `rendezvousSet`; if `shouldRendezvous()`
  (`inTaskThread() && owner !== threadId`) it forwards via `task.syncRemoteField`. Otherwise, on the
  render thread, it pushes the change to any Task observing that field's port.
- **Field reads / method calls** — `RoSGNode`/`ContentNode` methods call
  `rendezvousCall(interpreter, "<method>", [args])`. When `shouldRendezvous()`, it serializes args (node
  args re-owned by thread 0) and calls `task.requestMethodCall(...)`, which blocks (default 10s timeout,
  logs "Rendezvous timeout") until `resp`/`nil`. `requestFieldValue` does the same for plain reads.
- **Crossing into a node sends ownership *only when the task is reporting through its own
  field*.** `Task.syncRemoteField` re-owns a `Node` value to render (`setOwner(0)`) when the task
  is setting **its own** interface field (`m.top.xxx = someNode`, `address === this.address` —
  a hand-off: the task isn't going to keep using the node itself, so render becoming its
  permanent owner is correct, and the receiver needs to run `callFunc` against its own copy).
  It must **not** re-own when the task is merely setting a field on some *other* render-owned
  node (`address !== this.address` — e.g. `m.global.someHandle = someNode`, the common
  "publish a singleton for other threads/components to discover" pattern): the task keeps using
  its own local reference to that node forever after, so its ownership must not change.
  Device-confirmed this distinction matters (real Roku does not re-own in the second case) —
  getting it wrong was the actual New Relic SDK crash's root cause (see
  `test/simulator/probes/node-owned-by-task-callfunc-probe/`, whose README documents the full
  investigation): re-owning unconditionally made every later same-thread access on the owning
  task incorrectly evaluate `shouldRendezvous()` as `true` and rendezvous *out* to render, which
  only had a reconstructed copy missing whatever the task's own script populated. Regression:
  `DirectRendezvous.test.js`'s "own field" vs "FOREIGN node" pair, and
  `task-owned-node-callfunc-app` in `test/cli/`.
- **A `callFunc` argument is never re-owned, on either the render→Task or task→render routing
  branch** — `Node.buildMethodCallPayload`'s `reownToRender` boolean, threaded through from both
  `rendezvousCallFunc` call sites (`rendezvousCall(..., false)` for the fallback branch,
  `buildMethodCallPayload(..., false)` for the Task-target branch). Same rule and same root cause
  as the field case above, just reached via a call argument: re-owning a `Node` argument to
  whichever thread it's passed into breaks the caller's own later same-thread use of it.
  `rendezvousCall`'s ~69 other, non-`callFunc` call sites keep the default (`true`) — those really
  are a task→render hand-off. **Gotcha hit while fixing this**: giving the parameter a numeric
  default (`= 0`) let an explicit `undefined` argument silently fall back to that default (JS
  substitutes on `undefined`, not just omission) — hence the boolean instead of a nullable thread
  id. Regression: `RenderTaskCallFunc.test.js`'s "keeps its own ownership" pair.
- **`callFunc` on a Task rendezvouses even from the thread that owns the node** (device-confirmed — a
  Task's callable interface functions always run on its own worker thread, independent of `owner`, which
  models who built the node's *fields*, typically render). `shouldRendezvous()`'s `owner` check can never
  catch this: a Task's render-side instance is *constructed* on render, so `owner === 0` forever. `callFunc`
  therefore has its own routing pair — `Node.callFuncThread()` (only `Task` overrides it, returning its own
  `threadId` when `active`) and `Node.rendezvousCallFunc()` — used exclusively by `RoSGNode.callFunc`, not
  the other ~69 `rendezvousCall()` call sites (those stay owner-based; a Task's *fields* really are
  render-owned and already work via the field-sync path above). Three branches: not an active Task →
  falls back to `rendezvousCall` unchanged; `callFuncThread() === sgRoot.threadId` → run locally,
  returning `undefined` **without** falling through to `rendezvousCall` — `handleMethodCallRequest`
  re-dispatches `"callFunc"` through the Callable a second time once the request lands on the Task's own
  thread, so falling through there would self-rendezvous back out to render; otherwise →
  `Task.requestTaskMethodCall()`. That method's transport differs from `requestMethodCall`'s: the request
  travels via `fanoutQueue`/`fanoutBuffer` (the only channel a Task polls every tick, not just while
  blocked in its own outgoing wait — `directBuffer`/broker delivery are dead paths for a fresh
  render-initiated request in current direct/fan-out mode), and the reply arrives on a **dedicated
  `callBackBuffer`** (can't reuse `directBuffer` — a nested task→render rendezvous served while handling
  the call, e.g. a `m.global` read, could be in flight on it at the same time, in the opposite direction).
  The wait loop pumps `sgRoot.processTasks()` every iteration — otherwise that nested rendezvous, or any
  other task's unrelated in-flight request, would deadlock behind this blocking wait, since incoming
  requests are only ever served from `processTasks()` (see the *silence* note below). Regression:
  `test/extensions/scenegraph/RenderTaskCallFunc.test.js` and `task-render-callfunc-app` in `test/cli/`.
- **`callFunc` on an ordinary `Node` genuinely owned by a Task thread also rendezvouses, from *any*
  caller — not just a Task-initiated one.** This is the base-class counterpart to the Task-specific
  routing above: `shouldRendezvous()`/`rendezvousCall()` gate on the *caller* being a task thread
  (`sgRoot.inTaskThread()`), so they never fire for a render-initiated call, no matter what the
  target's `owner` is. That left a real gap: a plain `Node` a Task legitimately owns and keeps using
  itself (not a Task target, and not merely field-owned by render the way most nodes are) was
  unreachable from render's own `callFunc` — the exact shape a Task publishing an SDK singleton via
  `m.global` produces once the ownership bug above is fixed. `Node.callFuncThread()`'s base case
  (previously an unconditional `return undefined`, meaning "always fall back to `rendezvousCall`")
  now checks `this.owner`: if it points at a thread with an active, registered Task
  (`sgRoot.getThreadTask(this.owner)`), route through the same `rendezvousCallFunc`/
  `requestTaskMethodCall` machinery the Task-specific case already uses — no gate on
  `sgRoot.inTaskThread()`, since it doesn't matter whether the caller is render or another task,
  only that the *target* thread has a live Task to dispatch through. `Task`'s own override is
  unaffected (a Task's functions run on its own `threadId`, which can differ from `owner` — the
  thread that *built* it, typically render — so it keeps using `active`/`threadId`, not this
  `owner`-based check). Regression: `task-owned-node-callfunc-app` in `test/cli/`.
- **A render-initiated `callFunc` runs against a frozen snapshot of the Task's `m`, never its live,
  currently-mutating `m`** — device-confirmed by direct probing (`callfunc-task-thread-probe` in
  `test/simulator/probes/`, whose README documents the full experiment trail). Real Roku snapshots a
  Task's `m` once, right after `init()` completes and before the task's own function starts running; a
  raw script-scope member added *after* that point is invisible to any later `callFunc` dispatch — not
  stale, **absent entirely**, not even as a key. A member that *is* captured keeps pointing at the exact
  same live value forever after (a `Node` reference stays fully functional and reflects later mutations
  made either through the dispatch or by the task's own unrelated code — it is the same object, not a
  copy); a value with no meaning outside the one thread that made it (a live `roMessagePort` handle) comes
  back present-as-key but `invalid`-as-value. Declared fields (`m.top.xxx`) are untouched by any of this —
  they cross via the already-correct field-sync path above regardless of timing.
  `Task.captureCallFuncSnapshot()` builds this once (`buildCallFuncSnapshot` in `nodes/Task.ts`: keep
  `top`/`global`, `Node` values, and primitives as-is; flatten everything else — any other live
  BrsComponent — to `invalid`), called from `execTask` in `src/extensions/scenegraph/index.ts` at exactly
  that boundary, right before the task's function is invoked. Routing this into the actual call is not a
  matter of passing a different `m` down through `Interpreter.call`'s dispatch of the `callFunc`
  Callable — `Node.callFunction`'s sub-environment setup hardcodes `this.m`, ignoring whatever `m` the
  outer call carried, so a naive parameter swap at the outer layer is a silent no-op. Instead
  `callFunction` takes an explicit `mOverride` parameter (every other caller passes `undefined`, meaning
  "use `this.m`" — unchanged), and a new virtual hook, `Node.consumeCallFuncMOverride()` (no-op on `Node`;
  `Task` overrides it), is consulted right at the `callFunc` Callable's own call site in
  `RoSGNode.callFunc`. `Task.handleMethodCallRequest` sets a one-shot `useCallFuncSnapshot` flag on the
  target immediately before dispatching a `direct`-flagged request (clearing it in a `finally`, so a
  resolution that never reaches the hook — or throws — can't leak it onto a later, unrelated call);
  `consumeCallFuncMOverride()` reads and clears that same flag, returning `callFuncM` only for that one
  dispatch. Regression: `captureCallFuncSnapshot`/`consumeCallFuncMOverride` describe blocks in
  `test/extensions/scenegraph/RenderTaskCallFunc.test.js`, and `task-render-callfunc-app`'s
  positive/negative pair (`m.harvestEvents`, created in `init()`, must round-trip; `m.postInitNode`,
  created in `runTask()`, must be invisible — not merely stale) in `test/cli/`.
  `captureCallFuncSnapshot()` skips the `m`-copy when `funcNames` is empty (no callable interface
  functions declared) — `callFunction` can never dispatch to such a Task, so no `callFunc` will
  ever consume the snapshot; cheap to skip for the common fields-only worker/background Task shape.
  Unit tests exercising the snapshot directly must populate `funcNames` on their bare `Task`
  instances or this guard makes `captureCallFuncSnapshot()` a no-op.
- **Function values cross threads via AST rebuild** — `jsValueOf` serializes a user-defined `Callable` as
  name + source location; `restoreCallable` (`factory/Serializer.ts`) resolves it from the per-worker anon
  registry (location-verified — `$anon_N` ids collide across workers) or rebuilds it with `toCallable`
  from the component AST retained in `ComponentDefinition.scopeStatements` (set by
  `setupInterpreterWithSubEnvs` — keep it retained). Sound because BrightScript has no lexical closures:
  `m` binds to the receiver at call time. Unresolvable → stub returning `uninitialized` + one-shot
  warning. Matches device behavior (a Task's `m` copy keeps functions callable, e.g. analytics-SDK
  helpers). Regression: `test/extensions/scenegraph/CallableSerialization.test.js`.
- **Task startup** — when `control` becomes `"run"`, `checkTaskRun` posts `TaskData` (shared buffer,
  serialized `m`, render-thread id, `tmp:`/`cachefs:` volumes). The core spins up a worker → extension's
  `execTask` → `initializeTask` rebuilds the tree and invokes the task function. The `tick` hook drains
  incoming updates each iteration via `task.processThreadUpdate()`.

  > **Activation ≠ launch — the two delivery paths must not overlap.** `control = "run"` runs
  > `activateTask` **synchronously** (allocating the direct buffers early and on purpose, so no write
  > falls back to the broker), which turns render→task fan-out on; `checkTaskRun` posts the payload only
  > on the next `processTasks` pass. A write in between is captured by *both* — queued in `fanoutQueue`
  > **and** left as an event on the render-side copy of the port for `collectPortNodeEvents` to sweep into
  > `TaskData.portEvents` — and the task saw it twice (#1109). `dropFanoutCoveredByReplay` discards the
  > fan-out copies for the exact (node, field) pairs the replay will deliver. Match on the **pair, not the
  > value**: a field written twice with the same value under `alwaysNotify` notifies twice but syncs once.
  > Leave events the replay can't re-target (a node that is neither the task node nor global, which
  > `replayPortNodeEvents` drops with a warning) alone — the fan-out is their only carrier. Regression:
  > `task-prelaunch-events-app` in `test/cli/`, which asserts **both** sides of the boundary (before `run`
  > must still arrive; after `run` exactly once).

  > **A task thread's uncaught error terminates the whole app** (device-verified), exactly as it does on
  > the app thread — the task node is *not* moved to `state = "stop"` so the app can carry on, and there
  > is no "the thread died but the app lives" state to model. A task worker posts `end,<reason>` only when
  > it dies (an uncaught error, or unwinding on a termination command), so the Node broker escalates that
  > to the host's `taskNotify` → `terminateApp(reason)` instead of surfacing it as output; the browser API
  > already had this for free, since a task worker's strings reach the same `handleStringMessage` as the
  > app worker's. Only the **first** report acts — a termination already in flight (home key, poweroff)
  > keeps its own `terminateReason` rather than having it overwritten by every task unwinding behind it.
  > In developer mode the Micro Debugger still opens on the crashing task thread first; the app ends when
  > that session exits. Regression: `task-crash-app` in `test/cli/`.

  > Note `state` reaches `"stop"`, never `"done"`, when a task function returns normally: `threads.md`
  > says it "will transition to the STOP state automatically when that function returns" and that
  > re-running requires STOP. `"done"` is a legal value in the `state` field table but no Roku doc
  > describes a transition into it — that is why apps idiomatically test `state = "done" or state = "stop"`.
  > Don't "fix" the missing `"done"`.

- **Internal presentation children must not cross threads — `Node.serializesChildren()`.** A built-in
  composite node that builds its **visible children in its constructor** and keeps **private field
  references** to them (updated every frame) must **not** serialize those children. `fromSGNode` includes
  a node's `_children_` only when `node.serializesChildren()` is true (default); `updateSGNode` no-ops
  when `_children_` is absent. Why it matters: when a Task references such a node, its child list crosses
  over, and the Task's `updateSGNode` reconciliation **replaces** the render-thread children with fresh
  deserialized copies — but the node's private fields still point at the **originals**, so per-frame
  updates (`showUI` on `Video`) land on nodes no longer in the render tree and the UI silently stops
  drawing. Overridden to `false` on **`Video`** (trick-play bar, header labels, spinner, paused icon,
  overlay, clock timer) and **`TrickPlayBar`** (its own track/fill/ticker/label posters — needed
  separately because `Video` exposes the bar as a node-typed `trickPlayBar` **field**, serialized
  independently of the Video's own children). A Task never renders, so it never needs these. Apply the
  same override to any new built-in node with constructor-built, field-referenced children reachable from
  a Task (as a child *or* a node-typed field); plain data nodes like `ProgressBar` (no internal children)
  need nothing. Regression: `test/extensions/scenegraph/VideoCrossThreadChildren.test.js`.

## The rendezvous timeout measures render-thread *silence*, not elapsed time

Incoming requests are served only from `sgRoot.processTasks()`, i.e. when the render thread reaches its
message loop — never from inside app code. So a callback that runs longer than
`sgRoot.rendezvousTimeout` (10 s), such as a screen building hundreds of components, leaves a waiting Task
with no answer for reasons that are not a failure at all: on a device the same wait happens, just orders
of magnitude shorter (a Task write blocks for the whole render-thread observer cascade — device-measured).
Timing out on wall clock therefore crashed the app for being slow, and after the Node host learned to
escalate a dead task thread it killed the whole app.

The render thread publishes a monotonic counter into `DataType.RHB` from `BrsDevice.checkBreakCommand`
(the per-statement poll; **thread 0 only** — a waiter must not keep its own wait alive). Every blocking
loop in `nodes/Task.ts` gets its deadline from **`rendezvousDeadline(timeoutMs, label)`**, which
**restarts the countdown whenever that counter advances** and warns once when a wait outlives the base
timeout. The timeout then fires only when the render thread stops executing BrightScript entirely — the
deadlock it exists to report — while an idle render thread (parked in `wait()`, publishing nothing) still
trips it, so a genuinely dropped update is still caught. Regression:
`test/extensions/scenegraph/RendezvousHeartbeat.test.js`.

> `DataBufferIndex` is derived from `DataType.RID` (the first key slot), so status slots can be appended
> above the key buffer without shifting it.

## Debugger halts every thread (`DataType.DBT`)

Entering the Micro Debugger (`STOP`, dev-mode crash, or `BREAK`) must freeze **all** threads. The
handshake is one shared-array slot `DataType.DBT`: `notifyDebugStarted()` writes the debugging thread's
id, `notifyDebugEnded()` clears it, and other threads block on it via **`BrsDevice.pauseIfDebugging()`**
(the single definition, called by both `checkBreakCommand` and the Task rendezvous waits). But `DBT` is
only *polled*, and a Task parked mid-rendezvous is blocked in `Atomics.wait` on its own response buffer,
which can't watch `DBT`. So every blocking loop in `nodes/Task.ts` (`requestFieldValue`,
`requestMethodCall`, `waitForFieldAck`, `getNewEvents`) **caps each sleep to `RENDEZVOUS_POLL_MS`
(100 ms)** and re-checks `pauseIfDebugging()` each iteration — else a Task mid-rendezvous throws a
spurious "Rendezvous timeout" out from under the debugger. **Invariants:** check `pauseIfDebugging()`
*before* the timeout break and **reset the deadline** on pause (debug time mustn't count); the pause path
**must not re-send** the request; `EXIT` calls `notifyDebugEnded()` (not only `CONT`) so `DBT` is never
left set (deadlock). Normal latency is unaffected — a stored response wakes the waiter immediately via
`notify`. Gap: `debugThreads` still lists only the current thread.
