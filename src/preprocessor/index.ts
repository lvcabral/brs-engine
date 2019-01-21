import { EventEmitter } from "events";

import { Token } from "../lexer";

import { Parser } from "./Parser";
import { Preprocessor as InternalPreprocessor, FilterResults } from "./Preprocessor";
import { Manifest, getBsConst } from "./Manifest";

export class Preprocessor {
    private parser = new Parser();
    private _preprocessor = new InternalPreprocessor();

    readonly events = new EventEmitter();

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
    preprocess(tokens: ReadonlyArray<Token>, manifest: Manifest): FilterResults {
        let parserResults = this.parser.parse(tokens);
        if (parserResults.errors.length > 0) {
            return {
                processedTokens: [],
                errors: parserResults.errors
            };
        }

        return this._preprocessor.filter(parserResults.chunks, getBsConst(manifest));
    }
}

import * as Chunk from "./Chunk";
export { Chunk };
export { Parser } from "./Parser";
export { getManifest, getBsConst, Manifest } from "./Manifest";
