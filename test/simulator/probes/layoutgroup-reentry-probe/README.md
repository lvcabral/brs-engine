# layoutgroup-reentry-probe

When a LayoutGroup child observes its own `translation` and calls `boundingRect()` on the group from
that observer, when does the observer run, what does it see, and where do the children end up?
(Issue #1349.)

Each case builds one LayoutGroup of three children (`R` = 100x40 Rectangle, `W` = 80x40 `Watcher`,
`itemSpacings=[20]`), appends it at `[600,400]`, waits, and prints the settled layout. A `Watcher`
observes its own `translation` and prints its translation, every sibling's translation, and (in
`measure`/`ancestor`/`respace`/`append` mode) the rect a `boundingRect()` query returns plus the
siblings after it. `respace` sets the group's `itemSpacings` to `[30]` before querying; `append`
appends a 100x40 Rectangle (`k3`) on the first call before querying.

| Case | Layout | Kids | Observer query |
| --- | --- | --- | --- |
| c1 | horiz, left | RWR | `lg.boundingRect()` |
| c2 | horiz, left | RWR | none (log only) |
| c3 | horiz, center | WRR | `lg.boundingRect()` |
| c4 | vert, top | RWR | `lg.boundingRect()` |
| c5 | horiz, left, inside a Group | RWR | `wrap.boundingRect()` |
| c6 | horiz, left | RWW | `lg.boundingRect()` |
| c7 | horiz, right | WWR | `lg.boundingRect()` |
| c8 | horiz, left, inside a Group | RWW | `wrap.boundingRect()` |
| c9 | horiz, left | RWR | `itemSpacings = [30]`, then `lg.boundingRect()` |
| c10 | horiz, center | WRR | `itemSpacings = [30]`, then `lg.boundingRect()` |
| c11 | horiz, left | RWR | append `k3`, then `lg.boundingRect()` |
| c12 | vert, top | WRR | append `k3` (never runs: the first child doesn't move) |

## Device result (Roku Express 4K+, OS 16.1, `device-trace.txt`)

- The observer runs **while the group is placing its children**: the siblings after the watcher are
  still at `[0,0]` (`before:`), so the write fires the observer inline.
- A `boundingRect()` from there (on the group or an ancestor) **lays the group out again** and returns
  the finished rect, and the later siblings are placed when it returns (`after:`). With two watchers the
  second one's observer runs inside the first one's query and gets the finished rect as well (c6-c8).
- The interrupted layout then **carries on from its own running offset**, with the sizes it measured
  and the start offset it computed before the write, reading `itemSpacings` live. When nothing changed
  (c1-c8, c11) that rewrites the same positions. When the observer changed the spacing (c9, c10) the
  remaining gaps use the new value and the earlier ones the old, and the group stays that way (c9 settles
  with gaps 30/20 and k2 at 230, not the 260 a fresh layout gives; c10 with gaps 40/30). A child the
  observer appended (c11) is placed by the nested layout only.
- With two watchers (c6-c8) the device then calls the observers a few more times with the watcher's
  translation momentarily `[0,0]` (two cycles of three calls), and every query there still returns the
  finished rect. The engine doesn't replicate these extra calls.

## Engine

Before the fix, the interrupted `applyLayout` resumed by adding deltas measured before the nested
pass to translations that pass had already rewritten, and the nested pass measured cached rects that
predated the interrupted pass's writes: c6 put k1 at 240, c7 settled with k2 on top of k1
(group width 200), the second watcher's query returned a half-built rect (`{0,0,680,440}`,
`{600,400,0,0}`), and c6/c8 re-laid out on every frame (~70 observer calls in one second).
`engine-trace.txt` (after the fix) matches the device trace apart from the device line and the extra
`[0,0]` calls above.

## Run

```sh
ROKU_IP=<roku-ip> ROKU_PASS=<pw> ./run-device.sh   # writes device-trace.txt
./run-engine.sh                                    # npm-linked brs-cli; writes engine-trace.txt
```

The regression test is "lays a LayoutGroup out again from a child's translation observer, as the
device does" in `test/cli/cli-scenegraph.test.js` (`layoutgroup-reentry-app`, a copy of
this probe with shorter case timers).
