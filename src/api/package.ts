/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { addSound, audioCodecs } from "./sound";
import { drawSplashScreen, clearDisplay, drawIconAsSplash } from "./display";
import { inBrowser, bufferToBase64, parseCSV, SubscribeCallback } from "./util";
import { unzipSync, zipSync, strFromU8, strToU8, Zippable, Unzipped } from "fflate";
import models from "../worker/common/models.csv";

// Default Device Data
// Roku documentation: https://developer.roku.com/docs/references/brightscript/interfaces/ifdeviceinfo.md
export const deviceData = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data
    friendlyName: "BrightScript Engine Library",
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "BSC.00E04193A", // v11.0
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
    models: parseCSV(models),
    registry: new Map(),
};

// App Data
const defaultSplashTime = 1600;
let splashTimeout = 0;
export let source: any[] = [];
export let paths: any[] = [];
export let txts: any[] = [];
export let bins: any[] = [];
export let manifestMap = new Map();
export const currentApp = createCurrentApp();
export const lastApp = { id: "", exitReason: "EXIT_UNKNOWN" };

// Observers Handling
const observers = new Map();
export function subscribePackage(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribePackage(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Decompress Zip and execute
let currentZip: Unzipped;
let binId: number;
let txtId: number;
let srcId: number;
let audId: number;

export function loadAppZip(fileName: string, file: any, callback: Function) {
    try {
        currentZip = unzipSync(new Uint8Array(file));
    } catch (e: any) {
        notifyAll("error", `[package] Error reading ${fileName}: ${e.message}`);
        currentApp.running = false;
        return;
    }
    const manifest = currentZip["manifest"];
    if (manifest) {
        try {
            processManifest(strFromU8(manifest));
        } catch (e: any) {
            currentApp.running = false;
            notifyAll("error", `[package] Error uncompressing manifest: ${e.message}`);
        }
    } else {
        currentApp.running = false;
        notifyAll("error", "[package] Invalid App Package: missing manifest.");
        return;
    }
    binId = 0;
    txtId = 0;
    srcId = 0;
    audId = 0;
    source = [];
    paths = [];
    txts = [];
    bins = [];

    for (const filePath in currentZip) {
        processFile(filePath, currentZip[filePath]);
    }

    setTimeout(callback, splashTimeout, createPayload());
}

function processFile(relativePath: string, fileData: Uint8Array) {
    const lcasePath: string = relativePath.toLowerCase();
    const ext = lcasePath.split(".").pop() ?? "";
    if (relativePath.endsWith("/")) {
        // ignore directory
    } else if (lcasePath.startsWith("source") && ext === "brs") {
        paths.push({ url: relativePath, id: srcId, type: "source" });
        source.push(strFromU8(fileData));
        srcId++;
    } else if (lcasePath === "source/var") {
        paths.push({ url: relativePath, id: srcId, type: "text" });
        txts.push(strFromU8(fileData));
        txtId++;
    } else if (lcasePath === "manifest" || ["csv", "xml", "json", "txt", "ts"].includes(ext)) {
        paths.push({ url: relativePath, id: txtId, type: "text" });
        txts.push(strFromU8(fileData));
        txtId++;
    } else if (
        ["wav", "mp2", "mp3", "mp4", "m4a", "aac", "ogg", "oga", "ac3", "wma", "flac"].includes(ext)
    ) {
        paths.push({ url: relativePath, id: audId, type: "audio", format: ext });
        if (inBrowser) {
            addSound(`pkg:/${relativePath}`, ext, new Blob([fileData]));
        }
        audId++;
    } else {
        const binType = lcasePath === "source/data" ? "pcode" : "binary";
        paths.push({ url: relativePath, id: binId, type: binType });
        bins.push(fileData.buffer);
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

    const splashMinTime = parseInt(manifestMap.get("splash_min_time"));
    splashTimeout = isNaN(splashMinTime) ? defaultSplashTime : splashMinTime;

    const resKeys = ["hd", "fhd"];
    if (deviceData.displayMode === "480p") {
        resKeys.unshift("sd");
    }
    const splashKey = resKeys.find((key) => manifestMap.has(`splash_screen_${key}`));
    const splash = manifestMap.get(`splash_screen_${splashKey}`);
    const iconKey = resKeys.find((key) => manifestMap.has(`mm_icon_focus_${key}`));
    const icon = manifestMap.get(`mm_icon_focus_${iconKey}`);

    let iconFile;
    if (icon?.slice(0, 5) === "pkg:/") {
        iconFile = currentZip[icon.slice(5)];
        if (iconFile) {
            if (inBrowser) {
                bufferToBase64(iconFile).then(function (iconBase64: string) {
                    notifyAll("icon", iconBase64);
                });
            } else {
                notifyAll("icon", Buffer.from(iconFile).toString("base64"));
            }
        }
    }
    if (typeof createImageBitmap !== "undefined") {
        // Display Splash or Icon
        clearDisplay();
        if (splash?.slice(0, 5) === "pkg:/") {
            const splashFile = currentZip[splash.slice(5)];
            if (splashFile) {
                createImageBitmap(new Blob([splashFile])).then(drawSplashScreen);
            }
        } else if (iconFile) {
            createImageBitmap(new Blob([iconFile])).then(drawIconAsSplash);
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
                const pos = `${index + 1},0-${line.length}`;
                notifyAll(
                    "warning",
                    `manifest(${pos}): Missing "=". Manifest entries must have this format: key=value`
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

// Remove the source code and replace by encrypted pcode returning new zip
export function updateAppZip(source: Uint8Array, iv: string) {
    let newZip: Zippable = {};
    for (const filePath in currentZip) {
        if (!filePath.toLowerCase().startsWith("source")) {
            newZip[filePath] = currentZip[filePath];
        }
        newZip["source/data"] = [source, { level: 0 }];
        newZip["source/var"] = [strToU8(iv), { level: 0 }];
    }
    return zipSync(newZip, { level: 6 });
}

// Create App Payload
export function createPayload(timeOut?: number) {
    if (!timeOut) {
        timeOut = splashTimeout;
    }
    const input = new Map([
        ["lastExitOrTerminationReason", "EXIT_UNKNOWN"],
        ["splashTime", timeOut.toString()],
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
        password: currentApp.password,
        stopOnCrash: currentApp.debugOnCrash,
    };
}

// Current App object
export function resetCurrentApp() {
    Object.assign(currentApp, createCurrentApp());
}

function createCurrentApp() {
    return {
        id: "",
        file: "",
        title: "",
        subtitle: "",
        version: "",
        execSource: "auto-run-dev",
        password: "",
        clearDisplay: true,
        debugOnCrash: false,
        running: false,
    };
}
