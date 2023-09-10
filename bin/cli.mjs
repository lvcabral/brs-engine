#!/usr/bin/env node
import * as fs from 'fs';
import { Command } from 'commander';
const program = new Command();
import * as path from 'path';
import readline from "readline";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getInterpreter, runLine } from "../app/lib/brsEmu.worker.js";
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
        runLine(line, replInterpreter);
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
                await brs.execute(brsFiles, {
                    root: program.root,
                    componentDirs: program.componentDirs,
                });
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
