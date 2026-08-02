# Run as Command Line Interface

You have two options to install the CLI application:

1. **Global Installation**: This will make the `brs-cli` command available system-wide.

   ```console
   $ npm install -g brs-node
   ```

2. **Build NodeJS Package**: Clone the repo, build the NodeJS package and link it to your system:

    ```console
    $ git clone https://github.com/lvcabral/brs-engine.git
    $ cd brs-engine
    $ npm install
    $ npm run build:cli
    $ cd packages/node
    $ npm link
    ```

## Keeping the CLI Up to Date

When running on an interactive terminal, the CLI checks the npm registry (at most once a day, in background) for a newer release of `brs-node`, and shows a notice with the command to upgrade the installation it detected (global, local or `npx`):

```console
Update available: 2.3.0 -> 2.4.0
Run npm install -g brs-node@latest to update.
```

The check never delays the startup nor the exit: the notice is displayed from the previously cached result, while the registry request runs in background and is dropped if the app finishes first. To disable it, set either the `BRS_NO_UPDATE_CHECK` or the `NO_UPDATE_NOTIFIER` environment variable; it is also skipped when the output is redirected (not a terminal) or when `CI` is set.

## Usage

Once installed, you can execute the `brs-cli` command, which operates as a REPL, runs source files or creates encrypted app packages.
For a list of options run:

```console
$ brs-cli --help
Usage: brs-cli [options] [brsFiles...]

BrightScript Simulation Engine CLI

Options:
  -a, --ascii <columns>     Enable ASCII screen mode with # of columns.
  -u, --unicode             Render ASCII screen mode using Unicode block characters.
  -i, --image [percent]     Render the screen as images on the terminal with optional width % (default: 100).
  -s, --snapshot [filename] Enable Ctrl+S to save the current screen as a PNG image.
  -c, --colors <level>      Define the console color level (0 to disable). (default: 3)
  -d, --debug               Developer mode: micro debugger on crash + resource tracking.
  -l, --log [filename]      Redirect the text output to a log file (default: brs-cli.log).
  -g, --log-level <level>   Set console log verbosity: debug, warning or error. (default: "warning")
  -z, --log-rendezvous      Trace SceneGraph cross-thread rendezvous (like Roku's logrendezvous).
  -e, --ecp                 Enable the ECP server for control simulation.
  -n, --no-sg               Disable the SceneGraph extension.
  -p, --pack <password>     The password to generate the encrypted package. (default: "")
  -o, --out <directory>     The directory to save the encrypted package file. (default: "./")
  -r, --root <directory>    The root directory from which `pkg:` paths will be resolved.
  -x, --ext-vol <path>      Path to directory or zip file from which `ext1:` will be mounted.
  -k, --deep-link <params>  Parameters to be passed to the application. (format: key=value,...)
  -y, --registry            Persist the simulated device registry on disk.
  -v, --version             output the version number
  -h, --help                output usage information
```

### REPL

An interactive BrightScript REPL (Read-Execute-Print Loop) is available by running `brs-cli` with no arguments, e.g.:

```console
$ brs-cli

BrightScript Simulation Engine CLI [v2.3.0]

type `help` to see the list of valid REPL commands.

brs> ? "Dennis Ritchie said ""Hello, World!"""
Dennis Ritchie said "Hello, World!"
```

Quit by pressing `^D` (Control-D) or executing `exit`.

Any valid BrightScript expression is compiled and run live. In addition, the REPL accepts the following commands:

| Command | Description |
| --- | --- |
| `print` or `?` | Print a variable value or expression |
| `var` or `vars [scope]` | Display variables and their types/values (`scope` is `global`, `module` or `function`) |
| `loglevel [level]` | Show the current log level, or set it (`level` is `debug`, `warning` or `error`) |
| `vol` or `vols` | Display the file system mounted volumes |
| `mnt` or `mount <path>` | Mount the `ext1:` volume from a directory or zip file |
| `umt` or `umount` | Unmount the `ext1:` volume |
| `xt` or `ext` | Display the loaded extensions |
| `help` or `hint` | Show the REPL command list |
| `clear` or `cls` | Clear the terminal screen |
| `exit`, `quit` or `q` | Terminate the REPL session |

## Setting the Color Level

By default the CLI will display text in ANSI Truecolor mode (level 3 below), but you can change it for the session by running:

```console
$ brs-cli --colors 0
```

| Level | Description |
| :---: | :--- |
| `0` | All colors disabled |
| `1` | Basic color support (16 colors) |
| `2` | 256 color support |
| `3` | Truecolor support (16 million colors) |

## Setting the Log Level

By default the CLI keeps console output at `warning` level, matching a Roku device out of the box.
Pass `--log-level debug` to add the `threadID` in every print, and show `debug`-level lines (e.g. the extra
action/target detail on [rendezvous tracing](#tracing-cross-thread-rendezvous)), or `--log-level error` to
silence `warning`-level lines too:

```console
$ brs-cli --log-level debug app.zip
```

In the REPL, use `loglevel` (no argument) to show the current level, or `loglevel <level>` to change
it for the session:

```console
brs> loglevel
Current log level: warning
brs> loglevel debug
Log level set to: debug
```

| Level | Description |
| :---: | :--- |
| `debug` | Everything: `debug`, `warning` and `error` lines |
| `warning` | `warning` and `error` lines only (default) |
| `error` | `error` lines only |

### Executing files

The CLI can execute an arbitrary list of BrightScript files (`.brs`) as well!  Simply pass the file(s) to the `brs-cli` executable, e.g.:

```console
$ cat hello-world.brs
? "Dennis Ritchie said ""Hello, World!"""

$ brs-cli hello-world.brs
Dennis Ritchie said "Hello, World!"
```

A folder can be passed with the flag `--root` to mount the `pkg:/` volume, and in this case, the BrightScript files path should be relative to the mounted root folder. Please be aware that this is using the host file system, so if you are running the CLI on a Linux machine the paths are case sensitive, unlike Roku (or using `zip` files with the engine).

If `--root` is passed **without** any file arguments, the CLI runs the folder as a full application: it loads every `.brs` under `source/` and serves the `components/` tree (including SceneGraph components) from the mounted `pkg:/` volume, e.g:

```console
$ brs-cli --root ./my-app
```

It is also possible to run a full BrightScript application `.zip` or `.bpk` file, e.g:

```console
$ brs-cli ../tests/test-sandbox.zip
```

#### Notes

* If the app has `ifDraw2D` screens, the app will run but nothing is displayed, unless you use one of the screen rendering options `--ascii`, `--unicode` or `--image` (see below).
* The app runs on a dedicated worker thread, so you can control it interactively with the keyboard (see below) or via the `--ecp` option.
* SceneGraph `Task` nodes run on their own worker threads, mirroring the browser engine and a real device.
* Use the flag `--registry` to have the device registry data saved to the disk, and restored in following app executions.
* Use the flag `--ext-vol` to mount a directory or zip archive as the `ext1:` volume.
* To send parameters (deep linking) to the app, use the flag `--deep-link` followed by the parameters in the format: key=value,...

### Showing Screen as ASCII Rendering on the Terminal

If you pass the `--ascii <columns>` option, the CLI will run the application and show a representation of the screen bitmap as ASCII rendering on the terminal screen.
Use the optional `--unicode` flag to render the output using Unicode block characters for smoother gradients. If `--unicode` is provided without `--ascii`, it will calculate the columns based on the terminal width and height.

```console
$ brs-cli ../apps/collisions.zip --ascii 170
```

The `<columns>` defines the width in number of character columns, the height will follow the screen proportion, if not provided, it will try to fit the terminal size.

<p align="center"><img alt="Screen Rendering as ASCII Art" title="Screen Rendering as ASCII Art" src="images/screen-as-ascii-art.gif?raw=true"/></p>

### Showing the Screen as Images on the Terminal

The `--image` option renders the screen as actual images on the terminal (an alternative to `--ascii`/`--unicode`). On terminals with native graphics support (iTerm2, Kitty and compatible), frames display in full quality via the terminal's image protocol; elsewhere it falls back to ANSI half-block rendering.

```console
$ brs-cli ../apps/collisions.zip --image
```

The optional `[percent]` argument scales the image to a percentage of the terminal width (valid range: 10-100, default: 100), keeping the screen's aspect ratio:

```console
$ brs-cli ../apps/collisions.zip --image 60
```

### Redirecting the Text Output to a Log File

While the screen is being rendered on the terminal (`--ascii`, `--unicode` or `--image`), any text the app or the engine prints is held back and only shown after the app finishes — writing text over the frames would corrupt (and on graphics terminals, flicker) the rendering. If you want to follow the output live instead, use the `--log` option to redirect all text output (prints, warnings, errors and diagnostics) to a file, appended as it arrives with ANSI colors stripped — so you can watch it from another terminal with `tail -f`:

```console
$ brs-cli ../apps/my-app.zip --image --log my-app.log
```

The filename is optional (default: `brs-cli.log`). When the Micro Debugger is active it takes over the terminal, so its interaction stays on screen regardless of this option.

### Saving the Screen as a PNG Image

The `--snapshot` option enables the **Ctrl+S** keyboard shortcut: while the app is running, pressing it saves the current screen as a PNG file, so you can capture any moment of the rendering. The filename is optional: if omitted, the image is saved in the current directory using the app file name (e.g. `my-app.png`); each press overwrites the previous capture.

```console
$ brs-cli ../apps/collisions.zip --snapshot screenshot.png
```

This option is independent of the screen modes: you can combine it with `--ascii`, `--unicode` or `--image`, or use it alone.

### Controlling the App

The app runs on a dedicated worker thread, leaving the terminal free for interactive control: when the CLI is attached to a terminal (TTY), the keyboard acts as the remote control while the app is running.

| Key | Roku Remote |
| --- | --- |
| Arrow keys | Up / Down / Left / Right |
| Enter | Select (OK) |
| Esc or Delete | Back |
| Home or F2 | Home (exits the app) |
| Backspace | Instant Replay |
| End or F8 | Play/Pause |
| PageUp / PageDown | Rewind / Fast Forward |
| F7 / F9 | Rewind / Fast Forward |
| Ctrl+Left / Ctrl+Right | Rewind / Fast Forward |
| Insert or F10 | Info |
| Ctrl+Backspace | Backspace (deletes a character in keyboard dialogs) |
| Ctrl+Enter | Play/Pause |
| Ctrl+A / Ctrl+Z | A / B (game remote) |
| Letters / digits | Text input (keyboard dialogs) |
| Ctrl+S | Save a screenshot (requires `--snapshot`) |
| Ctrl+B | Break into the Micro Debugger (requires `--debug`) |
| Ctrl+C | Production mode: terminate the CLI; with `--debug`: break into the Micro Debugger (like a `STOP`) |
| Ctrl+D | Terminate the CLI |

If you need remote control simulation from other devices, enable the option `--ecp` that will launch the ECP Server in port 8060 (same as a Roku device). With this option enabled, you can connect to your computer using any remote control app that uses ECP, including the [Roku Remote Tool](https://devtools.web.roku.com/#remote-tool), the [Roku GamePad Gateway](http://github.com/lvcabral/roku-gpg) or the Roku mobile apps. This option also enables an SSDP service to allow it to be discovered in your local network.

If port 8060 is already taken — by another instance of the engine, a desktop build, or a remote control tool — set the `BRS_ECP_PORT` environment variable to bind elsewhere:

```console
$ BRS_ECP_PORT=8160 brs-cli --ecp app.zip
```

SSDP discovery is skipped on a non-default port: remote control apps only look for ECP on 8060, so advertising a relocated server would publish an endpoint nothing can use.

### Production vs Developer mode

By default the engine runs in **production mode**, which keeps it lean by skipping all debug
instrumentation. Passing `--debug` (or setting `debugOnCrash` in the device info) switches to
**developer mode**, which enables the Micro Debugger and the resource tracking used by its
inspection commands. In developer mode you can break into the debugger at any time with
`Ctrl+B`; while the debugger is active the keyboard switches to line mode for entering debug
commands and BrightScript expressions (`cont` resumes the app and restores remote-control keys).

| Capability | Production (default) | Developer (`--debug`) |
| --- | --- | --- |
| Micro Debugger (on crash, `STOP`, or break) | disabled | enabled |
| `STOP` statement | exits the app | opens the debugger |
| `bscs` / `sgnodes` / `stats` debug commands | empty | populated |
| Crash `BackTrace:` output | suppressed | shown |
| ECP `query/r2d2-bitmaps` | empty | populated |
| `try/catch` `e.backtrace` | works | works |
| Reference counting, `dispose()`, error messages | unchanged | unchanged |

This avoids the per-object/per-node bookkeeping overhead when you are just running an app. Note
that `try/catch` exception backtraces (`e.backtrace`) keep working in both modes.

Encrypted packages (`.bpk`) **always** run in production mode — `debugOnCrash` is forced off even
if you pass `--debug` — so a protected app cannot be inspected through the debug instrumentation.

### Tracing cross-thread rendezvous

SceneGraph `Task` nodes run on their own worker threads, and every field read, field write, or
method call that crosses a thread boundary goes through a *rendezvous* (see
[SceneGraph Rendezvous](scenegraph-rendezvous.md)). Passing `-z`/`--log-rendezvous` — the equivalent of
Roku's `logrendezvous` — makes each of those crossings print a `[rendezvous]` line:

```console
$ brs-cli -z --log trace.log app.zip
```

The flag is independent of `--debug` and applies to the render thread *and* every Task worker, so
both ends of a crossing appear. It is held in the shared control array rather than per thread, so a
host embedding the engine can also flip it mid-run (see `setRendezvousLog` in
[the engine API](engine-api.md)). Typical lines:

| Line | Meaning |
| --- | --- |
| `thread N queued fan-out task.request -> task thread M` | render thread has work for task `M` |
| `thread N flushed fan-out task.request -> task thread M` | it was written into the shared buffer |
| `thread 0 applied set node.content from thread N` | a task's write landed on the render thread |
| `thread N broker fan-out …` | the update went through the main-thread broker |

Combine it with `--log` to capture a full trace, since it is verbose on task-heavy apps.

### Inspecting Texture Memory

With the ECP server **and** developer mode enabled (`--ecp --debug`), the CLI exposes the
`query/r2d2-bitmaps` endpoint, mirroring a real Roku device (which likewise requires developer
mode for this query). It returns, as XML, the list of bitmaps currently loaded into texture
memory (width, height, bytes-per-pixel, size and name) together with the registered fonts and
the system/texture memory totals. This is useful for diagnosing texture-memory pressure in 2D
API apps and SceneGraph apps. In production mode the endpoint responds with an empty list.

```console
$ curl http://localhost:8060/query/r2d2-bitmaps
```

```xml
<?xml version="1.0"?>
<r2d2-bitmaps>
  <timestamp>1782607141042</timestamp>
  <channel-id>dev</channel-id>
  <graphics-instances>
    <rographics>
      <sytem-memory>
        <used>0</used>
      </sytem-memory>
      <texture-memory>
        <used>1298800</used>
        <available>98701200</available>
        <max>100000000</max>
      </texture-memory>
      <bitmap>
        <width>100</width>
        <height>100</height>
        <bpp>4</bpp>
        <size>40000</size>
        <name>pkg:/images/alpha.png</name>
      </bitmap>
      <!-- ...one <bitmap> per loaded image and registered font... -->
    </rographics>
  </graphics-instances>
  <status>OK</status>
</r2d2-bitmaps>
```

> Sizes are an approximation (`width × height × bpp`); on a real device the texture allocator pads them to alignment boundaries.

### Creating an encrypted App package file

If you want to protect your BrightScript application source code, you can create an encrypted package using the CLI, using the parameters:

1. `-p, --pack <password>`:  The password to generate the encrypted package (32 characters long). (default: "")
2. `-o, --out <directory>`:  The directory to save the encrypted package file. (default: "./")

If no password is provided the app will be executed and no encryption happens, below an example of how to encrypt a package:

```console
$ brs-cli ../tests/test-sandbox.zip --pack b4bf93d0d5e547ca8edcc0f39c6bcc16 --out ./release

BrightScript Simulation Engine CLI [v2.3.0]

Packaging ../tests/test-sandbox.zip...

Package file created as ./release/test-sandbox.bpk with 528 KB.

```

SceneGraph applications are fully supported: in addition to the `pkg:/source/` code, every component file under `pkg:/components/` (both `.brs` scripts and `.xml` definitions, including their inline `<script>` blocks) is encrypted into the package and removed from the distributed `.bpk`. The component files are restored in memory only at runtime, after the package is decrypted with the password, and are dropped again once the engine has parsed them — so a packaged app cannot read its own component source back at runtime (e.g. via `ReadAsciiFile`), just like the encrypted `pkg:/source/` code. The empty `components/` directory tree is also pruned from the package so it does not reveal the app's structure.

In addition, the **entire `.bpk` container is encrypted** with the same password (AES-256), so even the plaintext assets — images, fonts, data files, and the manifest — cannot be read without it. The performance cost is negligible (a few hundred microseconds to a few milliseconds at load, depending on package size). Plain `.zip` files and packages created by older versions are still opened normally and do not require a password.

To run an encrypted `.bpk`, provide the same password used to create it via `--pack`:

```console
$ brs-cli ./release/test-sandbox.bpk --pack b4bf93d0d5e547ca8edcc0f39c6bcc16
```

> **Note:** The package is only protected at rest. Anyone with the password can decrypt and run it, so keep the password private and never embed it in a public web app.
