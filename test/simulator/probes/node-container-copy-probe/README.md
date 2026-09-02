# node-container-copy-probe

Establishes, against a real device, **how a copy interacts with a SceneGraph node** across the four
paths that can produce one, and **what `roUtils.IsSameObject` actually compares**:

1. reading an `assocarray` node field (`Node.get` → `RoAssociativeArray.deepCopy`);
2. reading an `array` node field (`RoArray.deepCopy`);
3. `roUtils.DeepCopy` — on the node itself, and on a container holding one;
4. `roSGNode.clone()`, as the known-good "real duplicate" reference point.

## Why it exists

A component stashed in an AA field and read back used to come out of the engine as a
`createFlatNode` **clone**. A clone never runs `init()`, so its `m` holds only `top`/`global`, and the
first `callFunc` through it read every cached entry back as `invalid`:

```
pkg:/components/<Agent>.brs(NNN): Invalid value for left-side of expression.
```

A device run of `test/cli/resources/aa-field-node-ref-app` confirmed the behaviour that matters — a
component read back out of an `assocarray` field, an `array` field, or `roUtils.DeepCopy` **still
answers with its cached script scope**. That is now what the engine does.

The same run reported `IsSameObject = false` on all three paths while the node behaved like the
original, which the small fixture could not explain. Hence this probe.

## The two questions, and which lines decide them

**Q-A — what does `IsSameObject` compare for an `roSGNode`?**

`S2` is decisive. It compares nodes obtained through retrievals that involve **no container copy at
all**: a `node`-typed field read, `getField`, `findNode`, `getChild`, `getParent`.

- If `S2` is mostly `false` → a device mints a fresh BrightScript handle per retrieval, `IsSameObject`
  compares handles, and its `false` in the container paths says **nothing** about duplication. The only
  engine gap would be `IsSameObject` reporting.
- If `S2` is `true` but the container paths are `false` → a container copy really does produce a
  distinct object.

`S1` brackets it with copy-free baselines (`S1.8` is the case the ifUtils docs state is `true`).

**Q-B — does a container copy duplicate the node?**

Behaviour, not identity. A write through the copy either reaches the original or it does not:

| decides | line |
| --- | --- |
| `assocarray` field | `S4.6` (field write), `S4.7` (callFunc state), `S4.8` (`addField` seen?) |
| `array` field | `S5.5`, `S5.6` |
| `DeepCopy(node)` | `S6.8`, `S6.9` |
| `DeepCopy({node})` | `S7.9`, `S7.10` |
| `clone()` reference | `S8.9` — must show `orig-marker` |

`S3` separately pins container semantics with no node involved: whether **setting** an AA field copies
(`S3.1`), whether **reading** it copies (`S3.2`), and whether that copy is deep (`S3.3`).

`S11`/`S12` — **ANSWERED**: when an `assocarray`/`array` is assigned to a node field, a member the copy
cannot copy is **dropped**, and a cycle is **preserved**.

- `S11.5`-`S11.9` — a function reference, `roDateTime`, `roByteArray`, `roMessagePort`, `roDeviceInfo`.
  `invalid` means a field assignment **drops** them, exactly as `roUtils.DeepCopy` does; the real type
  means it **carries** them. `S11.2`-`S11.4` are controls that must survive, and `S11.14`-`S11.16` run
  `roUtils.DeepCopy` over the identical shape so the two policies sit side by side in one trace.
- `S11.10`-`S11.13` — the same through an `array` field.
- `S12` — a back-pointer (`parent.child.parent`). Does a device preserve the cycle (`S12.5` = `c`),
  break it, or refuse the assignment?

Device result (3810X / OS 15.3): a field assignment **drops** them, byte-for-byte the same policy as
`roUtils.DeepCopy` — `S11.5`-`S11.9` all `invalid`, matching `S11.14`/`S11.15`; the AA came back with **3
of 8** members. So there is one policy, not two, and the `dropUncopyable` flag an earlier pass added was
unnecessary and has been removed. The conservative "carry them instead" guess was wrong: an app that puts
a callback in a node field loses it on hardware, so the simulator has to lose it too.

Two details only a side-by-side trace shows:

- An **associative array drops the key** (member count falls), while an **array keeps the slot and stores
  `invalid`** (`Count()` unchanged — `S11.10` is 3 in, 3 out). The engine now does both.
- A node is the single non-copyable that is **carried**, on every path (`S11.4`, `S11.16`, `S7.2`).

`S12`: the cycle is preserved (`S12.5` = `c`) and the assignment does not fail, so the `visited` guard in
both `deepCopy`s is device-correct — without it a back-pointer overflowed the JS stack on assignment.

`S9`/`S10` cover the two paths that a first pass missed and that still route a node through
`Node.deepCopy` (i.e. still hand back a scope-less `createFlatNode` copy in the engine):
`moveIntoField`/`moveFromField` (`S9.4`, `S9.7`, `S9.8`) and a `clone(true)`'s **node-valued field**
(`S10.4`, `S10.5`). `S10.6`/`S10.7` additionally check that a clone keeps a field's by-ref flag.

## Running

On a device: sideload this directory (it is a complete app — `manifest`, `source/`, `components/`) and
capture the console. On the engine:

```bash
npm run build:cli && npm run build:sg
node ./packages/node/bin/brs.cli.js --root ./test/simulator/probes/node-container-copy-probe
```

## Engine output (post-fix, for diffing)

```
[env] model=8000X os=15.3
--- S1: IsSameObject baselines (no copy involved) ---
  S1.1  node: same variable twice      = true
  S1.2  node: aliased variable         = true
  S1.3  node: passed as function arg   = true
  S1.4  node: plain AA entry twice     = true
  S1.5  node: plain AA two entries     = true
  S1.6  node: plain array elem twice   = true
  S1.7  node: plain array two elems    = true
  S1.8  AA:   plain AA two entries     = true
  S1.9  roDateTime: same variable      = true
  S1.10 roDateTime: plain AA entries   = true
--- S2: IsSameObject on plain node retrievals (NO container copy) ---
  S2.1  node FIELD read vs original    = true
  S2.2  node FIELD read twice          = true
  S2.3  getField(node) vs original     = true
  S2.4  findNode twice                 = true
  S2.5  findNode vs original           = true
  S2.6  getChild twice                 = true
  S2.7  getChild vs original           = true
  S2.8  getParent twice                = true
  S2.9  getParent vs scene             = true
  S2.10 isSameNode: field read         = true
--- S3: assocarray field container copy semantics (no nodes) ---
  S3.1  mutate SOURCE after set        = orig
  S3.2  mutate READ-BACK, re-read      = orig
  S3.3  mutate nested AA, re-read      = orig-n
--- S4: node inside an assocarray field ---
  S4.1  IsSameObject vs original       = true
  S4.2  isSameNode vs original         = true
  S4.3  two entries of ONE read        = true
  S4.4  two separate reads             = true
  S4.5  callFunc readToken through it  = s4-token
  S4.6  FIELD write -> original.marker = via-aa-field
  S4.7  callFunc write -> orig token   = via-aa-field
  S4.8  addField on orig, fresh read   = added-late
  S4.9  orig childCount                = 1
  S4.10 stale copy childCount          = 1
  S4.11 fresh copy childCount          = 1
--- S5: node inside an array field ---
  S5.1  IsSameObject vs original       = true
  S5.2  isSameNode vs original         = true
  S5.3  two elements of ONE read       = true
  S5.4  callFunc readToken through it  = s5-token
  S5.5  FIELD write -> original.marker = via-array-field
  S5.6  callFunc write -> orig token   = via-array-field
--- S6: roUtils.DeepCopy(<the node itself>) ---
  S6.1  returned type                  = roSGNode
  S6.2  IsSameObject vs original       = true
  S6.3  isSameNode vs original         = true
  S6.4  callFunc readToken             = s6-token
  S6.5  marker field                   = orig-marker
  S6.6  id field                       = S6Agent
  S6.7  childCount (orig has 1)        = 1
  S6.8  FIELD write -> original.marker = via-deepcopy-node
  S6.9  callFunc write -> orig token   = via-deepcopy-node
--- S7: roUtils.DeepCopy({ node, nested AA, non-copyables }) ---
  S7.1  returned type                  = roAssociativeArray
  S7.2  member 'agent' type            = roSGNode
  S7.3  member 'dev' type              = invalid
  S7.4  member 'when' type             = invalid
  S7.5  member 'when' IsSameObject     = n/a
  S7.6  node IsSameObject vs original  = true
  S7.7  node isSameNode vs original    = true
  S7.8  callFunc readToken through it  = s7-token
  S7.9  FIELD write -> orig.marker     = via-deepcopy-aa
  S7.10 callFunc write -> orig token   = via-deepcopy-aa
  S7.11 mutate copy nested -> orig     = orig-n
--- S8: node.clone() for comparison ---
  S8.1  clone(false) type              = roSGNode
  S8.2  clone(false) IsSameObject      = false
  S8.3  clone(false) isSameNode        = false
  S8.4  clone(false) readToken         = invalid
  S8.5  clone(false) marker            = invalid
  S8.6  clone(false) childCount        = 0
  S8.7  clone(true) readToken          = invalid
  S8.8  clone(true) childCount         = 1
  S8.9  clone FIELD write -> orig      = orig-marker
--- S9: moveIntoField / moveFromField holding a node ---
  S9.1  moveIntoField return          = 1
  S9.2  source emptied (count)        = 0
  S9.3  member 'agent' type           = roSGNode
  S9.4  callFunc readToken through it  = s9-token
  S9.5  isSameNode vs original        = true
  S9.6  IsSameObject vs original      = true
  S9.7  FIELD write -> orig.marker    = via-moveintofield
  S9.8  callFunc write -> orig token  = via-moveintofield
  S9.9  moveFromField member type     = roSGNode
  S9.10 moveFromField readToken       = via-moveintofield
  S9.11 field cleared after move      = invalid
--- S10: clone(true) and its node-valued field ---
  S10.1 clone.kid type                = roSGNode
  S10.2 clone.kid isSameNode vs kid   = true
  S10.3 clone.kid IsSameObject vs kid = true
  S10.4 clone.kid readToken           = s10-token
  S10.5 write -> original kid.marker  = via-clone-nodefield
  S10.6 orig canGetRef('refField')    = true
  S10.7 clone canGetRef('refField')   = true
--- S11: uncopyable members through an assocarray FIELD ---
  S11.1  member count (src has 8)    = 3
  S11.2  s      string   (control)   = roString
  S11.3  nested AA       (control)   = roAssociativeArray
  S11.4  node   roSGNode (known ok)  = roSGNode
  S11.5  fn     function reference   = invalid
  S11.6  when   roDateTime           = invalid
  S11.7  ba     roByteArray          = invalid
  S11.8  port   roMessagePort        = invalid
  S11.9  dev    roDeviceInfo         = invalid
--- S11b: the same question through an ARRAY field ---
  S11.10 array count (src has 3)     = 3
  S11.11 array[0] function reference = invalid
  S11.12 array[1] roDateTime         = invalid
  S11.13 array[2] string  (control)  = roString
--- S11c: roUtils.DeepCopy on the SAME shape, side by side ---
  S11.14 DeepCopy fn                 = invalid
  S11.15 DeepCopy when               = invalid
  S11.16 DeepCopy node               = roSGNode
--- S12: a CYCLIC container assigned to a node field ---
  S12.1  assign survived             = true
  S12.2  r.name                      = p
  S12.3  r.child                     = roAssociativeArray
  S12.4  r.child.parent              = roAssociativeArray
  S12.5  cycle closed -> name        = c
```

## Device output (3810X, Roku OS 15.3)

```
--- S1: IsSameObject baselines (no copy involved) ---
  S1.1  node: same variable twice      = true
  S1.2  node: aliased variable         = true
  S1.3  node: passed as function arg   = true
  S1.4  node: plain AA entry twice     = true
  S1.5  node: plain AA two entries     = true
  S1.6  node: plain array elem twice   = true
  S1.7  node: plain array two elems    = true
  S1.8  AA:   plain AA two entries     = true
  S1.9  roDateTime: same variable      = true
  S1.10 roDateTime: plain AA entries   = true
--- S2: IsSameObject on plain node retrievals (NO container copy) ---
  S2.1  node FIELD read vs original    = false
  S2.2  node FIELD read twice          = false
  S2.3  getField(node) vs original     = false
  S2.4  findNode twice                 = false
  S2.5  findNode vs original           = false
  S2.6  getChild twice                 = false
  S2.7  getChild vs original           = false
  S2.8  getParent twice                = false
  S2.9  getParent vs scene             = false
  S2.10 isSameNode: field read         = true
--- S3: assocarray field container copy semantics (no nodes) ---
  S3.1  mutate SOURCE after set        = orig
  S3.2  mutate READ-BACK, re-read      = orig
  S3.3  mutate nested AA, re-read      = orig-n
--- S4: node inside an assocarray field ---
  S4.1  IsSameObject vs original       = false
  S4.2  isSameNode vs original         = true
  S4.3  two entries of ONE read        = true
  S4.4  two separate reads             = false
  S4.5  callFunc readToken through it  = s4-token
  S4.6  FIELD write -> original.marker = via-aa-field
  S4.7  callFunc write -> orig token   = via-aa-field
  S4.8  addField on orig, fresh read   = added-late
  S4.9  orig childCount                = 1
  S4.10 stale copy childCount          = 1
  S4.11 fresh copy childCount          = 1
--- S5: node inside an array field ---
  S5.1  IsSameObject vs original       = false
  S5.2  isSameNode vs original         = true
  S5.3  two elements of ONE read       = false
  S5.4  callFunc readToken through it  = s5-token
  S5.5  FIELD write -> original.marker = via-array-field
  S5.6  callFunc write -> orig token   = via-array-field
--- S6: roUtils.DeepCopy(<the node itself>) ---
  S6.1  returned type                  = roSGNode
  S6.2  IsSameObject vs original       = false
  S6.3  isSameNode vs original         = true
  S6.4  callFunc readToken             = s6-token
  S6.5  marker field                   = orig-marker
  S6.6  id field                       = S6Agent
  S6.7  childCount (orig has 1)        = 1
  S6.8  FIELD write -> original.marker = via-deepcopy-node
  S6.9  callFunc write -> orig token   = via-deepcopy-node
--- S7: roUtils.DeepCopy({ node, nested AA, non-copyables }) ---
  S7.1  returned type                  = roAssociativeArray
  S7.2  member 'agent' type            = roSGNode
  S7.3  member 'dev' type              = invalid
  S7.4  member 'when' type             = invalid
  S7.5  member 'when' IsSameObject     = n/a
  S7.6  node IsSameObject vs original  = false
  S7.7  node isSameNode vs original    = true
  S7.8  callFunc readToken through it  = s7-token
  S7.9  FIELD write -> orig.marker     = via-deepcopy-aa
  S7.10 callFunc write -> orig token   = via-deepcopy-aa
  S7.11 mutate copy nested -> orig     = orig-n
--- S8: node.clone() for comparison ---
  S8.1  clone(false) type              = roSGNode
  S8.2  clone(false) IsSameObject      = false
  S8.3  clone(false) isSameNode        = false
  S8.4  clone(false) readToken         = invalid
  S8.5  clone(false) marker            = invalid
  S8.6  clone(false) childCount        = 0
  S8.7  clone(true) readToken          = invalid
  S8.8  clone(true) childCount         = 1
  S8.9  clone FIELD write -> orig      = orig-marker
--- S9: moveIntoField / moveFromField holding a node ---
  S9.1  moveIntoField return          = 1
  S9.2  source emptied (count)        = 0
  S9.3  member 'agent' type           = roSGNode
  S9.4  callFunc readToken through it  = s9-token
  S9.5  isSameNode vs original        = true
  S9.6  IsSameObject vs original      = false
  S9.7  FIELD write -> orig.marker    = via-moveintofield
  S9.8  callFunc write -> orig token  = via-moveintofield
  S9.9  moveFromField member type     = roSGNode
  S9.10 moveFromField readToken       = via-moveintofield
  S9.11 field cleared after move      = invalid
--- S10: clone(true) and its node-valued field ---
  S10.1 clone.kid type                = roSGNode
  S10.2 clone.kid isSameNode vs kid   = true
  S10.3 clone.kid IsSameObject vs kid = false
  S10.4 clone.kid readToken           = s10-token
  S10.5 write -> original kid.marker  = via-clone-nodefield
  S10.6 orig canGetRef('refField')    = false
  S10.7 clone canGetRef('refField')   = false
--- S11: uncopyable members through an assocarray FIELD ---
  S11.1  member count (src has 8)    = 3
  S11.2  s      string   (control)   = roString
  S11.3  nested AA       (control)   = roAssociativeArray
  S11.4  node   roSGNode (known ok)  = roSGNode
  S11.5  fn     function reference   = invalid
  S11.6  when   roDateTime           = invalid
  S11.7  ba     roByteArray          = invalid
  S11.8  port   roMessagePort        = invalid
  S11.9  dev    roDeviceInfo         = invalid
--- S11b: the same question through an ARRAY field ---
  S11.10 array count (src has 3)     = 3
  S11.11 array[0] function reference = invalid
  S11.12 array[1] roDateTime         = invalid
  S11.13 array[2] string  (control)  = roString
--- S11c: roUtils.DeepCopy on the SAME shape, side by side ---
  S11.14 DeepCopy fn                 = invalid
  S11.15 DeepCopy when               = invalid
  S11.16 DeepCopy node               = roSGNode
--- S12: a CYCLIC container assigned to a node field ---
  S12.1  assign survived             = true
  S12.2  r.name                      = p
  S12.3  r.child                     = roAssociativeArray
  S12.4  r.child.parent              = roAssociativeArray
  S12.5  cycle closed -> name        = c
```

## Verdicts

### Q-A: `IsSameObject` compares the BrightScript HANDLE, not the node

S1 is all `true` (variable, alias, function argument, plain AA/array entries) while **S2 is all
`false`** — so every retrieval that crosses the SceneGraph boundary (`node`-field read, `getField`,
`findNode`, `getChild`, `getParent`) mints a fresh handle for the same underlying node. A returned
value does too: `IsSameObject(node, roUtils.DeepCopy(node))` is `false` even though `DeepCopy` hands
the same node back (S6.2 with S6.4/S6.8/S6.9).

Consequences:

- **`IsSameObject` cannot detect node duplication.** For nodes it is `false` in almost every real
  shape. `isSameNode` is the identity API, and it matches the engine on every probe line.
- **Engine deviation, not fixed.** The engine answers `true` whenever the two values are the same
  node. Matching the device needs a per-retrieval handle object; one JS instance per node is
  load-bearing here for `isSameNode`, the focus chain and the address-keyed cross-thread registry.
  The three affected lines are marked inline in the `components/roUtils.brs` expectation in
  `test/e2e/BrsComponents.test.js`. Note the handle rule is not expressible at the call site either —
  `IsSameObject(node, copy)` compares two plain locals and still answers `false`.

### Q-B: no copy path ever duplicates the node

Writes through the value reach the original on **every** path — `assocarray` field (S4.6/S4.7/S4.8),
`array` field (S5.5/S5.6), `DeepCopy({node})` (S7.9/S7.10) and `DeepCopy(node)` itself
(S6.8/S6.9) — and the script scope is intact everywhere (`s4-token`/`s5-token`/`s6-token`/`s7-token`).
`clone()` duplicates only the node's own field storage and its CHILDREN: S8.9 leaves the original's
non-node field alone, while S10.2/S10.4/S10.5 show a clone's **node-valued field points at the same
node**. `moveIntoField` carries the node over too (S9.4/S9.7/S9.8/S9.10).

Fixed accordingly:

- `RoAssociativeArray.deepCopy`/`RoArray.deepCopy` carry a nested node over as-is.
- `roUtils.DeepCopy(<a node>)` returns **that node** — an `roSGNode` is not copyable.
- `Field.setValue` copies an assigned `assocarray`/`array` (unless `byRef`), so S3.1 now matches too.
- `Node.moveObjectIntoField` carries a node over instead of duplicating it.
- `Node.cloneNode` keeps node-valued fields pointing at the same node, and gives every field its own
  `Field` instance (via `Field.copyWith`) so a write through the clone cannot reach the original.
- **`Node.deepCopy` was deleted.** Once no copy path duplicates a node, the primitive that produced a
  `createFlatNode` copy with an empty script scope had no callers left — the whole class of bug this
  probe chased is now unrepresentable.

### Both former open items are now MEASURED — see `../clone-and-setref-probe`

1. **`S8.4`/`S8.5`/`S8.7` — `clone()` of a custom component.** Answered and **fixed**, but not by the rule
   this probe first suggested: `../clone-basetype-probe` showed a device degrades the clone **only when the
   component's ROOT built-in base is `Node`** (which `S8`'s `Agent extends Node` happens to be). Over
   `Group`, `Label`, `ContentNode` or another custom component the clone keeps its subtype, fields and
   functions. Thread-independent. Implemented as `bareClone` in `Node.cloneNode`.
2. **`S10.6`/`S10.7` — `setRef`/`canGetRef`.** Answered, and **not** an engine bug: `SetRef`/`GetRef`/
   `CanGetRef` are documented render-thread-only, and S10.6 called them from `source/Main.brs`. On the
   render thread every line matches the engine exactly. The `canGetRef = false` here was correct device
   behaviour and a flaw in this probe's call site, so the `clone-field-copy-app` assertions of
   `canGetRef = true` are valid for the engine's single-threaded model.
