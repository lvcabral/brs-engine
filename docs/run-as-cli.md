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
  -p, --pack <password>  The password to generate the encrypted package. (default: "")
  -o, --out <directory>  The directory to save the encrypted package file. (default: "./")
  -d, --debug            Open the micro debugger on a crash.
  -w, --worker           Run the app in a worker thread. (beta)
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
* As the `node-canvas` package still can't run in a NodeJS worker thread, the apps with `ifDraw2D` can't use the `--worker` option.

### Showing Screen as ASCII Art on the Terminal

If you pass the `--ascii <columns>` option, the CLI will run the application and show a representation of the screen bitmap as ASCII Art on the terminal screen.

```shell
$ brs-cli ../apps/collisions.zip --ascii 170
```
The `<columns>` defines the width in number of character columns, the height will follow the screen proportion.

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

### Running the Engine as a Worker

By default the CLI will run the BrightScript Engine on the Main Thread (both REPL and file execution), but there is now an option (still in beta) to run it on a worker thread (just like the Browser version), allowing the usage of control emulation.
Unfortunately the [node-canvas](https://github.com/Automattic/node-canvas) component has a [known issue](https://github.com/Automattic/node-canvas/issues/1394) that prevents it to run in a worker thread. This way, currently, it's not possible to run an app that uses `ifDraw2D` components (`roScreen`, `roBitmap`, etc.) with this option enabled.

Below is an example of code, that can be executed with the `--worker` option, to demonstrate the control simulation with keyboard keys on the CLI, the `roScreen` is used only to receive `roMessagePort` events, no draw methods are supported.

```brs
sub main()
  port = CreateObject("roMessagePort")
  screen = CreateObject("roScreen")
  screen.SetMessagePort(port)
  while true
    msg = wait(0, port)
    if type(msg) = "roUniversalControlEvent"
      key = msg.getInt()
      if key = 0 '<BACK>
        exit while
      else if key = 5 '<RIGHT>
        print "device uptime:"; UpTime(0)
      else if key < 100
        print "key:"; key
      end if
    end if
  end while
end sub
```
