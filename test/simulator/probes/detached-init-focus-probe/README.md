# Detached Init Focus Probe

This probe finds out where the focus lands when a view's descendant focuses itself while the view is still
detached (as in a component's `init()`), and the view is then mounted and focused. It was written after a
production app's search screen opened with no focus on its keyboard: the keyboard focused itself in the
screen's `init()`, and the screen stack appended the screen and called `screen.setFocus(true)`.

## Shape

The scene is HD. `nav` holds the focus before every case. `stack` is where the views get mounted.
`ProbeView` builds `col > target` from a field observer, before it is appended, and optionally calls
`target.setFocus(true)` there. Its `focusedChild` observer can forward to `target` when the view gains
the focus. Each case prints `hasFocus()`, `isInFocusChain()` and the scene's `focusedChild` links after the
view is created, after it is appended, after `view.setFocus(true)`, and after `nav.setFocus(true)`.

-   **S1:** the target is a `DynamicCustomKeyboard`. It focuses itself while detached, and the view forwards.
-   **S2:** as S1, with a plain focusable `Group` as the target.
-   **S3:** as S2, with no forward.
-   **S4:** no detached focus, and the view forwards (control).
-   **S5:** stale links in the scene. The container forwards to its leaf, and the leaf's observer asks for
    `overlay`, which leaves `container → leaf` and the leaf's self-link behind. `nav` is focused, then the
    container.
-   **S6:** as S5, with a container that is not focusable.
-   **S7:** as S3, with a focusable view.
-   **S8:** a view (`RowView`) whose XML child, a `RowList` (`SelfRow`), focuses itself in its own `init()`.
    That runs before the view appends it. `nav` holds the focus, and the view is mounted the way a router
    library does it: `appendChild`, `reparent` onto the same parent, then `view.setFocus(true)`.
-   **S9:** as S8, with a `Group` child (`GroupView` > `SelfGroup`).
-   **S10:** as S8, with nothing focused.
-   **S11:** a view (`InitGroupView`) focuses its XML child (a focusable `Group` under `col`) in its own
    `init()`, so the view links to it. `nav` holds the focus. The view is appended, then `view.setFocus(true)`.
-   **S12:** as S11, but the scene focuses the child after `CreateObject`, outside any `init()`.
-   **S13:** as S11, with a `DynamicCustomKeyboard` child (`InitKbdView`).
-   **S14:** as S12, with that keyboard.

## Capture

Sideload, `keypress/Home`, `launch/dev`, then keep one `sleep 600 | nc <ip> 8085` connection until
`PROBE|done` (see the other probes' READMEs). For the engine:

```
brs-cli --root test/simulator/probes/detached-init-focus-probe source/main.brs | grep PROBE
```

## Findings (Roku Express 4K+, OS 16.1.4, `device-trace-os16.1.txt`)

-   **Focusing a mounted view hands the focus to a node focused while detached, outside any `init()`** (S2,
    S3, S7, S12, S14). The links become `stack → view → col → target → self`, and `view.hasFocus()` is
    false, so the view's observer doesn't need to forward. `focusable` on the view makes no difference (S7).
-   **A focus requested inside the view's `init()` doesn't get it** (S11, S13). The view focuses itself
    (`/stack/view/self`, `hasFocus()` true), and the child keeps a stale self-link. A production app's
    search screen relies on this: its observer resets the background while the screen has the focus, then
    forwards to the keyboard.
-   **The target owns the chain afterwards.** Focusing `nav` clears every link down to the target's
    self-link.
-   **A child that focused itself in its own `init()` doesn't get the focus from `view.setFocus(true)`**
    (S8, S9, S10). The view never links to it, so the call focuses the view (`/stack/view/self`), and the
    child keeps its stale self-link. A `RowList` child behaves like a `Group` one within the synchronous
    call. At the next pass, though, a list or grid with content takes the focus anyway
    (`detached-focus-adoption-probe`).
-   **Stale links in the scene don't do this** (S5, S6). The container focuses itself (`/container/self`),
    whether it is focusable or not.
-   **`isInFocusChain()` follows the node's own links:** it is true while its `focusedChild` is a node.
    That includes a node inside a detached tree, and a node on a stale link the scene's chain moved away from
    (S5/S6 `containerChain`). The engine does the same.
-   The target's observer runs before the view's, both in the detached `setFocus` and in the view's.
-   A `DynamicCustomKeyboard` hands its focus to an internal child (S1: `target//self`, and the keyboard's
    `hasFocus()` is false). The engine doesn't model that child.

The engine matches the focus landing in every case. It still differs on these points:

-   The keyboard's internal child (S1, S13, S14).
-   S10: with nothing focused, the engine makes the child's `init()` focus live and links the view to it on
    attach, so the focus stays on the child. The device keeps it out of the chain and focuses the view.
-   Notification order. The device notifies the target before the view, on the gain (the detached call and
    the view's) and on the unset (`nav` focused again). The engine notifies the view first.
-   The stale leaf self-link in S5 and S6, which the engine clears.
