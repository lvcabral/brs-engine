# How to Customize the Simulation Engine

The engine allows several ways to customize the behavior and controls of the simulated device, below all the ways a host application can set it up, during initialization and execution of BrightScript apps.

## Device Information

As described on the [engine API documentation](engine-api.md), the `initializate()` method accepts, as first parameter, an object containing custom device configurations. Below is an example of the object with all its default values, defined internally on the library. Most of these parameters are accessible by the BrightScript app via `roDeviceInfo` component. It's not necessary to send all parameters, only the ones to be changed.

```ts
const deviceInfo = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data
    friendlyName: "BrightScript Engine Library",
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "BSC.00E04193A", // v11.0
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US", // App Store Country
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US", // Used if app supports localization
    captionLanguage: "eng",
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap",
    fontPath: "../fonts/",
    maxSimulStreams: 2, // Max number of audio resource streams (1, 2 or 3)
    customFeatures: [],
    connectionType: "WiredConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    maxFps: 60,
};
```

### Custom Features Parameter

In the example above, there is an `Array` parameter named `customFeatures`, that can be used to pass to the apps, specific features that the host application implements. This value can be checked using the `roDeviceInfo` method `hasFeature()` in the BrightScript code. An example of this usage would be, if you want to define that your application is running on a device that support touch features, emulating the remote control, you can add `customFeatures: ["touch_controls"]` and inside the app you can check this way:

```brs
    di = CreateObject("roDeviceInfo")
    if di.hasFeature("touch_controls") 'This will always return `false` in a Roku device
        showTouchInstructions()
    else
        showRemoteInstructions()
    end if
```

By default, the feature `simulation_engine` is defined internally in the library, to allow the apps identify that it's running under `brs-engine`.

## App Manifest

There is also a way BrightScript apps can change the behavior of the simulation engine, by using custom `manifest` entries. Currently the only custom option is:

- `multi_key_events=1`: If this flag is defined, will inform the simulator to handle multiple key events in paralell, instead of the default Roku behavior, that is handling one key at a time.

Note: custom `manifest` entries are ignored by Roku Devices.

## Control Mapping

It is also possible to customize the Remote Control mapping for the Keyboard and Game Pad, either by sending the custom mapping in the `Options` parameter when running `initialize()` method, or by using `setCustomKeys()` and `setCustomPadButtons()` later on. Check the details in the [engine API documentation](engine-api.md).