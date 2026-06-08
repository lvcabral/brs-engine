# SceneGraph Cross‑Thread Rendezvous

This document explains how brs‑engine implements the SceneGraph **cross‑thread rendezvous** — the
mechanism that lets a `Task` thread read and write nodes owned by the render thread — and how the
implementation evolved from a **main‑thread broker** relay to the current **direct render→task**
channel. It closes with an analysis of the change across performance, reliability, memory, and
fidelity to real Roku behavior.

> Audience: contributors working on `src/extensions/scenegraph/` and `src/api/task.ts`. For the
> consumer‑facing view of the SceneGraph extension see [`extensions.md`](./extensions.md).

## Background: threads, ownership, and rendezvous

SceneGraph apps run BrightScript on multiple threads, mirroring a real Roku device:

- **Render thread** — owns the `Scene`, `m.global`, and every `Task` node; renders the display.
  In the engine this is the worker running `brs.worker.js` with thread id `0`.
- **Task threads** — each running `Task` node executes its `functionName` on a dedicated worker
  (thread id `> 0`) for blocking work (network, file I/O, parsing).
- **Main thread** — the page/host. It runs **no interpreter**; it owns the canvas, audio/video,
  and input, and historically also acted as the message **broker** between workers.

Every node has a single **owning thread**. Reading or writing a node you don't own must
**rendezvous**: a *synchronous, blocking* request to the owner that returns a value as if the call
had executed locally. On a real device the render thread serves these requests directly; Roku's
spec notes that *each* field access on a render‑owned node is "a distinct rendezvous."

The engine implements rendezvous with Web Workers and a `SharedArrayBuffer` mailbox
(`src/core/SharedObject.ts`): a single‑slot buffer with an `[length, version]` header and a
JSON payload, coordinated with `Atomics.wait`/`waitAsync`/`notify`.

## The original solution: a main‑thread broker

In the original design, **neither worker held a reference to the other's buffer**. Each task had
two `SharedObject`s, both owned by the main‑thread broker (`src/api/task.ts`):

- `threadSyncToMain` — the render thread's inbound buffer (task → render).
- `threadSyncToTask` — the task thread's inbound buffer (render → task).

Every cross‑thread message was relayed by the broker:

```
TASK→RENDER request:  task ──postMessage──▶ main thread (broker) ──SAB──▶ render
RENDER→TASK response: render ──postMessage──▶ main thread (broker) ──SAB──▶ task
```

A single rendezvous round‑trip therefore required the **main‑thread event loop to be free twice**,
and each payload was encoded up to **three times**: structured‑clone over `postMessage`, then
`JSON.stringify` into the SAB, then `JSON.parse` on receipt. The `SharedArrayBuffer` was used only
to *wake* the receiver, not as the actual transport.

This worked and was broadly correct, but it diverged from the device (where the render thread
serves requests directly) and made the main thread a latency, jitter, and contention bottleneck on
the rendezvous data path.

### Hardening that preceded the structural change

Before removing the broker, several fidelity/reliability fixes landed and are retained in the
final design:

- **`requestId`‑correlated responses** — every get/call/set response carries the originating
  request's id, so responses can never be mismatched under interleaving.
- **Device‑accurate timeouts** — a rendezvous that is not served within the timeout raises an
  `ExecutionTimeout` runtime error (mirroring a device terminating an app on a blocked render
  thread) instead of silently returning `invalid`/`false`.
- **`roRenderThreadQueue`** — the OS 15 non‑blocking task→render messaging API.
- **Faithful node‑field serialization** — fields holding `invalid` retain their declared type when
  crossing threads.
- **`freshFields` gated behind `fastFieldReads`** — by default every render‑owned field read
  rendezvouses, matching the device rule, instead of returning a locally cached value.

## The final solution: a direct render→task channel

The key realization is that `SharedArrayBuffer` + `Atomics` connect **two worker threads directly**
— the main thread does not need to be involved in the data path. The final design gives the render
thread dedicated buffers it writes **straight into the task worker**, removing the broker hop in the
render→task direction.

Each running task now has **three** `SharedObject`s, all created on the render‑thread `Task`
instance when the task activates (`Task.ensureDirectBuffers`) and handed to the task worker via
`TaskData`:

| Buffer | Direction | Carries | Writer → Reader |
| --- | --- | --- | --- |
| `taskBuffer` (`threadSyncToMain`) | task → render | rendezvous **requests** (`get`/`set`/`call`), `roRenderThreadQueue` posts | task → *(broker)* → render |
| `directBuffer` | render → task | rendezvous **responses** (`set`/`resp`/`ack`/`nil`) | render → task (direct) |
| `fanoutBuffer` | render → task | **observed‑field fan‑out** + cross‑task propagation | render → task (direct) |

Resulting data paths:

```
TASK→RENDER request:   task ──postMessage──▶ main thread (broker) ──SAB──▶ render   (unchanged)
RENDER→TASK response:  render ──SAB(directBuffer)──▶ task                            (direct)
RENDER→TASK fan-out:   render ──SAB(fanoutBuffer)──▶ task                            (direct)
```

Two render‑thread constraints shaped the design:

1. **Responses are written synchronously.** When the render serves a request, it writes the
   response straight into `directBuffer` with `store()` and the blocked task wakes via `Atomics`.
2. **Fan‑out is queued, then flushed.** The render worker **busy‑waits to enforce its frame rate**
   (`RoSGScreen`) and does not yield its event loop mid‑frame, so it cannot rely on asynchronous
   writes. Render‑side field fan‑out is enqueued (`fanoutQueue`) and drained **synchronously** into
   the single‑slot `fanoutBuffer` during `processTasks` — one update per free slot, the rest stay
   queued for the next pass. This is non‑blocking and lossless without a lock‑free ring buffer.

**Cross‑task propagation** (one task setting a `global`/`scene`/`node` field that another task
observes) is performed by the render thread directly: when it applies a task's set, it fans the new
value out to the *other* observing tasks, excluding the originator. Per‑task (`task`‑type) fields
are **never** cross‑fanned — they are private to one task — matching the broker's original
`type !== "task"` rule.

The **task→render request direction still goes through the broker**: the task `postMessage`s the
request and the broker writes it into `threadSyncToMain` to wake the render thread. Making that
direction direct as well (plus a ring‑buffer protocol and single‑copy/msgpack encoding) is the
remaining future step.

### Reliability hardening in the final design

Moving work onto the render thread made it essential that task‑servicing can never destabilize the
render loop:

- **Per‑task fault isolation** — `processTasks` snapshots the task list and wraps each task's
  servicing in try/catch, so a fault handling one task cannot tear down the render thread (which
  would stall every rendezvous and silently drop in‑flight updates).
- **Fan‑out flush resilience** — a non‑serializable payload is dropped and logged rather than
  thrown into the render loop.
- **Ownership preservation** — render‑side fan‑out no longer re‑owns the node it sends
  (`setOwner(0)` is only applied when a node genuinely crosses task → render), so fanning a value
  out can't corrupt the live render‑owned node tree.
- **Teardown safety** — `SharedObject.dispose()` cancels pending `Atomics` waits when a task is
  torn down, so a late timeout from a terminated app can't surface a stale "dropped update" error
  against the next app to run.
- **Diagnostics** — dropped‑update messages identify the exact update (`{id action type.key}`) and
  buffer (`toMain`/`toTask`), and a broker warning fires if a render→task fan‑out ever leaks back
  onto the broker path.

## Analysis: final vs. broker

The comparison below is the **direct render→task** design against the original **broker‑relay**
design (both share the `requestId`, timeout, `roRenderThreadQueue`, and serialization work listed
above).

### Performance

| | Broker relay | Direct render→task |
| --- | --- | --- |
| Render→task hops | render → **main thread** → task (2 event‑loop hops) | render → task (0 intermediate hops) |
| Encodings per message | up to 3: structured‑clone + `JSON.stringify` + `JSON.parse` | 2: `JSON.stringify` + `JSON.parse` |
| Main‑thread load | every response/fan‑out occupies the page event loop | page uninvolved; freed for UI/input/audio/video |

- Lower and **more consistent latency and jitter** on responses and fan‑out, since delivery no
  longer waits for the main thread to be free twice.
- One fewer serialization per render→task message (no structured clone) and no main‑thread
  contention — most noticeable for chatty tasks and large content‑node transfers.
- Per‑message encoding is still JSON; single‑copy / msgpack encoding remains future work, so the
  raw encoding cost per message is unchanged.

### Reliability

- The broker's single‑slot relay is no longer in the render→task path, so it cannot drop those
  updates under back‑pressure.
- Failures while servicing a task are **contained and observable** (fault isolation, flush
  resilience, precise diagnostics) instead of fatal to the render thread.
- The ownership‑preservation and `task`‑type cross‑fan‑exclusion fixes remove a class of
  node‑tree‑corruption bugs that the render‑side propagation could otherwise introduce.
- Net: fewer silent‑loss paths and no new fatal paths versus the broker design.

### Memory usage

- **Slightly higher baseline:** ~3 growable `SharedArrayBuffer`s per active task
  (`taskBuffer` + `directBuffer` + `fanoutBuffer`) vs. ~2 in the broker design
  (`threadSyncToMain` + `threadSyncToTask`) — one extra buffer per task (each starts at 32 KB with
  the same growth cap).
- **Lower transient/peak:** the main thread no longer holds a relayed copy of every payload, so
  large node trees are not double‑buffered through the page.
- A small render‑side JS fan‑out queue is added, bounded by how quickly a task drains its buffer.
- Overall a modest fixed per‑task cost traded for less peak duplication during big transfers.

### Adherence to Roku specs

- On a real device the render thread **serves rendezvous directly**; there is no page/broker
  relaying between render and task threads. The direct render→task channel is **architecturally
  closer to the device model**.
- Reduced, more uniform latency also makes cross‑thread timing behave more like hardware.
- The design retains device‑accurate timeout semantics (`ExecutionTimeout` rather than a silent
  `invalid`).
- **Partial:** only the render→task direction is direct today; task→render requests still traverse
  the broker, so this is a step toward the device model rather than the complete picture.

## Remaining gaps / future work

- Make the **task→render request** direction direct as well (currently broker‑relayed).
- Replace the single‑slot mailbox with a **ring‑buffer / `requestId`‑correlated** protocol to allow
  multiple in‑flight messages without head‑of‑line blocking.
- Carry payloads **once** in the SAB and switch node‑tree encoding to **msgpack** (already a
  dependency) to remove the remaining JSON encode/decode cost.
- Task threading/rendezvous remains **browser‑only**; the Node CLI host does not yet spawn task
  workers.

## Key source references

- `src/extensions/scenegraph/nodes/Task.ts` — rendezvous transport, request/response/ack, direct
  buffers (`ensureDirectBuffers`, `directBuffer`, `fanoutBuffer`, `flushFanout`).
- `src/extensions/scenegraph/nodes/Node.ts` — `shouldRendezvous`, `rendezvousSet`/`rendezvousCall`,
  ownership (`setOwner`), `fanOutFieldToObservingTasks`.
- `src/extensions/scenegraph/SGRoot.ts` — `processTasks` (drain + flush + fault isolation), thread
  map, render‑loop integration.
- `src/api/task.ts` — main‑thread broker: task spawn, `threadSyncToMain` relay for task→render
  requests, teardown/disposal.
- `src/core/SharedObject.ts` — the growable `SharedArrayBuffer` mailbox.
