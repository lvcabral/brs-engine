# Run as Command Line Interface

Once you have built the library you can link it to your path with the following command:

```shell
$ npm link
```

## Usage

This repo provides the `brs-cli` executable, which operates as a REPL, running source files or creating encrypted app packages.
For a list of options run:

```shell
$ brs-cli --help
```

### REPL

An interactive BrightScript REPL (Read-Execute-Print Loop) is available by running `brs-cli` with no arguments, e.g.:

```shell
$ brs-cli
brs> ?"Dennis Ritchie said ""Hello, World!"""
Dennis Ritchie said "Hello, World!"
```

Quit by pressing `^D` (Control-D) or executing `exit`.

### Executing files

The CLI can execute an arbitrary list of BrightScript files (`.brs`) as well!  Simply pass the file(s) to the `brs-cli` executable, e.g.:

```shell
$ cat hello-world.brs
?"Dennis Ritchie said ""Hello, World!"""

$ brs hello-world.brs
Dennis Ritchie said "Hello, World!"
```

It is also possible to run a full BrightScript application `.zip` or `.bpk` file, however it does not support Draw2D objects yet, so only pure BrigtScript code. e.g:

```shell
$ brs-cli ../tests/test-sandbox.zip
```

### Creating an encrypted App package file

If you want to protect your BrightScript application source code, you can create an encrypted package using the CLI, using the parameters:

1. ` -p, --pack <password>`:  The password to generate the encrypted package. (default: "")
2. `-o, --out <directory>`:  The directory to save the encrypted package file. (default: "./")

If no password is provided the app will be executed and no encryption happens, below an example of how to encrypt a package

```shell
$ brs-cli ../tests/test-sandbox.zip --pack b4bf93d0-d5e5-47ca-8edc-c0f39c6bcc16 --out ./release

BrightScript Emulator CLI [Version 0.11.1]

Packaging ../tests/test-sandbox.zip...

Package file created as ./release/test-sandbox.bpk with 528 KB.

```

