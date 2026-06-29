const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { promisify } = require("util");
const { zipSync, unzipSync, strToU8 } = require("fflate");

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

/** Mirrors core/packageEncryption: unwraps a container-encrypted .bpk to its inner zip bytes. */
const BPK_MAGIC = [0x42, 0x52, 0x53, 0x42, 0x50, 0x4b, 0x31, 0x00]; // "BRSBPK1\0"
async function decryptBpk(buffer, password) {
    const data = new Uint8Array(buffer);
    if (!BPK_MAGIC.every((b, i) => data[i] === b)) {
        return data; // plain zip / legacy bpk
    }
    const iv = data.subarray(8, 24);
    const cipher = data.subarray(24);
    const keyBytes = new Uint8Array(32);
    keyBytes.set(new TextEncoder().encode(password).subarray(0, 32));
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CTR", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, cipher);
    return new Uint8Array(plain);
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
            // Production mode (default) prints the error once, without the BackTrace block
            // (the backtrace is only emitted with --debug / debugOnCrash).
            expect(errors.length).toEqual(1);
        }
    }, 10000);

    it("exits the app on STOP in production mode (no Micro Debugger)", async () => {
        // Without --debug the Micro Debugger is disabled, so a STOP statement terminates the
        // app (with the EXIT_BRIGHTSCRIPT_STOP reason) instead of opening the debugger.
        let stdout = "";
        try {
            ({ stdout } = await exec(["node", brsCliPath, "stop-prod.brs", "-c 0"].join(" "), {
                cwd: path.join(__dirname, "resources"),
            }));
        } catch (err) {
            stdout = err.stdout ?? "";
        }
        expect(stdout).toContain("before stop");
        expect(stdout).not.toContain("after stop");
        expect(stdout).toContain("EXIT_BRIGHTSCRIPT_STOP");
        // The interactive debugger (which would error on a non-TTY) must not be reached.
        expect(stdout).not.toContain("interactive reading from TTY");
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

    it("List item component can read its parent list during init()", async () => {
        let command = ["node", brsCliPath, "-r list-item-parent-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of the JellyRock JRServer item: a custom list item sizes its focus border from
        // m.top.getParent().itemSize in init(). The item must already be attached to its list when
        // init() runs (as on a real device), so getParent() resolves the list and itemSize is read.
        // Before the fix the parent was attached after init(), so getParent() was invalid and the
        // border stayed 0x0 (rendered tiny in the corner).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== List Item Parent Repro ===",
            "ServerItem init: focusBorder = 1520x 100",
            "=== List Item Parent Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 10000);

    it("StandardDialog forwards focus to a custom component's nested button group", async () => {
        let command = ["node", brsCliPath, "-r dialog-buttongroup-focus-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of the pplus-proxy ThemeDialog: a custom dialog on the StandardDialog framework whose
        // interactive widget is a plain LayoutGroup-based button group (no StdDlgButtonArea). It drives
        // focus via its own focusedChild observer + hasFocus(), with the dialog focused from inside a
        // field-observer callback. setNodeFocus must make the dialog itself the focused node so that
        // observer fires and forwards focus into the button group (otherwise no button is highlighted),
        // and must re-deliver focus when the dialog is explicitly re-focused after focus moved away.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Dialog ButtonGroup Focus Repro ===",
            "  ExButtons received focus -> highlight first button",
            "after show: isInFocusChain = true",
            "  ExButtons received focus -> highlight first button",
            "after refocus: isInFocusChain = true",
            "=== Dialog ButtonGroup Focus Complete ===",
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

        it("encrypts the whole package container (not a readable zip without the password)", () => {
            const raw = new Uint8Array(fs.readFileSync(bpkPath));
            // Container starts with the BRSBPK1 magic, not the "PK" zip header.
            expect(Array.from(raw.subarray(0, BPK_MAGIC.length))).toEqual(BPK_MAGIC);
            // The plaintext assets are not extractable without the password.
            expect(() => unzipSync(raw)).toThrow();
        }, 15000);

        it("strips component .brs/.xml from the package", async () => {
            const entries = Object.keys(unzipSync(await decryptBpk(fs.readFileSync(bpkPath), password)));
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
            // A wrong password fails at the container layer, before any source is touched.
            const { stderr } = await exec(
                ["node", brsCliPath, '"' + bpkPath + '"', "--pack", "x".repeat(32), "-c 0"].join(" ")
            ).catch((e) => e);
            expect(stderr).toContain("Invalid password for the encrypted package");
        }, 15000);

        // Build a nested SceneGraph app whose Main tries to read its own component source, to verify
        // (1) the empty component directory tree is pruned and (2) the decrypted source is no longer
        // reachable from BrightScript once the components have been parsed.
        describe("source protection & structure", () => {
            let protBpk;
            const main = [
                "sub main()",
                '    print "READBRS:[" + ReadAsciiFile("pkg:/components/sub/Secret.brs") + "]"',
                '    print "READXML:[" + ReadAsciiFile("pkg:/components/sub/Secret.xml") + "]"',
                '    print "LISTDIR_COUNT:" + ListDir("pkg:/components").count().toStr()',
                "end sub",
            ].join("\n");
            const secretXml =
                '<?xml version="1.0" encoding="utf-8" ?>\n' +
                '<component name="Secret" extends="Group">\n' +
                '    <script type="text/brightscript" uri="pkg:/components/sub/Secret.brs" />\n' +
                "</component>";
            const secretBrs = "sub init()\n    ' TOP_SECRET_12345\nend sub";

            beforeAll(async () => {
                const zipPath = path.join(tmpDir, "prot.zip");
                // Note: explicit directory entries are included so the pruning logic is exercised.
                const zip = zipSync({
                    manifest: strToU8("title=Prot\nmajor_version=1\nminor_version=0\nbuild_version=0\n"),
                    "source/main.brs": strToU8(main),
                    "components/": new Uint8Array(0),
                    "components/sub/": new Uint8Array(0),
                    "components/sub/Secret.xml": strToU8(secretXml),
                    "components/sub/Secret.brs": strToU8(secretBrs),
                });
                fs.writeFileSync(zipPath, Buffer.from(zip));
                await exec(
                    [
                        "node",
                        brsCliPath,
                        '"' + zipPath + '"',
                        "--pack",
                        password,
                        "--out",
                        '"' + tmpDir + '"',
                        "-c 0",
                    ].join(" ")
                );
                protBpk = path.join(tmpDir, "prot.bpk");
            }, 15000);

            it("prunes the empty component directory tree to a single marker", async () => {
                const entries = Object.keys(unzipSync(await decryptBpk(fs.readFileSync(protBpk), password)));
                const componentEntries = entries.filter((e) => e.toLowerCase().startsWith("components/"));
                // The components/sub/ tree (which only held encrypted files) is gone; only the marker remains.
                expect(componentEntries).toEqual(["components/"]);
            }, 15000);

            it("does not let BrightScript read the decrypted component source", async () => {
                const { stdout } = await exec(
                    ["node", brsCliPath, '"' + protBpk + '"', "--pack", password, "-c 0"].join(" ")
                );
                expect(stdout).toContain("READBRS:[]");
                expect(stdout).toContain("READXML:[]");
                expect(stdout).toContain("LISTDIR_COUNT:0");
                expect(stdout).not.toContain("TOP_SECRET");
            }, 15000);
        });
    });

    describe(".bpk forces Production mode", () => {
        const password = "abcdefghij0123456789abcdefghij01"; // 32 chars (AES-256 key)
        let tmpDir;
        let bpkPath;

        beforeAll(async () => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-bpk-prod-"));
            const zipPath = path.join(tmpDir, "crash.zip");
            fs.writeFileSync(zipPath, zipFolder(path.join(__dirname, "resources", "crash-app")));
            await exec(
                ["node", brsCliPath, '"' + zipPath + '"', "--pack", password, "--out", '"' + tmpDir + '"', "-c 0"].join(
                    " "
                )
            );
            bpkPath = path.join(tmpDir, "crash.bpk");
        }, 15000);

        afterAll(() => {
            if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it("ignores --debug for an encrypted package (no debugger, no backtrace)", async () => {
            // Even with --debug, a .bpk runs in Production mode: the crash must not open the
            // (interactive) Micro Debugger nor print the BackTrace block.
            let stdout = "";
            let stderr = "";
            try {
                await exec(["node", brsCliPath, '"' + bpkPath + '"', "--pack", password, "--debug", "-c 0"].join(" "));
            } catch (err) {
                stdout = err.stdout ?? "";
                stderr = err.stderr ?? "";
            }
            const output = stdout + stderr;
            expect(output).toContain("'Dot' Operator attempted with invalid BrightScript Component");
            expect(output).not.toContain("BackTrace:");
            // The interactive debugger (which would error on a non-TTY) must not be reached.
            expect(output).not.toContain("interactive reading from TTY");
        }, 15000);
    });

    describe("ECP query/r2d2-bitmaps", () => {
        const http = require("http");
        let server;

        /** Performs an HTTP GET, resolving with the body once the server responds. */
        function httpGet(url) {
            return new Promise((resolve, reject) => {
                const req = http.get(url, (res) => {
                    let body = "";
                    res.on("data", (chunk) => (body += chunk));
                    res.on("end", () => resolve(body));
                });
                req.on("error", reject);
                req.setTimeout(2000, () => req.destroy(new Error("timeout")));
            });
        }

        /** Polls the endpoint until the response satisfies `ready` (or the attempts run out). */
        async function waitForEndpoint(url, ready, attempts = 40) {
            let last = "";
            for (let i = 0; i < attempts; i++) {
                try {
                    last = await httpGet(url);
                    if (ready(last)) {
                        return last;
                    }
                } catch {
                    // server not up yet
                }
                await new Promise((r) => setTimeout(r, 500));
            }
            throw new Error(`ECP endpoint not ready, last response: ${last}`);
        }

        /** Resolves once the spawned server prints `text` on stdout (or the timeout elapses). */
        function waitForStdout(child, text, timeoutMs = 15000) {
            return new Promise((resolve, reject) => {
                let buffer = "";
                const timer = setTimeout(() => reject(new Error(`stdout did not contain "${text}"`)), timeoutMs);
                child.stdout.on("data", (chunk) => {
                    buffer += chunk.toString();
                    if (buffer.includes(text)) {
                        clearTimeout(timer);
                        resolve(buffer);
                    }
                });
            });
        }

        const url = "http://localhost:8060/query/r2d2-bitmaps";

        afterEach(() => {
            server?.kill("SIGKILL");
            server = undefined;
        });

        it("returns texture-memory data for the running app's bitmaps and fonts in debug mode", async () => {
            server = child_process.spawn(
                "node",
                [brsCliPath, "-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp", "--debug"],
                { cwd: path.join(__dirname, "resources") }
            );
            const xml = await waitForEndpoint(url, (body) => body.includes("pkg:/images/alpha.png"));

            expect(xml).toContain("<r2d2-bitmaps>");
            expect(xml).toContain("<status>OK</status>");
            // Roku's element name typo is preserved verbatim.
            expect(xml).toContain("<sytem-memory>");
            // The two bitmaps created by the app, with alpha => bpp 4 and opaque => bpp 3.
            expect(xml).toContain("<name>pkg:/images/alpha.png</name>");
            expect(xml).toContain("<name>pkg:/images/opaque.jpg</name>");
            expect(xml).toMatch(/<bpp>4<\/bpp>/);
            expect(xml).toMatch(/<bpp>3<\/bpp>/);
            // The registered fonts are listed as font atlases.
            expect(xml).toContain("Font:");
            // Texture memory used + available equals the configured maximum.
            const used = Number(xml.match(/<texture-memory>\s*<used>(\d+)</)[1]);
            const available = Number(xml.match(/<available>(\d+)</)[1]);
            const max = Number(xml.match(/<max>(\d+)</)[1]);
            expect(used + available).toEqual(max);
        }, 30000);

        it("returns no bitmaps in production mode (no --debug)", async () => {
            server = child_process.spawn("node", [brsCliPath, "-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp"], {
                cwd: path.join(__dirname, "resources"),
            });
            // Wait until the app has created its bitmaps, then confirm the registry stayed empty.
            await waitForStdout(server, "R2D2 ready");
            const xml = await waitForEndpoint(url, (body) => body.includes("<status>OK</status>"));

            expect(xml).toContain("<r2d2-bitmaps>");
            expect(xml).not.toContain("<bitmap>");
            expect(xml).not.toContain("pkg:/images/alpha.png");
        }, 30000);
    });

    it.todo("add tests for the remaining CLI options");
});
