# Grid Scroll Animation Probe

Measures how a real Roku **animates** a list/grid focus move, so brs-engine can implement the same
thing. A device ramps `currFocusRow` through fractional values across many frames and settles the
focus fields at the end; brs-engine completes every move instantly (`animateToItem` and `jumpToItem`
both route to the same `setFocusedItem`).

Companion to `test/simulator/probes/list-refocus-settle-probe`, which established *that* the
divergence exists. This one measures *what to build*.

## Why it matters beyond visual smoothness

A common app shape parents an overlay as a sibling of a list and re-shows it from an observer on the
list's `rowItemFocused`, reading the field live. A key handler navigating out of the overlay must hand
focus to the list **before** moving a row (the list's container may `jumpToItem` on focus change):

```brightscript
row = list.currFocusRow
container.setFocus(true)      ' (A)
list.animateToItem = row + 1  ' (B)
hideOverlay()                 ' (C)
```

On device the whole move outlives the handler, so (B) is still in flight at (C). In the engine it
finishes inside the handler. In the device capture of the companion probe, the overlay that stole focus
at (A) held it for the entire animation and lost it **exactly when the animation settled** — which is
what rescues the app. That makes native scroll animation a candidate fix for a *behavioral* bug, not
just a cosmetic one.

## The load-bearing question (A4/A5)

Two readings of the device evidence both fit, and they imply different amounts of work:

- **(i) `animateToItem` is an animated focus MOVE**, and its completion re-asserts focus on the list —
  so the app-level steal is simply overwritten when the animation lands. Implementing animation +
  emitting the settle would then be **sufficient**.
- **(ii) The steal never rewrote the chain**, and completion merely re-lands focus. Then the focus-chain
  model has to change too (see the companion probe's README), and animation alone is **not** enough.

`A4` steals focus from a `rowItemFocused` observer and then does **nothing else** — no row move, so no
animation completion can rescue it. `A5` does the reverse: it steals focus with an animation **already
in flight** and asks whether that animation still settles onto the list, taking focus back.

- A4 overlay keeps focus **and** A5 animation still settles onto the list → reading **(i)**: animation
  completion is the rescuing mechanism, and implementing it fixes the app failure.
- A5 animation abandoned / never settles → reading **(ii)**: animation alone will not fix it.

## Run it on the Roku

1. Zip the app:

   ```
   cd test/simulator/probes/grid-scroll-animation-probe && zip -r ../grid-scroll-animation-probe.zip manifest source components
   ```

2. Sideload: browse to `http://<roku-ip>` → Development Application Installer → upload the zip →
   **Replace**.

3. Capture **before** it finishes — open a second terminal first:

   ```
   telnet <roku-ip> 8085 | tee device-trace.txt
   ```

4. It runs A0–A6 unattended in about 20 seconds, then exits on its own. No key presses needed (Back
   aborts early if you want out).

5. Send back the `PROBE3|` lines.

Engine side:

```
node packages/node/bin/brs.cli.js -r test/simulator/probes/grid-scroll-animation-probe -c 0
```

## Scenarios

| Scenario | Question |
|---|---|
| `A0-focus` | Baseline: focus the list. |
| `A1-animate` | `animateToItem` on a focused list — the **reference ramp**. How long (ms), how many frames, what easing, and in what order do `scrollingStatus`/`itemUnfocused`/`currFocusRow`/`itemFocused`/`rowItemFocused` fall around it? |
| `A2-jump` | `jumpToItem` for contrast — documented as an immediate move. Does it ramp at all, or settle in one step? This is what tells us whether the two fields need different code paths. |
| `A3-interrupt` | A second `animateToItem` written 4 frames into the first. Does it **retarget** from the current fractional position, or restart from the settled row? Does the abandoned target emit anything? |
| `A4-steal-no-move` | Steal focus from the `rowItemFocused` observer, then do nothing. Does the overlay keep focus? (Isolates whether the steal really rewrites the chain.) |
| `A5-steal-midflight` | Steal focus **while an animation is in flight**. Does the animation still settle onto the list and take focus back? |
| `A6-unfocused-animate` | `animateToItem` on an **unfocused** list — animated, or silent like the engine's current unfocused path? |
| `A7-skipFocusAnimations` | `animateToItem` with `skipFocusAnimations = true` — the documented opt-out. A1's ramp must collapse to a single step, confirming this is the switch the engine should honor. |

## Trace format

```
PROBE3|<seq>|<ms>ms|f<frame>|<scenario>|<point>|<key=value ...>
```

The **ms stamp** (`roTimespan`) and **frame counter** are what make the animation measurable: a value
sequence alone cannot distinguish a 20-frame ramp from a 60-frame one sampled every third frame. The
frame timer ticks at `duration="0.016"` — deliberately not `0`, which free-runs as fast as the
interpreter loops (the engine hit ~250k "frames"/sec, making the counter meaningless).

Live state on every record: `liveRIF` (`rowItemFocused`), `liveIF`/`liveIU`
(`itemFocused`/`itemUnfocused`), `liveCFR` (`currFocusRow`), `liveSS` (`scrollingStatus`),
`listInChain`, `overlayFocus`.

## Engine baseline (`engine-trace.txt`)

Every programmatic move completes **within the writing statement**:

```
006 A1-animate|before        liveCFR=0
007 A1-animate|after-write   liveCFR=3   <-- already settled, same millisecond
008   OBS-itemUnfocused data=0
009   OBS-currFocusRow  data=3           <-- one jump, no fractional values
010   OBS-itemFocused   data=3
011   OBS-rowItemFocused data=[3,0]
```

Findings to diff against the device:

1. **No ramp.** `currFocusRow` goes `0 → 3` in a single notification. The device emits ~20 fractional
   steps over ~330 ms for a one-row move.
2. **`animateToItem` and `jumpToItem` are indistinguishable** (A1 vs A2 — identical shapes). On device
   `jumpToItem` is documented as immediate and `animateToItem` as "quickly scroll", so these should
   *not* match.
3. **`scrollingStatus` never pulses for a programmatic move** — `liveSS=F` throughout A1/A2/A3/A6, and
   no `OBS-scrollingStatus` record appears anywhere in the engine trace. The device pulses it
   `true`→`false` around the animation (companion probe, device records 009/033). The engine only
   pulses on *key* navigation, by design (`armScrollPulse` is called from `handleKey`).
4. **A3 retarget is trivially "instant twice"** — the first write fully settles on row 5 (021-025),
   then the interrupt fully settles on row 2 (027-031). There is no in-flight state to retarget, so the
   device's real behavior here is entirely unmeasured by the engine.
5. **A4: the steal sticks** (`listInChain=F overlayFocus=T` at 046, still so at 047). Matches the
   companion probe's engine result and is the app-level failure.
6. **A5: nothing to abandon.** The animation had already settled before the mid-flight steal ran (053
   vs 058), so the engine cannot even express the scenario — which is precisely why the device answer
   is needed.
7. **A6: an unfocused `animateToItem` moves silently** (`liveRIF` `[4,0]`→`[2,0]` with no `OBS-`
   records). Consistent with the documented unfocused rule, but the device may still animate.
8. **`skipFocusAnimations` is not implemented at all** — A7 reports `skipFocusAnimations=absent`
   (`hasField` is false; the field is absent from `ArrayGrid.defaultFields`). Reading it returns
   `Invalid`, which crashes a strongly-typed BrightScript helper — an app that legitimately checks the
   documented field gets a runtime error rather than `false`. Worth adding **independently** of the
   animation work, since it is a one-line field declaration whose absence is itself a compatibility bug.

## Device findings (`device-trace.txt`, Roku Streaming Stick+ / OS 15.3)

### The animation, measured

`animateToItem` starts a multi-frame animated scroll. Emission order around it (A1, records 008-069):

```
008 scrollingStatus = true          <-- RISES FIRST, before the write even returns
009 itemUnfocused   = 0             <-- also up-front, at animation START
010 after-write                     (the BrightScript assignment returns here)
011..066 currFocusRow 0.079 … 3.0   <-- ~59 frames of fractional values
067 itemFocused     = 3             <-- settle
068 scrollingStatus = false
069 rowItemFocused  = [3,0]         <-- settles LAST
```

Timing (`scrollingStatus` rise → fall):

| move | duration | frames |
| --- | --- | --- |
| 1 row (A4) | 364 ms | 21 |
| 2 rows (A6) | 686 ms | 34 |
| 3 rows (A1) | 1021 ms | 59 |

So **~340 ms per row traversed**, not a fixed total — a 3-row move takes 3× as long as a 1-row move.
Per-row splits within A1 confirm it is one continuous eased curve rather than per-row steps
(0→1: 135 ms, 1→2: 183 ms, 2→3: 684 ms — decelerating into the target). The curve is ease-in-out:
per-frame deltas ramp up to ~0.13 rows/frame mid-flight and decay to ~0.004 at the end.

Ordering notes that differ from the engine's key-navigation pulse:

- `scrollingStatus` **rises before the write returns** and `itemUnfocused` is emitted at animation
  **start**, not at the settle. The engine emits `itemUnfocused` as part of the settle bracket.
- The falling edge still precedes `rowItemFocused`, so the existing "falling edge before the settle"
  invariant holds — but `itemFocused` (067) comes *before* `scrollingStatus=false` (068), whereas the
  engine emits both edges ahead of every settled field.

### A2 — `jumpToItem` does NOT animate (confirmed)

Records 072-076: no `scrollingStatus` at all, `currFocusRow` goes straight to 0, all four focus fields
in one millisecond. So the two fields genuinely need different paths, as suspected.

### A3 — a mid-flight retarget continues from the current position

The interrupt at 0.52 (records 088-089) does **not** restart or jump: the very next sample is 0.658 and
the ramp continues smoothly to the new target 2. Neither the abandoned target nor a second
`scrollingStatus`/`itemUnfocused` pair is emitted — one continuous animation, retargeted. Note the
retarget was *toward* a farther row here; a reversal is untested.

### A6 — an unfocused list DOES animate, but publishes no focus settle

Records 247-287: full `scrollingStatus` pulse and a complete 34-frame ramp (4 → 2), yet **no
`itemFocused` and no `rowItemFocused`** — and `itemUnfocused` fires with the sentinel `-1`. So
`scrollingStatus` + `currFocusRow` are *not* gated on focus, while the settle fields are. The engine's
unfocused path is silent for everything, which is right for the settle and wrong for the ramp.

### A7 — `skipFocusAnimations` exists on device but did NOT skip the animation

`hasField` returns true and the write takes (`skipFocusAnimations=T`, record 297), yet the move still
ramps over 1028 ms / 60 frames — indistinguishable from A1. Either the field only suppresses the
focus-*indicator* animation (its wording mentions "repositioning/scaling of the focus indicator") and
not the scroll, or it must be set before the content/render pass to take effect. **Do not treat it as a
scroll on/off switch** on this evidence. It is still absent from the engine (`skipFocusAnimations=absent`
in `engine-trace.txt`), which remains a real gap worth closing on its own.

### A4/A5 — the load-bearing answer: animation alone is NOT sufficient

This is the pair that decides the original question, and it **refutes reading (i)**:

- **A4** (steal after the settle, then no further move): `listInChain=T` → **`F`**, `overlayFocus=T`,
  and it **sticks** (records 153-155). The device honors the steal and **does** evict the list.
- **A5** (steal at 0.39 into a 4-row animation): the steal is honored and evicts the list
  (172), the animation **keeps running to completion** across the next ~66 frames while the list is out
  of the focus chain (173-242), and at completion it emits **only `scrollingStatus=false`** — **no
  `itemFocused`, no `rowItemFocused`** (`liveRIF` stays `[0,0]`). Focus is **not** returned to the list.

So an in-flight animation does **not** re-assert focus on completion. Implementing scroll animation is
**necessary but not sufficient** to fix the overlay failure by itself.

### Correction to the earlier R7 conclusion

The companion probe's README (and my earlier reading of R7) claimed the device "does not evict the
list from the focus chain" on a backwards steal. **A4 shows that is wrong** — the device evicts exactly
as the engine does. R7 showed `listInChain=T` for a different reason visible in its own trace: at
record 174, immediately after the steal, `OBS-containerFocus-done` fires — the container's
`focusedChild` observer had *re-redirected* focus into the list. The `T` was the container handing
focus back, not the steal being softened.

That is good news for the engine's focus model: **no two-simultaneous-focus-holders change is needed**,
and the `.claude/docs/scenegraph-invariants.md` "deliberately not modeled" decision stands.

### So what actually fixes the app?

Combining A1 with A4/A5: on device the app's `(A) setFocus → (B) animateToItem → (C) hideOverlay`
handler works because **(B) is still animating when (C) runs and for ~340 ms afterwards**. The stale
settle that re-shows the overlay is emitted at (B)'s *completion*, long after (C) has run and after the
app's own 0.1 s + 0.1 s fade-out has finished — and by then the settle describes the **new** row, so the
re-show never triggers. In the engine (B) completes inside the handler, so the stale settle lands
*before* (C) and re-shows the overlay.

That means the fix is exactly the animation, for the reason of *ordering*, not of focus re-assertion:
deferring (B)'s settle past the key handler is what removes the stale re-show. A4/A5 only rule out the
stronger claim that completion would also repair a focus steal.

## What a native implementation will need

Now grounded in the device numbers above:

- A per-frame scroll animation driven from the existing render-thread hook (`sgRoot.processAnimations`
  already ticks `AnimationBase` every frame), holding: origin row (fractional, so a retarget can
  continue from it), target row, start time, duration, easing.
- **Duration ≈ 340 ms × rows traversed** (measured: 364/686/1021 ms for 1/2/3 rows), ease-in-out.
- `currFocusRow`/`currFocusColumn` written **fractionally** each frame while it runs (they are floats
  precisely so they can carry in-transit values — `arraygrid.md` documents `currFocusRow` going "3.0 to
  4.0 … taking on values between").
- **`scrollingStatus = true` and `itemUnfocused` at animation START**, before the assignment returns —
  not as part of the settle bracket, which is where the engine emits `itemUnfocused` today.
- At completion: `currFocusRow` integral → `itemFocused` → `scrollingStatus = false` → `rowItemFocused`
  last. The falling edge is INTERLEAVED into the settle, not appended after it — implemented, and
  load-bearing: an app rebuilds its focused-item overlay on the falling edge and treats `rowItemFocused`
  as the authoritative settle, so emitting the edge last lets the settle handler overwrite the rebuild.
- **A retarget mid-flight continues from the current fractional position** (no restart, no second
  pulse, no emission for the abandoned target).
- **An unfocused list still animates** (`scrollingStatus` + the `currFocusRow` ramp) but emits **no**
  `itemFocused`/`rowItemFocused`; `itemUnfocused` goes to the `-1` sentinel. So the focus gate belongs
  on the settle fields only, not on the ramp.
- `jumpToItem` keeps today's instant path — A2 confirms it does not animate at all.
- **A focus steal mid-animation does not stop the animation, and completion does not return focus**
  (A5). Do not make completion re-assert focus.
- **`skipFocusAnimations`** (`arraygrid.md`, boolean, default `false`) is the documented opt-out, and its
  wording describes the engine's current behavior exactly: *"any scrolling or repositioning/scaling of
  the focus indicator occurs without an animation. This causes fields reflecting the focus status
  (itemFocused, currFocusRow, currFocusColumn) to be updated instantly and not transition smoothly
  between old and new values. For example, currFocusRow will go directly from 3.0 to 4.0 instead of
  taking on values between 3.0 and 4.0."* So today's engine behaves as if this field were permanently
  `true`. Implementing animation means honoring it: `true` keeps the current instant path, `false`
  (the default) animates. `A7` measures it. `fadeFocusFeedbackWhenAutoScrolling` is a related
  focus-indicator field worth checking at the same time.

Care needed where instant-settle is currently load-bearing: `ArrayGrid.setNodeFocus` re-emits the settle
on focus-gain, `resetFocusForNewContent` resets the cursor, and the CLI regression apps
(`list-initial-focus-app`, `panelset-*`) assert on synchronous outcomes. Animating a focus-gain
re-emission would break them, so the animation almost certainly belongs to
`animateToItem`/`animateToRowItem` only, not to every `setFocusedItem` caller.
