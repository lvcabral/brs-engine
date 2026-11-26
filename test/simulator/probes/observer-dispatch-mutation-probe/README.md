# observer-dispatch-mutation-probe

Which observers run for a field change when an observer callback registers or removes observers of
that same field while the change is being dispatched?

The scene runs seven cases from a Timer fire, 5 s after launch:

| Case | What the first observer does during the dispatch |
| --- | --- |
| c1 | `unobserveFieldScoped` + `observeFieldScoped` of its own field with itself |
| c2 | the same with `unobserveField` + `observeField` |
| c3 | `observeFieldScoped` a second callback (B) on the same field |
| c4 | the same with `observeField` |
| c5 | `unobserveFieldScoped` while a second scoped callback (B) is still to run |
| c6 | the same with `unobserveField` |
| c7 | re-observes itself (scoped), then writes the same field |

Each callback stops re-registering after 5 calls, so an engine that loops prints `calls=5` instead of
hanging.

## Device result (Roku Express 4K+, OS 16.1, `device-trace.txt`)

- Only the observers registered when the change happened run. A callback added during the dispatch
  runs from the next change on (c3, c4).
- A callback removed during the dispatch is skipped (c5, c6).
- A callback that unobserves and re-observes its own field runs once per change (c1, c2), and a write of
  the field from inside it doesn't dispatch again (c7).

`engine-trace.txt` matches the device trace (apart from the device line). Before the fix, the engine
re-ran c1 and c7 until the guard stopped them and ran c4's B for the first change. In a production app,
an item component doing c1 from its `itemContent` observer looped forever and ran out of memory.

## Run

```sh
./pack.sh   # builds observer-dispatch-mutation-probe.zip (don't commit it)
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@observer-dispatch-mutation-probe.zip http://<roku-ip>/plugin_install
nc <roku-ip> 8085             # wait for PROBE|done
brs-cli --root .              # engine run
```

The regression test is "Dispatches only the observers registered when the field changed" in
`test/cli/cli-scenegraph.test.js` (`observer-dispatch-mutation-app`).
