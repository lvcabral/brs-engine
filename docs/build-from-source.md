# Building from Source

The brs-engine project follows pretty standard `Node.js` development patterns, being built with Webpack and TypeScript in a monorepo structure with three packages: `packages/browser` (**brs-engine**), `packages/node` (**brs-node**) and `packages/scenegraph` (**brs-scenegraph**).

## Prerequisites

As it builds (and runs the CLI) in `Node.js` (v22 or newer), so you'll need to [install that first](https://nodejs.org/en/download).

## Setup

1. Clone this repo, including the submodules:

   ```console
   $ git clone --recurse-submodules https://github.com/lvcabral/brs-engine
   ```

   If you cloned without `--recurse-submodules`, populate the Roku reference documentation submodule with:

   ```console
   $ npm run docs:update
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
brs-sg.js
brs.api.js
brs.worker.js

$ ls packages/node/bin/
brs-sg.node.js
brs.cli.js
brs.ecp.js
brs.node.js

$ ls packages/scenegraph/lib/
brs-sg.js
brs-sg.node.js

$ ls packages/browser/types/
index.d.ts (and friends)
```

Individual packages can also be built on their own:

| Command | Builds |
| --- | --- |
| `npm run build:api` | **brs-engine** only (browser API + worker) |
| `npm run build:node` | **brs-node** only (CLI, ECP and Node.js library) |
| `npm run build:sg` | **brs-scenegraph** only |
| `npm run build:cli` | **brs-node** followed by **brs-scenegraph** |
| `npm run build:web` | **brs-engine** + **brs-scenegraph**, then opens the example web app |

> [!IMPORTANT]
>
> The **brs-scenegraph** build produces the merged `assets/common.zip` (core assets plus the SceneGraph fonts and imagery) and copies it over the one in the other two packages. Because of that, always build it **last** — running `npm run build:node` on its own downgrades the node package to a core-only `common.zip`. The `build`, `build:cli` and `build:web` targets already order this correctly.

### Release

To release a smaller version of the libraries Webpack can create a *minified* version by running `npm run release`.

### Running the Example Web Application

To build and start the web application on your default browser just execute `npm run build:web`.

### Testing

Tests are written in plain-old JavaScript with [Vitest](https://vitest.dev/), and can be run with the `test` target:

```console
$ npm run test
```

If you need to update the snapshots use the command: `npx vitest run --update`

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
