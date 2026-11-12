# PanelSet Slide Probe

Records, frame by frame, how a `PanelSet` slides its panels so brs-engine can match the device. It logs:

- each panel's `translation` and `boundingRect()`;
- the PanelSet's read-only fields (`slidingStatus`, `isGoingBack`, `numPanels`, `leftPanelIndex`);
- `Panel.isOffscreenLeft`;
- focus moves;
- when panels that slid off the right are removed;
- arrow visibility.

Every record carries milliseconds since the scene's `init()`.

## Shape

The probe uses an HD scene with a bare `PanelSet`. Panels A (narrow), B (wide), C (narrow) and D (wide) follow the typical app pattern: when the last panel gains focus, its `focusedChild` observer appends the next one, up to four. The probe drives itself with remote keys. It prints `PROBE|await|<Key>`, the host answers with an ECP `keypress`, and the next step starts 3 s later.

Steps, in order:

1. Right, Right (slide forward twice).
2. Left, Left (slide back).
3. Right, then two Rights 150 ms apart (a key pressed mid-slide).
4. Left ×3.
5. `Right_Left`: Right, then Left 150 ms later (interrupting a slide).
6. Left.
7. Play: the scene appends a full-screen panel F and focuses it. Then Left.
8. Fwd: `replaceChild(B2, 1)`. Then Left.
9. `slideDuration = 1.5`: Right, Left.
10. `slideDuration = 0`: Right, Left. This runs last because it leaves the device mid-slide (see below).

## Run it

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@panelset-slide-probe.zip http://<ip>/plugin_install
```

Then launch it with ECP (`keypress/Home`, `launch/dev`). Read the 8085 console and answer each `await` line with `keypress/<Key>`. A host driver that does this (using `nc`/`curl`, since macOS Local Network privacy blocks the `node` binary from LAN hosts) captured `device-trace-os16.0.txt`.

To capture `engine-trace.txt`, run `brs-cli --root <this dir> --ecp` (without `BRS_UI_TRANSITIONS=0`) and answer the same `await` lines on `127.0.0.1:8060`.

## Findings (Roku Express 4K+, OS 16.0)

- **Curve and timing.**
  - Every panel follows its own quintic ease-out `1-(1-u)^5`, lasting exactly `slideDuration`, which is in **seconds** (a Double, default 0.5; the reference's "integer milliseconds" is wrong).
  - Start offsets are fixed and **do not scale** with the duration. The leading-edge panel starts at +5 ms, the panel changing slots at +80 ms, and the arriving panel at +115 ms:
    - forward: panels ending off-left lead, then the left-slot panel, then the right-slot panel;
    - back: the panel exiting right leads, then the right-slot panel, then the left-slot panel and anything returning from the left.
  - `slidingStatus` rises one frame after the navigation and falls once every panel is within ~0.1 px of its slot: ≈540 ms at 0.5 s, ≈1344 ms at 1.5 s.
- **Layout.**
  - The gap between panels is **40 px** (not the reference's 30), and a narrow panel's `leftPosition` is **104** (not 105).
  - Off-left panels stack with the nearest one's right edge at x=0 and each further one a gap beyond. Exiting panels go to x=1280.
  - An appended panel starts at x=1280 when other panels move. When none move (the second panel joining a lone first one), it is placed directly in its slot. The very first incoming panel of a run was observed at x=2320; the engine uses 1280.
- **Field emissions.**
  - `translation` is written (and observers fire) every frame. Arrows are hidden for the whole slide.
  - `isGoingBack` **pulses** true→false around the focus move. It is not held for the slide.
  - Going back, `numPanels` drops immediately, but the panel sliding off the right stays a child until `slidingStatus` falls.
  - `isOffscreenLeft` becomes true at slide end. It becomes false once a returning panel's right edge reaches x≥0: immediately for the nearest stacked panel, mid-slide for one further out.
  - A full-screen panel counts as **two** in `numPanels`, notified 3 then 4.
- **Interaction.**
  - Going back from a full-screen panel focuses the panel just before it.
  - A key pressed mid-slide is handled immediately. A reversal retargets every panel from its current position, with fresh role offsets, inside the same `slidingStatus` pulse.
  - `replaceChild(panel, 1)` replaces the second **panel**, even though child index 1 is the internal right-arrow Poster. The new panel takes the old one's slot without sliding and inherits its focus.
- **`slideDuration = 0` is broken on the device.** Panels jump (still staggered), `slidingStatus` never falls, and the right-exiting panel is never removed. The engine deliberately treats it as an instant slide with a normal pulse.

## Known engine differences (not slide-related)

- Focus lost/gained notification order differs: the engine reports `old lost` before `new hasFocus`.
- On the device, appending the first panel focuses it.
- The CLI's ECP `keypress` holds the key for 300 ms (`src/cli/ecp.ts`), so the probe's two-Rights-150 ms step loses its second press on the engine.
