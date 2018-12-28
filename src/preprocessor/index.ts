import { Token } from "../lexer";

import { parse } from "./Parser";
import { Preprocessor } from "./Preprocessor";
import { Manifest, getBsConst } from "./Manifest";

/**
 * Pre-processes a set of tokens, evaluating any conditional compilation directives encountered.
 * @param tokens the set of tokens to process
 * @param manifest the data stored in
 * @returns an array of processed tokens representing a subset of the provided ones
 */
export function preprocess(tokens: ReadonlyArray<Token>, manifest: Manifest) {
    let chunks = parse(tokens);
    return new Preprocessor().filter(chunks, getBsConst(manifest));
}

import * as Chunk from "./Chunk";
export { Chunk };
export { parse } from "./Parser";
export { getManifest, getBsConst, Manifest } from "./Manifest";
