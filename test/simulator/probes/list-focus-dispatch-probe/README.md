# List Focus Dispatch Probe

This probe answers four questions about a list's focus fields (LabelList/MarkupList), raised by the
review of the list focus motion:

1. When does an observer of `itemFocused` run if the move comes from inside another observer:
   inline, or after that observer returns?
2. Does a focus gain publish `itemUnfocused`?
3. In what order does `jumpToItem` publish the old item, `itemUnfocused`, the new item and `itemFocused`?
4. What does the list publish when `setFocus` runs in `init()`, and when new content is assigned?

## Shape

The scene is HD, with a MarkupList (`list`, 10 items, `floatingFocus`) whose item component prints every
`itemHasFocus` change, and a focusable Rectangle (`other`). Every line is `PROBE|<ms since init>|...`.
Each step prints `... returned` right after its last call, so an observer line printed before it ran
inline.

- **S:** `init()` assigns the content, then calls `setFocus(true)`.
- **R1–R4** (from a Timer observer): the focus leaves and comes back. R1 keeps the item; R2 does an
  unfocused `jumpToItem` to another item; R3 to the same item; R4 two jumps that end on the same item.
- **D1** (Timer): `jumpToItem` on the live list.
- **D2** (Timer): a list created, filled, attached, focused and `jumpToItem`'d in one handler.
- **D5** (Timer): the live list gets new content, then `jumpToItem`.
- **D3/D4:** D1 and D2 again, from a field observer raised by `Main` writing a scene field.

## Capture

```
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh             # packs, sideloads, captures out/device-trace.txt
./pack.sh && brs-cli list-focus-dispatch-probe.zip  # engine trace (the PROBE| lines)
```

## Findings (Roku Express 4K+, OS 16.0, `device-trace-os16.0.txt`)

1. **Every observer runs inline.** In all of D1–D5, from a Timer observer or a `Main`-raised field
   observer alike, on a live list or one created in the same handler, the `itemFocused` observer runs
   before `setFocus`/`jumpToItem` returns. The `deferred-observer-app` CLI fixture, unguarded, crashes on
   the device inside its `onSelected` handler for that reason.
2. **A gain never publishes `itemUnfocused`.** The item's `itemHasFocus` and then `itemFocused` (S, R1–R4,
   D3). An unfocused `jumpToItem` publishes `itemUnfocused` -1 at the write, every time (R2–R4), and the
   gain then lands on the target.
3. **`jumpToItem` order:** the old item's `itemHasFocus` false, `itemUnfocused`, the new item's
   `itemHasFocus` true, `itemFocused` (D1, D3). The new item gets its focus even when it was off screen.
4. **New content publishes its reset lazily.** The content write itself publishes nothing (D5). `itemFocused`
   0 goes out before the next `jumpToItem` (D2, D5: 0, then `itemUnfocused` 0, then the target), or once
   `init()` returns (S: the gain's 0 inside `init()`, then a second 0 after it).

## Engine

`engine-trace.txt` is the engine after the fixes (`.claude/docs/scenegraph-invariants.md`, "The list focus
model"). Every list field matches the device trace. The remaining differences are in item components: the
device sets a new component's `itemHasFocus` before its `itemContent`, and creates the target item's
component during `jumpToItem`, where the engine creates it at the next paint.
