/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import JSZip from "jszip";
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
} from "./display";
import { subscribeControl, initControlModule, handleKey } from "./control";
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
} from "./sound";
import "./hash";
let brsWorker;
let brsEmuLib = "./lib/brsEmu.worker.js";

// Default Device Data
const storage = window.localStorage;
const deviceData = {
    developerId: "UniqueDeveloperId",
    friendlyName: "BrightScript Emulator",
    serialNumber: "BRSEMUAPP092",
    deviceModel: "8000X",
    firmwareVersion: "049.10E04111A",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap",
    maxSimulStreams: 2, // Max number of audio resource streams
    connectionType: "WiFiConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    lowResolutionCanvas: false,
    registry: new Map(),
};

// Channel Data
let splashTimeout = 1600;
let source = [];
let paths = [];
let txts = [];
let bins = [];
let sharedBuffer = [0, 0, 0, 0, 0, 0, 0];
let sharedArray = new Int32Array(sharedBuffer);

const currentChannel = { id: "", file: "", title: "", subtitle: "", version: "", running: false };
const dataType = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
Object.freeze(dataType);

export function initialize(deviceInfo, supportSharedArray, disableKeys, keysMap, libPath) {
    Object.assign(deviceData, deviceInfo);
    console.log(deviceData.friendlyName);
    // Load Registry
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key.slice(0, deviceData.developerId.length) === deviceData.developerId) {
            deviceData.registry.set(key, storage.getItem(key));
        }
    }
    // Shared buffer (Keys and Sounds)
    const length = 7;
    if (supportSharedArray) {
        sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
    } else {
        sharedBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
        console.warn(
            `Remote control emulation will not work as SharedArrayBuffer is not enabled, 
            to know more visit https://developer.chrome.com/blog/enabling-shared-array-buffer/`
        );
    }
    sharedArray = new Int32Array(sharedBuffer);

    // Initialize Display, Control and Sound Modules
    initDisplayModule(deviceData.displayMode, deviceData.lowResolutionCanvas);
    initControlModule(sharedArray, dataType, disableKeys, keysMap);
    initSoundModule(sharedArray, dataType, deviceData.maxSimulStreams);
    // Subscribe Events
    subscribeDisplay("channel", (event, data) => {
        if (event === "mode") {
            deviceData.displayMode = data;
            if (currentChannel.running) {
                terminate("DisplayMode");
            }
            notifyAll("display", data);
        } else if (["redraw", "resolution"].includes(event)) {
            notifyAll(event, data);
        }
    });
    subscribeControl("channel", (event) => {
        if (event === "home") {
            if (currentChannel.running) {
                terminate("Home Button");
                playWav(0);
            }
        }
    });
    // Initialize Worker
    brsEmuLib = libPath || brsEmuLib;
    brsWorker = new Worker(brsEmuLib);
    brsWorker.addEventListener("message", workerCallback);
    brsWorker.postMessage("getVersion");
}

// Observers Handling
const observers = new Map();
export function subscribe(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribe(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Execute Channel/Source File
export function execute(filePath, fileData) {
    const fileName = filePath.split(".").slice(0, -1).join(".");
    const fileExt = filePath.split(".").pop();
    source = [];
    currentChannel.id = filePath.hashCode();
    currentChannel.file = filePath;
    if (typeof brsWorker !== "undefined") {
        resetWorker();
    }
    console.log(`Loading ${filePath}...`);
    if (fileExt === "zip") {
        openChannelZip(fileData);
    } else {
        openSourceCode(fileName, fileData);
    }
}

function resetWorker() {
    brsWorker.terminate();
    Atomics.store(sharedArray, dataType.KEY, 0);
    Atomics.store(sharedArray, dataType.MOD, 0);
    Atomics.store(sharedArray, dataType.SND, -1);
    Atomics.store(sharedArray, dataType.IDX, -1);
    resetSounds();
}

// Open source file
function openSourceCode(fileName, fileData) {
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
function openChannelZip(f) {
    JSZip.loadAsync(f).then(
        function (zip) {
            const manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        const manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function (ln) {
                            const line = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        const splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }
                        let splash;
                        if (deviceData.displayMode == "480p") {
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
                        currentChannel.version = "";
                        const majorVersion = manifestMap.get("major_version");
                        if (majorVersion) {
                            currentChannel.version += "v" + majorVersion;
                        }
                        const minorVersion = manifestMap.get("minor_version");
                        if (minorVersion) {
                            currentChannel.version += "." + minorVersion;
                        }
                        const buildVersion = manifestMap.get("build_version");
                        if (buildVersion) {
                            currentChannel.version += "." + buildVersion;
                        }
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
            let assetPaths = [];
            let assetsEvents = [];
            let binId = 0;
            let txtId = 0;
            let srcId = 0;
            let audId = 0;
            zip.forEach(function (relativePath, zipEntry) {
                const lcasePath = relativePath.toLowerCase();
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
                        ext == "ts")
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
    if (currentChannel.running && typeof brsWorker !== "undefined") {
        resetWorker();
    }
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
function workerCallback(event) {
    if (event.data instanceof ImageData) {
        drawBufferImage(event.data);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function (value, key) {
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
        const trigger = event.data.split(",");
        if (trigger.length >= 4) {
            triggerWav(trigger[1], parseInt(trigger[2]), parseInt(trigger[3]));
        } else {
            console.warn(`Missing Trigger parameters: ${event.data}`);
        }
    } else if (event.data.slice(0, 5) === "stop,") {
        stopWav(event.data.split(",")[1]);
    } else if (event.data.slice(0, 4) === "log,") {
        console.log(event.data.slice(4));
    } else if (event.data.slice(0, 8) === "warning,") {
        console.warn(event.data.slice(8));
    } else if (event.data.slice(0, 6) === "error,") {
        console.error(event.data.slice(6));
    } else if (event.data === "end") {
        terminate("Normal");
    } else if (event.data === "reset") {
        notifyAll("reset");
    } else if (event.data.slice(0, 8) === "version:") {
        notifyAll("version", event.data.slice(8));
    }
}

// Restore emulator state and terminate Worker
export function terminate(reason) {
    console.log(`${getNow()} [beacon.report] |AppExitComplete`);
    console.log(`------ Finished '${currentChannel.title}' execution [${reason}] ------`);
    clearDisplay();
    resetWorker();
    currentChannel.id = "";
    currentChannel.file = "";
    currentChannel.title = "";
    currentChannel.version = "";
    currentChannel.running = false;
    notifyAll("closed", reason);
}

function getNow() {
    let d = new Date();
    let mo = new Intl.DateTimeFormat("en-GB", { month: "2-digit", timeZone: "UTC" }).format(d);
    let da = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "UTC" }).format(d);
    let hr = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: "UTC" }).format(d);
    let mn = new Intl.DateTimeFormat("en-GB", { minute: "2-digit", timeZone: "UTC" }).format(d);
    let se = new Intl.DateTimeFormat("en-GB", { second: "2-digit", timeZone: "UTC" }).format(d);
    let ms = d.getMilliseconds();
    return `${mo}-${da} ${hr}:${mn}:${se}.${ms}`;
}

// Display API
export function redraw(fullScreen) {
    redrawDisplay(currentChannel.running, fullScreen);
}
export function getDisplayMode() {
    return deviceData.displayMode;
}

export function setDisplayMode(mode) {
    setCurrentMode(mode);
}

export function getOverscanMode() {
    return overscanMode;
}

export function setOverscanMode(mode) {
    setOverscan(mode);
}

// Remote Control API
export function sendKeyDown(key) {
    handleKey(key, 0);
}
export function sendKeyUp(key) {
    handleKey(key, 100);
}
export function sendKeyPress(key) {
    setTimeout(function () {
        handleKey(key, 100);
    }, 300);
    handleKey(key, 0);
}
