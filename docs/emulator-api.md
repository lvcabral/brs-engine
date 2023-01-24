# Emulator API

The emulator library has a programable interface to make it easy to integrate into any web based application. 
The only pre-requisite is to expose a `canvas` object named `display` on the default `document`.

## Methods

- brsEmu.**initialize**(deviceInfo, supportSharedArray, disableKeys, keysMap, workerPath) - Initialize the Emulator device
    - `deviceInfo` (object): customized device information, to use default data just send an empty object
    - `supportSharedArray` (boolean): inform the emulator if `sharedArrayBuffer` is supported
    - `disableKeys` (boolean): if `true` disables the default keyboard remote control emulation
    - `keysMap` (Map): a custom mapping of keyboard keys to the remote control buttons
    - `workerPath` (string): the relative path to the worker library, the default is `.\lib\brsEmu.worker.js`
- brsEmu.**subscribe**(observerId, observerCallback) - Subscribes to the Emulator events (see list below)
    - `observerId` (string): Identifier of the subscriber process
    - `observerCallback` (function): Callback function to receive the events from the emulator
- brsEmu.**unsubscribe**(observerId) -  Unsubscribes to the Emulator events
    - `observerId` (string) - Identifier of the subscriber process
- brsEmu.**execute**(filePath, fileData) - Executes a source code, supports plain text or `zip` files
    - `filePath` (string) - Full path of the loaded file
    - `fileData` (string/Array/Blob) - Contents of the file
- brsEmu.**terminate**(reason) - Terminates the current channel/source execution
    - `reason` (string) - The reason for the termination (showed on console)
- brsEMu.**sendKeyDown**(key) - Send a remote control key down event to the emulator
    - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))
- brsEMu.**sendKeyUp**(key) - Send a remote control key up event to the emulator
    - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))
- brsEMu.**sendKeyPress**(key) - Send a remote control key press event to the emulator
    - `key` (string) - One of valid key codes (see [Roku documentation](https://developer.roku.com/docs/references/scenegraph/component-functions/onkeyevent.md))

## Events

- **version** - Triggered during the initialization of the emulator.
    - `data` (string): Contains the version of the library.
- **loaded** - Triggered when the source code data has finished loading
    - `data` (object): Contains metadata: `{ id: string, file: string, title: string, subtitle: string, version: string, running: boolean }`
- **icon** - Triggered when the zip file is loaded and manifest links to a valid icon for the channel
    - `data` (base64): Contains a base64 string of the channel icon, extracted from the zip file.
- **started** - Triggered when the emulator started running the source code
    - `data` (object): Contains metadata: `{ id: string, file: string, title: string, subtitle: string, version: string, running: boolean }`
- **closed** - Triggered when the emulator terminated the execution of the source code
    - `data` (object): Contains metadata: `{ id: string, file: string, title: string, subtitle: string, version: string, running: boolean }`
- **reset** - Triggered when the `RebootSystem()` function is executed from the emulator
    - `data` (null): Nothing is returned as data.
- **redraw** - Triggered when the display canvas is redrawn/resized
    - `data` (boolean): If `true` the display canvas is in **full screen** mode
- **resolution** - Triggered when the emulated screen resolution changes (controled via BrightScript)
    - `data` (object): Contains screen dimensions: `{width: integer, height: integer}`
- **dblclick** - Triggered when the user double clicks with the mouse on the display canvas
    - `data` (null): Nothing is returned as data.
- **error** - Triggered when the any execution error happens
    - `data` (string): Contains the message describing the error
