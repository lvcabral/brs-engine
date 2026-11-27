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

- **S1:** the target is a `DynamicCustomKeyboard`. It focuses itself while detached, and the view forwards.
- **S2:** as S1, with a plain focusable `Group` as the target.
- **S3:** as S2, with no forward.
- **S4:** no detached focus, and the view forwards (control).
- **S5:** stale links in the scene. The container forwards to its leaf, and the leaf's observer asks for
  `overlay`, which leaves `container → leaf` and the leaf's self-link behind. `nav` is focused, then the
  container.
- **S6:** as S5, with a container that is not focusable.
- **S7:** as S3, with a focusable view.

## Capture

Sideload, `keypress/Home`, `launch/dev`, then keep one `sleep 600 | nc <ip> 8085` connection until
`PROBE|done` (see the other probes' READMEs). For the engine:

```
brs-cli --root test/simulator/probes/detached-init-focus-probe source/main.brs | grep PROBE
```

## Findings (Roku Express 4K+, OS 16.1.4, `device-trace-os16.1.txt`)

- **Focusing a mounted view hands the focus to the node it focused while detached** (S2, S3, S7). The
  links become `stack → view → col → target → self`, `view.hasFocus()` is false, and the view's observer
  doesn't need to forward. `focusable` on the view makes no difference (S7).
- **The target owns the chain afterwards.** Focusing `nav` clears every link down to the target's
  self-link.
- **Stale links in the scene don't do this** (S5, S6). The container focuses itself (`/container/self`),
  whether it is focusable or not.
- The target's observer runs before the view's, both in the detached `setFocus` and in the view's.
- A `DynamicCustomKeyboard` hands its focus to an internal child (S1: `target//self`, and the keyboard's
  `hasFocus()` is false). The engine doesn't model that child.

The engine matches the focus landing in every case. It still differs on these points:

- `isInFocusChain()`. On the device it follows the node's own links, so it is true inside a detached tree.
- The keyboard's internal child (S1).
- Notification order. The device notifies the target before the view, on the gain (the detached call and
  the view's) and on the unset (`nav` focused again). The engine notifies the view first.
- The stale leaf self-link in S5 and S6, which the engine clears.
