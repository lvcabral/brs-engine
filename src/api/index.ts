/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    DataType,
    DebugCommand,
    SubscribeCallback,
    dataBufferIndex,
    dataBufferSize,
    getNow,
    getWorkerLibPath,
    isElectron,
    inBrowser,
} from "./util";
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
    setCurrentMode,
    setOverscan,
    overscanMode,
    showPerfStats,
} from "./display";
import {
    subscribeControl,
    initControlModule,
    enableControl,
    sendKey,
    addControlKeys,
} from "./control";
import {
    initSoundModule,
    addSound,
    resetSounds,
    playSound,
    stopSound,
    playWav,
    pauseSound,
    resumeSound,
    setLoop,
    setNext,
    triggerWav,
    stopWav,
    addPlaylist,
    seekSound,
    muteSound,
    isMuted,
    subscribeSound,
} from "./sound";
import { version } from "../../package.json";

// Interpreter Library
const brsWrkLib = getWorkerLibPath();
let brsWorker: Worker;

// Package API
export { deviceData, loadAppZip, updateAppZip } from "./package";

let debugToConsole: boolean = true;
let showStats: boolean = false;

// App Shared Buffer
let sharedBuffer: SharedArrayBuffer | ArrayBuffer;
let sharedArray: Int32Array;

// API Methods
export function initialize(customDeviceInfo?: any, options: any = {}) {
    if (customDeviceInfo) {
        const invalidKeys = ["registry", "models", "audioCodecs", "fonts", "password"];
        invalidKeys.forEach((key) => {
            if (key in customDeviceInfo) {
                delete customDeviceInfo[key];
            }
        });
        Object.assign(deviceData, customDeviceInfo);
    }
    const storage: Storage = window.localStorage;
    let initMsg = `${deviceData.friendlyName} - v${version}`;
    /// #if DEBUG
    initMsg += " - dev";
    /// #endif
    console.info(initMsg);
    if (typeof options.debugToConsole === "boolean") {
        debugToConsole = options.debugToConsole;
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
    if (self.crossOriginIsolated || isElectron()) {
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
                terminate("EXIT_USER_NAV");
                playWav(0);
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
    subscribePackage("api", (event: string, data: any) => {
        if (["error", "warning"].includes(event)) {
            apiException(event, data);
        } else {
            notifyAll(event, data);
        }
    });

    // Force library download during initialization
    brsWorker = new Worker(brsWrkLib);
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
    console.info(`Loading ${filePath}...`);
    initSoundModule(sharedArray, deviceData.maxSimulStreams, options.muteSound);

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
    enableControl(false);
    notifyAll("closed", reason);
}

// Returns Device Serial Number based on Device Model and library version
export function getSerialNumber() {
    const device = deviceData.models.get(deviceData.deviceModel);
    const prefix = device ? device[4] : "X0";
    let verPlain = "";
    version.split(".").forEach((element) => {
        verPlain += element.replace(/\D/g, "").padStart(2, "0");
    });
    return `${prefix}0BRS${verPlain.substring(0, 6)}`;
}

// Display API
export function redraw(fullScreen: boolean, width?: number, height?: number, dpr?: number) {
    redrawDisplay(currentApp.running, fullScreen, width, height, dpr);
}
export function getDisplayMode() {
    return deviceData.displayMode;
}
export function setDisplayMode(mode: string) {
    setCurrentMode(mode);
}
export function getOverscanMode() {
    return overscanMode;
}
export function setOverscanMode(mode: string) {
    setOverscan(mode);
}
export function enableStats(state: boolean) {
    showPerfStats(state);
}

// Audio API
export function getAudioMute() {
    return isMuted();
}
export function setAudioMute(mute: boolean) {
    if (currentApp.running) {
        muteSound(mute);
    }
}

// Remote Control API
export function setCustomKeys(keys: Map<string, string>) {
    addControlKeys(keys);
}
export function sendKeyDown(key: string) {
    sendKey(key, 0);
}
export function sendKeyUp(key: string) {
    sendKey(key, 100);
}
export function sendKeyPress(key: string, delay = 300) {
    setTimeout(function () {
        sendKey(key, 100);
    }, delay);
    sendKey(key, 0);
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
        ]);
        let exprs = command
            .toString()
            .trim()
            .split(/(?<=^\S+)\s/);
        let cmd = commandsMap.get(exprs[0].toLowerCase());
        if (cmd !== undefined) {
            Atomics.store(sharedArray, DataType.DBG, cmd);
            Atomics.store(sharedArray, DataType.EXP, exprs.length - 1);
            if (exprs.length > 1) {
                debugExpression(exprs[1]);
            }
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

// API Library version and device Serial Number
export function getVersion() {
    return version;
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
    brsWorker.terminate();
    resetArray();
    resetSounds();
}
function resetArray() {
    Atomics.store(sharedArray, DataType.KEY, -1);
    Atomics.store(sharedArray, DataType.MOD, -1);
    Atomics.store(sharedArray, DataType.SND, -1);
    Atomics.store(sharedArray, DataType.IDX, -1);
    Atomics.store(sharedArray, DataType.DBG, -1);
    Atomics.store(sharedArray, DataType.EXP, -1);
}

// Open source file
function loadSourceCode(fileName: string, fileData: any) {
    const reader = new FileReader();
    reader.onload = function (progressEvent) {
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
        runApp(createPayload(0));
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
    enableControl(true);
    notifyAll("started", currentApp);
}

// Receive Messages from the Interpreter (Web Worker)
function workerCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        updateBuffer(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        if (inBrowser) {
            const storage: Storage = window.localStorage;
            deviceData.registry.forEach(function (value: string, key: string) {
                storage.setItem(key, value);
            });
        }
        notifyAll("registry", event.data);
    } else if (event.data instanceof Array) {
        addPlaylist(event.data);
    } else if (event.data.audioPath && inBrowser) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (typeof event.data !== "string") {
        // All messages beyond this point must be csv string
        apiException("warning", `[api] Invalid worker message: ${event.data}`);
    } else if (event.data.slice(0, 6) === "audio,") {
        const data = event.data.split(",");
        if (data[1] === "play") {
            playSound();
        } else if (data[1] === "stop") {
            if (data[2]) {
                stopWav(data[2]);
            } else {
                stopSound();
            }
        } else if (data[1] === "pause") {
            pauseSound();
        } else if (data[1] === "resume") {
            resumeSound();
        } else if (data[1] === "loop") {
            if (data[2]) {
                setLoop(data[2] === "true");
            } else {
                apiException("warning", `[api] Missing loop parameter: ${event.data}`);
            }
        } else if (data[1] === "next") {
            const newIndex = data[2];
            if (newIndex && !isNaN(parseInt(newIndex))) {
                setNext(parseInt(newIndex));
            } else {
                apiException("warning", `[api] Invalid next index: ${event.data}`);
            }
        } else if (data[1] === "seek") {
            const position = data[2];
            if (position && !isNaN(parseInt(position))) {
                seekSound(parseInt(position));
            } else {
                apiException("warning", `[api] Invalid seek position: ${event.data}`);
            }
        } else if (data[1] === "trigger") {
            if (data.length >= 5) {
                triggerWav(data[2], parseInt(data[3]), parseInt(data[4]));
            } else {
                apiException("warning", `[api] Missing Trigger parameters: ${event.data}`);
            }
        }
    } else if (event.data.slice(0, 6) === "print,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 7) === "beacon,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 8) === "warning,") {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.slice(0, 6) === "error,") {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.slice(0, 6) === "debug,") {
        const level = event.data.slice(6);
        enableControl(level === "continue");
        if (level === "stop") {
            pauseSound(false);
        } else {
            resumeSound(false);
        }
        notifyAll("debug", { level: level });
    } else if (event.data.slice(0, 6) === "start,") {
        const title = currentApp.title;
        const beaconMsg = "[scrpt.ctx.run.enter] UI: Entering";
        const subName = event.data.split(",")[1];
        deviceDebug(`print,------ Running dev '${title}' ${subName} ------\r\n`);
        deviceDebug(`beacon,${getNow()} ${beaconMsg} '${title}', id 'dev'\r\n`);
    } else if (event.data.slice(0, 4) === "end,") {
        terminate(event.data.slice(4));
    } else if (event.data === "reset") {
        notifyAll("reset");
    } else if (event.data.slice(0, 8) === "version,") {
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
