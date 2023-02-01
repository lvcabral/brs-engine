/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared array data types enumerator
export enum dataType {
    KEY,
    MOD,
    SND,
    IDX,
    WAV,
}

// Audio events enumerator
export enum audioEvent {
    SELECTED,
    FULL,
    PARTIAL,
    PAUSED,
    RESUMED,
    FAILED,
}

// Module callback function definition
export type subscribeCallback = (event: string, data?: any) => void;

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

// Libraries Path
export function getApiPath(): string {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1].src;
}
export function getEmuPath(): string {
    const apiPath = getApiPath();
    return apiPath.replace("brsEmu.", "brsEmu.worker.");
}

// Check if the library is running inside Electron
export function isElectron() {
    // Detect the user agent when the `nodeIntegration` option is set to true
    if (
        typeof navigator === "object" &&
        typeof navigator.userAgent === "string" &&
        navigator.userAgent.indexOf("Electron") >= 0
    ) {
        return true;
    }
    return false;
}

// Generate short Hash
declare global {
    interface String {
        hashCode(): string;
    }
}

String.prototype.hashCode = function (this: string) {
    let hash: number = 0,
        i: number,
        chr: number;
    if (this.length === 0) return hash.toString();
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
};
