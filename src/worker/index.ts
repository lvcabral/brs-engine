/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExecutionOptions, Interpreter } from "./interpreter";
import { RoAssociativeArray, AAMember, BrsString, Int32, Int64, Double, Float } from "./brsTypes";
import {
    AppExitReason,
    AppFilePath,
    AppPayload,
    DeviceInfo,
    dataBufferIndex,
    dataBufferSize,
    defaultDeviceInfo,
    parseManifest,
} from "./common";
import { FileSystem } from "./interpreter/FileSystem";
import { Lexeme, Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser";
import * as PP from "./preprocessor";
import * as BrsError from "./Error";
import * as BrsTypes from "./brsTypes";
import * as path from "path";
import * as xml2js from "xml2js";
import * as crypto from "crypto";
import * as fs from "fs";
import { encode, decode } from "@msgpack/msgpack";
import { zlibSync, unzlibSync } from "fflate";
import bslCore from "./common/v30/bslCore.brs";
import bslDefender from "./common/v30/bslDefender.brs";
import Roku_Ads from "./common/Roku_Ads.brs";
import packageInfo from "../../package.json";

export * as lexer from "./lexer";
export * as parser from "./parser";
export * as stdlib from "./stdlib";
export { BrsTypes as types };
export { PP as preprocessor };
export { Preprocessor } from "./preprocessor/Preprocessor";
export { Interpreter } from "./interpreter";
export { Environment, Scope } from "./interpreter/Environment";
export const shared = new Map<string, Int32Array>();
export const bscs = new Map<string, number>();
export const stats = new Map<Lexeme, number>();

const algorithm = "aes-256-ctr";

/// #if BROWSER
if (typeof onmessage !== "undefined") {
    // Worker event that is triggered by postMessage() calls from the API library
    onmessage = function (event: MessageEvent) {
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
/**
 * Support postMessage when not running as Worker.
 * @param messageCallback function that will receive and process the messages.
 * @returns void.
 */
declare global {
    function postMessage(message: any, options?: any): void;
}

/**
 * Default implementation of the callback, only handles console messages
 * @param message the message to front-end
 */
const arrayLength = dataBufferIndex + dataBufferSize;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arrayLength);
shared.set("buffer", new Int32Array(sharedBuffer));

globalThis.postMessage = (message: any) => {
    if (typeof message === "string") {
        const mType = message.split(",")[0];
        if (mType === "print") {
            process.stdout.write(message.slice(6));
        } else if (mType === "warning") {
            console.warn(message.slice(8).trimEnd());
        } else if (mType === "error") {
            console.error(message.slice(6).trimEnd());
        }
    }
};

/**
 * Setup the callback function to handle messages from interpreter
 * @param messageCallback callback function to handle messages from interpreter
 * @param sharedBuffer shared buffer to control the interpreter
 */
export function registerCallback(messageCallback: any, sharedBuffer?: SharedArrayBuffer) {
    if (typeof onmessage === "undefined") {
        globalThis.postMessage = messageCallback;
        if (sharedBuffer) shared.set("buffer", new Int32Array(sharedBuffer));
    }
}

/**
 * Returns a new instance of the Interpreter for REPL
 *
 */
export function getInterpreter(payload: AppPayload) {
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
        results.forEach((result) => {
            if (result !== BrsTypes.BrsInvalid.Instance) {
                postMessage(`print,${result.toString()}`);
            }
        });
    } catch (err: any) {
        if (!(err instanceof BrsError.BrsError)) {
            postMessage(`error,Interpreter execution error: ${err.message}`);
        }
    }
}

/**
 * Create the payload to run the app with the provided files.
 * @param files Code files to be executed
 * @param customDeviceData optional object with device info data
 *
 * @returns object with the payload to run the app.
 */
export function createPayload(files: string[], customDeviceData?: Partial<DeviceInfo>): AppPayload {
    const paths: AppFilePath[] = [];
    const source: string[] = [];
    const texts: string[] = [];
    let manifest: Map<string, string> | undefined;

    let id = 0;
    files.forEach((filePath) => {
        const fileName = path.basename(filePath) ?? filePath;
        const fileExt = fileName.split(".").pop();
        if (fileExt?.toLowerCase() === "brs") {
            try {
                const sourceCode = fs.readFileSync(filePath);
                if (sourceCode) {
                    source.push(sourceCode.toString());
                    paths.push({ id: id, url: `source/${fileName}`, type: "source" });
                    id++;
                }
            } catch (err: any) {
                throw err;
            }
        } else if (fileName === "manifest") {
            try {
                const fileData = fs.readFileSync(filePath);
                if (fileData) {
                    manifest = parseManifest(fileData.toString());
                    texts.push(fileData.toString());
                    paths.push({ id: 0, url: "manifest", type: "text" });
                }
            } catch (err: any) {
                throw err;
            }
        }
    });
    if (id > 0) {
        let deviceData = defaultDeviceInfo;
        if (customDeviceData !== undefined) {
            deviceData = Object.assign(deviceData, customDeviceData);
        }
        if (!deviceData.fonts || deviceData.fonts.size === 0) {
            deviceData.fonts = getFonts(deviceData.fontPath, deviceData.defaultFont);
        }
        if (manifest === undefined) {
            manifest = new Map();
            manifest.set("title", "BRS App");
            manifest.set("major_version", "0");
            manifest.set("minor_version", "0");
            manifest.set("build_version", "1");
            manifest.set("requires_audiometadata", "1");
        }
        return {
            device: deviceData,
            manifest: manifest,
            input: new Map(),
            paths: paths,
            brs: source,
            texts: texts,
            binaries: [],
            entryPoint: false,
            stopOnCrash: false,
        };
    } else {
        throw new Error("Invalid or inexistent file(s)!");
    }
}

/**
 * Get the fonts map for the device.
 * @param fontPath a string with the font path.
 * @param fontFamily a string with the font family name.
 *
 * @returns a Map with the fonts.
 */

export function getFonts(fontPath: string, fontFamily: string) {
    const fonts = new Map();
    const fontsPath = path.join(__dirname, fontPath, `${fontFamily}`);
    try {
        fonts.set("regular", fs.readFileSync(`${fontsPath}-Regular.ttf`));
        fonts.set("bold", fs.readFileSync(`${fontsPath}-Bold.ttf`));
        fonts.set("italic", fs.readFileSync(`${fontsPath}-Italic.ttf`));
        fonts.set("bold-italic", fs.readFileSync(`${fontsPath}-BoldItalic.ttf`));
    } catch (err: any) {
        postMessage(`error,Error loading fonts: ${err.message}`);
    }
    return fonts;
}
/// #endif

/**
 * Runs a Brightscript app with full zip folder structure.
 * @param payload with the source code and all the assets of the app.
 * @param customOptions optional object with the output streams.
 *
 * @returns RunResult with the end reason and (optionally) the encrypted data.
 */

export function executeFile(
    payload: AppPayload,
    customOptions?: Partial<ExecutionOptions>
): RunResult {
    const options = {
        ...{
            entryPoint: payload.entryPoint ?? true,
            stopOnCrash: payload.stopOnCrash ?? false,
        },
        ...customOptions,
    };
    bscs.clear();
    stats.clear();
    const interpreter = new Interpreter(options);
    // Input Parameters / Deep Link
    const inputArray = setupInputArray(payload.input);
    // Process Payload Content
    const sourceResult = setupPayload(interpreter, payload);
    // Run App
    const password = payload.password ?? "";
    let result: RunResult;
    let input = new RoAssociativeArray(inputArray);
    if (sourceResult.pcode && sourceResult.iv) {
        result = runBinary(interpreter, sourceResult, input, password);
    } else {
        result = runSource(interpreter, sourceResult.sourceMap, input, password);
    }
    if (!result.cipherText) {
        postMessage(`end,${result.exitReason}`);
    }
    return result;
}

/**
 * Setup the interpreter with the provided payload.
 * @param interpreter The interpreter instance to setup
 * @param payload The payload with the source code and all the assets of the app.
 *
 * @returns a SourceResult object with the source map or the pcode data.
 */

interface SourceResult {
    sourceMap: Map<string, string>;
    pcode?: Buffer;
    iv?: string;
}

export function setupPayload(interpreter: Interpreter, payload: AppPayload): SourceResult {
    interpreter.setManifest(payload.manifest);
    if (payload.device.registry) {
        interpreter.setRegistry(payload.device.registry);
    }
    setupDeviceData(payload.device, interpreter);
    setupDeviceFonts(payload.device, interpreter);
    return setupPackageFiles(payload, interpreter);
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
function setupInputArray(input: Map<string, string>): AAMember[] {
    const inputArray = new Array<AAMember>();
    const inputMap = new Map([
        ["instant_on_run_mode", "foreground"],
        ["lastExitOrTerminationReason", AppExitReason.UNKNOWN],
        ["source", "auto-run-dev"],
        ["splashTime", "0"],
    ]);
    input.forEach((value, key) => {
        inputMap.set(key, value);
    });
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
function setupDeviceData(device: DeviceInfo, interpreter: Interpreter) {
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
function setupDeviceFonts(device: DeviceInfo, interpreter: Interpreter) {
    let fontFamily = device.defaultFont ?? "Asap";
    let fontPath = device.fontPath ?? "../fonts/";

    let volume = interpreter.fileSystem.get("common:");
    if (!volume) {
        postMessage("error,Common file system not found");
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
        // Running locally in NodeJS
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
 * @returns a SourceResult object with the source map or the pcode data.
 */
function setupPackageFiles(payload: AppPayload, interpreter: Interpreter): SourceResult {
    const result: SourceResult = { sourceMap: new Map<string, string>() };
    let volume = interpreter.fileSystem.get("pkg:");
    if (volume && Array.isArray(payload.paths)) {
        for (let filePath of payload.paths) {
            const pathDirName = path.dirname(`/${filePath.url}`);
            if (!volume.existsSync(pathDirName)) {
                try {
                    mkdirTreeSync(volume, pathDirName);
                } catch (err: any) {
                    postMessage(`error,Error creating directory ${pathDirName} - ${err.message}`);
                }
            }
            try {
                if (filePath.type === "binary" && Array.isArray(payload.binaries)) {
                    volume.writeFileSync(`/${filePath.url}`, payload.binaries[filePath.id]);
                } else if (filePath.type === "pcode" && Array.isArray(payload.binaries)) {
                    result.pcode = Buffer.from(payload.binaries[filePath.id]);
                } else if (["audio", "video"].includes(filePath.type)) {
                    // As the media files are played on the renderer process we need to
                    // save a mock file to allow file exist checking and save the index
                    let fileData = Buffer.from(filePath.id.toString());
                    if (filePath.type === "audio") {
                        interpreter.audioId = filePath.id;
                        if (filePath.binId) {
                            // If audio metadata is enabled we have the audio file data
                            fileData = Buffer.from(payload.binaries[filePath.binId]);
                        }
                    }
                    volume.writeFileSync(`/${filePath.url}`, fileData);
                } else if (filePath.type === "text" && Array.isArray(payload.texts)) {
                    if (filePath.url === "source/var") {
                        result.iv = payload.texts[filePath.id];
                    } else {
                        volume.writeFileSync(`/${filePath.url}`, payload.texts[filePath.id]);
                    }
                } else if (filePath.type === "source" && Array.isArray(payload.brs)) {
                    result.sourceMap.set(filePath.url, payload.brs[filePath.id]);
                    volume.writeFileSync(`/${filePath.url}`, payload.brs[filePath.id]);
                }
            } catch (err: any) {
                postMessage(`error,Error writing file ${filePath.url} - ${err.message}`);
            }
        }
        loadTranslations(interpreter, volume);
    }
    return result;
}

/**
 * Load the translations data based on the configured locale.
 * @param interpreter the Interpreter instance to update
 * @param volume the file system volume to use
 */

function loadTranslations(interpreter: Interpreter, volume: FileSystem) {
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
                    postMessage(`error,Error parsing XML: ${err.message}`);
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
                                    interpreter.translations.set(item["source"], item[trTarget]);
                                }
                            });
                        }
                    }
                } else {
                    postMessage("error,Error parsing translation XML: Empty input");
                }
            });
        }
    } catch (err: any) {
        const badPath = `pkg:/locale/${locale}/`;
        postMessage(`error,Invalid path: ${badPath} - ${err.message}`);
    }
}

/**
 * A synchronous version of the lexer-parser flow.
 *
 * @param interpreter the interpreter to use when executing the provided files
 * @param password string with the encryption password (optional)
 *
 * @returns the AST produced from lexing and parsing the provided files or the tokens for encryption if password is provided.
 */
export interface ParseResult {
    exitReason: AppExitReason;
    tokens: Token[];
    statements: Stmt.Statement[];
}

export function lexParseSync(
    sourceMap: Map<string, string>,
    manifest: Map<string, any>,
    password = ""
): ParseResult {
    const lexer = new Lexer();
    const parser = new Parser();
    const preprocessor = new PP.Preprocessor();
    const allStatements = new Array<Stmt.Statement>();
    const lib = new Map<string, string>();
    let tokens: Token[] = [];
    lib.set("v30/bslDefender.brs", "");
    lib.set("v30/bslCore.brs", "");
    lib.set("Roku_Ads.brs", "");
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
    parser.stats.forEach((count, lexeme) => {
        stats.set(lexeme, count.size);
    });
    return {
        exitReason: exitReason,
        tokens: tokens,
        statements: allStatements,
    };
}

/**
 * Runs an arbitrary string of BrightScript code.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @param sourceMap Map with the source code files content.
 * @param input associative array with the input parameters
 * @param password string with the encryption password (optional)
 *
 * @returns RunResult with the end reason and (optionally) the encrypted data.
 */
export interface RunResult {
    exitReason: AppExitReason;
    cipherText?: Uint8Array;
    iv?: string;
}
function runSource(
    interpreter: Interpreter,
    sourceMap: Map<string, string>,
    input: RoAssociativeArray,
    password: string = ""
): RunResult {
    const parseResult = lexParseSync(sourceMap, interpreter.manifest, password);
    let exitReason = parseResult.exitReason;
    if (password.length > 0) {
        const tokens = parseResult.tokens;
        const iv = crypto.randomBytes(12).toString("base64");
        const cipher = crypto.createCipheriv(algorithm, password, iv);
        const deflated = zlibSync(encode({ pcode: tokens }));
        const source = Buffer.from(deflated);
        const cipherText = Buffer.concat([cipher.update(source), cipher.final()]);
        return { exitReason: AppExitReason.PACKAGED, cipherText: cipherText, iv: iv };
    }
    try {
        if (exitReason !== AppExitReason.CRASHED) {
            exitReason = AppExitReason.FINISHED;
            interpreter.exec(parseResult.statements, sourceMap, input);
        }
    } catch (err: any) {
        exitReason = AppExitReason.FINISHED;
        if (err.message !== "debug-exit") {
            if (interpreter.options.post ?? true) {
                postMessage(`error,${err.message}`);
            } else {
                interpreter.options.stderr.write(err.message);
            }
            exitReason = AppExitReason.CRASHED;
        }
    }
    return { exitReason: exitReason };
}

/**
 * Runs a binary package of BrightScript code.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @param sourceResult with the pcode data and iv.
 * @param input associative array with the input parameters
 * @param password decryption password.
 *
 * @returns RunResult with the end reason.
 */
function runBinary(
    interpreter: Interpreter,
    sourceResult: SourceResult,
    input: RoAssociativeArray,
    password: string
): RunResult {
    let decodedTokens: Map<string, any>;
    // Decode Source PCode
    try {
        if (password.length > 0 && sourceResult.pcode && sourceResult.iv) {
            const decipher = crypto.createDecipheriv(algorithm, password, sourceResult.iv);
            const inflated = unzlibSync(
                Buffer.concat([decipher.update(sourceResult.pcode), decipher.final()])
            );
            const spcode = decode(inflated) as SerializedPCode;
            if (spcode) {
                decodedTokens = new Map(Object.entries(spcode.pcode));
            } else {
                return { exitReason: AppExitReason.INVALID };
            }
        } else {
            return { exitReason: AppExitReason.PASSWORD };
        }
    } catch (err: any) {
        postMessage(`error,Error unpacking the app: ${err.message}`);
        return { exitReason: AppExitReason.UNPACK };
    }
    // Execute the decrypted source code
    const lexer = new Lexer();
    const parser = new Parser();
    const allStatements = new Array<Stmt.Statement>();
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
            if (parseResults.errors.length > 0 || parseResults.statements.length === 0) {
                return { exitReason: AppExitReason.CRASHED };
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
    let exitReason = AppExitReason.FINISHED;
    try {
        interpreter.exec(allStatements, undefined, input);
    } catch (err: any) {
        if (err.message !== "debug-exit") {
            postMessage(`error,${err.message}`);
            exitReason = AppExitReason.CRASHED;
        }
    }
    return { exitReason: exitReason };
}

/**
 * Logs a detected BRS error to the renderer process.
 * @param err the error to log
 */
function logError(err: BrsError.BrsError) {
    postMessage(`error,${err.format()}`);
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
            postMessage(`error,HTTP Error downloading ${url}: ${xhr.statusText}`);
            return undefined;
        }
        return xhr.response;
    } catch (err: any) {
        postMessage(`error,Error downloading ${url}: ${err.message}`);
    }
}
