# Timer Control Probe

Determines what a real Roku reports in a `Timer` node's `control` field across its lifecycle, and
which writes to `control` stop a running Timer. The reference
(`REFERENCES/scenegraph/control-nodes/timer.md`) only lists `none`/`start`/`stop`; it says nothing
about what the field reads after a one-shot fire, whether rewriting the same value notifies, or what
`none` or an unknown value does to a running Timer.

## Run

Device (pack with `./pack.sh`, sideload the zip, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine baseline, committed alongside as `engine-trace.txt`:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/timer-control-probe
```

The run is ~7 s and self-terminates. The console replays a partial buffer on each reconnect, so
dedupe with `awk '!seen[$0]++'` and sort by sequence number; `device-trace.txt` is the cleaned capture
from a Roku Streaming Stick+ on OS 15.3.4.

## Output format

```
PROBE|<seq>|<case>|<key=value ...>
```

Every probed Timer observes both `fire` and `control`, so each `control` notification shows up as an
`<id>.onControl` record. Fire times (`at=`) are 100 ms buckets from the case's start.

## Cases and device findings

| Case | Question | Device |
| --- | --- | --- |
| `A` | One-shot: what does `control` read after the fire? Does the `if control <> "start"` restart guard run? | `"stop"`, notified **after** the fire observers (which still read `"start"`); the guard restarts it |
| `B` | One-shot set to `"start"` again after it fired | Fires again, then reads `"stop"` again |
| `C` | Repeating Timer | Keeps reading `"start"` |
| `D` | `"start"` written while running, 0.3 s into 0.5 s | Restarts the countdown (fires at 0.8 s); the same-value write still notifies |
| `E` | `"none"` written to a running Timer | Stops it (never fires); reads `"none"` |
| `F` | `"stop"` before start, an unknown value, `"START"` | `"stop"`; unknown reads `""`; uppercase starts it and reads `"start"` |
| `G` | One-shot restarted from its own fire observer | Keeps running (fires twice); no automatic `"stop"` in between |
| `H` | Unknown value written to a running Timer | Stops it (never fires); reads `""` |

Every write to `control` notifies observers, even when the value is unchanged (`D`, and `F`'s final
`stop` after the automatic one).
