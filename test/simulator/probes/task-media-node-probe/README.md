# Task Media Node Probe

Determines what actually happens when a Task thread (a non-rendering context) creates and drives
`Poster` / `AnimatedImage` nodes — components documented as rendering nodes, which Roku is not
expected to support off the render thread.

## Why

A code review of the `AnimatedImage`/`Poster` construction-time observer-replay fix
(`AnimatedImage.setState`/`Poster.setLoadStatus`, `Field.runAfterConstruction`) flagged that the
replay queue is only drained on the render thread — `src/extensions/scenegraph/index.ts`'s `tick()`
never calls `Field.deliverPendingConstructionCallbacks()` on a Task thread. Since rendering nodes
aren't supposed to be used in Task threads at all, this probe checks how these two node types
actually behave when a Task creates them: does `CreateObject` succeed, does `uri` loading work,
does the node stay usable, and does observer dispatch behave like the render thread or diverge?

## Run

Device (sideload the zip, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/task-media-node-probe
```

Baseline engine output is committed alongside as `engine-trace.txt`.

## Output format

```
PROBE|<seq>|<phase>|<case>|<key=value ...>
```

## Two device crashes so far — both point at the same root cause

Full captures: `device-trace.txt`. Summary:

**v1**: reading `m.p.loadStatus` inside the `loadStatus` observer raised `'Dot' Operator attempted
with invalid BrightScript Component or interface reference` (runtime error `&hec`). Read at the
time as "the `Poster` node became invalid."

**v2** (after guarding that specific read): a DIFFERENT line in the same observer,
`m.posterObservedCount = m.posterObservedCount + 1`, raised `Type Mismatch. Operator "+" can't be
applied to "Invalid" and "Integer"` — a plain missing-AA-key read, not a dead-object error.

**Revised understanding** (user-proposed, matches both crashes): the observer callback body itself
runs with a **different `m`** than the code that called `observeField()` and set the local
variables. Theory: since `Poster`/`AnimatedImage` are owned by the render thread, their field
observers dispatch there too, using a separate, mostly-empty `m` for the Task component (both crash
dumps show `count:2`–`3`, consistent with just `top`/`global`) rather than the Task's own live
execution-thread closure. Under that theory, `m.p` in v1 wasn't a dead node — it was simply absent
from that `m` (a missing-key read returns `Invalid`), and the dot operator on `Invalid` is what
raised `&hec`. v2's arithmetic error is the more direct, easier-to-read version of the same fact.

## Redesign history

- **After v1**: wrapped every dot-access to a node that might be invalidated in `try`/`catch`
  (`safeLoadStatus`/`safeState`/`safeChildPosterStatus`/`safeChildAnimState`, each returning
  `CRASH:<message>` instead of crashing), and wrapped each phase's body in `runProbe()` so one
  crash can't stop the others.
- **After v2**: that wasn't enough — the crash-prone code wasn't only the node-field reads, it was
  ANY `m.xxx` access inside an observer body assumed to still be there. Every observer
  (`onPosterStatus`, `onAnimState`, `PosterXmlChild.onStatus`, `AnimatedImageXmlChild.onState`) is
  now diagnostic-first: it prints `m.count()` and `m.DoesExist("<key>")` for every key it's about to
  touch BEFORE touching it, only touches keys that report present, and still wraps the actual node
  access in `try`/`catch` as a last resort. This directly tests the revised theory instead of
  assuming it.

This version needs a fresh device run.

## Cases

| Phase | What it does |
| --- | --- |
| `poster-direct` | `CreateObject("roSGNode", "Poster")` on the Task thread, observer registered BEFORE an imperative `uri` write (no XML involved). |
| `animatedimage-direct` | Same for `AnimatedImage` (`uri` + `control="loop"`). |
| `poster-xmlattr` | A custom component (`PosterXmlChild.xml`) created on the Task thread whose `<Poster uri="...">` is an XML attribute — applied during the child's OWN construction, before `PosterXmlChild`'s `init()` can `observeField`. This is the construction-vs-`init()` timing case the render-thread fix addresses. |
| `animatedimage-xmlattr` | Same shape for `AnimatedImage` (`AnimatedImageXmlChild.xml`). |

Each phase logs: node creation + `subtype()`, the field value immediately before/after the
triggering write, every observer firing (with an `m` diagnostic dump, then the field value read
safely), a 30ms-interval poll for 300ms, and the field value after that settle window.

## Engine baseline (`engine-trace.txt`) — does NOT reproduce either crash

All four phases complete normally on the engine: `m` inside every observer body is the SAME `m` the
calling code used (`m.count()`/`m.DoesExist(...)` report exactly what was put there), no `Invalid`
reads, no `CRASH:` results anywhere.

- **`poster-direct` / `animatedimage-direct`: works exactly like the render thread.** The imperative
  `uri` write loads synchronously and the registered observer fires with every real transition
  (`loading`→`ready` for Poster; `downloading`→`init`→`first`→`decode` for AnimatedImage).
- **`poster-xmlattr` / `animatedimage-xmlattr`: stuck forever, but doesn't crash.** The field
  freezes at its FIRST transition (`loadStatus="loading"`, `state="downloading"`) and the observer
  never fires, because `uri` is an XML attribute (`Field.isConstructing()` is true and no observer
  exists yet when the load completes), and nothing ever drains the resulting
  `Field.runAfterConstruction()` queue on a Task thread (`tick()`'s Task branch only calls
  `task?.processThreadUpdate()`).

So the engine currently models Task-thread field/observer dispatch as always sharing the calling
`m` — it has no notion of a rendering node's observer running in a separate context. Whether that's
worth reproducing (and how faithfully) depends on confirming the theory on device first.

## Resolved (v3 — full run, no crash; see `device-trace.txt`)

Two clearly different, now-confirmed behaviors:

1. **`poster-direct`/`animatedimage-direct` (direct `CreateObject` + `observeField` from the Task's
   own top-level script): the "separate `m`" theory is confirmed.** Every observer firing shows
   `m-count=2`, `has-p=false`/`has-a=false` — the observer body runs with a near-empty `m` (just
   `top`/`global`), so it never sees the calling script's local variables. The node itself is fine
   throughout (confirmed via the creating script's own synchronous reads and the poll loop, which
   read through the original node reference, not the observer). This is a real Roku quirk/pitfall
   for app authors, not a simulator correctness gap — the engine doesn't need to reproduce it.

2. **`poster-xmlattr`/`animatedimage-xmlattr` (`uri` as an XML attribute on a child of a
   Task-created custom component, observed from that child's OWN `init()`): works completely
   normally on device.** Full, correct `m` (`m-count=3`, `has-p=true`/`has-a=true`, `has-top=true`),
   correct value progression (`init`→`first`→`decode`, matching the render-thread vocabulary
   exactly), correct observer count, nothing stuck.

**Conclusion**: engine finding #1 (`Field.deliverPendingConstructionCallbacks()` never draining on
Task threads) is a real, reachable divergence — the `xmlattr` shape is a common, idiomatic pattern
(a Task-owned wrapper component around a preloaded rendering node), and on device it just works.
The engine currently leaves it stuck forever instead. Fixed in
`src/extensions/scenegraph/index.ts`'s `tick()` — the Task branch now also calls
`Field.deliverPendingConstructionCallbacks()`.
