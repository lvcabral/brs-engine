# Building from Source

The brs-engine project follows pretty standard `node` development patterns, with the caveat that it uses `yarn` for dependency management.

## Prerequisites

As it builds (and runs the CLI) in `node` (v21 or newer), so you'll need to [install that first](https://nodejs.org).

Once that's ready, install [yarn](https://yarnpkg.com).  Installing it with `npm` is probably the simplest:

```console
$ npm install -g yarn
```

## Setup

1. Clone this repo:

   ```console
   $ git clone https://github.com/lvcabral/brs-engine.git
   ```

2. Install dependencies:

    ```console
    $ yarn install     # or just `yarn`
    ```

## The build-test-clean dance

### Build

This project is written in TypeScript, so it needs to be compiled before it can be executed. `yarn build` compiles files in `src/` into JavaScript and TypeScript declarations, and puts them in `lib/`, `bin/` and `types/`.

```console
$ yarn build

$ ls browser/lib/
brs.api.js
brs.worker.js

$ ls bin/
brs.cli.js

$ ls types/
index.d.ts (and friends)
```

### Release

To release a smaller version of the libraries Webpack can create a *minified* version by running `yarn release`.

### Running the Example Web Application

To build and start the web application on your default browser just execute `yarn start`.

### Testing

Tests are written in plain-old JavaScript with [Facebook's Jest](http://facebook.github.io/jest/), and can be run with the `test` target:

```console
$ yarn test

# tests start running
```

Note that only test files ending in `.test.js` will be executed by `yarn test`.

If you need to update the snapshots use the command: `npx jest --updateSnapshot`

### Cleaning

Compiled output in `lib/`, `bin/` and `types/` can be removed with the `clean` target:

```console
$ yarn clean

$ ls lib/
ls: cannot access 'lib': No such file or directory

$ ls bin/
ls: cannot access 'bin': No such file or directory

$ ls types/
ls: cannot access 'types': No such file or directory
```
