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
   ```
   $ git clone https://github.com/lvcabral/brs-emu.git
   ```

2. Install dependencies:
    ```shell
    $ yarn install     # or just `yarn`
    ```

## The build-test-clean dance
### Build
This project is written in TypeScript, so it needs to be compiled before it can be executed.  `yarn build` compiles files in `src/` into JavaScript and TypeScript declarations, and puts them in `lib/` and `types/` respectively.

```shell
$ yarn build

$ ls app/lib/
brsEmu.js

$ ls types/
index.d.ts (and friends)
```
### Release
To release a smaller library Webpack can create a *minified* version by running `yarn release`.

```shell
$ yarn release

$ ls app/lib/
brsEmu.min.js
```
If you want to use this release version, remember to update `app/index.js` to use `brsEmu.min.js` instead of `brsEmu.js`.

### Testing
Tests are written in plain-old JavaScript with [Facebook's Jest](http://facebook.github.io/jest/), and can be run with the `test` target:

```shell
$ yarn test

# tests start running
```

Notes:
* Only test files ending in `.test.js` will be executed by `yarn test`.
* Currently, BRS-EMU tests are not covering all emulation components, and some of BRS tests are failing, this will be fixed, be patient (or help me write the tests).

### Cleaning
Compiled output in `lib/` and `types/` can be removed with the `clean` target:

```shell
$ yarn clean

$ ls lib/
ls: cannot access 'lib': No such file or directory

$ ls types/
ls: cannot access 'types': No such file or directory
```

### All Together
Thanks to the [npm-run-all](https://www.npmjs.com/package/npm-run-all) package, it's trivially easy to combine these into a sequence of tasks without relying on shell semantics:

```shell
$ yarn run-s clean build test
```
