# clone-basetype-probe

Settles the last sub-question behind the **`clone()` of a custom component** deviation, so the fix can be
implemented against measured behaviour rather than an assumption.

## What is already known

`clone-and-setref-probe` established on a device (3810X / OS 15.3, **identical on the main and render
threads**, so this is not thread-sensitive) that cloning a custom component `extends="Node"` returns a
plain node: `subtype()` = `Node`, `isSubtype(<component>)` = false, the XML `<interface>` field and an
`addField` field both **gone**, `callFunc` = `invalid`, field count 6 → **4** (exactly `Node`'s
`id`/`focusable`/`focusedChild`/`change`). Cloning a **built-in** node loses nothing.

## What this probe adds

That result cannot distinguish two rules, and they need different implementations:

- **(a)** clone always collapses to the root `Node`;
- **(b)** clone collapses to the component's own **built-in base** — `Group` for `extends="Group"`,
  `Label` for `extends="Label"`, and so on.

| block | component | question |
| --- | --- | --- |
| `D0` | `NodeAgent extends Node` | Control: reproduces the earlier result inside this probe. |
| `D1` | `GroupAgent extends Group` | (a) vs (b). `D1.4` = `Node` ⇒ (a); = `Group` ⇒ (b). |
| `D2` | `LabelAgent extends Label` | Same, over a deeper built-in. |
| `D3` | `DataAgent extends ContentNode` | Same, and it is the exact shape `test/cli/resources/clone-callfunc-app` uses. |
| `D4` | `DerivedAgent extends GroupAgent` | Custom extending **custom**: does it collapse to the built-in `Group`, or stop at the intermediate `GroupAgent`? |
| `D5` | — | Do base-field **values** carry over, or reset to the base type's defaults? Only `id` was known to survive, and `id` could just as well have been re-set. |
| `D6` | — | Does a clone get the component's XML `<children>`? |

Each `Dn` block prints a **fresh instance of the base type** alongside (`.3`) next to the clone's field
count (`.5`). Comparing those two *within the device's own trace* is the robust test — it does not depend
on the engine and the device agreeing on how many fields a `Group` has.

## Why each answer matters for the fix

- `.4` picks the type `cloneNode` should construct. The engine already has it: `Node.nodeType` is derived
  from the subtype via `getNodeType`, and resolves to the immediate built-in base — i.e. rule **(b)**.
- `.3` vs `.5` says whether to copy *only the fields a fresh base node has* or to filter some other way.
- `D5` says whether to copy those fields' **values** or leave the base defaults.
- `D6` says whether the `isDeepCopy` child walk should run before or after the collapse.
- `D3` decides how `clone-callfunc-app` has to be rewritten: it currently asserts `cloned.subtype()` =
  `MyData` and a working `cloned.callFunc(...)`, using `clone()` as a stand-in for the cross-thread
  rebuild path. If `D3.4` is `ContentNode`, that premise is wrong and the test must be re-pointed at a
  real Task round-trip.

## Running

Sideload this directory (a complete app) and capture the console. On the engine:

```bash
npm run build:cli && npm run build:sg
node ./packages/node/bin/brs.cli.js --root ./test/simulator/probes/clone-basetype-probe
```

## Verdict — only `extends="Node"` degrades

The earlier generalisation from a single `extends="Node"` data point was **wrong**. Neither rule (a) nor
(b) holds:

| | `D0` `extends Node` | `D1`-`D4` Group / Label / ContentNode / custom-extends-custom |
| --- | --- | --- |
| clone `subtype()` | **`Node`** | unchanged (`GroupAgent`, `LabelAgent`, `DataAgent`, `DerivedAgent`) |
| `isSubtype(<component>)` | **false** | true |
| field count | 6 → **4** | unchanged (20→20, 40→40, 6→6, 21→21) |
| `hasField(<declared>)` / `hasField(dyn)` | **false** | true |
| `callFunc` | **invalid** | **`UNSET`** |

So a device drops the component layer **only when the built-in base is exactly `Node`**. Over any other
base — including another custom component (`D4`) — the clone keeps its subtype, its `<interface>` and
`addField` fields, and a resolvable `callFunc` that reads an **empty script scope** (`UNSET`, because
`init()` is not re-run) — which is exactly what the engine already did. No reason for the asymmetry is
documented anywhere; it is a quirk, and it is encoded as one.

`D5`: base-field **values** carry over (`11`/`22`/`0.5`/`false`, not the defaults).
`D6`: `clone(false)` gets no children, `clone(true)` gets all 3 including the XML `<children>`, and
`findNode` still resolves them. Unmeasured: children of a *bare* (`extends="Node"`) clone — the engine
keeps copying them.

Two things this settled that mattered elsewhere:

- **`test/cli/resources/clone-callfunc-app` is correct as written.** It clones `MyData extends ContentNode`
  and expects the subtype preserved and `callFunc` working; `D3` confirms a device does that. The feared
  rewrite is unnecessary.
- The fix is one condition in `Node.cloneNode` (`nodeType === Node` **and** the subtype is a registered
  component), not a general "collapse to base type" rewrite. Regression: the `bare clone …` lines of
  `clone-field-copy-app` in `test/cli/cli-scenegraph.test.js`.

## Engine output (post-fix — D0 now matches; D1-D4 were already correct)

```
[env] model=8000X os=15.3
[note] clone of a custom component is thread-independent (proven in clone-and-setref-probe),
[note] so this runs on the main thread only.
--- D0: clone(NodeAgent extends Node) ---
  D0.1  orig subtype                = NodeAgent
  D0.2  orig field count            = 6
  D0.3  FRESH Node field count = 4
  D0.4  clone subtype               = Node
  D0.5  clone field count           = 4
  D0.6  clone isSubtype(Node)    = true
  D0.7  clone isSubtype(NodeAgent) = false
  D0.8  clone hasField(marker)   = false
  D0.9  clone hasField(dyn)         = false
  D0.10 clone id (a base field)     = D0-id
  D0.11 clone callFunc readToken    = invalid
--- D1: clone(GroupAgent extends Group) ---
  D1.1  orig subtype                = GroupAgent
  D1.2  orig field count            = 20
  D1.3  FRESH Group field count = 18
  D1.4  clone subtype               = GroupAgent
  D1.5  clone field count           = 20
  D1.6  clone isSubtype(Group)    = true
  D1.7  clone isSubtype(GroupAgent) = true
  D1.8  clone hasField(marker)   = true
  D1.9  clone hasField(dyn)         = true
  D1.10 clone id (a base field)     = D1-id
  D1.11 clone callFunc readToken    = UNSET
--- D2: clone(LabelAgent extends Label) ---
  D2.1  orig subtype                = LabelAgent
  D2.2  orig field count            = 37
  D2.3  FRESH Label field count = 35
  D2.4  clone subtype               = LabelAgent
  D2.5  clone field count           = 37
  D2.6  clone isSubtype(Label)    = true
  D2.7  clone isSubtype(LabelAgent) = true
  D2.8  clone hasField(marker)   = true
  D2.9  clone hasField(dyn)         = true
  D2.10 clone id (a base field)     = D2-id
  D2.11 clone callFunc readToken    = UNSET
--- D3: clone(DataAgent extends ContentNode) ---
  D3.1  orig subtype                = DataAgent
  D3.2  orig field count            = 6
  D3.3  FRESH ContentNode field count = 4
  D3.4  clone subtype               = DataAgent
  D3.5  clone field count           = 6
  D3.6  clone isSubtype(ContentNode)    = true
  D3.7  clone isSubtype(DataAgent) = true
  D3.8  clone hasField(marker)   = true
  D3.9  clone hasField(dyn)         = true
  D3.10 clone id (a base field)     = D3-id
  D3.11 clone callFunc readToken    = UNSET
--- D4: clone(DerivedAgent extends Group) ---
  D4.1  orig subtype                = DerivedAgent
  D4.2  orig field count            = 21
  D4.3  FRESH Group field count = 18
  D4.4  clone subtype               = DerivedAgent
  D4.5  clone field count           = 21
  D4.6  clone isSubtype(Group)    = true
  D4.7  clone isSubtype(DerivedAgent) = true
  D4.8  clone hasField(derivedMarker)   = true
  D4.9  clone hasField(dyn)         = true
  D4.10 clone id (a base field)     = D4-id
  D4.11 clone callFunc readToken    = UNSET
--- D5: do base-field VALUES carry, or reset to the base type's defaults? ---
  D5.1  clone id                     = D5-id
  D5.2  clone translation[0]         = 11
  D5.3  clone translation[1]         = 22
  D5.4  clone opacity                = 0.5
  D5.5  clone visible                = false
--- D6: does a clone get the component's XML <children>? ---
  D6.1  orig childCount              = 2
  D6.2  orig childCount after append = 3
  D6.3  clone(false) childCount      = 0
  D6.4  clone(true) childCount       = 3
  D6.5  clone(true) subtype          = GroupAgent
  D6.6  clone(true) findNode xmlKid1 = Rectangle
```

One unrelated difference remains visible: `D2.3`/`D2.5` report 35/37 here against the device's 38/40 —
our `Label` simply has three fewer fields than a real one. That is a field-inventory gap, not a clone
issue, and `.3` vs `.5` (the comparison this probe is built on) agrees in both traces.

## Device output (3810X, Roku OS 15.3)

```
--- D0: clone(NodeAgent extends Node) ---
  D0.1  orig subtype                = NodeAgent
  D0.2  orig field count            = 6
  D0.3  FRESH Node field count = 4
  D0.4  clone subtype               = Node
  D0.5  clone field count           = 4
  D0.6  clone isSubtype(Node)    = true
  D0.7  clone isSubtype(NodeAgent) = false
  D0.8  clone hasField(marker)   = false
  D0.9  clone hasField(dyn)         = false
  D0.10 clone id (a base field)     = D0-id
  D0.11 clone callFunc readToken    = invalid
--- D1: clone(GroupAgent extends Group) ---
  D1.4  clone subtype               = GroupAgent
  D1.5  clone field count           = 20   (orig 20, fresh Group 18)
  D1.7  clone isSubtype(GroupAgent) = true
  D1.8  clone hasField(marker)   = true
  D1.9  clone hasField(dyn)         = true
  D1.11 clone callFunc readToken    = UNSET
--- D2: clone(LabelAgent extends Label) ---
  D2.4  clone subtype               = LabelAgent
  D2.5  clone field count           = 40   (orig 40, fresh Label 38)
  D2.8/D2.9 hasField marker/dyn     = true/true
  D2.11 clone callFunc readToken    = UNSET
--- D3: clone(DataAgent extends ContentNode) ---
  D3.4  clone subtype               = DataAgent
  D3.5  clone field count           = 6    (orig 6, fresh ContentNode 4)
  D3.8/D3.9 hasField marker/dyn     = true/true
  D3.11 clone callFunc readToken    = UNSET
--- D4: clone(DerivedAgent extends GroupAgent) ---
  D4.4  clone subtype               = DerivedAgent
  D4.5  clone field count           = 21   (orig 21, fresh Group 18)
  D4.8/D4.9 hasField derivedMarker/dyn = true/true
  D4.11 clone callFunc readToken    = UNSET
--- D5 ---
  D5.1-D5.5 = D5-id / 11 / 22 / 0.5 / false
--- D6 ---
  D6.1=2  D6.2=3  D6.3=0  D6.4=3  D6.5=GroupAgent  D6.6=Rectangle
```
