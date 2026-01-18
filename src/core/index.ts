/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExecutionOptions, Interpreter, TerminateReasons } from "./interpreter";
import {
    AppExitReason,
    PkgFilePath,
    AppPayload,
    DeviceInfo,
    DataBufferIndex,
    DataBufferSize,
    DefaultDeviceInfo,
    parseManifest,
    isAppPayload,
    TaskPayload,
    isTaskPayload,
    SupportedExtension,
    ExtensionInfo,
    ExtVolInitialSize,
    ExtVolMaxSize,
    Platform,
} from "./common";
import { Lexer, Token } from "./lexer";
import { Parser, Stmt } from "./parser";
import { lexParseSync, parseDecodedTokens } from "./LexerParser";
import { BrsDevice } from "./device/BrsDevice";
import { BrsError, logError, RuntimeError, RuntimeErrorDetail } from "./error/BrsError";
import { BrsExtension, registerExtension, instantiateExtensions } from "./extensions";
import SharedObject from "./SharedObject";
import * as PP from "./preprocessor";
import * as BrsTypes from "./brsTypes";
import * as path from "path";
import * as crypto from "crypto";
import * as fs from "fs";
import { XmlDocument } from "xmldoc";
import { encode, decode } from "@msgpack/msgpack";
import { zlibSync, unzlibSync, zipSync } from "fflate";

export * from "./brsTypes";
export * from "./interpreter";
export * from "./error/BrsError";
export * from "./error/ArgumentMismatch";
export * from "./error/TypeMismatch";
export * from "./LexerParser";
export * from "./common";
export * from "./device/BrsDevice";
export * from "./brsTypes/components/RoFontRegistry";
export * from "./device/FileSystem";
export { default as SharedObject } from "./SharedObject";
export type { ISGNode } from "./extensions";
export { registerExtension, clearExtensions, instantiateExtensions, isSceneGraphNode } from "./extensions";
export { Lexer, Lexeme, Token, ReservedWords, isToken } from "./lexer";
export { Parser, Stmt, Expr, BlockEnd } from "./parser";
export * as stdlib from "./stdlib";
export * as netlib from "./interpreter/Network";
export { BrsTypes as types };
export { PP as preprocessor };
export { Preprocessor } from "./preprocessor/Preprocessor";
export { Interpreter } from "./interpreter";
export { Environment, Scope } from "./interpreter/Environment";
export { BrsDevice } from "./device/BrsDevice";
export { lexParseSync } from "./LexerParser";

const algorithm = "aes-256-ctr";

/// #if BROWSER
import * as CommonExports from "./common";
import * as LexerParserExports from "./LexerParser";
import * as ParserExports from "./parser";
import * as LexerExports from "./lexer";
import * as EnvironmentExports from "./interpreter/Environment";
import * as InterpreterExports from "./interpreter";
import * as BrsDeviceExports from "./device/BrsDevice";
import * as BrsErrorExports from "./error/BrsError";
import * as ArgumentMismatchExports from "./error/ArgumentMismatch";
import * as TypeMismatchExports from "./error/TypeMismatch";
import * as ExtensionsExports from "./extensions";
import * as RoFontRegistryExports from "./brsTypes/components/RoFontRegistry";
import * as FileSystemExports from "./device/FileSystem";
import * as stdlibModule from "./stdlib";
import * as netlibModule from "./interpreter/Network";
import { Preprocessor } from "./preprocessor/Preprocessor";
import packageInfo from "../../packages/browser/package.json";

if (typeof onmessage !== "undefined") {
    // Worker event that is triggered by postMessage() calls from the API library
    onmessage = function (event: MessageEvent) {
        if (isAppPayload(event.data)) {
            loadExtensions(event.data);
            executeFile(event.data);
        } else if (isTaskPayload(event.data)) {
            postMessage(`debug,[core] Task payload received: ${event.data.taskData.name}`);
            loadExtensions(event.data);
            executeTask(event.data);
        } else if (typeof event.data === "string" && event.data === "getVersion") {
            postMessage(`version,${packageInfo.version}`);
        } else if (event.data instanceof ArrayBuffer || event.data instanceof SharedArrayBuffer) {
            // Setup Control Shared Array
            BrsDevice.setSharedArray(new Int32Array(event.data));
        } else {
            postMessage(`warning,[core] Invalid message received: ${event.data}`);
        }
    };
}

// Keep track of loaded extensions to avoid duplicates
const loadedExtensions = new Set<SupportedExtension>();

/**
 * Loads BrightScript extensions from the payload.
 * @param payload App or Task payload containing extension configuration
 */
function loadExtensions(payload: AppPayload | TaskPayload) {
    const extensions = payload.extensions;
    if (Array.isArray(extensions)) {
        for (const extension of extensions) {
            if (loadedExtensions.has(extension)) {
                continue;
            }
            const extensionPath = payload.device.extensions?.get(extension) ?? "";
            loadExtension(extension, extensionPath);
        }
    }
}

/**
 * Loads a specific BrightScript extension module.
 * @param moduleId The extension identifier
 * @param modulePath The URL path to the extension module
 */
function loadExtension(moduleId: SupportedExtension, modulePath: string) {
    if (!modulePath) {
        postMessage(`warning,[core] No module path provided for ${moduleId} extension.`);
        return;
    }
    try {
        let extensionModule: any = null;
        // In a Web Worker context, we use importScripts for synchronous loading
        if (typeof importScripts === "function") {
            // @ts-ignore
            globalThis.brsEngine = createWorkerExports();
            // @ts-ignore
            globalThis.xmldoc = { XmlDocument };
            // Load the SceneGraph module script
            let scriptUrl = modulePath;
            if (Platform.inBrowser && !Platform.inElectron) {
                scriptUrl = new URL(modulePath, globalThis.location.href).href;
            }
            importScripts(scriptUrl);
            // @ts-ignore
            extensionModule = globalThis[moduleId];
        }

        if (extensionModule?.BrightScriptExtension) {
            const extension = new extensionModule.BrightScriptExtension();
            registerExtension(() => extension);
            loadedExtensions.add(moduleId);
            const extensionInfo: ExtensionInfo = { name: moduleId, library: modulePath, version: extension.version };
            postMessage(extensionInfo);
        } else {
            postMessage(`warning,[core] The loaded library does not contain ${moduleId} Extension.`);
        }
    } catch (err: any) {
        postMessage(`warning,[core] Failed to load ${moduleId} extension: ${err.message}`);
    }
}

/**
 * Aggregates all module exports into a single object for Worker context.
 * This creates a global brsEngine object with all necessary exports.
 * @returns Aggregated object with all engine exports
 */
function createWorkerExports() {
    const aggregated: Record<string, any> = {};
    const namespaces: (ModuleNamespace | undefined)[] = [
        BrsTypes,
        CommonExports,
        InterpreterExports,
        BrsErrorExports,
        ArgumentMismatchExports,
        TypeMismatchExports,
        LexerParserExports,
        BrsDeviceExports,
        RoFontRegistryExports,
        FileSystemExports,
        ExtensionsExports,
        LexerExports,
        ParserExports,
        EnvironmentExports,
    ];
    for (const ns of namespaces) {
        mergeModuleExports(aggregated, ns);
    }
    aggregated.stdlib = stdlibModule;
    aggregated.netlib = netlibModule;
    aggregated.types = BrsTypes;
    aggregated.preprocessor = PP;
    aggregated.Preprocessor = Preprocessor;
    aggregated.SharedObject = SharedObject;
    return aggregated;
}

type ModuleNamespace = Record<string, any>;

/**
 * Merges exports from a module namespace into a target object.
 * @param target The target object to merge exports into
 * @param source The source module namespace to merge from
 * @returns The target object with merged exports
 */
function mergeModuleExports(target: Record<string, any>, source: ModuleNamespace | undefined) {
    if (!source) {
        return target;
    }
    for (const key of Object.keys(source)) {
        if (key === "default" || key === "__esModule") {
            return;
        }
        target[key] = source[key];
    }
    return target;
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
const arrayLength = DataBufferIndex + DataBufferSize;
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arrayLength);
const sharedArray = new Int32Array(sharedBuffer);
sharedArray.fill(-1);
BrsDevice.setSharedArray(sharedArray);

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
        if (sharedBuffer) {
            BrsDevice.setSharedArray(new Int32Array(sharedBuffer));
        }
    }
}

/**
 * Returns a new instance of the Interpreter for REPL (Read-Eval-Print Loop).
 * @param payload Partial app payload with device configuration and assets
 * @returns Promise resolving to configured Interpreter instance or null on error
 */
export function getReplInterpreter(payload: Partial<AppPayload>) {
    if (!payload.device?.assets) {
        postMessage("error,Invalid REPL configuration: Missing assets");
        return null;
    }
    if (payload.device) {
        if (payload.device.registry?.size) {
            BrsDevice.setRegistry(payload.device.registry);
        }
        BrsDevice.setDeviceInfo(payload.device);
    }
    try {
        BrsDevice.setupFileSystem(payload);
        BrsDevice.loadLocaleTerms();
    } catch (err: any) {
        postMessage(`error,[repl] Error mounting File System: ${err.message}`);
        return null;
    }
    const replInterpreter = new Interpreter();
    replInterpreter.onError(logError);
    const extensions = instantiateExtensions();
    attachExtensions(replInterpreter, extensions);
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
        for (const result of results) {
            if (result !== BrsTypes.BrsInvalid.Instance) {
                postMessage(`print,${result.toString()}`);
            }
        }
    } catch (err: any) {
        if (!(err instanceof BrsError)) {
            postMessage(`error,Interpreter execution error: ${err.message}`);
        }
    }
}

/**
 * Processes a BrightScript file and adds it to the appropriate collections.
 * @param filePath Original file path
 * @param fileContent File content as Uint8Array
 * @param source Source code array to potentially add to
 * @param paths Paths array to potentially add to
 * @param zipFiles ZIP files collection
 * @param id Current source file ID counter
 * @returns Updated ID counter
 */
function processBrightScriptFile(
    filePath: string,
    fileContent: Uint8Array,
    source: string[],
    paths: PkgFilePath[],
    zipFiles: Record<string, Uint8Array>,
    id: number
): number {
    const fileName = path.basename(filePath) ?? filePath;
    const folderPath = path.dirname(filePath);

    // Determine the zip path and whether file should be added to the source array
    let zipPath: string;
    let addToSourceArray: boolean;

    if (folderPath === "." || folderPath === "" || filePath === fileName) {
        // No relative folder provided, put in source folder
        zipPath = `source/${fileName}`;
        addToSourceArray = true;
    } else if (folderPath.startsWith("source")) {
        // File is already in source folder (or subfolder), keep it there
        zipPath = filePath;
        addToSourceArray = true;
    } else {
        // Keep the original path structure for non-source folders
        zipPath = filePath;
        addToSourceArray = false;
    }

    // Add to source array only if it should be treated as source code
    if (addToSourceArray) {
        const sourceCode = new TextDecoder().decode(fileContent);
        if (sourceCode.length > 0) {
            source.push(sourceCode);
            paths.push({ id: id, url: zipPath, type: "source" });
            id++;
        }
    }

    // Add to zip regardless of folder
    zipFiles[zipPath] = fileContent;
    return id;
}

/**
 * Processes a manifest file and returns the parsed manifest.
 * @param fileContent File content as Uint8Array
 * @param zipFiles ZIP files collection
 * @returns Parsed manifest or undefined
 */
function processManifestFile(
    fileContent: Uint8Array,
    zipFiles: Record<string, Uint8Array>
): Map<string, string> | undefined {
    const fileData = new TextDecoder().decode(fileContent);
    zipFiles["manifest"] = fileContent;

    if (fileData.length > 0) {
        return parseManifest(fileData);
    }
    return undefined;
}

/**
 * Creates a default manifest if none was provided.
 * @returns Default manifest map
 */
function createDefaultManifest(): Map<string, string> {
    const manifest = new Map<string, string>();
    manifest.set("title", "BRS App");
    manifest.set("major_version", "0");
    manifest.set("minor_version", "0");
    manifest.set("build_version", "0");
    manifest.set("splash_min_time", "0");
    return manifest;
}

/**
 * Processes device data and ensures it has default assets.
 * @param customDeviceData Optional custom device data
 * @returns Complete device data
 */
function processDeviceData(customDeviceData?: Partial<DeviceInfo>): DeviceInfo {
    const deviceData = customDeviceData ? Object.assign(DefaultDeviceInfo, customDeviceData) : DefaultDeviceInfo;

    if (deviceData.assets.byteLength === 0) {
        deviceData.assets = fs.readFileSync(path.join(__dirname, "../assets/common.zip"))?.buffer;
    }

    return deviceData;
}

/**
 * Create the payload to run the app with the provided file map.
 * @param fileMap Map with file paths as keys and Blob content as values
 * @param customDeviceData optional object with device info data
 * @param deepLink optional map with deep link parameters
 *
 * @returns object with the payload to run the app.
 */
export async function createPayloadFromFileMap(
    fileMap: Map<string, Blob>,
    customDeviceData?: Partial<DeviceInfo>,
    deepLink?: Map<string, string>
): Promise<AppPayload> {
    const paths: PkgFilePath[] = [];
    const source: string[] = [];
    let manifest: Map<string, string> | undefined;
    const zipFiles: Record<string, Uint8Array> = {};

    let id = 0;

    // Process each file in the file map
    for (const [filePath, blob] of fileMap) {
        const fileName = path.basename(filePath) ?? filePath;
        const fileExt = fileName.split(".").pop();
        const fileContent = new Uint8Array(await blob.arrayBuffer());

        if (fileExt?.toLowerCase() === "brs") {
            id = processBrightScriptFile(filePath, fileContent, source, paths, zipFiles, id);
        } else if (fileName === "manifest") {
            manifest = processManifestFile(fileContent, zipFiles);
        } else {
            // Add other files (images, xml, etc.) to zip as-is
            zipFiles[filePath] = fileContent;
        }
    }

    // Validate that we have at least one BrightScript source file
    if (id === 0) {
        throw new Error("Invalid or inexistent BrightScript files!");
    }

    // Process device data and manifest
    const deviceData = processDeviceData(customDeviceData);
    manifest ??= createDefaultManifest();

    // Create the ZIP package
    const zipBuffer = zipSync(zipFiles);
    const pkgZipBuffer = new ArrayBuffer(zipBuffer.length);
    new Uint8Array(pkgZipBuffer).set(zipBuffer);

    // Build and return the payload
    const payload: AppPayload = {
        device: deviceData,
        launchTime: Date.now(),
        manifest: manifest,
        deepLink: deepLink ?? new Map(),
        paths: paths,
        source: source,
        pkgZip: pkgZipBuffer,
    };

    return payload;
}

/**
 * Create the payload to run the app with the provided files.
 * @param files Code files to be executed
 * @param customDeviceData optional object with device info data
 * @param deepLink optional map with deep link parameters
 * @param root optional root path for the interpreter
 * @param ext optional path to external storage (directory or zip file)
 * @returns Promise resolving to AppPayload object to run the app
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
    for (const file of files) {
        let filePath = file;
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
    }
    if (id === 0) {
        throw new Error("Invalid or inexistent file(s)!");
    }

    const deviceData = processDeviceData(customDeviceData);

    if (root && !manifest && fs.existsSync(path.join(root, "manifest"))) {
        const fileData = fs.readFileSync(path.join(root, "manifest"));
        if (fileData) {
            manifest = parseManifest(fileData.toString());
        }
    }

    manifest ??= createDefaultManifest();

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
            const extObj = new SharedObject(ExtVolInitialSize, ExtVolMaxSize);
            extObj.storeData(new Uint8Array(fs.readFileSync(ext)).buffer);
            payload.extZip = extObj.getBuffer();
        }
    }
    return payload;
}
/// #endif

/**
 * Runs a BrightScript app with full zip folder structure.
 * @param payload with the source code, manifest and all the assets of the app.
 * @param customOptions optional object with the output streams.
 *
 * @returns RunResult with the end reason and (optionally) the encrypted data.
 */
export async function executeFile(payload: AppPayload, customOptions?: Partial<ExecutionOptions>): Promise<RunResult> {
    const options = {
        entryPoint: payload.device.entryPoint ?? true,
        stopOnCrash: payload.device.debugOnCrash ?? false,
        ...customOptions,
    };
    // Setup the File System
    BrsDevice.setDeviceInfo(payload.device);
    try {
        BrsDevice.setupFileSystem(payload);
        BrsDevice.loadLocaleTerms();
    } catch (err: any) {
        postMessage(`error,[core] Error mounting File System: ${err.message}`);
        return { exitReason: AppExitReason.Crashed };
    }
    // Setup the interpreter
    const interpreter = await createInterpreter(options, payload);
    const sourceResult = setupPayload(interpreter, payload);
    // Run the BrightScript app
    BrsDevice.lastKeyTime = Date.now();
    let result: RunResult;
    if (sourceResult.pcode && sourceResult.iv) {
        result = await runEncrypted(interpreter, sourceResult, payload);
    } else {
        result = await runSource(interpreter, sourceResult.sourceMap, payload);
    }
    if (BrsDevice.registry.isDirty) {
        BrsDevice.flushRegistry();
    }
    if (!result.cipherText) {
        postMessage(`end,${result.exitReason}`);
    }
    return result;
}

/**
 * Executes a BrightScript Task in a separate worker context.
 * @param payload Task payload containing task configuration and source code
 * @param customOptions Optional execution options to override defaults
 */
export async function executeTask(payload: TaskPayload, customOptions?: Partial<ExecutionOptions>) {
    const options = {
        entryPoint: false,
        stopOnCrash: payload.device.debugOnCrash ?? false,
        ...customOptions,
    };
    // Setup the File System
    BrsDevice.setDeviceInfo(payload.device);
    try {
        BrsDevice.setupFileSystem(payload);
        BrsDevice.loadLocaleTerms();
    } catch (err: any) {
        postMessage(`error,[core] Error mounting File System on Task: ${err.message}`);
        return;
    }
    // Setup the interpreter
    const interpreter = await createInterpreter(options, payload);
    const sourceResult = setupPayload(interpreter, payload);
    // Run the BrightScript Task
    try {
        for (const ext of interpreter.extensions.values()) {
            if (ext.updateSourceMap) {
                ext.updateSourceMap(sourceResult.sourceMap);
            }
            if (ext.execTask) {
                interpreter.sourceMap = sourceResult.sourceMap;
                ext.execTask(interpreter, payload);
                break;
            }
        }
        if (BrsDevice.registry.isDirty) {
            BrsDevice.flushRegistry();
        }
        if (BrsDevice.isDevMode) {
            postMessage(`debug,[core] Task ${payload.taskData.name} is done.`);
        }
    } catch (err: any) {
        if (TerminateReasons.includes(err.message)) {
            const reason = err.message === "debug-exit" ? AppExitReason.Stopped : AppExitReason.UserNav;
            postMessage(`end,${reason}`);
            return;
        } else if (err instanceof BrsError) {
            const backTrace = interpreter.formatBacktrace(err.location, true, err.backTrace);
            err = new Error(`${err.format()}\nBackTrace:\n${backTrace}`);
        }
        if (interpreter.options.post ?? true) {
            postMessage(`error,${err.message}`);
        } else {
            interpreter.options.stderr.write(err.message);
        }
        postMessage(`end,${AppExitReason.Crashed}`);
    }
}

/**
 * Creates and configures a new Interpreter instance.
 * @param options Partial execution options to configure the interpreter
 * @param payload App or Task payload being executed
 * @returns Promise resolving to configured Interpreter instance
 */
async function createInterpreter(options: Partial<ExecutionOptions>, payload: AppPayload | TaskPayload) {
    BrsDevice.bscs.clear();
    BrsDevice.stats.clear();
    BrsDevice.nodes.clear();
    const extensions = instantiateExtensions();
    // Create the interpreter
    const interpreter = new Interpreter(options);
    if (extensions.length > 0) {
        attachExtensions(interpreter, extensions);
        await runBeforeExecuteHooks(interpreter, payload);
    }
    return interpreter;
}

/**
 * Attaches BrightScript extensions to the interpreter and calls their initialization hooks.
 * @param interpreter The interpreter instance to attach extensions to
 * @param extensions Array of extension instances to attach
 */
function attachExtensions(interpreter: Interpreter, extensions: BrsExtension[]) {
    for (const ext of extensions) {
        interpreter.extensions.set(ext.name, ext);
        ext.onInit?.(interpreter);
    }
}

/**
 * Runs the beforeExecute hooks for all registered extensions.
 * @param interpreter The interpreter instance
 * @param payload App or Task payload being executed
 */
async function runBeforeExecuteHooks(interpreter: Interpreter, payload: AppPayload | TaskPayload) {
    for (const ext of interpreter.extensions.values()) {
        if (ext.onBeforeExecute) {
            await ext.onBeforeExecute(interpreter, payload);
        }
    }
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

function setupPayload(interpreter: Interpreter, payload: AppPayload | TaskPayload): SourceResult {
    interpreter.setManifest(payload.manifest);
    if (payload.device.registryBuffer) {
        BrsDevice.setRegistry(payload.device.registryBuffer);
    } else if (payload.device.registry?.size) {
        BrsDevice.setRegistry(payload.device.registry);
    }
    setupTranslations(interpreter);
    return setupPackageFiles(payload);
}

interface SerializedPCode {
    [pcode: string]: Token[];
}

/**
 * Process the application input parameters including deep links.
 * @param deepLinkMap Map with deep link parameters
 * @param splashTime Elapsed splash time in milliseconds
 * @returns RoAssociativeArray containing input parameters
 */
function setupInputParams(deepLinkMap: Map<string, string>, splashTime: number): BrsTypes.RoAssociativeArray {
    const inputMap = new Map([
        ["instant_on_run_mode", "foreground"],
        ["lastExitOrTerminationReason", AppExitReason.Unknown],
        ["source", "auto-run-dev"],
        ["splashTime", splashTime.toString()],
    ]);
    for (const [key, value] of deepLinkMap) {
        inputMap.set(key, value);
    }
    return BrsTypes.toAssociativeArray(inputMap);
}

/**
 * Extracts package files from the payload and builds a source map.
 * Handles both regular source files and encrypted pcode files.
 * @param payload Payload with the source code, manifest and all the assets of the app
 * @returns SourceResult object with the source map or the pcode data
 */
function setupPackageFiles(payload: AppPayload | TaskPayload): SourceResult {
    const result: SourceResult = { sourceMap: new Map<string, string>() };
    const fsys = BrsDevice.fileSystem;
    if (!fsys || !Array.isArray(payload.paths)) {
        return result;
    }
    for (let filePath of payload.paths) {
        try {
            const pkgPath = `pkg:/${filePath.url}`;
            if (filePath.type === "pcode" && fsys.existsSync(pkgPath)) {
                if (filePath.id === 0) {
                    result.pcode = fsys.readFileSync(pkgPath);
                    continue;
                }
                result.iv = fsys.readFileSync(pkgPath, "utf8");
            } else if (filePath.type === "source" && isAppPayload(payload) && Array.isArray(payload.source)) {
                result.sourceMap.set(pkgPath, payload.source[filePath.id]);
            } else if (filePath.type === "source" && fsys.existsSync(`pkg:/${filePath.url}`)) {
                result.sourceMap.set(pkgPath, fsys.readFileSync(pkgPath, "utf8"));
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
    const locale = BrsDevice.deviceInfo.locale;
    try {
        const fsys = BrsDevice.fileSystem;
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
            if (xmlText.trim().length === 0) {
                postMessage("error,Error parsing translation XML: Empty input");
                return;
            }
            try {
                const document = new XmlDocument(xmlText);
                if (trType === "TS") {
                    const contexts = document.childrenNamed("context");
                    for (const contextNode of contexts) {
                        const messages = contextNode.childrenNamed("message");
                        for (const messageNode of messages) {
                            const sourceNode = messageNode.childNamed("source");
                            const translationNode = messageNode.childNamed(trTarget);
                            const sourceText = sourceNode?.val ?? "";
                            if (sourceText) {
                                interpreter.translations.set(sourceText, translationNode?.val ?? "");
                            }
                        }
                    }
                } else {
                    const files = document.childrenNamed("file");
                    for (const fileNode of files) {
                        const bodyNode = fileNode.childNamed("body");
                        const units = bodyNode?.childrenNamed("trans-unit") ?? [];
                        for (const unit of units) {
                            const sourceNode = unit.childNamed("source");
                            const targetNode = unit.childNamed(trTarget);
                            const sourceText = sourceNode?.val ?? "";
                            if (sourceText) {
                                interpreter.translations.set(sourceText, targetNode?.val ?? "");
                            }
                        }
                    }
                }
            } catch (err: any) {
                postMessage(`error,Error parsing XML: ${err?.message ?? err}`);
            }
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
    const parseResult = lexParseSync(BrsDevice.fileSystem, interpreter.manifest, sourceMap, password, BrsDevice.stats);
    let exitReason = parseResult.exitReason;
    if (exitReason !== AppExitReason.Crashed) {
        if (password.length > 0) {
            const tokens = parseResult.tokens;
            const iv = crypto.randomBytes(12).toString("base64");
            const cipher = crypto.createCipheriv(algorithm, password, iv);
            const deflated = zlibSync(encode({ pcode: tokens }));
            const source = Buffer.from(deflated);
            const cipherText = Buffer.concat([cipher.update(source), cipher.final()]);
            return { exitReason: AppExitReason.Packaged, cipherText: cipherText, iv: iv };
        }
        // Update Source Map with the SceneGraph components (if exists)
        for (const ext of interpreter.extensions.values()) {
            if (ext.updateSourceMap) {
                ext.updateSourceMap(sourceMap);
            }
        }
        // Execute the BrightScript code
        exitReason = await executeApp(interpreter, parseResult.statements, payload, sourceMap);
    }
    return { exitReason: exitReason };
}

/**
 * Decodes and runs an encrypted package of BrightScript code.
 * @param interpreter The interpreter instance to use when executing the code
 * @param sourceResult Object containing the encrypted pcode data and initialization vector
 * @param payload Payload with the source code, manifest and all the assets of the app
 * @returns Promise resolving to RunResult with the exit reason
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
            const inflated = unzlibSync(Buffer.concat([decipher.update(sourceResult.pcode), decipher.final()]));
            const spcode = decode(inflated) as SerializedPCode;
            if (spcode) {
                decodedTokens = new Map(Object.entries(spcode.pcode));
            } else {
                return { exitReason: AppExitReason.Invalid };
            }
        } else {
            return { exitReason: AppExitReason.NoPassword };
        }
    } catch (err: any) {
        postMessage(`error,Error unpacking the app: ${err.message}`);
        return { exitReason: AppExitReason.UnpackFail };
    }
    // Execute the decrypted source code
    try {
        const allStatements = parseDecodedTokens(BrsDevice.fileSystem, interpreter.manifest, decodedTokens);
        const exitReason = await executeApp(interpreter, allStatements, payload);
        return { exitReason: exitReason };
    } catch (err: any) {
        postMessage(`error,Error executing the app: ${err.message}`);
        return { exitReason: AppExitReason.Crashed };
    }
}

/**
 * Executes the BrightScript code using the provided interpreter and parsed statements.
 * @param interpreter The interpreter instance to use
 * @param statements The parsed BrightScript statements to execute
 * @param payload Payload with the source code, manifest and all the assets of the app
 * @param sourceMap Optional map with the source code files content for debugging
 * @returns Promise resolving to the AppExitReason indicating how the app terminated
 */
async function executeApp(
    interpreter: Interpreter,
    statements: Stmt.Statement[],
    payload: AppPayload,
    sourceMap?: Map<string, string>
) {
    let exitReason: AppExitReason = AppExitReason.UserNav;
    try {
        let splashMinTime = Number.parseInt(payload.manifest.get("splash_min_time") ?? "");
        if (Number.isNaN(splashMinTime)) {
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
        if (TerminateReasons.includes(err.message)) {
            exitReason = err.message === "debug-exit" ? AppExitReason.Stopped : AppExitReason.UserNav;
        } else {
            exitReason = AppExitReason.Crashed;
            if (interpreter.options.post ?? true) {
                postMessage(`error,${err.message}`);
            } else {
                interpreter.options.stderr.write(err.message);
            }
            const runtimeError = err.cause;
            if (
                runtimeError &&
                runtimeError instanceof RuntimeError &&
                runtimeError.errorDetail === RuntimeErrorDetail.MemberFunctionNotFound
            ) {
                exitReason = AppExitReason.UnkFunction;
            }
        }
    }
    return exitReason;
}
