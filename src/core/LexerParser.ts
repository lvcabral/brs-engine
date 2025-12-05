/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Lexeme, Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser/";
import * as PP from "./preprocessor";
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
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
    if (parseResults.libraries.get("v30/bslDefender.brs") === true && lib.get("v30/bslDefender.brs") === "") {
        lib.set("v30/bslDefender.brs", fs.readFileSync("common:/LibCore/v30/bslDefender.brs", "utf8"));
        lib.set("v30/bslCore.brs", fs.readFileSync("common:/LibCore/v30/bslCore.brs", "utf8"));
    } else if (parseResults.libraries.get("v30/bslCore.brs") === true && lib.get("v30/bslCore.brs") === "") {
        lib.set("v30/bslCore.brs", fs.readFileSync("common:/LibCore/v30/bslCore.brs", "utf8"));
    }
    if (
        parseResults.libraries.get("Roku_Ads.brs") === true &&
        lib.get("Roku_Ads.brs") === "" &&
        manifest.get("bs_libs_required")?.includes("roku_ads_lib")
    ) {
        lib.set("Roku_Ads.brs", fs.readFileSync("common:/roku_ads/Roku_Ads.brs", "utf8"));
    }
    if (
        parseResults.libraries.get("IMA3.brs") === true &&
        lib.get("IMA3.brs") === "" &&
        manifest.get("bs_libs_required")?.includes("googleima3")
    ) {
        lib.set("IMA3.brs", fs.readFileSync("common:/roku_ads/IMA3.brs", "utf8"));
    }
    if (
        parseResults.libraries.get("Roku_Event_Dispatcher.brs") === true &&
        lib.get("Roku_Event_Dispatcher.brs") === "" &&
        manifest.get("sg_component_libs_required")?.includes("roku_analytics")
    ) {
        lib.set(
            "Roku_Event_Dispatcher.brs",
            fs.readFileSync("common:/roku_analytics/Roku_Event_Dispatcher.brs", "utf8")
        );
    }
    if (
        parseResults.libraries.get("RokuBrowser.brs") === true &&
        lib.get("RokuBrowser.brs") === "" &&
        manifest.get("bs_libs_required")?.includes("Roku_Browser")
    ) {
        lib.set("RokuBrowser.brs", fs.readFileSync("common:/roku_browser/RokuBrowser.brs", "utf8"));
    }
}
