#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Command } from "commander";
import chalk, { ColorSupportLevel } from "chalk";
import stripAnsi from "strip-ansi";
import * as fs from "fs";
import * as path from "path";
import readline from "readline";
import { deviceData, loadAppZip, updateAppZip, subscribePackage } from "../api/package";
import { registerCallback, getInterpreter, executeLine, executeFile } from "../worker";
import packageInfo from "../../package.json";
import { PrimitiveKinds, ValueKind, isIterable } from "../worker/brsTypes";
import { Environment, Scope } from "../worker/interpreter/Environment";

const program = new Command();
const defaultLevel = chalk.level.toString();
let zipFileName = "";

/**
 * CLI program, params definition and action processing.
 *
 */
program
    .description(`${packageInfo.description} CLI`)
    .arguments(`brs-cli [brsFiles...]`)
    .option("-p, --pack <password>", "The password to generate the encrypted package.", "")
    .option("-o, --out <directory>", "The directory to save the encrypted package file.", "./")
    .option(
        "-c, --colors <color-level>",
        "Define the console color level (0 disable colors).",
        defaultLevel
    )
    .action(async (brsFiles, program) => {
        if (program.colors.length === 1 && program.colors.match(/[0-3]/)?.length) {
            chalk.level = Number(program.colors) as ColorSupportLevel;
        } else {
            console.warn(
                chalk.yellow(
                    `Invalid color level! Valid levels are 0-3, keeping the default: ${defaultLevel}`
                )
            );
        }
        subscribePackage("cli", packageCallback);
        registerCallback(messageCallback);
        if (brsFiles.length > 0) {
            try {
                // Run App Zip file
                const filePath = brsFiles[0];
                const fileName = filePath.split(/.*[/|\\]/)[1] ?? filePath;
                const fileExt = fileName.split(".").pop()?.toLowerCase();
                zipFileName = "";
                if (fileExt === "zip" || fileExt === "bpk") {
                    showAppTitle();
                    if (program.pack.length > 0 && fileExt === "zip") {
                        console.log(chalk.blueBright(`Packaging ${filePath}...\n`));
                    } else {
                        console.log(chalk.blueBright(`Executing ${filePath}...\n`));
                    }
                    zipFileName = fileName;
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
            const sourceCode = fs.readFileSync(filePath);
            if (sourceCode) {
                source.push(sourceCode.toString());
                paths.push({ url: `source/${fileName}`, id: id, type: "source" });
                id++;
            }
        }
    });
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
}

/**
 * Execute the app payload or generate an encrypted app package
 * if a password is passed with parameter --pack.
 *
 */
function runApp(payload: any) {
    const fontPath = "../app/fonts";
    const fontFamily = payload.device.defaultFont;
    payload.device.fonts.set(
        "regular",
        fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Regular.ttf`))
    );
    payload.device.fonts.set(
        "bold",
        fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Bold.ttf`))
    );
    payload.device.fonts.set(
        "italic",
        fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Italic.ttf`))
    );
    payload.device.fonts.set(
        "bold-italic",
        fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-BoldItalic.ttf`))
    );
    payload.password = program.pack;
    const pkg = executeFile(payload);
    if (pkg?.cipherText instanceof Uint8Array && pkg.iv) {
        const filePath = path.join(program.out, zipFileName.replace(/.zip/gi, ".bpk"));
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
    }
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
        if (["quit", "exit"].includes(line.toLowerCase().trim())) {
            process.exit();
        } else if (["cls", "clear"].includes(line.toLowerCase().trim())) {
            process.stdout.write("\x1Bc");
        } else if (["help", "hint"].includes(line.toLowerCase().trim())) {
            showHelp();
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
            console.log(colorize(message.slice(6).trimEnd()));
        } else if (mType === "warning") {
            console.warn(chalk.yellow(message.slice(8).trimEnd()));
        } else if (mType === "error") {
            console.error(chalk.red(message.slice(6).trimEnd()));
            process.exitCode = 1;
        } else if (mType === "end") {
            const msg = message.slice(mType.length + 1).trimEnd();
            if (msg !== "EXIT_USER_NAV") {
                console.info(chalk.redBright(msg));
                process.exitCode = 1;
            }
        } else if (mType !== "start") {
            console.info(chalk.blueBright(message.trimEnd()));
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
function showHelp() {
    let helpMsg = "\r\n";
    helpMsg += "REPL Command List:\r\n";
    helpMsg += "   print|?         Print variable value or expression\r\n";
    helpMsg += "   var|vars        Display variables and their types/values\r\n";
    helpMsg += "   help|hint       Show this REPL command list\r\n";
    helpMsg += "   clear|cls       Clear terminal screen\r\n";
    helpMsg += "   quit|exit       Terminate REPL session\r\n\r\n";
    helpMsg += "   Type any valid BrightScript expression for a live compile and run.\r\n";
    console.log(chalk.cyanBright(helpMsg));
}

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
