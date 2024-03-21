# Run as Command Line Interface

Once you have built the CLI library you can link it to your path with the following command:

```shell
$ npm link
```

## Usage

This repo provides the `brs-cli` executable, which operates as a REPL, running source files or creating encrypted app packages.
For a list of options run:

```shell
$ brs-cli --help
Usage: brs-cli [options] [brsFiles...]

BrightScript Simulation Engine CLI

Options:
  -a, --ascii <columns>  Enable ASCII screen mode passing the width in columns. (default: 0)
  -c, --colors <level>   Define the console color level (0 to disable). (default: 3)
  -d, --debug            Open the micro debugger if the app crashes.
  -e, --ecp              Enable the ECP server for control simulation.
  -r, --registry         Persist the simulated device registry on disk.
  -p, --pack <password>  The password to generate the encrypted package. (default: "")
  -o, --out <directory>  The directory to save the encrypted package file. (default: "./")
  -v, --version          output the version number
  -h, --help             output usage information
```

### REPL

An interactive BrightScript REPL (Read-Execute-Print Loop) is available by running `brs-cli` with no arguments, e.g.:

```shell
$ brs-cli

BrightScript Simulation Engine CLI [v1.0.0]

type `help` to see the list of valid REPL commands.

brs> ? "Dennis Ritchie said ""Hello, World!"""
Dennis Ritchie said "Hello, World!"
```

Quit by pressing `^D` (Control-D) or executing `exit`.

## Setting the Color Level

By default the CLI will display text in ANSI Truecolor mode (level 3 below), but you can change it for the session by running:

```shell
$ brs-cli --color 0
```

| Level | Description |
| :---: | :--- |
| `0` | All colors disabled |
| `1` | Basic color support (16 colors) |
| `2` | 256 color support |
| `3` | Truecolor support (16 million colors) |

### Executing files

The CLI can execute an arbitrary list of BrightScript files (`.brs`) as well!  Simply pass the file(s) to the `brs-cli` executable, e.g.:

```shell
$ cat hello-world.brs
? "Dennis Ritchie said ""Hello, World!"""

$ brs hello-world.brs
Dennis Ritchie said "Hello, World!"
```

It is also possible to run a full BrightScript application `.zip` or `.bpk` file, e.g:

```shell
$ brs-cli ../tests/test-sandbox.zip
```

#### Notes

* If the app has `ifDraw2D` screens, the app will run but nothing is displayed, unless you use the `--ascii` parameter (see below).
* As the CLI will run on a single thread, if you need to control the app you will have to enable the `--ecp` option (see below).
* Use the flag `--registry` to have the device registry data saved to the disk, and restored in following app executions.

### Showing Screen as ASCII Art on the Terminal

If you pass the `--ascii <columns>` option, the CLI will run the application and show a representation of the screen bitmap as ASCII Art on the terminal screen.

```shell
$ brs-cli ../apps/collisions.zip --ascii 170
```
The `<columns>` defines the width in number of character columns, the height will follow the screen proportion.

<p align="center"><img alt="Screen Rendering as ASCII Art" title="Screen Rendering as ASCII Art" src="images/screen-as-ascii-art.gif?raw=true"/></p>

### Controlling the App

The CLI runs the BrightScript Engine on a single thread, if you need to use control simulation, enable the option `--ecp` that will launch the ECP Server in port 8060 (same as a Roku device). With this option enabled, you can connect to your computer using any remote control app that uses ECP, including the [Roku Remote Tool](https://devtools.web.roku.com/#remote-tool), the [Roku GamePad Gateway](http://github.com/lvcabral/roku-gpg) or the Roku mobile apps. This option also enables an SSDP service to allow it to be discovered in your local network.

### Creating an encrypted App package file

If you want to protect your BrightScript application source code, you can create an encrypted package using the CLI, using the parameters:

1. `-p, --pack <password>`:  The password to generate the encrypted package (32 characters long). (default: "")
2. `-o, --out <directory>`:  The directory to save the encrypted package file. (default: "./")

If no password is provided the app will be executed and no encryption happens, below an example of how to encrypt a package:

```shell
$ brs-cli ../tests/test-sandbox.zip --pack b4bf93d0d5e547ca8edcc0f39c6bcc16 --out ./release

BrightScript Simulation Engine CLI [v1.0.0]

Packaging ../tests/test-sandbox.zip...

Package file created as ./release/test-sandbox.bpk with 528 KB.

```
