/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import packageInfo from "../../package.json";

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
    return packageInfo.main;
}
export function getWorkerLibPath(): string {
    let libPath = getApiPath();
    libPath = libPath.replace(".api.js", `.worker.js?v=${packageInfo.version}`);
    return libPath;
}

// Check the context where the library is running
export const context = getContext();
function getContext() {
    let inApple = false;
    let inSafari = false;
    if (typeof navigator !== "undefined") {
        inApple = /(Mac|iPhone|iPad)/i.test(navigator.platform);
        inSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    } else {
        inApple = process.platform === "darwin";
    }
    return {
        inElectron:
            typeof navigator === "object" &&
            typeof navigator.userAgent === "string" &&
            navigator.userAgent.indexOf("Electron") >= 0,
        inBrowser: typeof window !== "undefined",
        inSafari: inSafari,
        inApple: inApple,
    };
}

// Convert Buffer to Base 64 string
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
