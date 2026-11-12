# PanelSet Bounce Focus Probe

Records how a `PanelSet`'s own key navigation hands the focus to a panel whose `focusedChild` observer
reacts to the gain. It reproduces a regression where a details panel that bounces the focus back to the
menu while it is still loading left nothing focused in the engine.

## Shape

A `ListPanel` menu (a `LabelList`) inside a `PanelSet`; its `createNextPanelIndex` builds `DetailPanel`
(a plain `Panel` with `Group#wrap > LabelList#inner`). The detail panel's own observer reacts to a gain
according to the launch case:

| Case | On the gain | Keys |
| --- | --- | --- |
| `bounce` | sets `backPressed`; the scene's observer calls `details.setFocus(false)`, then `menu.setFocus(true)` | Right, Down |
| `bounceDirect` | the same two calls, directly in the panel's observer | Right, Down |
| `noUnfocus` | only `menu.setFocus(true)` | Right, Down |
| `forward` | `inner.setFocus(true)` | Right, Left, Right, Down |
| `chainGate` | `inner.setFocus(true)` only `if m.top.isInFocusChain()` (and the panel links to itself) | Right, Down |

Every `focusedChild` change is printed (`node[F]` has the focus, `[c]` is in the chain, `[-]` neither, then
its `focusedChild`), and a 250 ms poll prints the whole state whenever it changes. Down shows where the
remote goes. Lines are `PROBE|<case>@<run>|<seq>|<kind>|<body>`; the run nonce and sequence number let
the host drop the console's replays of older runs without losing genuinely repeated lines.

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh . out.txt "Right Down" bounce
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh . out.txt "Right Left Right Down" forward
```

`drive.sh` keeps a console client reconnected for the whole run (the device drops clients on launch).
Engine: `brs-cli --root <this dir> --deep-link case=<case>` with the same keys sent from a TTY.
`device-trace-os16.0.4.txt` (Roku Streaming Stick+, OS 16.0.4) and `engine-trace.txt` hold all five cases.
Each gain line also records the panel's `isInFocusChain()`.

## Findings (OS 16.0.4)

**A PanelSet move onto a plain panel happens in two phases.** The panel's self-link is written and the
panel is notified first, while the rest of the chain still leads to the menu:

- `bounce`/`bounceDirect`: `setFocus(false)` on the panel clears only its self-link, and the menu's
  `setFocus(true)` lands on the intact chain. The move does not complete; the menu keeps the focus and
  Down moves it.
- `noUnfocus`: the panel keeps its self-link and the focus stays on the menu's chain, so the move then
  completes: the panel takes the focus, and the menu's links are cleared.
- `forward`: the forward's write redirects the PanelSet's link from the menu, which unsets the menu's
  path. Left back to the `ListPanel` is one ordinary transaction to its list.
- While it is notified in the first phase, the panel reports `isInFocusChain()` true as well as
  `hasFocus()`, though the live focus is still on the menu. So `chainGate` forwards just like `forward`.

## Engine

`PanelSet.moveFocusToCurrentPanel` with `Node.announcePanelFocus`/`Node.completePanelFocus`
(`sgRoot.pendingPanelFocus` makes `isInFocusChain()` true during the first phase), and the chain takeover
in `Node.applyNestedFocus` (`redirectsOwner`). Every case ends in the device's state, and every value an
observer reads matches. The order of notifications inside a transaction still differs (see "Still open"
in `.claude/docs/scenegraph-invariants.md`), and the device notifies the `chainGate` panel a second time
after its forward, where the engine delivers each field once per focus round.

Regression: `test/extensions/scenegraph/PanelSetForwardFocus.test.js`.
