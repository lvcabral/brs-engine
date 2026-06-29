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
  -c, --colors <level>      Define the console color level (0 to disable). (default: 3)
  -d, --debug               Developer mode: micro debugger on crash + resource tracking.
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

BrightScript Simulation Engine CLI [v2.2.0]

type `help` to see the list of valid REPL commands.

brs> ? "Dennis Ritchie said ""Hello, World!"""
Dennis Ritchie said "Hello, World!"
```

Quit by pressing `^D` (Control-D) or executing `exit`.

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

* If the app has `ifDraw2D` screens, the app will run but nothing is displayed, unless you use the `--ascii` parameter (see below).
* As the CLI will run on a single thread, if you need to control the app you will have to enable the `--ecp` option (see below).
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

### Controlling the App

The CLI runs the BrightScript Engine on a single thread, if you need to use control simulation, enable the option `--ecp` that will launch the ECP Server in port 8060 (same as a Roku device). With this option enabled, you can connect to your computer using any remote control app that uses ECP, including the [Roku Remote Tool](https://devtools.web.roku.com/#remote-tool), the [Roku GamePad Gateway](http://github.com/lvcabral/roku-gpg) or the Roku mobile apps. This option also enables an SSDP service to allow it to be discovered in your local network.

### Production vs Developer mode

By default the engine runs in **production mode**, which keeps it lean by skipping all debug
instrumentation. Passing `--debug` (or setting `debugOnCrash` in the device info) switches to
**developer mode**, which enables the Micro Debugger and the resource tracking used by its
inspection commands.

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

BrightScript Simulation Engine CLI [v2.2.0]

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
