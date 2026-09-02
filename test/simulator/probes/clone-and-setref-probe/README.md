# clone-and-setref-probe

> **SUPERSEDED — read `../clone-basetype-probe` first.** The "collapse to the base built-in type" rule
> stated below was a generalisation from a single `extends="Node"` component and is **wrong**. A device
> only degrades a clone when the component's ROOT built-in base is `Node`; over `Group`, `Label`,
> `ContentNode` or another custom component the clone keeps its subtype, fields and functions. The
> conclusions here about the main-vs-render thread (`setRef`/`getRef`/`canGetRef`) are still valid.

Measures the two deviations `node-container-copy-probe` left open:

1. **`clone()` of a custom component.** That probe's S8 found a device returning a clone whose XML
   interface field reads back `invalid` and whose `callFunc` returns `invalid`, while the engine keeps
   the fields. Only three lines were measured, and it was never isolated from `clone()` in general.
2. **`setRef`/`canGetRef`.** S10.6 found a device answering `canGetRef = false` for the **original**
   field, where the engine answers `true`.

## The hypothesis this is built to test

Both S8 and S10.6 ran from `source/Main.brs` — the **main thread**. `ifSGNodeField` says of `CanGetRef`:

> The **GetRef()** call will only succeed if is called **on the render thread** and the **SetRef()**
> function had previously been called on the **field_name**. … The **CanGetRef()** function **may only
> be called on the render thread**.

So a device answering `false` from `Main` may be entirely correct and have nothing to do with `setRef`.
The engine has no main/render split (both are thread 0), so it cannot reproduce that distinction.

The probe therefore runs **the same checks twice** — once on the main thread from `source/`, once on the
render thread via `scene.callFunc("runTests", …)` — and labels every line `[main]` or `[render]`. On the
engine the two traces are **identical**, so any line that differs on a device is a genuine
thread-context effect rather than a semantic one.

## What each block decides

| block | question |
| --- | --- |
| `C1` | Does a clone of a custom component keep its XML interface field (`C1.5`/`C1.6`), its `addField` field (`C1.8`/`C1.9`), its subtype (`C1.2`), and its functions (`C1.11`)? |
| `C2` | Control: a **built-in** `Label`. If `C2` keeps its fields but `C1` doesn't, the loss is specific to *custom components*, not to `clone()`. |
| `C3` | Control: a `ContentNode` + `addFields` — the shape in `test/e2e/resources/components/roUtils.brs`, whose device-derived snapshot shows fields **preserved**. If `C3` preserves and `C1` doesn't, the split is XML-interface vs dynamic fields. |
| `C4` | `canGetRef` right after `setRef` with **no external reference** (inline literal), whether `getRef` is really by reference (`C4.6`), and whether reading consumes it (`C4.5`). |
| `C5` | The competing theory: `canGetRef` means "no other reference exists". `C5.1` false + `C5.2` true would confirm it. |
| `C6` | Baselines — before any set, after a **normal** set, after `setRef`, and on a non-assocarray field. |
| `C7` | Reproduces S10.6 directly: `canGetRef` before a clone, after a clone, and on the clone. |

Read `C1.11` and `C4.3` first: if either flips between `[main]` and `[render]`, the earlier finding was
a thread artifact and the engine may be right.

## Running

Sideload this directory (a complete app) and capture the console. On the engine:

```bash
npm run build:cli && npm run build:sg
node ./packages/node/bin/brs.cli.js --root ./test/simulator/probes/clone-and-setref-probe
```

`source/probelib.brs` is a **generated copy** of `components/MainScene.brs` from `sub runCloneTests`
onward, so both threads run byte-identical checks (a component script cannot portably see `source/`
functions, so the probe duplicates rather than shares). After editing the component copy, regenerate:

```bash
python3 - <<'PY'
src = open('components/MainScene.brs').read()
body = src[src.index("sub runCloneTests(ctx as String)"):]
open('source/probelib.brs','w').write(
    "' GENERATED COPY of components/MainScene.brs -- see README.md\n" + body)
PY
```

## Engine output (both contexts identical — the control)

```
--- C1 [main]: clone() of a CUSTOM component ---
  C1.1  orig subtype                 = Agent
  C1.2  clone subtype                = Agent
  C1.3  clone isSubtype('Agent')     = true
  C1.4  orig hasField('marker') XML  = true
  C1.5  clone hasField('marker') XML = true
  C1.6  clone marker value           = orig-marker
  C1.7  orig hasField('dyn') added   = true
  C1.8  clone hasField('dyn')        = true
  C1.9  clone dyn value              = dyn-value
  C1.10 clone id                     = TheAgent
  C1.11 clone callFunc readToken     = UNSET
  C1.12 orig field count             = 6
  C1.13 clone field count            = 6
--- C2 [main]: clone() of a BUILT-IN node (control) ---
  C2.1  clone text (built-in field)  = hello
  C2.2  clone hasField('text')       = true
  C2.3  clone dyn (added field)      = lbl-dyn
--- C3 [main]: clone() of a ContentNode with addFields (control) ---
  C3.1  clone link                   = http://example.com
  C3.2  clone aa.name                = one
--- C4 [main]: setRef with NO external reference (inline literal) ---
  C4.1  addField assocarray          = true
  C4.2  field readable (f1.a)        = 1
  C4.3  canGetRef immediately        = true
  C4.4  getRef type                  = roAssociativeArray
  C4.5  canGetRef after getRef       = true
  C4.6  mutate getRef -> field       = 99
--- C5 [main]: setRef WITH an external reference held ---
  C5.1  canGetRef, source var alive  = true
  C5.2  canGetRef, source dropped    = true
--- C6 [main]: canGetRef in other states ---
  C6.1  canGetRef before any set     = false
  C6.2  canGetRef after NORMAL set   = false
  C6.3  canGetRef after setRef       = true
  C6.4  canGetRef on non-AA field    = false
--- C7 [main]: does clone() disturb canGetRef? (reproduces S10.6) ---
  C7.1  canGetRef before clone       = true
  C7.2  canGetRef after clone        = true
  C7.3  clone canGetRef              = true

(the [render] block is identical, line for line)
```

Note `C1.11 = UNSET`: the engine's clone has the fields but an **empty script scope**, because
`clone` is built by `createFlatNode`, which never runs `init()`. Whether that is right depends on what
a device answers for `C1.5`/`C1.11` on the render thread.

## Device output — run 1 (3810X, Roku OS 15.3): case 1 ANSWERED, case 2 crashed the probe

```
--- C1 [main]: clone() of a CUSTOM component ---
  C1.1  orig subtype                 = Agent
  C1.2  clone subtype                = Node
  C1.3  clone isSubtype('Agent')     = false
  C1.4  orig hasField('marker') XML  = true
  C1.5  clone hasField('marker') XML = false
  C1.6  clone marker value           = invalid
  C1.7  orig hasField('dyn') added   = true
  C1.8  clone hasField('dyn')        = false
  C1.9  clone dyn value              = invalid
  C1.10 clone id                     = TheAgent
  C1.11 clone callFunc readToken     = invalid
  C1.12 orig field count             = 6
  C1.13 clone field count            = 4
--- C2 [main]: clone() of a BUILT-IN node (control) ---
  C2.1  clone text (built-in field)  = hello
  C2.2  clone hasField('text')       = true
  C2.3  clone dyn (added field)      = lbl-dyn
--- C3 [main]: clone() of a ContentNode with addFields (control) ---
  C3.1  clone link                   = http://example.com
  C3.2  clone aa.name                = one
--- C4 [main]: setRef with NO external reference (inline literal) ---
  C4.1  addField assocarray          = true
  <CRASH> 'Dot' Operator attempted with invalid ... probelib.brs(54): n.f1.a
```

### Case 1 — ANSWERED: `clone()` of a custom component degrades to its BASE built-in type

A device returns a plain **`Node`** (C1.2), not an `Agent`: `isSubtype("Agent")` is false, both the XML
`<interface>` field and the `addField` field are **gone**, `callFunc` returns `invalid`, and the field
count drops 6 → **4** — exactly the base `Node` fields (`change`, `focusable`, `focusedChild`, `id`).
`id` survives only because it *is* a base field (C1.10).

The controls isolate it: cloning a **built-in** keeps everything, including dynamically added fields
(C2.1-C2.3 `hello`/`true`/`lbl-dyn`), and a `ContentNode` + `addFields` keeps its values (C3), which
independently agrees with the device-derived snapshot in `test/e2e/resources/components/roUtils.brs`.

So the rule is: **clone reconstructs the node as its base built-in type and carries only the fields that
type has.** For a built-in that is the node itself, so nothing is lost; for a custom component the
component-ness — interface fields, dynamic fields, script, script scope — is dropped.

Engine deviation: our clone keeps subtype `Agent`, all 6 fields, and a working `callFunc` (with an empty
`m`, hence `UNSET`).

### Case 2 — the crash IS the answer (mostly)

`setRef` is documented "This function may only be called on the render thread", same as `GetRef` and
`CanGetRef`. Called from `source/Main.brs` it fails, leaves the field unassigned, and `n.f1.a` throws —
which is what happened at C4.2 in the original probe. So **`node-container-copy-probe` S10.6's
`canGetRef = false` was correct device behaviour**, caused by the main-thread call site, not by `setRef`.

The engine has no main/render ScriptEngine split (both are thread 0), so it cannot reproduce the
restriction: it answers `setRef = true` / `canGetRef = true` from `Main`.

Still unmeasured, because the crash aborted the run: the whole `[render]` block. Run 2 (this probe now
guards every field dereference, records `setRef`'s return value, and wraps each block in `try/catch`)
should settle whether the render-thread numbers match the engine.

## Device output — run 2 (3810X, Roku OS 15.3): both cases ANSWERED

`[main]` block: every `setRef` returns **false** and the field is never assigned (`C4.3 = invalid`), so
every `canGetRef` is false. `[render]` block:

```
--- C4 [render]: setRef with NO external reference (inline literal) ---
  C4.1  addField assocarray          = true
  C4.2  setRef RETURN value          = true
  C4.3  field type after setRef      = roAssociativeArray
  C4.4  field value .a               = 1
  C4.5  canGetRef immediately        = true
  C4.6  getRef type                  = roAssociativeArray
  C4.7  canGetRef after getRef       = true
  C4.8  mutate getRef -> field .a    = 99
--- C5 [render]: setRef WITH an external reference held ---
  C5.1  setRef RETURN, var alive     = true
  C5.2  canGetRef, source var alive  = true
  C5.3  canGetRef, source dropped    = true
--- C6 [render]: canGetRef in other states ---
  C6.1  canGetRef before any set     = false
  C6.2  canGetRef after NORMAL set   = false
  C6.3  setRef RETURN over normal    = true
  C6.4  canGetRef after setRef       = true
  C6.5  setRef RETURN on non-AA fld  = false
  C6.6  canGetRef on non-AA field    = false
--- C7 [render]: does clone() disturb canGetRef? ---
  C7.1  setRef RETURN                = true
  C7.2  canGetRef before clone       = true
  C7.3  canGetRef after clone        = true
  C7.4  clone canGetRef              = true
```

C1/C2/C3 are **identical** in both contexts and identical to run 1.

### Case 2 — CLOSED, the engine's `setRef` semantics are correct

Every render-thread line matches the engine **line for line** — including the non-obvious ones: a normal
assignment does not make a field ref-gettable (`C6.2` false), `setRef` over an already-normally-set field
works (`C6.3`), `setRef` on a non-assocarray field fails (`C6.5`), `getRef` is genuinely by reference
(`C4.8` = 99), and reading does not consume it (`C4.7`).

The competing theory is **disproved**: `canGetRef` is `true` with an external reference to the source AA
still alive (`C5.2`), so it does not mean "no other reference exists". It means exactly what the spec
says — `setRef` was called on this field, and the caller is on the render thread.

So `node-container-copy-probe` S10.6's `canGetRef = false` was correct device behaviour and my probe's
fault: it called a render-thread-only API from `source/Main.brs`. **No `setRef` change needed.**

The remaining difference is structural: `SetRef`/`GetRef`/`CanGetRef` are documented render-thread-only,
and a device refuses them from the main thread (returning false), while the engine — which runs `source/`
and the render tree on one thread — accepts them. Recorded in `docs/limitations.md`; it is a property of
the missing main/render ScriptEngine split, not of these APIs.

### Case 1 — CLOSED, a real engine deviation, thread-independent

`clone()` of a **custom component** returns a plain node of its **base built-in type**:

| | device | engine |
| --- | --- | --- |
| `subtype()` | `Node` | `Agent` |
| `isSubtype("Agent")` | false | true |
| `hasField("marker")` (XML interface) | false | true |
| `hasField("dyn")` (`addField`) | false | true |
| `callFunc("readToken")` | invalid | `UNSET` |
| field count | **4** (6 → 4) | 6 |

4 is exactly the base `Node` field set — `id`, `focusable`, `focusedChild`, `change` (see `Node.defaultFields`).
`id` survives only because it *is* a base field. The controls isolate the cause: cloning a **built-in**
keeps everything including `addField` fields (`C2`), and `ContentNode` + `addFields` keeps its values
(`C3`, independently matching the device-derived `roUtils.brs` snapshot).

**Rule: clone reconstructs the node as its base built-in type and carries only that type's fields** —
dropping the component layer entirely (interface fields, dynamic fields, script, script scope).

Not yet implemented; see "Fixing case 1" below.

## Fixing case 1

The engine change is small — `Node.cloneNode` already knows the base type (`this.nodeType` is derived
from the subtype via `getNodeType`), so it becomes `createFlatNode(this.nodeType, this.nodeType)` plus
copying only the fields a fresh base node has. Two things make it more than a one-liner:

1. **`test/cli/resources/clone-callfunc-app` asserts the opposite.** It clones a custom component
   extending `ContentNode` and expects `cloned.subtype()` = `MyData` and `cloned.callFunc("readTop")` to
   work — all three of which a device answers differently. Its stated purpose is to exercise the
   *cross-thread rebuild* path ("clone() exercises it single-threaded"), which only coincidentally shares
   `createFlatNode`. That premise no longer holds, so the test has to be re-pointed at a real Task
   round-trip instead of `clone()`.
2. **One sub-question is unmeasured**: for a component extending `Group` rather than `Node`, does a device
   clone report `Group` or `Node`? The engine's `nodeType` yields the immediate built-in base (`Group`),
   which is the likely answer but was not measured — this probe only covers an `extends="Node"` component.
