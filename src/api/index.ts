/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, getNow, getWorkerLibPath, saveDataBuffer } from "./util";

import {
    AppExitReason,
    AppPayload,
    DataType,
    DebugCommand,
    DeviceInfo,
    RemoteType,
    dataBufferIndex,
    dataBufferSize,
    getExitReason,
    isAppData,
    isNDKStart,
    platform,
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
} from "./package";
import {
    subscribeDisplay,
    initDisplayModule,
    updateBuffer,
    showDisplay,
    redrawDisplay,
    clearDisplay,
    statsUpdate,
} from "./display";
import {
    initSoundModule,
    addSound,
    resetSounds,
    addSoundPlaylist,
    muteSound,
    isSoundMuted,
    subscribeSound,
    switchSoundState,
    handleSoundEvent,
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
import packageInfo from "../../package.json";

// Interpreter Library
const brsWrkLib = getWorkerLibPath();
let brsWorker: Worker;
let home: Howl;

// Package API
export {
    deviceData,
    loadAppZip,
    updateAppZip,
    getSerialNumber,
    mountExt,
    umountExt,
} from "./package";

// Control API
export { setControlMode, getControlMode, setCustomKeys, setCustomPadButtons } from "./control";

// Display API
export {
    setDisplayMode,
    getDisplayMode,
    setOverscanMode,
    getOverscanMode,
    enableStats,
} from "./display";

let clearDisplayOnExit: boolean = true;
let disableDebug: boolean = false;
let debugToConsole: boolean = true;
let showStats: boolean = false;

// App Shared Buffer
let sharedBuffer: SharedArrayBuffer | ArrayBuffer;
let sharedArray: Int32Array;

// API Methods
export function initialize(customDeviceInfo?: Partial<DeviceInfo>, options: any = {}) {
    if (customDeviceInfo) {
        const invalidKeys = [
            "firmware",
            "registry",
            "models",
            "audioCodecs",
            "videoFormats",
            "fonts",
            "password",
            "platform",
        ];
        invalidKeys.forEach((key) => {
            if (key in customDeviceInfo) {
                delete customDeviceInfo[key];
            }
        });
        Object.assign(deviceData, customDeviceInfo);
    }
    let initMsg = `${packageInfo.title} - v${packageInfo.version}`;
    /// #if DEBUG
    initMsg += " - dev";
    /// #endif
    if (typeof options.disableDebug === "boolean") {
        disableDebug = options.disableDebug;
    }
    if (typeof options.debugToConsole === "boolean") {
        debugToConsole = options.debugToConsole;
    }
    if (debugToConsole) {
        console.info(initMsg);
    }
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
            `[api] Remote control simulation will not work as SharedArrayBuffer is not enabled, ` +
                `to know more visit https://developer.chrome.com/blog/enabling-shared-array-buffer/`
        );
    }
    sharedArray = new Int32Array(sharedBuffer);
    resetArray();

    // Initialize Display and Control modules
    initDisplayModule(deviceData.displayMode, showStats);
    initControlModule(sharedArray, options);
    initVideoModule(sharedArray, false);
    // Subscribe Events
    subscribeDisplay("api", (event: string, data: any) => {
        if (event === "mode") {
            deviceData.displayMode = data;
            if (currentApp.running) {
                terminate(AppExitReason.SETTINGS);
            }
            notifyAll("display", data);
        } else if (["redraw", "resolution"].includes(event)) {
            notifyAll(event, data);
        } else if (["error", "warning"].includes(event)) {
            apiException(event, data);
        }
    });
    subscribeControl("api", (event: string, data: any) => {
        if (event === "home") {
            if (currentApp.running) {
                if (!home) {
                    home = new Howl({ src: ["./audio/select.wav"] });
                    home.on("play", function () {
                        terminate(AppExitReason.FINISHED);
                    });
                }
                home.play();
            }
        } else if (event === "poweroff") {
            if (currentApp.running) {
                terminate(AppExitReason.POWER);
            }
        } else if (event === "volumemute") {
            setAudioMute(!getAudioMute());
        } else if (event === "control") {
            notifyAll(event, data);
        } else if (["error", "warning"].includes(event)) {
            apiException(event, data);
        }
    });
    subscribeSound("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        }
    });
    subscribeVideo("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        }
    });
    subscribePackage("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else {
            notifyAll(event, data);
        }
    });

    // Force library download during initialization
    brsWorker = new Worker(brsWrkLib);
    brsWorker.addEventListener("message", workerCallback);
    brsWorker.postMessage("getVersion");
}

// Observers Handling
const observers = new Map();
export function subscribe(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribe(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Execute App Zip or Source File
export function execute(
    filePath: string,
    fileData: any,
    options: any = {},
    deepLink?: Map<string, string>
) {
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
    if (typeof brsWorker !== "undefined") {
        resetWorker();
    }
    if (debugToConsole) {
        console.info(`Loading ${filePath}...`);
    }
    initSoundModule(sharedArray, deviceData.maxSimulStreams, options.muteSound);
    muteVideo(options.muteSound);

    if (fileExt === "zip" || fileExt === "bpk") {
        loadAppZip(fileName, fileData, runApp);
    } else {
        loadSourceCode(fileName, fileData);
    }
}

// Function to find the App and setup Current App object
function setupCurrentApp(filePath: string) {
    if (deviceData.appList?.length) {
        const app = deviceData.appList.find((app) => app.path === filePath);
        if (app) {
            Object.assign(currentApp, app);
        } else {
            // Not in the list so is a side-loaded app
            currentApp.id = "dev";
            const dev = deviceData.appList.find((app) => app.id === "dev");
            if (dev) {
                dev.path = filePath;
                currentApp.path = filePath;
                currentApp.exitReason = dev.exitReason ?? AppExitReason.UNKNOWN;
            } else {
                deviceData.appList.push({
                    id: "dev",
                    title: currentApp.title,
                    version: currentApp.version,
                    path: filePath,
                });
            }
        }
    } else {
        currentApp.id = filePath.hashCode();
        currentApp.path = filePath;
    }
}

// Restore engine state and terminate Worker
export function terminate(reason: AppExitReason = AppExitReason.UNKNOWN) {
    if (currentApp.running) {
        currentApp.running = false;
        currentApp.exitReason = reason;
        updateAppList();
        deviceDebug(`beacon,${getNow()} [beacon.report] |AppExitComplete\r\n`);
        deviceDebug(`print,------ Finished '${currentApp.title}' execution [${reason}] ------\r\n`);
    }
    if (clearDisplayOnExit) {
        clearDisplay();
    }
    resetWorker();
    resetCurrentApp();
    enableSendKeys(false);
    notifyAll("closed", reason);
}

// Returns API library version
export function getVersion() {
    return packageInfo.version;
}

// Display API
export function redraw(fullScreen: boolean, width?: number, height?: number, dpr?: number) {
    redrawDisplay(currentApp.running, fullScreen, width, height, dpr);
}

// Audio API
export function getAudioMute() {
    return isSoundMuted() && isVideoMuted();
}
export function setAudioMute(mute: boolean) {
    if (currentApp.running) {
        muteSound(mute);
        muteVideo(mute);
    }
}

// Remote Control API
export function sendKeyDown(key: string, remote?: RemoteType, index?: number) {
    sendKey(key, 0, remote ?? RemoteType.ECP, index);
}
export function sendKeyUp(key: string, remote?: RemoteType, index?: number) {
    sendKey(key, 100, remote ?? RemoteType.ECP, index);
}
export function sendKeyPress(key: string, delay = 300, remote?: RemoteType, index?: number) {
    setTimeout(function () {
        sendKey(key, 100, remote ?? RemoteType.ECP, index);
    }, delay);
    sendKey(key, 0, remote ?? RemoteType.ECP, index);
}

// Telnet Debug API
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
            saveDataBuffer(sharedArray, command.trim());
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXPR);
            handled = Atomics.notify(sharedArray, DataType.DBG) > 0;
        }
    }
    return handled;
}

// Terminate and reset BrightScript interpreter
function resetWorker() {
    brsWorker.removeEventListener("message", workerCallback);
    brsWorker.terminate();
    resetArray();
    resetSounds();
    resetVideo();
}

function resetArray() {
    sharedArray.some((_, index: number) => {
        Atomics.store(sharedArray, index, -1);
        return index === dataBufferIndex - 1;
    });
}

// Open source file
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
            manifestMap.set("requires_audiometadata", "1");
            currentApp.title = `BrightScript file: ${fileName}`;
            paths.length = 0;
            source.push(this.result);
            paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
            clearDisplay();
            runApp(createPayload(Date.now()));
        } else {
            apiException("error", `[api] Invalid data type in ${fileName}: ${typeof this.result}`);
        }
    };
    reader.readAsText(new Blob([fileData], { type: "text/plain" }));
}

// Execute Engine Web Worker
function runApp(payload: AppPayload) {
    try {
        notifyAll("loaded", currentApp);
        showDisplay();
        currentApp.running = true;
        updateAppList();
        brsWorker = new Worker(brsWrkLib);
        brsWorker.addEventListener("message", workerCallback);
        brsWorker.postMessage(sharedBuffer);
        const transfArray = [];
        if (!manifestMap.get("bs_libs_required")?.includes("Roku_Browser") && payload.pkgZip) {
            // Transfer array to prevent cloning the zip data in worker (if not needed on main thread)
            transfArray.push(payload.pkgZip);
        }
        brsWorker.postMessage(payload, transfArray);
        enableSendKeys(true);
    } catch (err: any) {
        apiException("error", `[api] Error running ${currentApp.title}: ${err.message}`);
    }
}

// Update App in the App List from the Current App object
export function updateAppList() {
    if (deviceData.appList?.length) {
        const app = deviceData.appList.find((app) => app.id === currentApp.id);
        if (app) {
            Object.assign(app, currentApp);
        }
    }
}

// Load device Registry from Local Storage
function loadRegistry() {
    const storage: Storage = window.localStorage;
    const transientKeys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.split(".")[0] === deviceData.developerId) {
            if (key.split(".")[1] !== "Transient") {
                deviceData.registry?.set(key, storage.getItem(key) ?? "");
            } else {
                transientKeys.push(key);
            }
        }
    }
    transientKeys.forEach((key) => storage.removeItem(key));
}

// Receive Messages from the Interpreter (Web Worker)
function workerCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        updateBuffer(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        if (platform.inBrowser) {
            const storage: Storage = window.localStorage;
            deviceData.registry.forEach(function (value: string, key: string) {
                storage.setItem(key, value);
            });
        }
        notifyAll("registry", event.data);
    } else if (event.data instanceof Array) {
        addSoundPlaylist(event.data);
    } else if (event.data.audioPath && platform.inBrowser) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (event.data.videoPlaylist && platform.inBrowser) {
        if (event.data.videoPlaylist instanceof Array) {
            addVideoPlaylist(event.data.videoPlaylist);
        }
    } else if (event.data.videoPath && platform.inBrowser) {
        addVideo(event.data.videoPath, new Blob([event.data.videoData], { type: "video/mp4" }));
    } else if (isAppData(event.data)) {
        notifyAll("launch", { app: event.data.id, params: event.data.params ?? new Map() });
    } else if (isNDKStart(event.data)) {
        if (event.data.app === "roku_browser") {
            const params = event.data.params;
            let winDim = deviceData.displayMode === "1080p" ? [1920, 1080] : [1280, 720];
            const windowSize = params.find((el) => {
                if (el.toLowerCase().startsWith("windowsize")) {
                    return true;
                }
                return false;
            });
            if (windowSize) {
                const dims = windowSize.split("=")[1]?.split("x");
                if (dims?.length === 2 && !isNaN(parseInt(dims[0])) && !isNaN(parseInt(dims[1]))) {
                    winDim = dims.map((el) => parseInt(el));
                }
            }
            const url = params.find((el) => el.startsWith("url="))?.split("=")[1] ?? "";
            notifyAll("browser", { url: url, width: winDim[0], height: winDim[1] });
        } else if (event.data.app === "SDKLauncher") {
            const channelId = event.data.params
                .find((el) => el.toLowerCase().startsWith("channelid="))
                ?.split("=")[1];
            const app = deviceData.appList?.find((app) => app.id === channelId);
            if (app) {
                const params = new Map();
                event.data.params.forEach((el) => {
                    const [key, value] = el.split("=");
                    if (key && value && key.toLowerCase() !== "channelid") {
                        params.set(key, value);
                    }
                });
                notifyAll("launch", { app: app.id, params: params });
            }
        }
    } else if (typeof event.data !== "string") {
        // All messages beyond this point must be csv string
        apiException("warning", `[api] Invalid worker message: ${event.data}`);
    } else if (event.data.startsWith("audio,")) {
        handleSoundEvent(event.data);
    } else if (event.data.startsWith("video,")) {
        handleVideoEvent(event.data);
    } else if (event.data.startsWith("print,")) {
        deviceDebug(event.data);
    } else if (event.data.startsWith("warning,")) {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.startsWith("error,")) {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.startsWith("debug,")) {
        const level = event.data.slice(6);
        const enable = level === "continue";
        enableSendKeys(enable);
        statsUpdate(enable);
        switchSoundState(enable);
        switchVideoState(enable);
        notifyAll("debug", { level: level });
    } else if (event.data.startsWith("start,")) {
        const title = currentApp.title;
        const beaconMsg = "[scrpt.ctx.run.enter] UI: Entering";
        const subName = event.data.split(",")[1];
        deviceDebug(`print,------ Running dev '${title}' ${subName} ------\r\n`);
        deviceDebug(`beacon,${getNow()} ${beaconMsg} '${title}', id '${currentApp.id}'\r\n`);
        statsUpdate(true);
        notifyAll("started", currentApp);
    } else if (event.data.startsWith("end,")) {
        terminate(getExitReason(event.data.slice(4)));
    } else if (event.data === "reset") {
        notifyAll("reset");
    } else if (event.data.startsWith("version,")) {
        notifyAll("version", event.data.slice(8));
    }
}

// Debug Messages Handler
function deviceDebug(data: string) {
    if (disableDebug) {
        return;
    }
    const level = data.split(",")[0];
    const content = data.slice(level.length + 1);
    notifyAll("debug", { level: level, content: content });
    if (debugToConsole) {
        if (level === "error") {
            console.error(content);
        } else if (level === "warning") {
            console.warn(content);
        } else if (level === "beacon") {
            console.info(content);
        } else {
            console.log(content);
        }
    }
}

// API Exceptions Handler
function apiException(level: string, message: string) {
    if (level === "error") {
        console.error(message);
        notifyAll("error", message);
    } else {
        console.warn(message);
    }
}
