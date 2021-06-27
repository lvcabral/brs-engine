# Emulator Limitations

This emulator is still a **prototype**, this way, there are several features from the **BrightScript** language and components that are not supported, or partially supported, some are planned to be implemented, others will stay as mock objects (for compatibility), and some are considered out of scope of this project. Below is the current list of those limitations:

## In Scope (to be developed/fixed)

*   Usage of **@** to access attributes from `roXMLElements` is not supported, use method `GetAttributes`.
*   Statements `Goto`, `Stop` and `End` are not supported.
*   It's not possible to compare events like `roUniversalControlEvent` to an integer (implicit `GetInt()`).
*   Do not use the same `roMessagePort` instance with different objects (`roScreen`, `roAudioPlayer` etc.) create one per object type.
*   The component `roInput` (for ECP support) is not implemented yet.
*   Reserved words like `Mod` cannot be used as function parameters (Roku does allow that).
*   Multi-dimensional arrays cannot be accessed as `array[x,y]` use the notation `array[x][y]` instead.
*   Send `Invalid` on a function parameter when it explicitly defines the type, generates an error. If `Invalid` is possible remove type declaration.
*   In a `for...next` loop the usage of the notation `next <variable>` is not supported.
*   Audio playback via `roAudioResources` and `roAudioPlayer` is implemented, but with some limitations:
    - Audio format `wma` is not supported.
    - Only one instance of `roAudioPlayer` is supported, if more are created those will share the content playlist.
    - If the `roAudioPlayer` instance is destroyed the audio keeps playing, make sure to call `.stop()` before discarding the object.
    - No `Timed Metadata` support.
*   The component `roUrlTransfer` is implemented with basic functionality but has some limitations:
    - To make the **web app** access urls from domains other than the one it is hosted, add the domains to the `Content-Security-Policy` tag in `app/index.html`.
    - The configuration above requires the web server called to respond with the proper header `Access-Control-Allow-Origin`, [read more](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
    - The _async_ methods are actually synchronous and evaluated when `WaitMessage` or `GetMessage` are called.
    - If using _async_ methods make sure to use a `roMessagePort` instance per `roUrlTransfer`, do not share.
    - Custom/Self-Signed SSL certificates are not supported, the emulator will use default browser client certificate.
    - As custom certificates are not supported these methods are not available: `EnablePeerVerification`, `EnableHostVerification`, `SetCertificatesDepth`.
    - Cookies are only partially supported, if `EnableCookies` is called and `EnableFreshConnection` is set to `false`, then Cookies from previous calls will be preserved.
    - The other Cookies related methods are not implemented: `GetCookies`, `AddCookies`, `ClearCookies`.
    - The following methods are also not supported: `EnableResume`, `SetHttpVersion` and `SetMinimumTransferRate`.
    - The method `GetTargetIpAddress` from `roUrlEvent` always returns an empty string.

## In Scope (mocked)

*   RAF (Roku Ads Framework) object `Roku_Ads` is mocked with the most common methods available.
*   Channel Store components (`roChannelStore` and `roChannelStoreEvent`) are mocked.
*   The component `roAppManager` is mocked with the exception of method `GetUptime` that returns a `roTimeSpan` as Roku does.

## Out of Scope

*   RSG (Roku SceneGraph) SDK support.
*   Video playback or streaming.
*   SDK 1.0 deprecated components.
