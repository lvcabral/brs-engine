# Using the brs-node Library

This guide explains how to use the `brs-node` library in your Node.js applications and testing environments. The library provides programmatic access to the **BrightScript Simulation Engine**, allowing you to execute BrightScript code, run Roku applications, and test your BrightScript implementations.

## Table of Contents

- [Using the brs-node Library](#using-the-brs-node-library)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Package Libraries](#package-libraries)
    - [Choosing an Execution Model](#choosing-an-execution-model)
    - [The SceneGraph Extension Bundle](#the-scenegraph-extension-bundle)
  - [Using in Node.js Applications](#using-in-nodejs-applications)
    - [Basic Setup](#basic-setup)
    - [Executing BrightScript Files](#executing-brightscript-files)
      - [Complete Example](#complete-example)
    - [Executing BrightScript from In-Memory Files](#executing-brightscript-from-in-memory-files)
      - [SceneGraph App Example](#scenegraph-app-example)
    - [Running Apps on Worker Threads (with SceneGraph Task support)](#running-apps-on-worker-threads-with-scenegraph-task-support)
    - [Using the REPL Interpreter](#using-the-repl-interpreter)
    - [Handling Callbacks](#handling-callbacks)
    - [Working with SharedArrayBuffer](#working-with-sharedarraybuffer)
  - [Using in Tests](#using-in-tests)
    - [Setting up Jest Tests](#setting-up-jest-tests)
    - [Testing with E2E Helper Functions](#testing-with-e2e-helper-functions)
    - [Testing Best Practices](#testing-best-practices)
      - [1. Reset File System Between Tests](#1-reset-file-system-between-tests)
      - [2. Use Fake Timers for Time-Dependent Tests](#2-use-fake-timers-for-time-dependent-tests)
      - [3. Test with Deep Links](#3-test-with-deep-links)
  - [API Reference](#api-reference)
    - [Core Functions](#core-functions)
      - [`registerCallback(callback, sharedBuffer?)`](#registercallbackcallback-sharedbuffer)
      - [`createPayloadFromFiles(files, device, deepLink?, root?, ext?)`](#createpayloadfromfilesfiles-device-deeplink-root-ext)
      - [`createPayloadFromFileMap(fileMap, device, deepLink?)`](#createpayloadfromfilemapfilemap-device-deeplink)
      - [`executeFile(payload, options?)`](#executefilepayload-options)
      - [`executeApp(payload, options?)`](#executeapppayload-options)
      - [`subscribeHost(observerId, callback)` / `unsubscribeHost(observerId)`](#subscribehostobserverid-callback--unsubscribehostobserverid)
      - [`terminateApp(reason?, timeoutMs?)`](#terminateappreason-timeoutms)
      - [`getReplInterpreter(options)`](#getreplinterpreteroptions)
      - [`executeLine(line, interpreter)`](#executelineline-interpreter)
    - [File System API](#file-system-api)
      - [`BrsDevice.fileSystem.resetMemoryFS()`](#brsdevicefilesystemresetmemoryfs)
  - [Additional Resources](#additional-resources)
  - [Support](#support)

---

## Installation

Install the package via npm:

```bash
npm install brs-node
```

Or using yarn:

```bash
yarn add brs-node
```

---

## Package Libraries

The package ships four bundles under `bin/` (Node.js v22+ required):

| Library File | Role |
| --- | --- |
| `brs.node.js` | The engine library — the package `main` (`require("brs-node")`). Also serves as the **worker entry** when apps run on worker threads. |
| `brs-sg.node.js` | The **SceneGraph extension** bundle, loaded dynamically into the engine when SceneGraph support is needed. |
| `brs.cli.js` | The `brs-cli` executable — a consumer of the two libraries above. |
| `brs.ecp.js` | Worker-thread library for the ECP/SSDP servers, used by the CLI with `--ecp`. |

### Choosing an Execution Model

`brs-node` offers two ways to execute an app — pick per use case:

| | `executeFile` (synchronous) | `executeApp` (worker threads) |
| --- | --- | --- |
| Runs on | the calling thread | a dedicated worker thread |
| SceneGraph UI (`roSGScreen`, nodes) | ✅ supported | ✅ supported |
| SceneGraph `Task` nodes | ❌ never spawn (no free host thread to broker them) | ✅ one worker thread per running Task |
| Output delivery | `registerCallback` (synchronous calls) | `subscribeHost` events (asynchronous) |
| Control input | shared buffer via `registerCallback` | shared buffer via `options.sharedBuffer` |
| Packaging (`.bpk` generation) | ✅ returns `cipherText` | ❌ not supported |
| Best for | tests, CI, scripting, packaging | running full apps, anything using Tasks |

Both models accept the same payloads (`createPayloadFromFiles` / `createPayloadFromFileMap`) and simulate the same device. The browser package (`brs-engine`) only has the worker model; `executeFile` is unique to Node, kept for its simplicity and synchronous determinism in test suites.

### The SceneGraph Extension Bundle

The interpreter core is SceneGraph-agnostic: `roSGScreen`, `roSGNode` and the node types are provided by the separate `brs-sg.node.js` bundle, loaded through the public extension API (the same contract available to third-party extensions — see [extensions.md](./extensions.md)). What you must know as a consumer:

- **It binds to the running engine at load time.** Its internal `brs-engine` import resolves to the already-loaded `brs.node.js` module instance, so the two bundles must come from the **same installed package version** — never mix a `brs-sg.node.js` from one version with a `brs.node.js` from another.
- **How to enable it depends on the execution model:**
  - `executeFile`: register it in-process before executing:

    ```javascript
    const brs = require("brs-node");
    const sg = require("brs-node/bin/brs-sg.node.js");
    brs.registerExtension(() => new sg.BrightScriptExtension());
    ```

  - `executeApp`: declare it on the payload; each worker thread is a fresh isolate and loads its own instance from the path in `device.extensions` (relative paths resolve against the `bin/` folder):

    ```javascript
    payload.extensions = [brs.SupportedExtension.SceneGraph];
    payload.device.extensions = new Map([[brs.SupportedExtension.SceneGraph, "brs-sg.node.js"]]);
    ```

- **If you bundle your application** (webpack/esbuild), keep `brs-node` external (on disk): the worker entry and the extension are resolved by file path at runtime and cannot live inside your bundle. The `workerEntry` option of `executeApp` exists for custom layouts.

---

## Using in Node.js Applications

### Basic Setup

Import the library in your Node.js application:

```javascript
const brs = require("brs-node");
```

Or using ES6 imports (TypeScript):

```typescript
import * as brs from "brs-node";
```

### Executing BrightScript Files

The library provides several functions to execute BrightScript code. The main workflow involves:

1. Creating a payload from your BrightScript files
2. Registering a callback to handle output and events
3. Executing the payload

#### Complete Example

```javascript
const brs = require("brs-node");
const fs = require("fs");
const path = require("path");

// Register a callback to handle interpreter messages
brs.registerCallback((message, data) => {
    if (typeof message === "string") {
        const [messageType, content] = message.split(",", 2);

        switch (messageType) {
            case "print":
                console.log(content);
                break;
            case "warning":
                console.warn(content);
                break;
            case "error":
                console.error(content);
                break;
            case "end":
                console.log(`Execution finished: ${content}`);
                break;
        }
    } else if (message instanceof Map) {
        // Registry updates
        console.log("Registry updated:", message);
    }
});

// Define device configuration
const deviceData = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443",
    friendlyName: "BrightScript Test Device",
    deviceModel: "8000X",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4",
    countryCode: "US",
    timeZone: "US/Eastern",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "1080p",
    customFeatures: [],
    localIps: ["192.168.1.100"],
};

// Create payload from BrightScript files
const files = [
    path.join(__dirname, "main.brs"),
    path.join(__dirname, "lib", "utils.brs")
];

const payload = brs.createPayloadFromFiles(
    files,
    deviceData,
    new Map(), // deepLink parameters (optional)
    "/path/to/pkg/root", // root directory for pkg:/ (optional)
    "/path/to/ext/root"  // root directory for ext1:/ (optional)
);

// Execute the payload
(async () => {
    try {
        const result = await brs.executeFile(payload);
        console.log(`Exit reason: ${result.exitReason}`);

        // Handle encrypted package generation if password was provided
        if (result.exitReason === "PACKAGED") {
            console.log("Package encrypted successfully");
            // Save the encrypted package
            const encryptedData = new Uint8Array(result.cipherText);
            fs.writeFileSync("app.bpk", encryptedData);
        }
    } catch (error) {
        console.error("Execution failed:", error);
    }
})();
```

### Executing BrightScript from In-Memory Files

You can also create a payload from in-memory file content using `createPayloadFromFileMap`. This is useful when working with uploaded files, network resources, or dynamically generated content:

```javascript
const brs = require("brs-node");

// Register callback (same as above)
brs.registerCallback((message) => {
    // Handle messages...
});

// Create file map with Blob content
const fileMap = new Map();

// Add BrightScript source files
const mainBrsCode = `
    sub Main()
        print "Hello from in-memory BrightScript!"
        print "Device model: "; CreateObject("roDeviceInfo").GetModel()
    end sub
`;
fileMap.set("main.brs", new Blob([mainBrsCode], { type: "text/plain" }));

// Add manifest file
const manifestContent = `
title=My In-Memory App
major_version=1
minor_version=0
build_version=1
`;
fileMap.set("manifest", new Blob([manifestContent], { type: "text/plain" }));

// Add additional library file
const libCode = `
    function GetAppVersion() as string
        return "1.0.1"
    end function
`;
fileMap.set("lib/utils.brs", new Blob([libCode], { type: "text/plain" }));

// Execute the in-memory files
(async () => {
    try {
        // Create payload from file map
        const payload = await brs.createPayloadFromFileMap(fileMap, deviceData);

        // Execute the payload
        const result = await brs.executeFile(payload);
        console.log(`Exit reason: ${result.exitReason}`);
    } catch (error) {
        console.error("Execution failed:", error);
    }
})();
```

#### SceneGraph App Example

For SceneGraph applications, organize files in the proper folder structure:

```javascript
const fileMap = new Map();

// Manifest for SceneGraph app
const manifest = `
title=My SceneGraph App
major_version=1
minor_version=0
ui_resolutions=hd
splash_min_time=0
`;
fileMap.set("manifest", new Blob([manifest], { type: "text/plain" }));

// Main application source (executed)
const mainCode = `
sub Main()
    print "SceneGraph app starting..."

    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)

    scene = screen.CreateScene("MainScene")
    screen.show()

    print "Scene created and displayed"

    ' Event loop
    while true
        msg = wait(1000, m.port)
        if msg <> invalid
            if msg.isScreenClosed()
                exit while
            end if
        else
            exit while ' Timeout for demo
        end if
    end while
end sub
`;
fileMap.set("source/main.brs", new Blob([mainCode], { type: "text/plain" }));

// Scene component XML (packaged, not executed)
const sceneXml = `<?xml version="1.0" encoding="utf-8" ?>
<component name="MainScene" extends="Scene">
    <children>
        <Label id="titleLabel"
               text="Hello SceneGraph!"
               translation="[960, 540]"
               horizAlign="center"
               font="font:LargeSystemFont" />
    </children>
    <script type="text/brightscript" uri="MainScene.brs" />
</component>`;
fileMap.set("components/MainScene.xml", new Blob([sceneXml], { type: "text/xml" }));

// Scene component script (packaged, not executed)
const sceneBrs = `
function init()
    print "MainScene component initialized"
    m.titleLabel = m.top.findNode("titleLabel")

    if m.titleLabel <> invalid
        m.titleLabel.text = "Hello from Component!"
    end if
end function
`;
fileMap.set("components/MainScene.brs", new Blob([sceneBrs], { type: "text/plain" }));

// Register the SceneGraph extension (required for roSGScreen/roSGNode — see
// "The SceneGraph Extension Bundle" above)
const sg = require("brs-node/bin/brs-sg.node.js");
brs.registerExtension(() => new sg.BrightScriptExtension());

// Execute SceneGraph app
(async () => {
    const payload = await brs.createPayloadFromFileMap(fileMap, deviceData);
    const result = await brs.executeFile(payload);
    // payload.pkgZip contains the complete app package
})();
```

> **Note:** with the synchronous `executeFile`, SceneGraph **`Task` nodes never run** (setting
> `control = "run"` is a no-op). If the app depends on Tasks, run it with `executeApp` (next
> section) instead.

### Running Apps on Worker Threads (with SceneGraph Task support)

The synchronous `executeFile` runs the interpreter on the calling thread — ideal for tests and
scripted execution, but SceneGraph `Task` nodes never spawn (they need a free host thread to
broker cross-thread rendezvous). Use **`executeApp`** to run an app on a dedicated
`worker_threads` thread (the render thread) with full Task support: each running `Task` node
gets its own worker thread, mirroring the browser engine and a real Roku device.

```javascript
const brs = require("brs-node");

// Subscribe to host events (replaces registerCallback for the worker path)
brs.subscribeHost("my-app", (event, data) => {
    if (event === "message" && typeof data === "string") {
        // Same "type,content" strings the sync callback receives: print, error, end, ...
        const [type] = data.split(",", 1);
        if (type === "print") process.stdout.write(data.slice(6));
    } else if (event === "frame") {
        // A node-canvas ImageData with the latest rendered frame
    } else if (event === "registry") {
        // RegistryData to persist ({ current: Map, ... })
    }
});

(async () => {
    const payload = await brs.createPayloadFromFiles([], deviceData, undefined, "/path/to/app-root");
    // Enable the SceneGraph extension in the worker threads:
    payload.extensions = [brs.SupportedExtension.SceneGraph];
    payload.device.extensions = new Map([[brs.SupportedExtension.SceneGraph, "brs-sg.node.js"]]);

    const result = await brs.executeApp(payload);
    console.log(`Exit reason: ${result.exitReason}`);
})();
```

`executeApp(payload, options?)` accepts:

- `options.sharedBuffer` — a control `SharedArrayBuffer` you own (keys, sounds, debug commands).
  Write remote-control keys into it with `Atomics` (see [remote-control.md](./remote-control.md))
  to control the running app; when omitted, the host creates one internally.
- `options.workerEntry` — absolute path to the engine bundle used as the worker entry. Defaults
  to the installed `brs.node.js`; set it if you relocate or bundle the library.

Use `terminateApp(reason?, timeoutMs?)` to request a graceful exit of the running app. Only one
app can run on the host at a time. Packaging (`.bpk` generation) is not supported through
`executeApp` — use the synchronous `executeFile` for that.

Host events: `message` (engine strings), `frame` (ImageData), `registry` (RegistryData),
`graphics` (texture-memory data), `launch` (roAppManager launch requests), `ndkStart`,
`component` (display/caption state objects), `stdout`/`stderr` (console output written directly
inside a worker thread — the workers' streams are piped to the host, never to the terminal),
`error`/`warning`/`debug` (host diagnostics).

### Using the REPL Interpreter

For interactive BrightScript execution or building a custom REPL:

```javascript
const brs = require("brs-node");

(async () => {
    // Get REPL interpreter instance
    const replInterpreter = await brs.getReplInterpreter({
        device: deviceData,
        root: "/path/to/pkg/root",    // optional
        ext: "/path/to/ext/root",      // optional
        extZip: undefined               // optional ArrayBuffer with zip data
    });

    // Execute single line
    brs.executeLine("print \"Hello, World!\"", replInterpreter);

    // Execute expression
    brs.executeLine("? 2 + 2", replInterpreter);

    // Get variable information
    const globalVars = replInterpreter.formatVariables(0); // 0=global, 1=module, 2=function
    console.log("Global variables:", globalVars);

    // Access interpreter options
    console.log("Root path:", replInterpreter.options.root);
})();
```

### Handling Callbacks

> Applies to the **synchronous model** (`executeFile`/REPL). With `executeApp`, output is
> delivered through `subscribeHost` events instead — see the previous section.

The callback function receives all output and events from the interpreter:

```javascript
brs.registerCallback((message, data) => {
    if (typeof message === "string") {
        // Parse message type and content
        const parts = message.split(",");
        const messageType = parts[0];
        const content = parts.slice(1).join(",");

        switch (messageType) {
            case "print":
                // Standard output
                process.stdout.write(content);
                break;

            case "warning":
                // Warning messages
                console.warn(content);
                break;

            case "error":
                // Error messages
                console.error(content);
                break;

            case "start":
                // Execution started
                console.log("Execution started");
                break;

            case "end":
                // Execution finished with reason
                console.log(`Finished: ${content}`);
                break;

            case "debug":
                // Debug events
                console.log("Debug:", content);
                break;

            case "syslog":
                // System log messages
                console.log("SysLog:", content);
                break;
        }
    } else if (message instanceof ImageData) {
        // Screen buffer update (for ASCII rendering or canvas)
        console.log(`Screen updated: ${message.width}x${message.height}`);
    } else if (message instanceof Map) {
        // Registry updates
        console.log("Registry updated with", message.size, "entries");
    }
}, sharedBuffer); // Optional SharedArrayBuffer for inter-thread communication
```

### Working with SharedArrayBuffer

For advanced use cases with worker threads (like the ECP server):

```javascript
const { Worker } = require("worker_threads");

// Create shared buffer for communication
const dataBufferIndex = 128; // From brs.dataBufferIndex
const dataBufferSize = 128;  // From brs.dataBufferSize
const length = dataBufferIndex + dataBufferSize;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
const sharedArray = new Int32Array(sharedBuffer);
sharedArray.fill(-1);

// Register callback with shared buffer
brs.registerCallback(messageCallback, sharedBuffer);

// Use with worker threads
const worker = new Worker("./ecp-worker.js");
worker.postMessage(sharedBuffer);
```

---

## Using in Tests

The `brs-node` library is excellent for testing BrightScript code. Here are common patterns used in the project's test suite.

### Setting up Jest Tests

Install Jest and set up your test environment:

```bash
npm install --save-dev jest
```

### Testing with E2E Helper Functions

Create a helper module for end-to-end tests:

```javascript
// test/helpers/E2EHelpers.js
const path = require("path");
const stream = require("stream");
const brs = require("brs-node");

brs.registerCallback(() => {}); // Suppress output

const deviceData = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443",
    friendlyName: "Test Device",
    deviceModel: "8000X",
    firmwareVersion: "48G.04E05531A",
    clientId: "test-client-id",
    RIDA: "test-rida",
    countryCode: "US",
    timeZone: "US/Eastern",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "1080p",
    audioCodecs: ["mp3", "wav", "aac"],
    videoFormats: new Map([
        ["codecs", ["mpeg4 avc", "vp9"]],
        ["containers", ["mp4", "mkv"]]
    ]),
    customFeatures: [],
    localIps: ["192.168.1.100"]
};

function resourceFile(...filenameParts) {
    return path.join("test", "resources", ...filenameParts);
}

function createMockStreams() {
    const stdout = Object.assign(new stream.PassThrough(), process.stdout);
    const stderr = Object.assign(new stream.PassThrough(), process.stderr);

    return {
        stdout,
        stderr,
        stdoutSpy: jest.spyOn(stdout, "write").mockImplementation(() => {}),
        stderrSpy: jest.spyOn(stderr, "write").mockImplementation(() => {})
    };
}

async function execute(filenames, options = {}, deepLink) {
    // Reset file system for clean test
    brs.BrsDevice.fileSystem.resetMemoryFS();

    const payload = brs.createPayloadFromFiles(filenames, deviceData);
    if (deepLink) {
        payload.deepLink = deepLink;
    }
    await brs.executeFile(payload, options);
}

function allArgs(jestMock) {
    return jestMock.mock.calls
        .reduce((allArgs, thisCall) => allArgs.concat(thisCall), []);
}

module.exports = {
    deviceData,
    resourceFile,
    createMockStreams,
    execute,
    allArgs
};
```

Use the helpers in your tests:

```javascript
const { execute, createMockStreams, resourceFile, allArgs } = require("./helpers/E2EHelpers");

describe("BrightScript Components", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test("roArray operations", async () => {
        await execute([resourceFile("components", "roArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map(arg => arg.trimEnd())).toEqual([
            "array length:  4",
            "last element: sit",
            "first element: lorem",
            "can delete elements: true"
        ]);
    });

    test("roAssociativeArray operations", async () => {
        await execute([resourceFile("components", "roAssociativeArray.brs")], outputStreams);

        const output = allArgs(outputStreams.stdout.write);
        expect(output).toContain("AA size:  3");
        expect(output).toContain("can delete elements: true");
    });
});
```

### Testing Best Practices

#### 1. Reset File System Between Tests

```javascript
beforeEach(() => {
    brs.BrsDevice.fileSystem.resetMemoryFS();
});
```

#### 2. Use Fake Timers for Time-Dependent Tests

```javascript
const fakeTimer = require("@sinonjs/fake-timers");

let clock;

beforeEach(() => {
    clock = fakeTimer.install({
        now: 1547072370937,
        toFake: ["Date", "performance"]
    });
});

afterEach(() => {
    clock.uninstall();
});
```

#### 3. Test with Deep Links

```javascript
test("handles deep link parameters", async () => {
    const deepLink = new Map([
        ["contentId", "12345"],
        ["mediaType", "movie"]
    ]);

    await execute([resourceFile("deeplink.brs")], {}, deepLink);

    // Assert expected behavior
});
```

---

## API Reference

### Core Functions

#### `registerCallback(callback, sharedBuffer?)`

Registers a callback function to receive interpreter messages and events in the
**synchronous model** (`executeFile`/REPL). Not used by `executeApp` — subscribe with
`subscribeHost` instead.

**Parameters:**

- `callback: (message: any, data?: any) => void` - Function to handle messages
- `sharedBuffer?: SharedArrayBuffer` - Optional shared buffer for control input (keys, debug commands)

**Example:**

```javascript
brs.registerCallback((message) => {
    console.log("Received:", message);
});
```

#### `createPayloadFromFiles(files, device, deepLink?, root?, ext?)`

Creates an execution payload from BrightScript files.

**Parameters:**

- `files: string[]` - Array of file paths to execute
- `device: DeviceInfo` - Device configuration object
- `deepLink?: Map<string, string>` - Deep link parameters
- `root?: string` - Root directory for `pkg:/` volume
- `ext?: string` - Root directory for `ext1:/` volume

**Returns:** `AppPayload`

#### `createPayloadFromFileMap(fileMap, device, deepLink?)`

Creates an execution payload from a map of file paths and Blob content. This function automatically creates a ZIP package (in memory) containing all files and properly handles SceneGraph app structures.

**Parameters:**

- `fileMap: Map<string, Blob>` - Map with file paths as keys and Blob content as values
- `device: DeviceInfo` - Device configuration object
- `deepLink?: Map<string, string>` - Deep link parameters

**Returns:** `Promise<AppPayload>` - Payload with `pkgZip` containing all files

**File Handling Rules:**

- **Files without folder**: Placed in `source/` folder and executed as main source code
- **Files in `source/` folder**: Executed as main source code (including subfolders)
- **Files in other folders** (e.g., `components/`, `images/`): Packaged in ZIP but not executed as source

**SceneGraph Support:**

- Component XML and BrightScript files in `components/` folder are packaged for SceneGraph runtime
- Only `source/` folder BrightScript files are executed as main application code
- Maintains proper separation between main source and component files

**Examples:**

Basic usage:

```javascript
const fileMap = new Map();
fileMap.set("main.brs", new Blob([brightScriptCode], { type: "text/plain" }));
fileMap.set("manifest", new Blob([manifestContent], { type: "text/plain" }));

const payload = await brs.createPayloadFromFileMap(fileMap, deviceData);
const result = await brs.executeFile(payload);
```

SceneGraph app structure:

```javascript
const fileMap = new Map();

// Main application (executed)
fileMap.set("source/main.brs", new Blob([mainAppCode], { type: "text/plain" }));

// SceneGraph components (packaged, not executed directly)
fileMap.set("components/MyScene.xml", new Blob([sceneXmlCode], { type: "text/xml" }));
fileMap.set("components/MyScene.brs", new Blob([sceneBrsCode], { type: "text/plain" }));

// Assets (packaged as-is)
fileMap.set("images/icon.png", new Blob([iconData], { type: "image/png" }));
fileMap.set("manifest", new Blob([manifestContent], { type: "text/plain" }));

const payload = await brs.createPayloadFromFileMap(fileMap, deviceData);
// payload.pkgZip contains the complete app package
```

#### `executeFile(payload, options?)`

Executes a BrightScript application payload **synchronously on the calling thread**.
SceneGraph `Task` nodes do not spawn in this mode (use `executeApp` for Task support).
This is also the only mode that supports packaging (`cipherText` in the result).

**Parameters:**

- `payload: AppPayload` - Application payload to execute
- `options?: object` - Execution options

**Returns:** `Promise<{ exitReason: string, cipherText?: ArrayBuffer, iv?: Uint8Array }>`

#### `executeApp(payload, options?)`

Executes a BrightScript application on a dedicated worker thread, with SceneGraph `Task`
support (one worker thread per running Task). The promise resolves when the app finishes.
Output and events are delivered to `subscribeHost` observers. Only one app can run at a time;
packaging is not supported in this mode (use `executeFile`).

**Parameters:**

- `payload: AppPayload` - Application payload to execute (set `payload.extensions` and
  `payload.device.extensions` to enable SceneGraph in the workers)
- `options?: { sharedBuffer?: SharedArrayBuffer, workerEntry?: string }` - Optional control
  buffer (for remote-control/debug input via `Atomics`) and worker entry path override

**Returns:** `Promise<{ exitReason: string }>`

#### `subscribeHost(observerId, callback)` / `unsubscribeHost(observerId)`

Subscribes to (or removes a subscription from) events emitted by the worker host while an app
runs through `executeApp`.

**Callback:** `(event: string, data?: any) => void`, with events:

- `message` - engine strings in `"type,content"` format (`print`, `error`, `end`, ...)
- `frame` - a node-canvas `ImageData` with the latest rendered frame
- `registry` - `RegistryData` to persist (`{ current: Map, ... }`)
- `graphics` - texture-memory debug data
- `launch` / `ndkStart` - app-launch requests
- `component` - display/caption state objects
- `stdout` / `stderr` - console output written directly inside a worker thread (piped to the host)
- `error` / `warning` / `debug` - host diagnostics

#### `terminateApp(reason?, timeoutMs?)`

Requests a graceful exit of the app running through `executeApp` (same as the ECP `exit-app`
command), force-terminating the app worker and all Task workers if it does not finish within
the timeout (default 3000 ms). The optional `reason` (an `AppExitReason`, default
`EXIT_USER_NAV`) is reported on the `end` event, mirroring the browser API's
`terminate(reason)` — e.g. the CLI's Home key uses the default to report a user-initiated exit.

#### `getReplInterpreter(options)`

Creates a REPL interpreter instance for interactive execution.

**Parameters:**

- `options: { device: DeviceInfo, root?: string, ext?: string, extZip?: ArrayBuffer }`

**Returns:** `Promise<ReplInterpreter>`

#### `executeLine(line, interpreter)`

Executes a single line of BrightScript code in the REPL interpreter.

**Parameters:**

- `line: string` - BrightScript code to execute
- `interpreter: ReplInterpreter` - REPL interpreter instance

### File System API

#### `BrsDevice.fileSystem.resetMemoryFS()`

Resets the in-memory file system to a clean state.

---

## Additional Resources

- [CLI Documentation](./run-as-cli.md)
- [Customization Guide](./customization.md)
- [Remote Control Documentation](./remote-control.md)
- [Contributing Guide](./contributing.md)

## Support

- GitHub Issues: <https://github.com/lvcabral/brs-engine/issues>
- Slack: [RokuCommunity](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA)
