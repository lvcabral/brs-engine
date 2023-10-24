# BRS-EMU: BrightScript Emulator

An emulator for the Roku BrightScript language that runs on modern browsers and Electron applications.

![GitHub](https://img.shields.io/github/license/lvcabral/brs-emu)
[![NPM Version](https://badge.fury.io/js/brs-emu.svg?style=flat)](https://npmjs.org/package/brs-emu)
[![Build](https://github.com/lvcabral/brs-emu/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-emu/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)

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
1. [Safari](https://www.apple.com/safari/), version 16.4 or higher. 

Note: The **BrightScript Emulator** is a full client-side library, nothing needs to be sent or processed in the server side.

 ## How to use it

If you just want to use the emulator, not installing or downloading anything, try the applications below:

* BrightScript TV - Run full emulated games and channels in your browser: https://lvcabral.com/brs
* brsFiddle - BrightScript playground to test and share code with others: http://brsFiddle.net
  - Hello World - [Shared Link](https://lvcabral.com/brs-fiddle/?code=XQAAAALVAQAAAAAAAABJKobEQb6kyOTPdc30dpKp7qs4EFN2zkGnUPpC_jM5q9lOv48OWw73SRzoEiqBTjMAwA1j5B4lHJIEnt7v7wG6rbe_xFtOByeXbT3ddKuRA_9zOmIhmx3IpozpRxTXZixCFrHZlpFOzA1Wtba2-TtKbP5RPCZ3gD_GhZBzMlcM8AjeEqrLGmW7SL4wD26hJoq74g4lwGlaRad7DHU34538av8EyQVSoFX5UhC57h6H8CMgXZTKLJxYnFAZdTPhBuPedJ_x8FoTI4pV-6_sL1WixNNXyNeRXrcHoDTg5dGfeXwU9q4WkD2JwCOZ6A99YEh8qjkM6eGPT9d5U6qohbLL7OGEsJ4CQ6zn6yqG_71hqdWPJvqV6qTKEaD1iusxDbv_W-EYAA)
  - Bouncing Square - [Shared Link](https://brsfiddle.net/?code=XQAAAAIrEQAAAAAAAABJKocnAkqZmqFJVufERpQkf9KVk93fxmIRqnWDhwpkoNWGesOdd0NfqUQINBpHgpEwFE0OR1eAH7wa_jMdErSC0Ef6rWNCKA7QM7K-tYEah5tFpMmXnJglupGQccD85M9hTEo7RtutiOH7nQx0jpOyrhcPrtHzQA4-biFDUWkOLewpwh3KVNGdkIWlskO5MNh1rrex5e_N9S--J4xyUYV3ykTqocgnidX8ZYIFiQxb6J6GOW202zcXq8aWMgG-5R41nXEXigggzsTZXmLi13Xc6vsEVASb1mlaWHZlyAUU7hIhI-BvuJyDAEiWpmECFPSXVdLtdba-Hp4Q14J44MomrmpPXwI7ejX5PWKlW9TW7GdbI6kR1xTHv-SWNY7IulWCC_XXR1u11hlkAxkot6q7CUpuN3bJxWFyGL2WtiEu4htVubBbgZ4tcKR39TDePe9vNVkRbSwBDULMxlL4aHY7LxG6F4uiwj2UB1IjC7v3wQAtvIWpMN_U9Y5rJJlaPfZ5uAIN97HmQZ5Au3oonlSXGg2Edg2jPR3BG5Z8Bof_9-nR4YAa43N_w5HJWPnuLzsEITVY5svjES3ZroqUMyzwSW7dn3zdY_Gd24oWp4Ic3qWn5Fyjk-8Qw6ct4rK-q-mzkkF3rjXm5hUsWRKl_V_g7ESA51YmAlm0XWAWV6YyU3DcwGOKuE9fSYao2FzeUcDL-zYvI_AY7m34Mt5ZVQ0bu8x6vRnyMOs9bRQBLiiFw-Q-xJh0nka6Jtl-dC0me4MKeFfhCIWZq-2t78PPiPz-f2UZBZDerTi1jqJMFZ7rDrrJ0PSjPTi-t43qJ3Rrqi57AsyK7INo6wMFJZgPkcLkUcuDWjqD2QSEwJAFLyrdLWSkgl1PCCypEG0vHoDyqmGeWyCN5-TSb6ZgA51fln02CN-iBgm7cWNGaQ1--iwfd8n4gWVWzTh37_2J6buqPiNzsiDYdEVlRjeTocWiDx8ESYe7BbvLQ9AhqFWLWvzcc8EnH80gBimCK6-dJS58PtZrSmG_uVlpHP-UDAa67h0g5HHLP39mAh54zs5COmoRNqnIsTmFomDAUItoU7UI3djrTTp8ymEGwOzMi5qbLq6BCOs_LsasbT3eS132RnzpQ6eh_WdR-NjzijC9-LE6s4EeqwAueGMIvUJGnudHB7TcwemZ47vjsGTG14Y0p57VY1uzKGeJulkLJHi7VCWTV9a7ixdHxfPaRTwxYI1SGnS5DZEz65Hn1fMUjybGqJG1Rl_zuOcO9BeCBw0DF7gU7GbzwxaqGX3CV9RcCM0ggngxN50NgdKxOwSpSneI1t2AwY5FNlqnnvALfKqCOcP-xZgtgJeQyQg2a_h1wAZwOmX2evCM4k6JlqgCFCH0Ol_wz5ri4EyKhVzNFdtQdjLoprM0y9DAdRibs8LGsgwM3YKLezhCSK1O7Bz3udyCeIxBhx8aY8QeMB8nYqRFPARz5ulDGBDTnGB6wWW7UT3Hi5gj0No0ABIXsMot89yCR2EbE4FzAHM9kzn9sM7OfrmTOS2I1obIIbIPzI_HpnGGr2vAT7jyVqQlDis8Z8nwFastErVXG1sJYCoV7NYl78o_tXkwO73mZjxEDaFSDDuD5iFlIlYaAtN09Fs2sTev_DMJ3XkFBLeUcSUvSxEh2_dj5mYCVLSQ6T4ZJ5o7xRckRfHnZNpBrJ0lJT8K0PaQmwG1ZEXPgPjVk2_v4gIteee2W7Vwk0Jijy-hnN7y0q0lGlKkoke4vajaDl0ZWyNFWAo-KBYWXBnmzEkvapmWAI4qUZMP9a9unJpblNbYbHpmQzuKBTsX-H3GDWSsO6ePRuJJMiJGwSjYWdrbFIfKl5FZ7X66PwIcYvnzApikiIeB3TFef-BpQ2ea4QaaTmyselj4oISVVmL4TnAwKD0OCvH--kfPsX8f44VsGtA61fwmsbPZ3b2g_CFMe8AlhWI7fiKj4wfYA9k77fba1jPGuirRAQn_eSnsAA)
  - Calculate Easter Day - [Shared Link](https://brsfiddle.net/?code=XQAAAALnAwAAAAAAAABJKohmo_vGH6VeHhw0NA0u7jXQ5mXP9ZN1AWzM0PiRufiEJMb9enJ8-Fi-wVFZGTTpu3PmzKvDZVFq33L_93AZJPhIg6IOwt6LAoZfALbNSD-9F190OkUH5EOYSUHSLXWBpulCV_k83PxQO6WlKqWoMVq5LeUSoPEVV5OpcJLcDiu7O8XjE5KBBMmZgntg8nO44vkyJQNo_zE-k5zryxMYeZGHR71offjEvE3WrtKHLa55DMCeTrUqFoYZgd5t7DsddJ7Rl4ATmDgvrAOU7nY8nDjdrk1b7gccF1Hl_cgfXs1pjWGLzhGdoKrJ-UiokpUZ_p49EZy3-UQbqZ0IhBMNoHViYZJ4sVgZ0rZlexmlSB4zcmcpuHfc3cMRmUrGjr9zTg_Ulbh-OMcf5-DgHQqln58pmHCcCbIefiBntMjwIYn5yckUrS9RCRha1ZxuIYppHGpoj_2ilx1_zC9gs7kqwjCdk4QGJflduepky0fEvBQYvEHsjTHhNIBTRDiiqudQT8-62CokSMQqR1Zt5c-MUM1oFX8vdWennNziWnWoomzuMwQCAER5KYJZhOTKoBzuEM63KwqnZcBLsQoeoSs7tV5kcIXwhBGvUdDKESlfcqa-CwNBpAvENrUp7BBrrQOr6sKOnRUVL44Q4DEZzN_0_9sVDr25lTavElT57Xh2wRpiEsbmuoe66rKJ3cFP4OKVgMLUtPSkayntYNWPZg89PvidJpqOxTIQWf_nfRxV)
  - Download Image and Sound - [Shared Link](https://brsfiddle.net/?code=XQAAAAJqCQAAAAAAAABJKoMnQ-exSUWPG3fpxfwVM0I3_ROH-bzVbB7Jp09rkgEHk97O65LMrkY-ClFix02OAL9aQHdA6uHMp6VomRlb0EzSG23ee59pGlwA2DbEVNpCpCimia_7ffBTl-0p010UxxlLTCoMZ9xkzc-ZK8hxFih-i3P-nRWSdi82_7NwrrNelSDuJOdHfV28SNUbhHOULHLQ7f1EwhvrFr_vgpoksK6d-YKwnX6XWlNIlZrwulg0tclDcoxtRQawghOcZ3oTzmLTy0FuSIagck0NdcmdD-GAqqynbbR7Pb0jhFa4IK7RBM2lcVTjoH69laKA_CBKux6zj3VYBGAnz2lXtkI6dRfT_1XRSN7zkxNIJke8HWFZbyM1uc8s_kq7oPdwYBpvtkEfdHc96hiWZQMRpbdNRFa0Bx_1Jy5k-krINqCIe9489ZrPaend2fS191EBMIaCrzqcBrkNULQET0GcYBPJ5rhnr0sFT_knv4sPfD2HlYLc5h8xOBTxNgR8ex5COmRiI0xnHEgZmWP6fWSktG-gWH9Fk3nYb5xxt8VDvQuAOoeFsyxfucaRl5R2t5jRGN5dX8ECIa3T-Z_M_RIRXr8fWvUmdIwftjlkRYYJw-Imqc0phOMyLJnDIZGEodUavAvT5L7GaI4Qn_hFmxxyHaeMZw2HnDZPshIWfjSxzkcfuJyzx-X8ZeBcEq3ppDLCWkGml-GOSUDbVRd-LvDmSOVEa652DRrwpYskvsXvVxOxo_nbMyJlCyuYdTM0tU0DIXSd6frNSLciud6YrGX0b0JcbLs-c7Fy_flud8htvUNKD4ugdOqZJTxUHi8cjV6nD9aT3v5yj_C99p4r5H-UhK7qrRii9mbQbhHkEMNi4Zb4DIfntBK8p2GIIeaP--Mvo02v8o6ZBj9CbyOM-jpv1SfhZ8tyfXcw_3KoT_VgbuDseShlzToWgbkyBa-SzJFklEZPGteuysyFRSPnmgfFOKTZTpY92mxcQ9C8TZXt6Gbwj79AbplH6d0wKPl_uQiGmXVzj9LvIsYhuY3o-Pr2ZfZGBo4O4sMuQQ5ZA892cRuvrp_XRRKSEunIhWqBIgoSxiI1yp46twsZy2SQXpVISxFdHDJaDHMdMX4VBO33Oy1I8zlfQGPrHQxik8Szk-s6qkOpgaQnNNaLcE1v8LHpRMXSP5KxfwJm6PyWkGQ)

### Desktop Application

You can also run the emulator as a multi-platform **desktop application** (Windows, Linux & macOS) that uses the same library generated by this project. The app, introduces several aditional features, such as the **ECP** (External Control Protocol) and **Remote Console** servers to allow integration with 3rd party development tools like the [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript). It also allows you to control the device configuration like screen resolution, localization, among others.

#### Download Links

- Installation packages: [release page](https://github.com/lvcabral/brs-emu-app/releases). 
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
* [How to run as Command Line Interface](docs/run-as-cli.md)
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
