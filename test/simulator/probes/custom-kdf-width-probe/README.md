# custom-kdf-width-probe

Checks how a device sizes the keys of a `DynamicCustomKeyboard` whose Key Definition File mixes
evenly divided rows with a row of explicit `keyWidthFHD` values that sum short of the board.

Both keyboards use a 447×522 (FHD) board with six rows of 6 auto-width keys and a last row of
3 explicit-width keys:

- `data/short3.json`: 3 × 148 = 444 (the shape of Tubi's search keyboard KDF)
- `data/short87.json`: 3 × 120 = 360

## Device result (Roku Express 4K+, OS 16.0.4, `device-screenshot.jpg`)

- Evenly divided sizes are **floored to whole pixels**: column dividers sit every 74 px from the
  board's left edge (floor(447 / 6) = 74) and row dividers every 74 px (floor(522 / 7) = 74). A
  6-key row is 444 px wide, so it ends exactly where the 3 × 148 row ends.
- Explicit widths are kept as given: the 3 × 120 row ends at 360 px, short of the rows above.

The engine used to divide fractionally (74.5 px keys filling all 447 px), which left the 3 × 148
row 3 px short. `computeLayout` (`nodes/kdf/KeyDefinition.ts`) now floors evenly divided section
widths, row heights and key widths for layouts that are not fitted onto bundled background art
(the built-in keyboards pass an inset and keep exact sizes to match their bitmaps).

Regression: "evenly divided key sizes are whole pixels, aligning with explicit-width rows" in
`test/extensions/scenegraph/DynamicKeyboard.test.js`.

## Running

Zip `manifest`, `source`, `components` and `data`, sideload, and take a screenshot
(`plugin_inspect`); no key presses are needed.
