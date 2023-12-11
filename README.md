# BrightScript Simulation Engine

An intepreter for the Roku BrightScript language that runs games and apps on modern browser platforms.

![GitHub](https://img.shields.io/github/license/lvcabral/brs-emu)
[![NPM Version](https://badge.fury.io/js/brs-emu.svg?style=flat)](https://npmjs.org/package/brs-emu)
[![Build](https://github.com/lvcabral/brs-emu/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-emu/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## The Project

This project was created as a fork from [**brs**](@rokucommunity/brs), a _command line interpreter_ for **BrightScript** language, with the objective of implementing a Roku simulator, an important kind of tool that was missing for the BrightScript developer community. Initially the focus was on the **Draw 2D API** components (`roScreen`, `roCompositor`, `roRegion`, etc.) along with the core elements of the **BrightScript** language, allowing a full Roku app execution over an **HTML5 Canvas**, including simulation of the Roku file system, registry, remote control and the Micro Debugger.

**Important Notes:**

- At this stage, **SceneGraph** based apps and video playback are not yet supported, but the implementation of these features is now in the backlog. Please check the [Current Limitations](docs/limitations.md) document for further details on what else is missing and what is out of scope.
- Although **brs-engine** runs channels with user interface, it has no intention of emulating the full **Roku OS** or hardware devices, it is primarily aimed as a development tool for the BrighScript Community, and also to be used as an engine for running the BrighScript language in other platforms.<br /><br />

<p align="center"><img alt="Simulator Web and Desktop" src="docs/images/screenshots.png?raw=true"/></p>

## Technology and Compatibility

This engine is developed in [TypeScript](https://www.typescriptlang.org/) and bundled as a collection of [Webpack](https://webpack.js.org/) JavaScript libraries:

- `app/lib/brs.api.js`: Is the **[Engine API](docs/engine-api.md)** to be used by the client application to run the Simulator.
- `app/lib/brs.worker.js`: Is the **[Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)** that runs the language interpreter in a background thread on the browser platform.
- `bin/brs.cli.js`: Is the **[CLI](docs/run-as-cli.md)** application that can be executed from the terminal as a [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop), running `brs` files or packaging encrypted apps.

The worker library require features like [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) and [OffScreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), that are _relatively recent_ in the browser engines, because of that, it can only be executed on recent versions of:

1. [Chromium](https://www.chromium.org/Home) based browsers, like [Chrome](https://www.google.com/chrome), [Brave](https://brave.com), [Opera](https://www.opera.com) and [Edge](https://www.microsoft.com/en-us/edge), version 79 or newer.
1. [Electron](https://electronjs.org), version 6.0 or newer.
1. [Firefox](https://firefox.com), version 105 or newer.
1. [Safari](https://www.apple.com/safari), version 16.4 or newer.

**Note:** The **BrightScript Engine** is a full client-side library, nothing needs to be sent or processed in the server side.

## How to Use the Simulator

### Web Applications

This repository has has a sample web application you can build and install ([learn how](docs/integrating.md)), but if you just want to use the simulation engine, not installing or downloading anything, try one of the web applications below:

- **BrightScript TV** - Run full Roku games and apps in your browser: <https://lvcabral.com/brs>
- **brsFiddle** - BrightScript playground to test and share code with others: <http://brsFiddle.net>
  - Hello World - [Shared Link](https://lvcabral.com/brs-fiddle/?code=XQAAAALVAQAAAAAAAABJKobEQb6kyOTPdc30dpKp7qs4EFN2zkGnUPpC_jM5q9lOv48OWw73SRzoEiqBTjMAwA1j5B4lHJIEnt7v7wG6rbe_xFtOByeXbT3ddKuRA_9zOmIhmx3IpozpRxTXZixCFrHZlpFOzA1Wtba2-TtKbP5RPCZ3gD_GhZBzMlcM8AjeEqrLGmW7SL4wD26hJoq74g4lwGlaRad7DHU34538av8EyQVSoFX5UhC57h6H8CMgXZTKLJxYnFAZdTPhBuPedJ_x8FoTI4pV-6_sL1WixNNXyNeRXrcHoDTg5dGfeXwU9q4WkD2JwCOZ6A99YEh8qjkM6eGPT9d5U6qohbLL7OGEsJ4CQ6zn6yqG_71hqdWPJvqV6qTKEaD1iusxDbv_W-EYAA)
  - Bouncing Square - [Shared Link](https://brsfiddle.net/?code=XQAAAAIrEQAAAAAAAABJKocnAkqZmqFJVufERpQkf9KVk93fxmIRqnWDhwpkoNWGesOdd0NfqUQINBpHgpEwFE0OR1eAH7wa_jMdErSC0Ef6rWNCKA7QM7K-tYEah5tFpMmXnJglupGQccD85M9hTEo7RtutiOH7nQx0jpOyrhcPrtHzQA4-biFDUWkOLewpwh3KVNGdkIWlskO5MNh1rrex5e_N9S--J4xyUYV3ykTqocgnidX8ZYIFiQxb6J6GOW202zcXq8aWMgG-5R41nXEXigggzsTZXmLi13Xc6vsEVASb1mlaWHZlyAUU7hIhI-BvuJyDAEiWpmECFPSXVdLtdba-Hp4Q14J44MomrmpPXwI7ejX5PWKlW9TW7GdbI6kR1xTHv-SWNY7IulWCC_XXR1u11hlkAxkot6q7CUpuN3bJxWFyGL2WtiEu4htVubBbgZ4tcKR39TDePe9vNVkRbSwBDULMxlL4aHY7LxG6F4uiwj2UB1IjC7v3wQAtvIWpMN_U9Y5rJJlaPfZ5uAIN97HmQZ5Au3oonlSXGg2Edg2jPR3BG5Z8Bof_9-nR4YAa43N_w5HJWPnuLzsEITVY5svjES3ZroqUMyzwSW7dn3zdY_Gd24oWp4Ic3qWn5Fyjk-8Qw6ct4rK-q-mzkkF3rjXm5hUsWRKl_V_g7ESA51YmAlm0XWAWV6YyU3DcwGOKuE9fSYao2FzeUcDL-zYvI_AY7m34Mt5ZVQ0bu8x6vRnyMOs9bRQBLiiFw-Q-xJh0nka6Jtl-dC0me4MKeFfhCIWZq-2t78PPiPz-f2UZBZDerTi1jqJMFZ7rDrrJ0PSjPTi-t43qJ3Rrqi57AsyK7INo6wMFJZgPkcLkUcuDWjqD2QSEwJAFLyrdLWSkgl1PCCypEG0vHoDyqmGeWyCN5-TSb6ZgA51fln02CN-iBgm7cWNGaQ1--iwfd8n4gWVWzTh37_2J6buqPiNzsiDYdEVlRjeTocWiDx8ESYe7BbvLQ9AhqFWLWvzcc8EnH80gBimCK6-dJS58PtZrSmG_uVlpHP-UDAa67h0g5HHLP39mAh54zs5COmoRNqnIsTmFomDAUItoU7UI3djrTTp8ymEGwOzMi5qbLq6BCOs_LsasbT3eS132RnzpQ6eh_WdR-NjzijC9-LE6s4EeqwAueGMIvUJGnudHB7TcwemZ47vjsGTG14Y0p57VY1uzKGeJulkLJHi7VCWTV9a7ixdHxfPaRTwxYI1SGnS5DZEz65Hn1fMUjybGqJG1Rl_zuOcO9BeCBw0DF7gU7GbzwxaqGX3CV9RcCM0ggngxN50NgdKxOwSpSneI1t2AwY5FNlqnnvALfKqCOcP-xZgtgJeQyQg2a_h1wAZwOmX2evCM4k6JlqgCFCH0Ol_wz5ri4EyKhVzNFdtQdjLoprM0y9DAdRibs8LGsgwM3YKLezhCSK1O7Bz3udyCeIxBhx8aY8QeMB8nYqRFPARz5ulDGBDTnGB6wWW7UT3Hi5gj0No0ABIXsMot89yCR2EbE4FzAHM9kzn9sM7OfrmTOS2I1obIIbIPzI_HpnGGr2vAT7jyVqQlDis8Z8nwFastErVXG1sJYCoV7NYl78o_tXkwO73mZjxEDaFSDDuD5iFlIlYaAtN09Fs2sTev_DMJ3XkFBLeUcSUvSxEh2_dj5mYCVLSQ6T4ZJ5o7xRckRfHnZNpBrJ0lJT8K0PaQmwG1ZEXPgPjVk2_v4gIteee2W7Vwk0Jijy-hnN7y0q0lGlKkoke4vajaDl0ZWyNFWAo-KBYWXBnmzEkvapmWAI4qUZMP9a9unJpblNbYbHpmQzuKBTsX-H3GDWSsO6ePRuJJMiJGwSjYWdrbFIfKl5FZ7X66PwIcYvnzApikiIeB3TFef-BpQ2ea4QaaTmyselj4oISVVmL4TnAwKD0OCvH--kfPsX8f44VsGtA61fwmsbPZ3b2g_CFMe8AlhWI7fiKj4wfYA9k77fba1jPGuirRAQn_eSnsAA)
  - Calculate Easter Day - [Shared Link](https://brsfiddle.net/?code=XQAAAALnAwAAAAAAAABJKohmo_vGH6VeHhw0NA0u7jXQ5mXP9ZN1AWzM0PiRufiEJMb9enJ8-Fi-wVFZGTTpu3PmzKvDZVFq33L_93AZJPhIg6IOwt6LAoZfALbNSD-9F190OkUH5EOYSUHSLXWBpulCV_k83PxQO6WlKqWoMVq5LeUSoPEVV5OpcJLcDiu7O8XjE5KBBMmZgntg8nO44vkyJQNo_zE-k5zryxMYeZGHR71offjEvE3WrtKHLa55DMCeTrUqFoYZgd5t7DsddJ7Rl4ATmDgvrAOU7nY8nDjdrk1b7gccF1Hl_cgfXs1pjWGLzhGdoKrJ-UiokpUZ_p49EZy3-UQbqZ0IhBMNoHViYZJ4sVgZ0rZlexmlSB4zcmcpuHfc3cMRmUrGjr9zTg_Ulbh-OMcf5-DgHQqln58pmHCcCbIefiBntMjwIYn5yckUrS9RCRha1ZxuIYppHGpoj_2ilx1_zC9gs7kqwjCdk4QGJflduepky0fEvBQYvEHsjTHhNIBTRDiiqudQT8-62CokSMQqR1Zt5c-MUM1oFX8vdWennNziWnWoomzuMwQCAER5KYJZhOTKoBzuEM63KwqnZcBLsQoeoSs7tV5kcIXwhBGvUdDKESlfcqa-CwNBpAvENrUp7BBrrQOr6sKOnRUVL44Q4DEZzN_0_9sVDr25lTavElT57Xh2wRpiEsbmuoe66rKJ3cFP4OKVgMLUtPSkayntYNWPZg89PvidJpqOxTIQWf_nfRxV)
  - Download Image and Sound - [Shared Link](https://brsfiddle.net/?code=XQAAAAJqCQAAAAAAAABJKoMnQ-exSUWPG3fpxfwVM0I3_ROH-bzVbB7Jp09rkgEHk97O65LMrkY-ClFix02OAL9aQHdA6uHMp6VomRlb0EzSG23ee59pGlwA2DbEVNpCpCimia_7ffBTl-0p010UxxlLTCoMZ9xkzc-ZK8hxFih-i3P-nRWSdi82_7NwrrNelSDuJOdHfV28SNUbhHOULHLQ7f1EwhvrFr_vgpoksK6d-YKwnX6XWlNIlZrwulg0tclDcoxtRQawghOcZ3oTzmLTy0FuSIagck0NdcmdD-GAqqynbbR7Pb0jhFa4IK7RBM2lcVTjoH69laKA_CBKux6zj3VYBGAnz2lXtkI6dRfT_1XRSN7zkxNIJke8HWFZbyM1uc8s_kq7oPdwYBpvtkEfdHc96hiWZQMRpbdNRFa0Bx_1Jy5k-krINqCIe9489ZrPaend2fS191EBMIaCrzqcBrkNULQET0GcYBPJ5rhnr0sFT_knv4sPfD2HlYLc5h8xOBTxNgR8ex5COmRiI0xnHEgZmWP6fWSktG-gWH9Fk3nYb5xxt8VDvQuAOoeFsyxfucaRl5R2t5jRGN5dX8ECIa3T-Z_M_RIRXr8fWvUmdIwftjlkRYYJw-Imqc0phOMyLJnDIZGEodUavAvT5L7GaI4Qn_hFmxxyHaeMZw2HnDZPshIWfjSxzkcfuJyzx-X8ZeBcEq3ppDLCWkGml-GOSUDbVRd-LvDmSOVEa652DRrwpYskvsXvVxOxo_nbMyJlCyuYdTM0tU0DIXSd6frNSLciud6YrGX0b0JcbLs-c7Fy_flud8htvUNKD4ugdOqZJTxUHi8cjV6nD9aT3v5yj_C99p4r5H-UhK7qrRii9mbQbhHkEMNi4Zb4DIfntBK8p2GIIeaP--Mvo02v8o6ZBj9CbyOM-jpv1SfhZ8tyfXcw_3KoT_VgbuDseShlzToWgbkyBa-SzJFklEZPGteuysyFRSPnmgfFOKTZTpY92mxcQ9C8TZXt6Gbwj79AbplH6d0wKPl_uQiGmXVzj9LvIsYhuY3o-Pr2ZfZGBo4O4sMuQQ5ZA892cRuvrp_XRRKSEunIhWqBIgoSxiI1yp46twsZy2SQXpVISxFdHDJaDHMdMX4VBO33Oy1I8zlfQGPrHQxik8Szk-s6qkOpgaQnNNaLcE1v8LHpRMXSP5KxfwJm6PyWkGQ)

### Desktop Application

The simulator is also available as a multi-platform **desktop application** (Windows, Linux & macOS) that uses the package published by this project. The application, introduces several aditional Roku features, such as the **ECP** (External Control Protocol) and **Remote Console** servers to allow integration with dev tools like the Terminal or [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=RokuCommunity.brightscript). It also allows you to control the device configurations such as screen resolution, keyboard control customization, localization, among others. You can download the installers and find more information in the links below:

- Source code and documentation: [app repository](https://github.com/lvcabral/brs-emu-app).
- Installation packages: [release page](https://github.com/lvcabral/brs-emu-app/releases).

## Project Documentation

There are many ways you can use and/or participate in the project, read the documents below to learn more:

- [How to build from source](docs/build-from-source.md)
- [How to run as Command Line Interface](docs/run-as-cli.md)
- [How add the Engine to a Web Application](docs/integrating.md)
- [BrightScript Engine API reference](docs/emulator-api.md)
- [BrightScript Engine Limitations](docs/limitations.md)
- [How to contribute to this Project](docs/contributing.md)

## Developer Links

- My website is [https://lvcabral.com](https://lvcabral.com)
- My threads is [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky is [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My twitter is [@lvcabral](https://twitter.com/lvcabral)
- My podcast is [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## License

Copyright © Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](LICENSE) license.
