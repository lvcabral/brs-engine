/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BufferType, DataBufferIndex, DataBufferSize, DataType } from "../core/common";
import packageInfo from "../../packages/browser/package.json";

// Module callback function definition
export type SubscribeCallback = (event: string, data?: any) => void;

/**
 * Gets the path to the API library script.
 * @returns Path to the API library or main entry point
 */
export function getApiPath(): string {
    if (typeof document !== "undefined") {
        const scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1].src;
    }
    return packageInfo.main;
}
/**
 * Gets the path to the worker library script.
 * @returns Path to the worker library with version query parameter
 */
export function getWorkerLibPath(): string {
    let libPath = getApiPath();
    const apiIndex = libPath.indexOf(".api.js");
    if (apiIndex !== -1) {
        libPath = libPath.substring(0, apiIndex);
    }
    libPath = `${libPath}.worker.js?v=${packageInfo.version}`;
    return libPath;
}

/**
 * Saves string data to the shared array buffer.
 * @param sharedArray The shared Int32Array buffer
 * @param data String data to save
 * @param type BufferType indicating the data type
 */
export function saveDataBuffer(sharedArray: Int32Array, data: string, type: BufferType) {
    // Store string on SharedArrayBuffer
    data = data.trim();
    let len = Math.min(data.length, DataBufferSize);
    for (let i = 0; i < len; i++) {
        Atomics.store(sharedArray, DataBufferIndex + i, data.charCodeAt(i));
    }
    // String terminator
    if (len < DataBufferSize) {
        Atomics.store(sharedArray, DataBufferIndex + len, 0);
    }
    // Set the type information
    Atomics.store(sharedArray, DataType.BUF, type);
}

/**
 * Converts a buffer to a Base64 string.
 * @param buffer Uint8Array or ArrayBuffer to convert
 * @returns Promise resolving to Base64 string
 */
export async function bufferToBase64(buffer: Uint8Array | ArrayBuffer) {
    // use a FileReader to generate a base64 data URI:
    const base64url: string = await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                r(reader.result);
            }
        };
        reader.readAsDataURL(new Blob([buffer as BlobPart]));
    });
    // remove the `data:...;base64,` part from the start
    return base64url.slice(base64url.indexOf(",") + 1);
}

/**
 * Checks if a value is a valid number.
 * @param value String or number to check
 * @returns True if the value is a valid number
 */
export function isNumber(value?: string | number): boolean {
    return value != null && value !== "" && !Number.isNaN(Number(value.toString()));
}

// Map to convert a 3-letter ISO 639-2 language code to a 2-letter ISO 639-1 code.
const localeMap: Map<string, string> = new Map([
    ["afr", "af"], // Afrikaans
    ["alb", "sq"], // Albanian
    ["ara", "ar"], // Arabic
    ["arm", "hy"], // Armenian
    ["aze", "az"], // Azerbaijani
    ["baq", "eu"], // Basque
    ["bel", "be"], // Belarusian
    ["ben", "bn"], // Bengali
    ["bos", "bs"], // Bosnian
    ["bod", "bo"], // Tibetan
    ["bul", "bg"], // Bulgarian
    ["bur", "bg"], // Burmese
    ["cat", "ca"], // Catalan
    ["ces", "cs"], // Czech
    ["chi", "zh"], // Chinese
    ["cym", "cy"], // Welsh
    ["cze", "cs"], // Czech
    ["dan", "da"], // Danish
    ["deu", "de"], // German
    ["dut", "nl"], // Dutch
    ["ell", "el"], // Greek
    ["eng", "en"], // English
    ["est", "et"], // Estonian
    ["eus", "eu"], // Basque
    ["fas", "fa"], // Persian
    ["fin", "fi"], // Finnish
    ["fra", "fr"], // French
    ["fre", "fr"], // French
    ["geo", "ka"], // Georgian
    ["ger", "de"], // German
    ["gle", "ga"], // Irish
    ["glg", "gl"], // Galician
    ["gre", "el"], // Greek
    ["heb", "he"], // Hebrew
    ["hin", "hi"], // Hindi
    ["hrv", "hr"], // Croatian
    ["hun", "hu"], // Hungarian
    ["hye", "hy"], // Armenian
    ["ice", "is"], // Icelandic
    ["ind", "id"], // Indonesian
    ["isl", "is"], // Icelandic
    ["ita", "it"], // Italian
    ["jpn", "ja"], // Japanese
    ["kat", "ka"], // Georgian
    ["kor", "ko"], // Korean
    ["lav", "lv"], // Latvian
    ["lit", "lt"], // Lithuanian
    ["mac", "mk"], // Macedonian
    ["mao", "mi"], // Maori
    ["may", "ms"], // Malay
    ["mkd", "mk"], // Macedonian
    ["mlt", "mt"], // Maltese
    ["mon", "mn"], // Mongolian
    ["mri", "mi"], // Maori
    ["msa", "ms"], // Malay
    ["mya", "bg"], // Burmese
    ["nld", "nl"], // Dutch
    ["nor", "no"], // Norwegian
    ["per", "fa"], // Persian
    ["pol", "pl"], // Polish
    ["por", "pt"], // Portuguese
    ["ron", "ro"], // Romanian
    ["rum", "ro"], // Romanian
    ["rus", "ru"], // Russian
    ["slk", "sk"], // Slovak
    ["slo", "sk"], // Slovak
    ["slv", "sl"], // Slovenian
    ["spa", "es"], // Spanish
    ["sqi", "sq"], // Albanian
    ["srp", "sr"], // Serbian
    ["swe", "sv"], // Swedish
    ["tha", "th"], // Thai
    ["tib", "bo"], // Tibetan
    ["tur", "tr"], // Turkish
    ["ukr", "uk"], // Ukrainian
    ["vie", "vi"], // Vietnamese
    ["wel", "cy"], // Welsh
    ["yid", "yi"], // Yiddish
    ["yor", "yo"], // Yoruba
    ["zho", "zh"], // Chinese
]);

/**
 * Formats a locale string to a 2-letter ISO 639-1 code.
 * Converts 3-letter ISO 639-2 codes to 2-letter equivalents.
 * @param locale Locale string to format (2 or 3 letters)
 * @returns 2-letter ISO 639-1 language code
 */
export function formatLocale(locale: string) {
    let lang = locale?.toLowerCase() ?? "";
    if (lang.length === 3) {
        lang = localeMap.get(lang) ?? lang.slice(0, 2);
    } else if (lang.length > 2 && lang.includes("-")) {
        lang = lang.split("-")[0];
    } else {
        lang = lang.slice(0, 2);
    }
    return lang;
}

/** Parse CSV string into a Map with first column as the key and the value contains the other columns into an array
 * @param csv the string containing the comma-separated values
 */
export function parseCSV(csv: string): Map<string, string[]> {
    let result = new Map<string, string[]>();
    let lines = csv.match(/[^\r\n]+/g);
    if (lines) {
        for (const line of lines) {
            let fields = line.split(",");
            result.set(fields[0], fields.slice(1));
        }
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
