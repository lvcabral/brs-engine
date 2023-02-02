/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import JSZip from "jszip";
import { dataType, subscribeCallback, getNow, getApiPath, getEmuPath, isElectron } from "./util";
import {
    subscribeDisplay,
    initDisplayModule,
    drawBufferImage,
    drawSplashScreen,
    showDisplay,
    redrawDisplay,
    clearDisplay,
    setCurrentMode,
    setOverscan,
    overscanMode,
    setShowFps,
} from "./display";
import { subscribeControl, initControlModule, sendKey } from "./control";
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
} from "./sound";
import { version } from "../../package.json";

// Interpreter Library
const brsApiLib = getApiPath().split("/").pop();
const brsEmuLib = getEmuPath();
let brsWorker: Worker;

// Default Device Data
const storage: Storage = window.localStorage;
const deviceData = {
    developerId: "UniqueDeveloperId", // As in Roku devices, segregates Registry data
    friendlyName: "BrightScript Emulator Library",
    serialNumber: getSerialNumber(),
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "049.10E04111A", // v9.10
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US", // Channel Store Country
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US", // Used if channel supports localization
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap",
    fontPath: "../fonts/",
    maxSimulStreams: 2, // Max number of audio resource streams
    connectionType: "WiredConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    lowResolutionCanvas: false,
    registry: new Map(),
};
let debugToConsole: boolean = true;

// Channel Data
let splashTimeout: number = 1600;
let source: any[] = [];
let paths: any[] = [];
let txts: any[] = [];
let bins: any[] = [];
let sharedBuffer: SharedArrayBuffer | ArrayBuffer;
let sharedArray: Int32Array;

const currentChannel = {
    id: "",
    file: "",
    title: "",
    subtitle: "",
    version: "",
    clearDisplay: true,
    running: false,
};

export function initialize(customDeviceInfo?: any, options: any = {}) {
    Object.assign(deviceData, customDeviceInfo);
    console.info(`${deviceData.friendlyName} - ${brsApiLib} v${version}`);
    if (typeof options.debugToConsole === "boolean") {
        debugToConsole = options.debugToConsole;
    }
    // Load Registry
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key && key.slice(0, deviceData.developerId.length) === deviceData.developerId) {
            deviceData.registry.set(key, storage.getItem(key));
        }
    }
    // Shared buffer (Keys and Sounds)
    const length = 7;
    if (self.crossOriginIsolated || isElectron()) {
        sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
    } else {
        sharedBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
        console.warn(
            `Remote control emulation will not work as SharedArrayBuffer is not enabled, 
            to know more visit https://developer.chrome.com/blog/enabling-shared-array-buffer/`
        );
    }
    sharedArray = new Int32Array(sharedBuffer);
    resetArray();

    // Initialize Display and Control modules
    initDisplayModule(deviceData.displayMode, deviceData.lowResolutionCanvas);
    initControlModule(sharedArray, options);
    // Subscribe Events
    subscribeDisplay("channel", (event: string, data: any) => {
        if (event === "mode") {
            deviceData.displayMode = data;
            if (currentChannel.running) {
                terminate("EXIT_SETTINGS_UPDATE");
            }
            notifyAll("display", data);
        } else if (["redraw", "resolution"].includes(event)) {
            notifyAll(event, data);
        }
    });
    subscribeControl("channel", (event: string) => {
        if (event === "home") {
            if (currentChannel.running) {
                terminate("EXIT_USER_NAV");
                playWav(0);
            }
        }
    });
}

// Observers Handling
const observers = new Map();
export function subscribe(observerId: string, observerCallback: subscribeCallback) {
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

// Execute Channel/Source File
export function execute(
    filePath: string,
    fileData: any,
    clearDisplayOnExit: boolean = true,
    mute: boolean = false
) {
    const fileName = filePath.split(".").slice(0, -1).join(".");
    const fileExt = filePath.split(".").pop();
    source = [];
    currentChannel.id = filePath.hashCode();
    currentChannel.file = filePath;
    currentChannel.clearDisplay = clearDisplayOnExit;
    if (typeof brsWorker !== "undefined") {
        resetWorker();
    }
    console.info(`Loading ${filePath}...`);
    initSoundModule(sharedArray, deviceData.maxSimulStreams, mute);

    if (fileExt === "zip") {
        openChannelZip(fileData);
    } else {
        openSourceCode(fileName, fileData);
    }
}

// Terminate and reset BrightScript interpreter
function resetWorker() {
    brsWorker.terminate();
    resetArray();
    resetSounds();
}
function resetArray() {
    Atomics.store(sharedArray, dataType.KEY, -1);
    Atomics.store(sharedArray, dataType.MOD, -1);
    Atomics.store(sharedArray, dataType.SND, -1);
    Atomics.store(sharedArray, dataType.IDX, -1);
}

// Open source file
function openSourceCode(fileName: string, fileData: any) {
    const reader = new FileReader();
    reader.onload = function (progressEvent) {
        currentChannel.id = "brs";
        currentChannel.title = fileName;
        paths = [];
        bins = [];
        txts = [];
        source.push(this.result);
        paths.push({ url: `source/${fileName}`, id: 0, type: "source" });
        clearDisplay();
        notifyAll("loaded", currentChannel);
        runChannel();
    };
    reader.readAsText(new Blob([fileData], { type: "text/plain" }));
}

// Uncompress Zip and execute
function openChannelZip(f: any) {
    JSZip.loadAsync(f).then(
        function (zip) {
            const manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content: string) {
                        const manifestMap = new Map();
                        const manifestLines = content.match(/[^\r\n]+/g) ?? [];
                        manifestLines.map(function (ln: string) {
                            const line: string[] = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        const splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }
                        let splash;
                        if (deviceData.displayMode === "480p") {
                            splash = manifestMap.get("splash_screen_sd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_hd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_fhd");
                                }
                            }
                        } else {
                            splash = manifestMap.get("splash_screen_hd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_fhd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_sd");
                                }
                            }
                        }
                        clearDisplay();
                        if (splash && splash.slice(0, 5) === "pkg:/") {
                            const splashFile = zip.file(splash.slice(5));
                            if (splashFile) {
                                splashFile.async("blob").then((blob) => {
                                    createImageBitmap(blob).then(drawSplashScreen);
                                });
                            }
                        }
                        let icon;
                        icon = manifestMap.get("mm_icon_focus_hd");
                        if (!icon) {
                            icon = manifestMap.get("mm_icon_focus_fhd");
                            if (!icon) {
                                icon = manifestMap.get("mm_icon_focus_sd");
                            }
                        }
                        if (icon && icon.slice(0, 5) === "pkg:/") {
                            const iconFile = zip.file(icon.slice(5));
                            if (iconFile) {
                                iconFile.async("base64").then((content) => {
                                    notifyAll("icon", content);
                                });
                            }
                        }
                        const title = manifestMap.get("title");
                        if (title) {
                            currentChannel.title = title;
                        } else {
                            currentChannel.title = "No Title";
                        }
                        currentChannel.subtitle = "";
                        const subtitle = manifestMap.get("subtitle");
                        if (subtitle) {
                            currentChannel.subtitle = subtitle;
                        }
                        let majorVersion = manifestMap.get("major_version") || "";
                        if (majorVersion !== "") {
                            majorVersion = `v${majorVersion}`;
                        }
                        let minorVersion = manifestMap.get("minor_version") || "";
                        if (minorVersion !== "") {
                            minorVersion = `.${minorVersion}`;
                        }
                        let buildVersion = manifestMap.get("build_version") || "";
                        if (buildVersion !== "") {
                            buildVersion = `.${buildVersion}`;
                        }
                        currentChannel.version = `${majorVersion}${minorVersion}${buildVersion}`;
                        notifyAll("loaded", currentChannel);
                    },
                    function error(e) {
                        const msg = `Error uncompressing manifest: ${e.message}`;
                        console.error(msg);
                        currentChannel.running = false;
                        notifyAll("error", msg);
                        return;
                    }
                );
            } else {
                const msg = "Invalid Channel Package: missing manifest.";
                console.error(msg);
                currentChannel.running = false;
                notifyAll("error", msg);
                return;
            }
            let assetPaths: any[] = [];
            let assetsEvents: any[] = [];
            let binId: number = 0;
            let txtId: number = 0;
            let srcId: number = 0;
            let audId: number = 0;
            zip.forEach(function (relativePath: string, zipEntry: JSZip.JSZipObject) {
                const lcasePath: string = relativePath.toLowerCase();
                const ext = lcasePath.split(".").pop();
                if (!zipEntry.dir && lcasePath.slice(0, 6) === "source" && ext === "brs") {
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
            });
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
                    setTimeout(runChannel, splashTimeout);
                },
                function error(e) {
                    const msg = `Error uncompressing file ${e.message}`;
                    console.error(msg);
                    notifyAll("error", msg);
                }
            );
        },
        function (e) {
            const msg = `Error reading ${f.name}: ${e.message}`;
            console.error(msg);
            notifyAll("error", msg);
            currentChannel.running = false;
        }
    );
}

// Execute Emulator Web Worker
function runChannel() {
    showDisplay();
    currentChannel.running = true;
    brsWorker = new Worker(brsEmuLib);
    brsWorker.addEventListener("message", workerCallback);
    const payload = {
        device: deviceData,
        title: currentChannel.title,
        paths: paths,
        brs: source,
        texts: txts,
        binaries: bins,
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, bins);
    notifyAll("started", currentChannel);
}

// Receive Messages from Web Worker
function workerCallback(event: MessageEvent) {
    if (event.data instanceof ImageData) {
        drawBufferImage(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function (value: string, key: string) {
            storage.setItem(key, value);
        });
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
            console.warn(`Missing loop parameter: ${event.data}`);
        }
    } else if (event.data.slice(0, 4) === "next") {
        const newIndex = event.data.split(",")[1];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            setNext(parseInt(newIndex));
        } else {
            console.warn(`Invalid next index: ${event.data}`);
        }
    } else if (event.data.slice(0, 4) === "seek") {
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            seekSound(parseInt(position));
        } else {
            console.warn(`Invalid seek position: ${event.data}`);
        }
    } else if (event.data.slice(0, 7) === "trigger") {
        const trigger: string[] = event.data.split(",");
        if (trigger.length >= 4) {
            triggerWav(trigger[1], parseInt(trigger[2]), parseInt(trigger[3]));
        } else {
            console.warn(`Missing Trigger parameters: ${event.data}`);
        }
    } else if (event.data.slice(0, 5) === "stop,") {
        stopWav(event.data.split(",")[1]);
    } else if (event.data.slice(0, 6) === "print,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 4) === "log,") {
        // for backward compatibility with v0.9.1
        deviceDebug(event.data);
    } else if (event.data.slice(0, 8) === "warning,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 6) === "error,") {
        deviceDebug(event.data);
    } else if (event.data.slice(0, 4) === "end,") {
        terminate(event.data.slice(4));
    } else if (event.data === "reset") {
        notifyAll("reset");
    } else if (event.data.slice(0, 8) === "version,") {
        notifyAll("version", event.data.slice(8));
    }
}
function deviceDebug(data: string) {
    const level = data.split(",")[0];
    const content = data.slice(level.length + 1);
    notifyAll("debug", { level: level, content: content });
    if (debugToConsole) {
        if (level === "error") {
            console.error(content);
        } else if (level === "warning") {
            console.warn(content);
        } else {
            console.log(content);
        }
    }
}

// Restore emulator state and terminate Worker
export function terminate(reason: string) {
    deviceDebug(`print,${getNow()} [beacon.report] |AppExitComplete`);
    deviceDebug(`print,------ Finished '${currentChannel.title}' execution [${reason}] ------`);
    if (currentChannel.clearDisplay) {
        clearDisplay();
    }
    resetWorker();
    currentChannel.id = "";
    currentChannel.file = "";
    currentChannel.title = "";
    currentChannel.version = "";
    currentChannel.running = false;
    notifyAll("closed", reason);
}

// Display API
export function redraw(fullScreen: boolean) {
    redrawDisplay(currentChannel.running, fullScreen);
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
export function showDisplayFps(state: boolean) {
    setShowFps(state);
}

// Remote Control API
export function sendKeyDown(key: string) {
    sendKey(key, 0);
}
export function sendKeyUp(key: string) {
    sendKey(key, 100);
}
export function sendKeyPress(key: string) {
    setTimeout(function () {
        sendKey(key, 100);
    }, 300);
    sendKey(key, 0);
}

// API Library version and device Serial Number
export function getVersion() {
    return version;
}
function getSerialNumber() {
    let verPlain = "";
    version.split(".").forEach((element) => {
        verPlain += element.padStart(2, "0");
    });
    return `BRSEMU${verPlain}`;
}
