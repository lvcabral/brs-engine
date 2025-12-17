/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, getWorkerLibPath, saveDataBuffer } from "./util";
import {
    AppExitReason,
    AppPayload,
    BufferType,
    DataType,
    DebugCommand,
    DeviceInfo,
    NDKStart,
    RemoteType,
    TaskState,
    dataBufferIndex,
    dataBufferSize,
    getExitReason,
    isAppData,
    isNDKStart,
    isTaskData,
    isThreadUpdate,
    registryInitialSize,
    registryMaxSize,
    getNow,
    Platform,
    RegistryData,
    isRegistryData,
    isExtensionInfo,
} from "../core/common";
import {
    source,
    paths,
    manifestMap,
    currentApp,
    loadAppZip,
    createPayload,
    resetCurrentApp,
    deviceData,
    subscribePackage,
    setupDeepLink,
    getModelType,
} from "./package";
import {
    subscribeDisplay,
    initDisplayModule,
    updateBuffer,
    showDisplay,
    redrawDisplay,
    clearDisplay,
    statsUpdate,
    loadCaptionsFonts,
    setDisplayState,
    setCaptionMode,
    setAppCaptionStyle,
    setTrickPlayBar,
    setSupportCaptions,
} from "./display";
import {
    initSoundModule,
    addSound,
    resetSounds,
    addAudioPlaylist,
    muteSound,
    isSoundMuted,
    subscribeSound,
    switchSoundState,
    handleAudioEvent,
    handleSfxEvent,
    playHomeSound,
} from "./sound";
import {
    addVideo,
    addVideoPlaylist,
    handleVideoEvent,
    initVideoModule,
    isVideoMuted,
    muteVideo,
    resetVideo,
    subscribeVideo,
    switchVideoState,
} from "./video";
import { subscribeControl, initControlModule, enableSendKeys, sendKey } from "./control";
import { handleTaskData, handleThreadUpdate, initTaskModule, resetTasks, subscribeTask } from "./task";
import SharedObject from "../core/SharedObject";
import packageInfo from "../../packages/browser/package.json";

// Interpreter Library
const brsWrkLib = getWorkerLibPath();

// Package API
export { deviceData, loadAppZip, updateAppZip, getSerialNumber, mountExt, umountExt } from "./package";

// Control API
export {
    setControlMode,
    getControlMode,
    setCustomKeys,
    setCustomPadButtons,
    sendInput,
    setDebugState,
    getDebugState,
} from "./control";

// Display API
export {
    setDisplayMode,
    getDisplayMode,
    setOverscanMode,
    getOverscanMode,
    setCaptionMode,
    getCaptionMode,
    setCaptionStyle,
    enableStats,
    getScreenshot,
} from "./display";

// Common API
export { DeviceInfo, DefaultDeviceInfo, Platform, AppExitReason, SupportedExtension } from "../core/common";

let inDebugLib: boolean = false;
/// #if DEBUG
inDebugLib = true;
/// #endif

let clearDisplayOnExit: boolean = true;
let disableDebug: boolean = false;
let debugToConsole: boolean = true;
let showStats: boolean = false;

// roSystemLog Event support
let bandwidthMinute: boolean = false;
let bandwidthTimeout: NodeJS.Timeout | null = null;
let latestBandwidth: number = 0;
let httpConnectLog: boolean = false;

// App Workers and Shared Buffers
let brsWorker: Worker;
const registryBuffer = new SharedObject(registryInitialSize, registryMaxSize);
let sharedBuffer: ArrayBufferLike;
let sharedArray: Int32Array;
let currentPayload: AppPayload;

/**
 * Initializes the BrightScript engine with device configuration and options.
 * Sets up display, control, video, sound, and task modules.
 * @param customDeviceInfo Optional partial DeviceInfo to customize device configuration
 * @param options Optional configuration object with flags for debugging, stats, etc.
 */
export function initialize(customDeviceInfo?: Partial<DeviceInfo>, options: any = {}) {
    if (customDeviceInfo) {
        // Prevent hosting apps to override some device info keys
        const invalidKeys: (keyof DeviceInfo)[] = [
            "firmwareVersion",
            "registry",
            "registryBuffer",
            "models",
            "remoteControls",
            "audioCodecs",
            "videoFormats",
        ];
        for (const key of invalidKeys) {
            if (key in customDeviceInfo) {
                delete customDeviceInfo[key];
            }
        }
        Object.assign(deviceData, customDeviceInfo);
    }
    if (typeof options.disableDebug === "boolean") {
        disableDebug = options.disableDebug;
    }
    if (typeof options.debugToConsole === "boolean") {
        debugToConsole = options.debugToConsole;
    }
    const initMsg = `${packageInfo.title} - v${packageInfo.version}${inDebugLib ? " - dev" : ""}`;
    deviceDebug(`beacon,${initMsg}`);
    if (typeof options.showStats === "boolean") {
        showStats = options.showStats;
    }
    loadRegistry();
    // Shared buffer (Keys, Sounds and Debug Commands)
    const length = dataBufferIndex + dataBufferSize;
    try {
        sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
    } catch (error) {
        sharedBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
        apiException(
            "warning",
            `[api] Tasks threads and remote control simulation will not work as SharedArrayBuffer is not enabled, ` +
                `to know more visit https://developer.chrome.com/blog/enabling-shared-array-buffer/`
        );
    }
    sharedArray = new Int32Array(sharedBuffer);
    resetArray();
    // Initialize Display and Control modules
    initDisplayModule(deviceData, showStats);
    initControlModule(sharedArray, options);
    initVideoModule(sharedArray, deviceData, false);
    initTaskModule(sharedBuffer, brsWrkLib);
    // Subscribe Events
    subscribeDisplay("api", (event: string, data: any) => {
        if (event === "mode") {
            if (currentApp.running) {
                terminate(AppExitReason.Settings);
            }
            notifyAll("display", data);
        } else if (["redraw", "resolution"].includes(event)) {
            notifyAll(event, data);
        } else if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "debug") {
            deviceDebug(`debug,${data}`);
        }
    });
    subscribeControl("api", (event: string, data: any) => {
        if (event === "home") {
            if (currentApp.running) {
                playHomeSound();
            }
        } else if (event === "poweroff") {
            if (currentApp.running) {
                terminate(AppExitReason.PowerMode);
            }
        } else if (event === "volumemute") {
            setAudioMute(!getAudioMute());
        } else if (event === "control") {
            updateMemoryInfo();
            notifyAll(event, data);
        } else if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "debugState") {
            disableDebug = !data;
        }
    });
    subscribeSound("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "home") {
            terminate(AppExitReason.UserNav);
        }
    });
    subscribeVideo("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "bandwidth") {
            latestBandwidth = data;
        } else if (event === "http.connect" && httpConnectLog) {
            const sysLog = {
                type: event,
                url: data.responseURL,
                status: data.statusText,
                httpCode: data.status,
            };
            saveDataBuffer(sharedArray, JSON.stringify(sysLog), BufferType.SYS_LOG);
        }
    });
    subscribePackage("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "debug") {
            deviceDebug(`debug,${data}`);
        } else if (event === "mount") {
            Atomics.store(sharedArray, DataType.EVE, data);
        } else {
            notifyAll(event, data);
        }
    });
    subscribeTask("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else if (event === "message") {
            handleStringMessage(data);
        } else if (event === "ndkStart") {
            handleNDKStart(data);
        } else if (event === "registry") {
            handleRegistryUpdate(data);
        } else if (event === "captionMode") {
            notifyAll(event, data);
        } else if (event === "debug") {
            deviceDebug(`debug,${data}`);
        }
    });

    // Force library download during initialization
    brsWorker = new Worker(brsWrkLib);
    brsWorker.addEventListener("message", mainCallback);
    brsWorker.postMessage("getVersion");
    updateDeviceAssets();
}

// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to receive events from the BrightScript engine.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribe(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from receiving engine events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribe(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of an event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Executes a BrightScript application from a zip package or source file.
 * @param filePath Path to the file (used for identification)
 * @param fileData File data (Blob or similar)
 * @param options Optional execution options (clearDisplayOnExit, password, etc.)
 * @param deepLink Optional deep link parameters to pass to the app
 */
export function execute(filePath: string, fileData: any, options: any = {}, deepLink?: Map<string, string>) {
    setupCurrentApp(filePath);
    const fileName = filePath.split(/.*[\/|\\]/)[1] ?? filePath;
    const fileExt = filePath.split(".").pop()?.toLowerCase();
    source.length = 0;
    if (typeof options.clearDisplayOnExit === "boolean") {
        clearDisplayOnExit = options.clearDisplayOnExit;
    }
    if (typeof options.password === "string") {
        currentApp.password = options.password;
    }
    if (deepLink) {
        setupDeepLink(deepLink);
    }
    if (typeof options.entryPoint === "boolean") {
        deviceData.entryPoint = options.entryPoint;
    }
    if (disableDebug) {
        deviceData.debugOnCrash = false;
    } else if (typeof options.debugOnCrash === "boolean") {
        deviceData.debugOnCrash = options.debugOnCrash;
    }
    if (brsWorker !== undefined) {
        resetWorker();
    }
    deviceDebug(`beacon,Loading ${filePath}...`);
    initSoundModule(sharedArray, options.muteSound);
    muteVideo(options.muteSound);

    if (fileExt === "zip" || fileExt === "bpk") {
        loadAppZip(fileName, fileData, runApp);
    } else {
        loadSourceCode(fileName, fileData);
    }
}

/**
 * Finds the app in the device list and sets up the current app object.
 * @param filePath Path to the application file
 */
function setupCurrentApp(filePath: string) {
    if (deviceData.appList?.length) {
        const app = deviceData.appList.find((app) => app.path === filePath);
        if (app) {
            Object.assign(currentApp, app);
        } else {
            // Not in the list so is a side-loaded app
            currentApp.id = filePath.hashCode();
            currentApp.path = filePath;
        }
    } else {
        currentApp.id = filePath.hashCode();
        currentApp.path = filePath;
    }
}

/**
 * Terminates the currently running BrightScript application.
 * Cleans up resources, updates app state, and notifies observers.
 * @param reason Reason for termination (defaults to Unknown)
 */
export function terminate(reason: AppExitReason = AppExitReason.Unknown) {
    if (currentApp.running) {
        currentApp.running = false;
        currentApp.exitReason = reason;
        currentApp.exitTime = Date.now();
        bandwidthMinute = false;
        httpConnectLog = false;
        updateAppList();
        deviceDebug(`beacon,${getNow()} [beacon.report] |AppExitComplete\r\n`);
        deviceDebug(`print,------ Finished '${currentApp.title}' execution [${reason}] ------\r\n`);
    }
    if (clearDisplayOnExit) {
        clearDisplay(true);
    }
    resetWorker();
    resetCurrentApp();
    enableSendKeys(false);
    notifyAll("closed", reason);
}

/**
 * Returns the current version of the BrightScript engine API.
 * @returns Version string
 */
export function getVersion() {
    return packageInfo.version;
}

/**
 * Requests a redraw of the display canvas.
 * @param fullScreen Whether to render in fullscreen mode
 * @param width Optional canvas width
 * @param height Optional canvas height
 * @param dpr Optional device pixel ratio
 */
export function redraw(fullScreen: boolean, width?: number, height?: number, dpr?: number) {
    redrawDisplay(currentApp.running, fullScreen, width, height, dpr);
}

/**
 * Gets the current audio mute state (both sound and video).
 * @returns True if audio is muted
 */
export function getAudioMute() {
    return isSoundMuted() && isVideoMuted();
}
/**
 * Sets the audio mute state for both sound and video.
 * @param mute True to mute audio, false to unmute
 */
export function setAudioMute(mute: boolean) {
    if (currentApp.running) {
        muteSound(mute);
        muteVideo(mute);
    }
}

/**
 * Sends a key down event to the running application.
 * @param key Key name (e.g., "up", "select", "back")
 * @param remote Optional remote type (defaults to ECP)
 * @param index Optional remote index
 */
export function sendKeyDown(key: string, remote?: RemoteType, index?: number) {
    sendKey(key, 0, remote ?? RemoteType.ECP, index);
}
/**
 * Sends a key up event to the running application.
 * @param key Key name (e.g., "up", "select", "back")
 * @param remote Optional remote type (defaults to ECP)
 * @param index Optional remote index
 */
export function sendKeyUp(key: string, remote?: RemoteType, index?: number) {
    sendKey(key, 100, remote ?? RemoteType.ECP, index);
}
/**
 * Sends a key press (down + up) event to the running application.
 * @param key Key name (e.g., "up", "select", "back")
 * @param delay Delay in milliseconds between key down and up (defaults to 300ms)
 * @param remote Optional remote type (defaults to ECP)
 * @param index Optional remote index
 */
export function sendKeyPress(key: string, delay = 300, remote?: RemoteType, index?: number) {
    setTimeout(function () {
        sendKey(key, 100, remote ?? RemoteType.ECP, index);
    }, delay);
    sendKey(key, 0, remote ?? RemoteType.ECP, index);
}

/**
 * Sends a debug command to the running application.
 * Supports debugger commands like "break", "pause", or expressions.
 * @param command Debug command string
 * @returns True if the command was handled
 */
export function debug(command: string): boolean {
    let handled = false;
    if (!disableDebug && currentApp.running && command?.length) {
        const exprs = command.trim().split(/(?<=^\S+)\s/);
        if (exprs.length === 1 && ["break", "pause"].includes(exprs[0].toLowerCase())) {
            const cmd = exprs[0].toUpperCase() as keyof typeof DebugCommand;
            Atomics.store(sharedArray, DataType.DBG, DebugCommand[cmd]);
            Atomics.notify(sharedArray, DataType.DBG);
            handled = true;
        } else {
            saveDataBuffer(sharedArray, command.trim(), BufferType.DEBUG_EXPR);
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXPR);
            handled = Atomics.notify(sharedArray, DataType.DBG) > 0;
        }
    }
    return handled;
}

/**
 * Terminates and resets the BrightScript interpreter worker.
 * Cleans up all resources including tasks, sounds, and video.
 */
function resetWorker() {
    brsWorker.removeEventListener("message", mainCallback);
    brsWorker.terminate();
    resetTasks();
    resetArray();
    resetSounds(deviceData.assets);
    resetVideo();
}

/**
 * Resets the shared array buffer to initial state (-1 values).
 */
function resetArray() {
    sharedArray.some((_, index: number) => {
        Atomics.store(sharedArray, index, -1);
        return index === dataBufferIndex - 1;
    });
}

/**
 * Loads and parses a BrightScript source code file.
 * @param fileName Name of the source file
 * @param fileData File data as Blob or similar
 */
function loadSourceCode(fileName: string, fileData: any) {
    const reader = new FileReader();
    reader.onload = function (_) {
        if (typeof this.result === "string") {
            manifestMap.clear();
            manifestMap.set("title", "BRS File");
            manifestMap.set("major_version", "1");
            manifestMap.set("minor_version", "0");
            manifestMap.set("build_version", "0");
            manifestMap.set("splash_min_time", "0");
            currentApp.title = `BrightScript file: ${fileName}`;
            paths.length = 0;
            source.push(this.result);
            paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
            clearDisplay(true);
            runApp(createPayload(Date.now()));
        } else {
            apiException("error", `[api] Invalid data type in ${fileName}: ${typeof this.result}`);
        }
    };
    reader.readAsText(new Blob([fileData], { type: "text/plain" }));
}

/**
 * Executes the BrightScript application in a Web Worker.
 * @param payload AppPayload containing source code, manifest, and configuration
 */
function runApp(payload: AppPayload) {
    try {
        notifyAll("loaded", currentApp);
        showDisplay();
        currentApp.running = true;
        updateAppList();
        updateMemoryInfo();
        brsWorker = new Worker(brsWrkLib);
        brsWorker.addEventListener("message", mainCallback);
        brsWorker.postMessage(sharedBuffer);
        brsWorker.postMessage(payload);
        currentPayload = payload;
        enableSendKeys(true);
    } catch (err: any) {
        apiException("error", `[api] Error running ${currentApp.title}: ${err.message}`);
    }
}

/**
 * Loads device assets (common.zip) if not already loaded.
 * Fetches from assets directory and loads caption fonts.
 */
function updateDeviceAssets() {
    if (deviceData.assets.byteLength) {
        return;
    }
    fetch(`./assets/common.zip?v=${packageInfo.version}`)
        .then(async function (response) {
            if (response.status === 200 || response.status === 0) {
                return response.blob().then(function (zipBlob) {
                    zipBlob.arrayBuffer().then(function (zipData) {
                        deviceData.assets = zipData;
                        loadCaptionsFonts(zipData);
                    });
                });
            } else {
                throw new Error(response.statusText);
            }
        })
        .catch((err) => {
            apiException("error", `[api] Error loading common.zip: ${err.message}`);
        });
}

/**
 * Updates the app in the device app list with current app state.
 * Synchronizes currentApp object with deviceData.appList.
 */
export function updateAppList() {
    if (deviceData.appList?.length) {
        const app = deviceData.appList.find((app) => app.id === currentApp.id);
        if (app) {
            Object.assign(app, currentApp);
        }
    }
}

/**
 * Updates memory usage information in the shared array.
 * Uses provided values or queries Chromium performance.memory API.
 * @param usedMemory Optional used memory in KB
 * @param totalMemory Optional total memory in KB
 */
export function updateMemoryInfo(usedMemory?: number, totalMemory?: number) {
    if (currentApp.running && usedMemory && totalMemory) {
        Atomics.store(sharedArray, DataType.MUHS, usedMemory);
        Atomics.store(sharedArray, DataType.MHSL, totalMemory);
        return;
    }
    const performance = globalThis.performance as ChromiumPerformance;
    if (currentApp.running && Platform.inChromium && performance.memory) {
        // Only Chromium based browsers support process.memory API
        const memory = performance.memory;
        Atomics.store(sharedArray, DataType.MUHS, Math.floor(memory.usedJSHeapSize / 1024));
        Atomics.store(sharedArray, DataType.MHSL, Math.floor(memory.jsHeapSizeLimit / 1024));
    }
}

/**
 * Loads the device registry from browser localStorage.
 * Filters by developerId and removes transient keys.
 */
function loadRegistry() {
    const storage: Storage = globalThis.localStorage;
    const transientKeys: string[] = [];
    const registry: Map<string, string> = new Map();
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.split(".")[0] === deviceData.developerId) {
            if (key.split(".")[1] === "Transient") {
                transientKeys.push(key);
            } else {
                registry.set(key, storage.getItem(key) ?? "");
            }
        }
    }
    for (const key of transientKeys) {
        storage.removeItem(key);
    }
    registryBuffer.store(Object.fromEntries(registry));
    deviceData.registryBuffer = registryBuffer.getBuffer();
    notifyAll("registry", registry);
}

/**
 * Handles messages received from the main interpreter Web Worker.
 * Routes different message types to appropriate handlers.
 * @param event MessageEvent from the worker
 */
function mainCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        updateBuffer(event.data);
    } else if (isRegistryData(event.data)) {
        handleRegistryUpdate(event.data);
    } else if (isExtensionInfo(event.data)) {
        deviceDebug(
            `beacon,Loaded Extension: ${event.data.name} (v${event.data.version}) from ${event.data.library}\r\n`
        );
    } else if (Platform.inBrowser && Array.isArray(event.data.audioPlaylist)) {
        addAudioPlaylist(event.data.audioPlaylist);
    } else if (Platform.inBrowser && event.data.audioPath) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (Platform.inBrowser && Array.isArray(event.data.videoPlaylist)) {
        addVideoPlaylist(event.data.videoPlaylist);
    } else if (Platform.inBrowser && event.data.videoPath) {
        addVideo(event.data.videoPath, new Blob([event.data.videoData], { type: "video/mp4" }));
    } else if (typeof event.data.displayEnabled === "boolean") {
        setDisplayState(event.data.displayEnabled);
    } else if (typeof event.data.captionMode === "string") {
        if (setCaptionMode(event.data.captionMode)) {
            notifyAll("captionMode", event.data.captionMode);
        }
    } else if (typeof event.data.supportCaptions === "boolean") {
        setSupportCaptions(event.data.supportCaptions);
    } else if (Array.isArray(event.data.captionStyle)) {
        setAppCaptionStyle(event.data.captionStyle);
    } else if (typeof event.data.trickPlayBarVisible === "boolean") {
        setTrickPlayBar(event.data.trickPlayBarVisible);
    } else if (isAppData(event.data)) {
        notifyAll("launch", { app: event.data.id, params: event.data.params ?? new Map() });
    } else if (isTaskData(event.data)) {
        deviceDebug(
            `debug,[API] Task data received from Main Thread: ${event.data.name}, ${TaskState[event.data.state]}`
        );
        handleTaskData(event.data, currentPayload);
    } else if (isThreadUpdate(event.data)) {
        deviceDebug(
            `debug,[API] Update received from Main thread: ${event.data.id}, ${event.data.type}, ${event.data.field}`
        );
        handleThreadUpdate(event.data);
    } else if (isNDKStart(event.data)) {
        handleNDKStart(event.data);
    } else if (typeof event.data === "string") {
        // All messages beyond this point must be csv string
        handleStringMessage(event.data);
    } else if (inDebugLib) {
        apiException("warning", `[api] Invalid worker message: ${JSON.stringify(event.data, null, 2)}`);
    }
}

/**
 * Handles NDK start commands (roku_browser, SDKLauncher).
 * Notifies observers about browser launches or app launches.
 * @param data NDKStart object with app name and parameters
 */
function handleNDKStart(data: NDKStart) {
    if (data.app === "roku_browser") {
        const params = data.params;
        let winDim = deviceData.displayMode === "1080p" ? [1920, 1080] : [1280, 720];
        const windowSize = params.find((el) => {
            if (el.toLowerCase().startsWith("windowsize=")) {
                return true;
            }
            return false;
        });
        if (windowSize) {
            const dims = windowSize.replaceAll('"', "").split("=")[1]?.split("x");
            if (
                dims?.length === 2 &&
                !Number.isNaN(Number.parseInt(dims[0])) &&
                !Number.isNaN(Number.parseInt(dims[1]))
            ) {
                winDim = dims.map((el) => Number.parseInt(el));
            }
        }
        const url = params.find((el) => el.startsWith("url="))?.slice(4) ?? "";
        notifyAll("browser", { url: url, width: winDim[0], height: winDim[1] });
    } else if (data.app === "SDKLauncher") {
        let appId = "";
        const params = new Map();
        if (data.params.length > 0) {
            for (const el of data.params) {
                const [key, value] = el.split("=");
                if (key && value && key.toLowerCase() === "channelid") {
                    appId = value;
                } else if (key && value) {
                    params.set(key, value);
                }
            }
        }
        if (appId) {
            notifyAll("launch", { app: appId, params: params });
        } else {
            apiException("warning", `[api] NDKLauncher:  SDKLauncher "channelId" parameter not found!`);
        }
    }
}

/**
 * Handles registry updates from the interpreter.
 * Stores changes to localStorage and notifies observers.
 * @param registry RegistryData object with current and removed keys
 */
function handleRegistryUpdate(registry: RegistryData) {
    if (Platform.inBrowser) {
        const storage: Storage = globalThis.localStorage;
        for (const key of registry.removed) {
            storage.removeItem(key);
        }
        for (const [key, value] of registry.current) {
            storage.setItem(key, value);
        }
    }
    notifyAll("registry", registry.current);
}

/**
 * Handles string-based messages from the interpreter.
 * Routes messages by prefix (audio, video, print, debug, etc.).
 * @param message String message from the interpreter
 */
function handleStringMessage(message: string) {
    if (message.startsWith("audio,")) {
        handleAudioEvent(message);
    } else if (message.startsWith("sfx,")) {
        handleSfxEvent(message);
    } else if (message.startsWith("video,")) {
        handleVideoEvent(message);
    } else if (message.startsWith("print,")) {
        deviceDebug(message);
    } else if (message.startsWith("warning,")) {
        deviceDebug(`${message}\r\n`);
    } else if (message.startsWith("error,")) {
        deviceDebug(`${message}\r\n`);
    } else if (message.startsWith("command,")) {
        const command = message.slice(8);
        const enable = command === "continue";
        enableSendKeys(enable);
        statsUpdate(enable);
        switchSoundState(enable);
        switchVideoState(enable);
        notifyAll("debug", { level: command });
    } else if (message.startsWith("start,")) {
        const title = currentApp.title;
        const beaconMsg = "[scrpt.ctx.run.enter] UI: Entering";
        const subName = message.split(",")[1];
        deviceDebug(`print,------ Running dev '${title}' ${subName} ------\r\n`);
        deviceDebug(`beacon,${getNow()} ${beaconMsg} '${title}', id '${currentApp.id}'\r\n`);
        statsUpdate(true);
        notifyAll("started", currentApp);
    } else if (message.startsWith("end,")) {
        terminate(getExitReason(message.slice(4)));
    } else if (message.startsWith("syslog,")) {
        const type = message.slice(7);
        if (type === "bandwidth.minute") {
            bandwidthMinute = true;
            if (latestBandwidth === 0) {
                measureBandwidth();
            }
            if (!bandwidthTimeout) {
                updateBandwidth();
            }
        } else if (type === "http.connect") {
            httpConnectLog = true;
        }
    } else if (message === "reset") {
        notifyAll("reset");
    } else if (message.startsWith("version,")) {
        notifyAll("version", message.slice(8));
    }
}

/**
 * Updates bandwidth measurement in shared array every 60 seconds.
 * Runs continuously while bandwidthMinute logging is enabled.
 */
function updateBandwidth() {
    if (currentApp.running && bandwidthMinute && latestBandwidth >= 0) {
        Atomics.store(sharedArray, DataType.MBWD, latestBandwidth);
    }
    bandwidthTimeout = setTimeout(updateBandwidth, 60000);
}

/**
 * Measures network bandwidth by downloading a test file.
 * Calculates download speed in kbps and stores result.
 */
async function measureBandwidth() {
    const testFileUrl = `https://brsfiddle.net/images/bmp-example-file-download-1024x1024.bmp?v=${Date.now()}`;
    const startTime = Date.now();

    try {
        const response = await fetch(testFileUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get reader from response body");
        }
        let receivedLength = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            receivedLength += value.length;
        }
        const endTime = Date.now();
        const timeElapsed = (endTime - startTime) / 1000;
        // Calculate download speed in kbps
        const downloadSpeed = (receivedLength * 8) / timeElapsed / 1024;

        latestBandwidth = Math.round(downloadSpeed);
    } catch (error: any) {
        apiException("warning", `Error measuring bandwidth: ${error.message}`);
    }
}

/**
 * Handles debug messages from the device/interpreter.
 * Routes messages to console and observers based on level.
 * @param data Debug message in format "level,content"
 */
function deviceDebug(data: string) {
    if (disableDebug) {
        return;
    }
    const level = data.split(",")[0];
    const content = data.slice(level.length + 1);
    if (debugToConsole) {
        if (level === "error") {
            console.error(content);
        } else if (level === "warning") {
            console.warn(content);
        } else if (level === "beacon") {
            console.info(`%c${content}`, "color: #4A90E2");
        } else if (level === "debug" && inDebugLib) {
            console.debug(`%c${content}`, "color: #888888");
        } else if (level === "print") {
            console.log(content);
        } else {
            // unknown level
            return;
        }
    }
    // Send debug event to host application
    notifyAll("debug", { level: level, content: content });
}

/**
 * Handles API exceptions and errors.
 * Logs to console and notifies observers of errors.
 * @param level Error level ("error" or "warning")
 * @param message Error message
 */
function apiException(level: string, message: string) {
    if (level === "error") {
        console.error(message);
        notifyAll("error", message);
    } else {
        console.warn(message);
    }
}

// HDMI/CEC Status Update
globalThis.onfocus = function () {
    if (currentApp.running) {
        if (getModelType() !== "TV") {
            Atomics.store(sharedArray, DataType.HDMI, 1);
        }
        Atomics.store(sharedArray, DataType.CEC, 1);
    }
};

globalThis.onblur = function () {
    if (currentApp.running) {
        if (getModelType() !== "TV") {
            Atomics.store(sharedArray, DataType.HDMI, 0);
        }
        Atomics.store(sharedArray, DataType.CEC, 0);
    }
};
