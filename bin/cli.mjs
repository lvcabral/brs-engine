#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import { Command } from 'commander';
const program = new Command();
import * as path from 'path';
import readline from "readline";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import brsEmu from "../app/lib/brsEmu.js";
const { deviceData, loadAppZip, updateAppZip } = brsEmu;
import brsInterpreter from "../app/lib/brsEmu.worker.js";
const  { getInterpreter, executeLine, executeFile } = brsInterpreter;
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
let zipFileName = "";

/**
 * Execute the app payload or generate an encrypted app package
 * if a password is passed with parameter --pack.
 * 
 */
function runApp(payload) {
    const fontPath = "../app/fonts";
    const fontFamily = payload.device.defaultFont;
    payload.device.fonts.set("regular", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Regular.ttf`)));
    payload.device.fonts.set("bold", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Bold.ttf`)));
    payload.device.fonts.set("italic", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Italic.ttf`)));
    payload.device.fonts.set("bold-italic", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-BoldItalic.ttf`)));
    payload.password = program.pack;
    const pkg = executeFile(payload);
    if (pkg instanceof Uint8Array && pkg.length > 0) {
        const regEx = new RegExp(".zip", "ig");
        const filePath = path.join(program.out, zipFileName.replace(regEx, ".bpk"));
        updateAppZip(pkg).then(function (buffer) {
            try {
                fs.writeFileSync(filePath, buffer);
                console.log(`Package file created as ${filePath} with ${Math.round(buffer.length / 1024)} KB.\n`);
            } catch (err) {
                console.error(`Error generating the file ${filePath}: ${err.message}`);
                process.exitCode = 1;
            }
        });
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
    rl.setPrompt("brs> ");
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
 * CLI program, params definition and action processing.
 * 
 */
program
    .description(`${packageJson.description} CLI`)
    .arguments(`brs-cli [brsFiles...]`)
    .option(
        "-p, --pack <password>",
        "The password to generate the encrypted package.",
        ""
    )
    .option(
        "-o, --out <directory>",
        "The directory to save the encrypted package file.",
        "./"
    )
    .action(async (brsFiles, program) => {
        if (brsFiles.length > 0) {
            try {
                // Run App Zip file
                const filePath = brsFiles[0];
                const fileName = filePath.split(/.*[\/|\\]/)[1] ?? filePath;
                const fileExt = fileName.split(".").pop()?.toLowerCase();
                zipFileName = "";
                if (fileExt === "zip" || fileExt === "bpk") {
                    console.log(`\n${packageJson.description} CLI [Version ${packageJson.version}]\n`);
                    if (program.pack.length > 0 && fileExt === "zip") {
                        console.log(`Packaging ${filePath}...\n`);
                    } else {
                        console.log(`Executing ${filePath}...\n`);
                    }
                    
                    zipFileName = fileName;
                    loadAppZip(fs.readFileSync(filePath), runApp);
                    return;
                }
                // Run list of Brs files
                const paths = [];
                const source = [];
                let id = 0;
                brsFiles.map((filePath) => {
                    const fileName = filePath.split(/.*[\/|\\]/)[1] ?? filePath;
                    const fileExt = fileName.split(".").pop();
                    if (fileExt?.toLowerCase() === "brs") {
                        const sourceCode = fs.readFileSync(filePath);
                        if (sourceCode) {
                            source.push(sourceCode.toString());
                            paths.push({ url: `source/${fileName}`, id: id, type: "source" });
                            id++;
                        }
                    }
                })
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
            } catch (err) {
                if (err.messages && err.messages.length) {
                    err.messages.forEach((message) => console.error(message));
                } else {
                    console.error(err.message);
                }
                process.exitCode = 1;
            }
        } else {
            console.log(`\n${packageJson.description} CLI [Version ${packageJson.version}]\n`);
            repl();
        }
    })
    .version(packageJson.version, "-v, --version")
    .parse(process.argv);
