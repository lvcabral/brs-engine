# BrightScript Simulation Engine

An intepreter for the BrightScript language that runs Roku apps on modern browser platforms.

![GitHub](https://img.shields.io/github/license/lvcabral/brs-engine)
[![NPM Version](https://badge.fury.io/js/brs-engine.svg?style=flat)](https://npmjs.org/package/brs-engine)
[![Build](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## The Project

This respository was created as a fork from [**brs**](https://github.com/rokucommunity/brs), a _command line interpreter_ for **BrightScript** language, with the objective of implementing a Roku simulator, an important tool that was missing for the **Roku** development community.

Initially the focus was on the **Draw 2D API** components (`roScreen`, `roCompositor`, `roRegion`, etc.) along with the core elements of the **BrightScript** language, allowing a full Roku app execution over an **HTML5 Canvas**, but it was extended to include simulation of the **Roku** file system, registry, remote control and the Micro Debugger.

**Important Notes:**

- At this stage, apps based on **SceneGraph** are not yet supported, but this feature is in the backlog to be implemented. Please check the [Current Limitations](docs/limitations.md) document for further details on what else is still missing and what is out of scope.
- Although **brs-engine** runs channels with user interface, it has no intention of emulating the full **Roku OS** or hardware devices, it is primarily aimed as a development tool for the **Roku Community**, and also to be used as a framework for running the **BrighScript** language in other platforms.<br /><br />

<p align="center"><img alt="Simulator Web and Desktop" title="Simulator Web and Desktop" src="docs/images/screenshots.png?raw=true"/></p>

## Technology and Compatibility

The **brs-engine** is developed in [TypeScript](https://www.typescriptlang.org/) and bundled as the following collection of [Webpack](https://webpack.js.org/) JavaScript libraries:

| Library File | Description |
| --- | --- |
| `app/lib/brs.api.js` | Provides the **[Engine API](docs/engine-api.md)** to be imported and used by the client applications hosting the Simulator.|
| `app/lib/brs.worker.js` | A **[Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)** library that runs the language parser and interpreter in a background thread on the browser platform.|
|`bin/brs.cli.js`| Executable **[CLI](docs/run-as-cli.md)** application that can be used from the terminal: <br/>- As a language shell - [REPL (read-eval-print loop)](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop)<br/>- Executing `brs`, `zip` or `bpk` files<br/>- Packaging `zip` files into encrypted `bpk` packages.|
|`bin/brs.ecp.js`| A **[NodeJS Worker](https://nodejs.org/api/worker_threads.html)** library, used by the CLI to launch the ECP and SSDP services.|

The Web Worker library require features like [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) and [OffScreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), that are _relatively recent_ in the browser engines, because of that, it can only be executed on recent versions of:

1. [Chromium](https://www.chromium.org/Home)/[Chrome](https://www.google.com/chrome) version 69 or newer.
1. [Chrome Android](https://www.google.com/chrome) version 89 or newer.
1. [Edge](https://www.microsoft.com/en-us/edge), version 79 or newer.
1. [Opera](https://www.opera.com), version 56 or newer.
1. [Firefox](https://firefox.com), version 105 or newer.
1. [Safari macOS/iOS/ipadOS](https://www.apple.com/safari), version 16.4 or newer.
1. [Electron](https://electronjs.org), version 4.0 or newer.

**Note:** The engine libraries are client-side only, nothing needs to be sent or processed in the server side.

## How to Use the Simulator

### Web Applications

This repository provides a sample web application you can build and run ([learn how](docs/integrating.md)), but if you just want to use the simulation engine, not installing or downloading anything, try one of the web applications below:

- **BrightScript TV** - Run full Roku games and apps in your browser: <https://lvcabral.com/brs>
- **brsFiddle** - BrightScript playground to test and share code with others: <http://brsFiddle.net>
  - Hello World - [Shared Link](https://brsfiddle.net?code=XQAAAALoAQAAAAAAAABJKoMFQkqVI3uU9GwRbyvC8VZIwGr1xxcorn5mLVHBqbYBRZrnQferacFYVXf-MZOo4bT-y0hoecSHWTc3N59pXIhyNOvVsKzC_7nNE-DmSnxEBbk1E9Awl3-ZNlgnG48X9F8HBwgnkZ5Q5UvrozNvOQxdXAMzfFlJdvB3MBxtd3TbLGtyGLYduwviICLK0N7GkhsZnJJssoQhajWMnVLYVvpNHT5OkWVu-_PxpfWxJ-ey-77iAeh-ooC6L7bGzHAMwljI63U5zcarI3AVXB9TQnsj5fbZT8oMiiEtsapDMcoOcqQF84fecgHc7GqK0y7gCFqIovRz9N03KJRXYM6_NY_BT8qbidI7UG7XdQJIEC24vOXkufqid_zZ6G9saWSnjNBW_hw_WQ)
  - Bouncing Square - [Shared Link](https://brsfiddle.net?code=XQAAAAJLCgAAAAAAAABJKobnoc8U-fMC7Yn0OmySA8M8XeYQjA-xlBhDmgkQqkyZorrnH8Z2n9OanRbQbS6T-zM3qPN3QH8Fzgr6UPhr5Cbo3rvloawPAr6qehd0XS8TPatky3-TLgFN_hIhDiNkxNg8livrXExKPdBlI1StdF_-qAzOZT6wC1xPKIJj2Sq8hKcRoNJYYH0Bc7y3vXJ1DTvcu9rAqps0k11Aj4tW_J_zSAHhhHD-zHJJTz1lYapWSGrBQHbhn5SMHQViWFzHfVMyo1Pxz8LUAjiUUHgtkOGpX14MRpCMTM85PbPhb8-KbGtaD4y6zaZgy7Q4zS8vtTxZ9QGHO1gsyGNWb01plO7Lk61lg9c6jOrKT4lJtn7mQme28XpLj5TQrGUbXGdw5lKu7TamErtcuypOxuBSMXVi9i_Ti874POAyL47IK7O5ZaBhBO1p5L2A6iQr6j1qzdmfd8N_9ZumCfxhd9XPg69t8sihYQVvI2vORW5vW_vxKQaDPlkjPyTdQtA903T2ZDiyKVXPpfElWsIntZqXdfg9aY0iXeyCV89LXf69WTkge8D4_dOPH8-ia5myHAXNyxi54k9qKwnkgpCDXTpTRdWB8AO_HuDn6AG5mddseP0uuDjZjbcYpwJRBBC5KJ4ocj8rH_bi5ZLCzRa9ryVdyrHwrDOpdwPRiUWsT7Cr9VEUuSPRctUp1amgHbIJKhLTTohiq3TvRAlItkP98bQhC5M_yTMnIyVjZsLrQWb5Q9MAa2VdwByE-pf4b3OF-SeGw5j-K7TOebCGz0yRNnF6zMHgUMPVYhRi9zNU5Mw_avQ0dCXMxtv9oU2_uKzkB0RCOMM6qJGSnTa4a6B0w8D_LbgLUNdbjVlAZCLpOPBl2DhR4VsV0R2zWlA5jqamY7wSeZb-CSsOdRJv30dXmt3bOKc__nYH8rYRcMlAZb4sT4aesdDh5Yx5bsWEGBjWV2Ojp34muGPJbVlkbhWOw0p0aip4dJ-jL9HfaO8zG_blhNCMsANapZ0VonnO1JaDR7cxeQeUDDpcskFPIu2DlIhLzQnGVFRRXUvU8UK97RQ0np_NQ8SUjcAoiMUNlA0HKjK3d06BKaALQwDwPGpCa1I2CksgPBrCt9f1H7csg_qmE-Bx79R0rehOLmorl_iiROXh0riaYyQlXnGwRR8K9lZJ-NU5iq6zaol5GjfdB5JRhWmzqVWFlOw9cvgI9KcWoCD5j5R1zINYsJVeMdQwLYc-LdEBfziGqS6HAyB-2fZoN_8u9gPwdI-kaKx8SCMHyiPOIhX1xk6DlY85qrLxL0LQJKf--0bS)
  - Calculate Easter Day - [Shared Link](https://brsfiddle.net?code=XQAAAAL2AwAAAAAAAABJKoUDU-eVDQnCIwGjL4bXrsOaRoDR7xUg7l7ATcAP2V7HvXEvU9p3zuMqYelSIckyYmoqSzPiR_yIJT_knVClROMTQ8ImmKudAnIwKv8WYKGGonwzgVUmLT0867k3otq0ZPQoV5mwSO1oRHzkHjvNCtuBfDH5wrogZOua4KltHWcJnxjl0B9yg82onvoaeBER6jlz1JgQoTBNQl7ZhTg01AoX450nozCe3nyd0BBXDG2it0PHgOg1UILanj2fdpsXuTi8BM14Vj9mmKhiaSk614HkwdEuWIhooOB_d9wRox3XJg21lF7OXupqgZBzZh3hAQa8MUqzSmpVX4dWe9FHkscztF0jbIc7gwmoUyOubjzcRA_3rZuM1AkQr4W4PMq_J63oF4el0DxVbFEbXK5h8stU078VCa_b9Ydi0OMsUY5I_o74zSN9SPD2pmojZTs6Fyh8Eo1vSsd3F_abdPvrOnxkKH1yCt59zo5zpVN144ihVYtaVE8MTZQc66is7A0GXfCNt7Ud592YNxSujFrQST2srrBxR6psz9xPdYhQBQd_ZzkK1J7ctVqHzfBM2tQNkn1Gp2-zBlaLjo1dlJ9Hj3zpcGK6N1VcUF7ptImWf0n2QvcTvo45Ml04CLN7WyNnyMPMBZkIEJAb3dyFwMVQNssvtncDGuAtsf2yxt4O9tjbAehdO-KOw9NXPKXiGQ1mUS7_PoudiVgThfqSrk20LX2fpdJ0Bc3QmeEhWzzOqrcri_-4fOLE)
  - Download Image and Music - [Shared Link](https://brsfiddle.net?code=XQAAAAKGCQAAAAAAAABJKoqngm5uKnfSsjl5UQrXmxd6cpL9ibQbDIH2ngkfAM04Aw7W933zvEnJjH04xwGX5MzE4NPnXXJ4R-S0N0Pke0auWD5rKMnq-kCEGc1xzCrQHpBvNufX5RuAZ-XVJ0pCFrcQxv8HOPL4K1KofrJuuuk1NQ3ov0LN9cGj2CQ2T0-RY8gMJK4JG1Gfe53uG3inR2SHLm6rU3entipqNEhWfFixB9H4C40LJgKeeibFjm4RBrYtZ8iomgkVuhpIyYxX2ag4YZvaUBpBFtyy6e6CLiVQmaCSNV0IqKdUci872aZls0WTpvIbX1KSDOCHpW4kDrF0yytMMR7yGnHEKFWsX8ddDwEhYKyRMtwOtYICzyFJ7BCe2jEd4FyaXuYsJ8HUfVrTx2Zul1hB-ejYRSpnoYabZkPVMTbS5gi2tzwSNEDuYLWXsMqq_ZIDiGQiejHWb3X6LOzv39qn-sEtvlhGv7N-fFb_hKp6AzPPdVxQqaCgRoTB-UmdfDSFckPmK8EEVrD9PjrfGx1CMGQm2AzD9hzzzaIMlDnRVHBe5xj2BSNeElVwEVhJ8l5n0qgElmUk8YPi0EjhF-00cGHVWs9Z2jaMZnbObeWb5oZMTQ2OXHGn08y91OG1-rpFsROc1VJe7XG6U95M7TZUwrWRdHK2XSNAVvFKtjLncLlQVZv_twvPzh0ODt0waxhFzc9W_uIJgK2ydXT_0vckVVmzbj1jIFAxCLvp4PbksrZDLoE3He9dQgqmJ7VlnuXVsmFbf4VL9WzKt52AY9B5jlXUlT6b33BfRnSVAcU7APCWih38ivLAPzxkSozpv-RKi2U7UVQsYJHIJm8-si4KeJ5GMSoOuF3Yagg5ZNUwf-sHevTyI3LGh1_hKJRhBHY2lZeRHKr0N-hTWQbXTSFbPY-Nf0kTrykdBNAX7OlmPrdfEMyah2IvNykyMrtQdCcD2DmyPIn5yFkTtYboDvTQPAOaXEoZdF6PzUMixyV_hu0VsuKKQvrxsrVeKtMxx2wDbmHMNWbNXNm5Rg4Avywq8g5bBr2rG86BPkA6bx2B_9m1GUcD1ovzxTaUpwu6p5WTOtnSvbg8sLV6TJfXqRgIm4evVFEv3Sh2zMx2hIKk0hXALe1z6Xn4_LbGyGKyxOeJtfSK12QF56KN-NsUQSMhIv2ucIrJYcYtE-MR8gH0ipvEfuyInRySWEhlsesN_27c__C4yiY)
  - Video Playback - [Shared Link](https://brsfiddle.net?code=XQAAAAKMCwAAAAAAAABJKoqngm5uKnfSsjl5UQrxThRucpL9ibQbDIH2ngkfAM04Aw7W933zvEnJjH0_TcYKuAb8pP4_pFUty4bsZ2ZGN6blI4HbCWU1o8kGuMYqVThNrDhiPIDtBh5rXeosnLR79JxTFgkSi4riS7OV1YxU2DSgn9ndUJMQTbe46AIqdpF3LfZnmkXgW4yR9Jd28iMajr1P6G7zSPRt0-hAg4owerHW0KUB0f10IyD_I-zwLEyjuVVjh5VYgE7r9pLU8r845lZ9-hnD0BibKqo7Fei_J_KCRVxMpeDmF-E3ZZdEgPjW5-rLUDn3dv0XDH6rKIuYdnx075Y4XefhFNACmnKFxvoi4mAIwczMbed3zSRLGWW7IqggC8HJ1rH_MDVp4gk_58cB_Bea5Wx6wFgZzrPmk5H8rO-dVkgpnJL7bevIMmyuCUlrrE_HLB2oopUMdnPggp3_s7xnoby6w6CJ4-gjkZYU-bDWC2pRztEk_DbISFmsy_OG_Pd8tTQrRBJGhZtSe2BsSziJ_9mePKvHH_yIjPeQjnR9tijZ6Q_ryDR8RVpuEFZRGJ6z6_kk_vZnFmYidHHBV_Oy_GmhQOpTRKe2htjfyN-pBZJw7Tu3VcTYmOILWPgJUpAbB8MkDj-c2BbWDogdsAgpZdSt_I40tpHDbvRp-vklV69_IUDIx5fquD1el8qPoDtUHblJZGKLHRvASj7lYTC4qGI-mg_IZpReBXMBLvd5VVHViQp-r7T4Y8W8pi7zZ7aqNci8ZXCXqLPyBLFwtEf-0ZICdAgmNjjFztjW217pOUEA4XIXRulcatttsH0VqMDB3y2tQv-pyVbXmSfpb_mgqG7HjfgfmYu4H0aV-Ifp3pwIz1tfk2nEHI90_rh081-lSZWTVT_kOznTwkAvjlLK8i4KzH-GS7jdlkhUW81Hz1ln6sy78NHI_MeqdnJqFzOpy24DX1qUaSyrThOd8_mvSRVcaQNFDJ1KgWimc-oZpD6MJQ1fbYFli9WHdpPhD7lI6OPlAP4dSfwf_sGLe9JHkjrrhCeXNI7dAF34raawlqZwAP2UXY0DQAJev-U2wJXHedkarK7KcLMmlYVFNOIE_bDQ-F0gJmifV7DR64js9WAQTI0NKnN7KP0v86lEF6ZoGxHlqy6bP_0NSmiNEi04UL5b7DKWRTjm2O7HlfKt-3E5AVn40noALDF_JvnykLL2l8BsYOHiQHZeh_p6sWvFLVqqK0JP7n21n6LUDa-lX6Jbjkv1A9XlXhfT2RZCeBrJW-c_d_QkRfqnlP3PKYazNGevfg3dfJHJczSET4jl3gVXXiJY__fIHPo)
  - API Call Example - [Shared Link](https://brsfiddle.net?code=XQAAAAKaDwAAAAAAAABJKoJnEhkACX8vDCmMt60KGGoNIX-9BnquVKbSjLc-L1DvpNbgtZS5eIQeJPrqKnZHKcPFPi-V2EYk0SJU-YlSJSWfr4hWs6qlQyn7uHA6iUTUopF3eDWTAHOhq0rKGfghXKHkc5aE2EhK_2wKGUprB5Y2dVgdJCc9PeacM021sytujkTuIIcrXJ6jFbnDu-wT-hR1MFYpSpbn8SiLlQ4IEaPch5rHXjd1YgwluF87--5cGQBgwMWjxZoc7Iyds5DoMRoIQbsiLYJBPERnExhKgpJrWSKcH_BtiBmFwA0oagupDSR1LeT83KMEGXFLiXpgd8QOcUh3L8KCNeei6PVRyaskp-FxXHZaBoaySTrKQo_cEwWpJ2-108EM38JYrgRRA_4Mn_Qyj-6-eGp1Nj3LVUVt_EeOJGi-cRiFx5nIIJfIclVqTL9C9Nuih-AMwR2ob2YQXxm7k2JsXQXuYdJLZKWLeIsMd3h0BolciLvAOn2OdnKM90fRtTQ110KATp1-Shf5Rn-HyOKr_HlaNp7OV3M9Ck-U0DE5dxDspTVmFdJSQJRNlaaZObo55BCjMm1hn831sPoH0jozMs1X2TyuSXnXs2zsUDhjERmRgaK9_wZR6yXreJ34XEFuvebjqyf6Fa0Ddk4uUQNJcij9VAXUhiTKKvdV0SLGnz4k_U5WNfEq5h0NGj38U7r2t_HPKFTULiOfsij9symsKNX0bILzoeuli9B0TqobKCT2g8wFQzDodtCYpKWGTr1EDOrFnVHA__jyZA98vB1VU0j_YJsDC7lNOslovfRCbmZ40wQ7dKoBtR3DaqWo5w6CVdGmsZHlBvE2C7mCznY6G2U5PwXX6aUSjvrrEpYmjcVd83UiptsJWcdtFTw_-Qr1qIcwSi0hC396b-rCWqsuCx12Znp1qA6F9GgDxYNuIutSP6sF0ptZ3Ruq12ulH-YDp0fw0Mc01YLtknHV-PPjjE1lLTyCkVxsgU5CfHLGgqAjDBoIv57t2KQex5idlemNuQ8VjFMBCCxMUeylyEuj-FZfiYX-bn1SBNPVXo50oMHoNwd4R-ikX4nSGk8sypT-MWbxcSc4PM0kJJ6-ERdTtu-Ip7Or4jmVGvLIEe8Lg-6BV0HwB2yrX2LY-o_Ns4abDHekFZCaJ4qhF-k5jsu9ltfnlaTeKOhOyhvk6shNsrLhLeWHRDB9CYneXM8S_9_8lj8ZSAThsFHbMy91tZfWo9_dVMzsZiM7xsuHEyavMQv9GvFIfEvQy0SyeTbPs-3AhQG5U_l3VvdNIyZzN3L6ApiQiV4XZgKR3jqXTYnonVBCmGNiaGJ5-9gtWQ2QaJs8MuGnYAV_pmoWugQpTtGpSPXG2rH9lvC9-GSW7RGWTAflasxAF2AU8PPRVCv2YyozaA5RizbUYpyZ9VrzehvIGBmznwwxhMLaFfiwFCLKmPle17OKhHdS1Sqzk6ya-OqbArBlkCooifrh7B0plHulf1TdZXWM7Xi5zhAskKoWZC4T6dDcO4aYFClxfOqzbldV84kunYEKxs1geTvYl1ei27N85RoX5h5besxzNGuVTRRHAXIfIEac7SHGx3hHx-gXDJc3zE_j3-L91cJVzdTdnhTCLYSqLTSalGa5ktY4H7ML57x_FhD2xMkQWaFUjl0fEaPX3m2N7QeErxFDzyxlC2yjZLCmTwsdz-I1OtRibKhZ8scjkadZD--C7bNHMXSr2t_J__dxH27Xe4JnK9lsZRa93YnGcCe3R23ICyRXvF0PGCkCBjvm4uZQsJvZzq7VQQ04FjaNcgAKanfFMIXFJSnrzimBdOWPIebb-7o727HHX6VzGE3vYpvM-Sx2nTKVySaDzev8u9x7hP_zLtDG)

### Desktop Application

The simulator is also available as a multi-platform **desktop application** (Windows, Linux & macOS) that uses the package published by this project. The application introduces several aditional Roku features, such as the **ECP** (External Control Protocol) and **Remote Console** servers to allow integration with tools like Telnet or [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=RokuCommunity.brightscript). You can also change the device configurations such as screen resolution, keyboard control customization, localization, among others. Download the installers and find more information in the links below:

- Source code and documentation: [app repository](https://github.com/lvcabral/brs-desktop).
- Architecture Overview: [diagram picture](https://github.com/lvcabral/brs-desktop/blob/master/docs/images/brs-desktop-architecture-overview.png).
- Installation packages: [release page](https://github.com/lvcabral/brs-desktop/releases).

## Project Documentation

There are many ways you can use and/or participate in the project, read the documents below to learn more:

- [How to build from source](docs/build-from-source.md)
- [How to run as Command Line Interface](docs/run-as-cli.md)
- [How add the Engine to a Web Application](docs/integrating.md)
- [How to customize the Engine behavior](docs/customization.md)
- [BrightScript Engine API reference](docs/engine-api.md)
- [BrightScript Engine Limitations](docs/limitations.md)
- [How to contribute to this Project](docs/contributing.md)

### Changelog

- Click [here](CHANGELOG.md) to view the release changelog.

## Developer Links

- My website: [https://lvcabral.com](https://lvcabral.com)
- My threads: [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My X/twitter: [@lvcabral](https://twitter.com/lvcabral)
- My podcast: [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## License

Copyright © 2019-2024 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](LICENSE) license.
