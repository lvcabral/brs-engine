/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExecutionOptions, Interpreter } from "./interpreter";
import { download } from "./interpreter/Network";
import { FileSystem } from "./interpreter/FileSystem";
import {
    AppExitReason,
    PkgFilePath,
    AppPayload,
    DeviceInfo,
    dataBufferIndex,
    dataBufferSize,
    defaultDeviceInfo,
    parseManifest,
    isAppPayload,
} from "./common";
import { BrsError, logError, RuntimeError, RuntimeErrorDetail } from "./Error";
import { Lexeme, Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser";
import {
    ComponentDefinition,
    getComponentDefinitionMap,
    getInterpreterWithSubEnvs,
} from "./scenegraph";
import { lexParseSync, parseDecodedTokens } from "./LexerParser";
import * as PP from "./preprocessor";
import * as BrsTypes from "./brsTypes";
import * as path from "path";
import * as xml2js from "xml2js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as zenFS from "@zenfs/core";
import { Zip } from "@lvcabral/zip";
import { encode, decode } from "@msgpack/msgpack";
import { zlibSync, unzlibSync } from "fflate";
import bslCore from "./libraries/common/v30/bslCore.brs";
import bslDefender from "./libraries/common/v30/bslDefender.brs";
import Roku_Ads from "./libraries/roku_ads/Roku_Ads.brs";
import RokuBrowser from "./libraries/roku_browser/RokuBrowser.brs";
import packageInfo from "../../package.json";

export * as lexer from "./lexer";
export * as parser from "./parser";
export * as stdlib from "./stdlib";
export * as netlib from "./interpreter/Network";
export { BrsTypes as types };
export { PP as preprocessor };
export { Preprocessor } from "./preprocessor/Preprocessor";
export { Interpreter } from "./interpreter";
export { Environment, Scope } from "./interpreter/Environment";
export { lexParseSync } from "./LexerParser";
export const shared = new Map<string, Int32Array>();
export const bscs = new Map<string, number>();
export const stats = new Map<Lexeme, number>();
export const terminateReasons = ["debug-exit", "end-statement"];

const algorithm = "aes-256-ctr";

/// #if BROWSER
if (typeof onmessage !== "undefined") {
    // Worker event that is triggered by postMessage() calls from the API library
    onmessage = function (event: MessageEvent) {
        if (isAppPayload(event.data)) {
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
const sharedArray = new Int32Array(sharedBuffer);
sharedArray.fill(-1);
shared.set("buffer", sharedArray);

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
export async function getReplInterpreter(payload: Partial<AppPayload>) {
    try {
        await configureFileSystem(payload.pkgZip, payload.extZip);
    } catch (err: any) {
        postMessage(`error,Error mounting File System: ${err.message}`);
        return null;
    }
    const replInterpreter = new Interpreter({
        root: payload.root,
        ext: payload.extZip ? undefined : payload.ext,
    });
    replInterpreter.onError(logError);
    if (payload.device) {
        if (payload.device.registry?.size) {
            replInterpreter.setRegistry(payload.device.registry);
        }
        setupDeviceData(replInterpreter, payload.device);
        setupDeviceFonts(replInterpreter, payload.device);
    }
    return replInterpreter;
}

/**
 * Runs an arbitrary string of BrightScript code.
 * @param contents the BrightScript code to lex, parse and interpret.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
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
        if (!(err instanceof BrsError)) {
            postMessage(`error,Interpreter execution error: ${err.message}`);
        }
    }
}

/**
 * Create the payload to run the app with the provided files.
 * @param files Code files to be executed
 * @param customDeviceData optional object with device info data
 * @param root optional root path for the interpreter
 *
 * @returns object with the payload to run the app.
 */
export async function createPayloadFromFiles(
    files: string[],
    customDeviceData?: Partial<DeviceInfo>,
    deepLink?: Map<string, string>,
    root?: string,
    ext?: string
): Promise<AppPayload> {
    const paths: PkgFilePath[] = [];
    const source: string[] = [];
    let manifest: Map<string, string> | undefined;

    let id = 0;
    files.forEach((filePath) => {
        if (root) {
            filePath = path.join(root, filePath);
        }
        const fileName = path.basename(filePath) ?? filePath;
        const fileExt = fileName.split(".").pop();
        if (fileExt?.toLowerCase() === "brs" && fs.existsSync(filePath)) {
            const sourceCode = fs.readFileSync(filePath);
            if (sourceCode.length > 0) {
                source.push(sourceCode.toString());
                paths.push({ id: id, url: `source/${fileName}`, type: "source" });
                id++;
            }
        } else if (fileName === "manifest" && fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath);
            if (fileData.length > 0) {
                manifest = parseManifest(fileData.toString());
            }
        }
    });
    if (id === 0) {
        throw new Error("Invalid or inexistent file(s)!");
    }
    const deviceData = customDeviceData
        ? Object.assign(defaultDeviceInfo, customDeviceData)
        : defaultDeviceInfo;
    if (!deviceData.fonts || deviceData.fonts.size === 0) {
        deviceData.fonts = getFonts(deviceData.fontPath, deviceData.defaultFont, deviceData.sgFont);
    }
    if (root && !manifest && fs.existsSync(path.join(root, "manifest"))) {
        const fileData = fs.readFileSync(path.join(root, "manifest"));
        if (fileData) {
            manifest = parseManifest(fileData.toString());
        }
    }
    if (manifest === undefined) {
        manifest = new Map();
        manifest.set("title", "BRS App");
        manifest.set("major_version", "0");
        manifest.set("minor_version", "0");
        manifest.set("build_version", "0");
        manifest.set("splash_min_time", "0");
        manifest.set("requires_audiometadata", "1");
    }
    const payload: AppPayload = {
        device: deviceData,
        launchTime: Date.now(),
        manifest: manifest,
        deepLink: deepLink ?? new Map(),
        paths: paths,
        source: source,
        root: root,
    };

    // Load the external storage if provided
    if (ext && fs.existsSync(ext)) {
        if (fs.statSync(ext).isDirectory()) {
            payload.ext = ext;
        } else {
            payload.extZip = new Uint8Array(fs.readFileSync(ext)).buffer;
        }
    }
    return payload;
}

/**
 * Get the fonts map for the device.
 * @param fontPath a string with the font path.
 * @param fontFamily a string with the font family name.
 *
 * @returns a Map with the fonts.
 */

export function getFonts(fontPath: string, fontFamily: string, sgFamily: string) {
    const fonts = new Map();
    const fontsPath = path.join(__dirname, fontPath, fontFamily);
    const sgFontsPath = path.join(__dirname, fontPath, sgFamily);
    try {
        fonts.set(`${fontFamily}-Regular`, fs.readFileSync(`${fontsPath}-Regular.ttf`));
        fonts.set(`${fontFamily}-Bold`, fs.readFileSync(`${fontsPath}-Bold.ttf`));
        fonts.set(`${fontFamily}-Italic`, fs.readFileSync(`${fontsPath}-Italic.ttf`));
        fonts.set(`${fontFamily}-BoldItalic`, fs.readFileSync(`${fontsPath}-BoldItalic.ttf`));
        fonts.set(`${sgFamily}-Regular`, fs.readFileSync(`${sgFontsPath}-Regular.ttf`));
        fonts.set(`${sgFamily}-SemiBold`, fs.readFileSync(`${sgFontsPath}-SemiBold.ttf`));
    } catch (err: any) {
        postMessage(`error,Error loading fonts: ${err.message}`);
    }
    return fonts;
}
/// #endif

/**
 * Runs a Brightscript app with full zip folder structure.
 * @param payload with the source code, manifest and all the assets of the app.
 * @param customOptions optional object with the output streams.
 *
 * @returns RunResult with the end reason and (optionally) the encrypted data.
 */

export async function executeFile(
    payload: AppPayload,
    customOptions?: Partial<ExecutionOptions>
): Promise<RunResult> {
    const options = {
        ...{
            entryPoint: payload.device.entryPoint ?? true,
            stopOnCrash: payload.device.debugOnCrash ?? false,
            root: payload.root,
            ext: payload.extZip ? undefined : payload.ext,
        },
        ...customOptions,
    };
    bscs.clear();
    stats.clear();
    try {
        await configureFileSystem(payload.pkgZip, payload.extZip);
    } catch (err: any) {
        postMessage(`error,Error mounting File System: ${err.message}`);
        return { exitReason: AppExitReason.CRASHED };
    }
    // Look for SceneGraph components
    const fileSystem = new FileSystem(options.root, options.ext);
    const components = await getComponentDefinitionMap(fileSystem, []);
    // Create the interpreter
    let interpreter: Interpreter;
    if (components.size > 0) {
        interpreter = await getInterpreterWithSubEnvs(components, payload.manifest, options);
    } else {
        interpreter = new Interpreter(options);
    }
    // Process Payload Content
    const sourceResult = setupPayload(interpreter, payload);
    // Run the BrightScript app
    let result: RunResult;
    if (sourceResult.pcode && sourceResult.iv) {
        result = await runEncrypted(interpreter, sourceResult, payload);
    } else {
        result = await runSource(interpreter, sourceResult.sourceMap, payload);
    }
    if (!result.cipherText) {
        postMessage(`end,${result.exitReason}`);
    }
    return result;
}

/**
 * Initializes the File System with the provided zip files.
 * @param pkgZip ArrayBuffer with the package zip file.
 * @param extZip ArrayBuffer with the external storage zip file.
 */
async function configureFileSystem(pkgZip?: ArrayBuffer, extZip?: ArrayBuffer): Promise<void> {
    const fsConfig = { mounts: {} };
    if (zenFS.fs?.existsSync("pkg:/")) {
        zenFS.umount("pkg:");
    }
    if (pkgZip) {
        Object.assign(fsConfig.mounts, {
            "pkg:": { backend: Zip, data: pkgZip, caseSensitive: false },
        });
    } else {
        Object.assign(fsConfig.mounts, {
            "pkg:": zenFS.InMemory,
        });
    }
    if (extZip) {
        if (zenFS.fs?.existsSync("ext1:/")) {
            zenFS.umount("ext1:");
        }
        Object.assign(fsConfig.mounts, {
            "ext1:": { backend: Zip, data: extZip, caseSensitive: false },
        });
    }
    return zenFS.configure(fsConfig);
}

/**
 * Setup the interpreter with the provided payload.
 * @param interpreter The interpreter instance to setup
 * @param payload with the source code, manifest and all the assets of the app.
 *
 * @returns a SourceResult object with the source map or the pcode data.
 */

interface SourceResult {
    sourceMap: Map<string, string>;
    pcode?: Buffer;
    iv?: string;
}

function setupPayload(interpreter: Interpreter, payload: AppPayload): SourceResult {
    interpreter.setManifest(payload.manifest);
    if (payload.device.registry?.size) {
        interpreter.setRegistry(payload.device.registry);
    }
    setupDeviceData(interpreter, payload.device);
    setupDeviceFonts(interpreter, payload.device);
    setupTranslations(interpreter);
    return setupPackageFiles(interpreter, payload);
}

interface SerializedPCode {
    [pcode: string]: Token[];
}

/**
 * Process the application input parameters including deep links
 * @param deepLinkMap Map with parameters.
 * @param splashTime elapsed splash time (in milliseconds).
 *
 * @returns an array of parameters in AA member format.
 */
function setupInputParams(
    deepLinkMap: Map<string, string>,
    splashTime: number
): BrsTypes.RoAssociativeArray {
    const inputMap = new Map([
        ["instant_on_run_mode", "foreground"],
        ["lastExitOrTerminationReason", AppExitReason.UNKNOWN],
        ["source", "auto-run-dev"],
        ["splashTime", splashTime.toString()],
    ]);
    deepLinkMap.forEach((value, key) => {
        inputMap.set(key, value);
    });
    return BrsTypes.toAssociativeArray(inputMap);
}

/**
 * Updates the interpreter DeviceInfo Map with the provided data and
 * initializes the common: file system with device internal libraries.
 * @param interpreter the Interpreter instance to update
 * @param device object with device info data
 */
function setupDeviceData(interpreter: Interpreter, device: DeviceInfo) {
    Object.keys(device).forEach((key) => {
        if (key !== "registry" && key !== "fonts") {
            if (key === "developerId") {
                // Prevent the developerId from having dots to avoid issues with the registry persistence
                interpreter.deviceInfo.set(key, device[key].replace(".", ":"));
            }
            interpreter.deviceInfo.set(key, device[key]);
        }
    });
    // Internal Libraries
    const fsys = interpreter.fileSystem;
    if (fsys) {
        fsys.mkdirSync("common:/LibCore");
        fsys.mkdirSync("common:/LibCore/v30");
        fsys.writeFileSync("common:/LibCore/v30/bslCore.brs", bslCore);
        fsys.writeFileSync("common:/LibCore/v30/bslDefender.brs", bslDefender);
        fsys.mkdirSync("common:/roku_ads");
        fsys.writeFileSync("common:/roku_ads/Roku_Ads.brs", Roku_Ads);
        fsys.mkdirSync("common:/roku_browser");
        fsys.writeFileSync("common:/roku_browser/RokuBrowser.brs", RokuBrowser);
    }
}

/**
 * Updates the interpreter `common:` volume with device internal fonts.
 * @param interpreter the Interpreter instance to update
 * @param device object with device info data
 */
function setupDeviceFonts(interpreter: Interpreter, device: DeviceInfo) {
    const family = device.defaultFont;
    const sgFamily = device.sgFont;
    const fontPath = device.fontPath ?? "../fonts/";

    const fsys = interpreter.fileSystem;
    if (!fsys?.existsSync("common:/")) {
        postMessage("error,Common file system not found");
        return;
    }
    fsys.mkdirSync("common:/Fonts");
    if (typeof XMLHttpRequest !== "undefined") {
        // Running as a Worker in the browser, download the fonts
        const fonts = new Map();
        const rType = "arraybuffer";
        fonts.set(`${family}-Regular`, download(`${fontPath}${family}-Regular.ttf`, rType));
        fonts.set(`${family}-Bold`, download(`${fontPath}${family}-Bold.ttf`, rType));
        fonts.set(`${family}-Italic`, download(`${fontPath}${family}-Italic.ttf`, rType));
        fonts.set(`${family}-BoldItalic`, download(`${fontPath}${family}-BoldItalic.ttf`, rType));
        fonts.set(`${sgFamily}-Regular`, download(`${fontPath}${sgFamily}-Regular.ttf`, rType));
        fonts.set(`${sgFamily}-SemiBold`, download(`${fontPath}${sgFamily}-SemiBold.ttf`, rType));
        device.fonts = fonts;
    }
    device.fonts?.forEach((value, key) => {
        if (value) {
            fsys.writeFileSync(`common:/Fonts/${key}.ttf`, Buffer.from(value));
        } else {
            postMessage(`warning,Font file not found: ${key}.ttf`);
        }
    });
}

/**
 * Updates the interpreter pkg: file system with the provided package files and
 * loads the translation data based on the configured locale.
 * @param interpreter the Interpreter instance to update
 * @param payload with the source code, manifest and all the assets of the app.
 *
 * @returns a SourceResult object with the source map or the pcode data.
 */
function setupPackageFiles(interpreter: Interpreter, payload: AppPayload): SourceResult {
    const result: SourceResult = { sourceMap: new Map<string, string>() };
    const fsys = interpreter.fileSystem;
    if (!fsys || !Array.isArray(payload.paths)) {
        return result;
    }
    for (let filePath of payload.paths) {
        try {
            if (filePath.type === "pcode" && fsys.existsSync(`pkg:/${filePath.url}`)) {
                if (filePath.id === 0) {
                    result.pcode = fsys.readFileSync(`pkg:/${filePath.url}`);
                } else {
                    result.iv = fsys.readFileSync(`pkg:/${filePath.url}`, "utf8");
                }
            } else if (filePath.type === "source" && Array.isArray(payload.source)) {
                result.sourceMap.set(filePath.url, payload.source[filePath.id]);
            } else if (filePath.type === "source" && fsys.existsSync(`pkg:/${filePath.url}`)) {
                result.sourceMap.set(
                    filePath.url,
                    fsys.readFileSync(`pkg:/${filePath.url}`, "utf8")
                );
            }
        } catch (err: any) {
            postMessage(`error,Error accessing file ${filePath.url} - ${err.message}`);
        }
    }
    return result;
}

/**
 * Load the translations data based on the configured locale.
 * @param interpreter the Interpreter instance to update
 */

function setupTranslations(interpreter: Interpreter) {
    let xmlText = "";
    let trType = "";
    let trTarget = "";
    const locale = interpreter.deviceInfo.get("locale") || "en_US";
    try {
        const fsys = interpreter.fileSystem;
        if (fsys?.existsSync(`pkg:/locale/${locale}/translations.ts`)) {
            xmlText = fsys.readFileSync(`pkg:/locale/${locale}/translations.ts`, "utf8");
            trType = "TS";
            trTarget = "translation";
        } else if (fsys?.existsSync(`pkg:/locale/${locale}/translations.xml`)) {
            xmlText = fsys.readFileSync(`pkg:/locale/${locale}/translations.xml`, "utf8");
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
 * Parse and Execute a set of BrightScript source code files.
 * @param interpreter an interpreter to use when executing the source code.
 * @param sourceMap Map with the source code files content.
 * @param payload with the source code, manifest and all the assets of the app.
 *
 * @returns RunResult with the end reason and (optionally) the encrypted data.
 */
export interface RunResult {
    exitReason: AppExitReason;
    cipherText?: Uint8Array;
    iv?: string;
}
async function runSource(
    interpreter: Interpreter,
    sourceMap: Map<string, string>,
    payload: AppPayload
): Promise<RunResult> {
    const password = payload.password ?? "";
    const parseResult = lexParseSync(
        interpreter.fileSystem,
        interpreter.manifest,
        sourceMap,
        password,
        stats
    );
    let exitReason = parseResult.exitReason;
    if (exitReason !== AppExitReason.CRASHED) {
        if (password.length > 0) {
            const tokens = parseResult.tokens;
            const iv = crypto.randomBytes(12).toString("base64");
            const cipher = crypto.createCipheriv(algorithm, password, iv);
            const deflated = zlibSync(encode({ pcode: tokens }));
            const source = Buffer.from(deflated);
            const cipherText = Buffer.concat([cipher.update(source), cipher.final()]);
            return { exitReason: AppExitReason.PACKAGED, cipherText: cipherText, iv: iv };
        }
        // Update Source Map with the SceneGraph components (if exists)
        if (interpreter.environment.nodeDefMap?.size) {
            const components = interpreter.environment.nodeDefMap;
            Array.from(components.values()).forEach((component: ComponentDefinition) => {
                component.scripts.forEach((script) => {
                    const sourcePath = script.uri ?? script.xmlPath;
                    if (sourcePath && script.content?.length) {
                        sourceMap.set(sourcePath, script.content);
                    }
                });
            });
        }
        // Execute the BrightScript code
        exitReason = await executeApp(interpreter, parseResult.statements, payload, sourceMap);
    }
    return { exitReason: exitReason };
}

/**
 * Decode and run an encrypted package of BrightScript code.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @param sourceResult with the pcode data and iv.
 * @param payload with the source code, manifest and all the assets of the app.
 *
 * @returns RunResult with the exit reason.
 */
async function runEncrypted(
    interpreter: Interpreter,
    sourceResult: SourceResult,
    payload: AppPayload
): Promise<RunResult> {
    const password = payload.password ?? "";
    let decodedTokens: Map<string, any>;
    // Decode Encrypted Parsed Code
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
    try {
        const allStatements = parseDecodedTokens(
            interpreter.fileSystem,
            interpreter.manifest,
            decodedTokens
        );
        const exitReason = await executeApp(interpreter, allStatements, payload);
        return { exitReason: exitReason };
    } catch (err: any) {
        postMessage(`error,Error executing the app: ${err.message}`);
        return { exitReason: AppExitReason.CRASHED };
    }
}

/**
 * Execute the BrightScript code using the provided interpreter and parsed statements.
 * @param interpreter the interpreter instance to use.
 * @param statements the parsed BrightScript code to execute.
 * @param payload with the source code, manifest and all the assets of the app.
 * @param sourceMap optional map with the source code files content.
 *
 * @returns the exit reason.
 */
async function executeApp(
    interpreter: Interpreter,
    statements: Stmt.Statement[],
    payload: AppPayload,
    sourceMap?: Map<string, string>
) {
    let exitReason: AppExitReason = AppExitReason.FINISHED;
    try {
        let splashMinTime = parseInt(payload.manifest.get("splash_min_time") ?? "");
        if (isNaN(splashMinTime)) {
            splashMinTime = 1600; // Roku default value
        }
        let splashTime = Date.now() - payload.launchTime;
        if (splashTime < splashMinTime) {
            await new Promise((r) => setTimeout(r, splashMinTime - splashTime));
            splashTime = splashMinTime;
        }
        const inputParams = setupInputParams(payload.deepLink, splashTime);
        interpreter.exec(statements, sourceMap, inputParams);
    } catch (err: any) {
        exitReason = AppExitReason.FINISHED;
        if (!terminateReasons.includes(err.message)) {
            if (interpreter.options.post ?? true) {
                postMessage(`error,${err.message}`);
            } else {
                interpreter.options.stderr.write(err.message);
            }
            exitReason = AppExitReason.CRASHED;
            const runtimeError = err.cause;
            if (
                runtimeError &&
                runtimeError instanceof RuntimeError &&
                runtimeError.errorDetail === RuntimeErrorDetail.MemberFunctionNotFound
            ) {
                exitReason = AppExitReason.UNKFUNC;
            }
        }
    }
    return exitReason;
}
