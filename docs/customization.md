# How to Customize the Simulation Engine

The engine allows several ways to customize the behavior and controls of the simulated device, below all the ways a host application can set it up, during initialization and execution of BrightScript apps.

## Device Information

As described on the [engine API documentation](engine-api.md), the `initialize()` method accepts, as first parameter, an object containing custom device configurations. Below is an example of the object with all its default values, defined internally on the library. Most of these parameters are accessible by the BrightScript app via `roDeviceInfo` component. It's not necessary to send all parameters, only the ones to be changed.

```ts
const deviceInfo = {
  developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As Roku, this ID segregates Registry data (can't be empty or have a dot)
  friendlyName: "BrightScript Engine Library",
  deviceModel: "8000X", // Roku TV (Midland)
  clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
  RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
  countryCode: "US", // App Store Country
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: "en_US", // Valid locales: en_US, es_MX, pt_BR, fr_CA, de_DE
  captionLanguage: "eng",
  clockFormat: "12h",
  displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
  maxSimulStreams: 2, // Max number of `roAudioResource` streams (1 or 2)
  customFeatures: [], // String array with custom features (see below)
  localIps: ["eth1,127.0.0.1"], // In a Browser isn't possible to get a real IP, populate it on NodeJS or Electron
  startTime: Date.now(),
  audioVolume: 50, // Defines the default volume level for system sounds - valid: (0-100)
  maxFps: 60,
  corsProxy: "https://your-cors-proxy-instance.yourdomain.com/", // (optional) Add your CORS-Anywhere URL here
};
```

### CORS Proxy Configuration

* See `App Manifest` below to enable CORS proxy for your app
* CORS-Anywhere repository: <https://github.com/Rob--W/cors-anywhere>

## Simulated Device Features

In BrightScript, various device features can be checked using the `roDeviceInfo` method `hasFeature()`. The engine leverages this method to provide developers with a way to verify specific simulator features.

Below is a table with the extended set of features, internally created by the engine, that can be used in BrightScript code. This allows apps to behave differently when running on a Roku device or under the simulation engine.

| Feature Name | Description |
|--------------|-------------|
| `simulation_engine` | Always `true` when running under `brs-engine` |
| `ascii_rendering` | Returns `true` when running in the terminal in ASCII screen mode, see the [CLI doc](run-as-cli.md) for more details |
| `platform_browser` | Returns `true` when running under a Browser |
| `platform_chromium` | Returns `true` when running under Chromium |
| `platform_firefox` | Returns `true` when running under Firefox |
| `platform_safari` | Returns `true` when running under Safari |
| `platform_electron` | Returns `true` when running under Electron |
| `platform_linux` | Returns `true` when running under Linux |
| `platform_macos` | Returns `true` when running under MacOS |
| `platform_windows` | Returns `true` when running under Windows |
| `platform_chromeos` | Returns `true` when running under ChromeOS |
| `platform_ios` | Returns `true` when running under iOS |
| `platform_android` | Returns `true` when running under Android |

### Custom Features

In the **Device Information** section above, the `deviceInfo` object has an `Array` parameter named `customFeatures` that can be used to pass specific features implemented by the host application to the BrightScript apps.

For example, if you want to define that your application is running on a device that supports touch features, emulating the remote control, you can add `customFeatures: ["touch_controls"]`. Inside the app, you can check this feature as follows:

```brs
  di = CreateObject("roDeviceInfo")
  if di.hasFeature("touch_controls") 'This will always return `false` in a Roku device
    showTouchInstructions()
  else
    showRemoteInstructions()
  end if
```

## App Manifest

There is also a way BrightScript apps can change the behavior of the simulation engine, by using special `manifest` entries. The valid options are:

* `multi_key_events=1`: If this flag is defined, will inform the simulator to handle multiple key events in parallel, instead of the default Roku behavior, that is handling one key at a time.
* `cors_proxy=0`: If this flag is defined with `zero`, the engine will disable the `corsProxy` URL for the app, if configured in the `DeviceInfo` object.

**Note:** these special `manifest` entries are ignored by Roku Devices.

## Control Mapping

It is also possible to customize the Remote Control mapping for the Keyboard and Game Pad, either by sending the custom mapping in the `Options` parameter when running `initialize()` method, or by using `setCustomKeys()` and `setCustomPadButtons()` later on. Check the details in the [engine API documentation](engine-api.md). To learn about the default mapping check the [Remote Control Simulation](./remote-control.md) page.
