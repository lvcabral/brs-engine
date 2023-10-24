# Run as Command Line Interface

One you have built the library you can link it to your path with the following command:

```shell
$ npm link
```

## Usage

This repo provides the `brs-cli` executable, which operates in two ways.

### REPL

An interactive BrightScript REPL (Read-Execute-Print Loop) is available by running `brs-cli` with no arguments, e.g.:

```shell
$ brs-cli
brs> ?"Dennis Ritchie said ""Hello, World!"""
Dennis Ritchie said "Hello, World!"
```

Quit by pressing `^D` (Control-D) or executing `exit`.

### Executing a file

The CLI can execute an arbitrary BrightScript file as well!  Simply pass the file to the `brs-cli` executable, e.g.:

```shell
$ cat hello-world.brs
?"Dennis Ritchie said ""Hello, World!"""

$ brs hello-world.brs
Dennis Ritchie said "Hello, World!"
```

It is also possible to run a full Roku application ZIP file, however it does not support Draw2D objects yet, so only pure BrigtScript code. e.g:

```shell
$ brs-cli ../tests/test-sandbox.zip
```
