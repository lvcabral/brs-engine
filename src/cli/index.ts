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
import { deviceData, loadAppZip, updateAppZip, subscribePackage, mountExt, setupDeepLink } from "../api/package";
import { isNumber } from "../api/util";
import { debugPrompt, dataBufferIndex, dataBufferSize, AppPayload, AppExitReason, AppData } from "../core/common";
import packageInfo from "../../packages/node/package.json";
// @ts-ignore
import * as brs from "./brs.node.js";

// Constants
const program = new Command();
const paths = envPaths("brs", { suffix: "cli" });
const defaultLevel = chalk.level;
const maxColumns = Math.max(process.stdout.columns, 32);
const length = dataBufferIndex + dataBufferSize;

// Variables
let appFileName = "";
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
    .option("-p, --pack <password>", "The password to generate the encrypted package.", "")
    .option("-o, --out <directory>", "The directory to save the encrypted package file.", "./")
    .option("-r, --root <directory>", "The root directory from which `pkg:` paths will be resolved.")
    .option("-x, --ext-root <directory>", "The root directory from which `ext1:` paths will be resolved.")
    .option("-f, --ext-file <file>", "The zip file to mount as `ext1:` volume. (takes precedence over -x)")
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
            deviceData.stopOnCrash = program.debug ?? false;
            if (program.registry) {
                deviceData.registry = getRegistry();
            }
            deviceData.appList = new Array<AppData>();
        }
        subscribePackage("cli", packageCallback);
        brs.registerCallback(messageCallback, sharedBuffer);
        if (brsFiles.length > 0) {
            runAppFiles(brsFiles);
        } else {
            displayTitle();
            repl();
        }
    })
    .version(packageInfo.version, "-v, --version")
    .parse(process.argv);

/**
 * Check the CLI parameters and set the default values.
 *  @returns true if the parameters are valid, false otherwise.
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
    if (program.extRoot && !fs.existsSync(program.extRoot)) {
        console.error(chalk.red(`External storage path not found: ${program.extRoot}\n`));
        process.exitCode = 1;
        return;
    }
    if (program.extFile && !fs.existsSync(program.extFile)) {
        console.error(chalk.red(`External storage file not found: ${program.extFile}\n`));
        process.exitCode = 1;
        return;
    }
    return process.exitCode !== 1;
}

/**
 * Run the BrightScript files or the App package file.
 * @param files the list of files to run.
 */
function runAppFiles(files: string[]) {
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
            }
            if (program.extFile) {
                mountExt(new Uint8Array(fs.readFileSync(program.extFile)).buffer);
            }
            setupDeepLink(processDeepLink());
            const fileData = new Uint8Array(fs.readFileSync(filePath)).buffer;
            deviceData.entryPoint = true;
            loadAppZip(fileName, fileData, runApp);
            return;
        }
        // Run BrightScript files
        deviceData.appList?.push({ id: "dev", title: fileName, version: "1.0.0" });
        const payload = brs.createPayloadFromFiles(
            files,
            deviceData,
            processDeepLink(),
            program.root,
            program.extFile ?? program.extRoot
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
 * Display the CLI application title on the console
 *
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
 * Execute the app payload or generate an encrypted app package
 * if a password is passed with parameter --pack.
 *
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
        if (pkg.exitReason === AppExitReason.PACKAGED) {
            // Generate the Encrypted App Package
            const filePath = path.join(program.out, appFileName.replace(/.zip/gi, ".bpk"));
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
            if (pkg.exitReason === AppExitReason.FINISHED) {
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

/** Get the computer local Ips
 * @returns an Array of IPs
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
 * Get the Registry data from disk
 * @returns the Map containing the persisted registry content
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
 * Launches an interactive read-execute-print loop, which reads input from
 * `stdin` and executes it.
 *
 * **NOTE:** Currently limited to single-line inputs :(
 */
async function repl() {
    const replInterpreter = await brs.getReplInterpreter({
        device: deviceData,
        extZip: program.extFile ? new Uint8Array(fs.readFileSync(program.extFile)).buffer : undefined,
        root: program.root,
        ext: program.extRoot,
    });
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt(`\n${chalk.magenta("brs")}> `);
    rl.on("line", (line) => {
        if (["exit", "quit", "q"].includes(line.toLowerCase().trim())) {
            process.exit();
        } else if (["cls", "clear"].includes(line.toLowerCase().trim())) {
            process.stdout.write("\x1Bc");
        } else if (["help", "hint"].includes(line.toLowerCase().trim())) {
            printHelp();
        } else if (["vol", "vols"].includes(line.toLowerCase().trim())) {
            process.stdout.write(chalk.cyanBright(`\nMounted volumes:\n\n`));
            const rootPath = replInterpreter.options.root ?? "not mounted";
            process.stdout.write(chalk.cyanBright(`pkg:      ${rootPath}\n`));
            const extPath = program.extFile ?? replInterpreter.options.ext ?? "not mounted";
            process.stdout.write(chalk.cyanBright(`ext1:     ${extPath}\n`));
            process.stdout.write(chalk.cyanBright(`tmp:      [In Memory]\n`));
            process.stdout.write(chalk.cyanBright(`cachefs:  [In Memory]\n`));
            process.stdout.write(chalk.cyanBright(`common:   [In Memory]\n`));
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
        } else {
            brs.executeLine(line, replInterpreter);
        }
        rl.prompt();
    });
    process.stdout.write(colorize("type `help` to see the list of valid REPL commands.\n"));
    rl.prompt();
}

/**
 * Callback function to receive the messages from the packager.
 *
 */
function packageCallback(event: string, data: any) {
    if (["error", "warning"].includes(event)) {
        if (event === "error") {
            console.error(chalk.red(data));
        } else {
            console.warn(chalk.yellow(data));
        }
    }
}

/**
 * Callback function to receive the messages from the Interpreter.
 *
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
    } else if (message instanceof Map) {
        if (program.ecp) {
            brsWorker?.postMessage(message);
        }
        if (program.registry) {
            const strRegistry = JSON.stringify([...message]);
            try {
                if (!fs.existsSync(paths.data)) {
                    fs.mkdirSync(paths.data, { recursive: true });
                }
                fs.writeFileSync(path.resolve(paths.data, "registry.json"), strRegistry);
                console.log(paths.data, "registry.json");
            } catch (err: any) {
                console.error(chalk.red(err.message));
            }
        }
    }
}

/**
 * Handles String Callback messages
 * @param message the message to parse and display
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
    } else if (mType === "end" && msg.trimEnd() !== AppExitReason.FINISHED) {
        process.exitCode = 1;
    } else if (!["start", "debug", "reset", "video", "audio", "syslog", "end"].includes(mType)) {
        console.info(chalk.blueBright(message.trimEnd()));
    }
}

/**
 * Colorizes the console messages.
 *
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
    helpMsg += "   help|hint         Show this REPL command list\r\n";
    helpMsg += "   clear|cls         Clear terminal screen\r\n";
    helpMsg += "   exit|quit|q       Terminate REPL session\r\n\r\n";
    helpMsg += "   Type any valid BrightScript expression for a live compile and run.\r\n";
    process.stdout.write(chalk.cyanBright(helpMsg));
}

/**
 * Prints the ASCII screen on the console.
 * @param columns the number of columns to print the ASCII screen.
 * @param image the Canvas object with the screen image.
 * Code adapted from: https://github.com/victorqribeiro/imgToAscii
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
