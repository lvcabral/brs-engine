# Observer Signature Probe

Determines how Roku binds the `roSGNodeEvent` to an observer callback registered by **name**
(`observeField(field, "funcName")`) when the callback's declared parameter list cannot accept it.

## Why

JellyRock `components/video/VideoPlayerView.bs`:

```brightscript
m.playbackTimer.observeField("fire", "reportPlayback")   ' line 91
...
sub reportPlayback(state = "update" as string)           ' line 1509
  ...
  if (state = "stop" or state = "finished") and isValid(m.originalClosedCaptionState)   ' line 1535
```

`reportPlayback` is called both directly with a string and as the Timer `fire` observer. In
brs-engine the timer path binds the event object to `state`, so line 1535 raises
`Type Mismatch. Operator "=" can't be applied to "Object" and "String"`. On a real Roku it does not
crash — so Roku must be doing something different, and this probe pins down exactly what.

## Run

Device (sideload the zip, then capture the debug console):

```
telnet <roku-ip> 8085
```

Engine:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/observer-signature-probe
```

Baseline engine output is committed alongside as `engine-trace.txt`.

## Output format

```
PROBE|<seq>|<phase>|<case>|<key=value ...>
```

Each case prints a `begin` record (with the signature under test) and an `end` record with what the
callback actually observed: `bound=0` (called with no parameters), `p1=`/`p2=` (the `type()` and
value of each bound parameter), `<not-called>` (the observer never ran), `body-error={...}` (an
error raised inside the callback), or `throw={...}` (an error raised by the field write itself,
i.e. at observer-invocation time).

## Phases

| Phase | Trigger | Registration |
| --- | --- | --- |
| `p1-observeField` | write to an `integer` field | `observeField` |
| `p3-scopedObserve` | write to an `integer` field | `observeFieldScoped` |
| `p4-stringField` | write to a `string` field (subset of cases) | `observeField` — rules out "the observed field's own type makes `as string` satisfiable" |
| `p2-timer-fire` | `Timer.fire` (the JellyRock trigger) | `observeField` |

Phases 1/3/4 are synchronous — the observer runs inside the field write, so a `try/catch` around the
write reports invocation-time errors instead of taking the app down. Phase 2 fires from the
render-thread message loop, outside any catchable scope, so it is **checkpointed in the registry**:
if a case hard-crashes the app on device, just relaunch and the probe resumes at the next case. The
last `begin` record printed before a crash names the case that crashed. Checkpoints are cleared
automatically once `all|done` prints.

## Cases

| Case | Signature | Question |
| --- | --- | --- |
| `A_noargs` | `sub cbA()` | baseline: no parameter to bind |
| `B_dynamic1` | `sub cbB(e)` | baseline: the event is passed |
| `C_objectReq` | `sub cbC(e as object)` | baseline: explicitly typed, satisfiable |
| `D_dynamicReq` | `sub cbD(e as dynamic)` | same via `dynamic` |
| `E_stringReq` | `sub cbE(s as string)` | **required** and unsatisfiable — crash, skip, or pass anyway? |
| `F_stringDef` | `sub cbF(s = "update" as string)` | **the JellyRock shape** — default used, or event forced in? |
| `G_intReq` | `sub cbG(n as integer)` | required unsatisfiable, numeric |
| `H_intDef` | `sub cbH(n = 42 as integer)` | optional unsatisfiable, numeric — is the event coerced? |
| `I_evtPlusOpt` | `sub cbI(e, opt = true)` | trailing optional: default or uninitialized? |
| `J_twoReq` | `sub cbJ(a, b)` | two required params, one argument available |
| `K_strDefObjDef` | `sub cbK(s = "update" as string, e = invalid as object)` | does the event land on the first *compatible* parameter, or only on the first? |
| `L_boolReq` | `sub cbL(b as boolean)` | required unsatisfiable, boolean |
| `M_objThenStrDef` | `sub cbM(e as object, s = "update" as string)` | event + typed optional |
| `N_objDef` | `sub cbN(e = invalid as object)` | optional and satisfiable — event or default? |
| `O_function` | `function cbO(e as object) as string` | does `function` vs `sub` matter? |
| `P_objThenStrReq` | `sub cbP(e as object, s as string)` | first satisfiable, second required and unfillable |

`F_stringDef` also prints `cmp-stop=` — the result of `s = "stop"`, the exact comparison that
crashes in JellyRock.

## Result: the rule Roku implements

Measured on a Roku Streaming Stick, Roku OS 15.2 (`device-trace.txt`). **Identical in all four
phases** — `observeField`, `observeFieldScoped`, `Timer.fire` and a string-typed field all go through
one code path, and the observed field's own type never affects the binding.

Roku attempts exactly two calls, in order, and makes **no coercion and no partial binding**:

1. **Call with the event** — only if the callback declares **exactly one** parameter *and* that
   parameter's declared type accepts an object. Declaring a default does not matter here: an
   optional-but-compatible parameter still receives the event (`N`), never its default.
2. **Otherwise, call with no arguments** — only if the callback has **no required** parameters.
   Every parameter takes its declared default.
3. **Otherwise the callback is not invoked at all** — silently. No error, no crash, nothing on the
   debug console.

Two consequences that are easy to get wrong:

- **A callback with more than one parameter never receives the event**, even when the extra
  parameters are optional and the first one is `as object` (`I`, `M`). It is either called with
  zero arguments (if nothing is required — `K`) or not called at all (`I`, `M`, `J`, `P`).
- **The event is never coerced and never replaced by `getData()`.** A declared type that rejects an
  object simply disqualifies attempt 1.

| Case | Signature | Device |
| --- | --- | --- |
| `A_noargs` | `sub cbA()` | called, 0 args |
| `B_dynamic1` | `sub cbB(e)` | event |
| `C_objectReq` | `sub cbC(e as object)` | event |
| `D_dynamicReq` | `sub cbD(e as dynamic)` | event |
| `E_stringReq` | `sub cbE(s as string)` | **not called** |
| `F_stringDef` | `sub cbF(s = "update" as string)` | called with default `"update"`, `s = "stop"` → `false` |
| `G_intReq` | `sub cbG(n as integer)` | **not called** |
| `H_intDef` | `sub cbH(n = 42 as integer)` | called with default `42` |
| `I_evtPlusOpt` | `sub cbI(e, opt = true)` | **not called** |
| `J_twoReq` | `sub cbJ(a, b)` | **not called** |
| `K_strDefObjDef` | `sub cbK(s = "update" as string, e = invalid as object)` | called with **both defaults** — the event does not go to the compatible second parameter |
| `L_boolReq` | `sub cbL(b as boolean)` | **not called** |
| `M_objThenStrDef` | `sub cbM(e as object, s = "update" as string)` | **not called** |
| `N_objDef` | `sub cbN(e = invalid as object)` | event (not the default) |
| `O_function` | `function cbO(e as object) as string` | event — `function` vs `sub` is irrelevant |
| `P_objThenStrReq` | `sub cbP(e as object, s as string)` | **not called** |

So the JellyRock `reportPlayback(state = "update" as string)` timer observer runs on device with
`state = "update"` — exactly as if the timer had called `reportPlayback()` — and the line 1535
comparison is a plain string compare that yields `false`.

## brs-engine baseline (what to compare against)

From `engine-trace.txt`, identical across all four phases:

- **`E`, `G`, `L`, `J`, `P` → `<not-called>`.** No signature is satisfied, so the engine silently
  drops the dispatch.
- **`F` → the event is bound to the `as string` parameter**, and `s = "stop"` raises
  `Type Mismatch (#24)`. Same for **`H`** (event bound to `as integer`). This is the JellyRock crash.
- `I`, `K`, `M` → event on parameter 1, declared defaults on the trailing parameters.

The cause is `src/extensions/scenegraph/nodes/Field.ts` `invokeCallable`: it tries
`getFirstSatisfiedSignature([event])` and falls back to `getFirstSatisfiedSignature([])`, but the
binding loop afterwards keys off `signature.args.length > 0` — so even when the **zero-argument**
satisfaction is the one that matched (the event was rejected on type grounds), the event is still
assigned to parameter 0 instead of its default.

### Divergences from the device

| Case | Device | Engine |
| --- | --- | --- |
| `F_stringDef` | default `"update"` | **event object** → `Type Mismatch (#24)` on `s = "stop"` |
| `H_intDef` | default `42` | **event object** |
| `K_strDefObjDef` | both defaults | **event** on parameter 1 |
| `I_evtPlusOpt` | not called | called with event + default |
| `M_objThenStrDef` | not called | called with event + default |
| `E`, `G`, `L`, `J`, `P` | not called | not called ✓ (agrees) |
| `A`, `B`, `C`, `D`, `N`, `O` | as documented above | ✓ (agrees) |

The fix is to decide the argument count *before* binding: pass the event only when
`signature.args.length === 1` and the event satisfies that parameter's declared type; otherwise call
with zero arguments and evaluate every default; otherwise skip the callback. Note the multi-parameter
rows: the engine currently invokes `sub cb(event, opt = true)` (deliberately, per the comment added
in #982), but the device does not call that shape at all. No test pins that behavior — the only
reference to it is the code comment — but any app relying on it would go from "callback fires" to
"callback silently never fires", which is what a real Roku does.
