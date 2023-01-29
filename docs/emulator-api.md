# Emulator API

The emulator library has a programable interface to make it easy to integrate into any web based application. 
The only pre-requisite is to expose a `canvas` object named `display` on the default `document`.

## Methods

- brsEmu.**initialize**(customDeviceInfo?, disableKeys?, customKeys?, workerPath?) - Initialize the Emulator device
    - `customDeviceInfo` (object): customized device information 
    - `disableKeys` (boolean): if `true` disables the default keyboard handling for remote control emulation
    - `customKeys` (Map): a custom map of keyboard keys to add/remove to the remote control emulation
    - `workerPath` (string): the relative path to the worker library, the default is `.\lib\brsEmu.worker.js`
- brsEmu.**subscribe**(observerId, observerCallback) - Subscribes to the Emulator events (see list below)
    - `observerId` (string): Identifier of the subscriber process
    - `observerCallback` (function): Callback function to receive the events from the emulator
- brsEmu.**unsubscribe**(observerId) -  Unsubscribes to the Emulator events
    - `observerId` (string) - Identifier of the subscriber process
- brsEmu.**execute**(filePath, fileData, mute?) - Executes a source code, supports plain text or `zip` files
    - `filePath` (string) - Path of the loaded file, make sure extension is `.zip` if loading a full channel
    - `fileData` (string/Array/Blob) - Contents of the file or just string with code
    - `mute` (boolean) - If `true` the emulator will mute all audio playback but events are still raised.
- brsEmu.**terminate**(reason) - Terminates the current channel/source execution
    - `reason` (string) - The reason for the termination (showed on console)
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
    - `data` (object): Contains metadata: `{ id: string, file: string, title: string, subtitle: string, version: string, running: boolean }`
- **icon** - Triggered when the zip file is loaded and manifest links to a valid icon for the channel
    - `data` (base64): Contains a base64 string of the channel icon, extracted from the zip file.
- **started** - Triggered when the emulator started running the source code
    - `data` (object): Contains metadata: `{ id: string, file: string, title: string, subtitle: string, version: string, running: boolean }`
- **closed** - Triggered when the emulator terminated the execution of the source code
    - `data` (string): Contains the exit reason based on [Roku documentation](https://developer.roku.com/docs/developer-program/getting-started/architecture/dev-environment.md#lastexitorterminationreason-parameter)
- **reset** - Triggered when the `RebootSystem()` function is executed from the emulator
    - `data` (null): Nothing is returned as data.
- **redraw** - Triggered when the display canvas is redrawn/resized
    - `data` (boolean): If `true` the display canvas is in **full screen** mode
- **resolution** - Triggered when the emulated screen resolution changes (controled via BrightScript)
    - `data` (object): Contains screen dimensions: `{width: integer, height: integer}`
- **error** - Triggered when the any execution error happens
    - `data` (string): Contains the message describing the error
