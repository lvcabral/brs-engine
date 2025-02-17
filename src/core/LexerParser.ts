/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import pSettle from "p-settle";
import { Lexeme, Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser/";
import * as PP from "./preprocessor";
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import { logError } from "./Error";
import { defaultExecutionOptions, ExecutionOptions } from "./interpreter";
import { ComponentScript } from "./scenegraph";
import { FileSystem } from "./FileSystem";
import { AppExitReason } from "./common";
import { ParseResults } from "./parser/Parser";

export function getLexerParserFn(
    fs: FileSystem,
    manifest: Map<string, string>,
    options: Partial<ExecutionOptions>
) {
    const executionOptions = { ...defaultExecutionOptions, ...options };
    /**
     * Map file URIs or Source Content to promises. The promises resolve to an array of that script's statements.
     * This allows us to only parse each shared file once.
     */
    let memoizedStatements = new Map<string, Promise<Stmt.Statement[]>>();
    return async function parse(scripts: ComponentScript[]): Promise<Stmt.Statement[]> {
        async function lexAndParseScript(script: ComponentScript) {
            let contents;
            let filename;
            if (script.uri !== undefined) {
                filename = script.uri.replace(/[\/\\]+/g, path.posix.sep);
                try {
                    contents = fs.readFileSync(filename, "utf-8");
                    script.content = contents;
                } catch (err) {
                    let errno = (err as NodeJS.ErrnoException)?.errno || -4858;
                    return Promise.reject({
                        message: `brs: can't open file '${filename}': [Errno ${errno}]`,
                    });
                }
            } else if (script.content !== undefined) {
                contents = script.content;
                filename = script.xmlPath || "xml";
            } else {
                return Promise.reject({ message: "brs: invalid script object" });
            }
            let lexer = new Lexer();
            let preprocessor = new PP.Preprocessor();
            let parser = new Parser();
            [lexer, preprocessor, parser].forEach((emitter) => emitter.onError(logError));

            let scanResults = lexer.scan(contents, filename);
            if (scanResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred during lexing",
                });
            }

            let preprocessResults = preprocessor.preprocess(scanResults.tokens, manifest);
            if (preprocessResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred during pre-processing",
                });
            }

            let parseResults = parser.parse(preprocessResults.processedTokens);
            if (parseResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred parsing",
                });
            }

            return Promise.resolve(parseResults.statements);
        }

        let promises: Promise<Stmt.Statement[]>[] = [];
        for (let script of scripts) {
            if (script.uri !== undefined) {
                let maybeStatements = memoizedStatements.get(script.uri);
                if (maybeStatements) {
                    promises.push(maybeStatements);
                } else {
                    let statementsPromise = lexAndParseScript(script);
                    if (!memoizedStatements.has(script.uri)) {
                        memoizedStatements.set(script.uri, statementsPromise);
                    }
                    promises.push(statementsPromise);
                }
            } else if (script.content !== undefined) {
                promises.push(lexAndParseScript(script));
            }
        }
        let parsedScripts = await pSettle(promises);

        // don't execute anything if there were reading, lexing, or parsing errors
        if (parsedScripts.some((script) => script.isRejected)) {
            return Promise.reject({
                messages: parsedScripts
                    .filter((script) => script.isRejected)
                    .map((rejection) => (rejection as PromiseRejectedResult).reason.message),
            });
        }

        // combine statements from all scripts into one array
        return parsedScripts
            .map((script) => (script.isFulfilled ? script.value : []))
            .reduce((allStatements, fileStatements) => [...allStatements, ...fileStatements], []);
    };
}

/**
 * A synchronous version of the lexer-parser flow.
 * @param fs the interpreter file system.
 * @param manifest Map with the manifest data.
 * @param sourceMap Map with the source code files content.
 * @param stats Map with the lexeme statistics.
 * @param password string with the encryption password (optional)
 *
 * @returns the ParseResult with the exit reason and the tokens and statements.
 */
export interface ParseResult {
    exitReason: AppExitReason;
    tokens: Token[];
    statements: Stmt.Statement[];
}

export function lexParseSync(
    fs: FileSystem,
    manifest: Map<string, any>,
    sourceMap: Map<string, string>,
    password = "",
    stats?: Map<Lexeme, number>
): ParseResult {
    const lexer = new Lexer();
    const parser = new Parser();
    const preprocessor = new PP.Preprocessor();
    const allStatements = new Array<Stmt.Statement>();
    const lib = new Map<string, string>();
    let tokens: Token[] = [];
    lexer.onError(logError);
    parser.onError(logError);
    let exitReason = AppExitReason.FINISHED;
    for (let [path, code] of sourceMap) {
        const scanResults = lexer.scan(code, path);
        if (scanResults.errors.length > 0) {
            exitReason = AppExitReason.CRASHED;
            break;
        }
        let preprocessorResults = preprocessor.preprocess(scanResults.tokens, manifest);
        if (preprocessorResults.errors.length > 0) {
            exitReason = AppExitReason.CRASHED;
            break;
        }
        if (password.length > 0) {
            tokens = tokens.concat(preprocessorResults.processedTokens);
            continue;
        }
        const parseResults = parser.parse(preprocessorResults.processedTokens);
        if (parseResults.errors.length > 0) {
            exitReason = AppExitReason.CRASHED;
            break;
        }
        parseLibraries(fs, parseResults, lib, manifest);
        allStatements.push(...parseResults.statements);
    }
    if (password.length === 0) {
        lib.forEach((value: string, key: string) => {
            if (value !== "") {
                sourceMap.set(key, value);
                const libScan = lexer.scan(value, key);
                const libParse = parser.parse(libScan.tokens);
                allStatements.push(...libParse.statements);
            }
        });
    }
    if (stats) {
        parser.stats.forEach((count, lexeme) => {
            stats.set(lexeme, count.size);
        });
    }
    return {
        exitReason: exitReason,
        tokens: tokens,
        statements: allStatements,
    };
}

/**
 * Function to parse the decoded tokens and return the statements to be executed.
 * @param fs the interpreter file system.
 * @param manifest the manifest data.
 * @param decodedTokens a Map with the decoded tokens to parse.
 *
 * @returns the parsed statements array.
 */
export function parseDecodedTokens(
    fs: FileSystem,
    manifest: Map<string, any>,
    decodedTokens: Map<string, any>
) {
    const lexer = new Lexer();
    const parser = new Parser();
    const allStatements = new Array<Stmt.Statement>();
    const lib = new Map<string, string>();
    lexer.onError(logError);
    parser.onError(logError);
    let tokens: Token[] = [];
    for (let [, value] of decodedTokens) {
        const token: any = value;
        if (token.literal) {
            if (token.kind === "Integer") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Int32(literal);
            } else if (token.kind === "LongInteger") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Int64(literal);
            } else if (token.kind === "Double") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Double(literal);
            } else if (token.kind === "Float") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Float(literal);
            } else if (token.kind === "String") {
                const literal: string = token.literal.value;
                token.literal = new BrsTypes.BrsString(literal);
            }
        }
        tokens.push(token);
        if (token.kind === "Eof") {
            const parseResults = parser.parse(tokens);
            if (parseResults.errors.length > 0 || parseResults.statements.length === 0) {
                throw new Error("Error parsing the tokens!");
            }
            parseLibraries(fs, parseResults, lib, manifest);
            allStatements.push(...parseResults.statements);
            tokens = [];
        }
    }
    lib.forEach((value: string, key: string) => {
        if (value !== "") {
            const libScan = lexer.scan(value, key);
            const libParse = parser.parse(libScan.tokens);
            allStatements.push(...libParse.statements);
        }
    });
    return allStatements;
}

/**
 * Evaluates parsed BrightScript code and add Libraries source
 * @param fs The interpreter file system
 * @param parseResults ParseResults object with the parsed code
 * @param lib Collection with the libraries source code
 * @param manifest Map with the manifest data
 */
function parseLibraries(
    fs: FileSystem,
    parseResults: ParseResults,
    lib: Map<string, string>,
    manifest: Map<string, any>
) {
    // Initialize Libraries on first run
    if (!lib.has("v30/bslDefender.brs")) {
        lib.set("v30/bslDefender.brs", "");
        lib.set("v30/bslCore.brs", "");
        lib.set("Roku_Ads.brs", "");
        lib.set("RokuBrowser.brs", "");
    }
    // Check for Libraries and add to the collection
    if (parseResults.libraries.get("v30/bslDefender.brs") === true) {
        lib.set(
            "v30/bslDefender.brs",
            fs.readFileSync("common:/LibCore/v30/bslDefender.brs", "utf8")
        );
        lib.set("v30/bslCore.brs", fs.readFileSync("common:/LibCore/v30/bslCore.brs", "utf8"));
    } else if (parseResults.libraries.get("v30/bslCore.brs") === true) {
        lib.set("v30/bslCore.brs", fs.readFileSync("common:/LibCore/v30/bslCore.brs", "utf8"));
    }
    if (
        parseResults.libraries.get("Roku_Ads.brs") === true &&
        manifest.get("bs_libs_required")?.includes("roku_ads_lib")
    ) {
        lib.set("Roku_Ads.brs", fs.readFileSync("common:/roku_ads/Roku_Ads.brs", "utf8"));
    }
    if (
        parseResults.libraries.get("RokuBrowser.brs") === true &&
        manifest.get("bs_libs_required")?.includes("Roku_Browser")
    ) {
        lib.set("RokuBrowser.brs", fs.readFileSync("common:/roku_browser/RokuBrowser.brs", "utf8"));
    }
}
