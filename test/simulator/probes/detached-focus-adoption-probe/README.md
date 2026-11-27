# Detached Focus Adoption Probe

This probe finds out when a focus taken inside a detached tree becomes the focus that receives keys. It
was written after a production app's user-selection screen opened with no focus in the engine. On the
device the focus was on the screen's user row. The row is a `RowList` that focuses itself in its own
`init()`, before the screen appends it, and gets its items after a router library mounts the screen.
`detached-init-focus-probe` runs every case synchronously, so it can't see this.

## Shape

The scene is HD. `nav` (a `KeyGroup`) holds the focus at the start of every case except C. Each case
creates a view whose child focuses itself while detached. It then mounts the view the way a router library
does (`appendChild`, then `reparent` onto the same parent). A Timer runs the steps 0.4 s apart, so frames
and message-loop passes run between them. After each step the probe prints `hasFocus()`,
`isInFocusChain()` and the scene's `focusedChild` links. It then asks the driver for a Play press, and
reports which node received the key.

-   **A:** the view's XML child, a focusable `Group`, focuses itself in its own `init()`. The view never
    links to it.
-   **B:** a child built in code focuses itself once the detached view holds it, so the view links to it.
-   **C:** as A, with nothing focused.
-   **D:** as A, but the view is never mounted.
-   **E:** the view's XML child is a `RowList` with empty content that focuses itself in its own `init()`. It
    gets its content one step after the view is mounted.
-   **F:** as E, but the content is set before the view is mounted.
-   **G:** as E, with a `RowList` that never focuses itself (control).
-   **H:** as E, with a `LabelList` built in code that focuses itself alone before the view appends it.
-   **I:** as H, with a `MarkupGrid`.
-   **J:** as H, with a `RowList` inside a hidden view.
-   **L:** as E, with `nav` focused again right after the view is mounted.
-   **M:** as E, with the view focused right after it is mounted.

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh   # after sideloading a zip of manifest, source and components
ENGINE=1 ./drive.sh                      # engine (set ECP_PORT when 8060 is busy)
```

## Findings (Roku Express 4K+, OS 16.1.4, `device-trace-os16.1.txt`)

-   **A list or grid that focused itself while detached takes the focus once it is mounted with content**
    (E, F, H, I, J). This happens at the next pass after both hold. The links then run down to it, and keys
    reach it.
    -   It takes the focus from whatever holds it, including a node the app focused after the view was
        mounted (L, M).
    -   It doesn't matter whether the view is visible (J).
    -   Content with a single empty row is enough (checked separately).
-   **A plain `Group` never does** (A). The focus and the keys stay on `nav`, even after several frames.
-   **A list that never focused itself doesn't either** (G).
-   **Nothing happens until the list is mounted** (D). A detached list doesn't receive keys.
-   **`reparent` drops the links of a mounted view to its focused child** (B). The child's self-link goes
    too.
-   **With nothing focused, a detached focus stays out of the chain** (C). No node receives keys.

The engine matches every case except B and C. For B, the engine keeps the links that `reparent` drops.
For C, the engine makes the focus live when nothing holds it.
