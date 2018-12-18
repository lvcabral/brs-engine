import * as CC from "./Chunk";
import { ParseError } from "../parser";
import { Token, Lexeme } from "../lexer";
import * as BrsError from "../Error";

/**
 * A simple pre-processor that executes BrightScript's conditional compilation directives by
 * selecting chunks of tokens to be considered for later evaluation.
 */
export class Preprocessor implements CC.Visitor {

    private constants = new Map<string, boolean>();

    /**
     * Filters the tokens contained within a set of chunks based on a set of constants.
     * @param chunks the chunks from which to retrieve tokens
     * @returns an array of tokens, filtered by conditional compilation directives included within
     */
    filter(chunks: ReadonlyArray<CC.Chunk>) {
        return chunks.map(chunk => chunk.accept(this)).reduce(
           (allTokens: Token[], chunkTokens: Token[]) => [ ...allTokens, ...chunkTokens ],
           []
        );
    }

    /**
     * Handles a simple chunk of BrightScript tokens by returning the tokens contained within.
     * @param chunk the chunk to extract tokens from
     * @returns the array of tokens contained within `chunk`
     */
    visitBrightScript(chunk: CC.BrightScript) {
        return chunk.tokens;
    }

    /**
     * Handles a BrightScript `#const` directive, creating a variable in-scope only for the
     * conditional compilation pass.
     * @param chunk the `#const` directive, including the name and variable to use for the constant
     * @returns an empty array, since `#const` directives are always removed from the evaluated script.
     */
    visitDeclaration(chunk: CC.Declaration) {
        if (this.constants.has(chunk.name.text)) {
            throw BrsError.make(`Attempting to re-declare #const with name '${chunk.name.text}'`, chunk.name.line);
        }

        let value;
        switch (chunk.value.kind) {
            case Lexeme.True:
                value = true;
                break;
            case Lexeme.False:
                value = false;
                break;
            case Lexeme.Identifier:
                if (this.constants.has(chunk.value.text)) {
                    value = this.constants.get(chunk.value.text) as boolean;
                    break;
                }

                throw BrsError.make(`Attempting to create #const alias of '${chunk.value.text}', but no such #const exists`, chunk.value.line);
            default:
                throw BrsError.make("#const declarations can only have values of `true`, `false`, or other #const names", chunk.value.line);
        }

        this.constants.set(chunk.name.text, value);

        return [];
    }

    /**
     * Throws an error, stopping "compilation" of the program.
     * @param chunk the error to report to users
     * @throws a JavaScript error with the provided message
     */
    visitError(chunk: CC.Error): never {
        throw ParseError.make(chunk.hashError, chunk.message);
    }

    /**
     * Produces tokens from a branch of a conditional-compilation `#if`, or no tokens if no branches evaluate to `true`.
     * @param chunk the `#if` directive, any `#else if` or `#else` directives, and their associated BrightScript chunks.
     * @returns an array of tokens to include in the final executed script.
     */
    visitIf(chunk: CC.If): Token[] {
        if (this.evaluateCondition(chunk.condition)) {
            return chunk.thenChunks
                    .map(chunk => chunk.accept(this))
                    .reduce((allTokens, chunkTokens: Token[]) => [ ...allTokens, ...chunkTokens ], []);
        } else {
            for (const elseIf of chunk.elseIfs) {
                if (this.evaluateCondition(elseIf.condition)) {
                    return elseIf.thenChunks
                        .map(chunk => chunk.accept(this))
                        .reduce((allTokens, chunkTokens: Token[]) => [ ...allTokens, ...chunkTokens ], []);
                }
            }
        }

        if (chunk.elseChunks) {
            return chunk.elseChunks
                .map(chunk => chunk.accept(this))
                .reduce((allTokens, chunkTokens: Token[]) => [ ...allTokens, ...chunkTokens ], []);
        }

        return [];
    }

    /**
     * Resolves a token to a JavaScript boolean value, or throws an error.
     * @param token the token to resolve to either `true`, `false`, or an error
     * @throws if attempting to reference an undefined `#const` or if `token` is neither `true`, `false`, nor an identifier.
     */
    evaluateCondition(token: Token): boolean {
        switch (token.kind) {
            case Lexeme.True: return true;
            case Lexeme.False: return false;
            case Lexeme.Identifier:
                if (this.constants.has(token.text)) {
                    return this.constants.get(token.text) as boolean;
                }

                throw BrsError.make(`Attempting to reference undefined #const with name '${token.text}'`, token.line);
            default:
                throw BrsError.make("#if conditionals can only be `true`, `false`, or other #const names", token.line);
        }
    }
}
