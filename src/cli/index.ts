#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Command } from "commander";
import chalk, { ColorSupportLevel } from "chalk";
import stripAnsi from "strip-ansi";
import * as fs from "fs";
import * as path from "path";
import readline from "readline";
import * as brsLib from "../";
const program = new Command();
import { deviceData, loadAppZip, updateAppZip } from "../api/package";
const { registerCallback, getInterpreter, executeLine, executeFile } = brsLib;
import { description, version } from "../../package.json";

const defaultLevel = chalk.level.toString();
let zipFileName = "";

/**
 * CLI program, params definition and action processing.
 *
 */
program
    .description(`${description} CLI`)
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
            console.error(`Invalid color level! Keeping the default: ${defaultLevel}`);
        }
        registerCallback(messageCallback);
        if (brsFiles.length > 0) {
            try {
                // Run App Zip file
                const filePath = brsFiles[0];
                const fileName = filePath.split(/.*[/|\\]/)[1] ?? filePath;
                const fileExt = fileName.split(".").pop()?.toLowerCase();
                zipFileName = "";
                if (fileExt === "zip" || fileExt === "bpk") {
                    console.log(`\n${description} CLI [Version ${version}]\n`);
                    if (program.pack.length > 0 && fileExt === "zip") {
                        console.log(`Packaging ${filePath}...\n`);
                    } else {
                        console.log(`Executing ${filePath}...\n`);
                    }
                    zipFileName = fileName;
                    loadAppZip(fileName, fs.readFileSync(filePath), runApp);
                    return;
                }
                runBrsFiles(brsFiles);
            } catch (err: any) {
                if (err.messages?.length) {
                    err.messages.forEach((message: string) => console.error(message));
                } else {
                    console.error(err.message);
                }
                process.exitCode = 1;
            }
        } else {
            /// #if DEBUG
            console.log(
                `\n${description} CLI [version ${chalk.gray(version)}] - ${chalk.cyanBright(
                    "debug mode"
                )}\n`
            );
            /// #else
            console.log(`\n${description} CLI [version ${chalk.gray(version)}]\n`);
            /// #endif
            repl();
        }
    })
    .version(version, "-v, --version")
    .parse(process.argv);

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
                `Package file created as ${filePath} with ${Math.round(buffer.length / 1024)} KB.\n`
            );
        } catch (err: any) {
            console.error(`Error generating the file ${filePath}: ${err.message}`);
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
        if (line.toLowerCase() === "quit" || line.toLowerCase() === "exit") {
            process.exit();
        }
        executeLine(line, replInterpreter);
        rl.prompt();
    });

    rl.prompt();
}

/**
 * Callback function to receive the messages from the Interpreter.
 *
 */
function messageCallback(message: any, _: any) {
    if (typeof message === "string") {
        const mType = message.split(",")[0];
        if (!mType) {
            console.info(chalk.green(message.trimRight()));
        } else if (mType === "print") {
            console.log(colorize(message.slice(6).trimRight()));
        } else if (mType === "warning") {
            console.warn(chalk.yellow(message.slice(8).trimRight()));
        } else if (mType === "error") {
            console.error(chalk.red(message.slice(6).trimRight()));
        } else {
            console.info(chalk.green(message.slice(mType.length + 1).trimRight()));
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
        .replace(/\b(hint|info|information|true|log)(:|\b)/gi, chalk.cyan("$1$2"))
        .replace(/\b(running|success|successfully)(:|\b)/gi, chalk.green("$1$2"))
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
