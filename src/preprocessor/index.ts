import { Token } from "../lexer";

import { parse } from "./Parser";
import { Preprocessor } from "./Preprocessor";

/**
 * Pre-processes a set of tokens, evaluating any conditional compilation directives encountered.
 * @param tokens the set of tokens to process
 * @returns an array of processed tokens representing a subset of the provided ones
 */
export function preprocess(tokens: ReadonlyArray<Token>) {
    let chunks = parse(tokens);
    return new Preprocessor().filter(chunks);
}

import * as Chunk from "./Chunk";
export { Chunk };
export { parse } from "./Parser";
