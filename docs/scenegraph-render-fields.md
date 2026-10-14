# SceneGraph render fields that are declared but not implemented

Four fields on `Group`/`Rectangle` are declared so apps can read and write them without error, but the
renderer never consults them. Each appears exactly once in `src/` — its declaration. Writing one today
is silently a no-op.

| Field | Declared | Node | Documented default | Engine behaves as |
| --- | --- | --- | --- | --- |
| `childRenderOrder` | `nodes/Group.ts` | Group (inherited by all) | `renderLast` | permanently `renderFirst` |
| `inheritParentTransform` | `nodes/Group.ts` | Group (inherited by all) | `true` | permanently `true` |
| `inheritParentOpacity` | `nodes/Group.ts` | Group (inherited by all) | `true` | permanently `true` |
| `blendingEnabled` | `nodes/Rectangle.ts` | Rectangle | `true` | permanently `true` |

This note records what each one means, what implementing it would touch, and — for the two where the
reference and observed behavior disagree — **what has to be measured on hardware before writing any
code**. It is deliberately a plan, not a change: the most valuable of these cannot be implemented
correctly from the documentation alone.

Related: [`scenegraph-layout-passes.md`](scenegraph-layout-passes.md) for the layout/paint split, and
`.claude/docs/scenegraph-invariants.md` for the `renderNode`/`renderNodeContent` template contract that
any change here has to fit inside.

---

## 1. `childRenderOrder` — blocked on a device probe

### What the reference says

`REFERENCES/scenegraph/layout-group-nodes/group.md:97-102`, default **`renderLast`**:

> `"renderFirst"` — any drawing done by this node will be done **before** the node children are rendered
> `"renderLast"` — any drawing done by this node will be done **after** the node children are rendered

### What the engine does

Every self-drawing node hard-codes draw-then-children, i.e. permanent `renderFirst` — the *opposite* of
the documented default. `Rectangle.renderNodeContent` fills, then calls `renderChildren`; `Poster` draws
its bitmap, then children; the same shape in `Label`, `SimpleLabel`, `MultiStyleLabel`, `ScrollableText`,
`Scene` (canvas clear + background), `ArrayGrid` (`renderContent` before `renderChildren`), `Video`,
`TrickPlayBar`, `BusySpinner`, `Overhang` — roughly 12-15 node types.

### Why this is not a straightforward fix

Taking the documented default literally would make a `Rectangle`'s own fill paint **over** its children.
That would break the `Rectangle > Label` idiom used everywhere — a filled panel with text on it — which
demonstrably works on real devices. So one of these is true, and the docs cannot tell us which:

1. the default is `renderLast` but "drawing done by this node" excludes the background fill of a
   renderable node, meaning it applies only to some narrower notion of node-owned drawing;
2. the documented default is wrong, and hardware actually behaves as `renderFirst`;
3. the field only has an observable effect on certain node types.

**Probe before implementing.** The measurement is visual and unambiguous:

- A `Rectangle` (opaque, distinctive color) with a `Label` child, at each `childRenderOrder` value and
  with the field untouched. Is the label visible? Screenshot each.
- The same with `Poster > Label`, and a `Group > Rectangle` (a node that draws nothing of its own) to
  find out whether the field is inert there.
- Write a bogus value (`"renderMiddle"`) and read it back — the other Group enums (`layoutDirection`,
  `horizAlignment`) *reject* invalid values to `""` and that rejected state has its own geometry, so the
  same question has to be asked here (see the enum invariants in `.claude/docs/scenegraph-invariants.md`).

Until that runs, **do not** implement the documented default. Note that this is exactly the class of
change that has regressed before: the `layoutDirection` "obvious long form" aliases were implemented
from the docs and turned out to be backwards on hardware.

### Implementation sketch (once the probe answers)

The `renderNode` template on `Group` is already the single entry point, so ordering can be inverted in
one place rather than in 15 node bodies — but only if the self-drawing part is separated from the
child traversal. Today they are interleaved inside each `renderNodeContent`. The realistic shape is a
further hook split (`paintSelf` / `renderChildren`) applied to the self-drawing types, with the template
choosing the order. That is a larger refactor than the `clippingRect` one and should not be attempted
until the probe justifies it.

---

## 2. `inheritParentTransform` — implementable, with a caveat

### What the reference says

`group.md:104-110`, default `true`:

> If true, the node overall transformation is determined by combining the accumulated transformation
> matrix of all of its ancestors in the SceneGraph with the node local 2D transformation matrix described
> by its translation, rotation, scale and scaleRotateCenter fields. If false, the accumulated
> transformation of all of its ancestors in the SceneGraph is ignored and only the node local
> transformation matrix is used. **This causes the node to be transformed relative to the root of the
> SceneGraph** (that is, the Scene component)

### What the engine does

The parent-space `origin` is always added in, unconditionally. Since the `clippingRect` work, every node
composes its draw translation through one method — `Group.getDrawTranslation(origin, angle)` — so the
`false` branch has exactly one place to live:

```ts
// inheritParentTransform = false: ignore the accumulated ancestor transform entirely and position
// relative to the Scene root, i.e. drawTrans = the node's own translation.
```

### What else has to move

Positioning is only half of it. With the ancestor transform ignored, the node's reported rects have to
follow:

- `Group.updateBoundingRects` / `updateParentRects` compute `rectToParent` and `rectToScene` from the
  same accumulated origin. `rectToScene` becomes the node's own translation; `rectToParent` has to
  express the node's position **relative to a parent it is no longer positioned by**, which needs a
  decision (probe: what does `boundingRect()` report for a non-inheriting child of a translated parent?).
- The rotation half (`angle`) is accumulated separately and passed down; it must be dropped too.
- Interaction with the pruned layout refresh: `Group.skipSettledLayout` keys on the incoming
  `(origin, angle, opacity)` context. A non-inheriting node's output does not depend on `origin`/`angle`,
  so it may legitimately skip where it currently would not — an optimization, not a correctness issue,
  but the context key should be documented as still sound.

**Probe first** (cheap, programmatic — no screenshots): a `Group` translated to `[100, 50]` containing a
child with `inheritParentTransform = false` and its own translation `[10, 10]`. Read the child's
`boundingRect()` and `sceneBoundingRect()`. Expected under the doc: scene-space `[10, 10]`. Also check
what `boundingRect()` (parent-relative) reports, which the doc does not specify.

---

## 3. `inheritParentOpacity` — the simplest of the four

### What the reference says

`group.md:111-116`, default `true`:

> If true, the node opacity is determined by multiplying opacity attribute of the node by the opacity of
> the parent node, which may have been determined by multiplying the opacity of its ancestor nodes. If
> false, the node opacity is determined by the opacity attribute set for the node or the default opacity
> attribute value

### What the engine does

`Group.renderNodeContent` accumulates unconditionally:

```ts
opacity = this.isVisible() ? opacity * this.getOpacity() : 0;
```

and each renderable node repeats the multiply. With `inheritParentOpacity = false` the node would use
`this.getOpacity()` alone and pass *that* down to its own children.

### What to watch

- The **invisible** case must keep propagating 0. The visibility rule is separate from opacity
  inheritance: an invisible ancestor still hides a non-inheriting descendant (verify on device — the doc
  is silent, and it is the one place the two could plausibly be conflated).
- `updateRenderTracking` treats `opacity === 0` as not-rendered; that gate reads the accumulated value
  and stays correct either way.
- Like item 2, the accumulation is spread across every `renderNodeContent`. Centralizing it into the
  `renderNode` template would make this a one-line change, but that hoist is itself a behavior-visible
  refactor (each node type gates visibility differently) and should be a separate, measured step.

---

## 4. `Rectangle.blendingEnabled` — needs a compositing path first

### What the reference says

`REFERENCES/scenegraph/renderable-nodes/rectangle.md:64`, default `true`:

> Specifies if the rectangle should be alpha blended with the nodes that are behind it

### What the engine does

`Rectangle.renderNodeContent` always calls `draw2D.doDrawRotatedRect(rect, color, rotation, center,
opacity)`, and `IfDraw2D` always composites with the canvas default (`source-over`), honoring both the
color's alpha byte and the accumulated node opacity.

### Why it is not local to `Rectangle.ts`

`blendingEnabled = false` means "write these pixels, ignore what is behind" — a source-copy. `IfDraw2D`
has no `globalCompositeOperation` handling at all today, so this needs a new capability on the drawing
interface (`src/core/brsTypes/interfaces/IfDraw2D.ts`), not just a branch in the node. Open questions the
doc does not answer, all cheap to probe visually:

- With blending off, is the color's **alpha byte** written verbatim (so a 50%-alpha fill produces a
  half-transparent region punched through the background), or forced opaque?
- Does the **node's `opacity` field** still apply, or is it also bypassed?
- Does it affect the rectangle's **children**, or only its own fill?

Lowest value of the four: one node type, one draw call, and no known app depends on it. Worth doing only
alongside other `IfDraw2D` compositing work.

---

## Suggested order

1. **`inheritParentOpacity`** — smallest surface, clearest spec, cheap programmatic probe.
2. **`inheritParentTransform`** — one positioning site thanks to `getDrawTranslation`, but the reported
   rects need a decision that only a device can settle.
3. **`childRenderOrder`** — highest app impact, but blocked on a probe *and* a hook split; do not start
   from the documentation alone.
4. **`blendingEnabled`** — lowest value, and gated on adding a compositing path to `IfDraw2D`.

Items 1-3 share one probe channel: a scene of small fixtures reading `boundingRect()`/`sceneBoundingRect()`
and printing them, plus a handful of screenshots for the ordering and blending questions. Building that
probe is the actual next step for this document, not writing renderer code.
