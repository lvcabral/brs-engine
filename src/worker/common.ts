/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Default Device Information
// Roku documentation: https://developer.roku.com/docs/references/brightscript/interfaces/ifdeviceinfo.md
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
    context?: RunContext;
}

export const defaultDeviceInfo: DeviceInfo = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data
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

export type AppPayload = {
    device: DeviceInfo;
    manifest: Map<string, string>;
    input: Map<string, string>;
    paths: AppFilePath[];
    brs: string[];
    pkgZip: ArrayBuffer;
    extZip?: ArrayBuffer;
    password?: string;
    entryPoint?: boolean;
    stopOnCrash?: boolean;
};

export type AppFilePath = {
    id: number;
    url: string;
    type: "source" | "text" | "binary" | "audio" | "video" | "pcode";
    format?: string;
    binId?: number;
};

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

export type AppData = {
    id: string;
    file: string;
    title: string;
    subtitle: string;
    version: string;
    execSource: string;
    exitReason: AppExitReason;
    password: string;
    clearDisplay: boolean;
    debugOnCrash: boolean;
    audioMetadata: boolean;
    running: boolean;
};

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

export function getExitReason(value: string): AppExitReason {
    if (Object.values(AppExitReason).includes(value as any)) {
        return value as AppExitReason;
    } else {
        return AppExitReason.UNKNOWN;
    }
}

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
