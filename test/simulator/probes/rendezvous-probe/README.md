# Rendezvous Probe

A sideloadable Roku app that generates a known, countable number of SceneGraph rendezvous of each
kind, on known source lines, in operator-triggered phases.

It exists to answer questions the Roku spec leaves open, so the engine's ECP `sgrendezvous`
implementation can be built against measured behavior rather than inference:

1. Are the port-8080 debug console `logrendezvous [on|off]` switch and the ECP `sgrendezvous/track`
   switch **independent**, or does one drive the other? (The spec documents them in separate places
   and never cross-references them.)
2. What is the **verbatim format** of the `logrendezvous` console output, and **which port** does it
   go to — 8085 (app console) or 8080? (The spec never shows it.)
3. In the `query/sgrendezvous` XML, do `file` / `line-number` point at the **task-thread call site**?
4. Is it exactly **one event per rendezvous**, and what does *not* count as one?
5. What are the units and base of `start-tm` / `end-tm`?
6. How does `drop-count` behave past the documented 1000-event cap?
7. Do the POST routes really live at `/sgrendezvous/...` with **no** `query/` prefix?

## Build and sideload

```bash
./pack.sh                                   # produces rendezvous-probe.zip
```

Sideload `rendezvous-probe.zip` at `http://$ROKU/` with the device in developer mode.

## Phases

Each phase is triggered by one remote key, so you can query ECP in between and attribute events
exactly. Every phase brackets itself with `### PHASE <name> BEGIN` / `END expected=N` prints.

| Key | Phase | Task does | Expected events |
| --- | --- | --- | --- |
| `up` | `get` | 5 unrolled `m.global.probeCounter` reads, distinct lines | 5 + 1 |
| `down` | `set` | 5 unrolled `m.global.probeSink` writes, distinct lines | 5 + 1 |
| `left` | `call` | 5 unrolled `callFunc("probeAdd")` on a render-owned node | 5 + 1 |
| `right` | `local` | 200 read/writes on a node the **task** created | 0 + 1 |
| `OK` | `slow` | 16 reads spaced 250 ms, spanning a ~2000 ms render busy-spin | 16 + 1 |
| `options` | `flood` | 1500 reads in a tight loop, single line | 1500 + 1 |
| `back` | — | exits the app | |

The `+ 1` in every row is the task's closing `m.top.phaseDone = <phase>` write. It is deliberate: it
doubles as a probe of whether a task writing to its own `m.top` counts as a rendezvous.

One rendezvous happens **before** any phase — the task's warm-up `m.probeNode = m.global.probeNode`.
Enable tracking after the app is up and it will not appear in your counts.

### Ground-truth line numbers

Do not hardcode them. Read them off the source:

```bash
grep -n "PROBE-LINE" components/ProbeTask.brs
```

Compare that against `<line-number>` and `<file>` in the XML. `<file>` should be
`pkg:/components/ProbeTask.brs` if attribution is to the task-thread call site.

## Run matrix

Three terminals:

```bash
export ROKU=<device-ip>
nc $ROKU 8085 | tee console-8085.log      # A: app console (print output)
nc $ROKU 8080 | tee console-8080.log      # B: SceneGraph debug server (type commands here)
                                          # C: curl
```

### 1. Baseline — neither switch on

Press `up`.

- Rendezvous lines on either console? (expect none)
- `curl -i "http://$ROKU:8060/query/sgrendezvous"` — what does it report when never tracked?

### 2. Console only — the first coupling test

In terminal B: `logrendezvous on`. Press `up`.

- **Which console** did the lines land on, A or B?
- Record the lines **verbatim**. Do they carry file/line? thread ids? action? field name? duration?
- Then `curl "http://$ROKU:8060/query/sgrendezvous"`.
  - Items returned ⇒ the two switches are **coupled** (one flag).
  - Empty / `tracking-enabled false` ⇒ they are **independent** (two flags).

### 3. ECP only — the second coupling test

In terminal B: `logrendezvous off`. Then:

```bash
curl -d '' "http://$ROKU:8060/sgrendezvous/track"
```

Press `up`.

- Do rendezvous lines appear on either console? (absent ⇒ independent, confirming step 2)
- `curl "http://$ROKU:8060/query/sgrendezvous"` — capture the **full XML**, including whether
  `<item>` is properly closed and how `<data>` wraps the items. The spec's own sample is malformed,
  so only the device settles it.

### 4. Both on — semantics

`logrendezvous on`, tracking still enabled. Query after **each** key press.

| Press | Then curl `query/sgrendezvous` and check |
| --- | --- |
| `down` | 5 `set` events + 1; line numbers match `grep` for `set-1`…`set-5` |
| `left` | 5 `call` events + 1; does a callFunc report the call site or the callee? |
| `right` | **0** + 1 — confirms task-owned node ops are not rendezvous |
| `OK` | 16 events; **one** with `end-tm - start-tm` ≈ 2000 among ~short ones → pins the units and whether the base is device uptime. The spin starts 500 ms in and lasts 2000 ms. |
| `options` | `drop-count` and `count` at the 1000 cap |

### 5. Id continuity

```bash
curl -d '' "http://$ROKU:8060/sgrendezvous/untrack"
curl -d '' "http://$ROKU:8060/sgrendezvous/track"
```

Press `up`, then query. Does `id` reset to 0/1 or keep climbing? Also try the optional `channel_id`
form and record the response shape:

```bash
curl -i -d '' "http://$ROKU:8060/sgrendezvous/track/dev"
```

### 6. Route confirmation

The spec contradicts itself: `external-control-api.md:37` lists `query/sgrendezvous` **and**
`sgrendezvous` as two namespaces (parallel to `query/fwbeacons and fwbeacons`, whose own example at
`:511` is `/fwbeacons/track/dev` — no prefix), but the sgrendezvous `<pre><code>` examples show
`/query/sgrendezvous/track`. Settle it:

```bash
curl -i -d '' "http://$ROKU:8060/sgrendezvous/track"          # expected: works
curl -i -d '' "http://$ROKU:8060/query/sgrendezvous/track"    # expected: 404 / error
curl -i      "http://$ROKU:8060/sgrendezvous"                 # GET on the POST namespace?
curl -i -d '' "http://$ROKU:8060/query/sgrendezvous"          # POST on the GET namespace?
```

If the device accepts both prefixed and unprefixed POSTs, we register the prefixed form as a
compatibility alias.

### 7. Engine baseline

For a side-by-side of what brs-engine emits today:

```bash
brs-cli -z --log probe-cli.log rendezvous-probe.zip
```

Already measured locally (brs-engine v2.3.0 dev). The probe produces exactly the expected counts —
`get`/`set`/`call` 5 timing lines each, `local` **0**, `slow` 16 with one ~2000 ms outlier, `flood`
1500, plus 1 `phasedone` per phase. Representative output:

```
[rendezvous] thread 1 get global.probecounter on thread 1 took 16ms
[rendezvous] thread 1 set global.probesink on thread 1 took 16ms
[rendezvous] thread 1 call node.callFunc on thread 1 took 17ms
[rendezvous] thread 1 set task.phasedone on thread 1 took 16ms
```

Three gaps this exposes, to compare against whatever the device prints:

- **No file/line at all.** Our line carries no source location, so nothing currently feeds the
  `<file>` / `<line-number>` the ECP XML requires.
- **`call` reports `node.callFunc`, not the invoked method name** (`probeAdd`). The `key` passed to
  `logRendezvousTiming` is the component method, not the callFunc target.
- **Durations are quantized to ~16 ms**, the rendezvous poll interval — an artifact of our polling
  wait, not real cost. Short rendezvous on a device should be far below that.

## Results

Fill in as you go.

| # | Question | Result |
| --- | --- | --- |
| 1 | Console output port (8085 / 8080) | |
| 2 | Console line format (verbatim) | |
| 3 | `logrendezvous on` alone → ECP items? | |
| 4 | `track` alone → console lines? | |
| 5 | **Independent switches?** | |
| 6 | `<file>` value | |
| 7 | `<line-number>` = task call site? | |
| 8 | One event per rendezvous? | |
| 9 | `local` phase event count (expect 1) | |
| 10 | `m.top.phaseDone` write counted? | |
| 11 | `start-tm`/`end-tm` units + base | |
| 12 | `slow` phase duration reported | |
| 13 | `flood` → `count` / `drop-count` | |
| 14 | `id` resets on re-track? | |
| 15 | POST route prefix (`/sgrendezvous` vs `/query/sgrendezvous`) | |
| 16 | `track` response XML shape | |
| 17 | `<item>` / `<data>` actual nesting | |
