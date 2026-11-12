# Focus Chain Probe 2

This probe tests nested `setFocus` calls raised from `focusedChild` observers:
- **N1:** forward to a sibling;
- **N2:** forward one level deeper;
- **N3:** a backwards steal from a node losing focus;
- **N4:** a plain move afterwards.

The scenario list is in `components/ProbeScene2.xml`. It auto-runs, then waits for Back.

`device-trace-os16.0.txt` is a Roku Express 4K+ on OS 16.0. The engine matches it line for line.
`.claude/docs/scenegraph-invariants.md` ("A focus transaction…") describes the model, and
`test/simulator/probes/focus-flag-probe` measures it further.

Note the stale links, for example after N1:
- `menuA` keeps its `focusedChild` self-link, so it keeps reporting `hasFocus()` next to `menuB`.
- In N2, `overhang` keeps `→ menuB` because the unset follows the chain owner `menuA`, not the live focus.

`engine-trace.txt` is the pre-fix engine baseline.
