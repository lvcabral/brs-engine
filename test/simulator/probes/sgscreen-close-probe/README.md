# roSGScreen Close Probe

What a device does after `roSGScreen.close()`, and how an app can continue on an `roScreen` or on a second
`roSGScreen`. Written to review PR #1328 (stop rendering a closed `roSGScreen`). Its author described an app that
mixes `roScreen` and `roSGScreen`.

## Run

Device (sideload the zip made by `./pack.sh`, then let the driver run one scenario):

```
./pack.sh
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@sgscreen-close-probe.zip http://<ip>/plugin_install
MODE=<mode> ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
```

Engine (after `npm run build:cli`):

```
MODE=<mode> ENGINE=1 ./drive.sh
```

`MODE` is passed as the launch parameter `mode` (ECP `launch/dev?mode=` on the device, `--deep-link` on the CLI).
The driver answers `PROBE|<seq>|await|<Key>|` with an ECP keypress and `await|shot|name=<n>` with a dev-mode
screenshot (device only). It stops on `PROBE|...|done|`, on the device's `UI: Exiting` line, or after `DEADLINE`
seconds (default 300). Output goes to `./out-<mode>`.

## Shape

`ProbeScene` has a 0.1 s repeating Timer that counts `ticks`, an `Audio` node looping `pkg:/sounds/tone.mp3`, and
an `onKeyEvent` that stores the last pressed key in `lastKey`. `BeatTask` writes its `beat` field and
`m.global.beat` every 200 ms. Main observes the scene's `ticks`, the task's `beat`/`state`, the audio `state` and
`m.global.beat` on `obsPort`, a port created while the screen is live but never given to `setMessagePort`.
`SecondScene` is the same without audio.

| Mode              | Scenario                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solo`            | `close()` (twice) with no other screen, then a heartbeat until the app ends                                                                                                                                                         |
| `roscreen-after`  | `close()`, then create an `roScreen` right away                                                                                                                                                                                     |
| `sgscreen-after`  | `close()`, then create a second `roSGScreen` right away                                                                                                                                                                             |
| `roscreen-before` | create an `roScreen` while the Scene is shown, `close()` the `roSGScreen`, continue on the `roScreen`, release it, create a second `roSGScreen`, and only then read the first screen's nodes, each read marked because it may block |

## Device findings (Roku Express 4K+, OS 16.0.4)

1. **`close()` ends the app unless an `roScreen` already exists.** In `solo`, `roscreen-after` and
   `sgscreen-after`, the app exits with `EXIT_USER_NAV` within about a second of `close()`.
   `CreateObject("roScreen")` or `CreateObject("roSGScreen")` called right after `close()` never returns. In
   `solo` the second `close()` returns, but the 1 s drain of the screen port never finishes.
2. **Creating an `roScreen` suspends the SceneGraph screen.** The `roScreen` takes the whole display
   (`device-roscreen-before-roscreen-over-scene.jpg`). The Scene's Timer stops: the ticks queued on `obsPort`
   stop growing once the `roScreen` exists. In an earlier run, the main thread's next read of a Scene field
   (`scene.ticks`) blocked for 5 minutes with the `roSGScreen` still open, and nothing more was printed.
3. **With an `roScreen` up, `close()` leaves the app running on the `roScreen`.** The screen port gets **one**
   `isScreenClosed` event; the second `close()` adds nothing. No more observer events arrive from the Scene, the
   Task or `m.global`. Remote keys go to the `roScreen` port (`roUniversalControlEvent` 4/104), and the
   `roScreen` keeps drawing (`device-roscreen-before-after-close.jpg`).
4. **A second `roSGScreen` created after the `roScreen` is released renders and ticks on its own.** Its Scene
   advances while main reads only the older ports (`ticks2=20` after 2 s on `port`/`obsPort`), takes the keys
   (`lastKey=down`), and posts its observer events on its own port
   (`device-roscreen-before-second-screen.jpg`).
5. **Reading the first screen's nodes after close.** With the second screen up, `task.beat` and `m.global.beat`
   return their frozen value (19). `scene.ticks` on the closed Scene blocks until the driver gives up. In a run
   without the second screen, `task.beat` logged `Rendezvous aborted for BeatTask` (main) and
   `Rendezvous aborted for Node: BeatTask.xml(18)` (the task's `m.global` write), then the app exited.

## Engine vs device

PR #1328 as first submitted (`828dcabd`) only stopped the closed screen's pass. The engine now follows the
findings above (`engine-trace-<mode>.txt` are the post-fix runs):

| Behavior                                           | Device                      | Engine before                | Engine now                                            |
| -------------------------------------------------- | --------------------------- | ---------------------------- | ----------------------------------------------------- |
| `close()` with no `roScreen`                       | app exits                   | keeps running                | exits (`EXIT_USER_NAV`) at the next message-loop pass |
| `roScreen` created while the Scene is shown        | Scene suspended             | Scene keeps ticking under it | suspended                                             |
| `close()` twice                                    | one `isScreenClosed`        | two                          | one                                                   |
| Observer events after `close()`                    | none                        | only those already queued    | none                                                  |
| Keys after `close()` with an `roScreen`            | `roScreen` port             | match                        | match                                                 |
| Second `roSGScreen`, main reading only older ports | ticks (`ticks2=20`)         | frozen (`ticks2=0`)          | ticks (`ticks2=20`)                                   |
| The closed screen's Task once a second screen runs | frozen (rendezvous aborted) | n/a                          | resumes (known gap)                                   |
| Reading a closed Scene's field                     | blocks                      | returns                      | returns                                               |

In `roscreen-after` and `sgscreen-after`, the device never returns from the `CreateObject` that follows
`close()`. The engine still creates the object and ends the app at the next `wait`.

The device traces of `solo`, `roscreen-after` and `sgscreen-after` were captured with the Task function named
`run`. The device accepts that name, but the engine rejects it because it collides with the global `Run()`.
The probe now uses `beatLoop`; the rename does not change what those runs measure.

Committed captures: `device-trace-os16.0-<mode>.txt`, `engine-trace-<mode>.txt` (post-fix) and the three
`device-roscreen-before-*.jpg` screenshots.
