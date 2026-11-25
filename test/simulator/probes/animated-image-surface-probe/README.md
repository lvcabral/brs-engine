# Animated Image Surface Probe

Checks which methods and interfaces `roAnimatedImage` has on a real Roku, and what a `SetContent` that fails leaves
behind, against brs-engine. Plain Draw2D, no SceneGraph. Pairs with `../animated-image-tint-probe`.

`images/anim.webp` is the same four-frame 400x400 WebP as the tint probe (white, grey, orange, cyan, 100 ms each).

| Case | What it checks |
| --- | --- |
| `iface` | `GetInterface()` for ifAnimatedImage, ifDraw2D, ifSetMessagePort, ifGetMessagePort, ifToStr. |
| `method` | Calls each ifDraw2D method, `ToStr`, the message port methods and `GetWidth`/`GetHeight` in a `try`. |
| `setcontent-return` | Assigning `SetContent()`'s result. |
| `show\|<case>` | `GetState()`, `IsValid()`, size, two untinted draws and a red one (`<DrawObject result>:<pixel>`). |
| `missing`, `nouri`, `notimage`, `unknownmime`, `badmime` | `SetContent` with a missing file, no `uri`, a file that is not an image, `mimeType: "image/gif"`, and `mimeType: "video/lottie+json"` for a WebP. |
| `fresh-missing`, `blank` | A new image whose first `SetContent` fails, and one that never had `SetContent`; `SetTargetState("play")` on each. |

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh     # writes device-trace.txt
./run-engine.sh                                 # npm-linked brs-cli, after npm run build:cli; writes engine-trace.txt
node ../decode-px.mjs device-trace.txt > device-trace-decoded.txt
node ../decode-px.mjs engine-trace.txt > engine-trace-decoded.txt
diff device-trace-decoded.txt engine-trace-decoded.txt
```

`engine-trace-before.txt` is the engine before it was aligned with these results.

## Results (Roku Express 4K+, OS 16.0.4, 2026-11-24)

- `roAnimatedImage` has only ifAnimatedImage, which also holds `GetWidth`, `GetHeight`, `SetMessagePort` and
  `GetMessagePort`. Every ifDraw2D method, `ToStr`, `SetPort` and `GetPort` is "Member function not found".
- `SetContent` returns nothing: assigning its result is a Type Mismatch.
- `GetInfo()` of the event always has `error`, `""` on `ready`.
- Before any content, and after a `SetContent` that fails, the image is `GetState()` "invalid" (not in the documented
  list), `IsValid()` false, 0x0; `DrawObject` of it returns false and draws nothing, and `SetTargetState` returns
  false. The earlier content is gone.
- Failures send `failed` with `Unable to open animated image: <path>` (missing file),
  `Unable to detect decoder type from file header: <path>` (not an image), or
  `Unsupported decoder type '<mimeType>' for file: <path>`. `<path>` is the device's internal
  `/tmp/plugin/<id>/pkg:/...`. A `SetContent` without a `uri` sends no event.
- A `mimeType` the file contradicts sends `ready`: `IsValid()` true, "init" at 0x0, then "error" ~300 ms later.
  Draws return true and draw nothing; `SetTargetState` returns true.

Remaining differences from the engine:

- `setcontent-return`: the engine assigns `invalid` from any function that returns nothing, built-in or not.
- Error messages name the `uri` as given, without the device's internal path.
- `badmime`: the engine decodes synchronously, so it reports "error" right after `ready`.
- `reloaded`/`playing`/`restored`: in automatic mode the device draws the frame only on the first draw before it
  plays, and shows frames late while playing (see the tint probe's README).
