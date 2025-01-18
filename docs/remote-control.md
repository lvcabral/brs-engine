# Remote Control Simulation

The `brs-engine` simulates the Roku remote control, offering customizable mapping and extendable capabilities. The browser libraries support **Keyboard** and **Game Pad** simulation, with the default mapping detailed in the section below. It is also possible to [customize the control buttons mapping](./customization.md#control-mapping) and [enable multi-key support](./customization.md#app-manifest) using a special `manifest` entry.

If you want to create your own control simulation, such as a touch screen control, you can use the [Engine API](./engine-api.md) methods `sendKeyDown`, `sendKeyUp`, and `sendKeyPress`.

For applications [running under the CLI](./run-as-cli.md) the NodeJS library `brs.ecp.js` supports control commands via the **Keyboard** (option `--tty`) or [Roku ECP API](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md), which can be enabled as a server using the `--ecp` option.
## Keyboard and Game Pad Control Reference

The default mapping of the keyboard and game pads to Roku remote control is described below:

| Browser Keys  | TTY Keys  | Game Pad   | Roku Control  | Description                                                           |
|---------------|-----------|------------|---------------|-----------------------------------------------------------------------|
| Esc/Del       | Esc/Del   |      1     |     Back      | Return to the previous screen, some apps will close at the main menu. |
| Home/Shift+Esc| Home/Ctrl+D|     8     |     Home      | Close the currently loaded app.                                       |
| Arrow Keys    | Arrow Keys| D-Pad or Joys|   D-Pad     | Directional controls to navigate on menus and control games.          |
| Backspace     | Backspace |   6 or 16  |     Replay    | Instant replay button.                                                |
| Enter         | Return    |     0      |     OK        | Select button.                                                        |
| Insert        | Insert    |   4 or 7   |     Info      | Information/Settings button                                           |
| PageDown      | Comma/PgDown|    2     |     Rewind    | Reverse scan button.                                                  |
| PageUp        | Period/PgUp |    3     |  Fast Forward | Forward scan button.                                                  |
| End           | Space/End |   5 or 9   |  Play/Pause   | Play/Pause button.                                                    |
| Ctrl+A        | A         |     10     |     A         | A game button.                                                        |
| Ctrl+Z        | Z         |     11     |     B         | B game button.                                                        |
| F10           | _n.a._    |     17     |  Volume Mute  | Button to toggle the simulator audio mute on/off.                     |

**Note:** There are mappings not listed above, specific for MacOS or Windows, please look at the file [`src/api/control.ts`](../src/api/control.ts) for details.

<p align="center">
<img src="./images/remote-mapping.png"/>
</p>
