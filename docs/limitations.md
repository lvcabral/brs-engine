# BrightScript Engine Current Limitations

The **BrightScript Engine** implements the BrightScript language specification up to Roku OS 15.3. However, some features and components remain unsupported or only partially implemented. These limitations fall into three categories: features planned for future development, components that will remain as mock objects for compatibility purposes, and functionality considered outside the project's scope. The following sections detail each category and its current status.

## In Scope (to be developed/fixed in future releases)

* **Roku SceneGraph** framework support is implemented as an [extension](./extensions.md) published separately as the [brs-scenegraph](https://www.npmjs.com/package/brs-scenegraph) NPM package. All SceneGraph nodes documented by Roku are available, however because the engine is a simulator and not a hardware emulator, expect **rendering differences** from a real Roku device, please open a [GitHub issue](https://github.com/lvcabral/brs-engine/issues) if you find any problem or missing feature.  These are the current known limitations:
  * The `Task` node is implemented but its behavior is limited:
    * For now only 30 concurrent task threads are supported per application
    * Only one `port` instance can be used on Task `init()` to observe fields
    * Rendezvous is implemented, but may not work properly for all edge cases.
    * `Task` nodes never spawn under the synchronous `executeFile()` execution model of the Node.js library — use `executeApp()` for Task support, see the [Node.js library guide](./using-node-library.md#running-apps-on-worker-threads-with-scenegraph-task-support).
  * The focus change native animation on grids, lists and panel nodes is not implemented yet.
  * Some **abstract** base nodes are not implemented on their own and fall back to a plain `Group` (like the Standard Dialog framework's `StdDlgAreaBase`, `StdDlgItemGroup` and `StdDlgGraphicItem`).
  * **Component Libraries** are supported, both declared in XML (`<ComponentLibrary id="..." uri="..."/>`) and created at runtime via `CreateObject("roSGNode", "ComponentLibrary")` with the `uri` assigned in code. The component namespace is the library manifest's `sg_component_libs_provided` value (falling back to the node `id` when not declared), so its components are referenced as `LibraryName:ComponentName`. The `uri` may point to a local volume (`pkg:/`, `tmp:/`, `ext1:/`) or a remote `http(s)://` package (the configured CORS proxy is honored). Current limitations:
    * Libraries are fetched and compiled **synchronously** (the BrightScript event loop never yields, so an asynchronous load could not complete mid-execution). The node reports `loadStatus = "loading"` immediately and the `"ready"`/`"failed"` transition is emitted on the next render frame, so `observeField("loadStatus", ...)` callbacks are notified as on a real device — provided the app is pumping its screen message loop (`wait(...)`).
    * Inside a library, `pkg:/` still resolves to the host app's package (not the library's own); reference a library's bundled scripts with relative `uri` paths in its component XML.
    * Library `source/` global functions and intra-library component inheritance (a library component extending another library component) are not supported yet.
    * Encrypted/signed libraries are not supported (plain `.zip` only).
* The complete **Roku OS** file system is available and shared among threads.
  * Supports all volumes: `pkg:`, `common:`, `tmp:`, `cachefs:` and `ext1:`. 
  * By default, the external volume (`ext1:`) and the writeable volumes (`tmp:` `cachefs:`) are limited to 32 MB each.
  * The writable volumes `tmp:` and `cachefs:` limits are configurable, see [customization documentation](./customization.md); 
  * The `ext1:` limit is fixed.
* Audio playback is implemented via `roAudioResources`, `roAudioPlayer` components and `SoundEffect`, `Audio` nodes, but with some limitations:
  * Only one instance of `roAudioPlayer` component or `Audio` node should be used, if more are created those will share the content playlist.
  * If the `roAudioPlayer` component or `Audio` node instance is destroyed the audio keeps playing, make sure to stop the playback before discarding the object.
  * No `Timed Metadata` support.
* Video playback is implemented via `roVideoPlayer` component and `Video` node, but with some limitations:
  * If the instance of `roVideoPlayer` or `Video` is destroyed the video keeps playing, make sure to `stop` before discarding the object.
  * The following `roVideoPlayer` methods are not supported, implemented as mock: `setCGMS`, `setMaxVideoDecodeResolution`, `setTimedMetadataForKeys`, `getCaptionRenderer`
  * Check what formats (container and codec) can be used on each browser, using `roDeviceInfo.canDecodeVideo()`, to make sure your video can be played.
  * Under **Node.js/CLI** there is no audio or video output: `autoPlayEnabled` is forced off and media events are only simulated, so apps behave as if playback never starts.
  * Subtitles are only supported for HLS and DASH streams and only in `Video` node, the `roVideoPlayer` does not support subtitles until `roCaptionRenderer` is implemented.
  * BIF (Base Index Frames) thumbnails are not yet supported.
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
* The `roStreamSocket` (TCP) component performs real network I/O, on the Node.js/CLI package only.
  * Supports listening, connecting, accepting connections, and sending/receiving stream data, including `roSocketEvent` delivery via `NotifyReadable()`/`Wait()`, backed by a small helper process per listener/connection.
  * `Connect()` uses a blocking request with an 8-second timeout rather than modeling Roku's async-per-message-port connect semantics.
  * `SetLinger`/`SetMaxSeg` (`ifSocketConnectionOption`) are accepted and stored but not enforced — Node's `net` module exposes no public `SO_LINGER`/`TCP_MAXSEG` hook.
  * On the browser package `roStreamSocket` remains mocked, as browsers cannot open raw sockets.
* The `roDataGramSocket` (UDP) component performs real network I/O, on the Node.js/CLI package only.
  * Supports binding, broadcast, send and receive, including `roSocketEvent` delivery via `NotifyReadable()`/`Wait()`, backed by a small per-socket helper process.
  * Real multicast group membership (`JoinGroup`/`DropGroup`) is not implemented on either platform.
  * On the browser package `roDataGramSocket` remains mocked, as browsers cannot open raw sockets.
* The new **`roAnimatedImage`** (BrightScript component) and **`AnimatedImage`** (SceneGraph node), added by Roku OS 15.3, now follow Roku's published specification (field names, defaults, and the `control`/`state` vocabulary).
  * Animated WebP frames are decoded and composited (including `dispose`/`blend` semantics) directly by the engine.
  * Lottie/Bodymovin JSON is rendered via the third-party [`lottie.js`](https://lottie.js.org) library (pre-1.0, "covers a growing subset of the format" per its own documentation) — not every Lottie feature (precomps, mattes, masks, expressions) is confirmed supported.
  * `video/mp4` is a documented `mimeType`, but MP4-encoded animated content is not yet decoded — content that sniffs or declares as MP4 fails to load.
  * `loadingBitmapUri`/`failedBitmapUri` (placeholder image swap while loading/on failure) are accepted fields but not yet functional.
* The `roInput` deep link events are supported, but the events related to Voice Commands are not available yet.
* The component `roAudioMetadata` only supports MP3 (for now).
* The component `roImageMetadata` only supports JPEG images (for now).
* The component `roAppMemoryMonitor` will only return measured data in Node.JS and Chromium browsers. For browsers the memory heap info only accounts for the main thread, as WebWorkers do not have support for `performance.memory` API. The `roAppMemoryMonitorEvent` is not yet implemented.
* The global functions `Eval()`, `GetLastRunCompileError()` and `GetLastRunRuntimeError()` are not available.
* The string `mod` cannot be used as variable or function parameter name, because it conflicts with remainder operator `Mod` (Roku devices allows that).
* Screensaver functionality is not yet implemented.
* SDK 1.0 deprecated components are not supported, but may be implemented in the future as a new extension, allowing legacy apps to be executed.

## Mocked Components and Libraries

* RAF (Roku Ads Framework) library that exposes `Roku_Ads` object is mocked with the most common methods available returning static values.
* RED (Roku Event Dispatcher) and Google IMA3 libraries are also mocked.
* Channel Store components (`ChannelStore`, `roChannelStore` and `roChannelStoreEvent`) are mocked with support for the `fakeServer()` feature.
* The Text to Speech components (`roAudioGuide`, `roTextToSpeech` and `roMicrophone`) and the Signing Algorithm components (`roDSA` and `roRSA`) are mocked: they expose their documented methods returning static values, but perform no real speech, recording or cryptographic signing.
* Several components have their methods and events mocked, they return constant values to prevent crash. Those are mostly related to device behaviors that are not possible to replicate in a browser environment or simply not applicable to the engine.

## Out of Scope

* Roku OS User Interface.
* Roku Channel Store features.
* Video playback with Ads.
