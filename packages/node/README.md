# BrightScript Simulation Engine for Node.js

An interpreter for the BrightScript language that runs as a CLI and Roku apps in Node.js.

[![NPM Version](https://img.shields.io/npm/v/brs-node?logo=npm&label=brs-node&color=blue)](https://www.npmjs.com/package/brs-node?activeTab=versions)
[![License](https://img.shields.io/github/license/lvcabral/brs-engine?logo=github)](https://github.com/lvcabral/brs-engine/blob/master/LICENSE)
[![Build](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## Overview

The **BrightScript Simulation Engine** provides a complete a set of libraries and a command-line interface for executing, testing, and packaging [Roku apps](https://developer.roku.com/overview) on Node.js platforms. Perfect for automation, CI/CD pipelines, development workflows, and server-side BrightScript execution.

> 🚨 Important:
>
> Since v1.9.0, this package was split from the browser package, to use the **simulation engine** with web based applications check out the [brs-engine](https://www.npmjs.com/package/brs-engine?activeTab=versions) package.

<p align="center"><img alt="Simulator CLI" title="Simulator CLI" src="https://raw.githubusercontent.com/lvcabral/brs-engine/refs/heads/scenegraph/docs/images/brs-cli.png?raw=true" width="500"/></p>

## Key Features

### 🖥️ Command Line Interface

- **Interactive REPL** - [Read-eval-print loop](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop) for BrightScript
- **File Execution** - Run `.brs`, `.zip`, and `.bpk` files directly
- **Folder Execution** - Run BrightScript apps from a folder
- **App Packaging** - Create encrypted `.bpk` packages from `.zip` files
- **ASCII Rendering** - Run Roku apps using ASCII rendering in the terminal
- **Batch Processing** - Execute multiple files and automate workflows

### ⚙️ BrightScript Interpreter

- Full BrightScript language interpreter, with specs aligned up to Roku OS 15.0
- **Draw 2D API** - Full support for the BrightScript 2D drawing components
- **SceneGraph Framework** - Experimental support for the Roku SceneGraph components (see section below)
- **Video Playback** - Via `roVideoPlayer` and `Video` node
- **Audio Playback** - Via `roAudioResources`, `roAudioPlayer` and `Audio` node
- **Image Processing** - Support for PNG, JPEG, GIF, BMP and WEBP formats

### 📺 Device Simulation

- **Screen resolutions** - Support for various Roku display modes
- **Input Handling** - Keyboard and gamepad simulation for remote control input, see [docs](https://github.com/lvcabral/brs-engine/blob/master/docs/remote-control.md) for more details
- **File System Simulation** - Including `pkg:/`, `tmp:/`, `cachefs:/`, `common:/` and `ext1:/` volumes
- **Registry simulation** - Roku device registry emulation saved on browser local storage
- **Micro Debugger** - Step-through debugging capabilities, similar to the Roku experience
- **ECP Server** - [External Control Protocol](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md) for remote control
- **SSDP Discovery** - Device discovery simulation
- **Localization** - Language and region settings
- **Customization** - You can customize device features and behaviors, see [docs](https://github.com/lvcabral/brs-engine/blob/master/docs/customization.md) for more details

## SceneGraph Extension

The [`brs-scenegraph`](https://www.npmjs.com/package/brs-scenegraph) extension is integrated to the `brs-node` package by default. The CLI app loads it so the REPL and apps can run SceneGraph without additional setup. Use the `--no-sg` flag if you want to disable it for a given CLI session. For your Node.js apps register it manually by calling `registerExtension(() => new BrightScriptExtension())`. Refer to [packages/scenegraph/README.md](../../packages/scenegraph/README.md) for more information about the extension package.

> ⚠️ Note:
>
> **SceneGraph** extension is currently under development, with pre-release **alpha** versions available for testing. See the current state of the SceneGraph implementation and other limitations of the **engine** in the [Current Limitations](https://github.com/lvcabral/brs-engine/blob/master/docs/limitations.md) document.

## Installation

### Global Installation (CLI)

```bash
npm install -g brs-node
```

### Project Installation (Library)

```bash
npm install brs-node
```

### Libraries

The package libraries require Node.js v22 or higher, and are organized as follows:

| Library File | Description |
| --- | --- |
| `bin/brs.cli.js` | Executable **[CLI](https://github.com/lvcabral/brs-engine/blob/master/docs/run-as-cli.md)** application that can be used from the terminal |
| `bin/brs.node.js` | A NodeJS library, that exposes the language interpreter to be used by Node.js applications |
| `bin/brs.ecp.js` | A **[NodeJS Worker](https://nodejs.org/api/worker_threads.html)** library, used by the CLI to launch the [ECP](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md) and **SSDP** services. |

## Documentation

Learn how to use the package and its libraries by reading the documents below:

- [How to use the Node.js Library](https://github.com/lvcabral/brs-engine/blob/master/docs/using-node-library.md)
- [How to run as a Command Line Interface](https://github.com/lvcabral/brs-engine/blob/master/docs/run-as-cli.md)
- [How to customize the Engine behavior](https://github.com/lvcabral/brs-engine/blob/master/docs/customization.md)
- [Remote Control Simulation](https://github.com/lvcabral/brs-engine/blob/master/docs/remote-control.md)
- [How to build from source](https://github.com/lvcabral/brs-engine/blob/master/docs/build-from-source.md)
- [How to contribute to this Project](https://github.com/lvcabral/brs-engine/blob/master/docs/contributing.md)

### Changelog

- Read the [project changelog](https://github.com/lvcabral/brs-engine/blob/master/CHANGELOG.md) to view the release notes.

## Developer Links

- My website: [https://lvcabral.com](https://lvcabral.com)
- My threads: [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My X/twitter: [@lvcabral](https://twitter.com/lvcabral)
- My podcast: [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## License

Copyright © 2019-2025 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](https://github.com/lvcabral/brs-engine/blob/master/LICENSE) license.
