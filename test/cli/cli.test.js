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
    }, 10000);

    it("Channel Store Test", async () => {
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            "-r channel-store",
            "source/main.brs",
            "-c 0",
        ].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "TCSMS1           1",
            "TS1              3",
            "--  Catalog Items ---",
            "Status  - Items Received (code:  1)",
            "Source Identity Check: true",
            "5409d06c-332d-4458-a03a-d07268a97f7e TS1 Test Subscription",
            "8d082292-74a3-4658-82dd-c4c6f4032284 TCSMS1 Monthly Subscription",
            "a2c91cd4-5f69-4ae5-98f9-12c63b69d408 NW1 Nifty Widget Number 2",
            "--  Succeeded Order ---",
            "Order:true",
            "Status  - Order Received (code:  1)",
            "Source Identity Check: true",
            "TS1  1 $1.99",
            "SKUTAX  1 $0.00",
            "--  Failed Order ---",
            "Request - Failed: true Interrupted: false",
            "Status  - Invalid Order (code: -3)",
            "--  Purchases ---",
            "Status  - Items Received (code:  1)",
            "Source Identity Check: true",
            "6c8ad138-692f-48ef-b6ef-9657bb9b8059 2013-04-29T22:17:48 TS1  3 $1.99",
            "16fa3acf-28b7-4ab2-b94b-f6d23834bd09 2013-04-29T23:29:20 NW1  1 $0.99",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("Texture Manager Test", async () => {
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            "roTextureManager.brs",
            "-c 0",
        ].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "request id 1",
            "request state: 0",
            "requested: 0",
            "msg id 1",
            "msg state: 3",
            "msg URI:https://brsfiddle.net/images/gif-example-file-500x500.gif",
            "Image downloaded!",
            "msg id 1",
            "msg state: 3",
            "msg URI:https://brsfiddle.net/images/gif-example-file-500x500.gif",
            "Image resized!",
            "------ Finished 'roTextureManager.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

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
    }, 10000);

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
            expect(errors.length).toEqual(2);
        }
    }, 10000);

    it("SceneGraph App Test", async () => {
        let command = [
            "node",
            path.join(process.cwd(), "bin", "brs.cli.js"),
            "-r scenegraph",
            "source/Poster.brs",
            "-c 0",
        ].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "poster node type:Node",
            "poster node subtype:Poster",
            "poster node width: 0",
            "poster node height: 0",
            "BaseWidget init",
            "poster as child audioGuideText:fake text",
            "poster as child uri:/fake/uri",
            "poster as child bitmapWidth: 10.4",
            "------ Finished 'Poster.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it.todo("add tests for the remaining CLI options");
});
