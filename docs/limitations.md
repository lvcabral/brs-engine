# BrightScript Engine Current Limitations

There are several features from the **BrightScript** language and components that are still not supported, or just partially supported, some are planned to be implemented, others will stay as mock objects (for compatibility), and some are considered out of scope of this project. Below is the current list of those limitations:

## In Scope (to be developed/fixed in future releases)

* RSG (Roku SceneGraph) SDK components are not currently supported.
* The following components are also not implemented yet:
  * Text to Speech components: `roAudioGuide`, `roMicrophone` and `roTextToSpeech`
  * Signing Algorithm components: `roDSA` and `roRSA`
* Audio playback via `roAudioResources` and `roAudioPlayer` is implemented, but with some limitations:
  * Only one instance of `roAudioPlayer` is supported, if more are created those will share the content playlist.
  * If the `roAudioPlayer` instance is destroyed the audio keeps playing, make sure to call `.stop()` before discarding the object.
  * No `Timed Metadata` support.
* The component `roAudioMetadata` only supports MP3 (for now).
* The component `roImageMetadata` only supports JPEG images (for now).
* Video playback via `roVideoPlayer` is implemented, but with some limitations:
  * If the `roVideoPlayer` instance is destroyed the video keeps playing, make sure to call `.stop()` before discarding the object.
  * The following methods are not supported, implemented as mock: `setCGMS`, `setMaxVideoDecodeResolution`, `setTimedMetadataForKeys`, `getCaptionRenderer`
  * Check what formats (container and codec) can be used on each browser, using `roDeviceInfo.canDecodeVideo()`, to make sure your video can be played.
  * DASH streams are not yet supported.
* The component `roUrlTransfer` is implemented with basic functionality but with the following limitations:
  * To make a **web app** access urls from domains other than the one it is hosted, requires the server called to respond with the header `Access-Control-Allow-Origin`, [read more](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
  * The _async_ methods are actually synchronous and evaluated when `WaitMessage` or `GetMessage` are called.
  * Custom/Self-Signed SSL certificates are not supported, the engine will use default browser client certificate database.
  * As custom certificates are not supported these methods are just mocked and do nothing: `EnablePeerVerification`, `EnableHostVerification`, `SetCertificatesDepth`.
  * Cookies are only partially supported, if `EnableCookies` is called and `EnableFreshConnection` is set to `false`, then Cookies from previous calls will be preserved.
  * The other Cookies related methods are just mocked and do nothing: `GetCookies`, `AddCookies`, `ClearCookies`.
  * The following methods are also only mocked but do nothing: `EnableResume`, `SetHttpVersion` and `SetMinimumTransferRate`.
* The component `roAppMemoryMonitor` will only return measured data in Node.JS and Chromium browsers. For browsers the memory heap info only accounts for the main thread, as WebWorkers do not have support for `performance.memory` API.
* The `roInput` deep link events are supported, but the events related to Voice Commands are not.
* The `roFileSystem` is fully functional, but the message port events are not yet implemented.
* The `roStreamSocket` and `roDataGramSocket` components are mocked, and were only implemented to prevent crash on apps that use those.
* The global functions `Eval()`, `GetLastRunCompileError()` and `GetLastRunRuntimeError()` are not available.
* The string `mod` cannot be used as variable or function parameter name, because it conflicts with remainder operator `Mod` (Roku devices allows that).
* SDK 1.0 deprecated components are not supported, but will be implemented in the future as a legacy apps preservation initiative.

## Mocked Components and Libraries

* RAF (Roku Ads Framework) object `Roku_Ads` is mocked with the most common methods available returning static values.
* Channel Store components (`roChannelStore` and `roChannelStoreEvent`) are mocked with support for the `fakeServer()` feature.
* Several components have their methods and events mocked, they return constant values to prevent crash. Those are mostly related to device behaviors that are not possible to replicate in a browser environment or simply not applicable to the engine.

## Out of Scope

* Roku OS User Interface.
* Roku Channel Store features.
* Video playback with Ads.
