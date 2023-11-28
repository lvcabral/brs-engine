# BrightScript Emulator API

The emulator library has a programable interface to make it easy to integrate into any web based application.
The only pre-requisites are:

1. Expose a `canvas` object named `display` on the default `document`.
2. Expose a `div` object named `stats` on the default `document` (optional if you want to show the performance statistics).

## Methods

| Method | Parameters |
| --- | --- |
|`initialize(customDeviceInfo?, options?)`<br>Initialize the Emulator device|`customDeviceInfo` (object): customized device information (see `/src/api/index.ts` for valid fields)<br>`options` (object): `{debugToConsole: boolean, disableKeys: boolean, customKeys: Map}`<br>&nbsp;&nbsp;- `debugToConsole` - default `true`: set this option to `false` to prevent messages to be sent to the `console`, you still can get debug messages using the `debug` event (see below)<br>&nbsp;&nbsp;- `showStats` - default `false`:  if `true` the performance statistics overlay will be shown over the display when the app is running.<br>&nbsp;&nbsp;- `disableKeys` - default `false`: if the emulator is running on a device with no keyboard, set this option to `true` and disable the default keyboard remote control emulation<br>&nbsp;&nbsp;- `customKeys` - optional: a custom map of keyboard keys to add/remove from the remote control emulation (see `/src/api/control.ts` for the default mappings) | 
|`subscribe(observerId, observerCallback)`<br>Subscribes to the Emulator events (see list below) | `observerId` (string): Identifier of the subscriber process<br>`observerCallback` (function): Callback function to receive the events from the emulator | 
|`unsubscribe(observerId)`<br>Unsubscribes to the Emulator events | `observerId` (string) - Identifier of the subscriber process |
|`execute(filePath, fileData, options?)`<br>Executes a source code, supports plain text, `zip` and `bpk` files | `filePath` (string) - Path of the loaded file, make sure extension is `.zip` or `.bpk` if loading a full app<br>`fileData` (string/Array/Blob) - Contents of the file or just a string with BrightScript code<br>`options` (object): `{clearDisplayOnExit: boolean, muteSound: boolean, execSource: Map}`<br>&nbsp;&nbsp;- `clearDisplayOnExit` (boolean) - If set to `false` the display will remain with the last image when app terminates (default is `true`)<br>&nbsp;&nbsp;- `muteSound` (boolean) - If `true` the emulator will mute all audio playback but events are still raised (default is `false`)<br>&nbsp;&nbsp;- `execSource` (string) - The execution source to be send on the input parameters for `sub Main(params)` (See [Roku documentation](https://developer.roku.com/en-gb/docs/developer-program/getting-started/architecture/dev-environment.md#source-parameter))<br>&nbsp;&nbsp;- `password` (string) - The password to decrypt the `.bpk` app file. (default is "") | 
|`terminate(reason)`<br>Terminates the current app/source execution | `reason` (string) - The reason for the termination (showed on debug) | 
|`redraw(fullScreen, width?, height?, dpr?)`<br>Request a display redraw (always keeps the aspect ratio based on display mode)| `fullScreen` (boolean) - Flag to inform if the full screen mode is activated<br>`width` (number) - Width of the canvas, if not passed uses `window.innerWidth`<br>`height` (number) - Height of the canvas, if not passed uses `window.innerHeight`<br>`dpr` (number) - Device pixel ration, if not passed uses `window.devicePixelRatio`|
|`getDisplayMode()`<br>Returns the current display mode. ||
|`setDisplayMode(mode)`<br>Configure the display mode. If an app is running will reset the device | `mode` (string) - Supported modes: `"480p"` (SD), `"720p"` (HD) or `"1080p"`(FHD)|
|`getOverscanMode()`<br>Returns the current overscan mode.||
|`setOverscanMode(mode)`<br>Configure the overscan mode. Can show guidelines or actually cut the frame | `mode` (string) - Supported modes: `"disabled"`, `"guidelines"` or `"overscan"`|
|`enableStats(state)`<br>Enable or disable the Performance Stats overlay | `state` (boolean) - If `true` performance statistics will be shown over the display
|`getAudioMute()`<br>Return `true` if the audio is muted ||
|`setAudioMute(mute)`<br>Mute or un-mute the audio during app execution | `mute` (boolean) - If `true` the audio will be muted |
|`getSerialNumber()`<br>Return the device serial number | This returned value changes when the `deviceData.deviceModel` is updated |
|`setCustomKeys(keysMap)`<br>Send a custom map of keyboard keys to add/remove from the remote control emulation  | `keysMap` (Map) - See `/src/api/control.ts` for the default mappings |
|`sendKeyDown(key)`<br>Send a remote control key down event to the emulator | `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md)) |
|`sendKeyUp(key)`<br>Send a remote control key up event to the emulator| `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))|
|`sendKeyPress(key, delay?)`<br>Send a remote control key press event to the emulator| `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md)) <br> `delay` (number) - The delay (in milliseconds) between sending Key Up and Key Down (default is 300ms)|
|`debug(command)`<br>Send a debug command to the Micro Debugger| `command` (string) - The Micro Debugger can be enabled sending `break` command, and after that any valid BrightScript expression or [debug commands](https://developer.roku.com/en-gb/docs/developer-program/debugging/debugging-channels.md#brightscript-console-port-8085-commands) can be sent. You can use this method on the browser console to debug your app.|
|`getVersion()`<br>Returns the version of the API library ||

## Events

| Event      | Description                                      | Data Type                         |
|------------|--------------------------------------------------|-----------------------------------|
| loaded     | Triggered when the source code data has finished loading | object: `{id: string, file: string, title: string, subtitle: string, version: string, running: boolean}`|
| icon       | Triggered when the zip file is loaded and manifest links to a valid icon for the app | base64: A base64 string of the app icon, extracted from the zip file. |
| registry   | Triggered when the app updates the registry | Map: the registry with all recent recent updates. |
| started    | Triggered when the emulator started running the source code | object: `{id: string, file: string, title: string, subtitle: string, version: string, running: boolean}` |
| closed     | Triggered when the emulator terminated the execution of the source code | string: the exit reason based on [Roku documentation](https://developer.roku.com/docs/developer-program/getting-started/architecture/dev-environment.md#lastexitorterminationreason-parameter) |
| reset      | Triggered when the `RebootSystem()` function is executed from the emulator | null: Nothing is returned as data |
| redraw     | Triggered when the display canvas is redrawn/resized | boolean: If `true` the display canvas is in **full screen** mode |
| resolution | Triggered when the emulated screen resolution changes (controlled via BrightScript) | object: `{width: integer, height: integer}` |
| debug      | Triggered when debug messages arrive from the worker library (BrightScript Interpreter) | object: `{level: string, content: string}`, levels are: `print`, `beacon`, `warning`, `error`, `stop`, `continue` |
| error      | Triggered when the any execution exception happens on the API library | string: The message describing the error |
