# TrickPlayBar Children Probe

Dumps the **undocumented internal child tree** that a device builds under `Video.trickPlayBar` (plus the
`bufferingBar` / `retrievingBar` ProgressBars and the whole `Video` tree), so brs-engine can reproduce the
order and shape apps already depend on. Origin: issue #1294 — jellyfin-roku reads
`m.top.trickPlayBar.getChild(8)` as the position Label and `getChild(3)` as the ticker, and crashed in the
engine because the bar only had 5 children.

## Run

Device (sideload `./pack.sh`'s zip, then capture the debug console on port 8085):

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@trickplaybar-children-probe.zip http://<ip>/plugin_install
curl -X POST http://<ip>:8060/launch/dev
nc <ip> 8085          # connect within the 8 s startup sleep
```

The probe streams an HLS sample, so it needs network on the device. When it prints `PROBE|…|wait|ready|…`
send **one ECP `Play` key** (`curl -X POST http://<ip>:8060/keypress/Play`) so the real player pauses and
shows its bar at the mid-stream position the probe seeked to. Without the key the `bar` phase samples a
hidden bar. See the `roku-probe-device` memory for the reconnect-loop capture that works with the console.

Engine:

```
node packages/node/bin/brs.cli.js --root test/simulator/probes/trickplaybar-children-probe
```

The CLI cannot play video, so the engine run times out in the `play` phase (`reason=timeout:none`) and the
`bar*` / `hash*` phases there show an unplayed bar. The structural phases (`idle`, `standalone`) are the
comparable ones.

Committed traces: `device-trace-os16.0.txt` (Roku Express 4K+, OS 16.0.4) and `engine-trace.txt` (engine
after the fix this probe drove).

## Output format

```
PROBE|<seq>|<phase>|<case>|<key=value ...>
```

Phases: `idle` (before playback) → `standalone` (a `TrickPlayBar` created with `CreateObject`) → `play` →
`wait` → `bar` (paused at ~900 s, bar shown) → `bar2` (seeked to 1795 s) → `hash`, `hash1`, `hash5`,
`hash0` (`hashMarkPositions` set to 3, 1, 5, 0 entries). Rects print as `{x= y= w= h=}`.

## Findings (device, OS 16.0.4, FHD)

### `Video.trickPlayBar` is a 12-child node, not 5

| idx | subtype | notes |
| --- | --- | --- |
| 0 | Poster | track, 1716×18, `opacity` 0.3 while the bar is shown |
| 1 | Poster | filled bar, **full width** 1716×18, shown through `clippingRect` `{0,0,floor(tickerX+9),18}` |
| 2 | Poster | thumb, 18×18, `blendColor` `0x671dc5ff`, follows the ticker |
| 3 | Poster | ticker, 18×18, `blendColor` `0xffffffff` (`getChild(3)` in jellyfin-roku) |
| 4–6 | Poster | hash marks, 10×10, `visible=false`, at `[1+k·426, 4]` for k = 1..3 |
| 7 | Poster | thumbnail holder, 75×45 at `[820.5, 33]`, with one hidden 75×45 Poster child |
| 8 | Label | **position** text (`getChild(8)` in jellyfin-roku), `[0,36]`, left, size 36 |
| 9 | Label | **remaining** text, right edge at the bar width (`[1645,36]` for `"0:00"`), size 36 |
| 10 | Poster | live icon, 36×36 at `[1585,36]`, `blendColor` `0xd53e5aff`, hidden |
| 11 | Label | `"LIVE"`, size 45, `[1621,36]`, hidden |

All Label colors are `0xfefefeff` (`textColor`). The standalone `TrickPlayBar` (`CreateObject`) has the same
12 children. HD values are the FHD ones scaled by 2/3 (not measured on a device).

### Ticker, fill and text

Two device samples fix the math (`position`, `duration` in seconds, `barW` 1716, ticker width 18):

| sample | tickerX | label 8 / 9 |
| --- | --- | --- |
| paused near 903 s of 1800 | 850.698 | `15:03` / `14:56` |
| near 1786 s of 1800 | 1684.416 | `29:46` / `0:13` |

- `tickerX = position / duration × (barW − 18)` (the ticker travels the track minus its own width; the old
  engine used `position / duration × barW − 18`).
- The filled bar's `clippingRect` width is `floor(tickerX + 9)` (idle: 9). Children 2 and 3 share `tickerX`.
- Times are `M:SS` with **unpadded minutes** (`0:13`, `15:03`), `H:MM:SS` from one hour; both are floored,
  and both start as `"0:00"`.

### `hashMarkPositions` manages real children

Defaults: `hashMarkBlendColor` `0xffffffff`, `hashMarkPositions` `[]`. A mark sits at
`x = 1 + position × (barW − 12)`, `y = 4`, and becomes visible when the array is non-empty. The existing
marks are **reused in place and in order**, surplus ones are removed from the end, and missing ones are
appended after every other child:

| set to | child count | result |
| --- | --- | --- |
| `[0.1, 0.5, 0.9]` | 12 | marks stay at 4, 5, 6 |
| `[0.2]` | 10 | mark at 4; the two others removed (labels shift to 6 and 7) |
| `[0.1 … 0.5]` (from the 1-mark state) | 14 | mark at 4, extras appended at 10–13 |
| `[]` (from 5 marks) | 12 | three hidden marks at the default slots 0.25 / 0.5 / 0.75 (indexes 4, 10, 11) |

### Other trees, not replicated yet

- **`Video` does not own the bar directly.** It has two children, `VideoBackground` and a `Group` whose 14
  children are, in order: `ClosedCaptionLabel`, `Poster`, title `Group` (ScrollingLabel + Label),
  `RetrievingBar` (`ProgressBar` + `Label "Retrieving"`), `BusySpinner`, `BifDisplay` (16 children), the
  `TrickPlayBar`, `BottomHudButtonBar`, `Poster`, the buffering `ProgressBar`, `Label "Loading"`, `Poster`,
  `Label`, `Clock` (4 children). The engine's `Video` has 6 direct children with the bar as the last one, so
  `trickPlayBar.getParent()` and `video.getChild(n)` differ. See the `video-tree` records.
- **`bufferingBar` / `retrievingBar`** are `ProgressBar`s with 4 `Poster` children on a device and none in the
  engine; `retrievingBar` sits inside a `RetrievingBar` node.

## Known remaining differences (engine vs device)

Child order, subtypes, texts, hash-mark behavior, ticker/fill geometry and the `getChild(8)` workflow match.
Left as-is on purpose:

- The device reports `filledBarBlendColor` and child 1's `blendColor` as `0xffffffff` and puts the purple
  `0x671dc5ff` on child 2; the engine keeps its existing purple fill (`0x671dc5ff` on child 1, a value taken
  from an earlier debugger inspection) and hides child 2, because no device screenshot is available to settle
  which node is drawn purple.
- Children 2 and 3 are `visible=true` on a device even before a position is known; the engine hides them until
  `setPosition` runs.
- The remaining Label uses the device translation only at the engine's fixed `[1542,36]` width-174 right
  alignment; the device auto-sizes it (`width=0`, `x = barW − textWidth`).
- Device `uri` fields on these Posters read `""` (internal bitmaps) and the hash marks / thumbnail holder have
  no artwork; the engine uses the ticker bitmap scaled to 10×10 for the marks.
- The bar's `translation` is `[0,0]` while hidden and `[102,948]` once shown on a device; `opacity` fades to 0
  on hide. The engine keeps `[102,948]` and toggles `visible` only.
- Hidden nodes report real `boundingRect()`s on a device; the engine reports zero rects until first layout.
