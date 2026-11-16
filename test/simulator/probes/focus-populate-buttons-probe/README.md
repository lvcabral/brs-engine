# Focus Populate Buttons Probe

This probe measures two focus behaviors behind JellyRock bugs that showed up only in the engine:

- **A (library grid).** The Collections screen focuses its first item, but the backdrop stays empty. JellyRock's
  `BaseGridView` assigns an empty `ContentNode` to a MarkupGrid in `init()`. When a Task delivers items, it
  focuses the grid, writes `jumpToItem = 0` and appends the items in place. The backdrop is set from an
  `itemFocused` observer.
- **B (detail screen buttons).** On the detail screen's button row, the focus border stays on every button
  the user passes. JellyRock's `JRButtonGroup` (a `ButtonGroup` of custom Group buttons) moves the focus
  with `current.setFocus(false)`, `buttonFocused = i`, `next.setFocus(true)`. Each `IconButton` paints its
  border from a `focusedChild` observer that reads `hasFocus()`. The screen is a sgRouter view: the
  router's outlet observes its `focusedChild`, and when the chain leaves it, the view's `handleFocus`
  re-focuses its saved node (`lastFocus`, the button row).

## Shape

The scene is FHD. Every line is `PROBE|<seq>|<case>|<event>|...`. A Timer drives the steps, and the
`await|<Key>` lines are answered by `drive.sh` with ECP keypresses.

- **A1:** from a Timer observer, a focused MarkupGrid with empty content gets `setFocus`, `jumpToItem = 0`,
  and then eight appended items.
- **A2:** A1 without the `jumpToItem`.
- **A3:** the empty grid is focused in one handler and filled in a later one.
- **A4:** the grid is filled while unfocused, then focused.
- **A5:** `jumpToItem = 3`, then four more items.
- **A6:** all children are removed and eight added again.
- **B1:** the JRButtonGroup replica. The empty, hidden row is focused, the buttons are built, and the first
  button is focused directly. Then Right ×4 and Left ×4.
- **B2:** like B1, but the row itself is focused again after its first button (a screen re-shown).
- **B3/B4:** B1 under an sgRouter-style outlet that re-focuses the row whenever the chain leaves it. In B3
  the row is focused first; in B4 the first button is focused first.

## Capture

```
./pack.sh && curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@focus-populate-buttons-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> OUT_DIR=./out-device ./drive.sh
ENGINE=1 OUT_DIR=./out-engine ./drive.sh   # after npm run build:cli; ECP on 8061 (BRS_ECP_PORT)
```

## Findings (Roku Express 4K+, OS 16.0, `device-trace-os16.0.txt`)

1. **A focus gain on an empty grid publishes `itemFocused` -1** (A1–A3).
2. **In-place content changes publish nothing at the write.** Once the handler returns, a focused grid publishes
   `itemFocused` for the item it is on: 0 after the first fill (A1–A3), 3 after the append (A5), and 3 after
   clear and refill (A6). An unfocused grid takes 0 silently (A4 reads 0 right after the fill), and the later
   gain publishes 0 twice (the gain, then the pending republish).
3. **`setFocus(false)` notifies the chain from the focused node up** (B1, B3, B4: button, row, outlet). In B3/B4
   the outlet's restore of the row runs after the row and button were already notified in that round. The row
   gets no new notification, never forwards back to the button, and only the next button shows a border.
4. **A gain notifies from the leaf up** too (B3/B4: button, row, outlet).
5. **`setFocus(true)` on the row while its button holds the focus keeps the focus on the button** (B2). The
   button and the row are notified again, and the row reports `hasFocus()` false.

## Engine (`engine-trace.txt`)

Before the fix, A1–A3 published no `itemFocused` at all, and B3/B4 left every button the focus passed with
`hasFocus()` true and its border on. The engine now matches A1–A6 line for line and the B3/B4 border states.
Still different: the gain order (finding 4; the engine notifies root-down) and B2 (the engine moves the focus to
the row, which forwards to the button). See `.claude/docs/scenegraph-invariants.md`.
