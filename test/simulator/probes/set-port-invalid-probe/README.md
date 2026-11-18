# Set Port Invalid Probe

Checks what `SetMessagePort()` / `SetPort()` do when given something that is not a `roMessagePort`. Written for #1327:
the Jellyfin client calls `SetPort()` with an unassigned member, and the engine threw `port.registerCallback is not a
function`.

1. **Argument kinds** (`PROBE|arg|...`): for `roUrlTransfer` (`SetMessagePort` and `SetPort`), `roDeviceInfo`,
   `roTextureManager`, `roAudioPlayer`, `roChannelStore` and `roInput`, calls the setter once on a fresh object with
   `invalid`, then on an object with a port attached with each of `invalid`, an unset `m` member, a boxed `roInvalid`,
   an integer, a string, an AA, an array and a `roTimespan`. Each call is in `try`/`catch`. The line has the result
   and `GetMessagePort()`'s type before and after.
2. **Events** (`PROBE|event|...`): a `roUrlTransfer` given a port and then `invalid`: what `AsyncGetToString()`
   returns and whether the old port gets the `roUrlEvent`. Then `invalid` on a fresh transfer, and `invalid`
   followed by a new port.
3. **SceneGraph** (`PROBE|sg|...`): a scene with a 0.1 s repeating `Timer` that counts `ticks`. Main waits on a port
   for 1.5 s and reports whether `ticks` advanced, after attaching the port, after
   `screen.SetMessagePort(invalid)`, and after switching the screen to a second port, waiting first on the old port
   and then on the new one.

## Run

```bash
ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh   # device: packs, sideloads, launches, captures the console
ENGINE=1 ./drive.sh                      # engine, after npm run build:cli
```

Both write `out/trace.txt` (the `PROBE` lines, without the `PROBE|try|` markers) and `out/run.txt` (the whole
console of the run). A launch parameter `start=<n>` skips the first `n` argument cases (the index is printed in each
`PROBE|try|<n>|` line), to resume after a case that kills the app. None did.

## Results (Roku Express 4K+, OS 16.0.4, 2026-11-18)

`device-trace.txt` and `engine-trace.txt` are identical.

- Every component accepts **every** non-port value without an error and without a console message, and drops the
  port it had: `GetMessagePort()` returns `invalid` afterwards. This holds for `invalid`, an unset member, `roInvalid`,
  integers, strings, AAs, arrays and other components, through both `SetMessagePort()` and `SetPort()`.
- After `SetPort(invalid)` the old port gets no event. `AsyncGetToString()` still returns `true` with no port
  attached. A port set afterwards gets the event.
- The scene keeps running after `screen.SetMessagePort(invalid)` and after the screen is switched to another port,
  whichever port Main waits on. The render thread does not depend on the screen's port.
- `screen.Close()` ends the app at once (`EXIT_USER_NAV`), so the probe prints `PROBE|done` before closing.
