/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Device Simulation Information Interface
 *
 * This interface is used to simulate a Roku device environment in the engine.
 * It feeds the interpreter with several device features like registry, fonts,
 * audio codecs, video formats, and other device information provided by `roDeviceInfo`.
 *
 * Roku documentation: https://developer.roku.com/docs/references/brightscript/interfaces/ifdeviceinfo.md
 */
export interface DeviceInfo {
    [key: string]: any;
    developerId: string;
    friendlyName: string;
    deviceModel: string;
    firmwareVersion: string;
    clientId: string;
    RIDA: string;
    countryCode: string;
    timeZone: string;
    locale: string;
    captionLanguage: string;
    clockFormat: string;
    displayMode: "480p" | "720p" | "1080p";
    defaultFont: string;
    fontPath: string;
    fonts?: Map<string, any>;
    maxSimulStreams: 1 | 2 | 3;
    customFeatures: string[];
    connectionType: "WiFiConnection" | "WiredConnection" | "";
    localIps: string[];
    startTime: number;
    audioVolume: number;
    maxFps: number;
    registry?: Map<string, string>;
    audioCodecs?: string[];
    videoFormats?: Map<string, string[]>;
    appList?: AppData[];
    entryPoint?: boolean;
    stopOnCrash?: boolean;
    runContext?: RunContext;
}

// Default Device Information
export const defaultDeviceInfo: DeviceInfo = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data (can't have a dot)
    friendlyName: "BrightScript Engine Library",
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "BSC.50E04330A", // v11.5
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US", // App Store Country
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US", // Used if app supports localization
    captionLanguage: "eng",
    clockFormat: "12h",
    displayMode: "720p",
    defaultFont: "Asap",
    fontPath: "../fonts/",
    fonts: new Map(),
    maxSimulStreams: 2,
    customFeatures: [],
    connectionType: "WiredConnection",
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    registry: new Map(),
    maxFps: 60,
};

export function isDeviceInfo(value: any): value is DeviceInfo {
    return (
        value &&
        typeof value.developerId === "string" &&
        typeof value.friendlyName === "string" &&
        typeof value.deviceModel === "string" &&
        typeof value.firmwareVersion === "string" &&
        typeof value.clientId === "string" &&
        typeof value.RIDA === "string" &&
        typeof value.countryCode === "string" &&
        typeof value.timeZone === "string" &&
        typeof value.locale === "string" &&
        typeof value.captionLanguage === "string" &&
        typeof value.clockFormat === "string" &&
        typeof value.displayMode === "string" &&
        typeof value.defaultFont === "string" &&
        typeof value.fontPath === "string" &&
        (value.fonts instanceof Map || value.fonts === undefined) &&
        typeof value.maxSimulStreams === "number" &&
        Array.isArray(value.customFeatures) &&
        typeof value.connectionType === "string" &&
        Array.isArray(value.localIps) &&
        typeof value.startTime === "number" &&
        typeof value.audioVolume === "number" &&
        typeof value.maxFps === "number" &&
        (value.registry instanceof Map || value.registry === undefined) &&
        (value.audioCodecs instanceof Array || value.audioCodecs === undefined) &&
        (value.videoFormats instanceof Map || value.videoFormats === undefined) &&
        (value.appList instanceof Array || value.appList === undefined) &&
        (typeof value.entryPoint === "boolean" || value.entryPoint === undefined) &&
        (typeof value.stopOnCrash === "boolean" || value.stopOnCrash === undefined) &&
        (value.runContext instanceof Object || value.runContext === undefined)
    );
}

/* Execution Payload Interface
 *
 * This interface is used to provide information to the interpreter about the
 * device and app that will be executed. It contains the DeviceInfo object,
 * the app manifest, source code, deep link, encryption password, paths,
 * some execution flags and file system paths.
 *
 */
export type AppPayload = {
    device: DeviceInfo;
    launchTime: number;
    manifest: Map<string, string>;
    deepLink: Map<string, string>;
    paths: PkgFilePath[];
    source: string[];
    pkgZip?: ArrayBuffer;
    extZip?: ArrayBuffer;
    password?: string;
    root?: string;
    ext?: string;
};

export function isAppPayload(value: any): value is AppPayload {
    return (
        value &&
        isDeviceInfo(value.device) &&
        typeof value.launchTime === "number" &&
        value.manifest instanceof Map &&
        value.deepLink instanceof Map &&
        Array.isArray(value.paths) &&
        Array.isArray(value.source) &&
        (value.pkgZip instanceof ArrayBuffer || value.pkgZip === undefined) &&
        (value.extZip instanceof ArrayBuffer || value.extZip === undefined) &&
        (typeof value.password === "string" || value.password === undefined) &&
        (typeof value.root === "string" || value.root === undefined) &&
        (typeof value.ext === "string" || value.ext === undefined)
    );
}

/* Package File Path Interface
 *
 * This interface is used to provide information about the paths to the
 * source code and pcode files that are available in the app package.
 * It is sent to the interpreter via `ExecPayload.paths`.
 *
 */
export type PkgFilePath = {
    id: number;
    url: string;
    type: "source" | "pcode";
};

/* App Exit Reason Enumerator
 *
 * This enumerator is used to provide information about the reason
 * why the app was terminated.
 *
 * Roku documentation: https://developer.roku.com/docs/developer-program/getting-started/architecture/dev-environment.md#lastexitorterminationreason-parameter
 */
export enum AppExitReason {
    UNKNOWN = "EXIT_UNKNOWN",
    CRASHED = "EXIT_BRIGHTSCRIPT_CRASH",
    FINISHED = "EXIT_USER_NAV",
    SETTINGS = "EXIT_SETTINGS_UPDATE",
    POWER = "EXIT_POWER_MODE",
    PACKAGED = "EXIT_PACKAGER_DONE",
    INVALID = "EXIT_INVALID_PCODE",
    PASSWORD = "EXIT_MISSING_PASSWORD",
    UNPACK = "EXIT_UNPACK_FAILED",
}

/* App Data Interface
 *
 * This interface is used to provide information about the apps that are
 * available in the device and status of the app that is currently running.
 *
 */
export type AppData = {
    id: string;
    title: string;
    subtitle?: string;
    version: string;
    path?: string;
    icon?: string;
    password?: string;
    exitReason?: AppExitReason;
    params?: Map<string, string>;
    running?: boolean;
};

// Function to check if a value is an AppData object
export function isAppData(value: any): value is AppData {
    return (
        value &&
        typeof value.id === "string" &&
        typeof value.title === "string" &&
        typeof value.version === "string" &&
        (typeof value.path === "string" || value.path === undefined) &&
        (typeof value.icon === "string" || value.icon === undefined) &&
        (typeof value.password === "string" || value.password === undefined) &&
        (typeof value.exitReason === "string" || value.exitReason === undefined) &&
        (value.params instanceof Map || value.params === undefined) &&
        (typeof value.running === "boolean" || value.running === undefined)
    );
}

/**
 * NDK Start Interface
 */
export type NDKStart = {
    app: "roku_browser" | "SDKLauncher";
    params: string[];
    env: string[];
};

// Function to check if a value is an NDKStart object
export function isNDKStart(value: any): value is NDKStart {
    return (
        value &&
        typeof value.app === "string" &&
        ["roku_browser", "SDKLauncher"].includes(value.app) &&
        Array.isArray(value.params) &&
        Array.isArray(value.env)
    );
}

/* Run Context Interface
 *
 * This interface is used to provide information about the environment
 * where the engine is running.
 *
 */
export type RunContext = {
    inElectron: boolean;
    inChromium: boolean;
    inBrowser: boolean;
    inSafari: boolean;
    inApple: boolean;
    inIOS: boolean;
};

// Shared array data types enumerator
export enum DataType {
    DBG, // Debug Command
    BUF, // Buffer flag
    VDO, // Video State
    VDX, // Video Index
    VSE, // Video Selected
    VLP, // Video Load Progress
    VPS, // Video Position
    VDR, // Video Duration
    SND, // Sound State
    IDX, // Sound Index
    WAV, // Wave Audio
    WAV1, // Reserved for second stream
    WAV2, // Reserved for third stream
    // Key Buffer starts here: KeyBufferSize * KeyArraySpots
    RID, // Remote Id
    KEY, // Key Code
    MOD, // Key State (down/up)
}

// Debug constants
export const dataBufferIndex = 32;
export const dataBufferSize = 512;

// Key Buffer Constants
export const keyBufferSize = 5; // Max is 6, if needs more space increase `dataBufferIndex`
export const keyArraySpots = 3;

// Remote control type
export enum RemoteType {
    SIM = 10, // Simulated (default)
    IR = 20, // Infra Red
    WD = 30, // Wifi Direct
    ECP = 40, // External Control Protocol
    RMOB = 50, // Roku Mobile App (ECP2)
}
// Other RBI valid remote codes:
// BT - Bluetooth
// CEC - Consumer Electronics Control
// MHL - Mobile High-Definition Link
// FP - Front Panel (for on-device controls)

// Debug prompt
export const debugPrompt = "Brightscript Debugger> ";

// Debug commands enumerator
export enum DebugCommand {
    BSCS,
    BT,
    CLASSES,
    CONT,
    EXIT,
    EXPR,
    HELP,
    LAST,
    LIST,
    NEXT,
    STATS,
    STEP,
    THREAD,
    THREADS,
    VAR,
    BREAK,
    PAUSE,
}

// Media events enumerator
export enum MediaEvent {
    SELECTED,
    FULL,
    PARTIAL,
    PAUSED,
    RESUMED,
    FAILED,
    LOADING,
    START_STREAM,
    START_PLAY,
    POSITION,
}

// Buffer Data Types enumerator
export enum BufferType {
    NONE,
    AUDIO_TRACKS,
    VIDEO_INFO,
}

// Media Files Extensions
export const audioExt = new Set<string>([
    "wav",
    "mp2",
    "mp3",
    "m4a",
    "aac",
    "ogg",
    "oga",
    "ac3",
    "wma",
    "flac",
]);

export const videoExt = new Set<string>(["mp4", "m4v", "mkv", "mov"]);

// Function to parse the Manifest file into a Map
export function parseManifest(contents: string) {
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
                console.warn(
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

// Function to return the Exit Reason from the enumerator based on a string
export function getExitReason(value: string): AppExitReason {
    if (Object.values(AppExitReason).includes(value as any)) {
        return value as AppExitReason;
    } else {
        return AppExitReason.UNKNOWN;
    }
}

// Function to convert a number to a hexadecimal string
export function numberToHex(value: number, pad: string = ""): string {
    return (value >>> 0).toString(16).padStart(8, pad);
}

// This function takes a text file content as a string and returns an array of lines
export function parseTextFile(content?: string): string[] {
    let lines: string[] = [];
    if (content) {
        lines = content.trimEnd().split("\n");
    }
    return lines;
}
