const child_process = require("child_process");
const path = require("path");
const pify = require("pify");

const exec = pify(child_process.exec);

describe("cli", () => {
    it("accepts a root directory", () => {
        let rootDir = path.join(__dirname, "resources");

        let command = [
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            "--root", rootDir,
            path.join(rootDir, "requires-manifest.brs")
        ].join(" ");

        return exec(command).then((stdout, stderr) => {
            expect(stdout.trim()).toEqual("hi from foo()");
        });
    });

    it("defaults --root to process.cwd()", () => {
        let command = [
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            "requires-manifest.brs"
        ].join(" ");

        return exec(command, {
            cwd: path.join(__dirname, "resources")
        }).then((stdout, stderr) => {
            expect(stdout.trim()).toEqual("hi from foo()");
        });
    });
});

