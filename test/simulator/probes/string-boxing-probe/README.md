# String Boxing Probe

Determines exactly which boundary a computed (non-literal) BrightScript string must cross before
`type()` reports it as a permanently-boxed `"roString"`, instead of the plain `"String"` (with
`type(v, 3)` reporting `"roString"`) that a bare local variable or array element shows.

## Why

jellyfin-roku crashes in the brs-engine simulator (but not on a real Roku) inside
`components/data/SceneManager.brs` `optionDialog()`:

```brightscript
if isStringEqual(type(buttons[0]), "rostring")
    dialog.buttons = buttons
else
    for each playlist in buttons : objectTitles.push(playlist.title) : end for   ' crashes here
end if
```

`buttons` is built in `components/music/AlbumView.bs` `openMorePopup()`:

```brightscript
m.favoritesOptionText = m.top.isFavorite ? tr("Remove From Favorites") : tr("Add To Favorites")
dialogData.push(m.favoritesOptionText)
dialogData.push(tr("Add To Playlist"))
m.global.sceneManager.callFunc("optionDialog", "libraryitem", ..., dialogData, paramData)
```

On a real Roku, `type(buttons[0])` reports `"roString"` (the dialog renders correctly - only possible
if the `if` branch runs). In brs-engine it reports `"String"`, so the `else` branch runs and crashes on
`playlist.title` (a plain String has no such member).

A real-device run of `test/e2e/resources/stdlib/type-legacy.brs` already ruled out the simplest
hypothesis: a non-literal string pushed into a **plain local `roArray`** (no `m`, no node) reports
`"String"` on real hardware too - identical to brs-engine. So the promotion to `"roString"` happens
somewhere between building `dialogData` and the `type()` check inside `optionDialog`, not from plain
array-push boxing.

Separately, source inspection of `src/extensions/scenegraph/nodes/Node.ts` found that reading **any**
`roArray`/`roAssociativeArray`-typed **node field** (`node.someField`) unconditionally calls
`RoArray.deepCopy(true)`, which `.box()`es every string element - a real, existing mechanism, same-thread
included. The open question is whether `dialogData` (or `m.favoritesOptionText`) ever crosses a node
field on real hardware the same way it would need to for that mechanism to fire - or whether something
else entirely (e.g. how `m.xxx` for an *undeclared* property behaves inside a component script) is
responsible.

## Cases

Every case builds a fresh non-literal string (`ucase("probe string")`, standing in for `tr()`'s
runtime-computed return) and reports `type()` / `type(,3)` / the value for the first array element (or
the string itself) after it crosses the boundary under test.

| Case | What it tests |
| --- | --- |
| `control` | Plain local array + plain local function call. Baseline: no `m`, no node crossing at all. |
| `m-scope-roundtrip` | Array built from an **undeclared** `m.xxx` script-scope property, read back locally (no callFunc yet). Mirrors `m.favoritesOptionText = tr(...) : dialogData.push(m.favoritesOptionText)` in isolation. |
| `callfunc-plain` | Plain array (no `m.` step) crossed via `callFunc` to a sibling, non-Task node. |
| `callfunc-mscope` | **The exact `AlbumView.openMorePopup` shape**: `m.`-scope property, pushed, then crossed via `callFunc`. |
| `field-custom-array` | A declared XML `type="array"` interface field, set then read back (no `callFunc`). |
| `field-dialog-buttons` | The built-in `Dialog` node's own `"buttons"` field - the exact field `SceneManager.brs` assigns - set then read back. |
| `global-field-array` | An `m.global`-added array-typed field, set then read back. |
| `global-field-str-then-array` | An `m.global` **scalar string** field, set/read, then pushed into a brand-new local array. |
| `callfunc-task` | Plain array crossed via `callFunc` to a genuine `Task` (real cross-thread rendezvous). |
| `tr-hit-raw` / `tr-miss-raw` | `type()` of `tr("Hit Key")` / `tr("Miss Key Not In Table")` directly, no array, no `callFunc`. |
| `tr-hit-plain` / `tr-miss-plain` | The `tr()` result pushed into a local array, no `callFunc`. |
| `tr-hit-callfunc` / `tr-miss-callfunc` | The `tr()` result pushed into an array crossed via `callFunc` - the exact `AlbumView` shape, using the real `tr()` global instead of the `ucase()` stand-in. |

The probe ships its own `locale/en_US/translations.ts` with exactly one entry (`"Hit Key"` ->
`"Translated Value"`), so `tr("Hit Key")` is a guaranteed **hit** and `tr("Miss Key Not In Table")` is a
guaranteed **miss**. This matters because brs-engine's `tr()` (`src/core/stdlib/index.ts:85-97`) returns
a **brand-new non-literal** `BrsString` on a hit, but returns the **original argument object unchanged**
on a miss - so a literal `tr("some literal")` call that misses keeps the caller's `literal=true` flag,
while a hit does not.

## Run

Device (sideload `string-boxing-probe.zip`, built by `./pack.sh`, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/string-boxing-probe
```

Baseline engine output is committed alongside as `engine-trace.txt`.

## Output format

```
PROBE|<seq>|<case>|<type-v2>|<type-v3>|<value>
```

## Results (RESOLVED)

`v2`/`v3` below are `type(x)` / `type(x, 3)`. Two device runs: the first 9 cases, then a second run
adding the `tr-*` cases.

| Case | Engine (before fix) | Device | Engine (after fix) |
| --- | --- | --- | --- |
| `control` | `String`\|`roString` | `String`\|`roString` | `String`\|`roString` |
| `m-scope-roundtrip` | `String`\|`roString` | `String`\|`roString` | `String`\|`roString` |
| `callfunc-plain` | `String`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `callfunc-mscope` | `String`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `field-custom-array` | `roString`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `field-dialog-buttons` | `roString`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `global-field-array` | `roString`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `global-field-str-then-array` | `roString`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `tr-hit-raw` | `String`\|`roString` | `String`\|`roString` | `String`\|`roString` |
| `tr-miss-raw` | `String`\|`String` | `String`\|`roString` | `String`\|`roString` |
| `tr-hit-plain` | `String`\|`roString` | `String`\|`roString` | `String`\|`roString` |
| `tr-miss-plain` | `roString`\|`String` | `String`\|`roString` | `String`\|`roString` |
| `tr-hit-callfunc` | `String`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |
| `tr-miss-callfunc` | `roString`\|`String` | `roString`\|`roString` | `roString`\|`roString` |
| `callfunc-task` | `String`\|`roString` | `roString`\|`roString` | `roString`\|`roString` |

Post-fix engine output is an **exact line-for-line match** of the device trace (`engine-trace.txt`).

## Root cause 1: `callFunc` doesn't box its arguments (FIXED)

Every case that crosses `callFunc` - same-thread (`callfunc-plain`, `callfunc-mscope`,
`tr-hit-callfunc`, `tr-miss-callfunc`) **and** cross-thread (`callfunc-task`) - disagreed: the device
permanently boxes the string (`roString`/`roString`), brs-engine did not. Every non-`callFunc` case
already agreed, including all node-field-get cases.

The general mechanism (found by reading the source, not guessed): `Field.ts` `convertValue()`
unconditionally calls `.box()` on any boxable scalar written to a node field, and `Node.ts` `get()`
unconditionally calls `RoArray`/`RoAssociativeArray.deepCopy(true)` (which itself `.box()`es every
string element) on any array/AA-typed field read. **`callFunction`
(`src/extensions/scenegraph/nodes/Node.ts`) - the one place that actually invokes a `callFunc` target,
same-thread and cross-thread alike - was the only node boundary that passed its arguments through
untouched.**

**Fix**: `callFunction` now applies the same transform to its arguments right before invoking the
target function (after signature matching, which still uses the unboxed originals) - `deepCopy(true)`
for `RoArray`/`RoAssociativeArray`, `.box()` for other boxable scalars.

## Root cause 2: `tr()` incorrectly preserved literal-ness on a miss (FIXED)

Independently: brs-engine's `tr()` (`src/core/stdlib/index.ts`) used to return the **original argument
object unchanged** when no translation was found. Device data showed this is wrong - `tr-miss-raw`
reports `String`/`roString` on a real Roku, identical to a **hit** (`tr-hit-raw`), not the
literal-preserved `String`/`String` pattern the old engine code produced. Real Roku's `tr()` never
returns the caller's original object, hit or miss.

**Fix**: `tr()` now always returns a fresh `BrsString` (`tr ?? source.value`), whether or not a
translation was found.

## Regression coverage

`test/cli/resources/callfunc-string-boxing-app` + the matching `cli-scenegraph.test.js` test pin both fixes
together with a deterministic, non-Task fixture (same-thread `callFunc` already reproduces the bug, so
no Timer/Task deferral is needed for the regression test).
