---
name: brs-reference
description: Look up Roku's official BrightScript/SceneGraph spec in out/references/ when implementing, fixing, or verifying an interpreter feature — components (roXxx), interfaces (ifXxx), events, SceneGraph nodes, global functions, or language behavior. Use it to confirm exact method signatures, node field names/types/defaults/access, and event semantics so simulated behavior matches a real Roku device.
---

# brs-reference

`out/references/` is a local mirror of Roku's **official** BrightScript + SceneGraph
reference docs (HTML-flavored Markdown). It is the authoritative spec for *what the
behavior should be* — the brs-engine code is *how we simulate it*. Reach for this skill
whenever a task involves a missing, incomplete, or wrong-looking BrightScript/SceneGraph
feature, and before claiming a feature "matches Roku."

> `out/` is **gitignored** — this folder is a local convenience, not guaranteed present
> for every contributor or in CI. Use it for research only; never make build/runtime
> code depend on it. If the folder is absent, say so and fall back to
> <https://developer.roku.com/docs/references/> (or skip the lookup).

## When to use

- Implementing or fixing a `roXxx` component / `ifXxx` interface method.
- Adding or correcting a SceneGraph node (fields, defaults, behavior).
- Implementing a global function (Math/String/Utility/Runtime) or language feature.
- Verifying argument counts, types, return values, defaults, or event semantics.
- Checking whether an API is deprecated.

## Where things live (and where to implement them)

| Reference glob | Topic | Source to edit |
| --- | --- | --- |
| `out/references/brightscript/components/roXxx.md` | Component overview + supported interfaces/events | `src/core/brsTypes/components/RoXxx.ts` (register in `BrsObjects.ts`) |
| `out/references/brightscript/interfaces/ifXxx.md` | Method signatures, args, returns, defaults | methods on the component, grouped under the `ifXxx` key in `registerMethods` — **not** a standalone type (see "Interfaces are method grouping" below) |
| `out/references/brightscript/events/roXxxEvent.md` | Event objects from `roMessagePort` | the matching event component |
| `out/references/brightscript/language/*.md` | Statements, types, errors, `#if`, format strings, reserved words, global functions | `src/core/lexer/`, `parser/`, `preprocessor/`, `stdlib/` |
| `out/references/scenegraph/**/<node>.md` | SceneGraph node fields + behavior (by category) | `src/extensions/scenegraph/nodes/<Node>.ts` |
| `out/references/scenegraph/xml-elements/*.md`, `component-functions/*.md` | Component XML + `init`/`onKeyEvent` | `src/extensions/scenegraph/parser/`, `factory/` |
| `out/references/deprecated-apis.md` | Deprecated APIs — check before relying on one | n/a |

Filenames are lowercase, no spaces (e.g. `rovideoplayer.md`, `ifsgnodefield.md`,
`renderable-nodes/rectangle.md`). Files are HTML fragments: headings as `<h1..h3>`,
field/method tables as `<table>`, and code samples inside `<pre><code>`.

## How to look up

1. **Find the file.** Map the BrightScript name to a path with the table above. If unsure
   of the category for a SceneGraph node, search by filename:
   ```bash
   ls out/references/scenegraph/**/ | grep -i <node>
   find out/references -iname '*<name>*'
   ```
2. **Read it.** A component file lists its supported `ifXxx` interfaces — follow those to
   the `interfaces/` files for the actual method signatures. A node file's **Fields**
   table (Field / Type / Default / Access Permission / Description) is the spec for the
   node's fields; note that base-class fields are inherited and documented separately
   (the file says "Fields derived from the … base class can also be used").
3. **Grep across the corpus** when you don't know where a method/field is defined:
   ```bash
   grep -rin "getmessageport" out/references/brightscript/interfaces/
   grep -rl "itemComponentName" out/references/scenegraph/
   ```

## Applying it to the code

- **Match names/types/defaults/access exactly.** A node's `defaultFields` entries should
  mirror the reference Fields table (e.g. Rectangle's `width`/`height` are `float`
  default `0.0`, `color` is `color` default `0xFFFFFFFF`). Field `type` strings and
  default values in code should equal the doc's Type/Default columns.
- **Respect inheritance.** If the doc says a node `Extends Group`, the TS class should
  extend the matching base and `setExtendsType(name, SGNodeType.Group)` — only declare
  fields the doc adds beyond the base.
- **Interfaces drive method surfaces, but don't become types.** Use `ifXxx.md` to get the
  correct method names, arg order, optional args, and return types — then implement those
  methods on the **component** and register them under the `ifXxx` key in
  `registerMethods({ ifXxx: [...] })`. Do **not** create a new `ifXxx` class just because
  the docs list one. See "Interfaces are method grouping" below.
- **Cross-check before saying "done."** When verifying a fix, re-read the relevant
  reference and confirm signatures, defaults, and edge cases (and that the API isn't in
  `deprecated-apis.md`) actually agree with the implementation.

## Interfaces are method grouping, not separate types

The reference's `ifXxx` files describe Roku's interfaces, but this codebase does **not**
implement one type per interface. Follow the existing pattern:

- A component implements its methods (mostly **inline** on the class) and registers them
  with `registerMethods({ ifXxx: [callable, ...] })`. The `ifXxx` key is just a label that
  mirrors the docs — there is no `ifXxx` contract being satisfied.
  ```ts
  // RoVideoPlayer.ts — methods defined inline, grouped under interface-name keys
  this.registerMethods({
      ifVideoPlayer: [this.play, this.stop, this.setContentList, /* ... */],
      ifHttpAgent: [ifHttpAgent.addHeader, ifHttpAgent.setHeaders, /* ... */],
  });
  ```
- `src/core/brsTypes/interfaces/` holds only a **small, deliberate set** of shared helper
  classes (`IfArray`, `IfEnum`, `IfHttpAgent`, `IfList`, `IfMessagePort`, `IfSocket`,
  `IfToStr`, `IfDraw2D`, …) — abstract/shared method bundles that exist purely to **reduce
  duplication** when several components expose the same interface. Instantiate one with the
  owning component and spread its callables into `registerMethods`:
  ```ts
  const ifArray = new IfArray(this);
  this.registerMethods({ ifArray: [ifArray.peek, ifArray.pop, /* ... */] });
  ```
- **Decision rule when adding a method/interface to a component:**
  - Shared by multiple components → add it to (or reuse) a helper in `interfaces/`.
  - Specific to one component → define it inline on that component class.
  - Either way, register it under the matching `ifXxx` key. **Do not** add a new file in
    `interfaces/` just to mirror a documented interface that only one component uses.

## Wiring reminders (see CLAUDE.md for full detail)

- New component: implement `RoXxx.ts`, register it in
  `src/core/brsTypes/components/BrsObjects.ts`.
- New SceneGraph node: add to the `SGNodeType` enum in
  `src/extensions/scenegraph/nodes/index.ts`, create `nodes/<Node>.ts`, and wire it into
  `SGNodeFactory.createNode`'s switch in `factory/NodeFactory.ts`.
