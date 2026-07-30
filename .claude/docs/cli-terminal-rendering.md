# CLI terminal frame rendering (`src/cli/display.ts`) — flicker invariants

Read this **before** changing anything that draws to or prints on the terminal while an app runs
(`--ascii`/`--unicode`/`--image` modes, `--log`, `--snapshot`, the Micro Debugger's terminal handoff).

All screen rendering (`-a`/`-u`/`-i`) lives in `display.ts`; the trio of image-mode flicker fixes must
stay together:

1. **Frames are flattened onto opaque black** before encoding — a frame carrying alpha lets the terminal's
   theme color show through the inline image (the "orange flash").
2. **DEC 2026 synchronized-output opens *before* the render call** (the Kitty path inside terminal-image
   writes directly to stdout) and `doNotMoveCursor=1` is injected into the iTerm2 header; the cursor stays
   hidden for the whole run.
3. **Byte-identical frames are skipped** (`Buffer.equals` vs the last painted frame): the SceneGraph
   render loop posts frames even when the screen is static, and rewriting a large image makes graphics
   terminals visibly decode/swap it. Cache cleared on `disableFrameOutput` and when the debugger takes the
   terminal.

**Text never interleaves with frames.** While frames own a TTY, `writeTerminalText` defers text (flushed
after the run, or immediately to the `--log` file); the Micro Debugger suspends deferral (app paused, no
frames painting). Anything that prints mid-run must route through `writeTerminalText` — a raw
`process.stdout.write`/`console.log` reintroduces the flicker. TTY stdout is switched non-blocking during
the run (a slow terminal otherwise blocks the event loop inside write(2), starving raw-mode stdin — Ctrl+C
is just a keypress); frames drop to newest on backpressure + `drain`. No CLI-side FPS throttling —
`DeviceInfo.maxFps` is the engine-level gate.

Related: workers must never write to the terminal — see
[threading-and-rendezvous.md](threading-and-rendezvous.md).
