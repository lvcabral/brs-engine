#!/usr/bin/env node
const program = require("commander");
const fs = require("fs");
const path = require("path");

const brs = require("../lib/");

// read current version from package.json
// I'll _definitely_ forget to do this one day
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));

program
    .description("Off-Roku BrightScript interpreter")
    .arguments("brs [brsFiles...]")
    .option(
        "-r, --root <directory>",
        "The root directory from which `pkg:` paths will be resolved.",
        process.cwd()
    )
    .action(async (brsFiles, program) => {
        if (brsFiles.length > 0) {
            try {
                await brs.execute(brsFiles, { root: program.root });
            } catch (err) {
                if (err.messages && err.messages.length) {
                    err.messages.forEach(message => console.error(message));
                } else {
                    console.error(err.message);
                }
                process.exitCode = 1;
            }
        } else {
            brs.repl();
        }
    })
    .version(packageJson.version, "-v, --version")
    .parse(process.argv);
