# BrightScript Simulation Engine for Web

An interpreter for the BrightScript language that runs Roku apps in browser-based platforms.

[![NPM Version (with dist tag)](https://img.shields.io/npm/v/brs-engine/alpha?logo=npm&label=brs-engine&color=blue)](https://npmjs.org/package/brs-engine?activeTab=versions)
[![License](https://img.shields.io/github/license/lvcabral/brs-engine?logo=github)](https://github.com/lvcabral/brs-engine/blob/master/LICENSE)
[![Build](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml/badge.svg)](https://github.com/lvcabral/brs-engine/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lvcabral_brs-emu&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lvcabral_brs-emu)
[![Slack](https://img.shields.io/badge/Slack-RokuCommunity-4A154B?logo=slack)](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)

## Overview

The **BrightScript Simulation Engine** provides a complete BrightScript interpreter that runs directly in web browsers, allowing [Roku apps](https://developer.roku.com/overview) to be executed in web applications, PWAs and Electron applications.
This package includes a **Web Worker** library and an **Engine API** library for embedding the interpreter into web applications.
> 🚨 Important:
>
> Since v1.9.1, this package no longer brings the **CLI** app and **Node.js** libraries for the **simulation engine**, for those use cases we created the new [brs-node](https://www.npmjs.com/package/brs-node) package. Check it out!

<p align="center"><img alt="Simulator Web and Desktop" title="Simulator Web and Desktop" src="https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/images/screenshots.png?raw=true"/></p>

## Key Features

### 🌐 Web Browser Support

- **Client-side only** - No server required
- Runs in modern web browsers using **Web Workers**
- Full **HTML5 Canvas** rendering support
- Audio and video playback via HTML5 elements
- Release your Roku apps as web applications, PWAs or Electron apps

### ⚙️ BrightScript Interpreter

- Full BrightScript language interpreter, with specs aligned up to Roku OS 15.0
- **Draw 2D API** - Full support for the BrightScript 2D drawing components
- **SceneGraph Framework** - Experimental support for the BrightScript SceneGraph components
- **Video Playback** - Via `roVideoPlayer`
- **Audio Playback** - Via `roAudioResources` and `roAudioPlayer`
- **Image Processing** - Support for PNG, JPEG, GIF, BMP and WEBP formats

### 📺 Device Simulation

- **Screen resolutions** - Support for various Roku display modes
- **Input Handling** - Keyboard and gamepad simulation for remote control input, see [docs](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/remote-control.md) for more details
- **File System Simulation** - Including `pkg:/`, `tmp:/`, `cachefs:/`, `common:/` and `ext1:/` volumes
- **Registry simulation** - Roku device registry emulation saved on browser local storage
- **Micro Debugger** - Step-through debugging capabilities, similar to the Roku experience
- **Localization** - Language and region settings
- **Customization** - You can customize device features and behaviors, see [docs](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/customization.md) for more details

> ⚠️ Note:
>
> **SceneGraph** support is currently under development in this branch, with pre-release **alpha** versions available for testing. See the current state of the SceneGraph implementation and other limitations of the **engine** in the [Current Limitations](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/limitations.md) document.

## Installation

```bash
npm install brs-engine@alpha
```

### Libraries

| Library File | Description |
| --- | --- |
| `libs/brs.api.js` | The **[Engine API](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/engine-api.md)** library to be imported and used by the applications hosting the Simulator. |
| `libs/brs.worker.js` | A **[Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)** library that runs the language interpreter in a background thread on the browser platform. |

### Compatibility

The Web Worker library require features like [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) and [OffScreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), that are _relatively recent_ in the browser engines, because of that, it can only be executed on the following versions of the major browsers:

- [Chromium](https://www.chromium.org/Home)/[Chrome](https://www.google.com/chrome) version 69 or newer.
- [Chrome Android](https://www.google.com/chrome) version 89 or newer.
- [Edge](https://www.microsoft.com/en-us/edge), version 79 or newer.
- [Opera](https://www.opera.com), version 56 or newer.
- [Firefox](https://firefox.com), version 105 or newer.
- [Safari macOS/iOS/ipadOS](https://www.apple.com/safari), version 16.4 or newer.
- [Electron](https://electronjs.org), version 4.0 or newer.

## Documentation and Applications

This package repository provides a sample web application you can quickly run and test the engine, check the docs to learn more:

- [How to integrate the engine to your app](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/integrating.md)
- [How to customize the Engine behavior](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/customization.md)
- [Simulation Engine API Reference](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/engine-api.md)
- [Remote Control Simulation](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/remote-control.md)
- [How to build from source](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/build-from-source.md)
- [How to contribute to this Project](https://github.com/lvcabral/brs-engine/tree/scenegraph/docs/contributing.md)

### Changelog

- Read the [project changelog](https://github.com/lvcabral/brs-engine/tree/scenegraph/CHANGELOG.md) to view the release notes.

### Live Web Applications

Try the engine in action with these web applications:

- **BrightScript TV** - A demo web application to run full Roku games and apps: https://lvcabral.com/brs
- **brsFiddle** - BrightScript playground to test and share code with your friends: <http://brsFiddle.net>
  - Hello World - [Shared Link](https://brsfiddle.net?code=XQAAAAL1AQAAAAAAAABJKoLnIqZU8B3-6dP2NsOmYLl2BuS_zvKqVwuCb900INmQka2JaG6109nguctrC4j5eeejusZdPZeqN7ODPGAHtZa3CitoUr0Lzf0CNfBMe_fKYxZVbBd3SFCx2pochQ8vXiLaMlX28Cc1xvIyR03lxJtEM3BO0wVuiOYr28HsPq0Yh-7QOe8y1A-TeWsDOMOEQO0YDxB86jAP7EXurCri8pscM-e70RBruCRmIlFupFBKRsE2GneP6qIr0cz0r69DJ9xuBnscqSBt8CvQFz5haqlrzi9T-BRs4qM1qQid4peKgfvF6s9QEy9nHMwtR_YJMI-5PBvHmU0E4knAAMoNG-Sy1UydLH0sb8RiwTn9IajExgUnwz89MTn5AWfJx2KPUY5QPhpAyFDZnR1H_-j54Fw)
  - Bouncing Square - [Shared Link](https://brsfiddle.net?code=XQAAAAJLCgAAAAAAAABJKobnoc8U-fMC7Yn0OmySA8M8XeYQjA-xlBhDmgkQqkyZorrnH8Z2n9OanRbQbS6T-zM3qPN3QH8Fzgr6UPhr5Cbo3rvloawPAr6qehd0XS8TPatky3-TLgFN_hIhDiNkxNg8livrXExKPdBlI1StdF_-qAzOZT6wC1xPKIJj2Sq8hKcRoNJYYH0Bc7y3vXJ1DTvcu9rAqps0k11Aj4tW_J_zSAHhhHD-zHJJTz1lYapWSGrBQHbhn5SMHQViWFzHfVMyo1Pxz8LUAjiUUHgtkOGpX14MRpCMTM85PbPhb8-KbGtaD4y6zaZgy7Q4zS8vtTxZ9QGHO1gsyGNWb01plO7Lk61lg9c6jOrKT4lJtn7mQme28XpLj5TQrGUbXGdw5lKu7TamErtcuypOxuBSMXVi9i_Ti874POAyL47IK7O5ZaBhBO1p5L2A6iQr6j1qzdmfd8N_9ZumCfxhd9XPg69t8sihYQVvI2vORW5vW_vxKQaDPlkjPyTdQtA903T2ZDiyKVXPpfElWsIntZqXdfg9aY0iXeyCV89LXf69WTkge8D4_dOPH8-ia5myHAXNyxi54k9qKwnkgpCDXTpTRdWB8AO_HuDn6AG5mddseP0uuDjZjbcYpwJRBBC5KJ4ocj8rH_bi5ZLCzRa9ryVdyrHwrDOpdwPRiUWsT7Cr9VEUuSPRctUp1amgHbIJKhLTTohiq3TvRAlItkP98bQhC5M_yTMnIyVjZsLrQWb5Q9MAa2VdwByE-pf4b3OF-SeGw5j-K7TOebCGz0yRNnF6zMHgUMPVYhRi9zNU5Mw_avQ0dCXMxtv9oU2_uKzkB0RCOMM6qJGSnTa4a6B0w8D_LbgLUNdbjVlAZCLpOPBl2DhR4VsV0R2zWlA5jqamY7wSeZb-CSsOdRJv30dXmt3bOKc__nYH8rYRcMlAZb4sT4aesdDh5Yx5bsWEGBjWV2Ojp34muGPJbVlkbhWOw0p0aip4dJ-jL9HfaO8zG_blhNCMsANapZ0VonnO1JaDR7cxeQeUDDpcskFPIu2DlIhLzQnGVFRRXUvU8UK97RQ0np_NQ8SUjcAoiMUNlA0HKjK3d06BKaALQwDwPGpCa1I2CksgPBrCt9f1H7csg_qmE-Bx79R0rehOLmorl_iiROXh0riaYyQlXnGwRR8K9lZJ-NU5iq6zaol5GjfdB5JRhWmzqVWFlOw9cvgI9KcWoCD5j5R1zINYsJVeMdQwLYc-LdEBfziGqS6HAyB-2fZoN_8u9gPwdI-kaKx8SCMHyiPOIhX1xk6DlY85qrLxL0LQJKf--0bS)
  - Calculate Easter Day - [Shared Link](https://brsfiddle.net?code=XQAAAAL2AwAAAAAAAABJKoUDU-eVDQnCIwGjL4bXrsOaRoDR7xUg7l7ATcAP2V7HvXEvU9p3zuMqYelSIckyYmoqSzPiR_yIJT_knVClROMTQ8ImmKudAnIwKv8WYKGGonwzgVUmLT0867k3otq0ZPQoV5mwSO1oRHzkHjvNCtuBfDH5wrogZOua4KltHWcJnxjl0B9yg82onvoaeBER6jlz1JgQoTBNQl7ZhTg01AoX450nozCe3nyd0BBXDG2it0PHgOg1UILanj2fdpsXuTi8BM14Vj9mmKhiaSk614HkwdEuWIhooOB_d9wRox3XJg21lF7OXupqgZBzZh3hAQa8MUqzSmpVX4dWe9FHkscztF0jbIc7gwmoUyOubjzcRA_3rZuM1AkQr4W4PMq_J63oF4el0DxVbFEbXK5h8stU078VCa_b9Ydi0OMsUY5I_o74zSN9SPD2pmojZTs6Fyh8Eo1vSsd3F_abdPvrOnxkKH1yCt59zo5zpVN144ihVYtaVE8MTZQc66is7A0GXfCNt7Ud592YNxSujFrQST2srrBxR6psz9xPdYhQBQd_ZzkK1J7ctVqHzfBM2tQNkn1Gp2-zBlaLjo1dlJ9Hj3zpcGK6N1VcUF7ptImWf0n2QvcTvo45Ml04CLN7WyNnyMPMBZkIEJAb3dyFwMVQNssvtncDGuAtsf2yxt4O9tjbAehdO-KOw9NXPKXiGQ1mUS7_PoudiVgThfqSrk20LX2fpdJ0Bc3QmeEhWzzOqrcri_-4fOLE)
  - Download Image and Music - [Shared Link](https://brsfiddle.net?code=XQAAAAKGCQAAAAAAAABJKoqngm5uKnfSsjl5UQrXmxd6cpL9ibQbDIH2ngkfAM04Aw7W933zvEnJjH04xwGX5MzE4NPnXXJ4R-S0N0Pke0auWD5rKMnq-kCEGc1xzCrQHpBvNufX5RuAZ-XVJ0pCFrcQxv8HOPL4K1KofrJuuuk1NQ3ov0LN9cGj2CQ2T0-RY8gMJK4JG1Gfe53uG3inR2SHLm6rU3entipqNEhWfFixB9H4C40LJgKeeibFjm4RBrYtZ8iomgkVuhpIyYxX2ag4YZvaUBpBFtyy6e6CLiVQmaCSNV0IqKdUci872aZls0WTpvIbX1KSDOCHpW4kDrF0yytMMR7yGnHEKFWsX8ddDwEhYKyRMtwOtYICzyFJ7BCe2jEd4FyaXuYsJ8HUfVrTx2Zul1hB-ejYRSpnoYabZkPVMTbS5gi2tzwSNEDuYLWXsMqq_ZIDiGQiejHWb3X6LOzv39qn-sEtvlhGv7N-fFb_hKp6AzPPdVxQqaCgRoTB-UmdfDSFckPmK8EEVrD9PjrfGx1CMGQm2AzD9hzzzaIMlDnRVHBe5xj2BSNeElVwEVhJ8l5n0qgElmUk8YPi0EjhF-00cGHVWs9Z2jaMZnbObeWb5oZMTQ2OXHGn08y91OG1-rpFsROc1VJe7XG6U95M7TZUwrWRdHK2XSNAVvFKtjLncLlQVZv_twvPzh0ODt0waxhFzc9W_uIJgK2ydXT_0vckVVmzbj1jIFAxCLvp4PbksrZDLoE3He9dQgqmJ7VlnuXVsmFbf4VL9WzKt52AY9B5jlXUlT6b33BfRnSVAcU7APCWih38ivLAPzxkSozpv-RKi2U7UVQsYJHIJm8-si4KeJ5GMSoOuF3Yagg5ZNUwf-sHevTyI3LGh1_hKJRhBHY2lZeRHKr0N-hTWQbXTSFbPY-Nf0kTrykdBNAX7OlmPrdfEMyah2IvNykyMrtQdCcD2DmyPIn5yFkTtYboDvTQPAOaXEoZdF6PzUMixyV_hu0VsuKKQvrxsrVeKtMxx2wDbmHMNWbNXNm5Rg4Avywq8g5bBr2rG86BPkA6bx2B_9m1GUcD1ovzxTaUpwu6p5WTOtnSvbg8sLV6TJfXqRgIm4evVFEv3Sh2zMx2hIKk0hXALe1z6Xn4_LbGyGKyxOeJtfSK12QF56KN-NsUQSMhIv2ucIrJYcYtE-MR8gH0ipvEfuyInRySWEhlsesN_27c__C4yiY)
  - Video Playback - [Shared Link](https://brsfiddle.net?code=XQAAAAKMCwAAAAAAAABJKoqngm5uKnfSsjl5UQrxThRucpL9ibQbDIH2ngkfAM04Aw7W933zvEnJjH0_TcYKuAb8pP4_pFUty4bsZ2ZGN6blI4HbCWU1o8kGuMYqVThNrDhiPIDtBh5rXeosnLR79JxTFgkSi4riS7OV1YxU2DSgn9ndUJMQTbe46AIqdpF3LfZnmkXgW4yR9Jd28iMajr1P6G7zSPRt0-hAg4owerHW0KUB0f10IyD_I-zwLEyjuVVjh5VYgE7r9pLU8r845lZ9-hnD0BibKqo7Fei_J_KCRVxMpeDmF-E3ZZdEgPjW5-rLUDn3dv0XDH6rKIuYdnx075Y4XefhFNACmnKFxvoi4mAIwczMbed3zSRLGWW7IqggC8HJ1rH_MDVp4gk_58cB_Bea5Wx6wFgZzrPmk5H8rO-dVkgpnJL7bevIMmyuCUlrrE_HLB2oopUMdnPggp3_s7xnoby6w6CJ4-gjkZYU-bDWC2pRztEk_DbISFmsy_OG_Pd8tTQrRBJGhZtSe2BsSziJ_9mePKvHH_yIjPeQjnR9tijZ6Q_ryDR8RVpuEFZRGJ6z6_kk_vZnFmYidHHBV_Oy_GmhQOpTRKe2htjfyN-pBZJw7Tu3VcTYmOILWPgJUpAbB8MkDj-c2BbWDogdsAgpZdSt_I40tpHDbvRp-vklV69_IUDIx5fquD1el8qPoDtUHblJZGKLHRvASj7lYTC4qGI-mg_IZpReBXMBLvd5VVHViQp-r7T4Y8W8pi7zZ7aqNci8ZXCXqLPyBLFwtEf-0ZICdAgmNjjFztjW217pOUEA4XIXRulcatttsH0VqMDB3y2tQv-pyVbXmSfpb_mgqG7HjfgfmYu4H0aV-Ifp3pwIz1tfk2nEHI90_rh081-lSZWTVT_kOznTwkAvjlLK8i4KzH-GS7jdlkhUW81Hz1ln6sy78NHI_MeqdnJqFzOpy24DX1qUaSyrThOd8_mvSRVcaQNFDJ1KgWimc-oZpD6MJQ1fbYFli9WHdpPhD7lI6OPlAP4dSfwf_sGLe9JHkjrrhCeXNI7dAF34raawlqZwAP2UXY0DQAJev-U2wJXHedkarK7KcLMmlYVFNOIE_bDQ-F0gJmifV7DR64js9WAQTI0NKnN7KP0v86lEF6ZoGxHlqy6bP_0NSmiNEi04UL5b7DKWRTjm2O7HlfKt-3E5AVn40noALDF_JvnykLL2l8BsYOHiQHZeh_p6sWvFLVqqK0JP7n21n6LUDa-lX6Jbjkv1A9XlXhfT2RZCeBrJW-c_d_QkRfqnlP3PKYazNGevfg3dfJHJczSET4jl3gVXXiJY__fIHPo)
  - API Call Example - [Shared Link](https://brsfiddle.net?code=XQAAAAKDEAAAAAAAAABJKotFIyJTtYn-qlq_R7JJF5alJytQ-ukFasPfytMYIZwnWfTlg9zXrp5bJJXqfYTKfzTV47CRJDpi3IcBcVXiHNSMn59_J7Qhs7_oXHNpJn-txA-iu3s-jGt5ear9zuwGQkCafWzHJg-q_pGp-kDavfBiSjDJJvwVeOsi_H9PW0Bhxoywsc9eABYR9Gw7re5gGWQDnwbigwhWCwnEQ-3BE6550fjnLdGODDiPY5pNZdOTPd01CLJnquhAdDZy8MgPc-jqAkO0VARvVr5Kysy7qSygtw_V_mNFs5gMw7qXbWu0tTao9ePNZZH78dgFAQSKnqZoq7_S3lUtux3c2bkMbpzT2if20fJ420fVVuT5gAwBOVGbDLvn7jtx0W7sUs6ovhSgI_0qBgwViCLjy-QuZ_Ca5QFkfRXLxWhOv9kE4AWLruPpdT5u9qFmzruBqzF_Tl8KcWHaT5lqFyqumCUoZgpADWuOsbXp_4dkKHpab1ZTFLQ3S0-DzrLz0A8QFYmUCdC4omGp63s80wbG9ei3WqDOqy-2sEkJAJYwcTXe12QPrDpHrf6Ov8pLbWwzDCr5gBqigE2PF7ISXQYr6iZfyhoHHgXS2vMO1BHHHNXV2kwrUmHzGSz2xOHfLDXb_pApUAtBCWcujidCf1UyDcyfItdcxfIkV0iQEUw9mAOXvtQGh0NSEvc8EcW6kT8EJvCDA9BXHnxCaD-cpvbR60bGvWW4XGO90TN32nHDFdbbYAXnlsi9tWgLtYbKdcX6q1VtfKV9raIU-VYAUXczq0w2Y_CKNknBAvmtufo2g7rBH9Wa5K1L91W4sdZ5ZMG0IsJkW4nX44HVzDo-rfcQqPG2-8yR78T29EVx26qVAqbi2lRxhPdGlDZR3du6lg0wBGbKB2-KRXPdShgN8CoTRsrs3mSmJXFgWa23P9ovO4W_vmbex4xjMOSJafbP9Q6nK4rltS5f6njXiAG-t5JtBT7y0dx6_WXBwDOTHdhBocrEFMdAoDVHoec6_ILiiKdbYhcMU7pQzjneBiGPgXhTnBXVTDx7vfYUB8b_AgzqT366V_tAHwIvl7BBBkN1L1FoH2CUD9PhkR7r4QHN4hfgZ3n7Ng9qI2pVilgfgcq_KEWR3FB8KNdns1J50W7SYuZ1WA8PMopCNZYevDeSZDOlIXAv01MztGsayTeVbQFeF7aTLC9uUMibiBpEJHVPVncfQyvRRiWvB0mJf3fQanGcuR_Tt9KTxxZl46jrFmY1iuT_pOWytLwuix53ko01X1gcRRXQAZpC1as7IHO9hFVI7VKGRII7Qc1aMLGMUln6PtTTNWzGwU8bQVFco_7BBiDghblJ6JmBd6PCOKZT_cQWMc5i2BdWLAxh3dr0Yq2GsNHPh1iATvPSBH71oKIdiur2N0gQMdrGxKKwrZLxzsUX_5CVDO4JLIWMITEtSYwAAXTeJ0gnBQoATVGO7xf5G58pr3jkRKk1NfdkzcU7rqSNuGEvyRfRqJC-fjgTwURUDEm7VGJ0J1Gapyw6X3tP92V9jyfpCtS4pKAIk-qV_xOSDaM03nAQPPN2cLsVY72yUV-AiZrrDxcrpLkvUysqGfGQybUYmZhjxabohC8tRvO-OAH2AphQiUzEo5gw-MMpfiwoeEh3j1HaufaHffpBRX-SK4RnJS7g-za4cwwGKOCoI8WKYpv-U8IrPIPEr7F8uxyqbWa85-CXJ5_f0VEjOy16XQ5gOc6ZxZfF57GF8spiEY4RqB1V3SMiSj3doH8-IGFw4ND5GVlct5AKf-KBb7hgWRJ41jA4xnl6QYIFS3iyuL3yEsWjSxLyG_XIZEE85iNZDldpBBgzgYKLxukTQUqHR6wbY3GJ9LeZcWKtOw9_Bej_WTKFbF3uUevfQfBpvpQjFTj7Kz9bkAU1ceSWBXLheGp11b8uKiTKkup-OIMWoy775O2fQ7egtANDYFUAJ2kpCtQExo62bT2Z9ahpLFHECFxJZaRqMnGCzJLPqLgdUlONKlbPKnIP__IaUaU)
  - Snake Game - [Shared Link](https://brsfiddle.net?code=XQAAAALcDgAAAAAAAABJKoSlctaqcQ9tGaWSdUHrXuqR-y6_GbR6awG83rYQRcdoycHkJ8MFCvKH7gTK_vW6UgUXwXXR3errMRkkWHDAf6EtfvZhhrStj0ebMCVuI-lw2r_IMbOmR-Mp0UisKJluxhBof7Fe8gk7R-rj00p60KZMJaFUITmjx-lE5H1fW4m9pTGoVPDOxvJ0KBpdcrPdzIJZD2ONw-UcA9--COJb9DODV8pyO4e1dn32T1V2kh39SrM5VHgICzTHTsajN6_hBKsKOFc0xivTnldYZ41pbirlPTC1nKX8LjXpkHeTxvV-NWcA50XR8Wrm0Fl05rtjwL7hHumCwZc75GY1ioNTMQoe5JSDL02n0Jf0ZWEwuBleP5O_OckNjn5o0ANbhu39ZlF4TEbpst2ac0F0ad4_eQCIseeB44BgoJwBahG49-Fry-afCaVqC8qtZsvtj7AlCAyYFOPOWiSioqopcqqWTF1XGG7n7HI5Qtj6D1h6ajT9zzy_Pn6jJ7ICSdDbOFq6GP7LGjHglUF6I91yS8Vxh8NQSAZgi4PiYyZbX4uJtsDZsvjhZpFOg4tQvV5TUCtxLtQfe7Nt4SZEN-6OLJiPFMR9hME4EIyV_OfxC_T0XrPKIhduA32al5K1L6STy-ntJPYdkKWfMP3kNl82aDEwm_XCvIflp9dcY5ADxKcvOdFYqCuOyFiqKcWjV_RWI8I_sqr_p2E3cKF7sZl-9jzFCtMarZCM4sQpgyPiJkhjm7IwYFJkEMAzeiAV9BPB7on9ReUWYWIsOOA6aGbP7ZKvdw3CNsda8qImFKeYKrnoPySnBQFCxDe-26_ncaH9QQ3jKc0xzi8z0SSaZ-xYe-rvw6FFMqrKHCg2j4U4Drv-AunjhL7Rh0HjBSPkzm-tYK9GPj5xyOEaIrULWdg8kG6hu6arEfMZMbSS8b0wW44QlTr2l4YzC-wuzRbtmBzxn04f5thX0rHxgUR9GpRvNgQnob1-_pG2phYoezVKaIbFoa2VEp6cQZYGgJxW-4VHGmL_ofJG7taOYjjq04EmhVKm7c21z2JPnOTk31qeEd4ZqHMWVomSPDmVHAvVt-RM9_rda71zSdVrgrNIabT9sFTfFfgUFbpo5JyDASVJ3_w7fLFH7zTIX_kNoWg1WQXnAeay5P-_Hg3LzmnzmT72qolkQKwYzDCYO5RgcrKYc9QfVGDuZwmo9r_tGpvNgTX5ffCa4a_kAL-fGWb6O6gz_lloYvQEM4WHB8d9ZNR-U3jZ4DWRAZHsmeIHdKttU5pPlE-CDrTQAkZMdlReNxWHE-5m2nCp2hfwgUvUKhBai9u34OSoPAd3rE1yePxiy-AVOV0OZUtiA2109a25frwbDLYRg2-lJRSGEzf9kadWrhL90pr52yZcjlBMUAaElB5TtQDJkvejpr0pA3-BJXK2kNK-NNisss1SzCR25FxCzrmiRUHRLInLpNoLk-CxzFAkbjHySCsXXnNp6gtXD3Cm82m8P2kl-ts6QTXhf4rHCcNtUfwYZPWLehVEZtfRgfm-HhI)

## Desktop Application

The simulator is also available as a multi-platform **desktop application** (Windows, Linux & macOS) that uses the package published by this project. The application introduces several additional Roku features, such as the **ECP** (External Control Protocol) and **Remote Console** servers to allow integration with tools like Telnet or [VSCode BrightScript Extension](https://marketplace.visualstudio.com/items?itemName=RokuCommunity.brightscript). You can also change the device configurations such as screen resolution, keyboard control customization, localization, among others. Download the installers and find more information in the links below:

- Source code and documentation: [app repository](https://github.com/lvcabral/brs-desktop).
- Architecture Overview: [diagram picture](https://github.com/lvcabral/brs-desktop/tree/scenegraph/docs/images/brs-desktop-architecture-overview.png).
- Installation packages: [release page](https://github.com/lvcabral/brs-desktop/releases).

## Developer Links

- My website: [https://lvcabral.com](https://lvcabral.com)
- My threads: [@lvcabral](https://www.threads.net/@lvcabral)
- My Bluesky: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- My X/twitter: [@lvcabral](https://twitter.com/lvcabral)
- My podcast: [PODebug Podcast](http://podebug.com)
- Check my other [GitHub repositories](https://github.com/lvcabral)

## License

Copyright © 2019-2025 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT](https://github.com/lvcabral/brs-engine/tree/scenegraph/LICENSE) license.