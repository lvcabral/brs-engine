/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { drawSplashScreen, clearDisplay, drawIconAsSplash } from "./display";
import { bufferToBase64, parseCSV, SubscribeCallback } from "./util";
import { unzipSync, zipSync, strFromU8, strToU8, Zippable, Unzipped } from "fflate";
import { addSound, audioCodecs } from "./sound";
import { addVideo, videoFormats } from "./video";
import {
    DefaultDeviceInfo,
    AudioExt,
    VideoExt,
    parseManifest,
    AppPayload,
    PkgFilePath,
    AppData,
    AppExitReason,
    DeviceInfo,
    SupportedExtension,
    Platform,
} from "../core/common";
import models from "../core/common/models.csv";
import packageInfo from "../../packages/browser/package.json";

// Device Data Object
export const deviceData: DeviceInfo = Object.assign(DefaultDeviceInfo, {
    models: parseCSV(models),
    audioCodecs: audioCodecs(),
    videoFormats: videoFormats(),
});
deviceData.serialNumber = getSerialNumber();

// App Data
const inputParams: Map<string, string> = new Map();
export const source: string[] = [];
export const paths: PkgFilePath[] = [];
export const extensions: SupportedExtension[] = [];
export const manifestMap: Map<string, string> = new Map();
export const currentApp = createAppData();

// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to package events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribePackage(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from package events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribePackage(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of a package event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// Decompress Zip and execute
let currentZip: Unzipped;
let srcId: number;
let pkgZip: ArrayBuffer | undefined;
let extZip: ArrayBuffer | undefined;

/**
 * Loads and processes a BrightScript application zip package.
 * Extracts manifest, source files, and assets.
 * @param fileName Name of the zip file
 * @param file ArrayBuffer containing the zip data
 * @param callback Callback function to execute with the created payload
 */
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
    extensions.length = 0;
    if (deviceData.appList && deviceData.appList.length === 0) {
        deviceData.appList.push({
            id: "dev",
            title: currentApp.title,
            version: currentApp.version,
            path: currentApp.path,
        });
    }
    // Process each file in the zip
    let hasSGComponents = false;
    for (const filePath in currentZip) {
        processFile(filePath, currentZip[filePath]);
        if (filePath.toLowerCase().startsWith("components/") && filePath.toLowerCase().endsWith(".xml")) {
            hasSGComponents = true;
        }
    }
    // Add SceneGraph extension if components are present
    if (hasSGComponents && deviceData.extensions?.has(SupportedExtension.SceneGraph)) {
        extensions.push(SupportedExtension.SceneGraph);
    }
    // Create and return the payload
    callback(createPayload(launchTime));
}

/**
 * Processes an individual file from the zip package.
 * Handles source files, audio, video, and pcode data.
 * @param relativePath Relative path of the file in the zip
 * @param fileData File data as Uint8Array
 */
function processFile(relativePath: string, fileData: Uint8Array) {
    const lcasePath: string = relativePath.toLowerCase();
    const ext = lcasePath.split(".").pop() ?? "";
    if (relativePath.endsWith("/")) {
        // Skip directories
    } else if (lcasePath.startsWith("source") && ext === "brs") {
        paths.push({ id: srcId, url: relativePath, type: "source" });
        source.push(strFromU8(fileData));
        srcId++;
    } else if (lcasePath === "source/data") {
        paths.push({ id: 0, url: relativePath, type: "pcode" });
    } else if (lcasePath === "source/var") {
        paths.push({ id: 1, url: relativePath, type: "pcode" });
    } else if (Platform.inBrowser && AudioExt.has(ext)) {
        addSound(`pkg:/${relativePath}`, ext, new Blob([fileData as BlobPart]));
    } else if (Platform.inBrowser && VideoExt.has(ext)) {
        addVideo(`pkg:/${relativePath}`, new Blob([fileData as BlobPart], { type: "video/mp4" }));
    }
}

/**
 * Processes the application manifest file.
 * Extracts app metadata and displays splash screen.
 * @param content Manifest file content as string
 * @returns Launch time timestamp in milliseconds
 */
function processManifest(content: string): number {
    manifestMap.clear();
    for (const [key, value] of parseManifest(content)) {
        manifestMap.set(key, value);
    }
    currentApp.title = manifestMap.get("title") ?? "No Title";
    currentApp.subtitle = manifestMap.get("subtitle") ?? "";

    const majorVersion = Number.parseInt(manifestMap.get("major_version") ?? "0");
    const minorVersion = Number.parseInt(manifestMap.get("minor_version") ?? "0");
    const buildVersion = Number.parseInt(manifestMap.get("build_version") ?? "0");
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
            if (Platform.inBrowser) {
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

/**
 * Displays splash screen or icon from the package.
 * @param splash Optional path to splash screen image
 * @param iconFile Optional icon file data
 */
function showSplashOrIcon(splash?: string, iconFile?: Uint8Array) {
    if (typeof createImageBitmap !== "undefined") {
        clearDisplay(true);
        if (splash?.slice(0, 5) === "pkg:/") {
            const splashFile = currentZip[splash.slice(5)];
            if (splashFile) {
                createImageBitmap(new Blob([splashFile as BlobPart])).then(drawSplashScreen);
            }
        } else if (iconFile) {
            createImageBitmap(new Blob([iconFile as BlobPart])).then(drawIconAsSplash);
        }
    }
}

/**
 * Returns device serial number based on device model and library version.
 * @returns Generated serial number string
 */
export function getSerialNumber() {
    const device = deviceData.models?.get(deviceData.deviceModel);
    const prefix = device ? device[4] : "X0";
    let verPlain = "";
    for (const element of packageInfo.version.split(".")) {
        verPlain += element.replace(/\D/g, "").padStart(2, "0");
    }
    return `${prefix}0BRS${verPlain.substring(0, 6)}`;
}

/**
 * Returns the device model type (STB, TV, etc.).
 * @returns Device model type string
 */
export function getModelType(): string {
    const device = deviceData.models?.get(deviceData.deviceModel);
    return device ? device[1] : "STB";
}

/**
 * Removes source code and replaces with encrypted pcode.
 * Creates a new zip package with encrypted content.
 * @param source Encrypted source data
 * @param iv Initialization vector for encryption
 * @returns New zip file as Uint8Array
 */
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

/**
 * Creates an AppPayload for execution.
 * @param launchTime Launch timestamp in milliseconds
 * @returns Complete AppPayload object
 */
export function createPayload(launchTime: number): AppPayload {
    return {
        device: deviceData,
        launchTime: launchTime,
        manifest: manifestMap,
        deepLink: inputParams,
        paths: paths,
        source: source,
        extensions: extensions,
        pkgZip: pkgZip,
        extZip: extZip,
        password: currentApp.password,
    };
}

/**
 * Sets up deep link parameters for the application.
 * Merges with default launch parameters.
 * @param deepLink Map of deep link key-value pairs
 */
export function setupDeepLink(deepLink: Map<string, string>) {
    inputParams.clear();
    inputParams.set("lastExitOrTerminationReason", currentApp.exitReason ?? AppExitReason.Unknown);
    /**
     * Options for "source" parameter:
     * - "auto-run-dev" when app is side-loaded (default)
     * - "homescreen" when opening from home screen
     * - "other-channel" when using roAppManager.launchApp()
     * - "external-control" when deep linking
     */
    inputParams.set("source", "auto-run-dev");
    for (const [key, value] of deepLink) {
        inputParams.set(key, value);
    }
}

/**
 * Resets the current app object to default state.
 * Clears package zip references.
 */
export function resetCurrentApp() {
    Object.assign(currentApp, createAppData());
    pkgZip = undefined;
}

/**
 * Creates a default AppData object.
 * @returns AppData with default values
 */
function createAppData(): AppData {
    return {
        id: "",
        title: "",
        subtitle: "",
        version: "",
        path: "",
        password: "",
        exitReason: AppExitReason.Unknown,
        exitTime: undefined,
        running: false,
    };
}

// TODO: Support dynamic mounting and unmounting of external storage
/**
 * Mounts external storage from a zip package.
 * @param zipData ArrayBuffer containing the external storage zip data
 */
export function mountExt(zipData: ArrayBuffer) {
    extZip = zipData;
}

/**
 * Unmounts external storage.
 */
export function umountExt() {
    extZip = undefined;
}
