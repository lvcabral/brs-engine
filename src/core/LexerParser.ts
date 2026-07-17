/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Lexeme, Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser/";
import * as PP from "./preprocessor";
import * as BrsTypes from "./brsTypes";
export * as types from "./brsTypes";
export * as preprocessor from "./preprocessor";
import { logError } from "./error/BrsError";
import { FileSystem } from "./device/FileSystem";
import { AppExitReason } from "./common";
import { ParseResults } from "./parser/Parser";

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
    preprocessor.onError(logError);
    let exitReason = AppExitReason.UserNav;
    try {
        for (let [path, code] of sourceMap) {
            const scanResults = lexer.scan(code, path);
            if (scanResults.errors.length > 0) {
                exitReason = AppExitReason.Crashed;
                break;
            }
            const preprocessorResults = preprocessor.preprocess(scanResults.tokens, manifest);
            if (preprocessorResults.errors.length > 0) {
                exitReason = AppExitReason.Crashed;
                break;
            }
            if (password.length > 0) {
                tokens = tokens.concat(preprocessorResults.processedTokens);
                continue;
            }
            const parseResults = parser.parse(preprocessorResults.processedTokens);
            if (parseResults.errors.length > 0) {
                exitReason = AppExitReason.Crashed;
                break;
            }
            parseLibraries(fs, parseResults, lib, manifest);
            allStatements.push(...parseResults.statements);
        }
        if (password.length === 0) {
            for (const [key, value] of lib) {
                if (value !== "") {
                    sourceMap.set(key, value);
                    const libScan = lexer.scan(value, key);
                    const libParse = parser.parse(libScan.tokens);
                    allStatements.push(...libParse.statements);
                }
            }
        }
        if (stats) {
            for (const [lexeme, count] of parser.stats) {
                stats.set(lexeme, count.size);
            }
        }
    } catch (err: any) {
        exitReason = AppExitReason.Crashed;
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
export function parseDecodedTokens(fs: FileSystem, manifest: Map<string, any>, decodedTokens: Map<string, any>) {
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
                token.literal = new BrsTypes.Int32(literal, true);
            } else if (token.kind === "LongInteger") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Int64(literal, true);
            } else if (token.kind === "Double") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Double(literal, true);
            } else if (token.kind === "Float") {
                const literal: number = token.literal.value;
                token.literal = new BrsTypes.Float(literal, true);
            } else if (token.kind === "String") {
                const literal: string = token.literal.value;
                token.literal = new BrsTypes.BrsString(literal, true);
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
    for (const [key, value] of lib) {
        if (value !== "") {
            const libScan = lexer.scan(value, key);
            const libParse = parser.parse(libScan.tokens);
            allStatements.push(...libParse.statements);
        }
    }
    return allStatements;
}

/**
 * Resolves a BrightScript library name to its source code on the `common:` volume,
 * honoring the manifest entry that gates each library.
 * @param fs The interpreter file system
 * @param libName The library name as declared in the `Library` statement (e.g. "Roku_Ads.brs")
 * @param manifest Map with the manifest data
 * @returns the library source code, or `undefined` when the name is unknown or the manifest does not require it
 */
export function getLibrarySource(fs: FileSystem, libName: string, manifest: Map<string, any>): string | undefined {
    switch (libName) {
        case "v30/bslDefender.brs":
            return fs.readFileSync("common:/LibCore/v30/bslDefender.brs", "utf8");
        case "v30/bslCore.brs":
            return fs.readFileSync("common:/LibCore/v30/bslCore.brs", "utf8");
        case "Roku_Ads.brs":
            if (manifest.get("bs_libs_required")?.includes("roku_ads_lib")) {
                return fs.readFileSync("common:/roku_ads/Roku_Ads.brs", "utf8");
            }
            return undefined;
        case "IMA3.brs":
            if (manifest.get("bs_libs_required")?.includes("googleima3")) {
                return fs.readFileSync("common:/roku_ads/IMA3.brs", "utf8");
            }
            return undefined;
        case "Roku_Event_Dispatcher.brs":
            if (manifest.get("sg_component_libs_required")?.includes("roku_analytics")) {
                return fs.readFileSync("common:/roku_analytics/Roku_Event_Dispatcher.brs", "utf8");
            }
            return undefined;
        case "RokuBrowser.brs":
            if (manifest.get("bs_libs_required")?.includes("Roku_Browser")) {
                return fs.readFileSync("common:/roku_browser/RokuBrowser.brs", "utf8");
            }
            return undefined;
        default:
            return undefined;
    }
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
        lib.set("IMA3.brs", "");
        lib.set("Roku_Event_Dispatcher.brs", "");
        lib.set("RokuBrowser.brs", "");
    }
    // Check for Libraries and add to the collection
    for (const [libName, used] of parseResults.libraries) {
        if (used && lib.get(libName) === "") {
            lib.set(libName, getLibrarySource(fs, libName, manifest) ?? "");
        }
    }
    // bslDefender depends on bslCore, so load it as well
    if (lib.get("v30/bslDefender.brs") !== "" && lib.get("v30/bslCore.brs") === "") {
        lib.set("v30/bslCore.brs", getLibrarySource(fs, "v30/bslCore.brs", manifest) ?? "");
    }
}
