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
const { deviceData } = brsEmu;
import { getInterpreter, executeLine, executeFile } from "../app/lib/brsEmu.worker.js";
const replInterpreter = getInterpreter();

// read current version from package.json
// I'll _definitely_ forget to do this one day
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));

/**
 * Launches an interactive read-execute-print loop, which reads input from
 * `stdin` and executes it.
 *
 * **NOTE:** Currently limited to single-line inputs :(
 */
function repl() {
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

program
    .description("BrightScript interpreter CLI")
    .arguments("brs [brsFiles...]")
    .option(
        "-r, --root <directory>",
        "The root directory from which `pkg:` paths will be resolved.",
        process.cwd()
    )
    .option(
        "-c, --component-dirs <directories>",
        "Comma-separated list of additional directories beyond `components` to search for XML components",
        (value) => value.split(","),
        []
    )
    .action(async (brsFiles, program) => {
        if (brsFiles.length > 0) {
            try {
                // TODO: Support multiple files, support zip file
                const paths = [];
                const source = [];
                const fileName = brsFiles[0];
                const sourceCode = fs.readFileSync(fileName);
                if (sourceCode) {
                    source.push(sourceCode.toString());
                    paths.push({ url: `source/${fileName}`, id: 0, type: "source" });   
                }
                const fontPath = "../app/fonts";
                const fontFamily = deviceData.defaultFont;
                deviceData.fonts.set("regular", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Regular.ttf`)));
                deviceData.fonts.set("bold", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Bold.ttf`)));
                deviceData.fonts.set("italic", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-Italic.ttf`)));
                deviceData.fonts.set("bold-italic", fs.readFileSync(path.join(__dirname, fontPath, `${fontFamily}-BoldItalic.ttf`)));
                const payload = {
                    device: deviceData,
                    manifest: new Map(),
                    input: [],
                    paths: paths,
                    brs: source,
                    texts: [],
                    binaries: [],
                };
                executeFile(payload);
            } catch (err) {
                if (err.messages && err.messages.length) {
                    err.messages.forEach((message) => console.error(message));
                } else {
                    console.error(err.message);
                }
                process.exitCode = 1;
            }
        } else {
            console.log(`BrightScript interpreter CLI [Version ${packageJson.version}]`);
            console.log("");
            repl();
        }
    })
    .version(packageJson.version, "-v, --version")
    .parse(process.argv);
