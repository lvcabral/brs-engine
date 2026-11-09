# Focus Flag Probe

This probe finds out what `hasFocus()` reports after nested `setFocus` calls, and which `focusedChild`
links each call writes and clears. It was written after container-redirect-focus-app showed nodes
reporting `hasFocus()` true although the chain had moved away from them.

## Shape

The scene is HD. `overlay`, `other` and `third` sit beside `container` under the Scene, and `container`
holds `leaf` and `leaf2`. All six are focusable. A Timer runs the steps 0.4 s apart, and after each one
the probe prints every node's `hasFocus()` and its `focusedChild` (`self`, a node id, or `-`), plus the
Scene's `focusedChild`. The nested requests are raised from `focusedChild` observers:

- **A1:** the container's observer, gaining, forwards to `leaf`; `leaf`'s observer then asks for `overlay`.
- **B1:** the container's observer, gaining, asks for `overlay` directly.
- **C1:** the container's observer, losing (focus going to `other`), asks for `leaf2`.
- **D1:** the container's observer, gaining, forwards to `leaf2`.

Each is followed by plain `setFocus` calls on `other` and `third`.

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> <driver that sideloads, waits for PROBE|done and keeps the PROBE| lines>
brs-cli -r test/simulator/probes/focus-flag-probe source/main.brs -c 0 | grep PROBE
```

`Main()` sleeps 8 s first, because the device console drops its clients when an app launches.

## Findings (Roku Express 4K+, OS 16.0, `device-trace-os16.0.txt`)

`hasFocus()` is true exactly when the node's own `focusedChild` links to itself, on every line. A node
keeps reporting focus for as long as that stale link stays. The links follow two pointers: the chain
owner (whose path the next transaction unsets) and the target of the last `setFocus` call to return.

- **A top-level `setFocus(X)`** unsets the chain owner's path below their common ancestor. It clears only
  the links that still point along that path, so `container → leaf` and `leaf`'s self-link survive A2
  and A3. It then writes X's whole path and becomes the chain owner.
- **A `setFocus(Y)` raised during a focus notification** writes Y's path only below its common ancestor
  with the last returned call's target.
  - C1: after C0's `leaf`, Y = `leaf2` writes just `container → leaf2` and `leaf2`'s self-link. The
    Scene stays on `other`.
  - A1: `leaf`'s forward returned before `leaf`'s observer ran, so Y = `overlay` writes up to the
    Scene and takes the focus.
- **When that write replaces the Scene's link**, it also unsets the chain owner's path and becomes the
  chain owner.
  - B1: the container loses its self-link.
  - A1: the container keeps `→ leaf`.
- **A `focusedChild` notification raised by a nested call** is dispatched after that call returns, behind
  the ones already queued.

The engine matches this trace line for line (`engine-trace.txt`).
