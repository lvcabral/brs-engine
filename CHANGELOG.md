<a name="v1.0.0"></a>

# [v1.0.0 - Simulation Engine Release](https://github.com/lvcabral/brs-engine/releases/tag/v1.0.0) - 15 Dev 2023

After 4 years of Alpha and Beta stages, the project is stable and performant enough to finally be released as version 1.0 and with that, we decided to give it a new name: 

## brs-engine - BrightScript Simulation Engine 

The term _simulation engine_ was chosen instead of the former _emulator_ to better represent the nature and purpose of the project, as there is no intention to fully emulate a Roku device (OS and Hardware), but rather simulate the behavior, as a development tool and as a engine/framework to run BrightScript apps in different platforms.

In this release the [new CLI](/docs/run-as-cli.md) was introduced, still with some limitations (e.g. no `OffScreenCanvas` support), but allowing basic BrightScript code to be executed, either via REPL or files. It also performs the encryption of a `.zip` file into a `.bpk` package to protect the source code.

### Release Changes

* Renamed package for `brs-engine`
* Renamed libraries to `brs.api.js` and `brs.worker.js`
* Reorganized `src` folder by library, subfolders: `api`, `cli` and `worker`
* Added support for Conditional Compilation (#93)
* Added support for `webp` file format in `roBitmap` (#166)
* Added support for interfaces `ifGetArray` and `ifSetArray` (#170)
* Added new CLI with REPL (`bin/brs.cli.js`) (#181)
* Added support for `.bpk` encrypted package file (#188)
* Added support optional chaining operators: `?.`, `?(`, `?[`, and `.@` (#176)
* Moved `models` list to API library and updated `serialNumber` format
* Added new API event `registry`
* Added check for `break` debug command during the `roMessagePort` loop
* Added code to pause sound when Micro Debugger is triggered (does not affect wav)
* Added option to stop on Micro Debugger when a crash happens (#198)
* Added partial try/catch implementation (#195)
* Improved error handling and added warning for RSG usage
* Added stub `roAppMemoryMonitor` and `roDeviceInfo.enableLowGeneralMemory` (#196)
* Added new method `getAllPurchases` and changed `doOrder` to return `false` (#178)
* Added `formatLocation` method in the Interpreter to help show location in warning messages
* Added Bundle Stats Analyzer and replaced dependencies to reduce package size
* Updated default firmware to 11.0 and added new models to the list
* Updated images and layout of sample Web application
* Updated `roDateTime.GetTimeZoneOffset()` to consider `roDeviceInfo.GetTimeZone()` (#94)
* Finished implementation of `ifEnum` on all array/list objects (#171)
* Fixed multiple cascading calls for dot-chained methods (#55)
* Fixed `roRegion` offset not being properly applied when `setWrap` was `true` (#194)
* Fixed `Val()` function not compliant with Roku (#162)
* Fixed duplication of exception handling messages (#126)
* Fixed code smells and bugs based on Sonar Cloud recommendations (#169)
* Replaced `luxon` by `day.js` on `roDateTime` and `roTimespan` (#193)
* Replaced module `jszip` by the lighter `fflate`
* Removing `ua-parser-js` dependency for the API
* Bumped version of several dependencies
* Removed Node 14.x from the build (#182)

[Full Changelog][v1.0.0]

<a name="v0.10.22"></a>

# [v0.10.22 - New API and Boosted Performance](https://github.com/lvcabral/brs-emu/releases/tag/v0.10.22) - 10 Sep 2023

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

# [v0.9.0 - Improved ECP and BrightScript support](https://github.com/lvcabral/brs-emu/releases/tag/v0.9.0-emu) - 28 Jun 2021

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

# [v0.8.1 - Fixes and Security Patches](https://github.com/lvcabral/brs-emu/releases/tag/v0.8.1-emu) - 09 Jun 2021

This release brings bug fixes, support for new Chrome security policies and the desktop application has upgraded dependencies including Electron's bump to v9.

* (brs)Added new message "getVersion" to allow request library version to the WebWorker
* (brs) Revert "fix(interp): Automatically box as object function parameters (sjbarag#365)"
* (brs) Fixed support for Retaliate game that was not working properly on v0.8 
* (web) Shows dynamically the library version using new message "getVersion"
* (web) Added support to [Chrome 92+ that will force **self.crossOriginIsolated**](https://developer.chrome.com/blog/enabling-shared-array-buffer/)
* (app) Upgraded several dependencies to patch security vulnerabilities.

[Full Changelog][v0.8.1-emu]

<a name="v0.8.0-emu"></a>

# [v0.8.0 - Localization Support](https://github.com/lvcabral/brs-emu/releases/tag/v0.8.0-emu) - 11 Mar 2020

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

# [v0.7.2 - First Beta Release](https://github.com/lvcabral/brs-emu/releases/tag/v0.7.2-emu) - 17 Nov 2019

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

# [v0.6.0 - Audio Playback and new Display Modes](https://github.com/lvcabral/brs-emu/releases/tag/v0.6.0-emu) - 24 Oct 2019

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

# [v0.5.0 - Desktop Applications and Library Fixes](https://github.com/lvcabral/brs-emu/releases/tag/v0.5.0-emu) - 05 Oct 2019

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

# [v0.4.0 - Support for rgba on Draw Object methods](https://github.com/lvcabral/brs-emu/releases/tag/v0.4.0-emu) - 25 Sep 2019

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

# [v0.3.0 - Several fixes and improvements](https://github.com/lvcabral/brs-emu/releases/tag/v0.3.0-emu) - 16 Sep 2019

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

# [v0.2.0 - Custom Fonts and Metrics](https://github.com/lvcabral/brs-emu/releases/tag/v0.2.0-emu) - 09 Sep 2019

This releases adds a few font related features as follows:

* Support for loading custom fonts from the channel `zip` package.
* Included **Open Sans** as the default device font.
* Finished roFontRegistry and roFont implementation by adding font metrics.
* Updated license information.

Included a new dependency to [opentype.js](https://www.npmjs.com/package/opentype.js) package to parse font files.

[Full Changelog][v0.2.0-emu]

<a name="v0.1.0-emu"></a>

# [v0.1.0 - First Emulator Alpha Release](https://github.com/lvcabral/brs-emu/releases/tag/v0.1.0-emu) - 08 Sep 2019

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
