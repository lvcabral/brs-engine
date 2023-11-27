/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { main } from "../../package.json";

// Shared array data types enumerator
export enum DataType {
    KEY,
    MOD,
    SND,
    IDX,
    WAV,
    DBG,
    EXP,
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
}

// Audio events enumerator
export enum AudioEvent {
    SELECTED,
    FULL,
    PARTIAL,
    PAUSED,
    RESUMED,
    FAILED,
}

// Module callback function definition
export type SubscribeCallback = (event: string, data?: any) => void;

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
    if (typeof document !== "undefined") {
        const scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1].src;
    }
    return main;
}
export function getEmuPath(): string {
    let libPath = getApiPath();
    /// #if DEBUG
    libPath = libPath.replace(".js", ".worker.js");
    /// #else
    libPath = libPath.replace(".min.js", ".worker.min.js");
    /// #endif
    return libPath;
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

export async function bufferToBase64(buffer: Uint8Array | ArrayBuffer) {
    // use a FileReader to generate a base64 data URI:
    const base64url: string = await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                r(reader.result);
            }
        };
        reader.readAsDataURL(new Blob([buffer]));
    });
    // remove the `data:...;base64,` part from the start
    return base64url.slice(base64url.indexOf(",") + 1);
}

/** Parse CSV string into a Map with first column as the key and the value contains the other columns into an array
 * @param csv the string containing the comma-separated values
 */
export function parseCSV(csv: string): Map<string, string[]> {
    let result = new Map<string, string[]>();
    let lines = csv.match(/[^\r\n]+/g);
    if (lines) {
        lines.forEach((line) => {
            let fields = line.split(",");
            result.set(fields[0], fields.slice(1));
        });
    }
    return result;
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
