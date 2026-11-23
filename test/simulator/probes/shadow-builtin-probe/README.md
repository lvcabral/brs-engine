# shadow-builtin-probe

What happens when a channel ships a component named after a built-in node type? The probe's
`components/ButtonGroup.xml` extends **`Group`**, not `LayoutGroup`, so `isSubtype("LayoutGroup")`
tells the channel's component apart from the built-in. `components/RSGPalette.xml` is a shadow
rooted at `Node`.

| block | question |
| --- | --- |
| `S1` | `CreateObject("roSGNode", "ButtonGroup")`: does it build the channel component (does `init` run, is the scope bound, are the built-in's fields there)? |
| `S2` | The same, for `<ButtonGroup>` as an XML child. |
| `S3` | The firmware's own ButtonGroup inside a built-in `Dialog` (`dialog.buttonGroup`): which hierarchy does it report? |
| `S4` | Built-in `StdDlgButtonArea`: its parent type. |
| `S5` | `clone()` of the Node-rooted shadow `RSGPalette`, and of the `ButtonGroup` shadow. |
| `S6` | The shadow passed to a Task thread, and one created inside it. |
| `S7` | `LoginButtons extends ButtonGroup`: both `init`s run, and the base script's helper resolves in the subclass. |
| `S8` | `onKeyEvent`, defined only in the shadow, handles a key sent to the subclass. |

## Running

```bash
./pack.sh && curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@shadow-builtin-probe.zip http://<ip>/plugin_install
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh          # device -> out/trace.txt
npm run build:cli && ENGINE=1 ./drive.sh         # engine
```

`device-trace.txt`: Roku Express 4K+, OS 16.0.4. `engine-trace.txt`: the engine after the fix.

## Verdict

- **The channel definition wins everywhere:** for `CreateObject`, XML children, inside a Task, and in
  clones (S1, S2, S5, S6). The built-in `ButtonGroup`'s fields (`buttons`, `layoutDirection`) are
  gone, and `parentSubtype("ButtonGroup")` = `Group`.
- **The firmware's own instances follow the channel's hierarchy too.** `Dialog.buttonGroup` still has
  the built-in `buttons` field and no `shadowTag`, but it answers `isSubtype("LayoutGroup")` = false
  (S3). The hierarchy is keyed by name, and the channel's `extends` replaces the built-in's.
- **A Node-rooted shadow bare-clones** (S5): the clone's subtype is `Node`, `marker` is gone, and it has
  4 fields. That is the `clone-basetype-probe` rule, applied to the shadow's real root, not to the
  built-in.
- **Subclasses inherit the shadow's scripts** (S7, S8): `bgHelper()` resolves in both `init`s, `describe`
  reports `LoginButtons`, and the shadow's `onKeyEvent` handles the key.
- A component named after the type it extends (`<component name="ButtonGroup" extends="ButtonGroup">`)
  does not compile on the device: `Component "ButtonGroup" is extended from "ButtonGroup" more than once.`

## Open difference (not shadow-related)

On the device, `StdDlgButtonArea` extends `StdDlgAreaBase` and has no `buttons` field (S4). The engine
models it as extending `ButtonGroup`. That's why S4 is the only block where the traces still differ.
