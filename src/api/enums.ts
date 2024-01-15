/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared array data types enumerator
export enum DataType {
    KEY,
    MOD,
    DBG,
    EXP,
    VDO,
    VDX,
    VLP,
    VPS,
    VDR,
    SND,
    IDX,
    WAV, // Needs to be the last to allow variable # of streams
}

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
