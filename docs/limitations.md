# BrightScript Engine Current Limitations

The **BrightScript Engine** implements the BrightScript language specification up to Roku OS 15.0. However, some features and components remain unsupported or only partially implemented. These limitations fall into three categories: features planned for future development, components that will remain as mock objects for compatibility purposes, and functionality considered outside the project's scope. The following sections detail each category and its current status.

## In Scope (to be developed/fixed in future releases)

* **Roku SceneGraph** SDK components are currently being implemented in this branch and released as [pre-release alpha](https://github.com/lvcabral/brs-engine/releases), so far we support:
  * Load XML component files and create SceneGraph nodes tree.
  * Basic support for `roSGNode` and `roSGScreen` components and rendering.
  * The `Task` node is implemented but its behavior is limited:
    * For now only 10 task threads are supported per application
    * The `m.global` object can have children, but changes on those nodes are not shared among the threads
    * Only one `port` instance can be used on Task `init()` to observe fields
    * The `tmp:/` and `cachefs:/` volumes are not shared with task threads, can be used in task but are empty
  * The following nodes are implemented (some only partially):
    * The basic nodes: `ContentNode`, `Group`, `Scene`, `Font`, `Timer`, `Rectangle`, `Label`, `ScrollingLabel`, `Poster` and `RSGPalette`
    * Grids and list nodes based on `ArrayGrid`: `LabelList`, `CheckList`, `RadioButtonList`, `MarkupList` and `MarkupGrid`
    * Dialog related nodes: `Dialog`, `KeyboardDialog`, `StandardDialog`, `StandardProgressDialog`, `StdDlgProgressItem`, `StdDlgContentArea` and `StdDlgTitleArea`
    * Media related nodes: `Audio`, `SoundEffect` and `Video`
    * Other supported nodes: `Button`, `ButtonGroup`, `BusySpinner`, `Overhang`, `Keyboard`, `MiniKeyboard`, `TextEditBox` and `ChannelStore`
  * All other nodes are either mocked or not implemented yet, and if used will be created as a plain `Node`.
* The following components are also not implemented yet:
  * Text to Speech components: `roAudioGuide`, `roMicrophone` and `roTextToSpeech`
  * Signing Algorithm components: `roDSA` and `roRSA`
* Audio playback is implemented via `roAudioResources`, `SoundEffect`, `roAudioPlayer` and `Audio` node, but with some limitations:
  * Only one instance of `roAudioPlayer` or `Audio` node should be used, if more are created those will share the content playlist.
  * If the `roAudioPlayer` or `Audio` node instance is destroyed the audio keeps playing, make sure to stop the playback before discarding the object.
  * No `Timed Metadata` support.
* The component `roAudioMetadata` only supports MP3 (for now).
* The component `roImageMetadata` only supports JPEG images (for now).
* Video playback is implemented via `roVideoPlayer` and `Video` node, but with some limitations:
  * If the instance of `roVideoPlayer` or `Video` is destroyed the video keeps playing, make sure to `stop` before discarding the object.
  * The following `roVideoPlayer` methods are not supported, implemented as mock: `setCGMS`, `setMaxVideoDecodeResolution`, `setTimedMetadataForKeys`, `getCaptionRenderer`
  * Check what formats (container and codec) can be used on each browser, using `roDeviceInfo.canDecodeVideo()`, to make sure your video can be played.
  * Subtitles are only supported for HLS streams and only in `Video` node, the `roVideoPlayer` does not support subtitles for now.
  * BIF (Base Index Frames) thumbnails are not yet supported.
  * DASH streams are not yet supported.
* The component `roUrlTransfer` is implemented with basic functionality but with the following limitations:
  * To make a **web app** access urls from domains other than the one it is hosted, the Cross-Origin Resource Sharing (CORS) browser policy requires the server called to respond with the header `Access-Control-Allow-Origin`, [read more](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
    * A simple way to overcome this limitation is to use a CORS proxy like the [cors-anywhere](https://github.com/Rob--W/cors-anywhere), see [customization documentation](./customization.md) to learn how to configure `brs-engine` to use it.
    * If you are using a Chromium based browser (Chrome, Edge, Brave, etc) you can install this [extension](https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf) to bypass CORS.
  * The _async_ methods are actually synchronous and evaluated when `WaitMessage` or `GetMessage` are called.
  * Custom/Self-Signed SSL certificates are not supported, the engine will use default browser client certificate database.
  * As custom certificates are not supported these methods are just mocked and do nothing: `EnablePeerVerification`, `EnableHostVerification`, `SetCertificatesDepth`.
  * Cookies are only partially supported, if `EnableCookies` is called and `EnableFreshConnection` is set to `false`, then Cookies from previous calls will be preserved.
  * The other Cookies related methods are just mocked and do nothing: `GetCookies`, `AddCookies`, `ClearCookies`.
  * The following methods are also only mocked but do nothing: `EnableResume`, `SetHttpVersion` and `SetMinimumTransferRate`.
* The component `roAppMemoryMonitor` will only return measured data in Node.JS and Chromium browsers. For browsers the memory heap info only accounts for the main thread, as WebWorkers do not have support for `performance.memory` API.
* The `roInput` deep link events are supported, but the events related to Voice Commands are not.
* The `roFileSystem` is fully functional, but the message port events are not yet implemented.
* The global functions `Eval()`, `GetLastRunCompileError()` and `GetLastRunRuntimeError()` are not available.
* The string `mod` cannot be used as variable or function parameter name, because it conflicts with remainder operator `Mod` (Roku devices allows that).
* Screensaver functionality is not yet implemented.
* SDK 1.0 deprecated components are not supported, but will be implemented in the future as a legacy apps preservation initiative.

## Mocked Components and Libraries

* RAF (Roku Ads Framework) library with that exposes `Roku_Ads` is mocked with the most common methods available returning static values.
* RED (Roku Event Dispatcher) and Google IMA3 libraries are also mocked.
* Channel Store components (`ChannelStore`, `roChannelStore` and `roChannelStoreEvent`) are mocked with support for the `fakeServer()` feature.
* The `roStreamSocket` and `roDataGramSocket` components are mocked, and were only implemented to prevent crash on apps that use those.
* Several components have their methods and events mocked, they return constant values to prevent crash. Those are mostly related to device behaviors that are not possible to replicate in a browser environment or simply not applicable to the engine.

## Out of Scope

* Roku OS User Interface.
* Roku Channel Store features.
* Video playback with Ads.
