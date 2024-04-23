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
    displayMode: string;
    defaultFont: string;
    fontPath: string;
    fonts?: Map<string, string>;
    maxSimulStreams: number;
    customFeatures: string[];
    connectionType: string;
    localIps: string[];
    startTime: number;
    audioVolume: number;
    maxFps: number;
    registry?: Map<string, string>;
}

export const defaultDeviceInfo: DeviceInfo = {
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
    maxSimulStreams: 2, // Max number of audio resource streams (1, 2 or 3)
    customFeatures: new Array<string>(),
    connectionType: "WiredConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
    registry: new Map(),
    maxFps: 60,
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
// Other valid remote codes:
// BT - Bluetooth
// CEC - Consumer Electronics Control
// MHL - Mobile High-Definition Link
// FP - Front Panel (for on device controls)

// Debug prompt
export const debugPrompt = "Brightscript Debugger> ";

// Debug commands enumerator
export enum DebugCommand {
    BT,
    CONT,
    EXIT,
    HELP,
    LAST,
    LIST,
    NEXT,
    STEP,
    THREAD,
    THREADS,
    VAR,
    EXPR,
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
