#!/usr/bin/env node
const program = require("commander");
const fs = require("fs");
const path = require("path");

const brs = require("../lib/");

// read current version from package.json
// I'll _definitely_ forget to do this one day
const packageJson = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "..", "package.json")
    )
);

program
    .description("Off-Roku BrightScript interpreter")
    .arguments("brs [brsFiles...]")
    .action((brsFiles) => {
        if (brsFiles.length > 0) {
            brs.execute(brsFiles).catch(err => {
                console.error(err.message);
                process.exit(1);
            });
        } else {
            brs.repl();
        }
    })
    .version(packageJson.version)
    .parse(process.argv);
