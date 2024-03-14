/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { dataBufferIndex, dataBufferSize } from "./enums";
import { Interpreter } from "./interpreter";
import { RoAssociativeArray, AAMember, BrsString, Int32, Int64, Double, Float } from "./brsTypes";
import { FileSystem } from "./interpreter/FileSystem";
import { Lexer, Token } from "./lexer";
import { Parser } from "./parser";
import * as PP from "./preprocessor";
import * as BrsError from "./Error";
import * as _lexer from "./lexer";
import * as BrsTypes from "./brsTypes";
import * as _parser from "./parser";
import * as path from "path";
import * as xml2js from "xml2js";
import * as crypto from "crypto";
import { encode, decode } from "@msgpack/msgpack";
import { zlibSync, unzlibSync } from "fflate";
import bslCore from "./common/v30/bslCore.brs";
import bslDefender from "./common/v30/bslDefender.brs";
import Roku_Ads from "./common/Roku_Ads.brs";
import packageInfo from "../../package.json";

export { _lexer as lexer };
export { BrsTypes as types };
export { PP as preprocessor };
export { _parser as parser };
export const shared = new Map<string, Int32Array>();
export const source = new Map<string, string>();
const algorithm = "aes-256-ctr";
let pcode: Buffer;
let iv: string;
let endReason: string;

/// #if WORKER
if (typeof onmessage !== "undefined") {
    // Worker event that is triggered by postMessage() calls from the API library
    onmessage = function (event: any) {
        if (event.data.device) {
            executeFile(event.data);
        } else if (typeof event.data === "string" && event.data === "getVersion") {
            postMessage(`version,${packageInfo.version}`);
        } else if (event.data instanceof ArrayBuffer || event.data instanceof SharedArrayBuffer) {
            // Setup Control Shared Array
            shared.set("buffer", new Int32Array(event.data));
        } else {
            postMessage(`warning,[worker] Invalid message received: ${event.data}`);
        }
    };
}
/// #else
if (typeof onmessage === "undefined") {
    // Library is not running as a Worker
    const length = dataBufferIndex + dataBufferSize;
    let sharedBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
    let sharedArray = new Int32Array(sharedBuffer);
    sharedArray.fill(-1);
    shared.set("buffer", sharedArray);
}
/**
 * Support postMessage when not running as Worker.
 * @param messageCallback function that will receive and process the messages.
 * @returns void.
 */
declare global {
    function postMessage(message: any, options?: any): void;
}
export function registerCallback(messageCallback: any) {
    if (typeof onmessage === "undefined") {
        globalThis.postMessage = messageCallback;
    }
}
/**
 * Returns a new instance of the Interpreter for REPL
 *
 */
export function getInterpreter(payload: any) {
    const replInterpreter = new Interpreter();
    replInterpreter.onError(logError);
    setupDeviceData(payload.device, replInterpreter);
    setupDeviceFonts(payload.device, replInterpreter);
    return replInterpreter;
}

/**
 * Runs an arbitrary string of BrightScript code.
 * @param contents the BrightScript code to lex, parse and interpret.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @returns void.
 */
export function executeLine(contents: string, interpreter: Interpreter) {
    const lexer = new Lexer();
    const parser = new Parser();
    lexer.onError(logError);
    parser.onError(logError);

    const scanResults = lexer.scan(contents, "REPL");
    if (scanResults.errors.length > 0) {
        return;
    }

    const parseResults = parser.parse(scanResults.tokens);
    if (parseResults.errors.length > 0) {
        return;
    }

    if (parseResults.statements.length === 0) {
        return;
    }

    try {
        const results = interpreter.exec(parseResults.statements);
        if (results) {
            results.map((result) => {
                if (result !== BrsTypes.BrsInvalid.Instance) {
                    postMessage(`print,${result.toString()}`);
                }
            });
        }
    } catch (err: any) {
        if (!(err instanceof BrsError.BrsError)) {
            postMessage(`error,Interpreter execution error: ${err.message}`);
        }
    }
}
/// #endif

/**
 * Runs a Brightscript app with full zip folder structure.
 * @param payload with the source code and all the assets of the app.
 * @returns void.
 */

export function executeFile(payload: any): RunResult {
    const interpreter = new Interpreter({
        entryPoint: payload.entryPoint ?? true,
        stopOnCrash: payload.stopOnCrash ?? false,
    });
    interpreter.onError(logError);
    // Input Parameters / Deep Link
    const inputArray = setupInputArray(payload.input);
    // Process Payload Content
    interpreter.setManifest(payload.manifest);
    interpreter.setRegistry(payload.device.registry);
    setupDeviceData(payload.device, interpreter);
    setupDeviceFonts(payload.device, interpreter);
    setupPackageFiles(payload.paths, payload.binaries, payload.texts, payload.brs, interpreter);
    // Run App
    const password = payload.password ?? "";
    let input = new RoAssociativeArray(inputArray);
    if (pcode instanceof Buffer) {
        runBinary(password, interpreter, input);
    } else {
        const result = runSource(source, interpreter, input, password);
        if (result?.cipherText) {
            return result;
        }
        endReason = result.endReason;
    }
    postMessage(`end,${endReason}`);
    return { endReason: endReason };
}

interface SerializedPCode {
    [pcode: string]: Token[];
}

/**
 * Process the application input parameters including deep links
 *
 * @param input Map with parameters.
 *
 * @returns an array of parameters in AA member format.
 */
function setupInputArray(input: any): AAMember[] {
    const inputArray = new Array<AAMember>();
    const inputMap = new Map([
        ["instant_on_run_mode", "foreground"],
        ["lastExitOrTerminationReason", "EXIT_UNKNOWN"],
        ["source", "auto-run-dev"],
        ["splashTime", "0"],
    ]);
    if (input instanceof Map) {
        input.forEach((value, key) => {
            inputMap.set(key, value);
        });
    }
    inputMap.forEach((value, key) => {
        inputArray.push({ name: new BrsString(key), value: new BrsString(value) });
    });
    return inputArray;
}

/**
 * Updates the interpreter DeviceInfo Map with the provided data and
 * initializes the common: file system with device internal libraries.
 *
 * @param device object with device info data
 * @param interpreter the Interpreter instance to update
 *
 */
function setupDeviceData(device: any, interpreter: Interpreter) {
    Object.keys(device).forEach((key) => {
        if (key !== "registry" && key !== "fonts") {
            interpreter.deviceInfo.set(key, device[key]);
        }
    });
    // Internal Libraries
    let volume = interpreter.fileSystem.get("common:");
    if (volume) {
        volume.mkdirSync("/LibCore");
        volume.mkdirSync("/LibCore/v30");
        volume.writeFileSync("/LibCore/v30/bslCore.brs", bslCore);
        volume.writeFileSync("/LibCore/v30/bslDefender.brs", bslDefender);
    }
}

/**
 * Updates the interpreter common: file system with
 * device internal fonts.
 *
 * @param device object with device info data
 * @param interpreter the Interpreter instance to update
 *
 */
function setupDeviceFonts(device: any, interpreter: Interpreter) {
    let fontFamily = device.defaultFont ?? "Asap";
    let fontPath = device.fontPath ?? "../fonts/";

    let volume = interpreter.fileSystem.get("common:");
    if (!volume) {
        postMessage("warning,Common file system not found");
        return;
    }
    volume.mkdirSync("/Fonts");
    let fontRegular, fontBold, fontItalic, fontBoldIt;
    if (typeof XMLHttpRequest !== "undefined") {
        // Running as a Worker in the browser
        fontRegular = download(`${fontPath}${fontFamily}-Regular.ttf`, "arraybuffer");
        fontBold = download(`${fontPath}${fontFamily}-Bold.ttf`, "arraybuffer");
        fontItalic = download(`${fontPath}${fontFamily}-Italic.ttf`, "arraybuffer");
        fontBoldIt = download(`${fontPath}${fontFamily}-BoldItalic.ttf`, "arraybuffer");
    } else if (device.fonts) {
        // Running locally as CLI
        fontRegular = device.fonts.get("regular")?.buffer;
        fontBold = device.fonts.get("bold")?.buffer;
        fontItalic = device.fonts.get("italic")?.buffer;
        fontBoldIt = device.fonts.get("bold-italic")?.buffer;
    }
    if (fontRegular) {
        volume.writeFileSync(`/Fonts/${fontFamily}-Regular.ttf`, fontRegular);
    } else {
        postMessage(`warning,Font file not found: ${fontPath}${fontFamily}-Regular.ttf`);
    }
    if (fontBold) {
        volume.writeFileSync(`/Fonts/${fontFamily}-Bold.ttf`, fontBold);
    } else {
        postMessage(`warning,Font file not found: ${fontPath}${fontFamily}-Bold.ttf`);
    }
    if (fontItalic) {
        volume.writeFileSync(`/Fonts/${fontFamily}-Italic.ttf`, fontItalic);
    } else {
        postMessage(`warning,Font file not found: ${fontPath}${fontFamily}-Italic.ttf`);
    }
    if (fontBoldIt) {
        volume.writeFileSync(`/Fonts/${fontFamily}-BoldItalic.ttf`, fontBoldIt);
    } else {
        postMessage(`warning,Font file not found: ${fontPath}${fontFamily}-BoldItalic.ttf`);
    }
}

/**
 * Updates the interpreter pkg: file system with the provided package files and
 * loads the translation data based on the configured locale.
 *
 * @param paths Map with package paths
 * @param binaries Map with binary files data
 * @param text Map with text files data
 * @param brs Map with source code files data
 * @param interpreter the Interpreter instance to update
 *
 */
function setupPackageFiles(
    paths: any,
    binaries: any,
    texts: any,
    brs: any,
    interpreter: Interpreter
) {
    let volume = interpreter.fileSystem.get("pkg:");
    if (volume && Array.isArray(paths)) {
        for (let filePath of paths) {
            const pathDirName = path.dirname(`/${filePath.url}`);
            if (!volume.existsSync(pathDirName)) {
                try {
                    mkdirTreeSync(volume, pathDirName);
                } catch (err: any) {
                    postMessage(`warning,Error creating directory ${pathDirName} - ${err.message}`);
                }
            }
            try {
                if (filePath.type === "binary" && Array.isArray(binaries)) {
                    volume.writeFileSync(`/${filePath.url}`, binaries[filePath.id]);
                } else if (filePath.type === "pcode" && Array.isArray(binaries)) {
                    pcode = Buffer.from(binaries[filePath.id]);
                } else if (["audio", "video"].includes(filePath.type)) {
                    // As the media files are played on the renderer process we need to
                    // save a mock file to allow file exist checking and save the index
                    volume.writeFileSync(`/${filePath.url}`, filePath.id.toString());
                    if (filePath.type === "audio") {
                        interpreter.audioId = filePath.id;
                    }
                } else if (filePath.type === "text" && Array.isArray(texts)) {
                    if (filePath.url === "source/var") {
                        iv = texts[filePath.id];
                    } else {
                        volume.writeFileSync(`/${filePath.url}`, texts[filePath.id]);
                    }
                } else if (filePath.type === "source" && Array.isArray(brs)) {
                    source.set(filePath.url, brs[filePath.id]);
                    volume.writeFileSync(`/${filePath.url}`, brs[filePath.id]);
                }
            } catch (err: any) {
                postMessage(`warning,Error writing file ${filePath.url} - ${err.message}`);
            }
        }
        // Load Translations
        let xmlText = "";
        let trType = "";
        let trTarget = "";
        const locale = interpreter.deviceInfo.get("locale") || "en_US";
        try {
            if (volume.existsSync(`/locale/${locale}/translations.ts`)) {
                xmlText = volume.readFileSync(`/locale/${locale}/translations.ts`);
                trType = "TS";
                trTarget = "translation";
            } else if (volume.existsSync(`/locale/${locale}/translations.xml`)) {
                xmlText = volume.readFileSync(`/locale/${locale}/translations.xml`);
                trType = "xliff";
                trTarget = "target";
            }
            if (trType !== "") {
                let xmlOptions: xml2js.OptionsV2 = { explicitArray: false };
                let xmlParser = new xml2js.Parser(xmlOptions);
                xmlParser.parseString(xmlText, function (err: Error | null, parsed: any) {
                    if (err) {
                        postMessage(`warning,Error parsing XML: ${err.message}`);
                    } else if (parsed) {
                        if (Object.keys(parsed).length > 0) {
                            let trArray;
                            if (trType === "TS") {
                                trArray = parsed["TS"]["context"]["message"];
                            } else {
                                trArray = parsed["xliff"]["file"]["body"]["trans-unit"];
                            }
                            if (trArray instanceof Array) {
                                trArray.forEach((item) => {
                                    if (item["source"]) {
                                        interpreter.translations.set(
                                            item["source"],
                                            item[trTarget]
                                        );
                                    }
                                });
                            }
                        }
                    } else {
                        postMessage("warning,Error parsing translation XML: Empty input");
                    }
                });
            }
        } catch (err: any) {
            const badPath = `pkg:/locale/${locale}/`;
            postMessage(`warning,Invalid path: ${badPath} - ${err.message}`);
        }
    }
}

/**
 * A synchronous version of the lexer-parser flow.
 *
 * @param filename the paths to BrightScript files to lex and parse synchronously
 * @param options configuration for the execution, including the streams to use for `stdout` and
 *                `stderr` and the base directory for path resolution
 *
 * @returns the AST produced from lexing and parsing the provided files
 */
export function lexParseSync(interpreter: Interpreter, filenames: string[]) {
    let volume = interpreter.fileSystem.get("pkg:") as FileSystem;

    return filenames
        .map((filename) => {
            let contents = volume.readFileSync(filename, "utf8");
            let scanResults = Lexer.scan(contents, filename);
            let preprocessor = new PP.Preprocessor();
            let preprocessorResults = preprocessor.preprocess(
                scanResults.tokens,
                interpreter.manifest
            );
            return Parser.parse(preprocessorResults.processedTokens).statements;
        })
        .reduce((allStatements, statements) => [...allStatements, ...statements], []);
}

/**
 * Runs an arbitrary string of BrightScript code.
 * @param source array of BrightScript code to lex, parse, and interpret.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @param input associative array with the input parameters
 * @param password string with the encryption password (optional)
 * @returns interface RunResult.
 */
export interface RunResult {
    endReason: string;
    cipherText?: Uint8Array;
    iv?: string;
}
function runSource(
    source: Map<string, string>,
    interpreter: Interpreter,
    input: RoAssociativeArray,
    password: string = ""
): RunResult {
    const lexer = new Lexer();
    const parser = new Parser();
    const preprocessor = new PP.Preprocessor();
    const allStatements = new Array<_parser.Stmt.Statement>();
    const lib = new Map<string, string>();
    let tokens: Token[] = [];
    lib.set("v30/bslDefender.brs", "");
    lib.set("v30/bslCore.brs", "");
    lib.set("Roku_Ads.brs", "");
    lexer.onError(logError);
    parser.onError(logError);
    for (let [path, code] of source) {
        const scanResults = lexer.scan(code, path);
        if (scanResults.errors.length > 0) {
            endReason = "EXIT_BRIGHTSCRIPT_CRASH";
            break;
        }
        let preprocessorResults = preprocessor.preprocess(scanResults.tokens, interpreter.manifest);
        if (preprocessorResults.errors.length > 0) {
            endReason = "EXIT_BRIGHTSCRIPT_CRASH";
            break;
        }
        if (password.length > 0) {
            tokens = tokens.concat(preprocessorResults.processedTokens);
            continue;
        }
        const parseResults = parser.parse(preprocessorResults.processedTokens);
        if (parseResults.errors.length > 0) {
            endReason = "EXIT_BRIGHTSCRIPT_CRASH";
            break;
        }
        if (parseResults.libraries.get("v30/bslDefender.brs") === true) {
            lib.set("v30/bslDefender.brs", bslDefender);
            lib.set("v30/bslCore.brs", bslCore);
        } else if (parseResults.libraries.get("v30/bslCore.brs") === true) {
            lib.set("v30/bslCore.brs", bslCore);
        }
        if (parseResults.libraries.get("Roku_Ads.brs") === true) {
            lib.set("Roku_Ads.brs", Roku_Ads);
        }
        allStatements.push(...parseResults.statements);
    }
    if (password.length > 0) {
        const iv = crypto.randomBytes(12).toString("base64");
        const cipher = crypto.createCipheriv(algorithm, password, iv);
        const deflated = zlibSync(encode({ pcode: tokens }));
        const source = Buffer.from(deflated);
        const cipherText = Buffer.concat([cipher.update(source), cipher.final()]);
        return { endReason: "EXIT_PACKAGER_DONE", cipherText: cipherText, iv: iv };
    }
    lib.forEach((value: string, key: string) => {
        if (value !== "") {
            const libScan = lexer.scan(value, key);
            const libParse = parser.parse(libScan.tokens);
            allStatements.push(...libParse.statements);
        }
    });
    try {
        if (endReason !== "EXIT_BRIGHTSCRIPT_CRASH") {
            endReason = "EXIT_USER_NAV";
            interpreter.exec(allStatements, input);
        }
    } catch (err: any) {
        endReason = "EXIT_USER_NAV";
        if (err.message !== "debug-exit") {
            postMessage(`error,${err.message}`);
            endReason = "EXIT_BRIGHTSCRIPT_CRASH";
        }
    }
    return { endReason: endReason };
}

/**
 * Runs a binary package of BrightScript code.
 * @param password decryption password.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @param input associative array with the input parameters
 * @returns an array of statement execution results, indicating why each
 *          statement exited and what its return value was, or `undefined` if
 *          `interpreter` threw an Error.
 */
function runBinary(password: string, interpreter: Interpreter, input: RoAssociativeArray) {
    let decodedTokens: Map<string, any>;
    // Decode Source PCode
    try {
        if (password.length > 0) {
            const decipher = crypto.createDecipheriv(algorithm, password, iv);
            const inflated = unzlibSync(Buffer.concat([decipher.update(pcode), decipher.final()]));
            const spcode = decode(inflated) as SerializedPCode;
            if (spcode) {
                decodedTokens = new Map(Object.entries(spcode.pcode));
                pcode = Buffer.from([]);
            } else {
                endReason = "EXIT_INVALID_PCODE";
                return;
            }
        } else {
            endReason = "EXIT_MISSING_PASSWORD";
            return;
        }
    } catch (err: any) {
        postMessage(`error,Error unpacking the app: ${err.message}`);
        endReason = "EXIT_UNPACK_ERROR";
        return;
    }
    // Execute the decrypted source code
    const lexer = new Lexer();
    const parser = new Parser();
    const allStatements = new Array<_parser.Stmt.Statement>();
    const lib = new Map<string, string>();
    lib.set("v30/bslDefender.brs", "");
    lib.set("v30/bslCore.brs", "");
    lib.set("Roku_Ads.brs", "");
    lexer.onError(logError);
    parser.onError(logError);
    let tokens: Token[] = [];
    for (let [, value] of decodedTokens) {
        const token: any = value;
        if (token.literal) {
            if (token.kind === "Integer") {
                const literal: number = token.literal.value;
                token.literal = new Int32(literal);
            } else if (token.kind === "LongInteger") {
                const literal: number = token.literal.value;
                token.literal = new Int64(literal);
            } else if (token.kind === "Double") {
                const literal: number = token.literal.value;
                token.literal = new Double(literal);
            } else if (token.kind === "Float") {
                const literal: number = token.literal.value;
                token.literal = new Float(literal);
            } else if (token.kind === "String") {
                const literal: string = token.literal.value;
                token.literal = new BrsString(literal);
            }
        }
        tokens.push(token);
        if (token.kind === "Eof") {
            const parseResults = parser.parse(tokens);
            if (parseResults.errors.length > 0) {
                endReason = "EXIT_BRIGHTSCRIPT_CRASH";
                return;
            }
            if (parseResults.statements.length === 0) {
                endReason = "EXIT_BRIGHTSCRIPT_CRASH";
                return;
            }
            if (parseResults.libraries.get("v30/bslDefender.brs") === true) {
                lib.set("v30/bslDefender.brs", bslDefender);
                lib.set("v30/bslCore.brs", bslCore);
            } else if (parseResults.libraries.get("v30/bslCore.brs") === true) {
                lib.set("v30/bslCore.brs", bslCore);
            }
            if (parseResults.libraries.get("Roku_Ads.brs") === true) {
                lib.set("Roku_Ads.brs", Roku_Ads);
            }
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
    endReason = "EXIT_USER_NAV";
    try {
        interpreter.exec(allStatements, input);
    } catch (err: any) {
        if (err.message !== "debug-exit") {
            postMessage(`error,${err.message}`);
            endReason = "EXIT_BRIGHTSCRIPT_CRASH";
        }
    }
}

/**
 * Logs a detected BRS error to the renderer process.
 * @param err the error to log
 */
function logError(err: BrsError.BrsError) {
    postMessage(`error,${err.format()}`);
    endReason = "EXIT_BRIGHTSCRIPT_CRASH";
}

/**
 * Splits the provided path into folders and recreates directory tree from the root.
 * @param directory the path to be created
 */
function mkdirTreeSync(fs: FileSystem, directory: string) {
    const pathArray = directory.replace(/\/$/, "").split("/");
    for (let i = 1; i <= pathArray.length; i++) {
        const segment = pathArray.slice(0, i).join("/");
        if (fs.normalize(segment) !== "" && !fs.existsSync(segment)) {
            fs.mkdirSync(segment);
        }
    }
}

/**
 * Download helper function
 * @param url url of the file to be downloaded
 * @param type return type (eg. arraybuffer)
 */
function download(url: string, type: XMLHttpRequestResponseType) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // Note: synchronous
        xhr.responseType = type;
        xhr.send();
        if (xhr.status !== 200) {
            postMessage(`warning,HTTP Error downloading ${url}: ${xhr.statusText}`);
            return undefined;
        }
        return xhr.response;
    } catch (err: any) {
        postMessage(`warning,Error downloading ${url}: ${err.message}`);
    }
}
