# BrightScript Emulator API

The emulator library has a programable interface to make it easy to integrate into any web based application.
The only pre-requisite is to expose a `canvas` object named `display` on the default `document`.

## Methods

- brsEmu.**initialize**(customDeviceInfo?, options?) - Initialize the Emulator device
  - `customDeviceInfo` (object): customized device information (see `/src/api/index.ts` for the valid fields)
  - `options` (object): {debugToConsole: boolean, disableKeys: boolean, customKeys: Map}
    - `debugToConsole` - default `true`: set this option to `false` to prevent messages to be sent to the `console`, you still can get debug messages using the `debug` event (see below)
    - `showStats` - default `false`:  if `true` the performance statistics overlay will be shown over the display when a channel is running.
    - `disableKeys` - default `false`: if the emulator is running on a device with no keyboard, set this option to `true` and disable the default keyboard remote control emulation
    - `customKeys` - optional: a custom map of keyboard keys to add/remove from the remote control emulation (see `/src/api/control.ts` for the default mappings)
- brsEmu.**subscribe**(observerId, observerCallback) - Subscribes to the Emulator events (see list below)
  - `observerId` (string): Identifier of the subscriber process
  - `observerCallback` (function): Callback function to receive the events from the emulator
- brsEmu.**unsubscribe**(observerId) - Unsubscribes to the Emulator events
  - `observerId` (string) - Identifier of the subscriber process
- brsEmu.**execute**(filePath, fileData, clearDisplayOnExit?, mute?, execSource?) - Executes a source code, supports plain text or `zip` files
  - `filePath` (string) - Path of the loaded file, make sure extension is `.zip` if loading a full channel
  - `fileData` (string/Array/Blob) - Contents of the file or just a string with BrightScript code
  - `clearDisplayOnExit` (boolean) - If set to `false` the display will remain with the last image when channel terminates (default is `true`)
  - `mute` (boolean) - If `true` the emulator will mute all audio playback but events are still raised (defaut is `false`)
  - `execSource` (string) - The execution source to be send on the input parameters for `sub Main(params)` (See [Roku documentation](https://developer.roku.com/en-gb/docs/developer-program/getting-started/architecture/dev-environment.md#source-parameter))
- brsEmu.**terminate**(reason) - Terminates the current channel/source execution
  - `reason` (string) - The reason for the termination (showed on debug)
- brsEMu.**redraw**(fullscreen, width?, height?, dpr?) - Request a display redraw (always keeps the aspect ratio based on display mode)
  - `fullscreen` (boolean) - Flag to inform if the full screen mode is activated
  - `width` (number) - Width of the canvas, if not passed uses `window.innerWidth`
  - `height` (number) - Height of the canvas, if not passed uses `window.innerHeight`
  - `dpr` (number) - Device pixel ration, if not passed uses `window.devicePixelRatio`
- brsEMu.**getDisplayMode**() - Returns the current display mode.
- brsEMu.**setDisplayMode**(mode) - Configure the display mode. If a channel is running will reset the device
  - `mode` (string) - One of the supported modes: `"480p"` (SD), `"720p"` (HD) or `"1080p"`(FHD)
- brsEMu.**getOverscanMode**() - Returns the current overscan mode.
- brsEMu.**setOverscanMode**(mode) - Configure the overscan mode. Can show guidelines or actually cut the frame
  - `mode` (string) - One of the supported modes: `"disabled"`, `"guidelines"` or `"overscan"`
- brsEMu.**enableStats**(mode) - Enable or disable the Performance Stats overlay
  - `state` (boolean) - If `true` panels with performance statistics will be shown over the display
- brsEMu.**getAudioMute**() - Return `true` if the audio is muted
- brsEMu.**setAudioMute**(mute) - Mute or unmute the audio during channel execution
  - `mute` (boolean) - If `true` the audio will be muted
- brsEMu.**sendKeyDown**(key) - Send a remote control key down event to the emulator
  - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))
- brsEMu.**sendKeyUp**(key) - Send a remote control key up event to the emulator
  - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))
- brsEMu.**sendKeyPress**(key) - Send a remote control key press event to the emulator
  - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))
- brsEMu.**getVersion**() - Returns the version of the API library

## Events

- **version** - Triggered during the initialization of the emulator.
  - `data` (string): Contains the version of the worker library.
- **loaded** - Triggered when the source code data has finished loading
  - `data` (object): Contains metadata: `{id: string, file: string, title: string, subtitle: string, version: string, running: boolean}`
- **icon** - Triggered when the zip file is loaded and manifest links to a valid icon for the channel
  - `data` (base64): Contains a base64 string of the channel icon, extracted from the zip file.
- **started** - Triggered when the emulator started running the source code
  - `data` (object): Contains metadata: `{id: string, file: string, title: string, subtitle: string, version: string, running: boolean}`
- **closed** - Triggered when the emulator terminated the execution of the source code
  - `data` (string): Contains the exit reason based on [Roku documentation](https://developer.roku.com/docs/developer-program/getting-started/architecture/dev-environment.md#lastexitorterminationreason-parameter)
- **reset** - Triggered when the `RebootSystem()` function is executed from the emulator
  - `data` (null): Nothing is returned as data
- **redraw** - Triggered when the display canvas is redrawn/resized
  - `data` (boolean): If `true` the display canvas is in **full screen** mode
- **resolution** - Triggered when the emulated screen resolution changes (controled via BrightScript)
  - `data` (object): Contains screen dimensions: `{width: integer, height: integer}`
- **fps** - If enabled by the `enableFps()` method (see above) triggered every 15 frames
  - `data` (number): Contains the average Frames per Second of the last 15 frames
- **debug** - Triggered when debug messages arrive from the worker library (BrightScript Interpreter)
  - `data` (object): Contains: `{level: string, content: string}`, levels are: `print`, `beacon`, `warning` and `error`
- **error** - Triggered when the any execution exception happens on the API library
  - `data` (string): Contains the message describing the error
