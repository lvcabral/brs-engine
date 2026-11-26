# ButtonGroup `buttons` replacement probe

What does a device do with a `ButtonGroup`'s children when its `buttons` array changes, and what
happens to the focus when a focused node leaves its parent?

Captured on a Roku Express 4K+, OS 16.0.4: `device-trace-os16.0.txt`. The engine's output is
`engine-trace.txt` (see Known differences).

## Findings

-   **A different `buttons` array rebuilds the children.** Every child is removed in one
    `remove(0, n-1)` change, custom children (a `Rectangle` appended after the buttons) included, then
    a new `Button` is created per entry (`add(i, i)`). A surviving text ("A") still gets a new node,
    and every removed node reports `getParent()` invalid.
-   **The same array changes nothing:** no `change` events, same nodes.
-   **`buttonFocused` follows a focused Button at once** (`D.setFocus(true)` reads 3 immediately) and
    is never reset or clamped by a `buttons` change.
-   **`focusButton` on a focused group moves the focus chain** to that button (`focusedChild` leads
    to it).
-   **Detaching the focused node leaves nothing focused**: a removed Button, a plain `removeChild`,
    `replaceChild`, removing an ancestor, appending the focused node to another parent, and
    `reparent()` (even onto the same parent, which moves the node to the end) all end with no node
    holding focus and every `isInFocusChain()` false.
-   **A focus taken while detached is kept.** A view whose child focused itself in `init()`, appended
    to an outlet and then `reparent()`ed onto that same outlet (how a router library mounts views),
    keeps the child's `hasFocus()`. The scene's chain does not reach it (`focused=none`), and
    `view.setFocus(true)` then focuses the view.

## Known differences

The engine output matches the device except the four `mount*` lines: the engine threads a detached
focus into the scene's chain when the tree is attached (`restoreFocusChainOnAttach`), so the scene's
chain reaches the child and `view.setFocus(true)` keeps the child focused. That predates this probe.

## Running

Zip `manifest`, `source/` and `components/`, sideload, and read the console on port 8085. The probe
waits 5 s, then prints one `PROBE|` line per step every half second and ends with `PROBE|done`. For
the engine, run the same zip with `brs-cli`.
