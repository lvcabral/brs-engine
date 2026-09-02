# detached-agent-probe

Reproduces the "detached agent component" pattern that third-party instrumentation SDKs use, and
which several engine paths have to get right at once:

- a custom component that **extends `Node`** (not `Group`), created from **module scope** with
  `CreateObject("roSGNode", …)` and **never appended to the Scene**;
- its XML `<children>` interleave `Timer`s and custom **`Task`** children (child order matters — a
  failure creating child *n* silently drops every later sibling, so only the *later* `findNode()`
  misses);
- everything is configured through `callFunc`, and the public init caches `findNode()` results in the
  component's script scope (`m`);
- the Task children reach back into the owning component with `m.top.getParent()` and `callFunc`,
  i.e. a **task → render rendezvous** onto a node that is in neither the Scene nor `m.global`;
- finally, the agent handle is stashed **inside an `assocarray` / `array` field** and read back —
  the way apps keep service handles on a node — and `callFunc`'d through that read-back value.

## What it pinned

The last step was the failing one. Reading an `assocarray`/`array` node field returns a copy of the
container (`Node.get` → `RoAssociativeArray/RoArray.deepCopy`), and that copy used to **clone every
SceneGraph node inside it**. A clone is built by `createFlatNode`, which never runs `init()`, so its
`m` holds only `top`/`global`. Calling a public function on it therefore read every cached entry back
as `invalid`:

```
pkg:/components/Agent.brs(54,19-27): Invalid value for left-side of expression.
```

Fixed by making a container copy carry a nested node over unchanged — including `roUtils.DeepCopy`,
which a device also leaves the node alone in. Regression test: "Keeps a component's script scope intact
when it is read back out of an assocarray/array field or roUtils.DeepCopy" in
`test/cli/cli-scenegraph.test.js` (`test/cli/resources/aa-field-node-ref-app`). The copy/identity
semantics themselves are measured in `test/simulator/probes/node-container-copy-probe`, which
supersedes this probe on that question.

The earlier steps all passed **before** the fix too, and are kept because they are the parts that are
easy to break:

- `findNode()` from a detached component root resolves its own subtree (`hasComponentAncestor()` is
  true for a custom-component root, so the self-search applies).
- A Task's `m.top.getParent()` resolves, and a `callFunc` on that parent rendezvouses to the render
  thread and runs against the render-side `m` — with three Task threads doing it concurrently and
  repeatedly.
- A main-thread `callFunc` after all that still sees the same `m`.

## Running

```bash
npm run build:cli && npm run build:sg
node ./packages/node/bin/brs.cli.js --root ./test/simulator/probes/detached-agent-probe
```

Expected: every `[PROBE]` line reports a real value, `agentSetIntervalPrimary ok duration=…` prints
for each of steps 2, 4, 5 and 6, and the run ends with `--- done ---` and `EXIT_USER_NAV`. Any
`invalid`, `Dot' Operator`, or `Invalid value for left-side` line is a regression.
