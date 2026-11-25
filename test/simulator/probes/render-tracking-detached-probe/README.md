# Render Tracking Detached Probe

Does measuring a node that is not in the scene tree change its `renderTracking`? And what does
`renderTracking` report when a tracked node is attached, and later removed?

A component that sizes itself from a label measurement before its owner appends it, then waits
for `renderTracking = "full"` to announce it is ready, depends on the answer: if the detached
measurement already reports `"full"`, attaching it produces no change and the ready signal never fires.

## Cases

| Case | Shape |
| --- | --- |
| T | Runs first. A Task builds a Group, enables tracking and measures its label, then hands it to render through a `node` field; render attaches it, then removes it |
| A | Group (`enableRenderTracking`) with a Label child; the label is measured while the group is detached |
| B | The detached group itself is measured |
| C | A tracked group inside a detached parent; the parent is measured |
| D | Control: no measurement before attach |
| E | D's group removed from the scene after it rendered, then measured while detached |
| G | An `enableRenderTracking` observer reads `renderTracking` as tracking is turned on, then off |
| F | A tracked group measured between `appendChild` and the next frame |
| H | A tracked StandardMessageDialog with a tracked child: closed, replaced by another, cleared with `dialog = invalid` |
| I | A tracked group with a tracked label: the group hidden, shown, faded to 0, restored |

Records: `PROBE|<seq>|<case>|<label>|<value>`.

## Device (Roku Express 4K+, OS 16.1) — `device-trace-os16.1.txt`

-   Setting `enableRenderTracking = true` on a node that has not rendered reports `"none"` at once,
    on the Task thread as well as on render. A Task-built node arrives on render as `"none"`, becomes
    `"full"` on the frame after it is attached, and `"none"` on the frame after it is removed — the same
    as a render-built node. (UI nodes are not recommended on Task threads; this case exists because
    the engine copies Task nodes to render, which skipped the enable bookkeeping.)
-   Measuring a detached node (`localBoundingRect()`/`boundingRect()`, on the node, a child or an
    ancestor) never changes its `renderTracking`.
-   `appendChild` to the scene does not change it synchronously; it becomes `"full"` on the next frame.
-   Removing a rendered node does not change it synchronously; it becomes `"none"` on the next frame,
    and measuring it afterwards leaves it `"none"`.
-   An `enableRenderTracking` observer already reads the new status (`"none"`, then `"disabled"`).
-   `boundingRect()` on a node attached but not yet drawn leaves it `"none"`; `"full"` comes with the frame.
-   A dialog closed (`close = true`), replaced, or cleared reports `"none"` for itself and its children
    on the next frame. When replaced, the new dialog's `"full"` events come before the old one's `"none"`.
-   Hiding or fading out a parent reports `"none"` for it and its tracked child on the next frame;
    showing or restoring it reports `"full"` again.
-   Within a frame, a parent's event fires before its child's.

`engine-trace.txt` matches the device trace except for label widths (font metrics), the device line,
the device's extra `T|arrived` records (on the device the Task's `result` field notifies again each
time the node it holds changes `renderTracking`; the engine does not, a separate behavior not pursued
here), and parent/child event order within a frame (the engine fires the child first).

## Run

```bash
brs-cli --root test/simulator/probes/render-tracking-detached-probe
```

On a device: zip `manifest`, `source/`, `components/`, sideload, and read the console on port 8085.
