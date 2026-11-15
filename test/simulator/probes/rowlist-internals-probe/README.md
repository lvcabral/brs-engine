# RowList Internals Probe

Dumps the **undocumented internal node tree** a device builds under a `RowList` (and, for comparison, a
`ZoomRowList`): the parent chain of every item component, each internal node's subtype, type hierarchy, fields
and children, and whether those nodes are recycled as the list scrolls. It was written to check the claim that a
RowList builds its rows from `PosterGrid`s, and to see whether the engine could reuse a grid node for the rows.

## Run

Device (sideload the zip made by `./pack.sh`, then let the driver run the whole scenario):

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-internals-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
```

Engine (after `npm run build:cli`):

```
ENGINE=1 ./drive.sh
```

The scene prints `PROBE|<seq>|await|<Key>|` and the driver answers each line with an ECP `keypress/<Key>`. On
`PROBE|<seq>|await|sgnodes|name=<n>` the driver saves ECP `query/sgnodes/all` as `device-sgnodes-<n>.xml` and
takes a screenshot (device only: the engine has no `sgnodes` endpoint). The driver keeps a single console
connection open across the launch. While `nc` reads from a stdin at EOF, the device keeps hanging up on it, which
loses whole blocks of the trace. Everything goes to `$OUT_DIR` (default `./out`), and `trace.txt` holds the
current run's `PROBE|` lines.

Committed captures: `device-trace-os16.0.txt` (Roku Express 4K+, OS 16.0.4), `device-sgnodes-{A-idle,A-down,
B-idle,C-idle,D-idle}.xml`, the screenshots `device-a-idle.jpg`, `device-a-down.jpg` and `device-d-idle.jpg`, and
`engine-trace.txt` (the engine after the fixes below).

## Shape

The scene is FHD. Content has 5 rows with 10, 10, 10, 3 and 10 items, titled `row<r>` / `R<r>C<c>`.
`ProbeItem` (a Rectangle and a Label) declares every documented item field, including `index` and `rowIndex`
(default `-1`). On its first `itemContent` it registers itself in `m.global.probeNodes` so the scene can walk its
`getParent()` chain.

| Case | Node | Fields |
| --- | --- | --- |
| A | RowList | `floatingFocus`, `numRows=3`, `itemSize=[1720,230]`, `rowItemSize` per row (300×170, 240×135, 400×225, 300×170, 240×135), `rowItemSpacing=[[20,0]]`, labels and counters on |
| B | RowList | A plus `fixedFocusWrap` and `rowTitleComponentName="ProbeTitle"` |
| D | RowList | A plus `rowTitleComponentName="ProbeTallTitle"` (an 80 px Rectangle), `showRowLabel=[true,false,true]`, row 2 retitled `""` |
| C | ZoomRowList | `rowWidth=1720`, one height per row, titles and counters on |

Phases: A `idle` → Right ×3 → `right` → Down ×2 → `down` → Down → `down-short`; B `idle` → Right → `right` →
Down ×2 → `down`; D `idle`; C `idle` → Down → `down`.

Records: `<case>.list` (the list itself), `<case>.tree` (whatever `getChild()` exposes), `<case>.chain` (each
item's parent chain up to the list; `#n` is the node's index in its parent's `getChild` list, `-2` means the
parent does not list it), `<case>.item` and `<case>.anc` (the full dump of each item and internal ancestor),
`.fields` (field names, once per subtype), `meta` (`getAllMeta()`, in 800-char chunks). Internal nodes are
labeled `a<k>` in the order they are first seen within a case.

## Findings (device, OS 16.0.4, FHD)

### The rows are not PosterGrids: each row is an internal `RowListItem` with a MarkupGrid in it

```
RowList                         getChildCount() = 0; the rows below are hidden from getChild()
└─ RowListItem  (one per row)   subtype "RowListItem", no parentSubtype, Group's 18 fields, focusable=true,
   │                            translation [0,0] for every row (rows are placed at draw time)
   ├─ [0] Label                 row label ("row1"); with rowTitleComponentName: a Group holding the title component
   ├─ [1] Label                 row counter ("1 of 10"), opacity 0 on rows that do not show it
   ├─ [2] MarkupGrid            visible only on the FOCUSED row
   └─ [3] Group                 ("RenderableNode" in sgnodes) visible on every OTHER row: a static strip of
                                item components at x = c·(itemWidth + spacing)
```

- **The focused row is a real `MarkupGrid`** (`MarkupGrid>ArrayGrid>Group>Node`, all 73 MarkupGrid fields).
  It has `numRows=1` and `numColumns=floor(itemSize[0] / (rowItemWidth + spacingX))` (5 for the 300 px row, 6 for
  the 240 px row of the 1720 px list). `itemSize` and `itemSpacing` come from the row's `rowItemSize` and
  `rowItemSpacing`. `horizFocusAnimationStyle` is the RowList's `rowFocusAnimationStyle`, and
  `vertFocusAnimationStyle` is `"fixedfocuswrap"`. `drawFocusFeedback=false`: the RowList draws the indicator
  itself. `content` is **the row's own ContentNode** (`isSameNode`). `currFocusColumn` follows the row's column,
  while `itemFocused` stays `-1`.
- **Focus never enters the internal nodes.** `RowList.focusedChild` is the RowList itself, and no
  `RowListItem`, `MarkupGrid` or item reports `hasFocus()` or `isInFocusChain()`.
- **The other rows are a plain Group of item components**, not a grid. That Group is `getChild(3)` of the
  `RowListItem` (index 3 in the item chain) and lists its items as children.
- **A row creates a second set of item components when it gains focus.** Down from row 0 to row 2 (case A) gives
  rows 1 and 2's MarkupGrids new `ProbeItem`s (serial 24 → 37), and their static Groups keep the old ones. Over the
  run, each R0 item was rendered by up to 3 different component instances.
- **The items of the focused row's MarkupGrid are mostly unparented.** The six on-screen R0C0–R0C5 items
  report `getParent() = invalid`, and `sgnodes` lists them as roots. The off-screen R0C6–R0C8 report the
  MarkupGrid as parent, but the MarkupGrid lists no children (`getChildCount()=0`, chain index `-2`).
- **Rows are created as they scroll into view and then kept.** At `idle` there are 4 `RowListItem`s for
  `numRows=3`. Scrolling to row 2 adds row 4's `RowListItem`, and the earlier ones stay the same nodes
  (`isSameNode`).
- **Item interface:** the documented `index` and `rowIndex` are set on every item before `itemContent` (the
  first-content line already shows `rowIndex=0 index=0`).
- **`rowTitleComponentName`:** one title component per row, created with the row (rows 0–3 at `idle`). Its
  `content` is set to the row's own ContentNode, and its `width`/`height` are never set. It sits inside a Group
  that is the `RowListItem`'s child 0, in place of the label.

### Row layout: a fixed pitch, and the label band never grows a row

Measured on the screenshots (FHD, list at y=160, `itemSize.y`=230, `rowLabelOffset.y`=8, the label font 36 px
tall):

| Screenshot | Rows' item tops | What it shows |
| --- | --- | --- |
| `device-a-idle.jpg` | 204, 434, 664 | the 44 px band (36 + 8) above each row's items; rows 230 px apart |
| `device-a-down.jpg` | 204, 434, 664 (rows 2–4) | row 2's 225 px items overflow its 230 px row, and row 3's label is drawn **over** them: the row does not grow |
| `device-d-idle.jpg` | 248, 478, 708 | the 80 px title makes an 88 px band; rows stay 230 px apart |

- **Each row takes exactly its row height (plus spacing).** A band taller than the row's room above its posters
  makes the posters overlap the next row; the row is not grown.
- **The band is `label height + rowLabelOffset.y` when the row shows its label or its counter.** The label
  height is the title component's height when there is one. A shown label keeps its band **even with an empty
  title** (D row 2 still draws its title component, `Tall []`), and a hidden title (D row 1, `showRowLabel`
  false) keeps the band too while the counter shows. This band on untitled rows is also what spaces
  `../rowlist-hero-grid-probe`'s "The Grid" rows.
- The title component is drawn at the band top, at x `rowLabelOffset.x`. The counter stays at the band top.
- At rest the rows are cut at the bottom of the `numRows` window (y=850 here, no row spacing), which cuts row 2's
  posters in `device-a-idle.jpg`. `../rowlist-window-clip-probe` shows that the window includes the trailing
  row spacing.

### ZoomRowList is different again

`ZoomRowList` reports the hierarchy `ZoomRowList>ItemScrollerBase>Group>Node`. Its rows are Groups (focusable,
hidden from `getChild`) holding `[Label, Label, Row]`. `Row` is a separate internal type: it has
`itemComponentName` and `content` (the row's own node) and lists no children, and the items report it as their
parent. All 5 rows exist from `idle`.

### Engine (`engine-trace.txt`) versus device

| Aspect | Device | Engine |
| --- | --- | --- |
| item `getParent()` | `Group`/`MarkupGrid` under a `RowListItem`, or `invalid` | the `RowList` (which does not list it) |
| internal row nodes | `RowListItem` per row, focused row has a `MarkupGrid` | none, the RowList draws the rows itself |
| item `index`/`rowIndex` | set before the first `itemContent` | the same (fixed; was never set) |
| `rowTitleComponentName` | title component per row, sizes the band | the same (fixed; was not implemented) |
| a band taller than the row's room | rows keep their pitch, items overlap | the same (fixed; the row used to grow by the band) |
| an empty row title with `showRowLabel` | band reserved | the same (fixed; no band was reserved) |
| items alive at A `idle` | 24 | 19 |
| `ZoomRowList` hierarchy | `>ItemScrollerBase>Group` | `>ArrayGrid>Group` |
