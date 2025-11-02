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
    TaskData,
    TaskPayload,
    TaskState,
    dataBufferIndex,
    dataBufferSize,
    getExitReason,
    isAppData,
    isNDKStart,
    isTaskData,
    isThreadUpdate,
    platform,
    registryInitialSize,
    registryMaxSize,
    getNow,
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
const tasks: Map<number, Worker> = new Map();
const threadSyncToTask: Map<number, SharedObject> = new Map();
const threadSyncToMain: Map<number, SharedObject> = new Map();
const registryBuffer = new SharedObject(registryInitialSize, registryMaxSize);
let sharedBuffer: ArrayBufferLike;
let sharedArray: Int32Array;

// API Methods
export function initialize(customDeviceInfo?: Partial<DeviceInfo>, options: any = {}) {
    if (customDeviceInfo) {
        const invalidKeys = [
            "firmware",
            "registry",
            "registryBuffer",
            "models",
            "remoteControls",
            "audioCodecs",
            "videoFormats",
            "fonts",
            "password",
            "platform",
        ];
        for (const key of invalidKeys) {
            if (key in customDeviceInfo) {
                delete customDeviceInfo[key];
            }
        }
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
    // Subscribe Events
    subscribeDisplay("api", (event: string, data: any) => {
        if (event === "mode") {
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
                playHomeSound();
            }
        } else if (event === "poweroff") {
            if (currentApp.running) {
                terminate(AppExitReason.POWER);
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
            terminate(AppExitReason.FINISHED);
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
        } else {
            notifyAll(event, data);
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
export function subscribe(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribe(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// Execute App Zip or Source File
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
    if (typeof brsWorker !== "undefined") {
        resetWorker();
    }
    if (debugToConsole) {
        console.info(`Loading ${filePath}...`);
    }
    initSoundModule(sharedArray, options.muteSound);
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
            currentApp.id = filePath.hashCode();
            currentApp.path = filePath;
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
            saveDataBuffer(sharedArray, command.trim(), BufferType.DEBUG_EXPR);
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXPR);
            handled = Atomics.notify(sharedArray, DataType.DBG) > 0;
        }
    }
    return handled;
}

// Terminate and reset BrightScript interpreter
function resetWorker() {
    brsWorker.removeEventListener("message", mainCallback);
    brsWorker.terminate();
    for (const [_id, worker] of tasks) {
        worker?.removeEventListener("message", taskCallback);
        worker?.terminate();
    }
    tasks.clear();
    threadSyncToTask.clear();
    threadSyncToMain.clear();
    resetArray();
    resetSounds(deviceData.assets);
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

let currentPayload: AppPayload;
// Execute Engine Web Worker
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

function runTask(taskData: TaskData) {
    if (tasks.has(taskData.id) || !taskData.m?.top?.functionname) {
        return;
    } else if (tasks.size === 10) {
        apiException("warning", `[api] Maximum number of tasks reached: ${tasks.size}`);
        return;
    }
    const taskWorker = new Worker(brsWrkLib);
    taskWorker.addEventListener("message", taskCallback);
    tasks.set(taskData.id, taskWorker);
    if (!threadSyncToTask.has(taskData.id)) {
        threadSyncToTask.set(taskData.id, new SharedObject());
    }
    taskData.buffer = threadSyncToTask.get(taskData.id)?.getBuffer();
    const taskPayload: TaskPayload = {
        device: currentPayload.device,
        manifest: currentPayload.manifest,
        taskData: taskData,
        pkgZip: currentPayload.pkgZip,
        extZip: currentPayload.extZip,
    };
    console.debug("[API] Calling Task worker: ", taskData.id, taskData.name);
    taskWorker.postMessage(sharedBuffer);
    taskWorker.postMessage(taskPayload);
}

function endTask(taskId: number) {
    const taskWorker = tasks.get(taskId);
    if (taskWorker) {
        taskWorker.removeEventListener("message", taskCallback);
        taskWorker.terminate();
        tasks.delete(taskId);
        threadSyncToTask.delete(taskId);
        threadSyncToMain.delete(taskId);
        console.debug("[API] Task worker stopped: ", taskId);
    }
}
// Load Device Assets
function updateDeviceAssets() {
    if (deviceData.assets.byteLength) {
        return;
    }
    fetch("./assets/common.zip")
        .then(async function (response) {
            if (response.status === 200 || response.status === 0) {
                return response.blob().then(function (zipBlob) {
                    zipBlob.arrayBuffer().then(function (zipData) {
                        deviceData.assets = zipData;
                        loadCaptionsFonts(zipData);
                    });
                });
            } else {
                return Promise.reject(new Error(response.statusText));
            }
        })
        .catch((err) => {
            apiException("error", `[api] Error loading common.zip: ${err.message}`);
        });
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

// Update Memory Usage on Shared Array
export function updateMemoryInfo(usedMemory?: number, totalMemory?: number) {
    if (currentApp.running && usedMemory && totalMemory) {
        Atomics.store(sharedArray, DataType.MUHS, usedMemory);
        Atomics.store(sharedArray, DataType.MHSL, totalMemory);
        return;
    }
    const performance = globalThis.performance as ChromiumPerformance;
    if (currentApp.running && platform.inChromium && performance.memory) {
        // Only Chromium based browsers support process.memory API
        const memory = performance.memory;
        Atomics.store(sharedArray, DataType.MUHS, Math.floor(memory.usedJSHeapSize / 1024));
        Atomics.store(sharedArray, DataType.MHSL, Math.floor(memory.jsHeapSizeLimit / 1024));
    }
}

// Load device Registry from Local Storage
function loadRegistry() {
    const storage: Storage = globalThis.localStorage;
    const transientKeys: string[] = [];
    const registry: Map<string, string> = new Map();
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.split(".")[0] === deviceData.developerId) {
            if (key.split(".")[1] !== "Transient") {
                registry.set(key, storage.getItem(key) ?? "");
            } else {
                transientKeys.push(key);
            }
        }
    }
    for (const key of transientKeys) {
        storage.removeItem(key);
    }
    registryBuffer.store(Object.fromEntries(registry));
    deviceData.registryBuffer = registryBuffer.getBuffer();
}

// Receive Messages from the Main Interpreter (Web Worker)
function mainCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        updateBuffer(event.data);
    } else if (event.data instanceof Map) {
        if (platform.inBrowser) {
            const storage: Storage = globalThis.localStorage;
            for (const [key, value] of event.data) {
                storage.setItem(key, value);
            }
        }
        notifyAll("registry", event.data);
    } else if (platform.inBrowser && Array.isArray(event.data.audioPlaylist)) {
        addAudioPlaylist(event.data.audioPlaylist);
    } else if (platform.inBrowser && event.data.audioPath) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (platform.inBrowser && Array.isArray(event.data.videoPlaylist)) {
        addVideoPlaylist(event.data.videoPlaylist);
    } else if (platform.inBrowser && event.data.videoPath) {
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
        console.debug("[API] Task data received from Main Thread: ", event.data.name, TaskState[event.data.state]);
        if (event.data.state === TaskState.RUN) {
            if (event.data.buffer instanceof SharedArrayBuffer) {
                const taskBuffer = new SharedObject();
                taskBuffer.setBuffer(event.data.buffer);
                threadSyncToMain.set(event.data.id, taskBuffer);
            }
            runTask(event.data);
        } else if (event.data.state === TaskState.STOP) {
            endTask(event.data.id);
        }
    } else if (isThreadUpdate(event.data)) {
        console.debug("[API] Update received from Main thread: ", event.data.id, event.data.type, event.data.field);
        if (event.data.id > 0) {
            if (!threadSyncToTask.has(event.data.id)) {
                threadSyncToTask.set(event.data.id, new SharedObject());
            }
            threadSyncToTask.get(event.data.id)?.waitStore(event.data, 1);
        } else if (event.data.type !== "task") {
            for (let taskId = 1; taskId <= tasks.size; taskId++) {
                const data = { ...event.data, id: taskId };
                if (!threadSyncToTask.has(data.id)) {
                    threadSyncToTask.set(data.id, new SharedObject());
                }
                threadSyncToTask.get(data.id)?.waitStore(data, 1);
            }
        } else {
            console.debug("[API] Thread update from Main with invalid data!");
        }
    } else if (isNDKStart(event.data)) {
        handleNDKStart(event.data);
    } else if (typeof event.data !== "string") {
        // All messages beyond this point must be csv string
        apiException("warning", `[api] Invalid worker message: ${JSON.stringify(event.data)}`);
    } else {
        handleStringMessage(event.data);
    }
}

// Receive Messages from the Task Interpreter (Web Worker)
function taskCallback(event: MessageEvent) {
    if (event.data instanceof Map) {
        if (platform.inBrowser) {
            const storage: Storage = window.localStorage;
            for (const [key, value] of event.data) {
                storage.setItem(key, value);
            }
        }
        notifyAll("registry", event.data);
    } else if (typeof event.data.displayEnabled === "boolean") {
        setDisplayState(event.data.displayEnabled);
    } else if (typeof event.data.captionMode === "string") {
        if (setCaptionMode(event.data.captionMode)) {
            notifyAll("captionMode", event.data.captionMode);
        }
    } else if (Array.isArray(event.data.captionStyle)) {
        setAppCaptionStyle(event.data.captionStyle);
    } else if (isTaskData(event.data)) {
        console.debug("[API] Task data received from Task Thread: ", event.data.name, TaskState[event.data.state]);
        if (event.data.state === TaskState.STOP) {
            endTask(event.data.id);
        }
    } else if (isThreadUpdate(event.data)) {
        console.debug("[API] Update received from Task thread: ", event.data.id, event.data.field);
        threadSyncToMain.get(event.data.id)?.waitStore(event.data, 1);
        if (event.data.type === "task") {
            return;
        }
        for (let taskId = 1; taskId <= tasks.size; taskId++) {
            if (taskId !== event.data.id) {
                const data = { ...event.data, id: taskId };
                if (!threadSyncToTask.has(data.id)) {
                    threadSyncToTask.set(data.id, new SharedObject());
                }
                threadSyncToTask.get(data.id)?.waitStore(data, 1);
            }
        }
    } else if (isNDKStart(event.data)) {
        handleNDKStart(event.data);
    } else if (typeof event.data === "string") {
        handleStringMessage(event.data);
    } else {
        apiException("warning", `[api] Invalid task message: ${event.data}`);
    }
}

// Handles NDKStart messages from the Interpreter
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

// Handles string messages from the Interpreter
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
    } else if (message.startsWith("debug,")) {
        const level = message.slice(6);
        const enable = level === "continue";
        enableSendKeys(enable);
        statsUpdate(enable);
        switchSoundState(enable);
        switchVideoState(enable);
        notifyAll("debug", { level: level });
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

// Update Bandwidth Measurement
function updateBandwidth() {
    if (currentApp.running && bandwidthMinute && latestBandwidth >= 0) {
        Atomics.store(sharedArray, DataType.MBWD, latestBandwidth);
    }
    bandwidthTimeout = setTimeout(updateBandwidth, 60000);
}

// Measure Bandwidth
async function measureBandwidth() {
    const testFileUrl = "https://brsfiddle.net/images/bmp-example-file-download-1024x1024.bmp";
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
