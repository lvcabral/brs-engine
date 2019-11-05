# Emulator Limitations

This emulator is still a **prototype**, this way, there are several features from the **BrightScript** language and components that are not supported, or partially supported, some are planned to be implemented, others will stay as mock objects (for compatibility), and some are considered out of scope of this project. Below is the current list of those limitations:

## In Scope (to be developed/fixed)

*   Usage of **@** to access attributes from `roXMLElements` is not supported.
*   The `roXMLElements` component is read-only once you parsed a XML string. The `add*` and `set*` methods are not implemented yet.
*   Unlike in **Roku** the emulator file system is case sensitive, so for now make sure your code use the correct case when dealing with files.
*   `Goto`, `Stop` and `End` statements are not supported.
*   Usage of **colon** to do `for` or `while` loops in one line is not working. e.g. `while r.IsMatch(s): s = r.Replace(s, "\1,\2"): end while`.
*   Trailing **colon** on a line generates an exception.
*   It's not possible to compare `roUniversalControlEvent` to an integer (implicit `GetInt()`).
*   Do not use the same `roMessagePort` instance with different objects (`roScreen`, `roAudioPlayer` etc.) create one per object type.
*   The global AA (root `m` object) is not accessible from a global function called inside an `AA` method.
*   The component `roAppManager` is not implemented yet.
*   The component `roUrlTransfer` is not implemented yet.
*   The component `roInput` (for ECP support) is not implemented yet.
*   Reserved words like `Mod` cannot be used as function parameters (Roku does allow that).
*   The `Dim` statement cannot create multi-dimensional arrays.
*   Multi-dimensional arrays cannot be accessed as `array[x,y]` use the notation `array[x][y]` instead.
*   Return `Invalid` from a function explicitly declared as `Object` doesn't work, use `Dynamic` or remove type declaration.
*   Send `Invalid` on a function parameter when it explicitly defines the type, generates an error. If `Invalid` is possible remove type declaration.
*   Positive literal number cannot be represented with plus sign. For example `a = [-1, +1]`
*   An `if` statement with `not` before a logic comparison expression shows an error. For example `if not foo = 1`, to avoid use `if not (foo = 1)` instead.
*   Usage of `next <variable>` is not supported.
*   Audio playback via `roAudioResources` and `roAudioPlayer` is implemented, but with some limitations:
    - Audio format `wma` is not supported.
    - Only one instance of `roAudioPlayer` is supported, if more are created those will share the content playlist.
    - if the `roAudioPlayer` instance is destroyed the audio keeps playing, make sure to call `.stop()` before discarding the object.
    - No `Timed Metadata` support.

## In Scope (mocked)

*   RAF (Roku Ads Framework) object `Roku_Ads()` is mocked with the most common methods available.
*   Channel Store components (`roChannelStore` and `roChannelStoreEvent`) are mocked.

## Out of Scope

*   RSG (Roku SceneGraph) SDK support.
*   Video playback or streaming.
*   SDK 1.0 deprecated components.
