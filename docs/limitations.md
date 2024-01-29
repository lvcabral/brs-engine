# BrightScript Engine Current Limitations

There are several features from the **BrightScript** language and components that are still not supported, or just partially supported, some are planned to be implemented, others will stay as mock objects (for compatibility), and some are considered out of scope of this project. Below is the current list of those limitations:

## In Scope (to be developed/fixed in future releases)

* RSG (Roku SceneGraph) SDK components are not yet supported.
* Statements `Goto` and `Throw` are not supported.
* Statements `Try..Catch` are partially supported, only the `Try` section is executed, `Catch` part is ignored and the exception is still raised.
* It's not possible to compare events like `roUniversalControlEvent` to an integer (implicit `GetInt()`).
* Multi-dimensional arrays cannot be accessed as `array[x, y]` use the notation `array[x][y]` instead.
* Audio playback via `roAudioResources` and `roAudioPlayer` is implemented, but with some limitations:
  * Audio format `wma` is not supported (old versions of Roku firmware supported it).
  * Only one instance of `roAudioPlayer` is supported, if more are created those will share the content playlist.
  * If the `roAudioPlayer` instance is destroyed the audio keeps playing, make sure to call `.stop()` before discarding the object.
  * No `Timed Metadata` support.
* Video playback via `roVideoPlayer` is implemented, but with some limitations:
  * If the `roVideoPlayer` instance is destroyed the video keeps playing, make sure to call `.stop()` before discarding the object.
  * The following methods are still not supported: `setCGMS`, `setMaxVideoDecodeResolution`, `getAudioTracks`, `changeAudioTrack`, `setTimedMetadataForKeys`, `getCaptionRenderer`, `setMacrovisionLevel`
  * Check what codecs can be used on each browser, using `roDeviceInfo.canDecodeVideo()`, to make sure your video can be played.
* The component `roUrlTransfer` is implemented with basic functionality but has some limitations:
  * To make the **web app** access urls from domains other than the one it is hosted, add the domains to the `Content-Security-Policy` tag in `app/index.html`.
  * The configuration above requires the web server called to respond with the proper header `Access-Control-Allow-Origin`, [read more](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
  * The _async_ methods are actually synchronous and evaluated when `WaitMessage` or `GetMessage` are called.
  * If using _async_ methods make sure to use a `roMessagePort` instance per `roUrlTransfer`, do not share.
  * Custom/Self-Signed SSL certificates are not supported, the engine will use default browser client certificate database.
  * As custom certificates are not supported these methods are just mocked and do nothing: `EnablePeerVerification`, `EnableHostVerification`, `SetCertificatesDepth`.
  * Cookies are only partially supported, if `EnableCookies` is called and `EnableFreshConnection` is set to `false`, then Cookies from previous calls will be preserved.
  * The other Cookies related methods are just mocked and do nothing: `GetCookies`, `AddCookies`, `ClearCookies`.
  * The following methods are also only mocked but do nothing: `EnableResume`, `SetHttpVersion` and `SetMinimumTransferRate`.
  * The method `GetTargetIpAddress` from `roUrlEvent` always returns an empty string.
* Reserved words like `Mod` cannot be used as function parameters (Roku does allow that).
* SDK 1.0 deprecated components are not implemented, but could be done in the future for legacy apps support.

## In Scope (mocked)

* RAF (Roku Ads Framework) object `Roku_Ads` is mocked with the most common methods available.
* Channel Store components (`roChannelStore` and `roChannelStoreEvent`) are mocked (a fake server feature will be implemented in the future).
* The component `roAppManager` is mocked with the exception of method `GetUptime` that returns a `roTimeSpan` as Roku does.

## Out of Scope

* Roku OS User Interface.
* Roku Channel Store features.
