# Animation Control Probe

Determines what a real Roku does with the `control` field on `Animation`, `ParallelAnimation` and
`SequentialAnimation` — specifically the cases where brs-engine's behavior contradicts the reference
but nothing has ever been measured.

## Why

`AnimationBase.handleControl` routes `"none"` to `stop()`, and the two container nodes forward **only**
`start` and `stop` to their children (`ParallelAnimation.ts:24`, `SequentialAnimation.ts:27`). Both look
wrong against `REFERENCES/scenegraph/abstract-nodes/animationbase.md:40`:

> `none` — "Initial state with no associated action"
> `finish` — "Jumps to the end of the animation, then stops. **All animated fields will be immediately
> set to their final values as if the animation had completed.**"

Since the containers override `updateAnimation` as a no-op, an inherited `finishImmediately()` flips the
container's own `state` and touches nothing else. But "wrong per the docs" is not "wrong on hardware" —
the `layoutDirection` enum turned out to behave the opposite of its documentation, so this gets measured
before anything is changed.

## Run

Device (sideload the folder or zip, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine baseline, committed alongside as `engine-trace.txt`:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/animation-control-probe
```

The run is ~16 s and self-terminates. Nothing here can hard-crash, so there is no registry
checkpointing (unlike `test/simulator/probes/observer-signature-probe`).

## Output format

```
PROBE|<seq>|<phase>|<case>|<key=value ...>
```

Every sample reports the animation's `state` **and the animated target field's value**. The target value
is the one that matters: an engine can report the correct `state` while never touching the field, which
is exactly the container-`finish` bug. Opacities are printed to two decimals so frame-timing jitter does
not change the trace.

Fixtures: `rectA`/`rectB`/`rectC`/`rectD` are Rectangles whose `opacity` is the interpolated target.
`delayAnim` interpolates `rectD.opacity` from **0.25** while the Rectangle is authored at **0.0**, so
"snapped to `keyValue[0]` at start" and "left alone" are distinguishable.

## Phases

| Phase | Question |
| --- | --- |
| `L-leaf` | Baseline: a plain `Animation` start → run → complete. Everything else is read against this. |
| `N-none` | Writing `control = "none"` to a **running** animation — inert, or does it stop? |
| `PF-par-finish` | `finish` on a `ParallelAnimation` — are **both** children's targets set to their final values? |
| `PP-par-pause` | `pause` on a `ParallelAnimation` — do the children actually stop advancing? Then `resume` — continue or restart? |
| `SF-seq-finish` | `finish` on a `SequentialAnimation` mid-child-1 — are children 2 **and** 3 fast-forwarded? |
| `SP-seq-pause` | `pause`/`resume` on a `SequentialAnimation`. |
| `D-delay` | With `delay = 1`, is the target snapped to `keyValue[0]` for the delay, or left at its authored value? |

## What the engine does today (`engine-trace.txt`)

All five suspected divergences reproduce. **These are the rows to compare against the device:**

| Record | Engine | Doc-implied |
| --- | --- | --- |
| `N-none/immediately-after-none` | `state=stopped`, opacity frozen at 0.57 | inert — still `running`, still advancing |
| `PF-par-finish/settled` | `rectA=0.32 rectB=0.32` | both `1.00` |
| `PP-par-pause/one-second-later` | `par.state=paused` but `c1/c2.state=running`, opacity advanced 0.32 → 0.98 | children paused, opacity frozen |
| `SF-seq-finish/settled` | `rectA=0.57 rectB=0.00 rectC=0.00` | all three `1.00` |
| `D-delay/during-delay` | `rectD.opacity=0.00` | `0.25` (`keyValue[0]`) if the device snaps |

`L-leaf` and the `resume` samples are controls: they should match between device and engine, and a
mismatch there means the comparison itself is off (frame timing, a different `state` vocabulary) rather
than a real divergence.

## Reading the result

For each row above, the device either agrees with the reference — in which case the engine has a
confirmed bug and the fix is what the doc says — or it agrees with the engine, in which case the
**reference is wrong** and that fact belongs in `.claude/docs/scenegraph-invariants.md` so nobody
"fixes" it later from the documentation.

Two outcomes need care rather than a straight copy:

- **`pause` on a container.** If the device pauses the children, the fix must also decide what the
  children's own `state` reads as (`paused` vs unchanged) — `SequentialAnimation.tick` advances its
  cursor by polling `child.state = "stopped"`, so a wrong answer there mis-sequences the chain.
- **`delay`.** If the device snaps to `keyValue[0]`, note whether it also does so on **every repeat
  iteration** — `AnimationBase` re-seeds `delayRemaining` per iteration, so the answer changes what a
  repeating delayed animation looks like between cycles.
