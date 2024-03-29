#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import envPaths from "env-paths";
import { Canvas, ImageData, createCanvas } from "canvas";
import chalk, { ColorSupportLevel } from "chalk";
import { Command } from "commander";
import stripAnsi from "strip-ansi";
import readline from "readline";
import {
    deviceData,
    loadAppZip,
    updateAppZip,
    subscribePackage,
    getSerialNumber,
} from "../api/package";
import { isNumber } from "../api/util";
import { registerCallback, getInterpreter, executeLine, executeFile } from "../worker";
import { debugPrompt, dataBufferIndex, dataBufferSize } from "../worker/enums";
import { PrimitiveKinds, ValueKind, isIterable } from "../worker/brsTypes";
import { Environment, Scope } from "../worker/interpreter/Environment";
import packageInfo from "../../package.json";

// Constants
const program = new Command();
const paths = envPaths("brs", { suffix: "cli" });
const defaultLevel = chalk.level;
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
    .description(`${packageInfo.description} CLI`)
    .arguments(`brs-cli [brsFiles...]`)
    .option("-a, --ascii <columns>", "Enable ASCII screen mode passing the width in columns.", 0)
    .option("-c, --colors <level>", "Define the console color level (0 to disable).", defaultLevel)
    .option("-d, --debug", "Open the micro debugger if the app crashes.", false)
    .option("-e, --ecp", "Enable the ECP server for control simulation.", false)
    .option("-r, --registry", "Persist the simulated device registry on disk.", false)
    .option("-p, --pack <password>", "The password to generate the encrypted package.", "")
    .option("-o, --out <directory>", "The directory to save the encrypted package file.", "./")
    .action(async (brsFiles, program) => {
        if (isNumber(program.colors) && program.colors >= 0 && program.colors <= 3) {
            chalk.level = Math.trunc(program.colors) as ColorSupportLevel;
        } else {
            console.warn(
                chalk.yellow(
                    `Invalid color level! Valid range is 0-3, keeping default: ${defaultLevel}.`
                )
            );
        }
        if (
            !isNumber(program.ascii) ||
            program.ascii < 0 ||
            (program.ascii > 0 && program.ascii < 10)
        ) {
            program.ascii = 0;
            console.warn(
                chalk.yellow(`Invalid # of columns! Valid values are 10+, ASCII mode disabled.`)
            );
        }
        if (typeof deviceData === "object") {
            deviceData.fonts = getFonts(deviceData.defaultFont);
            deviceData.deviceModel = "4400X";
            deviceData.customFeatures.push("ascii_rendering");
            deviceData.localIps = getLocalIps();
            if (program.registry) {
                deviceData.registry = getRegistry();
            }
        }
        subscribePackage("cli", packageCallback);
        registerCallback(messageCallback, sharedBuffer);
        if (brsFiles.length > 0) {
            try {
                // Run App Zip file
                const filePath = brsFiles[0];
                const fileName = filePath.split(/.*[/|\\]/)[1] ?? filePath;
                const fileExt = fileName.split(".").pop()?.toLowerCase();
                appFileName = "";
                if (fileExt === "zip" || fileExt === "bpk") {
                    showAppTitle();
                    if (program.pack.length > 0 && fileExt === "zip") {
                        console.log(chalk.blueBright(`Packaging ${filePath}...\n`));
                    } else {
                        console.log(chalk.blueBright(`Executing ${filePath}...\n`));
                    }
                    appFileName = fileName;
                    loadAppZip(fileName, fs.readFileSync(filePath), runApp);
                    return;
                }
                runBrsFiles(brsFiles);
            } catch (err: any) {
                if (err.messages?.length) {
                    err.messages.forEach((message: string) => console.error(chalk.red(message)));
                } else {
                    console.error(chalk.red(err.message));
                }
                process.exitCode = 1;
            }
        } else {
            showAppTitle();
            repl();
        }
    })
    .version(packageInfo.version, "-v, --version")
    .parse(process.argv);

/**
 * Display the CLI application title on the console
 *
 */
function showAppTitle() {
    const appTitle = `${packageInfo.description} CLI`;
    const appVersion = `v${packageInfo.version}`;
    /// #if DEBUG
    console.log(`\n${appTitle} [${chalk.cyanBright(appVersion)} ${chalk.gray("dev")}]\n`);
    /// #else
    console.log(`\n${appTitle} [${chalk.cyanBright(appVersion)}]\n`);
    /// #endif
}

/**
 * Execute the a list of Brs files passed via
 * the command line.
 *
 */
function runBrsFiles(files: any[]) {
    // Run list of Brs files
    const paths: Object[] = [];
    const source: string[] = [];
    let id = 0;
    files.map((filePath) => {
        const fileName = filePath.split(/.*[/|\\]/)[1] ?? filePath;
        const fileExt = fileName.split(".").pop();
        if (fileExt?.toLowerCase() === "brs") {
            if (appFileName === "") {
                appFileName = fileName;
            }
            try {
                const sourceCode = fs.readFileSync(filePath);
                if (sourceCode) {
                    source.push(sourceCode.toString());
                    paths.push({ url: `source/${fileName}`, id: id, type: "source" });
                    id++;
                }
            } catch (err: any) {
                console.error(chalk.red(err.message));
            }
        }
    });
    if (id > 0) {
        const payload = {
            device: deviceData,
            manifest: new Map(),
            input: [],
            paths: paths,
            brs: source,
            texts: [],
            binaries: [],
            entryPoint: false,
            stopOnCrash: false,
        };
        runApp(payload);
    } else {
        console.error(chalk.red("Invalid or inexistent file(s)!"));
    }
}

/**
 * Execute the app payload or generate an encrypted app package
 * if a password is passed with parameter --pack.
 *
 */
function runApp(payload: any) {
    payload.stopOnCrash = program.debug ?? false;
    payload.password = program.pack;
    if (program.ecp && !workerReady) {
        const workerPath = path.join(__dirname, "brs.ecp.js");
        const workerData = { device: { ...deviceData, serialNumber: getSerialNumber() } };
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
    const pkg = executeFile(payload);
    if (program.ecp) {
        brsWorker?.terminate();
    }
    if (pkg?.cipherText instanceof Uint8Array && pkg.iv) {
        const filePath = path.join(program.out, appFileName.replace(/.zip/gi, ".bpk"));
        try {
            const buffer = updateAppZip(pkg.cipherText, pkg.iv);
            fs.writeFileSync(filePath, buffer);
            console.log(
                chalk.blueBright(
                    `Package file created as ${filePath} with ${Math.round(
                        buffer.length / 1024
                    )} KB.\n`
                )
            );
        } catch (err: any) {
            console.error(chalk.red(`Error generating the file ${filePath}: ${err.message}`));
            process.exitCode = 1;
        }
    } else if (pkg?.endReason) {
        const msg = `------ Finished '${appFileName}' execution [${pkg.endReason}] ------\n`;
        if (pkg.endReason === "EXIT_USER_NAV") {
            console.log(chalk.blueBright(msg));
        } else {
            console.log(chalk.redBright(msg));
        }
    }
}

/**
 * Get the fonts map for the device.
 * @param fontFamily a string with the font family name.
 * @returns a Map with the fonts.
 */

function getFonts(fontFamily: string) {
    const fonts = new Map();
    const fontsPath = path.join(__dirname, "../app/fonts", `${fontFamily}`);
    fonts.set("regular", fs.readFileSync(`${fontsPath}-Regular.ttf`));
    fonts.set("bold", fs.readFileSync(`${fontsPath}-Bold.ttf`));
    fonts.set("italic", fs.readFileSync(`${fontsPath}-Italic.ttf`));
    fonts.set("bold-italic", fs.readFileSync(`${fontsPath}-BoldItalic.ttf`));
    return fonts;
}

/** Get the computer local Ips
 * @returns an Array of IPs
 */
function getLocalIps() {
    const ifaces = os.networkInterfaces();
    const ips = new Array<string>();
    Object.keys(ifaces).forEach(function (ifname) {
        let alias = 0;
        ifaces[ifname]?.forEach(function (iface) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                ips.push(`${ifname}:${alias},${iface.address}`);
            } else {
                // this interface has only one ipv4 address
                ips.push(`${ifname},${iface.address}`);
            }
            ++alias;
        });
    });
    return ips;
}

/**
 * Get the Registry data from disk
 * @returns the Map containing the persisted registry content
 */
function getRegistry() {
    try {
        const strRegistry = fs.readFileSync(path.resolve(paths.data, "registry.json"));
        if (strRegistry?.length) {
            return new Map(JSON.parse(strRegistry.toString()));
        }
    } catch (err: any) {
        console.error(chalk.red(err.message));
    }
    return new Map<string, string>();
}

/**
 * Launches an interactive read-execute-print loop, which reads input from
 * `stdin` and executes it.
 *
 * **NOTE:** Currently limited to single-line inputs :(
 */
function repl() {
    const replInterpreter = getInterpreter({ device: deviceData });
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt(`${chalk.magenta("brs")}> `);
    rl.on("line", (line) => {
        if (["exit", "quit", "q"].includes(line.toLowerCase().trim())) {
            process.exit();
        } else if (["cls", "clear"].includes(line.toLowerCase().trim())) {
            process.stdout.write("\x1Bc");
        } else if (["help", "hint"].includes(line.toLowerCase().trim())) {
            printHelp();
        } else if (["var", "vars"].includes(line.toLowerCase().trim())) {
            printLocalVariables(replInterpreter.environment);
        } else {
            executeLine(line, replInterpreter);
        }
        rl.prompt();
    });
    console.log(colorize("type `help` to see the list of valid REPL commands.\r\n"));
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
        const mType = message.split(",")[0];
        if (mType === "print") {
            let log = message.slice(6);
            if (log.endsWith(debugPrompt)) {
                process.stdout.write(log);
            } else {
                console.log(colorize(log.trimEnd()));
            }
        } else if (mType === "warning") {
            console.warn(chalk.yellow(message.slice(8).trimEnd()));
        } else if (mType === "error") {
            console.error(chalk.red(message.slice(6).trimEnd()));
            process.exitCode = 1;
        } else if (mType === "end") {
            const msg = message.slice(mType.length + 1).trimEnd();
            if (msg !== "EXIT_USER_NAV") {
                process.exitCode = 1;
            }
        } else if (!["start", "debug", "reset", "video", "audio"].includes(mType)) {
            console.info(chalk.blueBright(message.trimEnd()));
        }
    } else if (program.ascii && message instanceof ImageData) {
        const canvas = createCanvas(message.width, message.height);
        const ctx = canvas.getContext("2d");
        canvas.width = message.width;
        canvas.height = message.height;
        ctx.putImageData(message, 0, 0);
        printAsciiScreen(program.ascii, canvas);
    } else if (program.ecp && message instanceof Map) {
        brsWorker?.postMessage(message);
        if (program.registry) {
            const strRegistry = JSON.stringify([...message]);
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
        .replace(/\b([a-z])+:((\/\/)|((\/\/)?(\S)))+/gi, (match: string) => {
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
    helpMsg += "   print|?         Print variable value or expression\r\n";
    helpMsg += "   var|vars        Display variables and their types/values\r\n";
    helpMsg += "   help|hint       Show this REPL command list\r\n";
    helpMsg += "   clear|cls       Clear terminal screen\r\n";
    helpMsg += "   exit|quit|q     Terminate REPL session\r\n\r\n";
    helpMsg += "   Type any valid BrightScript expression for a live compile and run.\r\n";
    console.log(chalk.cyanBright(helpMsg));
}

/**
 * Display the local variables on the console.
 * @param environment an object with the Interpreter Environment data
 */
function printLocalVariables(environment: Environment) {
    let debugMsg = "\r\nLocal variables:\r\n";
    debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
        environment.getM().getElements().length
    }\r\n`;
    let fnc = environment.getList(Scope.Function);
    fnc.forEach((value, key) => {
        if (PrimitiveKinds.has(value.kind)) {
            debugMsg += `${key.padEnd(16)} ${ValueKind.toString(
                value.kind
            )} val:${value.toString()}\r\n`;
        } else if (isIterable(value)) {
            debugMsg += `${key.padEnd(16)} ${value.getComponentName()} count:${
                value.getElements().length
            }\r\n`;
        } else if (value.kind === ValueKind.Object) {
            debugMsg += `${key.padEnd(17)}${value.getComponentName()}\r\n`;
        } else {
            debugMsg += `${key.padEnd(17)}${value.toString()}\r\n`;
        }
    });
    console.log(chalk.cyanBright(debugMsg));
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
    let cols = columns * 1;
    let lines = Math.trunc(cols / ratio);
    const canvas = createCanvas(cols, lines);
    const context = canvas.getContext("2d");
    if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
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
