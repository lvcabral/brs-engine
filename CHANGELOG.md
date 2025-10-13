# Changelog

<a name="v1.9.3"></a>

## [v1.9.3 - Fixed `brs-node` package](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.3) - 12 October 2025

This release fixes the `brs-node` package that had two major issues, the `assets/common.zip` file was missing from the package and the `brs-ecp.js` was crashing due to a dependency issue. Other noticeable fixes were related to `roNDK.start()` allowing URL as `ChannelId` on `SDKLaunch` and `RokuBrowser.brs` library now parses arrays in options object.

### Release Changes

* Allow `roNDK.start()` with `SDKLauncher` to send an URL as `ChannelId` by @lvcabral in https://github.com/lvcabral/brs-engine/pull/659
* Replaced usage of `forEach()` by `for...of` by @lvcabral in https://github.com/lvcabral/brs-engine/pull/661
* Added `Number` prefix before `isNaN` and `parseInt` by @lvcabral in https://github.com/lvcabral/brs-engine/pull/662
* Replaced usage of `window` by `globalThis` by @lvcabral in https://github.com/lvcabral/brs-engine/pull/663
* Replaced `instanceof Array` by `Array.isArray()` by @lvcabral in https://github.com/lvcabral/brs-engine/pull/664
* Improved `createPayloadFromFileMap` to support folder structure. by @lvcabral in https://github.com/lvcabral/brs-engine/pull/665
* Optimized loading of Libraries and fixed Roku Browser app launch by @lvcabral in https://github.com/lvcabral/brs-engine/pull/667
* Added missing `common.zip` to `brs-node` and fixed `brs-ecp.js` dependency issue by @lvcabral in https://github.com/lvcabral/brs-engine/pull/668

[Full Changelog][v1.9.3]

<a name="v1.9.2"></a>

## [v1.9.2 - New method `createPayloadFromFileMap`](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.2) - 10 October 2025

This release includes minor improvements and bug fixes for the BrightScript Simulation Engine.

### Release Changes

* Implemented new method `createPayloadFromFileMap` in `brs-node` library by [@lvcabral](https://github.com/lvcabral) in [#657](https://github.com/lvcabral/brs-engine/pull/657)
* Bump on-headers and compression by [@dependabot[bot]](https://github.com/dependabot[bot]) in [#655](https://github.com/lvcabral/brs-engine/pull/655)
* Several minor documentation improvements by [@lvcabral](https://github.com/lvcabral)

[Full Changelog][v1.9.2]

<a name="v1.9.1"></a>

## [v1.9.1 - Artifacts released as two NPM Packages](https://github.com/lvcabral/brs-engine/releases/tag/v1.9.1) - 09 October 2025

This release reorganizes the repository as a monorepo splitting the released artifacts into two separate NPM packages: `brs-engine` (for Web applications) and `brs-node` (for Node.js and CLI). This change aims to improve the development experience reducing the size of the imported packages, as the use cases and environments for each package are very different.

Also, with this release, the BrightScript language and components are now synchronized with Roku OS 15.0.

### Release Changes

* Changed to Monorepo with two packages: `brs-engine` (browser) and `brs-node` (node.js and CLI) by [@lvcabral](https://github.com/lvcabral) in [#654](https://github.com/lvcabral/brs-engine/pull/654)
* Return `0` when a function has typed return and no return statement is hit by [@lvcabral](https://github.com/lvcabral) in [#641](https://github.com/lvcabral/brs-engine/pull/641)
* Limited typed function returns zero solution to user functions only by [@lvcabral](https://github.com/lvcabral) in [#642](https://github.com/lvcabral/brs-engine/pull/642)
* Added new `d` flag to `parseJSON` function to support parsing to `double` by [@lvcabral](https://github.com/lvcabral) in [#643](https://github.com/lvcabral/brs-engine/pull/643)
* Fixed edge cases of `double` handing on `ParseJson` by [@lvcabral](https://github.com/lvcabral) in [#644](https://github.com/lvcabral/brs-engine/pull/644)
* Fixed `Lexer` parsing of `Double` literals by [@lvcabral](https://github.com/lvcabral) in [#645](https://github.com/lvcabral/brs-engine/pull/645)
* Implemented new methods `reserve` and `shrinkToFit` to `roArray` by [@lvcabral](https://github.com/lvcabral) in [#646](https://github.com/lvcabral/brs-engine/pull/646)
* Implemented `roDateTime.asMillisecondsLong()` and `roDeviceInfo.getUptimeMillisecondsAsLong()` by [@lvcabral](https://github.com/lvcabral) in [#647](https://github.com/lvcabral/brs-engine/pull/647)
* Implemented `roDeviceInfo.IsAutoAdjustRefreshRateEnabled` by [@lvcabral](https://github.com/lvcabral) in [#648](https://github.com/lvcabral/brs-engine/pull/648)
* Implemented `roUtils` component by [@lvcabral](https://github.com/lvcabral) in [#649](https://github.com/lvcabral/brs-engine/pull/649)
* Fixed `roUtils.deepCopy` to properly copy `boxed` objects by [@lvcabral](https://github.com/lvcabral) in [#650](https://github.com/lvcabral/brs-engine/pull/650)
* Bump pbkdf2 from 3.1.2 to 3.1.3 by @dependabot in [#630](https://github.com/lvcabral/brs-engine/pull/630)
* Bump sha.js from 2.4.11 to 2.4.12 by @dependabot in [#632](https://github.com/lvcabral/brs-engine/pull/632)

[Full Changelog][v1.9.1]

<a name="v1.8.9"></a>

## [v1.8.9 - Improvements on `Audio`, `Video` and `Fonts`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.9) - 10 June 2025

This release introduces a few missing methods in `roDeviceInfo` and a new method to `ifStringOps`, also several enhancements on Video and Audio handling. The default font was replaced by `DejaVuSansCondensed` that is used in Roku devices for `Draw2D` text rendering.

### Release Changes

* Implemented new `getGraphicsFeatures()` in `roDeviceInfo` by [@lvcabral](https://github.com/lvcabral) in [#589](https://github.com/lvcabral/brs-engine/pull/589)
* Use CORS proxy (if configured) by default by [@lvcabral](https://github.com/lvcabral) in [#594](https://github.com/lvcabral/brs-engine/pull/594)
* Added missing `roDeviceInfo` deprecated methods and updated behavior by [@lvcabral](https://github.com/lvcabral) in [#595](https://github.com/lvcabral/brs-engine/pull/595)
* Implemented `ifStringOps.Arg()` new method by [@lvcabral](https://github.com/lvcabral) in [#596](https://github.com/lvcabral/brs-engine/pull/596)
* Improved event handling for `roAudioPlayer` and `roVideoPlayer` by [@lvcabral](https://github.com/lvcabral) in [#597](https://github.com/lvcabral/brs-engine/pull/597)
* Upgraded `hls.js` and fixed video playback race conditions by [@lvcabral](https://github.com/lvcabral) in [#598](https://github.com/lvcabral/brs-engine/pull/598)
* Prevent duplicate `requestAnimationFrame()` call when `video` is playing by [@lvcabral](https://github.com/lvcabral) in [#599](https://github.com/lvcabral/brs-engine/pull/599)
* Improved `video` playback error handling by [@lvcabral](https://github.com/lvcabral) in [#602](https://github.com/lvcabral/brs-engine/pull/602)
* Replaced `Asap` font by `DejaVuSansCondensed` and improved font family handling by [@lvcabral](https://github.com/lvcabral) in [#605](https://github.com/lvcabral/brs-engine/pull/605)
* Removed redundant `platform` reference by [@lvcabral](https://github.com/lvcabral) in [#607](https://github.com/lvcabral/brs-engine/pull/607)
* Refactored `video` media tracks handling by [@lvcabral](https://github.com/lvcabral) in [#609](https://github.com/lvcabral/brs-engine/pull/609)
* Added support for preferred Audio locale by [@lvcabral](https://github.com/lvcabral) in [#610](https://github.com/lvcabral/brs-engine/pull/610)
* Made `preventDefault()` to also be called on `keyUp` event by [@lvcabral](https://github.com/lvcabral) in [#611](https://github.com/lvcabral/brs-engine/pull/611)
* Refactored API `display` module to receive `displayData` object by [@lvcabral](https://github.com/lvcabral) in [#612](https://github.com/lvcabral/brs-engine/pull/612)
* Added new API methods `getCaptionMode` and `setCaptionMode` by [@lvcabral](https://github.com/lvcabral) in [#613](https://github.com/lvcabral/brs-engine/pull/613)
* Added support for HLS.js event `MEDIA_ENDED` by [@lvcabral](https://github.com/lvcabral) in [#615](https://github.com/lvcabral/brs-engine/pull/615)
* Bump webpack-dev-server from 4.15.2 to 5.2.1 by @dependabot in [#614](https://github.com/lvcabral/brs-engine/pull/614)
* Improved handling of Sound Effect (WAV) files by [@lvcabral](https://github.com/lvcabral) in [#620](https://github.com/lvcabral/brs-engine/pull/620)
* Refactored `roChannelStore` to be reused in `SceneGraph` by [@lvcabral](https://github.com/lvcabral) in [#624](https://github.com/lvcabral/brs-engine/pull/624)

[Full Changelog][v1.8.9]

<a name="v1.8.8"></a>

## [v1.8.8 - Support `flags` on `ParseJSON()` and `FormatJSON()`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.8) - 11 May 2025

This release added the support for the `flags` parameter on the `ParseJSON()` to make the AA returned to be case insensitive, and `FormatJSON` flag now allows you to disable the escape of non-ASCII characters. There are also, fixes for `Left()` and `Mid()` that were not handling negative values properly and `Substitute()` that now supports the `^0` notation. The `chr()` and `asc()` functions were also updated to support extended Unicode. A new custom manifest flag was added: `cors_proxy` as the proxy is now only enabled it is added to the app's manifest. The `roAudioPlayer` and `roVideoPlayer` components were updated to support the CORS proxy.

### Release Changes

* Refactored usage of `canvas` and `fonts` to improve performance by [@lvcabral](https://github.com/lvcabral) in [#547](https://github.com/lvcabral/brs-engine/pull/547)
* Updated `lastKeyTime` and `currKeyTime` to consistently use `Date.now()` by [@lvcabral](https://github.com/lvcabral) in [#548](https://github.com/lvcabral/brs-engine/pull/548)
* Added support for literal keys on the Browser by [@lvcabral](https://github.com/lvcabral) in [#557](https://github.com/lvcabral/brs-engine/pull/557)
* Increased the `prettier` max line length from 100 to 120 by [@lvcabral](https://github.com/lvcabral) in [#559](https://github.com/lvcabral/brs-engine/pull/559)
* Bump http-proxy-middleware from 2.0.7 to 2.0.9 by @dependabot in [#561](https://github.com/lvcabral/brs-engine/pull/561)
* Optimized images by [@lvcabral](https://github.com/lvcabral) in [#566](https://github.com/lvcabral/brs-engine/pull/566)
* Added new custom `manifest` flag: `cors_proxy` by [@lvcabral](https://github.com/lvcabral) in [#571](https://github.com/lvcabral/brs-engine/pull/571)
* Moved `useCORSProxy` and `singleKeyEvents` from `Interpreter` to `BrsDevice` by [@lvcabral](https://github.com/lvcabral) in [#572](https://github.com/lvcabral/brs-engine/pull/572)
* Added support for CORS proxy to `roAudioPlayer` and `roVideoPlayer` by [@lvcabral](https://github.com/lvcabral) in [#573](https://github.com/lvcabral/brs-engine/pull/573)
* Prevent use CORS proxy on local URLs by [@lvcabral](https://github.com/lvcabral) in [#574](https://github.com/lvcabral/brs-engine/pull/574)
* Added support for default sound effect volume level by [@lvcabral](https://github.com/lvcabral) in [#579](https://github.com/lvcabral/brs-engine/pull/579)
* Implemented `flags` parameter on `ParseJSON()` global function by [@lvcabral](https://github.com/lvcabral) in [#585](https://github.com/lvcabral/brs-engine/pull/585)
* Implemented `FormatJSON` flag to disable escape of non-ASCII characters by [@lvcabral](https://github.com/lvcabral) in [#586](https://github.com/lvcabral/brs-engine/pull/586)
* Fixed `Left()` `Mid()` and `Substitute()` global functions by [@lvcabral](https://github.com/lvcabral) in [#587](https://github.com/lvcabral/brs-engine/pull/587)
* Support extended Unicode in `chr()` and `asc()` by [@lvcabral](https://github.com/lvcabral) in [#588](https://github.com/lvcabral/brs-engine/pull/588)

[Full Changelog][v1.8.8]

<a name="v1.8.7"></a>

## [v1.8.7 - New `InStr()` 2 params signature](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.7) - 12 April 2025

This release brings a few discoveries from the discussions in the [Roku Development Community slack](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA), including the undocumented signature for `InStr()` function with only 2 parameters, the  `roTimespan.totalMicroseconds()` method and the `Type()` function returning "legacy" types (unless you pass version 3 parameter). Some important fixes to highlight are the support for boxed values as array indexes and having `roBoolean` to be properly comparable.

### Release Changes

* Implemented the signature with 2 parameters on `InStr()` by [@lvcabral](https://github.com/lvcabral) in [#534](https://github.com/lvcabral/brs-engine/pull/534)
* Added legacy types support for `Type()` function by [@lvcabral](https://github.com/lvcabral) in [#536](https://github.com/lvcabral/brs-engine/pull/536)
* Implemented `roTimespan.totalMicroseconds()` and changed `roTimespan` to use `performance.now()` by [@lvcabral](https://github.com/lvcabral) in [#501](https://github.com/lvcabral/brs-engine/pull/501)
* Implemented `roHttpAgent` component by [@lvcabral](https://github.com/lvcabral) in [#499](https://github.com/lvcabral/brs-engine/pull/499)
* Added support to use a CORS proxy with `roURLTransfer` and `Network` modules by [@lvcabral](https://github.com/lvcabral) in [#514](https://github.com/lvcabral/brs-engine/pull/514)
* Fixed `MacOS` keyboard mapping for `Info` (asterisk) remote button by [@lvcabral](https://github.com/lvcabral) in [#511](https://github.com/lvcabral/brs-engine/pull/511)
* Fixed `m` context when the indexed function was accessed inside an AA by [@lvcabral](https://github.com/lvcabral) in [#509](https://github.com/lvcabral/brs-engine/pull/509)
* Added mocked libraries `RED` and `Google IMA3` by [@lvcabral](https://github.com/lvcabral) in [#508](https://github.com/lvcabral/brs-engine/pull/508)
* Implemented support for using `methods` with literal `integer` values by [@lvcabral](https://github.com/lvcabral) in [#507](https://github.com/lvcabral/brs-engine/pull/507)
* Properly handle `NaN` in number types, print and conversion by [@lvcabral](https://github.com/lvcabral) in [#502](https://github.com/lvcabral/brs-engine/pull/502)
* Updated web demo app to upscale the display when in fullscreen mode by [@lvcabral](https://github.com/lvcabral) in [#513](https://github.com/lvcabral/brs-engine/pull/513)
* Improved the scaling quality of the web demo app by [@lvcabral](https://github.com/lvcabral) in [#525](https://github.com/lvcabral/brs-engine/pull/525)
* Prevent crash when no entry point is defined by [@lvcabral](https://github.com/lvcabral) in [#516](https://github.com/lvcabral/brs-engine/pull/516)
* Added `backslash` key as alternative to the `replay` button on the sample app by [@lvcabral](https://github.com/lvcabral) in [#520](https://github.com/lvcabral/brs-engine/pull/520)
* Fixed boxed `boolean` values not being comparable by [@lvcabral](https://github.com/lvcabral) in [#528](https://github.com/lvcabral/brs-engine/pull/528)
* Fixed handling of boxed array indexes by [@lvcabral](https://github.com/lvcabral) in [#530](https://github.com/lvcabral/brs-engine/pull/530)

[Full Changelog][v1.8.7]

<a name="v1.8.6"></a>

## [v1.8.6 - Fixed `m` context with `IndexedGet`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.6) - 18 March 2025

Continuing the refactorings v1.8.x to improve the architecture and support `SceneGraph` development, the internal device assets (fonts, sounds, images and libraries)
are now stored in the `common.zip` file that holds the `common:/` volume in the file system. Created `npm` packages to several dependencies that were forked of archived
or modified components. And mainly this brings a fix for the `m` context when using indexed get to retrieve functions.

### Release Changes

* Created `BrsDevice` static object with `deviceInfo`, `registry` and `sharedArray` by [@lvcabral](https://github.com/lvcabral) in [#469](https://github.com/lvcabral/brs-engine/pull/469)
* Moved `FileSystem` to `BrsDevice` by [@lvcabral](https://github.com/lvcabral) in [#470](https://github.com/lvcabral/brs-engine/pull/470)
* Moved `stdout` and `stderr` from `Interpreter` to `BrsDevice` by [@lvcabral](https://github.com/lvcabral) in [#472](https://github.com/lvcabral/brs-engine/pull/472)
* Fixed the `Val()` global function to always return `Float` if no `radix` parameter is passed by [@lvcabral](https://github.com/lvcabral) in [#474](https://github.com/lvcabral/brs-engine/pull/474)
* Moved `fonts`, `audio` and `libraries` to `common:` volume as a `zip` file by [@lvcabral](https://github.com/lvcabral) in [#475](https://github.com/lvcabral/brs-engine/pull/475)
* Prevent transforming `DeviceInfo` into a `Map` by [@lvcabral](https://github.com/lvcabral) in [#478](https://github.com/lvcabral/brs-engine/pull/478)
* Moved `Rect` and `Circle` type definitions to `ifDraw2D` by [@lvcabral](https://github.com/lvcabral) in [#481](https://github.com/lvcabral/brs-engine/pull/481)
* Updating forked dependencies by [@lvcabral](https://github.com/lvcabral) in [#495](https://github.com/lvcabral/brs-engine/pull/495)
* Invert the remote control mapping for `PageUp` and `PageDown` keys by [@lvcabral](https://github.com/lvcabral) in [#497](https://github.com/lvcabral/brs-engine/pull/497)
* Fixed `m` context when getting function with `index` [#494](https://github.com/lvcabral/brs-engine/issues/494) by [@lvcabral](https://github.com/lvcabral) in [#498](https://github.com/lvcabral/brs-engine/pull/498)

[Full Changelog][v1.8.6]

<a name="v1.8.5"></a>

## [v1.8.5 - Implemented `roTextureManager`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.5) - 31 January 2025

This release brings more refactoring, with the Event components being moved to a separate folder, and the implementation of `roTextureManager`. As the development of the next major version already started, with support for SceneGraph, some changes were done in `ifDraw2D` to allow the reuse of its graphical capabilities on the Nodes rendering. 
I believe this is a stable state of the `core` library, and any Roku app developed using the Draw 2D API should be able to perform well in multiple platforms.

### Release Changes

* Implemented `ifHttpAgent` as a separate interface module by [@lvcabral](https://github.com/lvcabral) in [#464](https://github.com/lvcabral/brs-engine/pull/464)
* Implemented `roTextureRequest` and `roTextureManager` by [@lvcabral](https://github.com/lvcabral) in [#465](https://github.com/lvcabral/brs-engine/pull/465)
* Implemented mocked `roDataGramSocket` and extracted common interfaces into `ifSocket` by [@lvcabral](https://github.com/lvcabral) in [#466](https://github.com/lvcabral/brs-engine/pull/466)
* Moved events to a separate folder
* Adjusted `rgba` parameter in `ifDraw2D` to be `number`

[Full Changelog][v1.8.5]

<a name="v1.8.4"></a>

## [v1.8.4 - Improved `roURLTransfer`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.4) - 26 January 2025

### Release Changes

* Implemented `roSocketAddress` by [@lvcabral](https://github.com/lvcabral) in [#460](https://github.com/lvcabral/brs-engine/pull/460)
* Improved component `roURLTransfer` by [@lvcabral](https://github.com/lvcabral) in [#461](https://github.com/lvcabral/brs-engine/pull/461)
* Implemented mocked `roStreamSocket` component by [@lvcabral](https://github.com/lvcabral) in [#462](https://github.com/lvcabral/brs-engine/pull/462)
* Implemented `roHdmiStatus` and `roHdmiStatusEvent` components by [@lvcabral](https://github.com/lvcabral) in [#463](https://github.com/lvcabral/brs-engine/pull/463)

[Full Changelog][v1.8.4]

<a name="v1.8.3"></a>

## [v1.8.3 - Fixed `roVideoPlayer` and `End` Statement](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.3) - 18 January 2025

### Release Changes

* Fixed `roVideoPlayer` method `getAudioTracks`
* Added `serialNumber` to device info object and to reponse of `GetModelDetails()`
* Fixed behavior of `End` statement to terminate the app
* Improved CLI app list handling
* Improved and documented MicroDebugger functions
* Moved home sound effect setup
* Improvements on WAV handling
* Reduced complexity and simplifed some references
* Upgraded dependencies

[Full Changelog][v1.8.3]

<a name="v1.8.2"></a>

## [v1.8.2 - Fixed `ifToStr()` for `roInvalid`](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.2) - 17 January 2025

### Release Changes

* Fixed `IfToStr` to properly handle `roInvalid` component by [@lvcabral](https://github.com/lvcabral) in [#451](https://github.com/lvcabral/brs-engine/pull/451)
* Simplified `AppPayload` type checking by [@lvcabral](https://github.com/lvcabral) in [#452](https://github.com/lvcabral/brs-engine/pull/452)

[Full Changelog][v1.8.2]

<a name="v1.8.1"></a>

## [v1.8.1 - New interface modules and fixes on number parsing](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.1) - 10 January 2025

This release bring several fixes on numeric types parsing to hexadecimal and using the `toStr()` and `String.format()` methods. This also brings the extraction of reused interfaces into separate modules, reducing the replication of code and also improving the maintainability of the `core` library.

### Release Changes

* Fixed `Int32` constructor handling of overflow to match Roku by [@lvcabral](https://github.com/lvcabral) in [#435](https://github.com/lvcabral/brs-engine/pull/435)
* Upgraded dependency `restana` to v5.0.0 by [@lvcabral](https://github.com/lvcabral) in [#436](https://github.com/lvcabral/brs-engine/pull/436)
* Added new `roDateTime` methods: `asSecondsLong` and `fromSecondsLong` by [@lvcabral](https://github.com/lvcabral) in [#437](https://github.com/lvcabral/brs-engine/pull/437)
* Fixed `Int32` and `Int64` hex parsing and formatting by [@lvcabral](https://github.com/lvcabral) in [#438](https://github.com/lvcabral/brs-engine/pull/438)
* Simplified `Int32` constructor code by [@lvcabral](https://github.com/lvcabral) in [#439](https://github.com/lvcabral/brs-engine/pull/439)
* Updated some documentation pages by [@lvcabral](https://github.com/lvcabral) in [#440](https://github.com/lvcabral/brs-engine/pull/440)
* Fixed runtime error stack trace on `Callables` by [@lvcabral](https://github.com/lvcabral) in [#442](https://github.com/lvcabral/brs-engine/pull/442)
* Created `ifToStr()` and refactored components to use it and improved `sprintf` formatting by [@lvcabral](https://github.com/lvcabral) in [#443](https://github.com/lvcabral/brs-engine/pull/443)
* Change file names to the standard by [@lvcabral](https://github.com/lvcabral) in [#444](https://github.com/lvcabral/brs-engine/pull/444)
* Made `ifToStr` to handle components that do not support `format` by [@lvcabral](https://github.com/lvcabral) in [#445](https://github.com/lvcabral/brs-engine/pull/445)
* Created `IfSetMessagePort`  and  `IfGetMessagePort` interfaces by [@lvcabral](https://github.com/lvcabral) in [#446](https://github.com/lvcabral/brs-engine/pull/446)
* Implemented `IfEnum` as an interface module and refactored components by [@lvcabral](https://github.com/lvcabral) in [#447](https://github.com/lvcabral/brs-engine/pull/447)
* Implemented `IfDraw2D` interface to simplify and reuse code by [@lvcabral](https://github.com/lvcabral) in [#448](https://github.com/lvcabral/brs-engine/pull/448)
* Improved `IfToStr` type checking by [@lvcabral](https://github.com/lvcabral) in [#449](https://github.com/lvcabral/brs-engine/pull/449)
* Implemented `IfArray` and `IfList` interface modules by [@lvcabral](https://github.com/lvcabral) in [#450](https://github.com/lvcabral/brs-engine/pull/450)

[Full Changelog][v1.8.1]

<a name="v1.8.0"></a>

## [v1.8.0 - Multiple Improvements](https://github.com/lvcabral/brs-engine/releases/tag/v1.8.0) - 03 January 2025

This release is full of refactorings and improvements on the engine internals, the folder structure was also changed with the `app` folder renamed to `browser` and the `src/worker` folder renamed to `src/core`. The File System now supports the external USB volume (`ext1:`) that can be mounted from an additional `zip` file (or folder in CLI). Several other changes and improvements were done in the registry and apps management. The `roMessagePort` component was simplified and improved, and new events are now supported, in particular: `roInput` (via ECP and API) and `roChannelStore` using the `fakeServer(true)` option. The BrightScript language and components are now synchronized with Roku OS 14.
Check specific PRs in the log below for more information.

### Release Changes

* Implemented `roDeviceInfo.getExternalIP()` by [@lvcabral](https://github.com/lvcabral) in [#397](https://github.com/lvcabral/brs-engine/pull/397)
* Prevent crash when using invalid URL() by [@lvcabral](https://github.com/lvcabral) in [398](#https://github.com/lvcabral/brs-engine/pull/398)
* Improved check for `SharedArrayBuffer` support by [@lvcabral](https://github.com/lvcabral) in [#399](https://github.com/lvcabral/brs-engine/pull/399)
* Finish optional chaining operator implementation by [@lvcabral](https://github.com/lvcabral) in [#400](https://github.com/lvcabral/brs-engine/pull/400)
* Added support for `RokuBrowser` library and `roNDK` component. by [@lvcabral](https://github.com/lvcabral) in [#402](https://github.com/lvcabral/brs-engine/pull/402)
* Implemented support to mount External storage as volume `ext1:` by [@lvcabral](https://github.com/lvcabral) in [#403](https://github.com/lvcabral/brs-engine/pull/403)
* Several Registry improvements by [@lvcabral](https://github.com/lvcabral) in [#407](https://github.com/lvcabral/brs-engine/pull/407)
* Changed the `For Each` behavior to match Roku, using `ifEnum` iteration index by [@lvcabral](https://github.com/lvcabral) in [#410](https://github.com/lvcabral/brs-engine/pull/410)
* Several App handling/management improvements by [@lvcabral](https://github.com/lvcabral) in [#413](https://github.com/lvcabral/brs-engine/pull/413)
* Added `Platform` info to the result of `roDeviceInfo.getModelDetails()` by [@lvcabral](https://github.com/lvcabral) in [#414](https://github.com/lvcabral/brs-engine/pull/414)
* Allowed `m` object to be re-assigned in Function scope by [@lvcabral](https://github.com/lvcabral) in [#417](https://github.com/lvcabral/brs-engine/pull/417)
* Implemented `global` static object by [@lvcabral](https://github.com/lvcabral) in [#418](https://github.com/lvcabral/brs-engine/pull/418)
* Implemented BrightScript features up to Roku OS 14.0 by [@lvcabral](https://github.com/lvcabral) in [#420](https://github.com/lvcabral/brs-engine/pull/420)
* Add new supported control buttons and ECP command by [@lvcabral](https://github.com/lvcabral) in [#421](https://github.com/lvcabral/brs-engine/pull/421)
* Remove debug local ips by [@lvcabral](https://github.com/lvcabral) in [#422](https://github.com/lvcabral/brs-engine/pull/422)
* Fixed `CreateObject` behavior to match Roku by [@lvcabral](https://github.com/lvcabral) in [#423](https://github.com/lvcabral/brs-engine/pull/423)
* Raised Runtime Error with Interpreter `addError` method by [@lvcabral](https://github.com/lvcabral) in [#424](https://github.com/lvcabral/brs-engine/pull/424)
* Implemented `roSystemLog` and refactored `roMessagePort` by [@lvcabral](https://github.com/lvcabral) in [#426](https://github.com/lvcabral/brs-engine/pull/426)
* Fixed `dev` app saving data on app list by [@lvcabral](https://github.com/lvcabral) in [#427](https://github.com/lvcabral/brs-engine/pull/427)
* Implemented function `toAssociativeArray()` to simplify creation of AA in TypeScript code by [@lvcabral](https://github.com/lvcabral) in [#428](https://github.com/lvcabral/brs-engine/pull/428)
* Implemented `roDeviceInfoEvent` by [@lvcabral](https://github.com/lvcabral) in [#429](https://github.com/lvcabral/brs-engine/pull/429)
* Implement `roCECStatus` component by [@lvcabral](https://github.com/lvcabral) in [#430](https://github.com/lvcabral/brs-engine/pull/430)
* Add fake server support to `roChannelStore` by [@lvcabral](https://github.com/lvcabral) in [#431](https://github.com/lvcabral/brs-engine/pull/431)
* Fix File System when using `root` or `ext` CLI flags and running on Linux by [@lvcabral](https://github.com/lvcabral) in [#432](https://github.com/lvcabral/brs-engine/pull/432)
* Restricted `FlexObject` content types by [@lvcabral](https://github.com/lvcabral) in [#433](https://github.com/lvcabral/brs-engine/pull/433)
* Implemented support for `roInputEvent` generated via ECP or API by [@lvcabral](https://github.com/lvcabral) in [#434](https://github.com/lvcabral/brs-engine/pull/434)
* build(deps): bump elliptic from 6.5.7 to 6.6.0 by @dependabot in [#394](https://github.com/lvcabral/brs-engine/pull/394)

[Full Changelog][v1.8.0]

<a name="v1.7.3"></a>

## [v1.7.3 - Fixed Optional Operators and For Each](https://github.com/lvcabral/brs-engine/releases/tag/v1.7.3) - 05 December 2024

### Release Changes

* Changed the `For Each` behavior to match Roku, using `ifEnum` iteration index by [@lvcabral](https://github.com/lvcabral) in [#410](https://github.com/lvcabral/brs-engine/pull/410)
* Finished optional chaining operator implementation by [@lvcabral](https://github.com/lvcabral) in [#400](https://github.com/lvcabral/brs-engine/pull/400)
* Implemented `roDeviceInfo.getExternalIP()` by [@lvcabral](https://github.com/lvcabral) in [#397](https://github.com/lvcabral/brs-engine/pull/397)
* Prevent crash when using invalid URL() by [@lvcabral](https://github.com/lvcabral) in [#398](https://github.com/lvcabral/brs-engine/pull/398)
* Improved check for `SharedArrayBuffer` suport by [@lvcabral](https://github.com/lvcabral) in [#399](https://github.com/lvcabral/brs-engine/pull/399)
* build(deps): bump elliptic from 6.5.7 to 6.6.0 by @dependabot in https://github.com/lvcabral/brs-engine/pull/394

[Full Changelog][v1.7.3]

<a name="v1.7.0"></a>

## [v1.7.0 - FormatJSON() fixes and MicroDebugger stats](https://github.com/lvcabral/brs-engine/releases/tag/v1.7.0) - 12 October 2024

### Release Changes

* Implemented new Type and Enum definitions by [@lvcabral](https://github.com/lvcabral) in [#374](https://github.com/lvcabral/brs-engine/pull/374)
* Added reference tracking and object disposal event by [@lvcabral](https://github.com/lvcabral) in [#373](https://github.com/lvcabral/brs-engine/pull/373)
* Implemented `ObjFun()` global function and support for `variadic` arguments on `Callable` by [@lvcabral](https://github.com/lvcabral) in [#375](https://github.com/lvcabral/brs-engine/pull/375)
* Added support for `formatJson()` undocumented flags 256 and 512 by [@lvcabral](https://github.com/lvcabral) in [#377](https://github.com/lvcabral/brs-engine/pull/377)
* Implemented Micro Debugger commands:  `classes`,  `bscs` and `stats` by [@lvcabral](https://github.com/lvcabral) in [#385](https://github.com/lvcabral/brs-engine/pull/385)
* Static analysis fixes by [@lvcabral](https://github.com/lvcabral) in [#389](https://github.com/lvcabral/brs-engine/pull/389)
* Fixed Critical bug with `formatJson` #383 by [@lvcabral](https://github.com/lvcabral) in [#390](https://github.com/lvcabral/brs-engine/pull/390)
* Fixed #384 - Allow `try` and `catch` as object properties. by [@lvcabral](https://github.com/lvcabral) in [#391](https://github.com/lvcabral/brs-engine/pull/391)
* build(deps-dev): bump webpack from 5.91.0 to 5.94.0 by @dependabot in [#381](https://github.com/lvcabral/brs-engine/pull/381)
* build(deps): bump ws from 8.17.0 to 8.17.1 by @dependabot in [#379](https://github.com/lvcabral/brs-engine/pull/379)
* build(deps): bump braces from 3.0.2 to 3.0.3 by @dependabot in [#378](https://github.com/lvcabral/brs-engine/pull/378)
* build(deps): bump elliptic from 6.5.5 to 6.5.7 by @dependabot in [#386](https://github.com/lvcabral/brs-engine/pull/386)
* build(deps): bump express from 4.19.2 to 4.21.1 by @dependabot in [#387](https://github.com/lvcabral/brs-engine/pull/387)
* Upgraded dependencies by [@lvcabral](https://github.com/lvcabral) in [#388](https://github.com/lvcabral/brs-engine/pull/388)

[Full Changelog][v1.7.0]

<a name="v1.6.1"></a>

## [v1.6.1 - Numeric Labels](https://github.com/lvcabral/brs-engine/releases/tag/v1.6.1) - 11 May 2024

### Release Changes

* Added support for numeric labels by [@lvcabral](https://github.com/lvcabral) in [#372](https://github.com/lvcabral/brs-engine/pull/372)
* Fixed `goto` with `try/catch` by [@lvcabral](https://github.com/lvcabral) in [#371](https://github.com/lvcabral/brs-engine/pull/371)

[Full Changelog][v1.6.1]

<a name="v1.6.0"></a>

## [v1.6.0 - Goto Label Statement](https://github.com/lvcabral/brs-engine/releases/tag/v1.6.0) - 05 May 2024

### Release Changes

* Implemented `goto` statement by [@lvcabral](https://github.com/lvcabral) in [#367](https://github.com/lvcabral/brs-engine/pull/367)
* Fixed sound `select` not being triggered [@lvcabral](https://github.com/lvcabral) in [#366](https://github.com/lvcabral/brs-engine/pull/366)

[Full Changelog][v1.6.0]

<a name="v1.5.7"></a>

## [v1.5.7 - Fixed Critical Issue](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.7) - 01 May 2024

### Release Changes

* Fixed issue that was not restoring the environment in Try mode when `stopOnCrash` was enabled by [@lvcabral](https://github.com/lvcabral) in [#361](https://github.com/lvcabral/brs-engine/pull/361)
* Reduced complexity of Try/Catch visit functions by [@lvcabral](https://github.com/lvcabral) in [#362](https://github.com/lvcabral/brs-engine/pull/362)

[Full Changelog][v1.5.7]

<a name="v1.5.6"></a>

## [v1.5.6 - Bump to Firmware 11.5 and Fixes](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.6) - 01 May 2024

### Release Changes

* Fixed loading fonts on CLI when running `.brs` files by [@lvcabral](https://github.com/lvcabral) in [#351](https://github.com/lvcabral/brs-engine/pull/351)
* Added unit tests for `continue for/while` by [@lvcabral](https://github.com/lvcabral) in [#352](https://github.com/lvcabral/brs-engine/pull/352)
* Improvements to stack trace and `try...catch` by [@lvcabral](https://github.com/lvcabral) in [#353](https://github.com/lvcabral/brs-engine/pull/353)
* Updated engine-api.md by [@lvcabral](https://github.com/lvcabral) in [#354](https://github.com/lvcabral/brs-engine/pull/354)
* Simplification of the Error objects and removing abbreviations from properties by [@lvcabral](https://github.com/lvcabral) in [#355](https://github.com/lvcabral/brs-engine/pull/355)
* Renamed type `ErrorCode` to `ErrorDetail` by [@lvcabral](https://github.com/lvcabral) in [#356](https://github.com/lvcabral/brs-engine/pull/356)
* Updated Firmware Version to 11.5 as `continue for/while` is now supported by [@lvcabral](https://github.com/lvcabral) in [#357](https://github.com/lvcabral/brs-engine/pull/357)
* Removed usage of global objects to encrypt/decrypt packages by [@lvcabral](https://github.com/lvcabral) in [#358](https://github.com/lvcabral/brs-engine/pull/358)
* Fixed multiple Static Analysis issues raised by Sonar Cloud by [@lvcabral](https://github.com/lvcabral) in [#359](https://github.com/lvcabral/brs-engine/pull/359)
* Increased the timeout for CLI run zip file test to 10s by [@lvcabral](https://github.com/lvcabral) in [#360](https://github.com/lvcabral/brs-engine/pull/360)

[Full Changelog][v1.5.6]

<a name="v1.5.5"></a>

## [v1.5.5 - Several fixes and Unit Tests enabled](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.5) - 26 Apr 2024

### Release Changes

* Implemented `pos()` and `tab()` for `print` statement by [@lvcabral](https://github.com/lvcabral) in [#339](https://github.com/lvcabral/brs-engine/pull/339)
* Fixed Callable signature check by [@lvcabral](https://github.com/lvcabral) in [#340](https://github.com/lvcabral/brs-engine/pull/340)
* Fixed conversion functions to Integer: `Int()`, `CInt()` and `Fix()` by [@lvcabral](https://github.com/lvcabral) in [#342](https://github.com/lvcabral/brs-engine/pull/342)
* Refactored `worker` and `cli` libraries to support `run` function by [@lvcabral](https://github.com/lvcabral) in [#344](https://github.com/lvcabral/brs-engine/pull/344)
* Updated CLI app to load the engine as an external library by [@lvcabral](https://github.com/lvcabral) in [#350](https://github.com/lvcabral/brs-engine/pull/350)
* Fixed CLI font loading by [@lvcabral](https://github.com/lvcabral) in [#345](https://github.com/lvcabral/brs-engine/pull/345)
* Fixed Unit Tests and several issues by [@lvcabral](https://github.com/lvcabral) in [#348](https://github.com/lvcabral/brs-engine/pull/348)
* Fixed Video seek causing a stack overflow crash by [@lvcabral](https://github.com/lvcabral) in [#349](https://github.com/lvcabral/brs-engine/pull/349)

[Full Changelog][v1.5.5]

<a name="v1.5.4"></a>

## [v1.5.4 - Continue For/While statements](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.4) - 14 Apr 2024

### Release Changes

* Implemented support for multi-dimensional indexes of `roArray` and `roList` by [@lvcabral](https://github.com/lvcabral) in [#331](https://github.com/lvcabral/brs-engine/pull/331)
* Implemented `Continue For` and `Continue While` statements by [@lvcabral](https://github.com/lvcabral) in [#332](https://github.com/lvcabral/brs-engine/pull/332)
* Fixed CLI: REPL was not showing any error messages.

[Full Changelog][v1.5.4]

<a name="v1.5.3"></a>

## [v1.5.3 - Metadata components and Coercion](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.3) - 12 Apr 2024

### Release Changes

* Implemented `roImageMetadata` component by [@lvcabral](https://github.com/lvcabral) in [#325](https://github.com/lvcabral/brs-engine/pull/325)
* Implemented `roAudioMetadata` component by [@lvcabral](https://github.com/lvcabral) in [#326](https://github.com/lvcabral/brs-engine/pull/326)
* Fixed Boxing for Callable parameters and implemented Coercion properly by [@lvcabral](https://github.com/lvcabral) in [#327](https://github.com/lvcabral/brs-engine/pull/327)
* Fixed #323 MicroDebugger is stopping on handled exceptions (try..catch) by [@lvcabral](https://github.com/lvcabral) in [#324](https://github.com/lvcabral/brs-engine/pull/324)
* Upgraded dependencies

[Full Changelog][v1.5.3]

<a name="v1.5.2"></a>

## [v1.5.2 - Try..Catch and Throw](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.2) - 09 Apr 2024

### Release Changes

* Implemented `try...catch` and `throw` by [@lvcabral](https://github.com/lvcabral) in [#318](https://github.com/lvcabral/brs-engine/pull/318)
* Implemented support for `rethrown` and custom fields on `throw` statement by [@lvcabral](https://github.com/lvcabral) in [#319](https://github.com/lvcabral/brs-engine/pull/319)
* Implemented `ifArraySizeInfo` in `roArray` by [@lvcabral](https://github.com/lvcabral) in [#316](https://github.com/lvcabral/brs-engine/pull/316)
* Improved Lexer performance by [@lvcabral](https://github.com/lvcabral) in [317](https://github.com/lvcabral/brs-engine/pull/317)

[Full Changelog][v1.5.2]

<a name="v1.5.1"></a>

## [v1.5.1 - New: box(), roFunction and roDeviceCrypto](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.1) - 03 Apr 2024

### Release Changes
* Removed `isEmpty` from `roPath` to match Roku behavior by [@lvcabral](https://github.com/lvcabral) in [#306](https://github.com/lvcabral/brs-engine/pull/306)
* Allow to use AND/OR between Boolean and Numbers by [@lvcabral](https://github.com/lvcabral) in [#307](https://github.com/lvcabral/brs-engine/pull/307)
* Improved `roEVPCipher` error handling by [@lvcabral](https://github.com/lvcabral) in [#308](https://github.com/lvcabral/brs-engine/pull/308)
* Implemented `roDeviceCrypto` component by [@lvcabral](https://github.com/lvcabral) in [#309](https://github.com/lvcabral/brs-engine/pull/309)
* Implemented `roFunction` component and `Box()` runtime function by [@lvcabral](https://github.com/lvcabral) in [#310](https://github.com/lvcabral/brs-engine/pull/310)
* Improved Iterable objects to behave as Roku devices by [@lvcabral](https://github.com/lvcabral) in [#311](https://github.com/lvcabral/brs-engine/pull/311)
* Fixed Boxing on Numbers and Booleans by [@lvcabral](https://github.com/lvcabral) in [#313](https://github.com/lvcabral/brs-engine/pull/313)
* Fixed issues with `roByteArray` by [@lvcabral](https://github.com/lvcabral) in [#314](https://github.com/lvcabral/brs-engine/pull/314)
* Improved print variables by [@lvcabral](https://github.com/lvcabral) in [#315](https://github.com/lvcabral/brs-engine/pull/315)
* Implemented `slice()` method in `roArray` under `ifArraySlice`

[Full Changelog][v1.5.1]

<a name="v1.5.0"></a>

## [v1.5.0 - Encrypt/Decrypt components](https://github.com/lvcabral/brs-engine/releases/tag/v1.5.0) - 28 Mar 2024

### Release Changes

* Added: `roEVPDigest` component by [@lvcabral](https://github.com/lvcabral) in [#301](https://github.com/lvcabral/brs-engine/pull/301)
* Added: `roEVPCipher` component by [@lvcabral](https://github.com/lvcabral) in [#303](https://github.com/lvcabral/brs-engine/pull/303)
* Added: `roHMAC` component by [@lvcabral](https://github.com/lvcabral) in [#305](https://github.com/lvcabral/brs-engine/pull/305)
* Changed: Improvements to `roPath` by [@lvcabral](https://github.com/lvcabral) in [#296](https://github.com/lvcabral/brs-engine/pull/296)
* Changed: `roUrlEvent` and `roUniversalControlEvent` to be comparable by [@lvcabral](https://github.com/lvcabral) in [#299](https://github.com/lvcabral/brs-engine/pull/299)
* Changed: Updated Limitations document by [@lvcabral](https://github.com/lvcabral) in [#302](https://github.com/lvcabral/brs-engine/pull/302)
* Changed: Only raise HTTP Errors in development mode and other exception handling improvements [@lvcabral](https://github.com/lvcabral) in [#300](https://github.com/lvcabral/brs-engine/pull/300)
* Fixed: `ifString.tokenize()` behavior to match Roku by [@lvcabral](https://github.com/lvcabral) in [#295](https://github.com/lvcabral/brs-engine/pull/295)
* Fixed: `String` comparison and concatenation by [@lvcabral](https://github.com/lvcabral) in [#298](https://github.com/lvcabral/brs-engine/pull/298)
* build(deps): bump express from 4.18.3 to 4.19.2 by **@dependabot** in [#297](https://github.com/lvcabral/brs-engine/pull/297)

[Full Changelog][v1.5.0]

<a name="v1.4.1"></a>

## [v1.4.1 - CLI: Removed Flicker on ASCII Mode](https://github.com/lvcabral/brs-engine/releases/tag/v1.4.1) - 22 Mar 2024

### Release Changes

* Updated: Flicker on CLI ASCII mode was removed by [@lvcabral](https://github.com/lvcabral) in [#294](https://github.com/lvcabral/brs-engine/pull/294)
* Updated: IIS config file was added for the sample web app by [@lvcabral](https://github.com/lvcabral) in [#294](https://github.com/lvcabral/brs-engine/pull/294)
* Fixed: Invalid BRS files are now handled correctly by [@lvcabral](https://github.com/lvcabral) in [#294](https://github.com/lvcabral/brs-engine/pull/294)
* build(deps): bump webpack-dev-middleware from 5.3.3 to 5.3.4 by **@dependabot** in [#293](https://github.com/lvcabral/brs-engine/pull/293)

[Full Changelog][v1.4.1]

<a name="v1.4.0"></a>

## [v1.4.0 - CLI: Canvas and HTTP support](https://github.com/lvcabral/brs-engine/releases/tag/v1.4.0) - 21 Mar 2024

### Release Changes

* Added: Support for `ifDraw2D` in CLI with flag to show screen as ASCII Art by [@lvcabral](https://github.com/lvcabral) in [#284](https://github.com/lvcabral/brs-engine/pull/284)
* Added: Support for `roUrlTransfer` in CLI by [@lvcabral](https://github.com/lvcabral) in [#289](https://github.com/lvcabral/brs-engine/pull/289)
* Added: ECP and SSDP services to the CLI by [@lvcabral](https://github.com/lvcabral) in [#290](https://github.com/lvcabral/brs-engine/pull/290)
* Added: New `ascii_rendering` custom feature (only on CLI) by [@lvcabral](https://github.com/lvcabral) in [#291](https://github.com/lvcabral/brs-engine/pull/291)
* Added: Option to CLI persist the registry to the disk by [@lvcabral](https://github.com/lvcabral) in [#292](https://github.com/lvcabral/brs-engine/pull/292)
* Fixed: CLI Font Loading by [@lvcabral](https://github.com/lvcabral) in [#285](https://github.com/lvcabral/brs-engine/pull/285)

[Full Changelog][v1.4.0]

<a name="v1.3.2"></a>

## [v1.3.2 - Custom Features](https://github.com/lvcabral/brs-engine/releases/tag/v1.3.2) - 09 Mar 2024

### Release Changes

* Add custom features by [@lvcabral](https://github.com/lvcabral) in [#283](https://github.com/lvcabral/brs-engine/pull/283)
  * Added a way to add custom features to be checked by `roDeviceInfo.hasFeatures()`
  * Created new document [docs/customization.md](https://github.com/lvcabral/brs-engine/blob/master/docs/customization.md)
  * Updated default game pad mapping

[Full Changelog][v1.3.2]

<a name="v1.3.1"></a>

## [v1.3.1 - MicroDebugger Improvements](https://github.com/lvcabral/brs-engine/releases/tag/v1.3.1) - 02 Mar 2024

### Release Changes

* Micro debugger improvements by [@lvcabral](https://github.com/lvcabral) in [#280](https://github.com/lvcabral/brs-engine/pull/280)
  * Added to the API `initialize` method a new option: `disableDebug`
  * Added to the MicroDebugger support for `Function`, `If`,  `For` and `While`
  * Added support for MicroDebugger on CLI
  * Fixed MicroDebugger formatting issues and the handling of linefeed
  * Moved command parsing code from API to MicroDebugger
  * Added `quit` command to the MicroDebugger
* Added #278 - Support to ECP control keys `VolumeMute` and `PowerOff` by [@lvcabral](https://github.com/lvcabral) in [#279](https://github.com/lvcabral/brs-engine/pull/279)

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

[v1.9.3]: https://github.com/lvcabral/brs-engine/compare/v1.9.2...v1.9.3
[v1.9.2]: https://github.com/lvcabral/brs-engine/compare/v1.9.1...v1.9.2
[v1.9.1]: https://github.com/lvcabral/brs-engine/compare/v1.8.9...v1.9.1
[v1.8.9]: https://github.com/lvcabral/brs-engine/compare/v1.8.8...v1.8.9
[v1.8.8]: https://github.com/lvcabral/brs-engine/compare/v1.8.7...v1.8.8
[v1.8.7]: https://github.com/lvcabral/brs-engine/compare/v1.8.6...v1.8.7
[v1.8.6]: https://github.com/lvcabral/brs-engine/compare/v1.8.5...v1.8.6
[v1.8.5]: https://github.com/lvcabral/brs-engine/compare/v1.8.4...v1.8.5
[v1.8.4]: https://github.com/lvcabral/brs-engine/compare/v1.8.3...v1.8.4
[v1.8.3]: https://github.com/lvcabral/brs-engine/compare/v1.8.2...v1.8.3
[v1.8.2]: https://github.com/lvcabral/brs-engine/compare/v1.8.1...v1.8.2
[v1.8.1]: https://github.com/lvcabral/brs-engine/compare/v1.8.0...v1.8.1
[v1.8.0]: https://github.com/lvcabral/brs-engine/compare/v1.7.2...v1.8.0
[v1.7.3]: https://github.com/lvcabral/brs-engine/compare/v1.7.0...v1.7.3
[v1.7.0]: https://github.com/lvcabral/brs-engine/compare/v1.6.1...v1.7.0
[v1.6.1]: https://github.com/lvcabral/brs-engine/compare/v1.6.0...v1.6.1
[v1.6.0]: https://github.com/lvcabral/brs-engine/compare/v1.5.7...v1.6.0
[v1.5.7]: https://github.com/lvcabral/brs-engine/compare/v1.5.6...v1.5.7
[v1.5.6]: https://github.com/lvcabral/brs-engine/compare/v1.5.5...v1.5.6
[v1.5.5]: https://github.com/lvcabral/brs-engine/compare/v1.5.4...v1.5.5
[v1.5.4]: https://github.com/lvcabral/brs-engine/compare/v1.5.3...v1.5.4
[v1.5.3]: https://github.com/lvcabral/brs-engine/compare/v1.5.2...v1.5.3
[v1.5.2]: https://github.com/lvcabral/brs-engine/compare/v1.5.1...v1.5.2s
[v1.5.1]: https://github.com/lvcabral/brs-engine/compare/v1.5.0...v1.5.1
[v1.5.0]: https://github.com/lvcabral/brs-engine/compare/v1.4.1...v1.5.0
[v1.4.1]: https://github.com/lvcabral/brs-engine/compare/v1.4.0...v1.4.1
[v1.4.0]: https://github.com/lvcabral/brs-engine/compare/v1.3.2...v1.4.0
[v1.3.2]: https://github.com/lvcabral/brs-engine/compare/v1.3.1...v1.3.2
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
