# Font Invalid Probe

Checks what a device does when a font field gets a value that is not a usable Font node: `invalid`, an unknown
`font:` name, a plain string, an empty string, another node, an integer, a bare `Font` node, and a `Font` whose `uri`
does not exist. For each case it records what the field reads back, what size the node measures, and whether
rendering survives. It covers dot assignment, `setFields()`, `setField()`, XML attributes, XML-declared fields, writes
from a Task, and the row label and caption space of `RowList` and `PosterGrid`. Written for #1253 (assigning
`invalid` to a `Label`'s `font` crashed the engine).

## Run

Device: `./pack.sh`, sideload `font-invalid-probe.zip`, connect `telnet <roku-ip> 8085` right after the app launches
(the console drops its clients on launch; the probe waits 5 seconds before printing), keep the lines from
`PROBE|start` to `PROBE|done` as `device-trace.txt`. Launch parameters (ECP `POST /launch/dev?<params>`):

- `only=<Node>.<field>` limits the render pass to that one field (`only=LabelList.font`).
- `layout=<names>` skips straight to the layout pass with only those nodes, separated by `-` (ECP drops a launch whose
  parameters contain a comma): `rlGood`, `rlBad`, `rlLater`, `pgGood`, `pgBad`, `pgLater`. `pgBad` only runs when
  named, because it kills the app.
- `run=<id>` is printed in the `PROBE|start` line, to tell runs apart in a console that replays older output.

Engine:

```bash
node packages/node/bin/brs.cli.js --root test/simulator/probes/font-invalid-probe
node packages/node/bin/brs.cli.js --root test/simulator/probes/font-invalid-probe --deep-link only=LabelList.font
node packages/node/bin/brs.cli.js --root test/simulator/probes/font-invalid-probe --deep-link layout=rlBad-pgBad
```

Output format: `PROBE|<node>.<field>|<case>|value=<readback>|w=<width>|h=<height>` (width and height only for the
text nodes, from `boundingRect()`). The render pass prints `set`, `shown` and `survived` for each field in turn, set to
`invalid` and then to `font:NoSuchFont`, with every other field on `font:LargeBoldSystemFont`. Then it sets them all to
`invalid` at once (`all-invalid`) and writes a Label's font from a Task, both on a Label the render thread owns
(`task`) and on one the Task creates (`task-owned`). The layout pass builds RowLists (`rl*`) and PosterGrids (`pg*`)
with real items and captions: `*Good` with LargeBold, `*Bad` with an invalid font from the start, and `*Later` with
LargeBold that turns `invalid` (step 2) and then `font:SmallestSystemFont` (step 3) after the first render.

The device console replays only part of its buffer on each reconnect, so `device-trace.txt` merges several runs of
the same code by case name, in the engine's order. The runs that kill the app are at the end.

## Results (Streaming Stick, OS 15.3.4, 2026-10-29)

- `invalid`, an unknown `font:` name, a string without the `font:` prefix (including a `pkg:/` path), `""` and a node
  that is not a Font (a `Rectangle`) all leave the field holding `invalid`, without a warning. This is the same for
  dot assignment, `setFields()` and `setField()` (which returns `true`), on the render thread and in a Task. An
  integer gives a type mismatch warning and the field keeps its font, and `setField()` returns `false`. `font:` names
  match case-insensitively.
- XML attributes behave the same: `font="garbage"`, `font=""` and `font="font:NoSuchFont"` on a `Label` read back
  `invalid` and measure 0x0.
- With an invalid font a device draws **no text**. It does not fall back to a default font. `Label` and
  `MonospaceLabel` measure 0x0. `Button` draws its icon without text. `ButtonGroup` buttons shrink to the icon width.
  `ScrollableText` is blank. A later valid font draws again.
- A `Label` with a `width` keeps that width, and the height of its previous font (wrapping or not).
  `ScrollingLabel` measures `maxWidth` wide and keeps its previous height.
- `RowList` lays its row label out once. With `rowLabelFont` invalid from the start it draws no label and leaves no
  label space: the items move up to the top of the list. A later `rowLabelFont` write changes nothing. The label keeps
  its first font and its space, whether the new value is `invalid` or another font.
- `PosterGrid` gives an invalid `caption1Font` no caption height. The grid is 130 high with LargeBold and 99 with an
  invalid font (31 is the LargeBold line height). The captions are still drawn in the font they first rendered with.
- **These kill the app (`EXIT_SYSTEM_KILL`) as soon as the node renders**: `LabelList.font` or
  `LabelList.focusedFont` set to `invalid`, and a `PosterGrid` with captions whose `caption1Font` is `invalid` from
  the start.
- A bare `Font` node reads back `size=1` and draws nothing. A `Font` with a `uri` that does not exist measures 0x0.
- On a node that extends `Node`, an XML-declared `type="font"` field reads back `invalid` whatever it is set to, even
  with `value="font:LargeBoldSystemFont"`, a valid name, or a `Font` node.

The engine now matches the readbacks on every path above, the no-text rendering, the RowList label space, and the
PosterGrid caption height for invalid fonts. These differences remain in `engine-trace.txt`:

- Where the device crashes (the `LabelList` and `PosterGrid` cases), the engine draws the node without that text.
- The engine doesn't copy the stale sizes: a fixed-width `Label` and a `ScrollingLabel` measure 0 high with an
  invalid font.
- PosterGrid captions are redrawn in the new font after a change, and an invalid caption font draws none.
- `setField()` returns `true` on a type mismatch.
- A font field on a node that extends `Node` holds Font nodes like any other font field.
- A bare `Font` node uses the default system font.
- The engine's default font sizes and font metrics differ from the device. A `Label`'s default font is 22 on a
  device and 24 in the engine, `ButtonGroup.textFont` and `Video` fonts read back `invalid` by default on a device,
  and RowList and PosterGrid bounding rects differ.
- A device `Button` keeps the same width whatever its `textFont` is, while the engine sizes it from the text.

Before the fix, the engine crashed with `font.createDrawFont is not a function` on the first `invalid` write. The same
crash happened in `ScrollingLabel`, `MonospaceLabel`, `ScrollableText`, `Button`, `ButtonGroup`, `RowList` and
`PosterGrid`. `setField()`, XML attributes and plain-Node fields also turned these strings into the default font or
rejected the node.
