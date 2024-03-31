const child_process = require("child_process");
const path = require("path");
const { promisify } = require("util");

const exec = promisify(child_process.exec);

describe("cli", () => {
    it("accepts a root directory", async () => {
        let rootDir = path.join(__dirname, "resources");

        let command = [
            "FORCE_COLOR=0",
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            "--root",
            rootDir,
            path.join(rootDir, "requires-manifest.brs"),
        ].join(" ");

        let { stdout } = await exec(command);
        expect(stdout.trim()).toEqual("hi from foo()");
    });

    it("defaults --root to process.cwd()", async () => {
        let command = [
            "FORCE_COLOR=0",
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            "requires-manifest.brs",
        ].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.trim()).toEqual("hi from foo()");
    });

    it("prints syntax errors once", async () => {
        let filename = "errors/syntax-error.brs";
        let command = [
            "FORCE_COLOR=0",
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            filename,
        ].join(" ");
        try {
            await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            throw `Script ran without error: ${filename}`;
        } catch (err) {
            let errors = err.stderr.split(filename).filter((line) => line !== "");
            expect(errors.length).toEqual(2);
        }
    });

    it("prints eval errors once", async () => {
        let filename = "errors/uninitialized-object.brs";
        let command = [
            "FORCE_COLOR=0",
            "node",
            path.join(process.cwd(), "bin", "cli.js"),
            filename,
        ].join(" ");
        let { stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        let errors = stderr.split(filename).filter((line) => line !== "");
        expect(errors.length).toEqual(1);
    });
});
