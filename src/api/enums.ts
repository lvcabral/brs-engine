/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared array data types enumerator
export enum DataType {
    RID, // Remote Id
    KEY, // Key code
    MOD, // Key Modification
    DBG, // Debug Command
    EXP, // Debug Expression flag
    VDO, // Video State
    VDX, // Video Index
    VLP, // Video Load Progress
    VPS, // Video Position
    VDR, // Video Duration
    SND, // Sound State
    IDX, // Sound Index
    WAV, // Wave Audio - Needs to be the last to allow variable # of streams
}

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

// Debug constants
export const dataBufferIndex = 32;
export const dataBufferSize = 512;

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
}
