/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared array data types enumerator
export enum DataType {
    DBG, // Debug Command
    BUF, // Buffer flag
    VDO, // Video State
    VDX, // Video Index
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
export const keyBufferSize = 5; // Max is 6, if needs more space needs to increase `dataBufferIndex`
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
    POSITION,
    STARTED,
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
