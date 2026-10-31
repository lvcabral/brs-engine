# Alias Component Scope Probe (issue #1254)

Checks which node an interface field `alias="<id>.<field>"` and `findNode(<id>)` resolve when the id is
reused inside a sibling custom component's **internal** (XML `<children>`) nodes. `Child` has an internal
`Poster id="child"` and `Label id="innerOnly"`.

Run: `./pack.sh`, sideload the zip, capture the 8085 console (see `device-trace.txt`).
Engine: `brs-cli alias-component-scope-probe.zip` (see `engine-trace.txt`, which now matches the device; the
"Engine before" column is master `b75bf0aa`, before the fix).

| Case | Layout | Device (Roku Express 4K+, OS 16.0.4) | Engine before |
| --- | --- | --- | --- |
| `issue.*` | `<Child id="other"/>` then `<Group><Child id="child"/></Group>` (both "child" at depth 2) | alias binds to `Child#child`; `findNode("child")` → `Child` | alias fails; `findNode` → internal `Poster` |
| `deeper.*` | internal "child" at depth 2, real `Child id="child"` at depth 3 | alias + `findNode` → the depth-3 `Child` | alias fails; `findNode` → internal `Poster` |
| `internalOnly.*` | only match is inside `Child`'s internals | alias binds to the internal `Label`; `findNode` finds internal nodes | same |
| `parentChildren.*` | `<Child id="wrap"><Label id="outerLbl"/></Child>` | alias + `findNode` find `outerLbl` | same |
| `dynamic.*` | runtime-appended `Child` (and a Label appended into it) | `findNode` finds the internal `Poster`/`Label` and the appended Label | same |
| `clone.*` | deep `clone(true)` of a `Child` inserted first, real `Child id="child"` at depth 3 | `findNode` → the depth-3 `Child`; clone internals still findable | same (after the clone-ownership fix) |

Conclusion: a device first searches the component's own descendants **without** descending into nested
components' internal children, at any depth; only when that finds nothing does it look inside those
internals. Breadth-first order alone is not enough — `deeper.*` shows a deeper own-scope node beats a
shallower internal one. The engine models this in `Node.findNodeById` with `Node.componentOwner`, set by
`NodeFactory.addChildren` on every node a component's XML `<children>` creates.
