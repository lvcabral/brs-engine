/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { drawSplashScreen, clearDisplay, drawIconAsSplash } from "./display";
import { bufferToBase64, parseCSV, SubscribeCallback, context } from "./util";
import { unzipSync, zipSync, strFromU8, strToU8, Zippable, Unzipped } from "fflate";
import { addSound, audioCodecs } from "./sound";
import { addVideo, videoFormats } from "./video";
import {
    defaultDeviceInfo,
    audioExt,
    videoExt,
    parseManifest,
    AppPayload,
    AppFilePath,
    AppData,
    AppExitReason,
} from "../worker/common";
import models from "../worker/libraries/common/models.csv";
import packageInfo from "../../package.json";

// Default Device Data
export const deviceData = Object.assign(defaultDeviceInfo, {
    models: parseCSV(models),
    audioCodecs: audioCodecs(),
    videoFormats: videoFormats(),
    context: context,
});

// App Data
const defaultSplashTime = 1600;
let splashTimeout = 0;
export const source: string[] = [];
export const paths: AppFilePath[] = [];
export const manifestMap: Map<string, string> = new Map();
export const currentApp = createAppStatus();
export const lastApp = createAppStatus();

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
let srcId: number;
let pkgZip: ArrayBuffer;
let extZip: ArrayBuffer | undefined;

export function loadAppZip(fileName: string, file: ArrayBuffer, callback: Function) {
    try {
        pkgZip = file;
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
    srcId = 0;
    source.length = 0;
    paths.length = 0;

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
        paths.push({ id: srcId, url: relativePath, type: "source" });
        source.push(strFromU8(fileData));
        srcId++;
    } else if (lcasePath === "source/data") {
        paths.push({ id: 0, url: relativePath, type: "pcode" });
    } else if (lcasePath === "source/var") {
        paths.push({ id: 1, url: relativePath, type: "pcode" });
    } else if (context.inBrowser && audioExt.has(ext)) {
        addSound(`pkg:/${relativePath}`, ext, new Blob([fileData]));
    } else if (context.inBrowser && videoExt.has(ext)) {
        addVideo(`pkg:/${relativePath}`, new Blob([fileData], { type: "video/mp4" }));
    }
}

function processManifest(content: string) {
    manifestMap.clear();
    parseManifest(content).forEach((value, key) => {
        manifestMap.set(key, value);
    });
    currentApp.title = manifestMap.get("title") ?? "No Title";
    currentApp.subtitle = manifestMap.get("subtitle") ?? "";
    currentApp.audioMetadata = manifestMap.get("requires_audiometadata") === "1";

    const majorVersion = parseInt(manifestMap.get("major_version") ?? "") ?? 0;
    const minorVersion = parseInt(manifestMap.get("minor_version") ?? "") ?? 0;
    const buildVersion = parseInt(manifestMap.get("build_version") ?? "") ?? 0;
    currentApp.version = `v${majorVersion}.${minorVersion}.${buildVersion}`;

    const splashMinTime = parseInt(manifestMap.get("splash_min_time") ?? "");
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
            if (context.inBrowser) {
                bufferToBase64(iconFile).then(function (iconBase64: string) {
                    notifyAll("icon", iconBase64);
                });
            } else {
                notifyAll("icon", Buffer.from(iconFile).toString("base64"));
            }
        }
    }
    showSplashOrIcon(splash, iconFile);
    notifyAll("loaded", currentApp);
}

function showSplashOrIcon(splash?: string, iconFile?: Uint8Array) {
    if (typeof createImageBitmap !== "undefined") {
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

// Remove the source code and replace by encrypted pcode returning new zip
export function updateAppZip(source: Uint8Array, iv: string) {
    let newZip: Zippable = {};
    for (const filePath in currentZip) {
        if (!filePath.toLowerCase().startsWith("source")) {
            newZip[filePath] = currentZip[filePath];
        }
    }
    newZip["source/data"] = [source, { level: 0 }];
    newZip["source/var"] = [strToU8(iv), { level: 0 }];
    return zipSync(newZip, { level: 6 });
}

// Create App Payload
export function createPayload(timeOut?: number, entryPoint?: boolean): AppPayload {
    if (!timeOut) {
        timeOut = splashTimeout;
    }
    const input = new Map([
        ["lastExitOrTerminationReason", AppExitReason.UNKNOWN],
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
        pkgZip: pkgZip,
        extZip: extZip,
        password: currentApp.password,
        entryPoint: entryPoint,
        stopOnCrash: currentApp.debugOnCrash,
    };
}

// Current App object
export function resetCurrentApp() {
    Object.assign(currentApp, createAppStatus());
}

function createAppStatus(): AppData {
    return {
        id: "",
        file: "",
        title: "",
        subtitle: "",
        version: "",
        execSource: "auto-run-dev",
        exitReason: AppExitReason.UNKNOWN,
        password: "",
        clearDisplay: true,
        debugOnCrash: false,
        audioMetadata: false,
        running: false,
    };
}

// External Storage Handling
// TODO: Support dynamic mounting and unmounting of external storage
export function mountExt(zipData: ArrayBuffer) {
    extZip = zipData;
}

export function umountExt() {
    extZip = undefined;
}
