# List Refocus Settle Probe

Measures **whether** and **when** a `RowList` re-publishes its focus-settle fields (`itemFocused`,
`itemUnfocused`, `currFocusRow`, `currFocusColumn`, `rowItemFocused`, `scrollingStatus`) when the list
is handed focus **without its focused position having moved** — so brs-engine can be made to match.

## Why this shape

A common app pattern parents an overlay as a **sibling** of a list and re-shows that overlay from an
observer on the list's `rowItemFocused`. Crucially, such an observer reads the field **live off the
node**, not from `event.getData()`.

A key handler that navigates *out of* the overlay must hand focus to the list **before** moving a row
(a necessary ordering: the list's container may `jumpToItem` when focus changes). So the handler is:

```brightscript
row = list.currFocusRow
container.setFocus(true)      ' (A) hand focus over FIRST
list.animateToItem = row + 1  ' (B) then move a row
hideOverlay()                 ' (C) fade the overlay out
```

Everything then hinges on **when** the focus-gain settle is delivered:

| Delivery | Live read sees | Result |
| --- | --- | --- |
| synchronously, inside step (A) | the **outgoing** row | the observer re-shows the very overlay (C) is about to hide, and re-grabs focus with it |
| from the message loop, after the handler | the **moved-to** row | the overlay is not re-shown |

The app also focuses a **container**, never the list directly — the container's own `focusedChild`
observer redirects focus inward. That intermediate observer turns out to matter (see Findings), so the
probe measures both call shapes.

## Run it on the Roku

1. Zip the app:

   ```
   cd test/simulator/probes/list-refocus-settle-probe && zip -r ../list-refocus-settle-probe.zip manifest source components
   ```

2. Sideload: browse to `http://<roku-ip>` → Development Application Installer → upload
   `list-refocus-settle-probe.zip` → **Replace**.

3. Capture the trace **before the app finishes** — open a second terminal first:

   ```
   telnet <roku-ip> 8085 | tee device-trace.txt
   ```

   (or `nc <roku-ip> 8085 | tee device-trace.txt`)

4. The app auto-runs R1–R5 over about 10 seconds. When it prints

   ```
   PROBE|---|R6-key|MANUAL|Now press DOWN once, then BACK on the remote.
   ```

   press **Down** once, then **Back**. Back exits the probe.

5. Send back `device-trace.txt` (the `PROBE|` lines are enough).

Capture the engine side with:

```
node packages/node/bin/brs.cli.js -r test/simulator/probes/list-refocus-settle-probe -c 0 -e
```

then `curl -X POST http://localhost:8060/keypress/Down` for the R6 press (and `.../Back` to exit).
`engine-trace.txt` in this folder was captured that way.

## What each scenario answers

| Scenario | Question |
|---|---|
| `R1-first-focus` | Content loaded while unfocused, then the first `setFocus(true)`. Which fields fire? (The one case already pinned: focus genuinely moves onto item 0.) |
| `R2-refocus-unchanged` | Move to row 1, park focus on a sibling, hand focus **back** with the position unchanged. **Does the settle re-fire at all?** And does its record land between `before`/`after` (synchronous) or after `after` (message loop)? |
| `R3-focus-then-move` | The app's (A)→(B) sequence in one handler, via the **container**, driven from a Timer observer. Which row does the observer's **live** read see? |
| `R4-refocus-after-horiz` | Same as R2 after a horizontal-only move (column changed, row did not). |
| `R5-unfocused-jump` | `jumpToRowItem` written while unfocused — silent at the time, but is the recorded position published on the next focus-gain? |
| `R6-key-down` | The same (A)→(B)→(C) sequence driven from **`onKeyEvent`** rather than a Timer observer. A key handler starts at observer depth zero, which can move where a deferred notification drains. |
| `R7-key-down-regrab` | The **complete** app behavior: the re-show also **re-focuses** the overlay. That is a nested `setFocus` targeting a node *outside* the chain the in-flight `setFocus` just committed — a "backwards steal". `focus-probe2` established a device drops those. Is it dropped here, and if it is honored, does the (B) row move go silent? |

`R2` + `R6` decide the fix; `R1`/`R5` guard rules that are already pinned
(`test/cli/resources/list-initial-focus-app`).

## Trace format

```
PROBE|<seq>|<scenario>|<point>|<key=value ...>
```

Live state accompanies every record — this read-back is the whole point, since it is what the app
does:

- `liveRIF` — `rowItemFocused` read live off the node, as `[row,col]`
- `liveIF` / `liveIU` — `itemFocused` / `itemUnfocused`
- `liveCFR` / `liveCFC` — `currFocusRow` / `currFocusColumn`
- `listInChain` — `list.isInFocusChain()` (`T`/`F`)
- `overlayFocus` — `overlay.hasFocus()`

Special points:

- `OBS-<field>` — that field's observer fired. `data=` is the event payload; compare it against
  `liveRIF` on the same line — a disagreement means the notification arrived *after* a later move.
- `OBS-containerFocus-redirect` / `-done` — the container's `focusedChild` observer handing focus down
  to the list (the app's intermediate observer).
- **`WOULD-RESHOW`** — the failure reproducing. The `rowItemFocused` observer's **live** read still
  reports the overlay's row, so an app would re-show the overlay (and re-grab focus) at the exact
  moment its handler is trying to hide it.

Because each scenario is stepped from a repeating `Timer`, synchronous vs. deferred dispatch is
directly visible: a synchronous notification prints **between** a scenario's `before` and `after`
records; a message-loop one prints **after** `after`.

## Engine findings (pre-fix baseline, `engine-trace.txt`)

`engine-trace.txt` is captured **before** the fix on purpose: it is the record of the bug, so R7 there
still shows the steal being honored (`listInChain=T` → `F`). Re-running the probe on a fixed build shows
record 156 as `listInChain=T overlayFocus=F` instead.

Captured against the engine as of this probe's commit. **The device trace is what decides the fix** —
these are the numbers to diff against.

1. **The settle re-fires for an unchanged position.** `R2-refocus-unchanged` (records 017-018) emits
   `itemFocused=1` and `rowItemFocused=[1,0]` even though the focused row never moved. Same in
   `R4` (039-040) and `R5` (056-057). Source: `ArrayGrid.setNodeFocus` unconditionally re-runs
   `setFocusedItem(itemFocused)` on focus-gain.

2. **The bug reproduces only on the key-driven path.** `R6-key-down` (064-076) is the failure:

   ```
   064 A-before-setFocus              row=0, overlay focused
   065 OBS-containerFocus-redirect    container hands focus down to the list
   067 OBS-itemFocused      data=0    <- settle fires INSIDE step (A)
   068 OBS-rowItemFocused   data=[0,0]   liveRIF=[0,0]
   069 WOULD-RESHOW         liveRow=0 <- overlay re-shown before the row ever moves
   070 A-after-setFocus
   071-074                            (B) finally moves the row to 1
   076 C-hide-overlay                 too late: 069 already re-grabbed focus
   ```

3. **The Timer-driven path does *not* reproduce it** — `R3-focus-then-move` (032-033) shows a stale
   payload (`data=[0,0]`) but a live read of `[2,0]`, so no `WOULD-RESHOW`.

4. **Why the two differ — the drain boundary depends on the caller's observer depth.** The settle is
   emitted under `Field.enterInternalUpdate()`, so a reentrant notification is queued and drained by
   `Field.executeCallbacks`, which only drains when `observerDepth === 1`
   (`src/extensions/scenegraph/nodes/Field.ts:761`):

   - **R6** — `onKeyEvent` is not a field observer, so it starts at depth **0**. The container's
     `focusedChild` observer becomes depth 1 and therefore drains the queue at *its own* boundary —
     still inside step (A), before the row moves.
   - **R3** — `onStepTimer` is a `fire` observer, so it starts at depth **1**. The container observer
     becomes depth 2, no drain happens there, and the queue drains only when the outer Timer observer
     unwinds — by which time (B) has moved the row.

   The delivery point of a focus-gain settle should not depend on whether the caller happens to be
   inside another observer. That depth-sensitivity is the engine artifact this probe pins.

## Device findings (`device-trace.txt`, Roku Streaming Stick+ / OS 15.3)

The device measurement **refutes both** candidate fixes that were on the table.

1. **A refocus on an unchanged position DOES re-emit the settle.** `R2-refocus-unchanged` (038-039)
   emits `itemFocused=1` and `rowItemFocused=[1,0]` with the row unmoved; same in `R4` (106-107) and
   `R5` (116-117). So suppressing the re-emission would diverge from the device — and would break the
   app pattern that relies on `setFocus(true)` firing `rowItemFocused`.

2. **That re-emission is SYNCHRONOUS, and the engine wrongly defers it.** On device the records land
   *between* `before` and `after`; in the engine they land *after* `after`:

   | | device | engine |
   | --- | --- | --- |
   | `R1` | 004-005 before `after`(007) | 004-005 after `after`(003) |
   | `R2` | 038-039 before `after`(040) | 017-018 after `after`(016) |
   | `R4` | 106-107 before `after`(108) | 039-040 after `after`(038) |
   | `R5` | 116-117 before `after`(119) | 048-049 after `after`(047) |

   Consistent in all four. So deferring the settle to the message loop is the **wrong direction** —
   the engine already defers it and should not.

3. **`WOULD-RESHOW` fires on the device too** (`R6` record 128, matching engine 069). The overlay
   being re-shown at step (A) is therefore **not** the divergence — it is what a real Roku does.

4. **The real divergence is that `animateToItem` is instantaneous in the engine but animated on
   device**, so the move's settle lands on opposite sides of the key handler:

   | | device | engine |
   | --- | --- | --- |
   | (B) `animateToItem` | starts an animation; `scrollingStatus=T` (131), `itemUnfocused` (132) | completes instantly |
   | `currFocusRow` | ~20 fractional steps (135-154), spanning frames | one jump to `1` (072) |
   | settle for the NEW row | `itemFocused=1` (155), `rowItemFocused=[1,0]` (157) — **after** the handler returned at 134 | (073-074) — **inside** the handler, before (C) |

   On device the whole move outlives the key handler; in the engine it finishes within it. That is
   what changes the state the app's (C) fade-out and its `isInFocusChain()` completion guard observe.

5. Minor, noted not fixed here: `currFocusColumn` defaults to `-1` on device, `0` in the engine
   (record 001); and the device emits a `currFocusRow=0` at init (002) that the engine does not.

### R7 — the actual failure, and the fix

`R7` arms the half the earlier scenarios omitted: the app's re-show does not merely make the overlay
visible, it calls `setFocus(true)` on it. That is a **backwards steal** — a nested focus request targeting
a node outside the subtree the in-flight transaction just focused.

Pre-fix engine trace:

```
150 A-before-setFocus              row=0  listInChain=F overlayFocus=T
151 OBS-containerFocus-redirect     container hands focus down to the list
152 OBS-itemFocused      data=0     the focus-gain settle (device-correct per finding 1)
153 OBS-rowItemFocused   data=[0,0]
155 RESHOW-regrab                   nested overlay.setFocus(true)   <-- BACKWARDS STEAL
156 RESHOW-regrab-done              listInChain=T -> F               <-- HONORED
158 A-after-setFocus                the list already lost focus, inside step (A)
161 B-after-animateToItem           row moved but listInChain=F -> published SILENTLY
162 C-hide-overlay                  overlay still holds focus
```

Because the steal is honored the list leaves the focus chain **inside step (A)**, so (B)'s row move takes
the silent path and the app never learns the row changed; the overlay keeps focus, and an app whose
fade-out completion guard is `isInFocusChain() = false` never passes it. That is the reported symptom:
the overlay stays on screen, and left/right keeps operating the overlay instead of the list.

**Why the drop rule missed it.** `Node.isFocusRequestDropped` exists to drop exactly this, but it asked
whether the *notifying owner* was still in the focus chain. Here the owner is the container, which **is**
still in the chain — focus went to its own child — so the steal read as a legal forward focus. The rule
`focus-probe2` established is about the **target**: dropped only when the target lies outside the subtree
just focused. Both conditions are needed, and "inside the owner's subtree" is the right forward test,
because forward focus routinely targets a *sibling* of the focused leaf (how a dialog highlights its
buttons).

**Fix**, in two halves:

1. **Classify by owner *and* target** (`Node.isFocusRequestDropped`). The target test applies only when
   the owner is a *proper ancestor* of the focused node — the container shape. When the owner **is** the
   focused node the transaction staged `focusedChild` on the leaf itself, so a redirect from there is the
   ordinary "I got focus but have nothing to show, pass it on" pattern and must still be honored. Two
   targets are likewise never steals, because they are not in the owner's tree when the request is
   raised and a subtree walk would drop them: a node still unparented (a component focusing itself from
   `init()`, which runs before `appendChild`) and the scene's `dialog` (parented to the Scene via
   `setNodeParent`). The `target === focused` idempotence check is tested **after** the owner-in-chain
   walk, never before — ahead of it, a focus-*loss* observer re-asserting the incoming node would be
   honored, re-running the whole transaction and double-firing every observer.

2. **Carry the classification through the deferral** (`Node.runWithFocusNotifyOwner`,
   `Field.executeCallbacks`). Finding 2 above says the settle *should* dispatch synchronously, and that
   was the first attempt — but the settle is also what carries an app's reentrant multi-list load, so
   forcing it inline re-creates the crash `deferred-observer-app` pins (an earlier list's `content` is
   still `invalid` when a later list's handler runs). The crash shape and this steal shape are both "a
   container's `focusedChild` observer calls `setFocus` on a list", so no timing gate separates them.
   Instead the queued entry remembers the notification it was raised under and reinstates it around the
   deferred dispatch: the drop rule stays applicable without moving *when* the observer runs. Delivery
   timing is therefore still the engine's (deferred), and finding 2 remains an open divergence —
   independent of this bug, since the classification no longer depends on it.

Post-fix, record 156 reads `listInChain=T overlayFocus=F`: the steal is dropped, the list keeps focus,
(B) publishes normally, and the sequence settles on the new row.

**R6 is deliberately unchanged.** Its steal is raised after the settle has already drained, with no focus
transaction on the stack, so nothing can classify it. That shape is not what the app does.

Regressions: `test/extensions/scenegraph/Focus.test.js` (the steal case, which fails without the
target-keyed rule; a forward-focus companion pinning that the rule does not over-drop; the own-focus-gain
redirect; and the loss-observer re-assert) plus `container-redirect-focus-app` in
`test/cli/cli-scenegraph.test.js`, which drives all four shapes end-to-end through the **deferred**
settle — the unit tests use port observers, which never defer, so only the CLI fixture covers half 2.

### Corrections recorded, so the trail is not re-walked

Two conclusions drawn from earlier captures in this probe were **wrong**, and both are worth knowing
because each cost a deploy:

1. *"The device does not evict the list from the focus chain."* R7's `listInChain=T` was the container's
   `focusedChild` observer re-redirecting focus into the list one record later (record 174 in the device
   capture), not the steal being softened. A follow-up probe (`grid-scroll-animation-probe`, added with the
   scroll-animation work) measured the steal in isolation and the device **does** evict. Consequence: the `.claude/docs/scenegraph-invariants.md`
   "two nodes reporting focus at once is deliberately not modeled" decision **stands** — no focus-chain
   model change was needed.
2. *"Implementing scroll animation fixes this."* Finding 4 is a real divergence and worth fixing on its
   own, but it does **not** fix this bug: A4/A5 show a focus steal is honored regardless, and an in-flight
   animation neither stops nor returns focus on completion. Deploying animation alone made the symptom
   worse — the visuals moved while focus stayed on the overlay.
