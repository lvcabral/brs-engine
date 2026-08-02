# Focus Chain Probe

Measures how a real Roku dispatches `focusedChild` observers, so brs-engine can be made to match.

It reproduces the shape that misbehaves in JellyRock: two **sibling** subtrees under the Scene — an
`outlet` (content) and an `overhang` (top menu) — with an observer on the outlet's `focusedChild`
that re-grabs focus when focus leaves the outlet (exactly what sgRouter's
`sgrouter_onFocusChildChanged` does).

## Run it on the Roku

1. Zip the app (already built as `focus-probe.zip` next to this folder):

   ```
   cd test/simulator/probes/focus-probe && zip -r ../focus-probe.zip manifest source components
   ```

2. Sideload: browse to `http://<roku-ip>` → Development Application Installer → upload
   `focus-probe.zip` → **Replace**.

3. Capture the trace **before the app finishes** — open a second terminal first:

   ```
   telnet <roku-ip> 8085 | tee device-trace.txt
   ```

   (or `nc <roku-ip> 8085 | tee device-trace.txt`)

4. The app auto-runs scenarios S1–S7 over about 7 seconds. When it prints

   ```
   PROBE|---|S7-modal|MANUAL|Now press DOWN, then OK, then BACK on the remote.
   ```

   press **Down**, then **OK**, then **Back** on the remote. Back exits the probe.

5. Send me `device-trace.txt` (just the `PROBE|` lines are enough).

## What each scenario answers

| Scenario | Question |
|---|---|
| `S1-enter` | Does the ancestor observer fire when focus enters its subtree, and what is `event.getData()`? |
| `S2-move-within` | Does a move *within* the subtree re-notify the ancestor? |
| `S3-leave` | Does it fire when focus **leaves**? With what payload? **And does its record land between `before` and `after` (synchronous) or after `after` (message loop)?** |
| `S4-steal` | The observer re-grabs focus mid-flight. After the outer `setFocus` returns, who actually holds focus and is the `focusedChild` chain consistent with it? |
| `S4-settled` | Does the answer survive one settled frame? |
| `S5-redundant` | Does a same-value write (`setFocus(true)` on the already-focused node) notify? |
| `S6-dialog` | With `scene.dialog` shown, does the ancestor observer fire, and does the previously focused node keep `hasFocus()`? |
| `S7-modal` | The app re-grabs scene focus **behind** the visible dialog. Do Down/OK still go to the dialog (modal) or leak to the scene? `SCENE-onKeyEvent` records mean they leaked. |

## Trace format

```
PROBE|<seq>|<scenario>|<point>|<key=value ...>
```

Focus state accompanying every record:

- `gridA` / `gridB` / `menu` — `hasFocus()` of each focusable leaf (`T`/`F`)
- `outletInChain` — `outlet.isInFocusChain()`
- `outletFC` / `overhangFC` / `sceneFC` — each node's `focusedChild` id (`invalid` when cleared,
  `<err>` if reading the field raises, which Roku's docs say it should)

## Engine baseline

`engine-trace.txt` in this folder is the same probe run under `brs-cli` on the current build
(`node packages/node/bin/brs.cli.js --root test/simulator/probes/focus-probe`), so the two captures diff directly.
S7's key half is missing from the baseline because the local ECP port 8060 was taken by brs-desktop —
it will be filled in once that's free.

What the engine baseline already shows (`S4-steal`, records 016–023):

```
S4-steal|before|                  gridA=T ... outletFC=page   overhangFC=invalid sceneFC=outlet
S4-steal|OBS-outlet|data=invalid  gridA=F ... menu=T                                          <- fires INLINE
S4-steal|OBS-outlet-steal|calling gridA.setFocus(true)
S4-steal|after|                   gridA=T ... outletFC=page   overhangFC=menuItem sceneFC=overhang
```

After the steal, `gridA` holds focus but the scene's chain still points at `overhang → menuItem` —
`sgRoot.focused` and the `focusedChild` chain disagree. That hybrid state is what makes the first UP
press in JellyRock play the nav sound without moving focus, and what leaves the exit dialog drawn but
unfocused.
