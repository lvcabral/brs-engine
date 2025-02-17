import { EventEmitter } from "events";
import { Token } from "../lexer";
import { Parser } from "./Parser";
import { Preprocessor as InternalPreprocessor, FilterResults } from "./Preprocessor";

export class Preprocessor {
    private readonly parser = new Parser();
    private readonly _preprocessor = new InternalPreprocessor();

    readonly events = new EventEmitter();

    /**
     * Convenience function to subscribe to the `err` events emitted by `preprocessor.events`.
     * @param errorHandler the function to call for every preprocessing error emitted after subscribing
     * @returns an object with a `dispose` function, used to unsubscribe from errors
     */
    public onError(errorHandler: (err: BrsError | ParseError) => void) {
        this.events.on("err", errorHandler);
        return {
            dispose: () => {
                this.events.removeListener("err", errorHandler);
            },
        };
    }

    /**
     * Convenience function to subscribe to a single `err` event emitted by `preprocessor.events`.
     * @param errorHandler the function to call for the first preprocessing error emitted after subscribing
     */
    public onErrorOnce(errorHandler: (err: BrsError | ParseError) => void) {
        this.events.once("err", errorHandler);
    }

    constructor() {
        // plumb errors from the internal parser and preprocessor out to the public interface for convenience
        this.parser.events.on("err", (err) => this.events.emit("err", err));
        this._preprocessor.events.on("err", (err) => this.events.emit("err", err));
    }

    /**
     * Pre-processes a set of tokens, evaluating any conditional compilation directives encountered.
     * @param tokens the set of tokens to process
     * @param manifest the data stored in the found manifest file
     * @returns an array of processed tokens representing a subset of the provided ones
     */
    preprocess(tokens: readonly Token[], manifest: Map<string, string>): FilterResults {
        let parserResults = this.parser.parse(tokens);
        if (parserResults.errors.length > 0) {
            return {
                processedTokens: [],
                errors: parserResults.errors,
            };
        }

        return this._preprocessor.filter(parserResults.chunks, getBsConst(manifest));
    }
}

/**
 * Parses a 'manifest' file's `bs_const` property into a map of key to boolean value.
 * @param manifest the internal representation of the 'manifest' file to extract `bs_const` from
 * @returns a map of key to boolean value representing the `bs_const` attribute, or an empty map if
 *          no `bs_const` attribute is found.
 */
export function getBsConst(manifest: Map<string, string>): Map<string, boolean> {
    if (!manifest.has("bs_const")) {
        return new Map();
    }

    let bsConstString = manifest.get("bs_const");
    if (typeof bsConstString !== "string") {
        throw new Error(
            "Invalid bs_const right-hand side.  bs_const must be a string of ';'-separated 'key=value' pairs"
        );
    }

    let keyValuePairs = bsConstString
        // for each key-value pair
        .split(";")
        // ignore empty key-value pairs
        .filter((keyValuePair) => !!keyValuePair)
        // separate keys and values
        .map((keyValuePair) => {
            let equals = keyValuePair.indexOf("=");
            if (equals === -1) {
                throw new Error(
                    `No '=' detected for key ${keyValuePair}.  bs_const constants must be of the form 'key=value'.`
                );
            }
            return [keyValuePair.slice(0, equals), keyValuePair.slice(equals + 1)];
        })
        // remove leading/trailing whitespace from keys and values
        .map(([key, value]) => [key.trim(), value.trim()])
        // convert value to boolean or throw
        .map(([key, value]): [string, boolean] => {
            if (value.toLowerCase() === "true") {
                return [key, true];
            }
            if (value.toLowerCase() === "false") {
                return [key, false];
            }
            throw new Error(
                `Invalid value for bs_const key '${key}'.  Values must be either 'true' or 'false'.`
            );
        });

    return new Map(keyValuePairs);
}

import * as Chunk from "./Chunk";
import { BrsError } from "../error/BrsError";
import { ParseError } from "../parser";
export { Chunk };
export { Parser } from "./Parser";
