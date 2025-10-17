# BrightScript Simulation Engine

An interpreter for the BrightScript language that runs Roku apps on browser platforms and Node.js.

[![NPM Version (with dist tag)](https://img.shields.io/npm/v/brs-engine/alpha?logo=npm&label=brs-engine&color=blue)](https://npmjs.org/package/brs-engine?activeTab=versions)
[![NPM Version (with dist tag)](https://img.shields.io/npm/v/brs-node/alpha?logo=npm&label=brs-node&color=blue)](https://www.npmjs.com/package/brs-node?activeTab=versions)
[![License](https://img.shields.io/github/license/lvcabral/brs-engine?logo=github)](https://github.com/lvcabral/brs-engine/blob/master/LICENSE)
[![Build](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## The Project

The **BrightScript Simulation Engine** implements an interpreter for the **BrightScript** language, that can be embedded in Web, Electron and Node.js applications, or used as a CLI/REPL standalone tool, allowing [Roku apps](https://developer.roku.com/overview) to be executed in several different non-Roku platforms.

Initially the focus was on the support of **Draw 2D API** components (`roScreen`, `roCompositor`, `roRegion`, etc.) along with the core elements of the **BrightScript** language, allowing a full Roku app execution over an **HTML5 Canvas**, but the scope was extended to include the SceneGraph framework, simulation of the **Roku** file system, registry, remote control and the Micro Debugger.

The **brs-engine** is developed in [TypeScript](https://www.typescriptlang.org/) and bundled as a collection of [Webpack](https://webpack.js.org/) JavaScript libraries. Since version 1.9.0 the repository was organized as a [monorepo](https://en.wikipedia.org/wiki/Monorepo) that contains two separate packages, each optimized for different use cases.

> [!NOTE]
>
> - This branch has the ongoing development of **SceneGraph** support, and is being released as alpha preview. We have a lot of challenges ahead, feel free to reach out and learn how [you can help](docs/contributing.md).
> - Although **brs-engine** runs apps with user interface, it has no intention of emulating the full **Roku OS** or hardware devices, it is primarily aimed as a development tool for the **Roku Community**.
> - The **simulation engine** can also to be used as a framework for running **BrightScript** apps and games in other platforms, like iOS, macOS, Android, Linux and Windows.
> - Please check the [Current Limitations](docs/limitations.md) document for further details on what is still missing or out of scope.
> - This repository was originally a fork from [**brs**](https://github.com/rokucommunity/brs), a **BrightScript** _command line interpreter_.

## 📦 Browser Platforms Package

<p align="center"><img alt="Simulator Web and Desktop" title="Simulator Web and Desktop" src="docs/images/screenshots.png?raw=true"/></p>

### For web applications, browser extensions, and Electron apps

The browser package provides a complete BrightScript interpreter that runs directly in browser environments with full support for the BrightScript language up to Roku OS version 15.

- **Client-side execution** - No server required
- **Web Worker** - Interpreter runs in a Web Worker, optimized for browser performance
- **HTML5 Canvas rendering** - Full Draw 2D API support
- **Audio & Video** - Supports media playback via HTML5 Audio and Video elements
- **File System Simulation** - Virtual file system for Roku apps
- **BrightScript Micro Debugger** - Step-through debugging capabilities
- **Input Simulation** - Simulates remote control input for Roku apps both via keyboard and gamepad

### Installation

```bash
npm install brs-engine@alpha
```

[📖 Browser Package: More details](./packages/browser/README.md) | [🚀 Live Demo](https://lvcabral.com/brs) | [🧑‍💻 Code Playground](http://brsFiddle.net) | [🖥️ Desktop App](https://github.com/lvcabral/brs-desktop)

## 📦 Node.js and CLI Package

<p align="left"><img alt="Simulator CLI" title="Simulator CLI" src="docs/images/brs-cli.png?raw=true" width="500"/></p>

### For command-line tools, automation, and server-side execution

The Node.js package includes a complete CLI application, ECP and SSDP servers, and the Simulation Engine Node.js library that provides a powerful environment for running BrightScript applications in a server-side context or in test automation workflows.

- **Interactive REPL** - Command-line BrightScript shell
- **File Execution** - Run `.brs`, `.zip`, and `.bpk` files
- **ASCII Rendering** - Simulates `roScreen` and `roSGScreen` output in the terminal
- **ECP Server** - External Control Protocol implementation
- **Package Creation** - Build and encrypt `.bpk` files
- **CI/CD Integration** - Perfect for automated testing

### Installation

```bash
# for global CLI installation
npm install -g brs-node@alpha

# for project installation
npm install brs-node@alpha
```
[📖 Node.js Package: More details](./packages/node/README.md) | [⌨️ CLI Guide](./docs/run-as-cli.md)

## 📚 Project Documentation

There are many ways you can use and/or participate in the project, read the documents below to learn more:

- [How to build from source](docs/build-from-source.md)
- [How add the Engine to a Web Application](docs/integrating.md)
- [How to run as a Command Line Interface](docs/run-as-cli.md)
- [How to use the Node.js Library](docs/using-node-library.md)
- [How to customize the Engine behavior](docs/customization.md)
- [Remote Control Simulation](docs/remote-control.md)
- [BrightScript Engine API reference](docs/engine-api.md)
- [BrightScript Engine Limitations](docs/limitations.md)
- [How to contribute to this Project](docs/contributing.md)

### Changelog

- Click [here](CHANGELOG.md) to view the release changelog.

## 🔗 Developer Links

- My website: [https://lvcabral.com](https://lvcabral.com)
- My threads: [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My X/twitter: [@lvcabral](https://twitter.com/lvcabral)
- My podcast: [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## 📄 License

Copyright © 2019-2025 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](LICENSE) license.
