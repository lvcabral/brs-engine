# Building from Source

The BRS project follows pretty standard `node` development patterns, with the caveat that it uses `yarn` for dependency management.

## Prerequisites

BRS builds (and runs) in `node`, so you'll need to [install that first](https://nodejs.org).

Once that's ready, install [yarn](https://yarnpkg.com).  Installing it with `npm` is probably the simplest:

```shell
$ npm install -g yarn
```

## Setup

1. Clone this repo:

   ```shell
   $ git clone https://github.com/lvcabral/brs-engine.git
   ```

2. Install dependencies:

    ```shell
    $ yarn install     # or just `yarn`
    ```

## The build-test-clean dance

### Build

This project is written in TypeScript, so it needs to be compiled before it can be executed. `yarn build` compiles files in `src/` into JavaScript and TypeScript declarations, and puts them in `lib/`, `bin/` and `types/`.

```shell
$ yarn build

$ ls app/lib/
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

Tests are currently broken, the ones we have in the repository came with the fork from `brs`, and were written in plain-old JavaScript with [Facebook's Jest](http://facebook.github.io/jest/). If you are a test expert, or just want to help, this is a great area to collaborate.

### Cleaning

Compiled output in `lib/`, `bin/` and `types/` can be removed with the `clean` target:

```shell
$ yarn clean

$ ls lib/
ls: cannot access 'lib': No such file or directory

$ ls bin/
ls: cannot access 'bin': No such file or directory

$ ls types/
ls: cannot access 'types': No such file or directory
```
