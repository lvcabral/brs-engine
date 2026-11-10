# Nested Forward Focus Probe

This probe reproduces a regression in the Popcorn gallery channel's ExpandButtonList screen. A list of buttons forwards focus to a button from its own `focusedChild` observer, and each button collapses when its `focusedChild` changes away from itself. After the OS 16.0 focus model landed, the first button the list forwarded to kept reporting `hasFocus()` once the focus left it, so it never collapsed and its focus ring stayed on.

## Shape

**Gallery (default launch).** This mirrors the channel's focus code:

- `ProbeScene` stands in for `ComponentModal`. It creates the gallery body, then calls `body.setFocus(true)` and `body.callFunc("focusFirstCell")`.
- `ProbeGallery` stands in for `BaseGallery`. When its own `focusedChild` observer finds `hasFocus()`, it focuses the current cell. Up and Down move between the two lists.
- `ProbeList` stands in for `PopcornExpandButtonList`. When its own observer finds `hasFocus()`, it calls `setFocus(true)` on the current (or first) button. Left/Right (`hList`) or Up/Down (`vList`) move between buttons.
- `ProbeButton` stands in for `PopcornExpandButton`. It logs every `focusedChild` change and its `hasFocus()`.

The containers log their own `focusedChild` changes too. After each handled key, the probe dumps every button's `hasFocus()`. The keys are Right, Right, Down, Down, Down, Up.

**Links (launch with `mode=links`).** These are scripted cases with no keys. Each uses a fresh container `C` (children `a`, `b`) next to a node `other`, and prints every node's `focusedChild` link and `hasFocus()`.

| Case | Steps |
| --- | --- |
| S1 | `C.setFocus` (C's observer forwards to `a`), then `b.setFocus`, a sibling inside `C` |
| S2 | `C.setFocus` (forward to `a`), then `other.setFocus`, outside `C` |
| S3 | `C.setFocus` with no forward, `a.setFocus`, then `b.setFocus`: no nesting at all |
| S4 | `C.setFocus` (forward to `a`), `C.setFocus` again, then `b.setFocus` |

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh . out.txt "Right Right Down Down Down Up"
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh . out.txt "" mode=links
```

Engine runs:

- gallery: drive the keys through a host script, the same way as in `../grid-ok-midmotion-probe`;
- links: `brs-cli --root test/simulator/probes/nested-forward-focus-probe --deep-link mode=links`.

## Findings (Roku Express 4K+, OS 16.0)

**A forward from a container's own observer extends the chain.** When the forwarded node newly takes the focus, the next `setFocus` unsets the chain through it, whether it lands inside the container or outside it:

- S1: `a`'s self-link is cleared.
- S2: both `C → a` and `a`'s self-link are cleared.
- In the gallery, each button stops reporting `hasFocus()` as soon as the focus moves on.

This differs from `../focus-flag-probe` case D. There, the forwarded node's links already existed before the container was focused, so the forward re-wrote links that were already set rather than extending the chain, and a later `setFocus` outside the container left them alone.

**Focusing a node that sits between the chain owner and the focus keeps the chain.** In the gallery, `focusFirstCell` calls `hList.setFocus(true)` while the body owns the chain and `h0` holds the focus through `hList`. The device leaves every link in place and notifies `h0`, `hList` and `body` in that order (from the focused node up). The list's own observer sees `hasFocus()` false, so it doesn't forward again.

Focusing the chain owner itself is different: the device rewrites the chain, and its observer forwards again (S4, and `container-redirect-focus-app` scenario 2).

## Engine

- `sgRoot.chainExtension` records a node that a nested `setFocus` newly focused below the chain owner (`Node.applyNestedFocus`). The next top-level `setFocus` unsets through it (`Node.applyFocus`). Re-writing links that are already in place extends nothing.
- `Node.holdsLiveFocus` and `Node.restageChain` implement the keep-the-chain case.
- `engine-trace-links.txt` matches the device trace exactly.
- `engine-trace-gallery.txt` matches it line for line during the open sequence and in every state dump. Within a key's transaction, the lines are the same but come in a different order: the device notifies the gaining path from the leaf up, then the nodes losing the focus, while the engine notifies the losing nodes first, from the root down. `../focus-probe2` N1 shows the device notifying a losing sibling subtree first, so the order rule isn't settled; this is left open.

Regression: "a forward extends the chain …" and "focusing a node between the chain owner and the focus keeps the chain" in `test/extensions/scenegraph/Focus.test.js`.
