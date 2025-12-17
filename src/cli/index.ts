#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
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
import { Canvas, ImageData, createCanvas } from "canvas";
import chalk from "chalk";
import { Command } from "commander";
import stripAnsi from "strip-ansi";
import { deviceData, loadAppZip, updateAppZip, subscribePackage, mountExt, setupDeepLink } from "./package";
import { isNumber } from "../api/util";
import {
    debugPrompt,
    dataBufferIndex,
    dataBufferSize,
    AppPayload,
    AppExitReason,
    AppData,
    SupportedExtension,
    isRegistryData,
    ExtensionInfo,
    DataType,
} from "../core/common";
import SharedObject from "../core/SharedObject";
import packageInfo from "../../packages/node/package.json";
// @ts-ignore
import * as brs from "./brs.node.js";

// Constants
declare const __non_webpack_require__: NodeJS.Require;
const loadModule = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
const program = new Command();
const paths = envPaths("brs", { suffix: "cli" });
const defaultLevel = chalk.level;
const maxColumns = Math.max(process.stdout.columns, 32);
const length = dataBufferIndex + dataBufferSize;

// Variables
let appFileName = "";
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
    .option("-c, --colors <level>", "Define the console color level (0 to disable).", defaultLevel)
    .option("-d, --debug", "Open the micro debugger if the app crashes.", false)
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
            loadAppZip(fileName, fileData, runApp);
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
        const pkg = await brs.executeFile(payload);
        if (program.ecp) {
            brsWorker?.terminate();
        }
        if (pkg.exitReason === AppExitReason.Packaged) {
            // Generate the Encrypted App Package
            const filePath = path.join(program.out, appFileName.replaceAll(/.zip/gi, ".bpk"));
            try {
                const buffer = updateAppZip(pkg.cipherText, pkg.iv);
                fs.writeFileSync(filePath, buffer);
                console.log(
                    chalk.blueBright(
                        `Package file created as ${filePath} with ${Math.round(buffer.length / 1024)} KB.\n`
                    )
                );
            } catch (err: any) {
                console.error(chalk.red(`Error generating the file ${filePath}: ${err.message}`));
                process.exitCode = 1;
            }
        } else {
            const msg = `------ Finished '${appFileName}' execution [${pkg.exitReason}] ------\n`;
            if (pkg.exitReason === AppExitReason.UserNav) {
                console.log(chalk.blueBright(msg));
            } else {
                process.exitCode = 1;
                console.log(chalk.redBright(msg));
            }
        }
    } catch (err: any) {
        console.error(chalk.red(`Error executing app: ${err.message}`));
        process.exitCode = 1;
    }
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
    const brsFS = brs.BrsDevice.fileSystem;
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
            const extObj = new SharedObject(32 * 1024, 32 * 1024 * 1024);
            extObj.storeData(new Uint8Array(fs.readFileSync(program.extVol)).buffer);
            payload.extZip = extObj.getBuffer();
            extPath = program.extVol;
        }
    }
    const replInterpreter = await brs.getReplInterpreter(payload);
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
            const vols = brs.BrsDevice.fileSystem.volumesSync();
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
            const variables = replInterpreter.formatVariables(scope).trimEnd();
            process.stdout.write(chalk.cyanBright(variables));
            process.stdout.write("\n");
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
            if (brsFS.volumesSync().includes("ext1:")) {
                brs.BrsDevice.umountExtVolume();
                Atomics.store(sharedArray, DataType.EVE, 0);
                process.stdout.write(chalk.greenBright(`\next1: volume unmounted successfully.\n`));
                extPath = "";
            } else {
                process.stdout.write(chalk.yellowBright(`\next1: volume is not mounted.\n`));
            }
        } else if (["mnt", "mount"].includes(line.toLowerCase().trim().split(" ")[0])) {
            const mountPath = line.toLowerCase().trim().split(" ")[1] ?? "";
            if (await mountExtVolume(mountPath)) {
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

async function mountExtVolume(mountPath: string) {
    const brsFS = brs.BrsDevice.fileSystem;
    if (!brsFS.volumesSync().includes("ext1:")) {
        if (!fs.existsSync(mountPath)) {
            process.stdout.write(chalk.redBright(`\nPath to mount ext1: volume not found: ${mountPath}'\n`));
        } else if (mountPath.toLowerCase().endsWith(".zip")) {
            const extZip = new Uint8Array(fs.readFileSync(mountPath)).buffer;
            if (await brs.BrsDevice.mountExtVolume(extZip)) {
                process.stdout.write(chalk.greenBright(`\next1: volume mounted successfully from file.\n`));
                return true;
            } else {
                process.stdout.write(chalk.redBright(`\nFailed to mount ext1: volume from file.\n`));
            }
        } else {
            brsFS.setExt(mountPath);
            process.stdout.write(chalk.greenBright(`\next1: volume mounted successfully from directory.\n`));
            return true;
        }
    } else {
        process.stdout.write(chalk.yellowBright(`\next1: volume is already mounted.\n`));
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
 * Handles string messages, ImageData for ASCII rendering, and registry Map for persistence.
 * @param message - The message from interpreter (string, ImageData, or Map)
 * @param _ - Unused parameter
 */
function messageCallback(message: any, _?: any) {
    if (typeof message === "string") {
        handleStringMessage(message);
    } else if (program.ascii && message instanceof ImageData) {
        const canvas = createCanvas(message.width, message.height);
        const ctx = canvas.getContext("2d");
        canvas.width = message.width;
        canvas.height = message.height;
        ctx.putImageData(message, 0, 0);
        printAsciiScreen(program.ascii, canvas);
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

/**
 * Parses and displays string messages from the interpreter.
 * Message format: "type,content" where type is print, warning, error, end, etc.
 * @param message - The message string to parse and display
 */
function handleStringMessage(message: string) {
    const mType = message.split(",")[0];
    const msg = message.slice(mType.length + 1);
    if (mType === "print" && msg.endsWith(debugPrompt)) {
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
        .replace(/\b(down|error|errors|failure|fail|fatal|false)(:|\b)/gi, chalk.red("$1$2"))
        .replace(/\b(warning|warn|test|null|undefined|invalid)(:|\b)/gi, chalk.yellow("$1$2"))
        .replace(/\b(help|hint|info|information|true|log)(:|\b)/gi, chalk.cyan("$1$2"))
        .replace(/\b(running|success|successfully|valid)(:|\b)/gi, chalk.green("$1$2"))
        .replace(/\b(debug|roku|brs|brightscript)(:|\b)/gi, chalk.magenta("$1$2"))
        .replace(/(\b\d+\.?\d*?\b)/g, chalk.ansi256(122)(`$1`)) // Numeric
        .replace(/\S+@\S+\.\S+/g, (match: string) => {
            return chalk.blueBright(stripAnsi(match)); // E-Mail
        })
        .replace(/\b([a-z]+):\/{1,2}[^\/].*/gi, (match: string) => {
            return chalk.blue.underline(stripAnsi(match)); // URL
        })
        .replace(/<(.*?)>/g, (match: string) => {
            return chalk.greenBright(stripAnsi(match)); // Delimiters < >
        })
        .replace(/"(.*?)"/g, (match: string) => {
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

/**
 * Converts and prints an image as ASCII art on the console.
 * Uses grayscale values to map pixels to ASCII characters.
 * @param columns - The number of columns for ASCII output
 * @param image - The Canvas object containing the screen image
 * @remarks Code adapted from: https://github.com/victorqribeiro/imgToAscii
 */
function printAsciiScreen(columns: number, image: Canvas) {
    const alphabet = ["@", "%", "#", "*", "+", "=", "-", ":", ".", " "];
    const ratio = (image.width / image.height) * 1.7;
    let string = "";
    let stringColor = "";
    let cols = Math.min(columns, maxColumns);
    let lines = Math.trunc(cols / ratio);
    const canvas = createCanvas(cols, lines);
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let grayStep = Math.ceil(255 / alphabet.length);
        for (let i = 0; i < imageData.data.length; i += 4) {
            for (let j = 0; j < alphabet.length; j++) {
                let r = imageData.data[i];
                let g = imageData.data[i + 1];
                let b = imageData.data[i + 2];
                if (r * 0.2126 + g * 0.7152 + b * 0.0722 < (j + 1) * grayStep) {
                    const char = alphabet[j];
                    string += char;
                    stringColor += chalk.rgb(r, g, b)(char);
                    break;
                }
            }
            if (!((i / 4 + 1) % canvas.width)) {
                string += "\n";
                stringColor += "\n";
            }
        }
        process.stdout.write(`\x1b[H\u001B[?25l${program.colors ? stringColor : string}`);
        process.stdout.write(`\u001B[?25h`); // show cursor
    }
}
