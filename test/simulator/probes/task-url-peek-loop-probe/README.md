# Task URL PeekMessage Loop Probe

Reproduces a user report: during app initialization, while downloading configuration from the
internet, the simulator entered an infinite loop, repeatedly delivering what looked like the same
`roUrlEvent` on the message port — even though the download itself completed fine. No app source
was available, so this probe was built purely from tracing how the engine implements async
`roUrlTransfer` calls and message-port delivery.

## Why

`AsyncGetToString`/`AsyncGetToFile`/`AsyncHead`/`AsyncPostFromString`/`AsyncPostFromFile`/
`AsyncPostFromFileToFile` (`src/core/brsTypes/components/RoURLTransfer.ts`) don't perform the HTTP
request immediately. Each queues a one-shot job closure onto the target `roMessagePort`'s
`callbackQueue` (`pushCallback`); the closure performs the real, **synchronous** HTTP request the
first time something drains the port.

`RoMessagePort` (`src/core/brsTypes/components/RoMessagePort.ts`) has two consumers of
`callbackQueue`:

- `getNextMessage()` (used by `GetMessage()`/`WaitMessage()`) correctly does
  `this.callbackQueue.shift()` before invoking the closure — consumed exactly once.
- `peekMessage()` used to instead read `callbackQueue[0]` and invoke it **without removing it**
  from the queue.

That corrupts the extremely common Roku polling idiom:

```brightscript
while true
    msg = port.PeekMessage()
    if msg <> invalid then msg = port.GetMessage() : ProcessEvent(msg)
end while
```

1. `AsyncGetToString()` queues one closure.
2. `PeekMessage()`: `messageQueue` empty → invokes the closure (real HTTP request) → pushes the
   event to `messageQueue`. The closure is **not** removed from `callbackQueue`.
3. `GetMessage()`: drains the event correctly. `callbackQueue` still holds the stale closure.
4. Next loop iteration: `PeekMessage()` sees `callbackQueue.length > 0` again and invokes the
   **same stale closure** — a second real HTTP request fires, producing a second `roUrlEvent`.
   This repeats indefinitely.

Because the downloaded content is typically stable (e.g. a config file), every one of those
duplicate events looks like "the same event" being redelivered forever — matching the report. Each
"redelivery" is a genuine new network round trip, not a replayed object.

**Fix**: `peekMessage()` now does `this.callbackQueue.shift()` before invoking, mirroring
`getNextMessage()`, so a queued job is consumed exactly once regardless of which method discovers
it first.

## What this probe does

A background `Task` (`ConfigDownloadTask`) — the shape a real app uses to keep an init-time
network call off the render thread — downloads a small, stable file over HTTPS using
`AsyncGetToString()`, then drains its own port with the `PeekMessage()` + `GetMessage()` idiom
above instead of `wait(timeout, port)`. It counts how many `roUrlEvent` objects arrive for that
single async call and reports a verdict. Iteration/event caps keep it safe to run even against a
still-broken engine — it reports the bug instead of hanging forever or hammering the network.

`MainScene` creates the task, observes its `report` field, prints the report, and mirrors it onto
its own `report` field; `source/main.brs` observes that field (via the port overload of
`ObserveField`) to know when to close the screen and exit on its own.

## Run

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/task-url-peek-loop-probe -c 0
```

Requires outbound internet access (it downloads
`https://raw.githubusercontent.com/lvcabral/brs-engine/refs/heads/master/packages/browser/package.json`,
the same fixture already used by `test/e2e/resources/components/roURLTransfer.brs`).

## Results

Verified by temporarily reverting the `peekMessage()` fix in `RoMessagePort.ts`, rebuilding
(`npm run build:node && npm run build:sg`), and re-running:

| Build | Events delivered for one `AsyncGetToString()` call | Verdict |
| --- | --- | --- |
| Before fix (`callbackQueue[0]`, no shift) | 5 (hit the probe's safety cap — real engine would keep going) | `BUG REPRODUCED` |
| After fix (`callbackQueue.shift()`) | 1 | `OK` |

## Regression coverage

`test/brsTypes/components/RoURLTransfer.test.js`, `describe("AsyncGetToString + PeekMessage")` —
a deterministic, non-Task, non-network unit test pinning the same fix with a stubbed
`getToStringEvent`.
