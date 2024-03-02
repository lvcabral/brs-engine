# Changelog

<a name="v1.3.1"></a>

## [v1.3.1 - MicroDebugger Improvements](https://github.com/lvcabral/brs-engine/releases/tag/v1.3.1) - 02 Mar 2024

### Release Changes

* Micro debugger improvements by [@lvcabral](https://github.com/lvcabral) in [280](https://github.com/lvcabral/brs-engine/pull/280)
  * Added to the API `initialize` method a new option: `disableDebug`
  * Added to the MicroDebugger support for `Function`, `If`,  `For` and `While`
  * Added support for MicroDebugger on CLI
  * Fixed MicroDebugger formatting issues and the handling of linefeed
  * Moved command parsing code from API to MicroDebugger
  * Added `quit` command to the MicroDebugger
* Added #278 - Support to ECP control keys `VolumeMute` and `PowerOff` by [@lvcabral](https://github.com/lvcabral) in [279](https://github.com/lvcabral/brs-engine/pull/279)

[Full Changelog][v1.3.1]

<a name="v1.3.0"></a>

## [v1.3.0 - New method: ifDraw2D.drawTransformedObject()](https://github.com/lvcabral/brs-engine/releases/tag/v1.3.0) - 19 Feb 2024

### Release Changes

* Added #272 `ifDraw2d` method `drawTransformedObject()` by [@lvcabral](https://github.com/lvcabral) in [#275](https://github.com/lvcabral/brs-engine/pull/275)
* Fixed #274 - MicroDebugger truncate String variable to max 94 characters by [@lvcabral](https://github.com/lvcabral) in [#276](https://github.com/lvcabral/brs-engine/pull/276)
* Fixed #273 - MicroDebugger not exiting properly with `exit` command by [@lvcabral](https://github.com/lvcabral) in [#277](https://github.com/lvcabral/brs-engine/pull/277)

[Full Changelog][v1.3.0]

<a name="v1.2.11"></a>

## [v1.2.11 - New API Event: `control`](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.11) - 14 Feb 2024

### Release Changes

* Added `control` event triggered when `keydown` and `keyup` are sent to the engine by [@lvcabral](https://github.com/lvcabral) in [#270](https://github.com/lvcabral/brs-engine/pull/270)
  * Created to allow the apps to have access to the control keys
  * Updated API documentation
* Removed "Loading..." message when running apps without splash, only showing the icon (Roku updated behavior)

[Full Changelog][v1.2.11]

<a name="v1.2.10"></a>

## [v1.2.10 - New roString methods and Keyboard mapping](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.10) - 12 Feb 2024

### Release Changes

* Fixed #265 - Implemented `roString` methods `startsWith()` and `endsWith()` by [@lvcabral](https://github.com/lvcabral) in [#266](https://github.com/lvcabral/brs-engine/pull/266)
* Fixed #267 - Allow map modification keys (Shift, Control, Alt and Meta) independently by [@lvcabral](https://github.com/lvcabral) in [#268](https://github.com/lvcabral/brs-engine/pull/268)
* Improved performance of creating encrypted package by [@lvcabral](https://github.com/lvcabral) in [#269](https://github.com/lvcabral/brs-engine/pull/269)


[Full Changelog][v1.2.10]

<a name="v1.2.9"></a>

## [v1.2.9 - Fixes: roByteArray and roVideoPlayer](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.9) - 05 Feb 2024

### Release Changes

* Fixed #260 - `roByteArray` - Capacity calculation now behave as Roku by [@lvcabral](https://github.com/lvcabral) in [#261](https://github.com/lvcabral/brs-engine/pull/261)
* Fixed #255 - `roVideoPlayer` - Seek now behave as Roku by [@lvcabral](https://github.com/lvcabral) in [#262](https://github.com/lvcabral/brs-engine/pull/262)
* Fixed #263 - Checking the Game Pad buttons map on event handler by [@lvcabral](https://github.com/lvcabral) in [#264](https://github.com/lvcabral/brs-engine/pull/264)

[Full Changelog][v1.2.9]

<a name="v1.2.8"></a>

## [v1.2.8 - Video: Play List Fixes](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.8) - 03 Feb 2024

### Release Changes

* Fixed #252 - Clear the audio tracks list when switching videos by [@lvcabral](https://github.com/lvcabral) in [#256](https://github.com/lvcabral/brs-engine/pull/256)
* Fixed #253 - Safari native HLS support not selecting default audio track by [@lvcabral](https://github.com/lvcabral) in [#257](https://github.com/lvcabral/brs-engine/pull/257)
* Fixed #254 - Keep the audio track selection on each playlist video metadata by [@lvcabral](https://github.com/lvcabral) in [#258](https://github.com/lvcabral/brs-engine/pull/258)
* Fixed #250 - Made `RunUserInterface` the primary entry point by [@lvcabral](https://github.com/lvcabral) in [259](https://github.com/lvcabral/brs-engine/pull/259)

[Full Changelog][v1.2.8]

<a name="v1.2.7"></a>

## [v1.2.7 - Video: HLS Support and Multiple Audios](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.7) - 02 Feb 2024

### Release Changes

* Added full support to HLS and Multiple Audio Tracks - closes #247, #220 by [@lvcabral](https://github.com/lvcabral) in [#249](https://github.com/lvcabral/brs-engine/pull/249)
* Added support to videos inside the package or downloaded - closes #239 by [@lvcabral](https://github.com/lvcabral) in [#246](https://github.com/lvcabral/brs-engine/pull/246)
* Finished implementation of `roByteArray`- closes #172 by [@lvcabral](https://github.com/lvcabral) in [#251](https://github.com/lvcabral/brs-engine/pull/251)
* Fixed #244 - API Debug issues by [@lvcabral](https://github.com/lvcabral) in [#245](https://github.com/lvcabral/brs-engine/pull/245)

[Full Changelog][v1.2.7]

<a name="v1.2.6"></a>

## [v1.2.6 - roScreen fix and Video Codec Detection](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.6) - 28 Jan 2024

### Release Changes

* Fixed #234 - Return last buffer on `roScreen` methods `getPng` and `roGetByteArray` by [@lvcabral](https://github.com/lvcabral) in [#236](https://github.com/lvcabral/brs-engine/pull/236)
* Fixed #235 - Updated `ifDraw2D` to support `roScreen` as image source by [@lvcabral](https://github.com/lvcabral) in [#237](https://github.com/lvcabral/brs-engine/pull/237)
* Fixed #238 - Detected supported video codecs and containers to return in `roDeviceInfo.canDecodeVideo()` by [@lvcabral](https://github.com/lvcabral) in [#240](https://github.com/lvcabral/brs-engine/pull/240)
* Fixed last frame on screen using `cancelAnimationFrame()` by [@lvcabral](https://github.com/lvcabral) in [#241](https://github.com/lvcabral/brs-engine/pull/241)
* Fixed #242 - Raise `resolution` event during app startup by [@lvcabral](https://github.com/lvcabral) in [#243](https://github.com/lvcabral/brs-engine/pull/243)


[Full Changelog][v1.2.6]

<a name="v1.2.5"></a>

## [v1.2.5 - Fixes on Keyboard Control, Display and XML](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.5) - 22 Jan 2024

### Release Changes

* Fixed #228 - Prevent repeated `keydown` events by [@lvcabral](https://github.com/lvcabral) in [#230](https://github.com/lvcabral/brs-engine/pull/230)
* Fixed #229 - Clear buffer on terminate by [@lvcabral](https://github.com/lvcabral) in [#231](https://github.com/lvcabral/brs-engine/pull/231)
* Fixed #232 - Object `roXMLElement` called method `getText()` is returning empty string by [@lvcabral](https://github.com/lvcabral) in [#233](https://github.com/lvcabral/brs-engine/pull/233)

[Full Changelog][v1.2.5]

<a name="v1.2.4"></a>

## [v1.2.4 - Fixed Low Resolution and Video Pause](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.4) - 21 Jan 2024

### Release Changes

* Fixed #225 - Low Resolution on Screen Resize by [@lvcabral](https://github.com/lvcabral) in [#226](https://github.com/lvcabral/brs-engine/pull/226)
* Fixed #219 - Video playback is not always pausing when the app get `PAUSE` or `BREAK` commands by [@lvcabral](https://github.com/lvcabral) in [#227](https://github.com/lvcabral/brs-engine/pull/227)

[Full Changelog][v1.2.4]

<a name="v1.2.3"></a>

## [v1.2.3 - Improved Control Simulation](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.3) - 19 Jan 2024

### Release Changes

* Fixed issue that allowed API to unmute a video when App had it muted by [@lvcabral](https://github.com/lvcabral) in [#221](https://github.com/lvcabral/brs-engine/pull/221)
* Added new API methods to enable/disable dynamically both keyboard or game pad controllers by [@lvcabral](https://github.com/lvcabral) in [#222](https://github.com/lvcabral/brs-engine/pull/222)
  * `setControlMode()`
  * `getControlMode()`
  * `setCustomPadButtons()`
* Improvements on Remote Control simulation by [@lvcabral](https://github.com/lvcabral) in [#223](https://github.com/lvcabral/brs-engine/pull/223)
  * Added support for different control types
  * Added a key buffer on the API side to avoid losing key events

[Full Changelog][v1.2.3]

<a name="v1.2.2"></a>

## [v1.2.2 - Implemented FindMemberFunction()](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.2) - 17 Jan 2024

### Release Changes

* Fixed #190 - Implemented global function `FindMemberFunction()`  by [@lvcabral](https://github.com/lvcabral) in [#216](https://github.com/lvcabral/brs-engine/pull/216)
* Improved Example web app by [@lvcabral](https://github.com/lvcabral) in [#217](https://github.com/lvcabral/brs-engine/pull/217)
  * Removed unecessary content policy
  * Replaced usage of `prompt()` by an HTML5 `dialog`
  * Updated execution source using the button to match Roku side load with "auto-run-dev"

[Full Changelog][v1.2.2]


<a name="v1.2.1"></a>

## [v1.2.1 - Mute Audio and Video in Sync](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.1) - 15 Jan 2024

### Release Changes

* Fixed API to handle `mute` in sync for both Audio and Video by [@lvcabral](https://github.com/lvcabral) in [#215](https://github.com/lvcabral/brs-engine/pull/215)
* Fixed bad performance when in full screen mode on 4K monitors by [@lvcabral](https://github.com/lvcabral) in [#214](https://github.com/lvcabral/brs-engine/pull/214)
* build(deps): bump follow-redirects from 1.15.3 to 1.15.4 by @dependabot in [#212](https://github.com/lvcabral/brs-engine/pull/212)
* Added new demo app to the example web application: `custom-video-player`
* Updated documentation


[Full Changelog][v1.2.1]

<a name="v1.2.0"></a>

## [v1.2.0 - Video Playback and GamePad customization](https://github.com/lvcabral/brs-engine/releases/tag/v1.2.0) - 14 Jan 2024

### Release Changes

* Implemented `roVideoPlayer` component by [@lvcabral](https://github.com/lvcabral) in [#213](https://github.com/lvcabral/brs-engine/pull/213)
* Added support to customize GamePad buttons mapping by [@lvcabral](https://github.com/lvcabral) in [#210](https://github.com/lvcabral/brs-engine/pull/210)
* Control queue modes: Single Key Events and Multi Key Events by [@lvcabral](https://github.com/lvcabral) in [#211](https://github.com/lvcabral/brs-engine/pull/211)
  * Add the entry `multi_key_events=1` to the manifest to enable support for simultaneous keys.

[Full Changelog][v1.2.0]

<a name="v1.1.11"></a>

## [v1.1.11 - Improved roRegex and fixed Sound issues](https://github.com/lvcabral/brs-engine/releases/tag/v1.1.11) - 05 Jan 2024

### Release Changes

* Added support for `g` flag on `roRegex` by [@lvcabral](https://github.com/lvcabral) in [#209](https://github.com/lvcabral/brs-engine/pull/209)
* Fixed sound related issues by [@lvcabral](https://github.com/lvcabral) in [#208](https://github.com/lvcabral/brs-engine/pull/208)
  * Home Button sound was not always being triggered
  * The `roAudioResource` was with the old DataType enum configuration
  * Sound will totally pause now both on `stop` and `pause` states.

[Full Changelog][v1.1.11]

<a name="v1.1.10"></a>

## [v1.1.10 - Fixed DBG Command conflict with WAV](https://github.com/lvcabral/brs-engine/releases/tag/v1.1.10) - 04 Jan 2024

### Release Changes

* Fixed wav stream conflict with Debug command by [@lvcabral](https://github.com/lvcabral) in [#207](https://github.com/lvcabral/brs-engine/pull/207)
  * Extracted enumerators from `util.js` into `enums.js` to reuse inside the worker
  * Fixed issue that was restarting a sound when returning from pause of break, when the app already had stopped it.

[Full Changelog][v1.1.10]

<a name="v1.1.9"></a>

## [v1.1.9 - GamePad support and FPS Limitation](https://github.com/lvcabral/brs-engine/releases/tag/v1.1.9) - 03 Jan 2024

### Release Changes

* Updated package name on README.md badges by [@lvcabral](https://github.com/lvcabral) in [#200](https://github.com/lvcabral/brs-engine/pull/200)
* Fixed [#201](https://github.com/lvcabral/brs-engine/issues/201) - Prevent Exception when SharedArrayBuffer is not supported by [@lvcabral](https://github.com/lvcabral) in [#202](https://github.com/lvcabral/brs-engine/pull/202)
* Implementing features to remove limitations by [@lvcabral](https://github.com/lvcabral) in [#205](https://github.com/lvcabral/brs-engine/pull/205)
  * Fixed [#164](https://github.com/lvcabral/brs-engine/issues/164) - Allowing usage of explicit interfaces when calling methods [@lvcabral](https://github.com/lvcabral) in [#206](https://github.com/lvcabral/brs-engine/pull/206)
  * Fixed [#159](https://github.com/lvcabral/brs-engine/issues/159) - Properly casting numeric values on Math functions and other scenarios
  * Added support to have the variable name after `next` statement in a `for...next` loop
* Implemented GamePad support by [@lvcabral](https://github.com/lvcabral) in [#204](https://github.com/lvcabral/brs-engine/pull/204)
  * Added support for the GamePad API
  * Added a new feature `simulation_engine` to the `roDeviceInfo.hasFeature()` method, allowing apps to adapt when under `brs-engine`
  * Added new option to define `maxFps` on `deviceData` and limit framerate inside the worker
  * Reduced web app default framerate to prevent issues on iOS
  * Added icon dimentions to css
  * Fixed CLI to not show `start` event
  * Fixed high framerate performance issue
  * Fixed loading encrypted package
* Added new debug command `pause` to allow interrupt the interpreter when app loses focus

[Full Changelog][v1.1.9]

<a name="v1.0.0"></a>

## [v1.0.0 - Simulation Engine Release](https://github.com/lvcabral/brs-engine/releases/tag/v1.0.0) - 15 Dec 2023

After 4 years of Alpha and Beta stages, the project is stable and performant enough to finally be released as version 1.0 and with that, we decided to give it a new name:

## brs-engine - BrightScript Simulation Engine

The term _simulation engine_ was chosen instead of the former _emulator_ to better represent the nature and purpose of the project, as there is no intention to fully emulate a Roku device (OS and Hardware), but rather simulate the behavior, as a development tool and as an engine/framework to run BrightScript apps in different platforms.

In this release the [new CLI](/docs/run-as-cli.md) was introduced, still with some limitations (e.g. no `OffScreenCanvas` support), but allowing basic BrightScript code to be executed, either via REPL or files. It also performs the encryption of a `.zip` file into a `.bpk` package to protect the source code.

#### Release Changes

* Renamed package for `brs-engine`
* Renamed libraries to `brs.api.js` and `brs.worker.js`
* Reorganized `src` folder by library, subfolders: `api`, `cli` and `worker`
* Added new CLI with REPL (`bin/brs.cli.js`) ([#181](https://github.com/lvcabral/brs-engine/181))
* Added support for Conditional Compilation ([#93](https://github.com/lvcabral/brs-engine/93))
* Added support for `webp` file format in `roBitmap` ([#166](https://github.com/lvcabral/brs-engine/166))
* Added support for interfaces `ifGetArray` and `ifSetArray` ([#170](https://github.com/lvcabral/brs-engine/170))
* Added support for `.bpk` encrypted package file ([#188](https://github.com/lvcabral/brs-engine/188))
* Added support optional chaining operators: `?.`, `?(`, `?[`, and `.@` ([#176](https://github.com/lvcabral/brs-engine/176))
* Moved `models` list to API library and updated `serialNumber` format
* Added new API event `registry`
* Added check for `break` debug command during the `roMessagePort` loop
* Added code to pause sound when Micro Debugger is triggered (does not affect wav)
* Added option to stop on Micro Debugger when a crash happens ([#198](https://github.com/lvcabral/brs-engine/198))
* Added partial try/catch implementation ([#195](https://github.com/lvcabral/brs-engine/195))
* Improved error handling and added warning for RSG usage
* Added stub `roAppMemoryMonitor` and `roDeviceInfo.enableLowGeneralMemory` ([#196](https://github.com/lvcabral/brs-engine/196))
* Added new method `getAllPurchases` and changed `doOrder` to return `false` ([#178](https://github.com/lvcabral/brs-engine/178))
* Added `formatLocation` method in the Interpreter to help show location in warning messages
* Added Bundle Stats Analyzer and replaced dependencies to reduce package size
* Updated default firmware to 11.0 and added new models to the list
* Updated images and layout of sample Web application
* Updated `roDateTime.GetTimeZoneOffset()` to consider `roDeviceInfo.GetTimeZone()` ([#94](https://github.com/lvcabral/brs-engine/94))
* Finished implementation of `ifEnum` on all array/list objects ([#171](https://github.com/lvcabral/brs-engine/171))
* Fixed multiple cascading calls for dot-chained methods ([#55](https://github.com/lvcabral/brs-engine/55))
* Fixed `roRegion` offset not being properly applied when `setWrap` was `true` ([#194](https://github.com/lvcabral/brs-engine/194))
* Fixed `Val()` function not compliant with Roku ([#162](https://github.com/lvcabral/brs-engine/162))
* Fixed duplication of exception handling messages ([#126](https://github.com/lvcabral/brs-engine/126))
* Fixed code smells and bugs based on Sonar Cloud recommendations ([#169](https://github.com/lvcabral/brs-engine/169))
* Replaced `luxon` by `day.js` on `roDateTime` and `roTimespan` ([#193](https://github.com/lvcabral/brs-engine/193))
* Replaced module `jszip` by the lighter `fflate`
* Removing `ua-parser-js` dependency for the API
* Bumped version of several dependencies
* Removed Node 14.x from the build ([#182](https://github.com/lvcabral/brs-engine/182))

[Full Changelog][v1.0.0]

<a name="v0.10.22"></a>

## [v0.10.22 - New API and Boosted Performance](https://github.com/lvcabral/brs-emu/releases/tag/v0.10.22) - 10 Sep 2023

This release was a result of months of refactoring work and performance improvements. 

* Implemented new API to simplify usage of the `brs-emu` package, see [new documentation](https://github.com/lvcabral/brs-emu/blob/master/docs/integrating.md) [@lvcabral](https://github.com/lvcabral) 
* Implemented the Roku MicroDebugger (including `stop` statement, back trace and debug commands) [#127](https://github.com/lvcabral/brs-emu/issues/127)
* Added support for Firefox and Safari browsers
* Added option to execute a channel without audio
* Added support for both Windows and MacOS keyboard names
* Multiple performance improvements on handling Canvas 2D, big thanks for [@markwpearce](https://github.com/markwpearce) [#139](https://github.com/lvcabral/brs-emu/issues/139)
* Implemented `roInput` [#57](https://github.com/lvcabral/brs-emu/issues/57)
* Implemented `roAppInfo`  [#104](https://github.com/lvcabral/brs-emu/issues/104) 
* Implemented support for `ScaleMode` in `roRegion` [#62](https://github.com/lvcabral/brs-emu/issues/62)
* Implemented missing methods to `roRegion` [#120](https://github.com/lvcabral/brs-emu/issues/120)
* Implemented missing methods to `roUrlTransfer` as mocks to avoid channel crash. [#104](https://github.com/lvcabral/brs-emu/issues/104)
* Implemented missing `roDeviceInfo` methods [#134](https://github.com/lvcabral/brs-emu/issues/134)
* Implemented missing `roChannelStore` methods [#137](https://github.com/lvcabral/brs-emu/issues/137)
* Implemented a mock of `RunGarbageCollector()` [#119](https://github.com/lvcabral/brs-emu/issues/119)
* Implemented numeric type auto cast in function parameters and return value [#122](https://github.com/lvcabral/brs-emu/issues/122)
* Implemented support for external input parameters [#123](https://github.com/lvcabral/brs-emu/issues/123)
* Implemented support for format parameter on `toStr()` [#132](https://github.com/lvcabral/brs-emu/issues/132)
* Implemented method `format()` in `roString` [#133](https://github.com/lvcabral/brs-emu/issues/133)
* Implemented `end` command to terminate app without crash
* Improved casting on `roBitmap`, `roRegion` and `roScreen`
* Improved Function call performance [#141](https://github.com/lvcabral/brs-emu/issues/141)
* Changed to show icon when no splash exist in zip file
* Changed to only enable keyboard control when channel is running
* Changed to make sure audio do not play if  `stop()` is called during load
* Fixed: `drawRotatedObject` on `roScreen` and `roBitmap`
* Fixed: `ifDraw2d` drawing methods on `roRegion` [#120](https://github.com/lvcabral/brs-emu/issues/120)
* Fixed: return `invalid` when `roCompositor` doesn't receive valid regions creating sprites [#125](https://github.com/lvcabral/brs-emu/issues/125)
* Fixed: Edge case of comparing `invalid` with `roInvalid`
* Fixed: Prevent crash with invalid collection with `for each` [#118](https://github.com/lvcabral/brs-emu/issues/118)
* Fixed: Added missing audio files to the npm package
* Added option to show and overlay with display performance indicators  [#129](https://github.com/lvcabral/brs-emu/issues/129)
* Implemented use of `Atomics` with the `SharedArrayBuffer` and other small improvements.
* Adding a python script to allow testing on newer browsers with COOP and COEP enabled.
* Upgraded to TypeScript 4, Webpack 5 and several other dependencies
* [sonar] Code smell and complexity fixes [#153](https://github.com/lvcabral/brs-emu/issues/153)
* Merged [**brs**](https://github.com/sjbarag/brs) v0.45.0 below cherry picked commits:
  * feat(stdlib): Add lookupCI for assocarray ([#639](https://github.com/sjbarag/brs/issues/639)) resolves [#629](https://github.com/sjbarag/brs/issues/629) 
  * fix(interp): allow functions to be typed as objects ([#659](https://github.com/sjbarag/brs/659))

[Full Changelog][v0.10.22]

<a name="v0.9.0-emu"></a>

## [v0.9.0 - Improved ECP and BrightScript support](https://github.com/lvcabral/brs-emu/releases/tag/v0.9.0-emu) - 28 Jun 2021

This release brings the integration of improvements and fixes from the `brs` interpreter up to their **v0.43**. Also several improvements

* (app) Implemented ECP-2 WebSocket API to support official Roku mobile apps (iOS and Android)
* (app) Implemented support for keyboard characters sent via ECP
* (app) Added support for new control keys: Backspace, Enter, PlayOnly and Stop
* (app) Restore the app window, if minimized, when a channel is loaded remotely via the Installer
* (app) Added `Ctrl+R` shortcut to reload most recent channel
* (app) Added current locale on the Status bar
* (app) Made path length on the status bar proportional to the app window's width
* (app) Fixed status bar Resolution label that was showing "width" twice
* (app,web) Now emulator loads all files from the zip package even ones with custom extension.
* (app,web) Made Key8 to behave as the Info (*) control key, for keyboards that lacks the numeric keypad
* (app,web) Upgraded several dependencies to patch security vulnerabilities.
* (brs) Implemented support for Dot (.) and Attribute (@) operators for XML objects
* (brs) Implemented several missing methods to `roDeviceInfo` 
* (brs) Added check for valid parameters on `roRegion` constructor
* (brs) Ignore Label statements when parsing the code
* (brs) Fixed `roRegion.SetWrap(true)` in `ifDraw2D.DrawObject()` and `ifDraw2D.DrawScaledObject()`
* (brs) Fixed `roString.Tokenize()` that was sometimes returning an empty string at the end of the list
* (brs) Fixed `roAppManager.updateLastKeyPressTime()` definition typo and implemented actual time reset
* (brs) Fixed issues with `roTimespan`
* (brs) Fixed `roRegion.offset()` to accept float parameters
* (doc) Updated [list of emulator limitations](https://github.com/lvcabral/brs-emu/blob/master/docs/limitations.md)
* Merged [**brs**](https://github.com/sjbarag/brs) v0.43.0 below some key commits:
  * fix(lexer): Add support for explicit integer literals ([#637](https://github.com/sjbarag/brs/issues/637))
  * feat(stdlib): add isEmpty method to roString ([#636](https://github.com/sjbarag/brs/issues/636))
  * fix(parse,interp): Support unary + operator for numbers ([#615](https://github.com/sjbarag/brs/issues/615))
  * fix(lex): Allow JS object properties as identifiers ([#614](https://github.com/sjbarag/brs/issues/614))
  * feat(stdlib): Implement RoLongInteger and cast int to LongInt, float to Double ([#600](https://github.com/sjbarag/brs/issues/600))
  * fix(stdlib): Correct sorting issues with mixed arrays ([#592](https://github.com/sjbarag/brs/issues/592))
  * feat(parse,interp): Implement dim statement ([#531](https://github.com/sjbarag/brs/issues/531))
  * fix(rsg): Adds optional arg to RoString constructor ([#533](https://github.com/sjbarag/brs/issues/533))
  * fix(parse): Restore nested block parsing ([#514](https://github.com/sjbarag/brs/issues/514))
  * fix(parse): Allow multiple statements in single-line `if` branches
  * feat(stdlib): Added case sensitive support to roAssociativeArray ([#509](https://github.com/sjbarag/brs/issues/509))
  * fix(parser): make if statements with 'not' work ([#443](https://github.com/sjbarag/brs/issues/443))
  * fix(parse): Capture `EndIf` token when used alongside `else` ([#393](https://github.com/sjbarag/brs/issues/393))
  * fix(interp): Allow Float parameters passed into function signatures expecting Double ([#394](https://github.com/sjbarag/brs/issues/394))
  * fix(interp): Allow invalid returns for signatures that return object (brs#395)

[Full Changelog][v0.9.0-emu]

<a name="v0.8.1-emu"></a>

## [v0.8.1 - Fixes and Security Patches](https://github.com/lvcabral/brs-emu/releases/tag/v0.8.1-emu) - 09 Jun 2021

This release brings bug fixes, support for new Chrome security policies and the desktop application has upgraded dependencies including Electron's bump to v9.

* (brs)Added new message "getVersion" to allow request library version to the WebWorker
* (brs) Revert "fix(interp): Automatically box as object function parameters (sjbarag#365)"
* (brs) Fixed support for Retaliate game that was not working properly on v0.8 
* (web) Shows dynamically the library version using new message "getVersion"
* (web) Added support to [Chrome 92+ that will force **self.crossOriginIsolated**](https://developer.chrome.com/blog/enabling-shared-array-buffer/)
* (app) Upgraded several dependencies to patch security vulnerabilities.

[Full Changelog][v0.8.1-emu]

<a name="v0.8.0-emu"></a>

## [v0.8.0 - Localization Support](https://github.com/lvcabral/brs-emu/releases/tag/v0.8.0-emu) - 11 Mar 2020

This release brings full support for channel localization. The desktop application has a new menu with the locales with the same options available on Roku devices.

* (brs)Added support to localize texts using TS or XLIFF files [#67](https://github.com/lvcabral/brs-emu/issues/67)
* (brs)Implemented support for localization of images [#66](https://github.com/lvcabral/brs-emu/issues/66)
* (brs)Added missing method setAdPrefs() for Roku_Ads.brs  [#68](https://github.com/lvcabral/brs-emu/issues/68)
* (brs)Removed BRS original manifest handler
* (app) Added option on Device menu to change localization
* (app) Refactored app code into several front-end modules
* Merged BRS v0.18.2
  * fix(stdlib): Implement RoAssociativeArray.items() correctly ([#371](https://github.com/sjbarag/brs/issues/371))
  * fix(interp): Automatically box `as object` function parameters ([#35](https://github.com/sjbarag/brs/issues/35))
  * fix(stdlib): Allow formatJson to serialize boxed types ([#364](https://github.com/sjbarag/brs/issues/364))
  * feat(stdlib): Implement getString() and toStr() on RoString ([#362](https://github.com/sjbarag/brs/issues/362))
  * feat(stdlib): Implement GetInterface ([#352](https://github.com/sjbarag/brs/issues/352))
  * fix(interp): Automatically box return values for 'as object' return types ([#360](https://github.com/sjbarag/brs/issues/360))
  * feat(parse): Allow `.` before indexed property access ([#357](https://github.com/sjbarag/brs/issues/357))
  * chore(cruft): Remove unused AutoBox.ts

[Full Changelog][v0.8.0-emu]

<a name="v0.7.2-emu"></a>

## [v0.7.2 - First Beta Release](https://github.com/lvcabral/brs-emu/releases/tag/v0.7.2-emu) - 17 Nov 2019

* (brs) Library now supports `roUrlTransfer` and `roUrlEvent`
* (brs) Added support to **bmp** images, and better file type detection
* (brs) Emulator **File System** is now case insensitive (like Roku)
* (brs) Finished `roXMLElement` implementation with XML creation methods
* (brs) Mocked `roAppManager` component with working `GetUpTime()` method
* (brs) Support to global functions: RebootSystem(), UpTime(), Tr()
* (brs) Fixed scope of the `m` object inside global functions **(v0.7.2)**
* (brs) Fixed support for fonts with spaces and numbers on the family name **(v0.7.2)**
* (brs) Fixed issues related to `if..then..else` on a single line **(v0.7.2)**
* (app,web) Added support to play downloaded audio files
* (app,web) Added support to show downloaded images
* (app,web) Updated default sound effects with the original Roku audio resources
* (app) **Web Installer** (port 80 or custom) to allow remote installation and screenshot
* (app) **ECP** server (port 8060) with **SSDP** detection implemented
* (app) **Remote Console** (port 8085) is available for remote monitoring
* (app) Status bar now changes color if errors or warnings are raised
* (app) New _clickable_ status bar icons for errors, ECP and web installer
* (web) Shows animated gif to indicate a channel is being downloaded
* (doc) Updated [list of emulator limitations](https://github.com/lvcabral/brs-emu/blob/master/docs/limitations.md)
* (doc,app) Added [desktop app build documentation](https://github.com/lvcabral/brs-emu-app/blob/master/docs/build-from-source.md)

[Full Changelog][v0.7.2-emu]

<a name="v0.6.0-emu"></a>

## [v0.6.0 - Audio Playback and new Display Modes](https://github.com/lvcabral/brs-emu/releases/tag/v0.6.0-emu) - 24 Oct 2019

* (app,web) Support for audio playback from `roAudioResource` and `roAudioPlayer`
* (app,web) Support for **SD** and **FHD** display modes
* (app) Added TV over-scan emulation options: disabled, only guide lines, enabled
* (app) Added **Open Recent** sub-menu
* (app) Added **Close Channel** menu option
* (app) Added **macOS** standard app menu
* (brs) Implemented `roAudioPlayerEvent` and updated `roMessagePort` to support it
* (doc) Updated [list of emulator limitations](https://github.com/lvcabral/brs-emu/blob/master/docs/limitations.md)

[Full Changelog][v0.6.0-emu]

<a name="v0.5.0-emu"></a>

## [v0.5.0 - Desktop Applications and Library Fixes](https://github.com/lvcabral/brs-emu/releases/tag/v0.5.0-emu) - 05 Oct 2019

This version brings the first release of the desktop application and several fixes and improvements:

* (app) Desktop app for Windows, Linux and macOS
* (brs) Fixed issues with inline `if` statements on `Parser`  [#252](https://github.com/sjbarag/brs/issues/252) [#253](https://github.com/sjbarag/brs/issues/253) [#309](https://github.com/sjbarag/brs/issues/309)
* (brs) Implemented global function `GetInterface()`  [#42](https://github.com/lvcabral/brs-emu/issues/42)
* (brs) Added support for an optional parameter on `Main()` [#44](https://github.com/lvcabral/brs-emu/issues/44) 
* (brs) Added `RunUserInterface()` as alternative for `Main()` [#44](https://github.com/lvcabral/brs-emu/issues/44)
* (brs) Added missing method `maxSimulStreams()` on `roAudioResource` component [#26](https://github.com/lvcabral/brs-emu/issues/26)
* (web) Reduced the app html to be simple, adding links to documentation on the repository
* (web) Detect and inform user about unsupported browser [#40](https://github.com/lvcabral/brs-emu/issues/40)
* (doc) Reorganized repository folders and documentation for v0.5.0 [#43](https://github.com/lvcabral/brs-emu/issues/43)
* Merged BRS v0.15.0
  * fix(types): Return `true` for invalid values on `RoAssociativeArray#doesExist` ([#323](https://github.com/sjbarag/brs/issues/323))
  * fix(types,interp): Automatically convert between Int and Float ([#291](https://github.com/sjbarag/brs/issues/291))
  * feat(extension): Add _brs_.runInScope ([#326](https://github.com/sjbarag/brs/issues/326))
  * chore(naming): rename src/mocks/ -> src/extensions/ ([#325](https://github.com/sjbarag/brs/issues/325))

[Full Changelog][v0.5.0-emu]

<a name="v0.4.0-emu"></a>

## [v0.4.0 - Support for rgba on Draw Object methods](https://github.com/lvcabral/brs-emu/releases/tag/v0.4.0-emu) - 25 Sep 2019

This release has the following changes:

* Implemented method IsEmpty() for both roArray and roAssociativeArray [#316](https://github.com/sjbarag/brs/issues/316)
* Fixed [#320](https://github.com/sjbarag/brs/issues/320) Making sure DoesExist() returns true even when value of the existing item is invalid
* Implemented mock components roChannelStore and roChannelStoreEvent [#39](https://github.com/lvcabral/brs-emu/issues/39)
* Implemented mock of Roku_Ads() object [#25](https://github.com/lvcabral/brs-emu/issues/25)
* Implemented support for rgba on DrawObject* methods [#27](https://github.com/lvcabral/brs-emu/issues/27)
* Added option to configure device font,
* Added new font family "Roboto"
* Added new font family "Asap" that is similar to Roku default
* Implemented missing methods for RoUniversalControlEvent [#37](https://github.com/lvcabral/brs-emu/issues/37)
* Changed DrawText to get string from value property of BrsString
* fix(parse): Include surrounding whitespace in Block nodes([#257](https://github.com/sjbarag/brs/issues/257))
* Finished Collision detection implementation (rectangle and circle)
* Updated roRegion to handle offset properly based on SetWrap() flag
* Implemented roScreen methods SetPort(), GetPng() and GetByteArray()
* Fixed `for loop` issue that should not process loop when step is on the wrong direction of the start-end parameters [#310](https://github.com/sjbarag/brs/issues/310) ([#311](https://github.com/sjbarag/brs/issues/311))

[Full Changelog][v0.4.0-emu]


<a name="v0.3.0-emu"></a>

## [v0.3.0 - Several fixes and improvements](https://github.com/lvcabral/brs-emu/releases/tag/v0.3.0-emu) - 16 Sep 2019

This releases adds a few font related features as follows:

* Updated website and added new demo channels
* Added parameter `rgba`` to `roScreen.DrawObject()` (only alpha opacity supported) [#27](https://github.com/lvcabral/brs-emu/issues/27)
* Fixed `for loop` to correctly handle `steps` sjbarag#315
* Fixed issue that `roCompositor` was not clearing the canvas properly
* Implemented channel close detection
* Fixed `roSprite` animation when frame time was configured on `roRegion`
* Implemented double buffer support for `roScreen` and `roRegion`
* Added method `DrawText()` to `roRegion`
* Implemented string `Tokenize()` method
* Added boxing to the numeric types
* Merged `roBoolean`, `roDouble`, `roFloat` and `roInt` implementation [#35](https://github.com/lvcabral/brs-emu/issues/35)
* Made file type identification case-insensistive
* Added support for `.csv` extension on zip package
* Removed `roSGNode` as **RSG** is out of scope for the emulator
* Added support for `.gif` and `.jpeg` image extensions
* Fixed [#32](https://github.com/lvcabral/brs-emu/issues/32) Changed default font loading code to use relative path
* Fixed [#30](https://github.com/lvcabral/brs-emu/issues/30) Moved the screen clear code to run before the splash

[Full Changelog][v0.3.0-emu]

<a name="v0.2.0-emu"></a>

## [v0.2.0 - Custom Fonts and Metrics](https://github.com/lvcabral/brs-emu/releases/tag/v0.2.0-emu) - 09 Sep 2019

This releases adds a few font related features as follows:

* Support for loading custom fonts from the channel `zip` package.
* Included **Open Sans** as the default device font.
* Finished roFontRegistry and roFont implementation by adding font metrics.
* Updated license information.

Included a new dependency to [opentype.js](https://www.npmjs.com/package/opentype.js) package to parse font files.

[Full Changelog][v0.2.0-emu]

<a name="v0.1.0-emu"></a>

## [v0.1.0 - First Emulator Alpha Release](https://github.com/lvcabral/brs-emu/releases/tag/v0.1.0-emu) - 08 Sep 2019

This is the prototype release of the 2D API emulator, forked from the original BRS project.
The following is the list of components implemented (some partially or just mocked):

* roAudioPlayer.ts (mock)
* roAudioResource.ts (mock)
* roBitmap.ts
* roByteArray.ts
* roCompositor.ts
* roDateTime.ts
* roDeviceInfo.ts
* roFileSystem.ts
* roFont.ts
* roFontRegistry.ts
* roList.ts
* roMessagePort.ts
* roPath.ts
* roRegion.ts
* roRegistry.ts
* roRegistrySection.ts
* roScreen.ts
* roSprite.ts
* roUniversalControlEvent.ts
* roXMLElement.ts
* roXMLList.ts

[Full Changelog][v0.1.0-emu]

[v1.3.1]: https://github.com/lvcabral/brs-engine/compare/v1.3.0...v1.3.1
[v1.3.0]: https://github.com/lvcabral/brs-engine/compare/v1.2.11...v1.3.0
[v1.2.11]: https://github.com/lvcabral/brs-engine/compare/v1.2.10...v1.2.11
[v1.2.10]: https://github.com/lvcabral/brs-engine/compare/v1.2.9...v1.2.10
[v1.2.9]: https://github.com/lvcabral/brs-engine/compare/v1.2.8...v1.2.9
[v1.2.8]: https://github.com/lvcabral/brs-engine/compare/v1.2.7...v1.2.8
[v1.2.7]: https://github.com/lvcabral/brs-engine/compare/v1.2.6...v1.2.7
[v1.2.6]: https://github.com/lvcabral/brs-engine/compare/v1.2.5...v1.2.6
[v1.2.5]: https://github.com/lvcabral/brs-engine/compare/v1.2.4...v1.2.5
[v1.2.4]: https://github.com/lvcabral/brs-engine/compare/v1.2.3...v1.2.4
[v1.2.3]: https://github.com/lvcabral/brs-engine/compare/v1.2.2...v1.2.3
[v1.2.2]: https://github.com/lvcabral/brs-engine/compare/v1.2.1...v1.2.2
[v1.2.1]: https://github.com/lvcabral/brs-engine/compare/v1.2.0...v1.2.1
[v1.2.0]: https://github.com/lvcabral/brs-engine/compare/v1.1.11...v1.2.0
[v1.1.11]: https://github.com/lvcabral/brs-engine/compare/v1.0.10...v1.1.11
[v1.1.10]: https://github.com/lvcabral/brs-engine/compare/v1.0.9...v1.1.10
[v1.1.9]: https://github.com/lvcabral/brs-engine/compare/v1.0.0...v1.1.9
[v1.0.0]: https://github.com/lvcabral/brs-engine/compare/v0.10.22...v1.0.0
[v0.10.22]: https://github.com/lvcabral/brs-emu/compare/v0.9.0-emu...v0.10.22
[v0.9.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.8.1-emu...v0.9.0-emu
[v0.8.1-emu]: https://github.com/lvcabral/brs-emu/compare/v0.8.0-emu...v0.8.1-emu
[v0.8.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.7.2-emu...v0.8.0-emu
[v0.7.2-emu]: https://github.com/lvcabral/brs-emu/compare/v0.6.0-emu...v0.7.2-emu
[v0.6.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.5.0-emu...v0.6.0-emu
[v0.5.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.4.0-emu...v0.5.0-emu
[v0.4.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.3.0-emu...v0.4.0-emu
[v0.3.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.2.0-emu...v0.3.0-emu
[v0.2.0-emu]: https://github.com/lvcabral/brs-emu/compare/v0.1.0-emu...v0.2.0-emu
[v0.1.0-emu]: https://github.com/lvcabral/brs-emu/tree/v0.1.0-emu

<!-- Generated by https://github.com/rhysd/changelog-from-release v3.7.1 -->
