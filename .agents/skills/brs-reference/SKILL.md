---
name: brs-reference
description: Look up Roku's official BrightScript/SceneGraph spec in the external/dev-doc submodule (docs/REFERENCES/) when implementing, fixing, or verifying an interpreter feature — components (roXxx), interfaces (ifXxx), events, SceneGraph nodes, global functions, or language behavior. Use it to confirm exact method signatures, node field names/types/defaults/access, and event semantics so simulated behavior matches a real Roku device.
---

# brs-reference

Roku's **official**, open-sourced BrightScript + SceneGraph reference docs are vendored as
a git submodule ([rokudev/dev-doc](https://github.com/rokudev/dev-doc), branch `v2.0`) at
`external/dev-doc`. The reference pages live under **`external/dev-doc/docs/REFERENCES/`**
(Markdown with YAML frontmatter). They are the authoritative spec for *what the behavior
should be* — the brs-engine code is *how we simulate it*. Reach for this skill whenever a
task involves a missing, incomplete, or wrong-looking BrightScript/SceneGraph feature, and
before claiming a feature "matches Roku."

In this skill `$REF` means `external/dev-doc/docs/REFERENCES`.

> The submodule must be initialized: if `$REF` is empty/missing, run
> `git submodule update --init external/dev-doc`. It is **reference only** — never make
> build/runtime code depend on it. If it still can't be fetched, say so and fall back to
> <https://developer.roku.com/docs/references/> (or skip the lookup).

## When to use

- Implementing or fixing a `roXxx` component / `ifXxx` interface method.
- Adding or correcting a SceneGraph node (fields, defaults, behavior).
- Implementing a global function (Math/String/Utility/Runtime) or language feature.
- Verifying argument counts, types, return values, defaults, or event semantics.
- Checking whether an API is deprecated.

## Where things live (and where to implement them)

All paths below are relative to `$REF` (= `external/dev-doc/docs/REFERENCES`).

| Reference glob | Topic | Source to edit |
| --- | --- | --- |
| `$REF/brightscript/components/roXxx.md` | Component overview + supported interfaces/events | `src/core/brsTypes/components/RoXxx.ts` (register in `BrsObjects.ts`) |
| `$REF/brightscript/interfaces/ifXxx.md` | Method signatures, args, returns, defaults | methods on the component, grouped under the `ifXxx` key in `registerMethods` — **not** a standalone type (see "Interfaces are method grouping" below) |
| `$REF/brightscript/events/roXxxEvent.md` | Event objects from `roMessagePort` | the matching event component |
| `$REF/brightscript/language/*.md` | Statements, types, errors, `#if`, format strings, reserved words, global functions | `src/core/lexer/`, `parser/`, `preprocessor/`, `stdlib/` |
| `$REF/scenegraph/**/<node>.md` | SceneGraph node fields + behavior (by category) | `src/extensions/scenegraph/nodes/<Node>.ts` |
| `$REF/scenegraph/xml-elements/*.md`, `component-functions/*.md` | Component XML + `init`/`onKeyEvent` | `src/extensions/scenegraph/parser/`, `factory/` |
| `$REF/deprecated-apis.md` | Deprecated APIs — check before relying on one | n/a |

Filenames are lowercase, no spaces (e.g. `rovideoplayer.md`, `ifsgnodefield.md`,
`renderable-nodes/rectangle.md`). Files are Markdown: a YAML frontmatter block
(`title`, `excerpt`, …) at the top, `##` headings, GitHub-style pipe tables for fields/
methods, fenced or double-backtick code samples, and cross-links written as
`[label](doc:slug)` (the slug is the target file's basename without `.md`).

## How to look up

1. **Find the file.** Map the BrightScript name to a path with the table above. If unsure
   of the category for a SceneGraph node, search by filename:
   ```bash
   REF=external/dev-doc/docs/REFERENCES
   find "$REF/scenegraph" -iname '*<node>*'
   find "$REF" -iname '*<name>*'
   ```
2. **Read it.** A component file lists its supported `ifXxx` interfaces (as `[ifXxx](doc:ifxxx)`
   links) — follow those to the `interfaces/` files for the actual method signatures. A node
   file's **Fields** table (Field / Type / Default / Access Permission / Description) is the
   spec for the node's fields; note that base-class fields are inherited and documented
   separately (the file says "Fields derived from the … base class can also be used").
3. **Grep across the corpus** when you don't know where a method/field is defined:
   ```bash
   grep -rin "getmessageport" "$REF/brightscript/interfaces/"
   grep -rl "itemComponentName" "$REF/scenegraph/"
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

## Wiring reminders (see AGENTS.md for full detail)

- New component: implement `RoXxx.ts`, register it in
  `src/core/brsTypes/components/BrsObjects.ts`.
- New SceneGraph node: add to the `SGNodeType` enum in
  `src/extensions/scenegraph/nodes/index.ts`, create `nodes/<Node>.ts`, and wire it into
  `SGNodeFactory.createNode`'s switch in `factory/NodeFactory.ts`.
