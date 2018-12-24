import * as fs from "fs";
import * as path from "path";
import pify from "pify";

const exists = pify(fs.exists, { errorFirst: false });
const readFile = pify(fs.readFile);

/** The set of possible value types in a `manifest` file's `key=value` pair. */
export type ManifestValue = number | string | boolean;

/** A map containing the data from a `manifest` file. */
export type Manifest = Map<string, ManifestValue>;

/**
 * Attempts to read a `manifest` file, parsing its contents into a map of string to JavaScript
 * number, string, or boolean.
 * @param rootDir the root directory in which a `manifest` file is expected
 * @returns a Promise that resolves to a map of string to JavaScript number, string, or boolean,
 *          representing the manifest file's contents
 */
export async function getManifest(rootDir: string): Promise<Manifest> {
    let manifestPath = path.join(rootDir, "manifest");

    if (!await exists(manifestPath)) {
        if (process.env.NODE_ENV !== "test") { console.warn(`No manifest file detected at ${manifestPath}`); }
        return Promise.resolve(new Map());
    }

    let contents = await readFile(manifestPath, "utf-8");

    let keyValuePairs = contents
        // for each line
        .split("\n")
        // remove leading/trailing whitespace
        .map(line => line.trim())
        // ignore empty lines and commented lines
        .filter(line => line && !line.startsWith("#"))
        // separate keys and values
        .map(line => {
            let equals = line.indexOf("=");
            if (equals === -1) {
                throw new Error("No '=' detected.  Manifest lines must be of the form 'key=value'.");
            }
            return [line.slice(0, equals), line.slice(equals + 1)];
        })
        // keep only non-empty keys and values
        .filter(([key, value]) => key && value)
        // convert value to boolean, integer, or leave as string
        .map(([key, value]): [string, ManifestValue] => {
            if (value === "true") { return [key, true]; }
            if (value === "false") { return [key, false]; }

            let maybeNumber = Number.parseInt(value);
            // if it's not a number, it's just a string
            if (Number.isNaN(maybeNumber)) { return [key, value]; }
            return [key, maybeNumber];
        });

    return new Map<string, ManifestValue>(keyValuePairs);
}

/**
 * Parses a 'manifest' file's `bs_const` property into a map of key to boolean value.
 * @param manifest the internal representation of the 'manifest' file to extract `bs_const` from
 * @returns a map of key to boolean value, representing the `bs_const` attribute
 */
export function getBsConst(manifest: Manifest): Map<string, boolean> {
    if (!manifest.has("bs_const")) {
        return new Map();
    }

    let bsConstString = manifest.get("bs_const");
    if (typeof bsConstString !== "string") {
        throw new Error("Invalid bs_const right-hand side.  bs_const must be a string of ';'-separated 'key=value' pairs");
    }

    let keyValuePairs = bsConstString
        // for each key-value pair
        .split(";")
        // ignore empty key-value pairs
        .filter(keyValuePair => !!keyValuePair)
        // separate keys and values
        .map(keyValuePair => {
            let equals = keyValuePair.indexOf("=");
            if (equals === -1) {
                throw new Error("No '=' detected.  bs_const constants must be of the form 'key=value'.");
            }
            return [keyValuePair.slice(0, equals), keyValuePair.slice(equals + 1)];
        })
        // convert value to boolean or throw
        .map(([key, value]): [string, boolean] => {
            if (value === "true") { return [key, true]; }
            if (value === "false") { return [key, false]; }
            throw new Error(`Invalid value for bs_const key '${key}'.  Values must be either 'true' or 'false'.`);
        });

    return new Map(keyValuePairs);
}
