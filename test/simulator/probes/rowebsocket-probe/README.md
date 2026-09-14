# roWebSocket Probe

A sideloadable Roku app (and brs-engine app) that exercises every `ifWebSocket` method against a
public WebSocket echo server (`wss://ws.postman-echo.com/raw`), so the same session can be run on
a real Roku device, the brs-engine CLI, and the brs-engine browser simulator, and the three logs
compared line-by-line.

The public echo server means all three environments talk to the *same* backend over the internet,
rather than needing a LAN-reachable local server — a real Roku and a dev machine running brs-engine
can both reach it without any extra setup.

The `roWebSocket` connection itself is owned by `ProbeTask` (a SceneGraph `Task`), not `ProbeScene`
directly — see the comment at the top of `components/ProbeTask.brs` for why, and for a real device
behavior this probe found (and initially misdiagnosed as an engine bug) — see "What this probe
found" below.

## Build and run

### Real Roku (sideload)

```bash
./pack.sh                                   # produces rowebsocket-probe.zip
```

Sideload `rowebsocket-probe.zip` at `http://$ROKU/` with the device in developer mode. The channel
poster/splash screen are real assets (see `images/`), not placeholders, so it should look like a
normal channel in the developer home screen and while launching.

### brs-engine CLI

```bash
cd ../../../..                                                  # repo root
node packages/node/bin/brs.cli.js --root test/simulator/probes/rowebsocket-probe --ecp
```

The keyboard drives the remote in a TTY (see `docs/run-as-cli.md`); `print` output (the `### PROBE`
lines) is the same console text a real Roku's telnet debug console (port 8085) shows. `--ecp` also
lets you drive it over HTTP instead, e.g. `curl -X POST http://localhost:8060/keypress/Select` for
the `OK` button (see the key table below for the rest).

### brs-engine browser simulator

```bash
npm run build:web        # from the repo root — builds engine+scenegraph, opens the example web app
```

Then load the probe's folder as a zip (drag-and-drop or the app's file picker) — see
`docs/run-as-cli.md` / the example web app's own instructions for loading a local app in the
browser build. The on-screen labels and the browser dev console's `### PROBE` prints are the same
information the CLI and a real Roku show.

## Remote key -> action

Key names below are the `onKeyEvent()` strings (see the reference doc "Handling Key Presses") —
the physical remote buttons they correspond to, not the different internal names the ECP HTTP API
uses (e.g. `POST /keypress/Select` is the OK button; the engine translates it before dispatch).

| Key           | Physical button | ECP `/keypress/<name>` | Action                                        |
| ------------- | --------------- | ----------------------- | ---------------------------------------------- |
| `OK`          | OK / center     | `Select`                 | `Open(0)` — connect (async)                    |
| `up`          | Up              | `Up`                     | `Send()` a text message                        |
| `down`        | Down            | `Down`                   | `Send()` a binary `roByteArray` message        |
| `left`        | Left            | `Left`                   | `SendPing()`                                   |
| `right`       | Right           | `Right`                  | `PingTest(3000, "pingtest")`                   |
| `rewind`      | Rewind          | `Rev`                    | `Close(1000, "probe requested close")`         |
| `fastforward` | Fast Forward    | `Fwd`                    | `Open(0)` again — reconnect on the same object |
| `replay`      | Instant Replay  | `InstantReplay`          | `SetTimer("tick", 2000, false)` — arms a repeating timer |
| `options`     | Options (`*`)   | `Info`                   | Clears the on-screen log                       |

`Opened`/`Closed`/`Error`/`MsgSent`/`TextReceived`/`DataReceived`/`PingReceived`/`PongReceived`/
`Timer` events are all handled passively inside `ProbeTask` and printed regardless of which key
triggered them (the server echoes text/binary messages back automatically, so pressing `up`/`down`
alone produces both a `MsgSent` and, shortly after, a `TextReceived`/`DataReceived`).

## What to diff between platforms

This exists because the Node/CLI and browser builds have deliberately different fidelity (see
`docs/limitations.md`) and only a real device tells us whether the Node/CLI side actually matches
real Roku behavior, not just the spec prose:

1. **`GetOpenInfo()`/`Opened` event fields** — is `TargetIPAddr` ever non-empty on a real device? Our
   engine leaves it blank on both platforms (see the comment in `RoWebSocket.ts`); if a real Roku
   fills it in, that's a gap worth closing.
2. **Ping/Pong fidelity** — `left`/`right` should work fully on Node/CLI (real control frames via
   the `ws` package) and be no-ops on the browser build (browsers give script no Ping/Pong access at
   all). Confirm a real Roku's `PongReceived`/`PingTest()` behavior matches the Node/CLI side, not
   the browser side.
3. **Reconnect (`fastforward`)** — opening the same `roWebSocket` object a second time after
   `rewind` (`Close`) should produce a fresh `Opened` event with no cross-talk from the old
   connection.
4. **`SendPing`/`SendPong`/`Send` return value shape** — Roku's own docs mark this "not specified in
   the source" (see `rowebsocket.md` in the OS 16.0 release notes); this probe's `FormatJson(result)`
   log line is the actual observed shape to compare against.
5. **Timer accuracy** — `replay` arms a 2000ms repeating timer; compare the real interval between
   `Timer` occurrences shown in the log across platforms.

## What this probe found: a function-name field observer runs on the *writer's* thread

Confirmed on real Roku hardware (OS 16.0.4), not a `roWebSocket`-specific issue. An earlier version
of this probe had `ProbeTask` observe its own `probeCommand` field with a function name
(`m.top.ObserveFieldScoped("probeCommand", "onCommand")`), reasoning that since the Task registers
the observer from its own script, the callback should run on the Task's own thread. On device, it
doesn't: pressing OK crashed with `Invalid value for left-side of expression` inside `onCommand`,
and the Micro Debugger's backtrace showed why — `onKeyEvent` (Scene) → `onCommand` → `doCommand` as
one unbroken call stack, with a *second*, separate thread sitting idle at the Task's own `wait()`
loop. The observer callback had executed synchronously on the render thread — the thread that wrote
`probeCommand` — with render's `m` (only `top`/`global`), not the Task's own.

This was initially misdiagnosed as a SceneGraph engine bug in brs-engine and "fixed" there; that fix
was reverted once real-hardware testing showed brs-engine's original behavior already matched the
device. The actual rule, confirmed by Roku's own docs and this codebase's existing `task-pool-app`/
`task-globalobserve-app` test fixtures: **a function-name field observer always runs on the thread
that wrote the field, never the thread that registered it — even for a Task observing its own
field.** Only a `roMessagePort` observer is delivered as a message the *observing* thread picks up
on its own `wait()` loop.

**Fix used here** (see `components/ProbeTask.brs`): `probeCommand` is observed with the same
`roMessagePort` already used for the `roWebSocket`, not a function name. `runTask`'s `wait()` loop
tells the two apart with `type(msg)` (`"roWebSocketEvent"` vs. `"roSGNodeEvent"`) and dispatches
`doCommand` directly — no separate callback sub, no cross-thread `m` surprises.
