# Type Legacy Probe

Compares what `type()` / `type(x, 3)` report for primitives stored in, read from, and copied between
containers, on a real Roku vs. brs-engine. It reruns the cases already pinned by
`test/e2e/resources/stdlib/type-legacy.brs` plus the ones raised in the PR #1259 review:

| Section | What it checks |
| --- | --- |
| `baseline` | The existing `type-legacy.brs` cases (literal vs. computed values in arrays/AAs, variable keeps its type after being stored). |
| `sharedSingletons` | Storing `invalid` or a boolean in a container must not change `type()` of other `invalid`/boolean values. |
| `builtArrays` | Arrays built by the runtime (`ParseJson`, `Slice`, `Items`, `Split`, `Tokenize`, `Keys`, `Push`, `Append`) vs. `[...]` literals. |
| `sharedAcrossContainers` | One value read from an AA and stored in two containers, then one container copied to a node field. |
| `lists` | `roList` `AddTail`/`AddHead`/index set. |
| `xmlLists` | `roXMLList` `AddHead` order, index set and `Push`. |
| `nodes` | `ButtonGroup.buttons` set directly and grown by appending a `Button` child. |
| `storePaths` | Every way of storing a computed/literal/JSON number, boolean and `invalid` (AA assign, index set, `Push`, `Unshift`, `AddTail`, `AddHead`). |
| `boxedStringArgs` | `Keys()`/`Split()` items (`roString`) passed back to `ReadMulti`, `Read`, `GetAttributes()[…]` and AA indexes. |

## Run

Device: `./pack.sh`, sideload `type-legacy-probe.zip`, capture `telnet <roku-ip> 8085`, keep the `PROBE|` lines
as `device-trace.txt`.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/type-legacy-probe
```

Output format: `PROBE|<case>|<values...>`. Engine baseline is `engine-trace.txt`.

## Results (Streaming Stick, OS 15.3.4, 2026-10-21)

`device-trace.txt` is the device capture and `engine-trace.txt` the engine output; they match line for line
except the two open cases below. The rule the device follows:

| How the value gets into the container | Numbers and booleans | `invalid` | Strings |
| --- | --- | --- | --- |
| Literal (`[x]`, `{k: x}`), `Push`, `Unshift`, `AddTail`, `AddHead`, any AA assignment or `AddReplace` | `roInteger`, `roBoolean`, … | `roInvalid` in an array or list, `Invalid` in an AA | literal `roString`, computed `String` |
| Index assignment (`a[i] = x`, `l[i] = x`, `SetEntry`) | `Integer`, `Boolean`, … | `Invalid` | same as above |
| Built by the runtime (`ParseJson`), copied (`Slice`, `Items`, `Append`) | keeps what the value reported | keeps | keeps |

The variable a value came from always keeps its own type, and storing `invalid` or a boolean never changes
what other `invalid`/boolean values report. `Split`, `Tokenize`, `roRegex.Split` and `Keys` return boxed
`roString` items (`roString` for both `type()` forms).

`roXMLList.AddHead` adds at the head.

`Keys()`/`Split()` items work wherever a string is taken (`ReadMulti`, `Read`, AA indexes).

Open (both also differ on master):

- `xml-index`: indexing an `roXMLElement` by a string (`xml["title"]` or `xml[names[0]]`) is a runtime error
  on the device (`&he7`, 231); the engine returns the named child elements.
- `bg-child`: appending a `Button` child to a `ButtonGroup` does not grow its `buttons` field on the
device (count stays 2); the engine adds the button text (count 3).

`test/e2e/resources/stdlib/type-legacy-store.brs` pins the non-SceneGraph cases against the device output.
