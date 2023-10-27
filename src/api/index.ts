/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import JSZip from "jszip";
import {
    DataType,
    DebugCommand,
    SubscribeCallback,
    dataBufferIndex,
    dataBufferSize,
    getNow,
    getApiPath,
    getEmuPath,
    isElectron,
} from "./util";
import {
    subscribeDisplay,
    initDisplayModule,
    updateBuffer,
    drawSplashScreen,
    showDisplay,
    redrawDisplay,
    clearDisplay,
    setCurrentMode,
    setOverscan,
    overscanMode,
    showPerfStats,
    drawIconAsSplash,
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
    audioCodecs,
} from "./sound";
import { version } from "../../package.json";

// Interpreter Library
const brsApiLib = getApiPath().split("/").pop();
const brsEmuLib = getEmuPath();
let brsWorker: Worker;

// Default Device Data
// Roku documentation: https://developer.roku.com/docs/references/brightscript/interfaces/ifdeviceinfo.md

export const deviceData = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data
    friendlyName: "BrightScript Emulator Library",
    serialNumber: getSerialNumber(),
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "46A.00E04209A", // v10.0
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
    fonts: new Map(),
    audioCodecs: audioCodecs(),
    maxSimulStreams: 2, // Max number of audio resource streams
    connectionType: "WiredConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    registry: new Map(),
};
let debugToConsole: boolean = true;
let showStats: boolean = false;

// App Data
const defaultSplashTime = 1600;
let splashTimeout = 0;
let source: any[] = [];
let paths: any[] = [];
let txts: any[] = [];
let bins: any[] = [];
let sharedBuffer: SharedArrayBuffer | ArrayBuffer;
let sharedArray: Int32Array;
let manifestMap = new Map();

const currentApp = {
    id: "",
    file: "",
    title: "",
    subtitle: "",
    version: "",
    execSource: "",
    clearDisplay: true,
    running: false,
};
const lastApp = { id: "", exitReason: "EXIT_UNKNOWN" };

// API Methods
export function initialize(customDeviceInfo?: any, options: any = {}) {
    const storage: Storage = window.localStorage;
    Object.assign(deviceData, customDeviceInfo);
    console.info(`${deviceData.friendlyName} - ${brsApiLib} v${version}`);
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
        console.warn(
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
    subscribeDisplay("app", (event: string, data: any) => {
        if (event === "mode") {
            deviceData.displayMode = data;
            if (currentApp.running) {
                terminate("EXIT_SETTINGS_UPDATE");
            }
            notifyAll("display", data);
        } else if (["redraw", "resolution"].includes(event)) {
            notifyAll(event, data);
        }
    });
    subscribeControl("app", (event: string) => {
        if (event === "home") {
            if (currentApp.running) {
                terminate("EXIT_USER_NAV");
                playWav(0);
            }
        }
    });
    // Force library download during initialization
    brsWorker = new Worker(brsEmuLib);
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
    clearDisplayOnExit: boolean = true,
    mute: boolean = false,
    execSource: string = "auto-run-dev"
) {
    const fileName = filePath.split(/.*[\/|\\]/)[1] ?? filePath;
    const fileExt = filePath.split(".").pop();
    source = [];
    currentApp.id = filePath.hashCode();
    currentApp.file = filePath;
    currentApp.clearDisplay = clearDisplayOnExit;
    currentApp.execSource = execSource;
    if (typeof brsWorker !== "undefined") {
        resetWorker();
    }
    console.info(`Loading ${filePath}...`);
    initSoundModule(sharedArray, deviceData.maxSimulStreams, mute);

    if (fileExt?.toLowerCase() === "zip") {
        loadAppZip(fileData, runApp);
    } else {
        loadSourceCode(fileName, fileData);
    }
}

// Restore emulator state and terminate Worker
export function terminate(reason: string) {
    deviceDebug(`beacon,${getNow()} [beacon.report] |AppExitComplete\r\n`);
    deviceDebug(`print,------ Finished '${currentApp.title}' execution [${reason}] ------\r\n`);
    if (currentApp.clearDisplay) {
        clearDisplay();
    }
    resetWorker();
    lastApp.id = currentApp.id;
    lastApp.exitReason = reason;
    currentApp.id = "";
    currentApp.file = "";
    currentApp.title = "";
    currentApp.subtitle = "";
    currentApp.version = "";
    currentApp.execSource = "";
    currentApp.running = false;
    enableControl(false);
    notifyAll("closed", reason);
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
        manifestMap = new Map();
        currentApp.id = "brs";
        currentApp.title = fileName;
        paths = [];
        bins = [];
        txts = [];
        source.push(this.result);
        paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
        splashTimeout = 0;
        clearDisplay();
        notifyAll("loaded", currentApp);
        runApp(createPayload());
    };
    reader.readAsText(new Blob([fileData], { type: "text/plain" }));
}

// Decompress Zip and execute
let currentZip: JSZip;
let assetPaths: any[];
let assetsEvents: any[];
let binId: number;
let txtId: number;
let srcId: number;
let audId: number;

export function loadAppZip(file: any, callback: Function) {
    JSZip.loadAsync(file).then(
        function (zip) {
            currentZip = zip;
            const manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(processManifest, function error(e) {
                    const msg = `[api] Error uncompressing manifest: ${e.message}`;
                    console.error(msg);
                    currentApp.running = false;
                    notifyAll("error", msg);
                });
            } else {
                const msg = "[api] Invalid App Package: missing manifest.";
                console.error(msg);
                currentApp.running = false;
                notifyAll("error", msg);
                return;
            }
            assetPaths = [];
            assetsEvents = [];
            binId = 0;
            txtId = 0;
            srcId = 0;
            audId = 0;
            zip.forEach(processFile);
            Promise.all(assetsEvents).then(
                function success(assets) {
                    paths = [];
                    txts = [];
                    bins = [];
                    for (let index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "binary") {
                            bins.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else if (assetPaths[index].type === "audio") {
                            addSound(
                                `pkg:/${assetPaths[index].url}`,
                                assetPaths[index].format,
                                assets[index]
                            );
                        } else if (assetPaths[index].type === "text") {
                            txts.push(assets[index]);
                        }
                    }
                    setTimeout(callback, splashTimeout, createPayload());
                },
                function error(e) {
                    const msg = `[api] Error uncompressing file ${e.message}`;
                    console.error(msg);
                    notifyAll("error", msg);
                }
            );
        },
        function (e) {
            const msg = `[api] Error reading ${file.name}: ${e.message}`;
            console.error(msg);
            notifyAll("error", msg);
            currentApp.running = false;
        }
    );
}

function processFile(relativePath: string, zipEntry: JSZip.JSZipObject) {
    const lcasePath: string = relativePath.toLowerCase();
    const ext = lcasePath.split(".").pop();
    if (!zipEntry.dir && lcasePath.startsWith("source") && ext === "brs") {
        assetPaths.push({ url: relativePath, id: srcId, type: "source" });
        assetsEvents.push(zipEntry.async("string"));
        srcId++;
    } else if (
        !zipEntry.dir &&
        (lcasePath === "manifest" ||
            ext === "csv" ||
            ext === "xml" ||
            ext === "json" ||
            ext === "txt" ||
            ext === "ts")
    ) {
        assetPaths.push({ url: relativePath, id: txtId, type: "text" });
        assetsEvents.push(zipEntry.async("string"));
        txtId++;
    } else if (
        !zipEntry.dir &&
        (ext === "wav" ||
            ext === "mp2" ||
            ext === "mp3" ||
            ext === "mp4" ||
            ext === "m4a" ||
            ext === "aac" ||
            ext === "ogg" ||
            ext === "oga" ||
            ext === "ac3" ||
            ext === "wma" ||
            ext === "flac")
    ) {
        assetPaths.push({ url: relativePath, id: audId, type: "audio", format: ext });
        assetsEvents.push(zipEntry.async("blob"));
        audId++;
    } else if (!zipEntry.dir) {
        assetPaths.push({ url: relativePath, id: binId, type: "binary" });
        assetsEvents.push(zipEntry.async("arraybuffer"));
        binId++;
    }
}

function processManifest(content: string) {
    manifestMap = parseManifest(content);

    currentApp.title = manifestMap.get("title") || "No Title";
    currentApp.subtitle = manifestMap.get("subtitle") || "";

    const majorVersion = parseInt(manifestMap.get("major_version")) || 0;
    const minorVersion = parseInt(manifestMap.get("minor_version")) || 0;
    const buildVersion = parseInt(manifestMap.get("build_version")) || 0;
    currentApp.version = `v${majorVersion}.${minorVersion}.${buildVersion}`;

    const splashMinTime = parseInt(manifestMap.get("splash_min_time") || "");
    splashTimeout = isNaN(splashMinTime) ? defaultSplashTime : splashMinTime;

    const splashKeys = ["splash_screen_sd", "splash_screen_hd", "splash_screen_fhd"];
    const iconKeys = ["mm_icon_focus_sd", "mm_icon_focus_hd", "mm_icon_focus_fhd"];
    if (deviceData.displayMode !== "480p") {
        splashKeys.push(splashKeys.shift() || "");
        iconKeys.push(iconKeys.shift() || "");
    }
    const splash = manifestMap.get(splashKeys.find((key) => manifestMap.has(key)));
    const icon = manifestMap.get(iconKeys.find((key) => manifestMap.has(key)));

    let iconFile;
    if (icon && icon.slice(0, 5) === "pkg:/") {
        iconFile = currentZip.file(icon.slice(5));
        iconFile?.async("base64").then((content: any) => {
            notifyAll("icon", content);
        });
    }
    if (typeof createImageBitmap !== "undefined") {
        // Display Splash or Icon
        clearDisplay();
        if (splash && splash.slice(0, 5) === "pkg:/") {
            const splashFile = currentZip.file(splash.slice(5));
            splashFile?.async("blob").then((blob: any) => {
                createImageBitmap(blob).then(drawSplashScreen);
            });
        } else {
            iconFile?.async("blob").then((blob: any) => {
                createImageBitmap(blob).then(drawIconAsSplash);
            });
        }
    }
    notifyAll("loaded", currentApp);
}

function parseManifest(contents: string) {
    let keyValuePairs = contents
        // for each line
        .split("\n")
        // remove leading/trailing whitespace
        .map((line) => line.trim())
        // separate keys and values
        .map((line, index) => {
            // skip empty lines and comments
            if (line === "" || line.startsWith("#")) {
                return ["", ""];
            }

            let equals = line.indexOf("=");
            if (equals === -1) {
                console.error(
                    `[manifest:${
                        index + 1
                    }] No '=' detected.  Manifest attributes must be of the form 'key=value'.`
                );
            }
            return [line.slice(0, equals), line.slice(equals + 1)];
        })
        // keep only non-empty keys and values
        .filter(([key, value]) => key && value)
        // remove leading/trailing whitespace from keys and values
        .map(([key, value]) => [key.trim(), value.trim()])
        // convert value to boolean, integer, or leave as string
        .map(([key, value]): [string, string] => {
            return [key, value];
        });

    return new Map<string, string>(keyValuePairs);
}
// Create App Payload
function createPayload() {
    const input = new Map([
        ["lastExitOrTerminationReason", "EXIT_UNKNOWN"],
        ["splashTime", splashTimeout.toString()],
    ]);
    if (currentApp.id === lastApp.id) {
        input.set("lastExitOrTerminationReason", lastApp.exitReason);
    }
    if (currentApp.execSource !== "") {
        input.set("source", currentApp.execSource);
    }
    return {
        device: deviceData,
        manifest: manifestMap,
        input: input,
        paths: paths,
        brs: source,
        texts: txts,
        binaries: bins,
    };
}

// Execute Emulator Web Worker
function runApp(payload: object) {
    showDisplay();
    currentApp.running = true;
    brsWorker = new Worker(brsEmuLib);
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
        if (typeof window !== "undefined") {
            const storage: Storage = window.localStorage;
            deviceData.registry.forEach(function (value: string, key: string) {
                storage.setItem(key, value);
            });    
        }
    } else if (event.data instanceof Array) {
        addPlaylist(event.data);
    } else if (event.data.audioPath) {
        addSound(event.data.audioPath, event.data.audioFormat, new Blob([event.data.audioData]));
    } else if (event.data === "play") {
        playSound();
    } else if (event.data === "stop") {
        stopSound();
    } else if (event.data === "pause") {
        pauseSound();
    } else if (event.data === "resume") {
        resumeSound();
    } else if (event.data.slice(0, 4) === "loop") {
        const loop = event.data.split(",")[1];
        if (loop) {
            setLoop(loop === "true");
        } else {
            console.warn(`[api] Missing loop parameter: ${event.data}`);
        }
    } else if (event.data.slice(0, 4) === "next") {
        const newIndex = event.data.split(",")[1];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            setNext(parseInt(newIndex));
        } else {
            console.warn(`[api] Invalid next index: ${event.data}`);
        }
    } else if (event.data.slice(0, 4) === "seek") {
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            seekSound(parseInt(position));
        } else {
            console.warn(`[api] Invalid seek position: ${event.data}`);
        }
    } else if (event.data.slice(0, 7) === "trigger") {
        const trigger: string[] = event.data.split(",");
        if (trigger.length >= 4) {
            triggerWav(trigger[1], parseInt(trigger[2]), parseInt(trigger[3]));
        } else {
            console.warn(`[api] Missing Trigger parameters: ${event.data}`);
        }
    } else if (event.data.slice(0, 5) === "stop,") {
        stopWav(event.data.split(",")[1]);
    } else if (event.data.slice(0, 6) === "print,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 7) === "beacon,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 4) === "log,") {
        // for backward compatibility with v0.9.1
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.slice(0, 8) === "warning,") {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.slice(0, 6) === "error,") {
        deviceDebug(`${event.data}\r\n`);
    } else if (event.data.slice(0, 6) === "debug,") {
        const level = event.data.slice(6);
        enableControl(level === "continue");
        notifyAll("debug", { level: level });
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

// Device Serial Number
function getSerialNumber() {
    let verPlain = "";
    version.split(".").forEach((element) => {
        verPlain += element.padStart(2, "0");
    });
    return `BRSEMU${verPlain}`;
}
