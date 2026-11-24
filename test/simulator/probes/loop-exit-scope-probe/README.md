# loop-exit-scope-probe

Checks where `exit for`, `continue for`, `exit while` and `continue while` may appear. A compile
error stops a whole app, so each case under `cases/` is its own app (listed in `cases.txt`).

## Results

Device: Roku Express 4K+, OS 16.0 (`device-trace-os16.0.txt`). Engine: `engine-trace.txt`.
The two traces are identical.

- The check is per loop **kind**, not the nearest loop: `exit for`/`continue for` need some
  enclosing `for` or `for each`, and `exit while`/`continue while` need some enclosing `while`.
  An outer loop of the right kind is enough (`exitfor-in-while-in-for` leaves the outer `for`).
- A function body starts outside any loop, even an anonymous function declared inside one
  (`exitfor-in-anon-fn`).
- Otherwise the app fails to compile, at the statement's line:

| Statement | Error |
| --- | --- |
| `exit for` | `Exit For is not inside a For loop. (compile error &ha5)` |
| `continue for` | `Continue For is not inside a For loop (compile error &h8d)` |
| `exit while` | `Exit While is not inside a While. (compile error &haf)` |
| `continue while` | `Continue While is not inside a While (compile error &h8e)` |

Before this check, the engine accepted these statements and, when one ran, the `BlockEnd` it
threw left the function: it crashed with `Return must return a value` or silently returned.

## Running

```sh
ROKU_IP=<ip> ROKU_PASS=<password> ./run-device.sh   # writes device-trace.txt
./run-engine.sh                                     # writes engine-trace.txt (brs-cli on PATH)
```
