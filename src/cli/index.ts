#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import readline from "node:readline";
import { Worker } from "node:worker_threads";
import { gateway4sync } from "default-gateway";
import envPaths from "env-paths";
import { ImageData, createCanvas } from "canvas";
import chalk from "chalk";
import { Command } from "commander";
import stripAnsi from "strip-ansi";
import { deviceData, loadAppZip, updateAppZip, subscribePackage, mountExt, setupDeepLink } from "./package";
import { deriveMaxColumns, renderAsciiFrame, renderUnicodeFrame, printFrame } from "./display";
import { startKeyboardControl, stopKeyboardControl, handleDebuggerCommand } from "./keyboard";
import { isNumber } from "../api/util";
import {
    DebugPrompt,
    DataBufferIndex,
    DataBufferSize,
    AppPayload,
    AppExitReason,
    AppData,
    SupportedExtension,
    isRegistryData,
    isGraphicsData,
    ExtensionInfo,
    DataType,
    ExtVolInitialSize,
    ExtVolMaxSize,
} from "../core/common";
import SharedObject from "../core/SharedObject";
import { encryptPackage } from "../core/packageEncryption";
import packageInfo from "../../packages/node/package.json";
// @ts-ignore
import * as brs from "./brs.node.js";

// Constants
declare const __non_webpack_require__: NodeJS.Require;
const loadModule = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
const program = new Command();
const paths = envPaths("brs", { suffix: "cli" });
const defaultLevel = chalk.level;
const maxColumns = deriveMaxColumns();
const length = DataBufferIndex + DataBufferSize;
const BrsDevice = brs.BrsDevice;

// Variables
let appFileName = "";
let lastFrame: ImageData | undefined;
const extensions: ExtensionInfo[] = [];
let brsWorker: Worker;
let workerReady = false;
let sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
let sharedArray = new Int32Array(sharedBuffer);
sharedArray.fill(-1);

/**
 * CLI program, params definition and action processing.
 *
 */
program
    .description(`${packageInfo.title} CLI`)
    .arguments(`brs-cli [brsFiles...]`)
    .option("-a, --ascii <columns>", "Enable ASCII screen mode with # of columns.")
    .option("-u, --unicode", "Render ASCII screen mode using Unicode block characters.", false)
    .option("-i, --image", "Render the screen as images on the terminal (iTerm2/Kitty or ANSI).", false)
    .option("-s, --snapshot [filename]", "Enable Ctrl+S to save the current screen as a PNG image.")
    .option("-c, --colors <level>", "Define the console color level (0 to disable).", defaultLevel)
    .option("-d, --debug", "Developer mode: micro debugger on crash + resource tracking.", false)
    .option("-e, --ecp", "Enable the ECP server for control simulation.", false)
    .option("-n, --no-sg", "Disable the SceneGraph extension.")
    .option("-p, --pack <password>", "The password to generate the encrypted package.", "")
    .option("-o, --out <directory>", "The directory to save the encrypted package file.", "./")
    .option("-r, --root <directory>", "The root directory from which `pkg:` paths will be resolved.")
    .option("-x, --ext-vol <path>", "Path to directory or zip file from which `ext1:` will be mounted.")
    .option("-k, --deep-link <params>", "Parameters to be passed to the application. (format: key=value,...)")
    .option("-y, --registry", "Persist the simulated device registry on disk.", false)
    .action(async (brsFiles, program) => {
        if (!checkParameters()) {
            return;
        }
        if (typeof deviceData === "object") {
            deviceData.customFeatures.push("ascii_rendering");
            deviceData.assets = fs.readFileSync(path.join(__dirname, "../assets/common.zip"))?.buffer;
            deviceData.localIps = getLocalIps();
            try {
                const { gateway, int } = gateway4sync();
                deviceData.connectionInfo.gateway = gateway;
                deviceData.connectionInfo.name = int ?? "eth1";
            } catch (err: any) {
                console.error(chalk.red(`Unable to get the Network Gateway: ${err.message}`));
            }
            deviceData.connectionInfo.dns = dns.getServers();
            deviceData.debugOnCrash = program.debug ?? false;
            if (program.registry) {
                deviceData.registry = getRegistry();
            }
            deviceData.appList = new Array<AppData>();
        }
        if (program.sg) {
            await loadSceneGraphExtension();
        }
        subscribePackage("cli", packageCallback);
        brs.registerCallback(messageCallback, sharedBuffer);
        if (brsFiles.length > 0) {
            await runAppFiles(brsFiles);
        } else if (program.root) {
            // Run a folder app (source/ + components/) from the root alone.
            await runAppFiles([]);
        } else {
            displayTitle();
            repl();
        }
    })
    .version(packageInfo.version, "-v, --version")
    .parse(process.argv);

/**
 * Validates and normalizes CLI parameters.
 * Sets default values for color level, ASCII mode, and validates file paths.
 * @returns True if all parameters are valid, false otherwise
 */
function checkParameters() {
    if (isNumber(program.colors) && program.colors >= 0 && program.colors <= 3) {
        chalk.level = Math.trunc(program.colors) as chalk.Level;
    } else {
        console.warn(chalk.yellow(`Invalid color level! Valid range is 0-3, keeping default: ${defaultLevel}.`));
    }
    if (program.ascii) {
        if (isNumber(program.ascii)) {
            program.ascii = +program.ascii;
        } else {
            program.ascii = 0;
        }
        if (program.ascii < 32) {
            program.ascii = maxColumns;
            console.warn(
                chalk.yellow(`Invalid # of columns! Valid values are >=32, using current width: ${program.ascii}.`)
            );
        }
    } else if (program.unicode) {
        program.ascii = maxColumns;
    }
    if (program.root && !fs.existsSync(program.root)) {
        console.error(chalk.red(`Root path not found: ${program.root}\n`));
        process.exitCode = 1;
        return;
    }
    if (program.extVol && !fs.existsSync(program.extVol)) {
        console.error(chalk.red(`External storage path not found: ${program.extVol}\n`));
        process.exitCode = 1;
        return;
    }
    return process.exitCode !== 1;
}

/**
 * Dynamically load the SceneGraph extension module.
 */
async function loadSceneGraphExtension() {
    try {
        const sgLib = "brs-sg.node.js";
        const sg = await loadModule(path.join(__dirname, sgLib));
        const extension = new sg.BrightScriptExtension();
        brs.registerExtension(() => extension);
        extensions.push({ name: SupportedExtension.SceneGraph, library: sgLib, version: extension.version });
        deviceData.extensions = new Map([[SupportedExtension.SceneGraph, sgLib]]);
    } catch (err: any) {
        console.error(chalk.red(`Error loading SceneGraph extension: ${err.message}`));
    }
}

/**
 * Executes BrightScript files or application packages (.zip/.bpk).
 * Handles package creation if password is provided, otherwise runs the app.
 * @param files - Array of file paths to execute (first file is used)
 */
async function runAppFiles(files: string[]) {
    try {
        if (files.length === 0) {
            // No positional files: run the folder app discovered from `--root`.
            appFileName = path.basename(path.resolve(program.root));
            deviceData.appList?.push({ id: "dev", title: appFileName, version: "1.0.0" });
            const payload = await brs.createPayloadFromFiles(
                files,
                deviceData,
                processDeepLink(),
                program.root,
                program.extVol
            );
            runApp(payload);
            return;
        }
        const filePath = files[0];
        const fileName = filePath.split(/.*[/|\\]/)[1] ?? filePath;
        const fileExt = fileName.split(".").pop()?.toLowerCase();
        appFileName = fileName;
        if (fileExt === "zip" || fileExt === "bpk") {
            // Run App Package file
            displayTitle();
            if (program.pack.length > 0 && fileExt === "zip") {
                console.log(chalk.blueBright(`Packaging ${filePath}...\n`));
            } else {
                console.log(chalk.blueBright(`Executing ${filePath}...\n`));
                if (program.extVol?.endsWith(".zip")) {
                    mountExt(new Uint8Array(fs.readFileSync(program.extVol)).buffer);
                }
                setupDeepLink(processDeepLink());
            }
            const fileData = new Uint8Array(fs.readFileSync(filePath)).buffer;
            deviceData.entryPoint = true;
            loadAppZip(fileName, fileData, runApp, program.pack);
            return;
        }
        // Run BrightScript files
        deviceData.appList?.push({ id: "dev", title: fileName, version: "1.0.0" });
        const payload = await brs.createPayloadFromFiles(
            files,
            deviceData,
            processDeepLink(),
            program.root,
            program.extVol
        );
        runApp(payload);
    } catch (err: any) {
        if (err.messages?.length) {
            for (const message of err.messages) {
                console.error(chalk.red(message));
            }
        } else {
            console.error(chalk.red(err.message));
        }
        process.exitCode = 1;
    }
}

/**
 * Parses deep link parameters from command line arguments.
 * Expects format: key=value,key2=value2
 * @returns Map containing the deep link key-value pairs
 */
function processDeepLink() {
    const deepLinkMap: Map<string, string> = new Map();
    const deepLinkParams = program.deepLink?.split(",");
    if (deepLinkParams) {
        for (const value of deepLinkParams) {
            if (value?.includes("=")) {
                const [key, val] = value.split("=");
                deepLinkMap.set(key, val);
            } else {
                console.warn(chalk.yellow(`Invalid deep link parameter: ${value}`));
            }
        }
    }
    return deepLinkMap;
}

/**
 * Displays the CLI application title and version on the console.
 * Shows dev indicator in debug builds.
 */
function displayTitle() {
    const appTitle = `${packageInfo.title} CLI`;
    const appVersion = `v${packageInfo.version}`;
    /// #if DEBUG
    console.log(`\n${appTitle} [${chalk.cyanBright(appVersion)} ${chalk.gray("dev")}]\n`);
    /// #else
    console.log(`\n${appTitle} [${chalk.cyanBright(appVersion)}]\n`);
    /// #endif
}

/**
 * Executes the application payload or generates an encrypted package.
 * Initializes ECP worker if enabled, then runs the app or creates .bpk file.
 * @param payload - The application payload containing code, device info, and options
 */
async function runApp(payload: AppPayload) {
    payload.password = program.pack;
    if (program.ecp && !workerReady) {
        // Load ECP service as Worker
        const workerPath = path.join(__dirname, "brs.ecp.js");
        const workerData = { device: payload.device };
        brsWorker = new Worker(workerPath, { workerData: workerData });
        brsWorker.once("message", (value: any) => {
            if (value?.ready) {
                console.log(chalk.blueBright(value?.msg));
                workerReady = true;
                runApp(payload);
            } else {
                brsWorker?.terminate();
                console.error(chalk.red(value?.msg));
                process.exitCode = 1;
            }
        });
        brsWorker.postMessage(sharedBuffer);
        return;
    }
    try {
        let exitReason: AppExitReason;
        if (program.pack.length > 0 && !isPackaged(payload)) {
            // Packaging returns the encrypted data as a function result (not a message),
            // so it runs in-process; there is no display loop and no Tasks to spawn.
            const pkg = await brs.executeFile(payload, {}, true);
            exitReason = pkg.exitReason;
            if (pkg.exitReason === AppExitReason.Packaged) {
                if (program.ecp) {
                    brsWorker?.terminate();
                }
                await savePackage(pkg);
                return;
            }
        } else {
            // Run the app on a dedicated worker thread (render thread); this main thread stays
            // free to broker SceneGraph Task rendezvous, keyboard input and the Micro Debugger.
            payload.extensions = extensions.map((ext) => ext.name as SupportedExtension);
            brs.subscribeHost("cli", hostCallback);
            startKeyboardControl(sharedArray, () => brs.terminateApp(), program.snapshot ? saveScreenshot : undefined);
            enableFrameOutput();
            try {
                const result = await brs.executeApp(payload, { sharedBuffer });
                exitReason = result.exitReason;
            } finally {
                disableFrameOutput();
                stopKeyboardControl();
            }
        }
        if (program.ecp) {
            brsWorker?.terminate();
        }
        const msg = `------ Finished '${appFileName}' execution [${exitReason}] ------\n`;
        if (exitReason === AppExitReason.UserNav) {
            console.log(chalk.blueBright(msg));
        } else {
            process.exitCode = 1;
            console.log(chalk.redBright(msg));
        }
    } catch (err: any) {
        console.error(chalk.red(`Error executing app: ${err.message}`));
        process.exitCode = 1;
    }
}

/**
 * Returns true when the payload is already an encrypted package (.bpk),
 * which is executed (not re-packaged) even when a password is provided.
 * @param payload - The application payload to inspect
 */
function isPackaged(payload: AppPayload) {
    return Array.isArray(payload.paths) && payload.paths.some((filePath) => filePath.type === "pcode");
}

/**
 * Writes the encrypted app package (.bpk) generated by the packaging run to disk.
 * @param pkg - The packaging result with cipherText, iv and packed file list
 */
async function savePackage(pkg: brs.RunResult) {
    const filePath = path.join(program.out, appFileName.replaceAll(/.zip/gi, ".bpk"));
    try {
        // Encrypt the whole package container with the same password so the plaintext
        // assets (images, fonts, data, manifest) are also protected at rest.
        const buffer = await encryptPackage(updateAppZip(pkg.cipherText!, pkg.iv!, pkg.packedFiles), program.pack);
        fs.writeFileSync(filePath, buffer);
        console.log(
            chalk.blueBright(`Package file created as ${filePath} with ${Math.round(buffer.length / 1024)} KB.\n`)
        );
    } catch (err: any) {
        console.error(chalk.red(`Error generating the file ${filePath}: ${err.message}`));
        process.exitCode = 1;
    }
}

/**
 * Routes events from the worker host to the existing CLI message handlers.
 * @param event - The host event name (message, frame, registry, graphics, ...)
 * @param data - The event payload
 */
function hostCallback(event: string, data: any) {
    if (event === "message" && typeof data === "string") {
        if (data.startsWith("command,")) {
            handleDebuggerCommand(data.slice(8).trimEnd());
        }
        handleStringMessage(data);
    } else if (["frame", "registry", "graphics"].includes(event)) {
        // The revived ImageData, RegistryData and GraphicsData shapes are the same the
        // in-process engine posts, so the existing message handler applies unchanged.
        messageCallback(data);
    } else if (event === "error") {
        console.error(chalk.red(data));
    } else if (event === "warning") {
        console.warn(chalk.yellow(data));
    }
    // Host-internal "debug" diagnostics stay silent (matching the previous in-process output).
}

/**
 * Retrieves all local IPv4 addresses from network interfaces.
 * Excludes internal (127.0.0.1) addresses and handles multiple IPs per interface.
 * @returns Array of strings in format "interface,ip" or "interface:alias,ip"
 */
function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = new Array<string>();
    for (const ifname of Object.keys(ifaces)) {
        let alias = 0;
        const ifaceList = ifaces[ifname];
        if (ifaceList) {
            for (const iface of ifaceList) {
                if ("IPv4" !== iface.family || iface.internal !== false) {
                    // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                    continue;
                }
                if (alias >= 1) {
                    // this single interface has multiple ipv4 addresses
                    ips.push(`${ifname}:${alias},${iface.address}`);
                } else {
                    // this interface has only one ipv4 address
                    ips.push(`${ifname},${iface.address}`);
                }
                ++alias;
            }
        }
    }
    return ips;
}

/**
 * Loads persisted registry data from disk.
 * Filters out transient entries (keys with .Transient section).
 * @returns Map containing the persisted registry key-value pairs
 */
function getRegistry(): Map<string, string> {
    let registry = new Map<string, string>();
    try {
        const strRegistry = fs.readFileSync(path.resolve(paths.data, "registry.json"));
        if (strRegistry?.length) {
            const parsed = JSON.parse(strRegistry.toString("utf8"));
            if (typeof parsed === "object" && parsed !== null) {
                for (const [key, value] of new Map(parsed)) {
                    if (typeof key === "string" && typeof value === "string" && key.split(".")[1] !== "Transient") {
                        registry.set(key, value);
                    }
                }
            }
        }
    } catch (err: any) {
        console.error(chalk.red(err.message));
    }
    return registry;
}

/**
 * Launches an interactive read-execute-print loop (REPL).
 * Reads input from stdin and executes BrightScript expressions.
 */
async function repl() {
    const payload: Partial<AppPayload> = {
        device: deviceData,
        root: program.root,
    };
    // Load the external storage if provided
    let extPath = "";
    if (program.extVol && fs.existsSync(program.extVol)) {
        if (fs.statSync(program.extVol).isDirectory()) {
            payload.ext = program.extVol;
            extPath = program.extVol;
        } else if (program.extVol.endsWith(".zip")) {
            const extObj = new SharedObject(ExtVolInitialSize, ExtVolMaxSize);
            extObj.storeData(new Uint8Array(fs.readFileSync(program.extVol)).buffer);
            payload.extZip = extObj.getBuffer();
            extPath = program.extVol;
            Atomics.store(sharedArray, DataType.EVE, 1);
        }
    }
    const replInterpreter = brs.getReplInterpreter(payload);
    if (!replInterpreter) {
        return;
    }
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt(`\n${chalk.magenta("brs")}> `);
    rl.on("line", async (line) => {
        if (["exit", "quit", "q"].includes(line.toLowerCase().trim())) {
            process.exit();
        } else if (["cls", "clear"].includes(line.toLowerCase().trim())) {
            process.stdout.write("\x1Bc");
        } else if (["help", "hint"].includes(line.toLowerCase().trim())) {
            printHelp();
        } else if (["vol", "vols"].includes(line.toLowerCase().trim())) {
            const vols = BrsDevice.fileSystem.volumesSync();
            process.stdout.write(chalk.cyanBright(`\nMounted volumes:\n\n`));
            const rootPath = payload.root ?? "not mounted";
            process.stdout.write(chalk.cyanBright(`pkg:      ${rootPath}\n`));
            const extMounted = vols.includes("ext1:");
            process.stdout.write(chalk.cyanBright(`ext1:     ${extMounted ? extPath : "not mounted"}\n`));
            process.stdout.write(chalk.cyanBright(`tmp:      [In Memory]\n`));
            process.stdout.write(chalk.cyanBright(`cachefs:  [In Memory]\n`));
            process.stdout.write(chalk.cyanBright(`common:   [Read Only]\n`));
        } else if (["var", "vars"].includes(line.split(" ")[0]?.toLowerCase().trim())) {
            const scopeName = line.split(" ")[1]?.toLowerCase().trim() ?? "function";
            listVariables(scopeName, replInterpreter);
        } else if (["xt", "ext"].includes(line.toLowerCase().trim())) {
            process.stdout.write(chalk.cyanBright(`\nLoaded Extensions:\n\n`));
            if (extensions.length) {
                for (const { name, library, version } of extensions) {
                    process.stdout.write(chalk.cyanBright(`${name}: ${library} (v${version})\n`));
                }
            } else {
                process.stdout.write(chalk.yellowBright("No extensions loaded.\n"));
            }
        } else if (["umt", "umount"].includes(line.toLowerCase().trim())) {
            if (BrsDevice.fileSystem.volumesSync().includes("ext1:")) {
                BrsDevice.umountExtVolume();
                Atomics.store(sharedArray, DataType.EVE, 0);
                process.stdout.write(chalk.greenBright(`\next1: volume unmounted successfully.\n`));
                extPath = "";
            } else {
                process.stdout.write(chalk.yellowBright(`\next1: volume is not mounted.\n`));
            }
        } else if (["mnt", "mount"].includes(line.toLowerCase().trim().split(" ")[0])) {
            const mountPath = line.toLowerCase().trim().split(" ")[1] ?? "";
            if (mountExtVolume(mountPath)) {
                Atomics.store(sharedArray, DataType.EVE, 1);
                extPath = mountPath;
            }
        } else {
            brs.executeLine(line, replInterpreter);
        }
        rl.prompt();
    });
    process.stdout.write(colorize("type `help` to see the list of valid REPL commands.\n"));
    rl.prompt();
}

/**
 * Lists variables in the specified scope from the interpreter.
 * @param scopeName The scope to list variables from: global, module, or function
 * @param interpreter The BrightScript interpreter instance
 */
function listVariables(scopeName: string, interpreter: brs.Interpreter) {
    let scope = 2; // Function scope
    if (scopeName === "global") {
        scope = 0; // Global scope
        process.stdout.write(chalk.cyanBright(`\nGlobal variables:\n\n`));
    } else if (scopeName === "module") {
        scope = 1; // Module scope
        process.stdout.write(chalk.cyanBright(`\nModule variables:\n\n`));
    } else {
        process.stdout.write(chalk.cyanBright(`\nLocal variables:\n\n`));
    }
    const variables = interpreter.formatVariables(scope).trimEnd();
    process.stdout.write(chalk.cyanBright(variables));
    process.stdout.write("\n");
}

/**
 * Mounts the ext1: volume from a directory or zip file.
 * @param mountPath The path to the directory or zip file to mount
 * @returns True if the volume was mounted successfully, false otherwise
 */
function mountExtVolume(mountPath: string) {
    if (BrsDevice.fileSystem.volumesSync().includes("ext1:")) {
        process.stdout.write(chalk.yellowBright(`\next1: volume is already mounted.\n`));
        return false;
    }
    if (!fs.existsSync(mountPath)) {
        process.stdout.write(chalk.redBright(`\nPath to mount ext1: volume not found: "${mountPath}"\n`));
    } else if (mountPath.toLowerCase().endsWith(".zip")) {
        const extZip = new Uint8Array(fs.readFileSync(mountPath)).buffer;
        if (BrsDevice.mountExtVolume(extZip)) {
            process.stdout.write(chalk.greenBright(`\next1: volume mounted successfully from file.\n`));
            return true;
        } else {
            process.stdout.write(chalk.redBright(`\nFailed to mount ext1: volume from file.\n`));
        }
    } else {
        BrsDevice.mountExtPathVolume(mountPath);
        process.stdout.write(chalk.greenBright(`\next1: volume mounted successfully from directory.\n`));
        return true;
    }
    return false;
}

/**
 * Callback function for receiving messages from the packager.
 * Handles error and warning events by displaying them with appropriate colors.
 * @param event - The event type (error, warning, etc.)
 * @param data - The message data to display
 */
function packageCallback(event: string, data: any) {
    if (["error", "warning"].includes(event)) {
        if (event === "error") {
            console.error(chalk.red(data));
        } else {
            console.warn(chalk.yellow(data));
        }
    } else if (event === "mount") {
        Atomics.store(sharedArray, DataType.EVE, data);
    } else if (event === "debug") {
        console.debug(chalk.gray(data));
    }
}

/**
 * Callback function for receiving messages from the interpreter.
 * Handles string messages, ImageData for ASCII/PNG rendering, and registry Map for persistence.
 * @param message - The message from interpreter (string, ImageData, or Map)
 * @param _ - Unused parameter
 */
function messageCallback(message: any, _?: any) {
    if (typeof message === "string") {
        handleStringMessage(message);
    } else if (message instanceof ImageData) {
        lastFrame = message;
        if (program.ascii || program.image) {
            renderFrameToTerminal(message);
        }
    } else if (isGraphicsData(message)) {
        if (program.ecp) {
            brsWorker?.postMessage(message);
        }
    } else if (isRegistryData(message)) {
        if (program.ecp) {
            brsWorker?.postMessage(message.current);
        }
        if (program.registry) {
            const strRegistry = JSON.stringify([...message.current]);
            try {
                if (!fs.existsSync(paths.data)) {
                    fs.mkdirSync(paths.data, { recursive: true });
                }
                fs.writeFileSync(path.resolve(paths.data, "registry.json"), strRegistry);
            } catch (err: any) {
                console.error(chalk.red(err.message));
            }
        }
    }
}

// terminal-image is ESM-only; load it lazily via dynamic import (kept external by webpack).
type TerminalImage = typeof import("terminal-image").default;
let terminalImage: TerminalImage | undefined;
async function getTerminalImage(): Promise<TerminalImage> {
    terminalImage ??= (await import("terminal-image")).default;
    return terminalImage;
}

// The engine gates the frame rate (DeviceInfo.maxFps), so no CLI-side throttling is applied.
// Terminal writes still need flow control: by default a TTY `stdout.write` is synchronous and
// a slow terminal blocks the event loop inside write(2), starving stdin (in raw mode Ctrl+C
// is just a keypress) and the task broker. `enableFrameOutput` switches stdout to
// non-blocking, so a slow terminal surfaces as ordinary backpressure: rendering pauses on
// `write() === false` and resumes on `drain`, dropping to the newest frame meanwhile. A
// terminal that keeps up renders every engine frame.
let pendingFrame: ImageData | undefined;
let frameRenderScheduled = false;
let stdoutCongested = false;
let frameOutputEnabled = false;

/**
 * Makes stdout writes non-blocking for the app run, so terminal-art frames can never
 * block the event loop (a slow terminal becomes backpressure + `drain` instead).
 */
function enableFrameOutput() {
    frameOutputEnabled = true;
    if ((program.ascii || program.image) && process.stdout.isTTY) {
        (process.stdout as any)._handle?.setBlocking?.(false);
    }
}

/**
 * Stops frame rendering (dropping any queued frame — the app is over) and restores
 * blocking stdout writes so post-run output can never be truncated on exit.
 */
function disableFrameOutput() {
    frameOutputEnabled = false;
    pendingFrame = undefined;
    stdoutCongested = false;
    if ((program.ascii || program.image) && process.stdout.isTTY) {
        (process.stdout as any)._handle?.setBlocking?.(true);
    }
}

/**
 * Queues the latest frame for terminal-art rendering on the next event-loop turn,
 * coalescing to the newest frame while a render is pending or stdout is congested.
 * @param frame - The frame received from the interpreter
 */
function renderFrameToTerminal(frame: ImageData) {
    if (!frameOutputEnabled) {
        return;
    }
    pendingFrame = frame;
    if (frameRenderScheduled || stdoutCongested) {
        return;
    }
    frameRenderScheduled = true;
    setImmediate(renderPendingFrame);
}

/**
 * Renders the most recent pending frame on the terminal — ASCII/Unicode art, or an
 * image (terminal-image) with --image — pausing on stdout backpressure until `drain`.
 * The scheduled flag is held for the whole (possibly async) render so frames arriving
 * meanwhile only replace `pendingFrame` and are picked up right after, never in parallel.
 */
async function renderPendingFrame() {
    const frame = pendingFrame;
    pendingFrame = undefined;
    if (!frame || !frameOutputEnabled) {
        frameRenderScheduled = false;
        return;
    }
    const canvas = createCanvas(frame.width, frame.height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(frame, 0, 0);
    let flushed = true;
    if (program.image) {
        // terminal-image renders via the terminal's native graphics protocol
        // (iTerm2/Kitty) when available, falling back to ANSI half-blocks.
        const imageRenderer = await getTerminalImage();
        const rendered = await imageRenderer.buffer(canvas.toBuffer("image/png"), { height: "90%" });
        if (frameOutputEnabled) {
            flushed = process.stdout.write(`\x1b[H${rendered}`);
        }
    } else {
        const columns = typeof program.ascii === "number" && program.ascii > 0 ? program.ascii : maxColumns;
        flushed = program.unicode
            ? printFrame(renderUnicodeFrame(columns, canvas))
            : printFrame(renderAsciiFrame(columns, canvas));
    }
    frameRenderScheduled = false;
    if (!flushed) {
        stdoutCongested = true;
        process.stdout.once("drain", () => {
            stdoutCongested = false;
            if (pendingFrame && !frameRenderScheduled) {
                frameRenderScheduled = true;
                setImmediate(renderPendingFrame);
            }
        });
    } else if (pendingFrame) {
        // A newer frame arrived while this one was rendering (async image encode).
        frameRenderScheduled = true;
        setImmediate(renderPendingFrame);
    }
}

/**
 * Saves the current screen frame as a PNG image file.
 * Triggered by the Ctrl+S shortcut when the `--snapshot` option is enabled.
 */
function saveScreenshot() {
    if (!lastFrame) {
        console.warn(chalk.yellow("No frame was rendered by the app yet, no image saved."));
        return;
    }
    let filePath = typeof program.snapshot === "string" ? program.snapshot : "";
    if (filePath === "") {
        const appName = appFileName === "" ? "screen" : path.parse(appFileName).name;
        filePath = `${appName}.png`;
    } else if (path.extname(filePath).toLowerCase() !== ".png") {
        filePath += ".png";
    }
    try {
        const canvas = createCanvas(lastFrame.width, lastFrame.height);
        canvas.getContext("2d").putImageData(lastFrame, 0, 0);
        fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
        console.log(chalk.blueBright(`Screenshot saved as ${path.resolve(filePath)}\n`));
    } catch (err: any) {
        console.error(chalk.red(`Error saving the image ${filePath}: ${err.message}`));
    }
}

/**
 * Parses and displays string messages from the interpreter.
 * Message format: "type,content" where type is print, warning, error, end, etc.
 * @param message - The message string to parse and display
 */
function handleStringMessage(message: string) {
    const mType = message.split(",")[0];
    const msg = message.slice(mType.length + 1);
    if (mType === "print" && msg.endsWith(DebugPrompt)) {
        process.stdout.write(msg);
    } else if (mType === "print") {
        process.stdout.write(colorize(msg));
    } else if (mType === "warning") {
        console.warn(chalk.yellow(msg.trimEnd()));
    } else if (mType === "error") {
        console.error(chalk.red(msg.trimEnd()));
        process.exitCode = 1;
    } else if (mType === "debug") {
        console.debug(chalk.gray(msg.trimEnd()));
    } else if (mType === "end" && msg.trimEnd() !== AppExitReason.UserNav) {
        process.exitCode = 1;
    } else if (!["start", "command", "reset", "video", "audio", "syslog", "end"].includes(mType)) {
        console.info(chalk.blueBright(message.trimEnd()));
    }
}

/**
 * Applies color formatting to console messages using chalk.
 * Highlights keywords, numbers, emails, URLs, and quoted strings with different colors.
 * @param log - The log message to colorize
 * @returns The colorized string with ANSI color codes
 */
function colorize(log: string) {
    return log
        .replaceAll(/\b(down|error|errors|failure|fail|fatal|false)(:|\b)/gi, chalk.red("$1$2"))
        .replaceAll(/\b(warning|warn|test|null|undefined|invalid)(:|\b)/gi, chalk.yellow("$1$2"))
        .replaceAll(/\b(help|hint|info|information|true|log)(:|\b)/gi, chalk.cyan("$1$2"))
        .replaceAll(/\b(running|success|successfully|valid)(:|\b)/gi, chalk.green("$1$2"))
        .replaceAll(/\b(debug|roku|brs|brightscript)(:|\b)/gi, chalk.magenta("$1$2"))
        .replaceAll(/(\b\d+\.?\d*?\b)/g, chalk.ansi256(122)(`$1`)) // Numeric
        .replaceAll(/\S+@\S+\.\S+/g, (match: string) => {
            return chalk.blueBright(stripAnsi(match)); // E-Mail
        })
        .replaceAll(/\b([a-z]+):\/{1,2}[^\/].*/gi, (match: string) => {
            return chalk.blue.underline(stripAnsi(match)); // URL
        })
        .replaceAll(/<(.*?)>/g, (match: string) => {
            return chalk.greenBright(stripAnsi(match)); // Delimiters < >
        })
        .replaceAll(/"(.*?)"/g, (match: string) => {
            return chalk.ansi256(222)(stripAnsi(match)); // Quotes
        });
}

/**
 * Display the help message on the console.
 */
function printHelp() {
    let helpMsg = "\r\n";
    helpMsg += "REPL Command List:\r\n";
    helpMsg += "   print|?           Print variable value or expression\r\n";
    helpMsg += "   var|vars [scope]  Display variables and their types/values\r\n";
    helpMsg += "   vol|vols          Display file system mounted volumes\r\n";
    helpMsg += "   mnt|mount <path>  Mount ext1: volume from directory or zip file\r\n";
    helpMsg += "   umt|umount        Unmount ext1: volume\r\n";
    helpMsg += "   xt|ext            Display loaded extensions\r\n";
    helpMsg += "   help|hint         Show this REPL command list\r\n";
    helpMsg += "   clear|cls         Clear terminal screen\r\n";
    helpMsg += "   exit|quit|q       Terminate REPL session\r\n\r\n";
    helpMsg += "   Type any valid BrightScript expression for a live compile and run.\r\n";
    process.stdout.write(chalk.cyanBright(helpMsg));
}
