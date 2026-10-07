# Running Rooibos Unit Tests with the CLI

[Rooibos](https://github.com/rokucommunity/rooibos) is the most popular unit-test framework for Roku apps. Its tests are compiled into your channel by [BrighterScript](https://github.com/rokucommunity/brighterscript) and normally run on a real device, with results read from the telnet debug console.

Because `brs-cli` runs a complete app `.zip` headlessly in Node.js and prints everything to `stdout`, you can run the same test package **without a device**, both on your machine and on CI runners such as GitHub Actions.

A working reference project is available at [rooibos-simulator-test](https://github.com/markwpearce/rooibos-simulator-test) (it also documents the known compatibility gaps between Rooibos and the engine, see [Known Limitations](#known-limitations)).

> The engine is a development/automation tool, not a Roku OS emulator. Tests that depend on real-hardware behavior (e.g. video playback, device-specific `roDeviceInfo` values) should still be validated on a device.

## How it works

1. BrighterScript (`bsc`) with the `rooibos-roku` plugin compiles your app plus the `*.spec.bs` files and injects the Rooibos framework and a test-runner entry point.
2. `bsc` creates a `.zip` package.
3. `brs-cli <package>.zip` runs the app. Rooibos executes every suite, prints the report to `stdout`, prints `[Rooibos Result]: PASS|FAIL`, and exits the app (`sendHomeOnFinish`), which makes the CLI finish.

## Requirements

* Node.js **v22+**
* A BrighterScript project (`brighterscript` >= 0.65 recommended; the sample uses `^0.72`)
* `rooibos-roku` and `brs-node` installed as dev dependencies

## Project setup

```console
$ npm install --save-dev brighterscript rooibos-roku brs-node
```

`brs-node` provides the `brs-cli` command (see [Run as CLI](run-as-cli.md)); as a local dev dependency it is available to `npm run` scripts and `npx`.

### `bsconfig.json`

Use a dedicated config for tests, so the test code and Rooibos never end up in your release package (the sample keeps `bsconfig.json` for tests and `bsconfig.build.json` for release):

```json
{
    "rootDir": "src",
    "files": ["manifest", "source/**/*.*", "components/**/*.*"],
    "autoImportComponentScript": true,
    "stagingDir": "build",
    "plugins": ["rooibos-roku"],
    "rooibos": {
        "isRecordingCodeCoverage": false,
        "tags": ["!integration", "!deprecated", "!fixme"],
        "catchCrashes": true,
        "colorizeOutput": false,
        "failFast": false,
        "sendHomeOnFinish": true,
        "keepAppOpen": false,
        "reporters": ["console"]
    }
}
```

Rooibos options that matter when running under the CLI (full list in the [Rooibos docs](https://github.com/rokucommunity/rooibos/blob/master/docs/index.md#configuring-rooibos-runtime-behavior)):

| Option | Recommended | Why |
| --- | --- | --- |
| `sendHomeOnFinish` | `true` (default) | Exits the app when the tests finish, so `brs-cli` returns. With `false` the process **never ends**. |
| `keepAppOpen` | `false` | Returns execution to `Main` after the tests instead of keeping the app alive. |
| `catchCrashes` | `true` | A crash is reported as a failed test instead of aborting the whole run. |
| `colorizeOutput` | `false` on CI | Avoids ANSI codes in logs (the `mocha` reporter only). |
| `reporters` | `["console"]`, optionally `"junit"` | See [JUnit reports](#junit-reports). |
| `failFast` | `false` | Set `true` to stop at the first failure. |
| `tags` | e.g. `["!integration"]` | Exclude suites that need a real device or network. |

### `package.json` scripts

```json
{
    "scripts": {
        "build:test-zip": "bsc --create-package --out-file ./out/rooibos-tests.zip",
        "test:brs": "brs-cli --colors 0 out/rooibos-tests.zip",
        "test": "npm run build:test-zip && npm run test:brs"
    }
}
```

> Run the **`.zip`**, not the staging folder. A zip is loaded as a complete app, exactly like on a device, so Rooibos's generated suite classes (global functions under `source/`) are always found.

## Running on a local developer machine

```console
$ npm test
```

Output (abridged):

```
 [START TEST REPORT]
 ...
 Total: 6
   Passed: 6
   Crashed: 0
   Failed: 0
   Ignored: 0
   Time: 15ms

 RESULT: Success

 [END TEST REPORT]

[Rooibos Result]: PASS
[Rooibos Shutdown]
------ Finished 'rooibos-tests.zip' execution [EXIT_USER_NAV] ------
```

Useful variations:

```console
# Save the whole output to a file (ANSI stripped) while iterating
$ brs-cli --log tests.log out/rooibos-tests.zip

# Developer mode: Micro Debugger on crash + `STOP` support, to inspect a failing test
$ brs-cli --debug out/rooibos-tests.zip

# Persist the registry between runs, or mount an ext1: volume with fixtures
$ brs-cli --registry --ext-vol ./fixtures out/rooibos-tests.zip
```

To re-run quickly, an `@only` annotation on a suite, group or test narrows the run (see the Rooibos docs). Use `@tags` plus the `tags` config to select subsets.

### Other runtimes

The same zip can be sideloaded into [brs-desktop](https://github.com/lvcabral/brs-desktop) (ECP + telnet) or a real device with no changes, which makes it easy to compare results across runtimes. See the sample repo README for the commands.

## Interpreting the results: exit code vs. output

**`brs-cli` exits with code `0` when the app finishes normally, even if tests failed.** Rooibos ends the run by simulating the Home key (`EXIT_USER_NAV`), and the CLI only returns a non-zero code when the app ends for any other reason (crash, `STOP`/`END` in production mode, etc.).

So a CI job must **inspect the output** for the final status line printed by Rooibos:

| Line | Meaning |
| --- | --- |
| `[Rooibos Result]: PASS` | All tests passed |
| `[Rooibos Result]: FAIL` | At least one test failed or crashed |
| *(neither line printed)* | The run did not complete (crash outside a test, hang, timeout) — treat as failure |

A robust shell wrapper (`scripts/run-tests.sh`):

```bash
#!/usr/bin/env bash
set -uo pipefail

LOG="${LOG:-out/rooibos.log}"
mkdir -p "$(dirname "$LOG")"

# CI env var already disables the update notice; --colors 0 keeps the log clean
npx brs-cli --colors 0 out/rooibos-tests.zip 2>&1 | tee "$LOG"
cli_status=${PIPESTATUS[0]}

if [ "$cli_status" -ne 0 ]; then
    echo "brs-cli exited with code $cli_status" >&2
    exit "$cli_status"
fi

if grep -q '^\[Rooibos Result\]: PASS' "$LOG"; then
    exit 0
fi

echo "Rooibos tests failed or did not finish (no PASS marker found)" >&2
exit 1
```

Make it executable and point the `test:brs` script at it: `"test:brs": "bash scripts/run-tests.sh"`.

### JUnit reports

Add `"junit"` to the Rooibos `reporters` to also get a JUnit XML report:

```json
"reporters": ["console", "junit"]
```

Rooibos has no file system access to your host, so the XML is **printed to the console** as a single line starting with `<?xml`. Extract it from the log if your CI needs a report file:

```bash
grep -m1 '^<?xml' out/rooibos.log > out/junit.xml
```

> The `file` attributes in the XML are absolute paths to the `.spec.bs` files on the machine that built the package.

## Running in CI/CD (GitHub Actions)

No emulator, device or display is needed — the CLI runs headless on any Linux runner. Create `.github/workflows/tests.yml`:

```yaml
name: Rooibos Tests

on:
    push:
        branches: [main]
    pull_request:

jobs:
    unit-tests:
        runs-on: ubuntu-latest
        timeout-minutes: 15
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: npm

            - name: Install dependencies
              run: npm ci

            - name: Build test package
              run: npm run build:test-zip

            - name: Run Rooibos tests
              run: bash scripts/run-tests.sh

            - name: Extract JUnit report
              if: always()
              run: grep -m1 '^<?xml' out/rooibos.log > out/junit.xml || true

            - name: Publish test report
              if: always()
              uses: dorny/test-reporter@v1
              with:
                  name: Rooibos
                  path: out/junit.xml
                  reporter: java-junit
                  fail-on-error: false

            - name: Upload logs
              if: always()
              uses: actions/upload-artifact@v4
              with:
                  name: rooibos-logs
                  path: |
                      out/rooibos.log
                      out/junit.xml
```

Notes:

* The **`timeout-minutes`** at the job level is your safety net: a suite that hangs (see below) never produces a result and would otherwise run until GitHub's 6-hour limit. For a per-step limit use `timeout-minutes` on the `Run Rooibos tests` step, or `timeout 300 npx brs-cli ...` on Linux.
* The `junit` reporter and the `dorny/test-reporter` step are optional; drop them (and the `reporters` entry) if the console log is enough. Any JUnit consumer works the same way.
* `CI=true` is set automatically by GitHub Actions, which disables the CLI's update-check notice. Elsewhere set `BRS_NO_UPDATE_CHECK=1`.
* Pin `brs-node` to a version in `package.json` (and commit the lockfile) so engine updates don't change results unexpectedly; bump it deliberately.
* The same steps work on GitLab CI, CircleCI, Jenkins, etc.: install Node 22, `npm ci`, build the zip, run the wrapper script, and publish `out/junit.xml`.

## Known Limitations

Rooibos is designed around a real device, and a few of its features rely on behavior the engine does not (yet) reproduce. The [sample repo](https://github.com/markwpearce/rooibos-simulator-test) tracks these in detail.

* **`@SGNode(...)` suites can hang.** Node-test suites run every test through Rooibos's Promises library, which needs the SceneGraph event loop to tick while the suite is executing synchronously. A hang prints `>>>>>> It: ...` without the matching `<<<< END It: ...` and never prints `[Rooibos Result]`. Always use a job timeout, and run `@SGNode` suites on a device/other runtime for now.
* **Suites that wait on real `Task` threads** (e.g. polling a Task's field with `assertAsyncField`) may time out under the CLI even when they pass elsewhere.
* **`brs-cli --root <dir>` needs a recent engine.** Older releases only loaded the entry file you named; prefer the `.zip` package, which works on every version.
* **Device-only behavior** (hardware, network conditions, real media) is not simulated. Tag those suites (e.g. `@tags("integration")`) and exclude them with the Rooibos `tags` option on CI.

See also [Run as CLI](run-as-cli.md), [Limitations](limitations.md) and the [SceneGraph rendezvous notes](scenegraph-rendezvous.md).
