const child_process = require("child_process");
const path = require("path");
const pify = require("pify");

const execFile = pify(child_process.execFile);

describe("cli", () => {
    it("accepts a root directory", () => {
        let rootDir = path.join(__dirname, "resources");

        return execFile(
            path.join(process.cwd(), "bin", "cli.js"),
            [
                "--root", rootDir,
                path.join(rootDir, "requires-manifest.brs")
            ]
        ).then((stdout, stderr) => {
            expect(stdout.trim()).toEqual("hi from foo()");
        });
    });

    it("defaults --root to process.cwd()", () => {
        return execFile(
            path.join(process.cwd(), "bin", "cli.js"),
            [ "requires-manifest.brs" ],
            { cwd: path.join(__dirname, "resources") }
        ).then((stdout, stderr) => {
            expect(stdout.trim()).toEqual("hi from foo()");
        });
    });
});

