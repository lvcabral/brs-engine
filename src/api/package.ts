/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { drawSplashScreen, clearDisplay, drawIconAsSplash, setDeviceData } from "./display";
import { bufferToBase64, parseCSV, SubscribeCallback } from "./util";
import { unzipSync, zipSync, strFromU8, strToU8, Zippable, Unzipped } from "fflate";
import { addSound, audioCodecs } from "./sound";
import { addVideo } from "./video";
import {
    defaultDeviceInfo,
    AudioExt,
    VideoExt,
    parseManifest,
    AppPayload,
    PkgFilePath,
    AppData,
    AppExitReason,
    DeviceInfo,
    platform,
} from "../core/common";
import models from "../core/common/models.csv";
import packageInfo from "../../package.json";

// Device Data Object
export const deviceData: DeviceInfo = Object.assign(defaultDeviceInfo, {
    models: parseCSV(models),
    audioCodecs: audioCodecs(),
});
deviceData.serialNumber = getSerialNumber();
setDeviceData(deviceData);

// App Data
const inputParams: Map<string, string> = new Map();
export const source: string[] = [];
export const paths: PkgFilePath[] = [];
export const manifestMap: Map<string, string> = new Map();
export const currentApp = createAppData();

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
let pkgZip: ArrayBuffer | undefined;
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
    let launchTime = Date.now();
    const manifest = currentZip["manifest"];
    if (manifest) {
        try {
            launchTime = processManifest(strFromU8(manifest));
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

    if (deviceData.appList && deviceData.appList.length === 0) {
        deviceData.appList.push({
            id: "dev",
            title: currentApp.title,
            version: currentApp.version,
            path: currentApp.path,
        });
    }

    for (const filePath in currentZip) {
        processFile(filePath, currentZip[filePath]);
    }
    callback(createPayload(launchTime));
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
    } else if (platform.inBrowser && AudioExt.has(ext)) {
        addSound(`pkg:/${relativePath}`, ext, new Blob([fileData]));
    } else if (platform.inBrowser && VideoExt.has(ext)) {
        addVideo(`pkg:/${relativePath}`, new Blob([fileData], { type: "video/mp4" }));
    }
}

function processManifest(content: string): number {
    manifestMap.clear();
    parseManifest(content).forEach((value, key) => {
        manifestMap.set(key, value);
    });
    currentApp.title = manifestMap.get("title") ?? "No Title";
    currentApp.subtitle = manifestMap.get("subtitle") ?? "";

    const majorVersion = parseInt(manifestMap.get("major_version") ?? "0");
    const minorVersion = parseInt(manifestMap.get("minor_version") ?? "0");
    const buildVersion = parseInt(manifestMap.get("build_version") ?? "0");
    currentApp.version = `${majorVersion}.${minorVersion}.${buildVersion}`.replace("NaN", "0");
    console.debug(`[package] App: ${currentApp.title} v${currentApp.version}`);

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
            if (platform.inBrowser) {
                bufferToBase64(iconFile).then(function (iconBase64: string) {
                    notifyAll("icon", iconBase64);
                });
            } else {
                notifyAll("icon", Buffer.from(iconFile).toString("base64"));
            }
        }
    }
    // Set Launch Time to calculate Splash Time later
    const launchTime = Date.now();
    showSplashOrIcon(splash, iconFile);
    return launchTime;
}

function showSplashOrIcon(splash?: string, iconFile?: Uint8Array) {
    if (typeof createImageBitmap !== "undefined") {
        clearDisplay(true);
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

// Returns the Device Model type
export function getModelType(): string {
    const device = deviceData.models.get(deviceData.deviceModel);
    return device ? device[1] : "STB";
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
export function createPayload(launchTime: number): AppPayload {
    return {
        device: deviceData,
        launchTime: launchTime,
        manifest: manifestMap,
        deepLink: inputParams,
        paths: paths,
        source: source,
        pkgZip: pkgZip,
        extZip: extZip,
        password: currentApp.password,
    };
}

export function setupDeepLink(deepLink: Map<string, string>) {
    inputParams.clear();
    inputParams.set("lastExitOrTerminationReason", currentApp.exitReason ?? AppExitReason.UNKNOWN);
    /**
     * Options for "source" parameter:
     * - "auto-run-dev" when app is side-loaded (default)
     * - "homescreen" when opening from home screen
     * - "other-channel" when using roAppManager.launchApp()
     * - "external-control" when deep linking
     */
    inputParams.set("source", "auto-run-dev");
    deepLink.forEach((value, key) => {
        inputParams.set(key, value);
    });
}

// Current App object
export function resetCurrentApp() {
    Object.assign(currentApp, createAppData());
    pkgZip = undefined;
}

// Create Default App Data
function createAppData(): AppData {
    return {
        id: "",
        title: "",
        subtitle: "",
        version: "",
        path: "",
        password: "",
        exitReason: AppExitReason.UNKNOWN,
        exitTime: undefined,
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
