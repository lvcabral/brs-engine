# BRS-EMU: BrightScript Emulator

An emulator for the Roku BrightScript language that runs on modern browsers and Electron applications.

[![NPM Version](https://badge.fury.io/js/brs-emu.svg?style=flat)](https://npmjs.org/package/brs-emu)
[![Build](https://github.com/lvcabral/brs-emu/actions/workflows/webpack.yml/badge.svg)](https://github.com/lvcabral/brs-emu/actions/workflows/webpack.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)

## The Library

This library extends [**brs**](https://github.com/sjbarag/brs), a _command line interpreter_ for **BrightScript** language, with the objective of implementing a full emulator for the BrightScript developer community. Initially the focus was on the **Draw 2D API** components (`roScreen`, `roCompositor`, `roRegion`, etc.) along with most of the basic elements of the **BrightScript** language, allowing a full channel execution over an **HTML5 Canvas**, including emulation of the Roku file system, registry, remote control and the Micro Debugger. At this stage, **SceneGraph** channels and video playback are not supported, but the implementation of these features is now being considered.

**Note:** Although **brs-emu** runs channels with user interface, it has no intention of emulating the full **Roku OS**, it is primarily aimed as a development tool for the BrighScript Community. Please check the [Current Limitations](docs/limitations.md) documentation for further details on what is out of scope.

<p align="center">
<img alt="Emulator Web and Desktop" src="docs/images/screenshots.png?raw=true"/>
</p>

## Technology and Compatibility

This emulator is bundled as a couple of **[Webpack](https://webpack.js.org/)** Javascript libraries: 
- `brsEmu.js` the **[emulator API](docs/emulator-api.md)** to be used by the client application.
- `brsEmu.worker.js` the **[Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)** that runs the language interpreter in a background thread on the browser platform.

It uses features like [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) and [OffScreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), that are _bleeding edge_ in the browser engines, because of that, at this moment, it can only be executed in:
1. [Chromium](https://www.chromium.org/Home) based browsers, like [Chrome](https://www.google.com/chrome/), [Brave](https://brave.com/download/), [Opera](https://www.opera.com/) and [Edge](https://www.microsoft.com/en-us/edge).
1. [Electron](https://electronjs.org/) applications.
1. [Firefox](https://firefox.com), version 105 or higher.
1. [Safari](https://www.apple.com/safari/) (soon), version [16.4 Beta](https://developer.apple.com/safari/resources/) already supported. 

Note: The **BrightScript Emulator** is a full client-side library, nothing needs to be sent or processed in the server side.

 ## How to use it

If you just want to use the emulator, not installing or downloading anything, try the applications below:

* BrightScript TV - Run full emulated games and channels in your browser: https://lvcabral.com/brs
* brsFiddle - BrightScript playground to test and share code with others: http://brsFiddle.net

### Desktop Application

You can also run the emulator as a multi-platform **desktop application** (Windows, Linux & macOS) that uses the same library generated by this project. The app, introduces several aditional features, such as the **ECP** (External Control Protocol) and **Remote Console** servers to allow integration with 3rd party development tools like the [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript). It also allows you to control the device configuration like screen resolution, localization, among others.

#### Download Links

- Installation packages: [release page](https://github.com/lvcabral/brs-emu/releases). 
- Source code and documentation: [app repository](https://github.com/lvcabral/brs-emu-app).

## How to Integrate to my App
The **brs-emu** project is published as a `node` package, so use `npm`:

```shell
$ npm install brs-emu
```

or `yarn` if that's your preference:

```shell
$ yarn add brs-emu
```

### Documentation

There are many ways in which you can use and/or participate in the project, read documents below to know the details:

* [How to build from source](docs/build-from-source.md)
* [How add the Emulator to a Web Application](docs/integrating.md)
* [BrightScript Emulator API](docs/emulator-api.md)
* [How to contribute](docs/contributing.md)

## Notes for BrightScript Developers

You can see the debug messages from `print` statements in your code using the _browser or desktop app console_, just make sure you open the _Developer Tools (Ctrl+Shift+i)_ before loading your channel package or brs file. Exceptions from the emulator will be shown there too. 

If you added a break point (stop) in your code, you can also debug using the _browser console_, just send the commands using: `brsEmu.debug("help")`. For a better debugging experience, is recommended to use the emulator desktop app integrated with [VSCode](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript).

The Roku `registry` data is stored on the browser Local Storage and you can inspect it using the Developer Tools.

If your code does show an error in some scenario not listed on the [limitations documentation](docs/limitations.md), feel free to [open an issue](https://github.com/lvcabral/brs-emu/issues).

## Games and Demos

You can try the emulator by running one of the demonstration channels included in the repository, these are pre-configured as _clickable icons_ on `index.html`. In addition to those, you can load your own code, either as a single **.brs** file or a channel **.zip package**. Below there is a list of tested games that are publicly available with source code, download the `zip` files and have fun!

*   [Prince of Persia for Roku](https://github.com/lvcabral/Prince-of-Persia-Roku) port by Marcelo Lv Cabral - Download [zip file](https://github.com/lvcabral/Prince-of-Persia-Roku/releases/download/v0.18.3778/Prince-of-Persia-Roku-018.zip)
*   [Lode Runner for Roku](https://github.com/lvcabral/Lode-Runner-Roku) remake by Marcelo Lv Cabral - Download [zip file](https://github.com/lvcabral/Lode-Runner-Roku/releases/download/v0.18.707/Lode-Runner-Roku-018.zip)
*   [Retaliate](https://github.com/lvcabral/retaliate-roku) game by Romans I XVI - Download [zip file](https://github.com/lvcabral/retaliate-roku/releases/download/v1.7.0-emu/retaliate-brs-emu.zip)

## Author Links

- My website is [https://lvcabral.com](https://lvcabral.com)
- My twitter is [@lvcabral](https://twitter.com/lvcabral)
- My podcast is [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories ](https://github.com/lvcabral)

## License

Copyright © Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](LICENSE) license.
