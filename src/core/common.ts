/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
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
    locale: SupportedLocale;
    clockFormat: string;
    displayMode: DisplayMode;
    captionMode: CaptionMode;
    captionStyle: Map<string, string>;
    captionLanguage: SupportedLanguage;
    assets: ArrayBufferLike;
    maxSimulStreams: 1 | 2 | 3;
    remoteControls: RemoteControl[];
    customFeatures: string[];
    connectionInfo: ConnectionInfo;
    localIps: string[];
    startTime: number;
    audioVolume: number;
    audioLanguage: SupportedLanguage;
    maxFps: number;
    registryBuffer?: SharedArrayBuffer;
    audioCodecs?: string[];
    videoFormats?: Map<string, string[]>;
    appList?: AppData[];
    entryPoint?: boolean;
    stopOnCrash?: boolean;
    corsProxy?: string;
}

export type SupportedLocale =
    | "en_US" // English (United States)
    | "en_GB" // English (United Kingdom)
    | "en_CA" // English (Canada)
    | "en_AU" // English (Australia)
    | "fr_CA" // French (Canada)
    | "es_ES" // Spanish (International)
    | "es_MX" // Spanish (Mexico)
    | "de_DE" // German (Germany)
    | "it_IT" // Italian (Italy)
    | "pt_BR"; // Portuguese (Brazil)

export type SupportedLanguage =
    | "en" // English
    | "es" // Spanish
    | "fr" // French
    | "de" // German
    | "it" // Italian
    | "pt" // Portuguese
    | "ru" // Russian
    | "tr" // Turkish
    | "pl" // Polish
    | "uk" // Ukrainian
    | "rm" // Romansh
    | "nl" // Dutch
    | "hr" // Croatian
    | "hu" // Hungarian
    | "el" // Greek
    | "cs" // Czech
    | "sv"; // Swedish

export const DisplayModes = ["480p", "720p", "1080p"] as const;
export type DisplayMode = (typeof DisplayModes)[number];
export const CaptionModes = ["Off", "On", "Instant replay", "When mute"] as const;
export type CaptionMode = (typeof CaptionModes)[number];
export function parseCaptionMode(mode: string): CaptionMode | undefined {
    const normalized = mode.trim().toLowerCase();
    return CaptionModes.find((mode) => mode.toLowerCase() === normalized);
}

// Default Device Information
export const platform = getPlatform();
export const defaultDeviceInfo: DeviceInfo = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443", // As in Roku devices, segregates Registry data (can't have a dot)
    friendlyName: "BrightScript Engine Library",
    deviceModel: "8000X", // Roku TV (Midland)
    firmwareVersion: "48F.04E12221A", // v14.0
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US", // App Store Country
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US", // Used if app supports localization
    clockFormat: "12h",
    displayMode: "720p",
    captionMode: "Off",
    captionStyle: new Map(),
    captionLanguage: "en",
    assets: new ArrayBuffer(0),
    maxSimulStreams: 2,
    remoteControls: [],
    customFeatures: [],
    connectionInfo: {
        type: "WiredConnection",
        name: "eth1",
        gateway: "127.0.0.1",
        ip: "127.0.0.1",
        dns: ["8.8.8.8", "8.8.4.4"],
        quality: "Excellent",
    },
    localIps: ["eth1,127.0.0.1"], // In a Browser is not possible to get a real IP, populate it on NodeJS or Electron.
    startTime: Date.now(),
    audioVolume: 50, // Defines the default volume level for system sounds - valid: (0-100)
    audioLanguage: "en",
    maxFps: 60,
};

// Valid Closed Captions Options
export const captionTextSizes: Map<string, number> = new Map([
    ["default", 30],
    ["extra small", 21],
    ["small", 22],
    ["medium", 30],
    ["large", 39],
    ["extra large", 43],
]);

export const captionColors: Map<string, string> = new Map([
    ["default", "#B0B0B0"],
    ["bright white", "#FFFFFF"],
    ["white", "#B0B0B0"],
    ["black", "#000000"],
    ["red", "#CA0000"],
    ["green", "#00BB00"],
    ["blue", "#0304D0"],
    ["yellow", "#B2B400"],
    ["magenta", "#C500C5"],
    ["cyan", "#00BBB9"],
]);

export const captionOpacities: Map<string, number> = new Map([
    ["default", 1.0],
    ["off", 0.0],
    ["25%", 0.25],
    ["50%", 0.5],
    ["75%", 0.75],
    ["100%", 1.0],
]);

export const captionsOptions: Map<string, string[]> = new Map([
    ["mode", ["Off", "On", "Instant replay", "When mute"]],
    [
        "text/font",
        [
            "default",
            "serif fixed width",
            "serif proportional",
            "sans serif fixed width",
            "casual",
            "cursive",
            "small caps",
        ],
    ],
    ["text/effect", ["default", "none", "raised", "depressed", "uniform", "drop shadow (left)", "drop shadow (right)"]],
    ["text/size", Array.from(captionTextSizes.keys())],
    ["text/color", Array.from(captionColors.keys())],
    ["text/opacity", Array.from(captionOpacities.keys())],
    ["background/color", Array.from(captionColors.keys())],
    ["background/opacity", Array.from(captionOpacities.keys())],
    ["window/color", Array.from(captionColors.keys())],
    ["window/opacity", Array.from(captionOpacities.keys())],
    ["track", ["default"]],
    ["track_composite", ["default"]],
    ["track_analog", ["default"]],
    ["muted", ["unmuted", "muted"]],
]);
console.debug("[common] Caption Options:", Array.from(captionsOptions.keys()));

/* Execution Payload Interfaces
 *
 * These interfaces are used to provide information to the interpreter about the
 * device, app/task that will be executed. It may contain the DeviceInfo object,
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
        typeof value.device === "object" &&
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

export type TaskPayload = {
    device: DeviceInfo;
    manifest: Map<string, string>;
    taskData: TaskData;
    pkgZip?: ArrayBuffer;
    extZip?: ArrayBuffer;
    root?: string;
    ext?: string;
};

export function isTaskPayload(value: any): value is TaskPayload {
    return (
        value &&
        typeof value.device === "object" &&
        value.manifest instanceof Map &&
        isTaskData(value.taskData) &&
        (value.pkgZip instanceof ArrayBuffer || value.pkgZip === undefined) &&
        (value.extZip instanceof ArrayBuffer || value.extZip === undefined) &&
        (typeof value.root === "string" || value.root === undefined) &&
        (typeof value.ext === "string" || value.ext === undefined)
    );
}

export enum TaskState {
    INIT,
    RUN,
    STOP,
    DONE,
}

export type TaskData = {
    id: number;
    name: string;
    state: TaskState;
    buffer?: SharedArrayBuffer;
    m?: any;
};

export function isTaskData(value: any): value is TaskData {
    return (
        value &&
        typeof value.id === "number" &&
        typeof value.name === "string" &&
        Object.values(TaskState).includes(value.state) &&
        (value.buffer instanceof SharedArrayBuffer || value.buffer === undefined) &&
        (typeof value.m === "object" || value.m === undefined)
    );
}

export type ThreadUpdate = {
    id: number;
    global: boolean;
    field: string;
    value: any;
};

export function isThreadUpdate(value: any): value is ThreadUpdate {
    return (
        value &&
        typeof value.id === "number" &&
        typeof value.global === "boolean" &&
        typeof value.field === "string" &&
        value.value !== undefined
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
    UNKFUNC = "EXIT_BRIGHTSCRIPT_UNK_FUNC",
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
    exitTime?: number;
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
        (typeof value.exitTime === "number" || value.exitTime === undefined) &&
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

/* Remote Control Interface
 *
 * This interface is used to provide information about the remote controls
 * that are available in the device.
 *
 */
export type RemoteControl = {
    model: number;
    features: string[];
};

/* Platform Interface
 *
 * This interface is used to provide information about the environment
 * where the engine is running.
 *
 */
export type Platform = {
    inBrowser: boolean;
    inChromium: boolean;
    inFirefox: boolean;
    inSafari: boolean;
    inElectron: boolean;
    inAndroid: boolean;
    inIOS: boolean;
    inMacOS: boolean;
    inWindows: boolean;
    inLinux: boolean;
    inChromeOS: boolean;
};

/* Connection Information Interface
 *
 * This interface is used to provide information about the connection
 * that is available in the device.
 *
 */
export type ConnectionInfo = {
    type: "WiFiConnection" | "WiredConnection" | "";
    name: string;
    ip: string;
    gateway: string;
    quality: "Excellent" | "Good" | "Fair" | "Poor";
    dns?: string[];
    protocol?: string;
    ssid?: string;
};

// Shared array data types enumerator
export enum DataType {
    DBG, // Debug Command
    BUF, // Buffer flag
    VDO, // Video Event
    VDX, // Video Event Index
    VSE, // Video Selected
    VLP, // Video Load Progress
    VPS, // Video Position
    VDR, // Video Duration
    VAT, // Video Audio Track
    VTT, // Video Text Track
    SND, // Sound Event
    SDX, // Sound Event Index
    SPS, // Sound Position
    SDR, // Sound Duration
    WAV, // Wave Audio
    WAV1, // Reserved for second stream
    WAV2, // Reserved for third stream
    MUHS, // Memory Used Heap Size
    MHSL, // Memory Heap Size Limit
    MBWD, // Measured Bandwidth
    CEC, // Consumer Electronics Control
    HDMI, // HDMI Status
    // Key Buffer starts here: KeyBufferSize * KeyArraySpots
    RID, // Remote Id
    KEY, // Key Code
    MOD, // Key State (down/up)
}

// SharedArrayBuffer constants
export const dataBufferIndex = 36;
export const dataBufferSize = 1024;
export const registryInitialSize = 32 * 1024;
export const registryMaxSize = 64 * 1024;

// Key Buffer Constants
export const keyBufferSize = 5; // Max is 5, if needs more space increase `dataBufferIndex`
export const keyArraySpots = 3;

// Remote control type
export enum RemoteType {
    IR = 10, // Infra Red (default)
    WD = 20, // Wifi Direct (keyboard simulation)
    BT = 30, // Bluetooth (gamepad simulation)
    SIM = 40, // Simulated
    ECP = 50, // External Control Protocol
    RMOB = 60, // Roku Mobile App (ECP2)
}
// Other RBI valid remote codes:
// CEC - Consumer Electronics Control
// MHL - Mobile High-Definition Link
// FP - Front Panel (for on-device controls)

// Key Event Interface
export interface KeyEvent {
    remote: string; // Remote Id (Remote Type:Remote Index)
    key: number; // Key Code
    mod: number; // Modifier (0 = press, 100 = release)
}

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
    FINISHED,
    FAILED,
    LOADING,
    START_STREAM,
    START_PLAY,
    POSITION,
}

// Media playback error codes enumerator
export enum MediaErrorCode {
    Network = 0,
    Http = -1,
    TimeOut = -2,
    Unknown = -3,
    EmptyList = -4,
    Unsupported = -5,
    DRM = -6,
}

// Media Track Interface
export interface MediaTrack {
    id: string;
    name: string;
    lang: string;
    codec?: string;
}

export function isMediaTrack(value: any): value is MediaTrack {
    return (
        value &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.lang === "string" &&
        (typeof value.codec === "string" || value.codec === undefined)
    );
}

// Buffer Data Types enumerator
export enum BufferType {
    DEBUG_EXPR,
    MEDIA_TRACKS,
    SYS_LOG,
    INPUT,
}

// Default Roku Sounds
export const DefaultSounds = ["select", "navsingle", "navmulti", "deadend"];

// Media Files Extensions
export const AudioExt = new Set<string>(["wav", "mp2", "mp3", "m4a", "aac", "ogg", "oga", "ac3", "wma", "flac"]);

export const VideoExt = new Set<string>(["mp4", "m4v", "mkv", "mov"]);

// Check the platform where the library is running
export function getPlatform(): Platform {
    let inBrowser = false;
    let inChromium = false;
    let inFirefox = false;
    let inSafari = false;
    let inElectron = false;
    let inAndroid = false;
    let inChromeOS = false;
    let inIOS = false;
    let inMacOS = false;
    let inLinux = false;
    let inWindows = false;
    if (typeof window !== "undefined") {
        inBrowser = true;
        inChromium = ("chrome" in window || (window.Intl && "v8BreakIterator" in Intl)) && "CSS" in window;
    }
    if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
        let ua = navigator.userAgent;
        // Check Browsers
        if (ua.indexOf("Electron") >= 0) {
            inElectron = true;
            inChromium = true;
        } else if (/Firefox\D+(\d+)/.test(ua)) {
            inFirefox = true;
        } else if (/^((?!chrome|android).)*safari/i.test(ua)) {
            inSafari = true;
        }
        // Check OS
        if (/Android/.test(ua)) {
            inAndroid = true;
        } else if (/CrOS/.test(ua)) {
            inChromeOS = true;
        } else if (/iP[ao]d|iPhone/i.test(ua)) {
            inIOS = true;
        } else if (/Mac OS/.test(ua) && !/like Mac OS/.test(ua)) {
            inMacOS = true;
        } else if (/Linux/.test(ua)) {
            inLinux = true;
        } else if (/Windows/.test(ua)) {
            inWindows = true;
        }
    } else if (process.platform === "android") {
        inAndroid = true;
    } else if (process.platform === "darwin") {
        inMacOS = true;
    } else if (process.platform === "linux") {
        inLinux = true;
    } else if (process.platform === "win32") {
        inWindows = true;
    }

    return {
        inBrowser: inBrowser,
        inChromium: inChromium,
        inFirefox: inFirefox,
        inSafari: inSafari,
        inElectron: inElectron,
        inAndroid: inAndroid,
        inChromeOS: inChromeOS,
        inIOS: inIOS,
        inLinux: inLinux,
        inMacOS: inMacOS,
        inWindows: inWindows,
    };
}

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
            if (line === "" || line.startsWith("#") || line.startsWith("'")) {
                return ["", ""];
            }

            let equals = line.indexOf("=");
            if (equals === -1) {
                const pos = `${index + 1},0-${line.length}`;
                console.warn(`manifest(${pos}): Missing "=". Manifest entries must have this format: key=value`);
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

// Function to convert the firmware string to a Map with Roku OS version parts
export function getRokuOSVersion(firmware: string) {
    const osVersion: Map<string, string> = new Map();
    if (firmware.length > 0) {
        const versions = "0123456789ACDEFGHJKLMNPRSTUVWXY";
        osVersion.set("major", versions.indexOf(firmware.charAt(2)).toString());
        osVersion.set("minor", firmware.slice(4, 5));
        osVersion.set("revision", firmware.slice(7, 8));
        osVersion.set("build", firmware.slice(8, 12));
        osVersion.set("plid", firmware.slice(0, 2));
    }
    return osVersion;
}

// Roku beacon date format
export function getNow(): string {
    let d = new Date();
    let mo = new Intl.DateTimeFormat("en-GB", { month: "2-digit", timeZone: "UTC" }).format(d);
    let da = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "UTC" }).format(d);
    let hr = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: "UTC" }).format(d);
    let mn = new Intl.DateTimeFormat("en-GB", { minute: "2-digit", timeZone: "UTC" }).format(d);
    let se = new Intl.DateTimeFormat("en-GB", { second: "2-digit", timeZone: "UTC" }).format(d);
    let ms = d.getMilliseconds();
    return `${mo}-${da} ${hr}:${mn}:${se}.${ms}`;
}
