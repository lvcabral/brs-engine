/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, getNow, getWorkerLibPath, context } from "./util";

import {
    DataType,
    DebugCommand,
    RemoteType,
    dataBufferIndex,
    dataBufferSize,
} from "../worker/enums";

import {
    source,
    paths,
    txts,
    bins,
    manifestMap,
    currentApp,
    lastApp,
    loadAppZip,
    createPayload,
    resetCurrentApp,
    deviceData,
    subscribePackage,
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
export { deviceData, loadAppZip, updateAppZip } from "./package";

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

let debugToConsole: boolean = true;
let showStats: boolean = false;

// App Shared Buffer
let sharedBuffer: SharedArrayBuffer | ArrayBuffer;
let sharedArray: Int32Array;

// API Methods
export function initialize(customDeviceInfo?: any, options: any = {}) {
    if (customDeviceInfo) {
        const invalidKeys = [
            "registry",
            "models",
            "audioCodecs",
            "videoFormats",
            "fonts",
            "password",
        ];
        invalidKeys.forEach((key) => {
            if (key in customDeviceInfo) {
                delete customDeviceInfo[key];
            }
        });
        Object.assign(deviceData, customDeviceInfo);
    }
    const storage: Storage = window.localStorage;
    let initMsg = `${packageInfo.description} - v${packageInfo.version}`;
    /// #if DEBUG
    initMsg += " - dev";
    /// #endif
    if (typeof options.debugToConsole === "boolean") {
        debugToConsole = options.debugToConsole;
    }

    if (debugToConsole) {
        console.info(initMsg);
    }

    if (typeof options.showStats === "boolean") {
        showStats = options.showStats;
    }
    // Load Registry
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(deviceData.developerId)) {
            deviceData.registry.set(key, storage.getItem(key));
        }
    }
    // Shared buffer (Keys, Sounds and Debug Commands)
    const length = dataBufferIndex + dataBufferSize;
    if (self.crossOriginIsolated || context.inElectron) {
        sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
    } else {
        sharedBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
        apiException(
            "warning",
            `[api] Remote control emulation will not work as SharedArrayBuffer is not enabled, ` +
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
                terminate("EXIT_SETTINGS_UPDATE");
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
                        terminate("EXIT_USER_NAV");
                    });
                }
                home.play();
            }
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
export function execute(filePath: string, fileData: any, options: any = {}) {
    const fileName = filePath.split(/.*[\/|\\]/)[1] ?? filePath;
    const fileExt = filePath.split(".").pop()?.toLowerCase();
    source.length = 0;
    currentApp.id = filePath.hashCode();
    currentApp.file = filePath;
    if (typeof options.clearDisplayOnExit === "boolean") {
        currentApp.clearDisplay = options.clearDisplayOnExit;
    }
    if (typeof options.execSource === "string") {
        currentApp.execSource = options.execSource;
    }
    if (typeof options.password === "string") {
        currentApp.password = options.password;
    }
    if (typeof options.debugOnCrash === "boolean") {
        currentApp.debugOnCrash = options.debugOnCrash;
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

// Restore engine state and terminate Worker
export function terminate(reason: string) {
    if (currentApp.running) {
        deviceDebug(`beacon,${getNow()} [beacon.report] |AppExitComplete\r\n`);
        deviceDebug(`print,------ Finished '${currentApp.title}' execution [${reason}] ------\r\n`);
    }
    if (currentApp.clearDisplay) {
        clearDisplay();
    }
    resetWorker();
    lastApp.id = currentApp.id;
    lastApp.exitReason = reason;
    Object.assign(currentApp, resetCurrentApp());
    enableSendKeys(false);
    notifyAll("closed", reason);
}

// Returns API library version
export function getVersion() {
    return packageInfo.version;
}

// Returns Device Serial Number based on Device Model and library version
export function getSerialNumber() {
    const device = deviceData.models.get(deviceData.deviceModel);
    const prefix = device ? device[4] : "X0";
    let verPlain = "";
    packageInfo.version.split(".").forEach((element) => {
        verPlain += element.replace(/\D/g, "").padStart(2, "0");
    });
    return `${prefix}0BRS${verPlain.substring(0, 6)}`;
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
    if (currentApp.running && command && command.length > 0) {
        const commandsMap = new Map([
            ["bt", DebugCommand.BT],
            ["cont", DebugCommand.CONT],
            ["c", DebugCommand.CONT],
            ["exit", DebugCommand.EXIT],
            ["q", DebugCommand.EXIT],
            ["help", DebugCommand.HELP],
            ["last", DebugCommand.LAST],
            ["l", DebugCommand.LAST],
            ["list", DebugCommand.LIST],
            ["next", DebugCommand.NEXT],
            ["n", DebugCommand.NEXT],
            ["over", DebugCommand.STEP],
            ["out", DebugCommand.STEP],
            ["step", DebugCommand.STEP],
            ["s", DebugCommand.STEP],
            ["t", DebugCommand.STEP],
            ["thread", DebugCommand.THREAD],
            ["th", DebugCommand.THREAD],
            ["threads", DebugCommand.THREADS],
            ["ths", DebugCommand.THREADS],
            ["var", DebugCommand.VAR],
            ["break", DebugCommand.BREAK],
            ["pause", DebugCommand.PAUSE],
        ]);
        let exprs = command
            .toString()
            .trim()
            .split(/(?<=^\S+)\s/);
        let cmd = commandsMap.get(exprs[0].toLowerCase());
        if (cmd !== undefined && exprs.length === 1) {
            Atomics.store(sharedArray, DataType.DBG, cmd);
            Atomics.store(sharedArray, DataType.EXP, 0);
        } else {
            let expr = command.toString().trim();
            if (exprs[0].toLowerCase() === "p") {
                expr = "? " + expr.slice(1);
            }
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXPR);
            Atomics.store(sharedArray, DataType.EXP, 1);
            debugExpression(expr);
        }
        handled = Atomics.notify(sharedArray, DataType.DBG) > 0;
    }
    return handled;
}

// Helper Functions
function debugExpression(expr: string) {
    // Store string on SharedArrayBuffer
    expr = expr.trim();
    let len = Math.min(expr.length, dataBufferSize);
    for (let i = 0; i < len; i++) {
        Atomics.store(sharedArray, dataBufferIndex + i, expr.charCodeAt(i));
    }
    // String terminator
    if (len < dataBufferSize) {
        Atomics.store(sharedArray, dataBufferIndex + len, 0);
    }
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
        manifestMap.clear();
        currentApp.id = "brs";
        currentApp.title = fileName;
        paths.length = 0;
        bins.length = 0;
        txts.length = 0;
        source.push(this.result);
        paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
        clearDisplay();
        notifyAll("loaded", currentApp);
        runApp(createPayload(1, false));
    };
    reader.readAsText(new Blob([fileData], { type: "text/plain" }));
}

// Execute Engine Web Worker
function runApp(payload: object) {
    showDisplay();
    currentApp.running = true;
    brsWorker = new Worker(brsWrkLib);
    brsWorker.addEventListener("message", workerCallback);
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, bins);
    enableSendKeys(true);
}

// Receive Messages from the Interpreter (Web Worker)
function workerCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        updateBuffer(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        if (context.inBrowser) {
            const storage: Storage = window.localStorage;
            deviceData.registry.forEach(function (value: string, key: string) {
                storage.setItem(key, value);
            });
        }
        notifyAll("registry", event.data);
    } else if (event.data instanceof Array) {
        addSoundPlaylist(event.data);
    } else if (event.data.audioPath && context.inBrowser) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (event.data.videoPlaylist && context.inBrowser) {
        if (event.data.videoPlaylist instanceof Array) {
            addVideoPlaylist(event.data.videoPlaylist);
        }
    } else if (event.data.videoPath && context.inBrowser) {
        addVideo(event.data.videoPath, new Blob([event.data.videoData], { type: "video/mp4" }));
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
        deviceDebug(`beacon,${getNow()} ${beaconMsg} '${title}', id 'dev'\r\n`);
        statsUpdate(true);
        notifyAll("started", currentApp);
    } else if (event.data.startsWith("end,")) {
        terminate(event.data.slice(4));
    } else if (event.data === "reset") {
        notifyAll("reset");
    } else if (event.data.startsWith("version,")) {
        notifyAll("version", event.data.slice(8));
    }
}

// Debug Messages Handler
function deviceDebug(data: string) {
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
