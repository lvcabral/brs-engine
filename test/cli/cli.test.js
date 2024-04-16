const child_process = require("child_process");
const path = require("path");
const { promisify } = require("util");

const exec = promisify(child_process.exec);

describe("cli", () => {
    it("run zip file", async () => {
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            "requires-manifest.zip",
            "-c 0",
        ].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        let result = stdout.trim().match(/hi from foo\(\)/g);
        expect(result.length).toEqual(1);
    });

    it("prints syntax errors once", async () => {
        let folder = "errors";
        let filename = "uninitialized-object.brs";
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            path.join(folder, filename),
            "-c 0",
        ].join(" ");
        try {
            await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            throw `Script ran without error: ${filename}`;
        } catch (err) {
            let errors = err.stderr.match(new RegExp(filename, "g"));
            expect(errors.length).toEqual(2);
        }
    });

    it("prints eval errors once", async () => {
        let folder = "errors";
        let filename = "uninitialized-object.brs";
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            path.join(folder, filename),
            "-c 0",
        ].join(" ");
        try {
            await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
        } catch (err) {
            let errors = err.stderr.match(new RegExp(filename, "g"));
            console.log(errors);
            expect(errors.length).toEqual(2);
        }
    });
    it.todo("add tests for the remaining CLI options");
});
