# Using the brs-node Library

This guide explains how to use the `brs-node` library in your Node.js applications and testing environments. The library provides programmatic access to the **BrightScript Simulation Engine**, allowing you to execute BrightScript code, run Roku applications, and test your BrightScript implementations.

## Table of Contents

- [Using the brs-node Library](#using-the-brs-node-library)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Using in Node.js Applications](#using-in-nodejs-applications)
    - [Basic Setup](#basic-setup)
    - [Executing BrightScript Files](#executing-brightscript-files)
      - [Complete Example](#complete-example)
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
      - [`executeFile(payload, options?)`](#executefilepayload-options)
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

Registers a callback function to receive interpreter messages and events.

**Parameters:**

- `callback: (message: any, data?: any) => void` - Function to handle messages
- `sharedBuffer?: SharedArrayBuffer` - Optional shared buffer for worker threads

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

#### `executeFile(payload, options?)`

Executes a BrightScript application payload.

**Parameters:**

- `payload: AppPayload` - Application payload to execute
- `options?: object` - Execution options

**Returns:** `Promise<{ exitReason: string, cipherText?: ArrayBuffer, iv?: Uint8Array }>`

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
