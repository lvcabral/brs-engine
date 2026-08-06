# AA / ParseJson Order Probe

Measures whether `for each key in anAssociativeArray` and `.Keys()` enumerate in declaration order
on a real Roku, for both an AA literal and an AA produced by `ParseJson`, at two sizes (4 keys and
20 keys) — so brs-engine's `for each` can be made to match.

## Why

A real "movies"/"series" SGDEX `ContentHandler` sample app does:

```brightscript
for each item in json   ' json = ParseJson(feed) ; feed declares "movies" before "series"
    if item = "movies" or item = "series"
        ' ... build and append a content row named `item` ...
```

On brs-engine, `for each` walks the `ParseJson`'d AA in declared order, so the "movies" row is
built before "series". On a real device, the rows reportedly came out in the opposite order
("series" before "movies") for that same 2-key slice — with no other explanation found (the
cross-thread duplication bug that motivated this investigation, PR fixing stale duplicate node
reuse in `toSGNode`, is unrelated to ordering and was fixed separately).

Digging into brs-engine's own implementation surfaced a real inconsistency worth settling
regardless: `RoAssociativeArray.getElements()` (backs `Keys()`/`Items()`/`ToStr()`) sorts keys
**lexicographically**, while `getNext()` (backs `for each`) walks the backing `Map` in **insertion
order** — see the engine baseline below. Whether a real device's `for each` and `Keys()` also
diverge from each other, and whether either one matches insertion order, alphabetical order, or a
hash-bucket order that only appears once the AA has "enough" keys (long-standing BrightScript
community folklore), is exactly what this probe is designed to distinguish.

The 4-key case (`small-*`) uses keys `d, a, c, b` in that declared order, chosen so the four
candidate hypotheses each predict a **different** full sequence:

| Hypothesis | Predicted order |
| --- | --- |
| Forward insertion (matches declared order) | `d, a, c, b` |
| Reverse insertion | `b, c, a, d` |
| Alphabetical | `a, b, c, d` |
| Reverse alphabetical | `d, c, b, a` |

The 20-key case (`large-*`) uses a scrambled declaration order (`m, b, t, f, q, a, k, s, c, p, g,
n, d, r, h, e, j, o, i, l`) to check whether the answer changes once the AA is larger — and, if it
does, whether it's now alphabetical order that appears (matching `Keys()`'s known-sorted behavior)
or some other implementation-defined order.

## Run it on the Roku

1. Zip the app (already built as `aa-json-order-probe.zip` next to this folder):

   ```
   cd test/simulator/probes/aa-json-order-probe && zip -r ../aa-json-order-probe.zip manifest source
   ```

2. Sideload: browse to `http://<roku-ip>` → Development Application Installer → upload
   `aa-json-order-probe.zip` → **Replace**.

3. Capture the trace — open a second terminal first:

   ```
   telnet <roku-ip> 8085 | tee device-trace.txt
   ```

   (or `nc <roku-ip> 8085 | tee device-trace.txt`)

4. Run the channel from the Roku home screen. It prints its trace and exits immediately — no
   remote interaction needed.

5. Share `device-trace.txt` (just the `PROBE|` lines are enough) back so it can be diffed against
   `engine-trace.txt`.

## Trace format

```
PROBE|<case>|<method>|<comma-separated key order>
```

- `<case>`: `small-lit` / `small-json` / `large-lit` / `large-json`
- `<method>`: `foreach` or `keys`

## Engine baseline

`engine-trace.txt` in this folder is the same probe run under `brs-cli` on the current build
(`brs-cli --root test/simulator/probes/aa-json-order-probe --no-sg`):

```
PROBE|small-lit|foreach|d,a,c,b
PROBE|small-lit|keys|a,b,c,d
PROBE|small-json|foreach|d,a,c,b
PROBE|small-json|keys|a,b,c,d
PROBE|large-lit|foreach|m,b,t,f,q,a,k,s,c,p,g,n,d,r,h,e,j,o,i,l
PROBE|large-lit|keys|a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t
PROBE|large-json|foreach|m,b,t,f,q,a,k,s,c,p,g,n,d,r,h,e,j,o,i,l
PROBE|large-json|keys|a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t
```

`for each` always matches declared order (literal or `ParseJson`, small or large); `Keys()` is
always alphabetically sorted. If the device trace instead shows, for example, `small-json|foreach`
matching `small-lit|keys`'s alphabetical order while `small-lit|foreach` still matches declared
order, that would pin the discrepancy specifically to `ParseJson`'s AA construction rather than to
`for each`/`Keys()` in general — the fix would then live in `ParseJson` (`src/core/stdlib/Json.ts`),
not in `RoAssociativeArray`.
