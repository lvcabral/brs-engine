const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { promisify } = require("util");
const { zipSync, unzipSync } = require("fflate");

const exec = promisify(child_process.exec);
const brsCliPath = path.join(process.cwd(), "packages", "node", "bin", "brs.cli.js");

/** Recursively zips a folder into a Buffer using forward-slash relative paths. */
function zipFolder(rootDir) {
    const files = {};
    const walk = (dir, prefix) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(full, rel);
            } else {
                files[rel] = new Uint8Array(fs.readFileSync(full));
            }
        }
    };
    walk(rootDir, "");
    return Buffer.from(zipSync(files, { level: 6 }));
}

describe("cli", () => {
    it("run zip file", async () => {
        let command = ["node", brsCliPath, "requires-manifest.zip", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        let result = stdout.trim().match(/hi from foo\(\)/g);
        expect(result.length).toEqual(1);
    }, 10000);

    it("Channel Store Test", async () => {
        let command = ["node", brsCliPath, "-r channel-store", "source/main.brs", "-c 0"].join(" ");

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
            "Status  - Order Succeeded (code:  1)",
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
        let command = ["node", brsCliPath, "roTextureManager.brs", "-c 0"].join(" ");

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
        let command = ["node", brsCliPath, path.join(folder, filename), "-c 0"].join(" ");
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

    it("SceneGraph App Test", async () => {
        let command = ["node", brsCliPath, "-r scenegraph", "source/Poster.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "Main -----------------------------------------------",
            "MAIN: poster node type:roSGNode",
            "MAIN: poster node subtype:Poster",
            "MAIN: poster node width: 0",
            "MAIN: poster node height: 0",
            "Main -----------------------------------------------",
            "INIT: BaseWidget",
            "EVENT: BaseWidget onUriChange in",
            "EVENT: =====",
            "EVENT:  3",
            "INIT: http://www.example.com/image.jpg",
            "INIT:  100",
            "INIT:  200",
            "INIT: http://www.example.com/base.jpg",
            "INIT: <Component: roAssociativeArray> =",
            "{",
            "    global: <Component: roSGNode:Node>",
            '    something: "in"',
            "    top: <Component: roSGNode:NormalWidget>",
            "}",
            "Change field test start",
            "add:0:0",
            "insert:0:0",
            "remove:1:1",
            "insert:0:0",
            "set:1:1",
            "remove:0:0",
            "remove:0:0",
            "add:0:0",
            "add:1:1",
            "add:2:2",
            "add:3:3",
            "remove:1:3",
            "remove:0:0",
            "add:0:0",
            "add:1:1",
            "add:2:2",
            "set:0:0",
            "set:1:1",
            "set:2:2",
            "Change field test complete",
            "MAIN:  200 100",
            "EVENT: BaseWidget onNormalStringFieldChange     <Component: roAssociativeArray> =",
            "{",
            "    global: <Component: roSGNode:Node>",
            "    node: <Component: roSGNode:Node>",
            '    something: "in"',
            "    top: <Component: roSGNode:NormalWidget>",
            "}",
            "EVENT: Hello World!",
            "EVENT: BaseWidget onUriChange in",
            "EVENT: =====",
            "EVENT:  3",
            "Main -----------------------------------------------",
            "MAIN: poster as child audioGuideText:fake text",
            "MAIN: poster as child uri:/fake/uri",
            "MAIN: poster as child loadWidth: 10.4",
            "------ Finished 'Poster.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("SceneGraph Node Alias Test", async () => {
        let command = ["node", brsCliPath, "-r multi-alias-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Multi-Field Alias ===",
            "Initial state:",
            "label1.text =",
            "label2.text =",
            "label3.text =",
            "",
            "After setting syncedValue to 'Hello, World!':",
            "label1.text = Hello, World!",
            "label2.text = Hello, World!",
            "label3.text = Hello, World!",
            "",
            "After updating label2 to 'Updated Value':",
            "scene.syncedValue = Updated Value",
            "label1.text = Updated Value",
            "label2.text = Updated Value",
            "label3.text = Updated Value",
            "",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("SceneGraph Observers Test", async () => {
        let command = ["node", brsCliPath, "-r observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Multi-Field Alias with Observers ===",
            "",
            "Setting scene.syncedValue to 'First Value'",
            "Label1 changed to: First Value",
            "Label2 changed to: First Value",
            "",
            "Setting label1.text to 'Second Value'",
            "Label1 changed to: Second Value",
            "Label2 changed to: Second Value",
            "",
            "=== Observer Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("ContentNode Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r contentnode-recursion-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ContentNode Recursion Repro ===",
            "Observer registrations: 1200",
            "Triggering ContentNode title update",
            "Callbacks fired: 1200",
            "=== ContentNode Recursion Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("ContentNode ParentField Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r contentnode-parentfield-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ContentNode ParentField Repro ===",
            "Trigger 1: listActive = true",
            "  Active: 1 ContentNotify: 1",
            "Trigger 2: listActive = false",
            "  Active: 3 ContentNotify: 2",
            "Trigger 3: listActive = true",
            "  Active: 6 ContentNotify: 3",
            "=== ContentNode ParentField Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("Shared ContentNode Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r sharedcontent-recursion-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // One ContentNode shared by many fields must fan out to every observer exactly once
        // without overflowing the stack via nested parentField propagation (JellyRock #904).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Shared ContentNode Recursion Repro ===",
            "Shared content fields: 1500",
            "Triggering shared ContentNode update",
            "Callbacks fired: 1500",
            "=== Shared ContentNode Recursion Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("Button Label Observer Order Test", async () => {
        let command = ["node", brsCliPath, "-r button-label-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A field observed inside one cascade must be able to notify more than once
        // (clear pass + fill pass); if the second notification is dropped the button's
        // inner Label is left blank.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Button Label Repro ===",
            "label.text = Save",
            "=== Button Label Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("Run App from Root Folder Only", async () => {
        // Issue #771: pointing the CLI at a folder with `--root` and no positional files
        // discovers source/*.brs and loads components/ from the root-mounted pkg:/ volume,
        // running the SceneGraph app the same way as passing `source/main.brs` explicitly.
        let command = ["node", brsCliPath, "-r button-label-app", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Button Label Repro ===",
            "label.text = Save",
            "=== Button Label Repro Complete ===",
            "------ Finished 'button-label-app' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    describe("SceneGraph .bpk encryption", () => {
        const password = "abcdefghij0123456789abcdefghij01"; // 32 chars (AES-256 key)
        const expected = [
            "=== Button Label Repro ===",
            "label.text = Save",
            "=== Button Label Repro Complete ===",
            "------ Finished 'app.bpk' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ];
        let tmpDir;
        let bpkPath;

        beforeAll(async () => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-bpk-"));
            // Package the SceneGraph button-label-app (inline-script XML components) into a zip.
            const appDir = path.join(__dirname, "resources", "button-label-app");
            const zipPath = path.join(tmpDir, "app.zip");
            fs.writeFileSync(zipPath, zipFolder(appDir));
            // Encrypt it into app.bpk.
            await exec(
                ["node", brsCliPath, '"' + zipPath + '"', "--pack", password, "--out", '"' + tmpDir + '"', "-c 0"].join(
                    " "
                )
            );
            bpkPath = path.join(tmpDir, "app.bpk");
        }, 15000);

        afterAll(() => {
            if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it("strips component .brs/.xml from the package", () => {
            const entries = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(bpkPath))));
            // Component code is encrypted into source/data and removed from the package.
            expect(entries).toContain("source/data");
            expect(entries).toContain("source/var");
            expect(entries).toContain("manifest");
            expect(entries.some((e) => /^components\/.+\.(brs|xml)$/i.test(e))).toBe(false);
            // A components/ directory marker is preserved so the encrypted SceneGraph app is still
            // detected at load time (the source zip here has no explicit directory entries).
            expect(entries.some((e) => e.toLowerCase().startsWith("components/"))).toBe(true);
        }, 15000);

        it("runs the encrypted SceneGraph app with the correct password", async () => {
            const { stdout } = await exec(
                ["node", brsCliPath, '"' + bpkPath + '"', "--pack", password, "-c 0"].join(" ")
            );
            const lines = stdout.split("\n").map((line) => line.trimEnd());
            expect(lines).toEqual(expect.arrayContaining(expected));
        }, 15000);

        it("fails cleanly with a wrong password", async () => {
            const { stdout } = await exec(
                ["node", brsCliPath, '"' + bpkPath + '"', "--pack", "x".repeat(32), "-c 0"].join(" ")
            ).catch((e) => e); // non-zero exit code
            expect(stdout).toContain("EXIT_UNPACK_FAILED");
        }, 15000);
    });

    it.todo("add tests for the remaining CLI options");
});
