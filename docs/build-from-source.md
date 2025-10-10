# Building from Source

The brs-engine project follows pretty standard `Node.js` development patterns, being built with Webpack and TypeScript in a monorepo structure with two packages: `packages/browser` and `packages/node`.

## Prerequisites

As it builds (and runs the CLI) in `Node.js` (v22 or newer), so you'll need to [install that first](https://nodejs.org/en/download).

## Setup

1. Clone this repo:

   ```console
   $ git clone https://github.com/lvcabral/brs-engine
   ```

2. Install dependencies:

    ```console
    $ npm install
    ```

## The build-test-clean dance

### Build

This project is written in TypeScript, so it needs to be compiled before it can be executed. `npm run build` compiles both packages, using the source code in `src/`, into JavaScript and TypeScript declarations, and puts them in `lib/`, `bin/` and `types/`.

```console
$ npm run build

$ ls packages/browser/lib/
brs.api.js
brs.worker.js

$ ls packages/node/bin/
brs.cli.js
brs.ecp.js
brs.node.js

$ ls packages/browser/types/
index.d.ts (and friends)
```

### Release

To release a smaller version of the libraries Webpack can create a *minified* version by running `npm run release`.

### Running the Example Web Application

To build and start the web application on your default browser just execute `npm run build:web`.

### Testing

Tests are written in plain-old JavaScript with [Facebook's Jest](http://facebook.github.io/jest/), and can be run with the `test` target:

```console
$ npm run test
```

If you need to update the snapshots use the command: `npx jest --updateSnapshot`

### Cleaning

Compiled output in `lib/`, `bin/` and `types/` can be removed with the `clean` target:

```console
$ npm run clean

$ ls packages/browser/lib/
ls: cannot access 'lib': No such file or directory

$ ls packages/browser/types/
ls: cannot access 'types': No such file or directory

$ ls packages/node/bin/
ls: cannot access 'bin': No such file or directory

$ ls packages/node/types/
ls: cannot access 'types': No such file or directory
```
