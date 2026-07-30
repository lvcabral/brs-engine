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

// Each test spawns its own isolated `node brs.cli.js` child process and shares no in-process
// state, so they run concurrently (capped by `maxConcurrency` in vitest.config.mts). The ECP
// suite is the exception - it binds a fixed port - and opts back out with `describe.sequential`.
describe.concurrent("cli", () => {
    it("run zip file", async () => {
        let command = ["node", brsCliPath, "requires-manifest.zip", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        let result = stdout.trim().match(/hi from foo\(\)/g);
        expect(result.length).toEqual(1);
    }, 30000);

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
    }, 30000);

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
    }, 30000);

    it("follows HTTP redirects when downloading a texture", async () => {
        // Regression: the synchronous download() path (roTextureManager -> loadTexture)
        // must follow HTTP redirects. Many CDNs 302 image URLs; before the fix the sync
        // XHR child process ignored the redirect and the texture failed to load.
        const http = require("http");
        const { createCanvas } = require("canvas");

        // A real PNG node-canvas can decode back into a valid roBitmap.
        const canvas = createCanvas(4, 4);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, 4, 4);
        const png = canvas.toBuffer("image/png");

        // Local server: /redirect.png -> 302 -> /image.png which serves the PNG.
        const server = http.createServer((req, res) => {
            if (req.url === "/redirect.png") {
                res.writeHead(302, { Location: "/image.png" });
                res.end();
            } else if (req.url === "/image.png") {
                res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
                res.end(png);
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-redirect-"));
        const brsPath = path.join(tmpDir, "redirectTexture.brs");
        fs.writeFileSync(
            brsPath,
            [
                "sub Main()",
                '    msgport = CreateObject("roMessagePort")',
                '    screen = CreateObject("roScreen", true, 854, 480)',
                "    screen.SetMessagePort(msgport)",
                '    mgr = CreateObject("roTextureManager")',
                "    mgr.SetMessagePort(msgport)",
                `    uri = "http://127.0.0.1:${port}/redirect.png"`,
                '    request = CreateObject("roTextureRequest", uri)',
                "    mgr.RequestTexture(request)",
                "    msg = wait(0, msgport)",
                '    if type(msg) = "roTextureRequestEvent" and msg.GetState() = 3 and type(msg.GetBitmap()) = "roBitmap"',
                '        print "Image downloaded!"',
                "    else",
                '        print "Download failed"',
                "    end if",
                "end sub",
                "",
            ].join("\n")
        );

        try {
            const command = ["node", brsCliPath, "redirectTexture.brs", "-c 0"].join(" ");
            const { stdout } = await exec(command, { cwd: tmpDir });
            expect(stdout).toContain("Image downloaded!");
            expect(stdout).not.toContain("Download failed");
        } finally {
            await new Promise((resolve) => server.close(resolve));
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }, 30000);

    it("Draws and measures empty strings without crashing", async () => {
        // Regression: node-canvas v4 aborts the process (SIGTRAP) when its text APIs
        // (measureText/fillText) receive an empty string — the engine must guard them.
        let command = ["node", brsCliPath, "emptyTextDraw.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "empty width:  0",
            "empty ellipsized:  0",
            "normal width > 0: true",
            "space width > 0: true",
            "spaced wider: true",
            "------ Finished 'emptyTextDraw.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Keeps memoized text measurements distinct per text, width and font", async () => {
        // Measuring is memoized per font because a LayoutGroup re-measures its children on every
        // layout pass (it lays out by rendering them with no draw target), which made the cost of
        // adding a node grow with the size of the tree. The cache key has to keep every input
        // apart, or labels would render at another string's width.
        let command = ["node", brsCliPath, "fontMeasureCache.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "stable: true",
            "clamped: true",
            "unclamped: true",
            "font isolated: true",
            "text isolated: true",
            "------ Finished 'fontMeasureCache.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Renders frames as terminal images with --image", async () => {
        let command = ["node", brsCliPath, "emptyTextDraw.brs", "-i", "-c 0"].join(" ");
        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // terminal-image emits the rendered frame (ANSI fallback when piped) plus the
        // cursor-home prefix used to repaint in place — absent without -i.
        expect(stdout).toContain("\x1b[H");
        expect(stdout).toContain("empty width:  0");
    }, 30000);

    it("Runs cleanly with --snapshot enabled (saving requires the Ctrl+S shortcut)", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-snap-"));
        const imagePath = path.join(tmpDir, "frame.png");
        try {
            let command = ["node", brsCliPath, "emptyTextDraw.brs", "-s", imagePath, "-c 0"].join(" ");
            let { stdout } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            // Non-TTY: the shortcut can never fire, so nothing is saved and nothing breaks.
            expect(stdout).toContain("empty width:  0");
            expect(fs.existsSync(imagePath)).toBe(false);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }, 30000);

    it("only warns once for a repeatedly-requested missing local texture", async () => {
        let command = ["node", brsCliPath, "roTextureManagerMissingFile.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
            env: { ...process.env, NODE_ENV: "development" },
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "first request state: 4",
            "second request state: 4",
            "------ Finished 'roTextureManagerMissingFile.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        // The second identical request must not re-hit the filesystem or re-log the warning.
        let warnings = stderr.match(/Error requesting texture pkg:\/images\/does-not-exist\.png/g) ?? [];
        expect(warnings.length).toEqual(1);
    }, 30000);

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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

    it("applies an interface field's default value through its alias targets", async () => {
        // Regression: addFields applied a field's XML default only on the non-alias branch, so an
        // aliased field with a default (e.g. `height` value="42" aliased to a child's height) never
        // wrote the default. The aliased child then read 0 — and a background Poster sized this way
        // would fall back to its bitmap's native size instead of the intended height.
        let command = ["node", brsCliPath, "-r alias-default-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Aliased Field Default ===",
            "scene.boxHeight = 42",
            "box1.height = 42",
            "box2.height = 42",
            "scene.boxWidth = 100",
            "box1.width = 100",
            "scene.trailing = present",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("findNode resolves ids breadth-first (shallow sibling wins over a child component's internals)", async () => {
        // Regression: findNodeById was depth-first, so it descended into an earlier sibling's
        // subtree — including a custom component's INTERNAL children — and returned a deep node
        // whose id shadowed a shallower sibling's (different case). Per Roku's ifSGNodeDict spec
        // the search is breadth-first: all nodes at one depth are tested before any deeper node.
        let command = ["node", brsCliPath, "-r find-node-bfs-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing findNode Breadth-First Order ===",
            "host findNode result = RowList:Label",
            "deep findNode result = innerLabel",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Keeps a component usable when interface field aliases have unresolvable targets", async () => {
        // Regression: a failed alias target (missing node or missing field) used to abort addFields,
        // dropping every <interface> field declared after it. A device only warns: the remaining
        // alias targets still bind and the trailing fields are still added.
        let command = ["node", brsCliPath, "-r bad-alias-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Failed Alias Targets ===",
            "scene.trailing = present",
            "label1.text = bound",
            "label2.text = synced",
            "label3.text = synced",
            "hasField allBad = false",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        // The device-style warnings are still written for each unresolvable target.
        expect(stderr).toContain("-- Interface field alias failed: No node named ghost");
        expect(stderr).toContain('-- Interface field alias failed: Node "label1" has no field named "nosuchfield"');
    }, 30000);

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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

    it("Reentrant field observers are deferred until the current handler returns", async () => {
        let command = ["node", brsCliPath, "-r deferred-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // onSelected focuses two lists and moves focus via jumpToItem (firing their itemFocused
        // observers) BEFORE it assigns dayList.content. On Roku those observers run from the message
        // loop after the handler returns, so they see the assigned dayList.content. With
        // synchronous/inline dispatch they ran reentrantly while dayList.content was still invalid
        // -> crash. The deferred dispatch drains them after onSelected unwinds: "onSelected done"
        // prints before any "onDateFocused", and each reads the valid 31-child dayList content.
        // Each focused list fires itemFocused twice (on focus-gain, then on the jumpToItem move).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Deferred Observer Repro ===",
            "onSelected",
            "Setting dayList content",
            "onSelected done",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "=== Deferred Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Fires itemFocused only when a list gains focus, not on content population while unfocused", async () => {
        let command = ["node", brsCliPath, "-r list-initial-focus-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The list is assigned an EMPTY content node, then that same node is populated afterwards
        // (as a content-loading Task does) - all while the list is NOT in the focus chain. Verified
        // on a real Roku: itemFocused only changes when focus moves onto an item, so populating an
        // unfocused list fires no observer and the field stays at its -1 "never focused" sentinel.
        // Only when the list is given focus does the first item gain focus and itemFocused fire
        // (index 0). This guards against re-emitting itemFocused on unfocused content load, which
        // makes list-driven side effects (e.g. a focused-item preview) trigger prematurely.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== List Initial Focus Repro ===",
            "itemFocused before populate = -1",
            "itemFocused after populate (unfocused) = -1",
            "focusing the list",
            "onItemFocused index =  0",
            "=== List Initial Focus Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Defers a focusedChild notification raised during init() so a later-registered observer fires", async () => {
        let command = ["node", brsCliPath, "-r init-focus-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // init() sets focus FIRST, then registers the focusedChild observers AFTER, in the same init.
        // Verified on a real Roku: focus notifications from setFocus() in init() dispatch from the
        // message loop after init returns, so the later-registered observers still fire (once each).
        // Before the fix the simulator dispatched focusedChild synchronously during setFocus() -
        // when no observer existed yet - so the notification was lost. The fix defers the init-time
        // focus notification and delivers it from the message loop after init: the observers
        // therefore fire AFTER "init done".
        //
        // Double-fire guard: onSceneFocus re-focuses `outer` inside its handler, which rewrites
        // `outer.focusedChild` inline. `outer` is still queued for delivery, so without the
        // consume-on-dispatch fix its observer would fire twice. onOuterFocus must appear once.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Init Focus Observer Repro ===",
            "before setFocus",
            "init done",
            "onSceneFocus fired",
            "onOuterFocus fired",
            "=== Init Focus Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("A reentrant observer that rewrites its own alwaysNotify field does not loop", async () => {
        let command = ["node", brsCliPath, "-r observer-loop-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // aliasField is alwaysNotify with an onChange (onAlias) that writes the same field back to
        // itself. A direct BrightScript assignment dispatches synchronously even inside another
        // observer (only engine-initiated emissions defer), so onAlias runs nested inside
        // onSelected and the per-field notifying guard suppresses the re-entrant self-write.
        // onAlias must fire exactly once.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Observer Loop Repro ===",
            "onSelected",
            "onAlias count= 1",
            "onSelected done",
            "=== Observer Loop Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Two cross-aliased alwaysNotify fields whose observers write each other do not loop", async () => {
        let command = ["node", brsCliPath, "-r cross-alias-loop-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // fieldF.onChange writes fieldG and fieldG.onChange writes fieldF (both alwaysNotify),
        // reassigned from inside an observer. Direct BrightScript assignments dispatch
        // synchronously/nested even when reentrant (only engine-initiated emissions defer), so the
        // per-field notifying guards (F held while G runs) terminate the cascade in one round.
        // Each observer fires exactly once (the manual field-alias ping-pong flood).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Cross Alias Loop Repro ===",
            "onStart",
            "onF count= 1",
            "onG count= 1",
            "onStart done",
            "=== Cross Alias Loop Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Dispatches a direct field assignment's observer synchronously inside another observer", async () => {
        let command = ["node", brsCliPath, "-r observer-readback-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A panel-creation observer builds a menu by assigning a detached item component's
        // itemContent and immediately reading back the calculatedWidth its observer computes
        // (the fit-to-content list-sizing pattern). The assignment is direct BrightScript, so
        // its observer must run synchronously even one observer level deep — deferring it makes
        // the read-back see 0 and the menu collapses to zero width.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Observer Readback Repro ===",
            "onBuild",
            "widest > 0: true",
            "onBuild done",
            "=== Observer Readback Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Poster preload-and-swap: the loadStatus observer's uri clear is not clobbered", async () => {
        let command = ["node", brsCliPath, "-r poster-preload-swap-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The preloader's loadStatus="ready" observer copies its uri onto the visible poster and then
        // clears its own uri (""). The Poster must commit the uri field BEFORE the synchronous load +
        // loadStatus notification so that clear sticks; otherwise a trailing re-commit reverts the
        // preloader's uri to the loaded image.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Poster Preload Swap Repro ===",
            "visiblePoster.uri = common:/images/icon_options.png",
            "preloadPoster.uri =",
            "=== Poster Preload Swap Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Allows redeclaring an inherited system field but still blocks XML duplicate fields", async () => {
        let command = ["node", brsCliPath, "-r duplicate-system-field-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A field inherited from a built-in base type (a "system" field) may be redeclared in
        // XML: the redeclared default is re-applied (opacity -> 0.5) and any field declared after
        // it (customField) is still added. Before the fix the duplicate-field guard fired on the
        // inherited "opacity", aborting addFields so both were lost.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Duplicate System Field Repro ===",
            "opacity =  0.5",
            "customField = hello",
            "sharedField = base",
            "afterField type = Invalid",
            "=== Duplicate System Field Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        // Redeclaring the inherited system field must NOT warn...
        expect(stderr).not.toContain('duplicate field "opacity"');
        // ...but redeclaring a field defined in an ancestor XML component still must.
        expect(stderr).toContain('Attempt to add duplicate field "sharedField" to RokuML component "XmlChildComp"');
    }, 30000);

    it("Restores the m context on a rebuilt custom component so callFunc sees m.top/m.global", async () => {
        let command = ["node", brsCliPath, "-r clone-callfunc-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A custom component subclassing a data node is rebuilt through createFlatNode (the same
        // path a cross-thread Task copy takes; clone() exercises it single-threaded). Before the fix
        // the rebuilt node had an empty `m`, so invoking a public function via callFunc ran with an
        // invalid `m.top` and crashed. Both fields must now resolve.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Clone CallFunc Repro ===",
            "clone subtype = MyData",
            "readTop = MyData",
            "readGlobal = VALID_GLOBAL",
            "=== Clone CallFunc Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Reparents a node when it is attached to a different parent", async () => {
        let command = ["node", brsCliPath, "-r reparent-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // On Roku a node has exactly one parent: appendChild/insertChild/replaceChild detach the
        // node from its previous parent. Before the fix the old parent kept the node in its
        // children array, so the render traversal drew the subtree twice — once inside the new
        // (translated) container and once at the node's raw position under the old parent.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Reparent Repro ===",
            "root child count =  1",
            "inner child count =  1",
            "moved parent is inner = true",
            "a child count =  0",
            "b child count =  1",
            "c parent is b = true",
            "b child count after insert =  0",
            "c parent is d = true",
            "d child count after replace =  0",
            "c parent is e = true",
            "=== Reparent Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Loads Library statements declared in component scripts into the component scope", async () => {
        let command = ["node", brsCliPath, "-r component-library-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A `Library` statement in a component <script> must load the library's functions
        // into that component's scope (Roku_Ads is required by the manifest), while the
        // manifest gate still keeps out declared-but-not-required libraries (IMA3).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Component Library Repro ===",
            "rafType = roAssociativeArray",
            "adUrl = http://ads.example.com/preroll",
            "podCount =  1",
            "libVersion = 3.5",
            "imaLoaded = not loaded",
            "=== Component Library Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Guards bounding-rect refresh renders against re-entrant measurement", async () => {
        let command = ["node", brsCliPath, "-r grid-measure-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A bounding-rect query outside a frame render refreshes layout by rendering the whole
        // tree, lazily creating grid item components. An item's field observer calling
        // boundingRect() inside that refresh must reuse the active pass (sgRoot.rendering guard)
        // instead of starting another refresh — item creation would re-enter itself and overflow
        // the JS call stack ('roSGNode.Set: Maximum call stack size exceeded').
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Grid Measure Repro ===",
            "onHeightChange measured height =  72",
            "onHeightChange measured height =  72",
            "onHeightChange measured height =  72",
            "grid rect height =  240",
            "=== Grid Measure Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Sets an attached Panel's height from the PanelSet, firing observers registered in init()", async () => {
        let command = ["node", brsCliPath, "-r panel-height-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Per the Roku spec, Panel.height defaults to -1 and "will be set by the PanelSet";
        // apps observe their panel's height in init() (before appendChild) to size
        // panel-local UI. The attach-time write must be a notifying setValue, and a later
        // PanelSet height change must propagate to attached panels.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Panel Height Repro ===",
            "init height = -1",
            "detached height = -1",
            "observed height =  1080",
            "attached height =  1080",
            "observed height =  720",
            "resized height =  720",
            "=== Panel Height Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Reports a RowList's newly focused item at the settled focus band, not its pre-scroll position", async () => {
        let command = ["node", brsCliPath, "-r rowlist-subrect-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A RowList lays out its focused row at the fixed focus band (renderNode sets currRow =
        // focusIndex). After a vertical focus change, an app's rowItemFocused observer measures the
        // newly focused item synchronously via subBoundingRect BEFORE the next frame re-lays-out the
        // grid, so the cached item rect is stale (the item still sits at its previous, pre-scroll
        // stacked position). subBoundingRect must refresh layout when a focus change is pending so it
        // reports the settled band position — matching a real device where the observer fires
        // post-layout. Without the refresh, row 1 reads its stacked y (band + one row height).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== RowList SubRect Repro ===",
            "band row0 y = -15",
            "focused row1 y = -15",
            "SAME BAND: true",
            "=== RowList SubRect Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);
    it("Measures a freshly-created grid item's content during the render pass that creates it", async () => {
        let command = ["node", brsCliPath, "-r button-measure-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Repro of a fit-to-content button's pill background collapsing to a circle. An ArrayGrid
        // lazily creates each item component and assigns its itemContent DURING the grid's render
        // pass. The item's itemContent observer sets its label text and then sizes a background from
        // elementsGroup.boundingRect().width (as EnhancedButton.renderButton does). That measurement
        // runs while sgRoot.rendering is true, on a content subtree the pass has not laid out yet.
        // getBoundingRect must render just that unmeasured subtree (not skip and return a stale 0),
        // so the content width is real and the background is not collapsed. Before the fix every
        // measurement read 0 (in the app: a 9-patch pill drawn at its corner sum — a circle).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Button Measure Repro ===",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "grid rect height =  156",
            "=== Button Measure Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);
    it("Builds the layout-pass performance probe (70 self-measuring components)", async () => {
        let command = ["node", brsCliPath, "-r layout-perf-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Committed form of the synthetic probe from docs/scenegraph-layout-passes.md: 70 custom
        // components in a LayoutGroup, each measuring itself with boundingRect() from its `value`
        // observer, so every append triggers a full-tree layout refresh. Only correctness is
        // asserted (the layout height proves all 70 tiles laid out and stacked); the per-tile
        // timings it prints are for the human device-shape comparison — flat per-component cost —
        // and would be flaky as assertions. Height: 70 tiles * 60 + 69 gaps * 8 = 4752.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Layout Perf Probe ===");
        expect(lines).toContain("tiles =  70");
        // 70 tiles, each 60 (background) + label rows overflow = stacked LayoutGroup height;
        // proves all 70 laid out. Kept exact so tile-content changes are deliberate.
        expect(lines).toContain("layout height =  15532");
        expect(lines).toContain("=== Layout Perf Probe Complete ===");
        for (const marker of ["q1 tile ms = ", "q2 tile ms = ", "q3 tile ms = ", "q4 tile ms = ", "total ms = "]) {
            expect(lines.some((line) => line.startsWith(marker))).toBe(true);
        }
    }, 60000);
    it("Pruned layout refreshes agree with unpruned refreshes (BRS_PRUNE_DISABLE)", async () => {
        // The pruned refresh (default) and a fully unpruned run must produce identical program
        // output across refresh-heavy workloads: 70 self-measuring components whose observers
        // print measured heights, and re-entrant grid item creation printing measured rects. Any
        // rect a pruned pass got wrong would change these printed values.
        for (const app of ["layout-perf-app", "grid-measure-app"]) {
            let command = ["node", brsCliPath, `-r ${app}`, "source/main.brs", "-c 0"].join(" ");
            const pruned = await exec(command, { cwd: path.join(__dirname, "resources") });
            const unpruned = await exec(command, {
                cwd: path.join(__dirname, "resources"),
                env: { ...process.env, BRS_PRUNE_DISABLE: "1" },
            });
            const strip = (stdout) =>
                stdout
                    .split("\n")
                    .map((line) => line.trimEnd())
                    .filter((line) => !/^(q\d tile|total) ms = /.test(line)); // timings vary
            expect(strip(pruned.stdout)).toEqual(strip(unpruned.stdout));
        }
    }, 120000);
    it("Resolves a component method in call position when an XML field shadows its name", async () => {
        let command = ["node", brsCliPath, "-r method-shadow-field-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A component may declare an <interface> field named after a built-in method
        // (e.g. isInFocusChain). On Roku the field only shadows the method for reads:
        // call syntax still resolves the interface method, while plain reads and
        // observeField target the XML field (a custom progress-bar component relies on this).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Method Shadow Field Repro ===",
            "init call isInFocusChain() = false",
            "observer fired with true",
            "field read = true",
            "method call = false",
            "=== Method Shadow Field Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Runs a SceneGraph Task on a worker thread with cross-thread rendezvous", async () => {
        let command = ["node", brsCliPath, "-r task-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The Task's functionName runs on a dedicated worker thread: reading `input` and
        // writing `result` both rendezvous with the render thread, and the observer fires
        // back on the render thread. Debug lines from the task machinery may interleave,
        // so assert the key lines instead of the exact output.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Thread Repro ===");
        expect(lines).toContain("TASK RESULT: from-task-thread:ping");
        expect(lines).toContain("=== Task Thread Repro Complete ===");
        expect(lines).toContain("------ Finished 'main.brs' execution [EXIT_USER_NAV] ------");
    }, 30000);

    it("Delivers a field set from one Task thread to another Task's thread", async () => {
        let command = ["node", brsCliPath, "-r task-pool-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Worker-pool apps park a long-lived Task on a port and dispatch to it from other Task
        // threads. That write was silently dropped: `Task.setValue` synced through the *target*
        // Task as transport, but a foreign Task node is only a deserialized copy with no thread
        // of its own (`threadId < 0`), so `syncRemoteField` returned early and nothing crossed.
        // The coordinator's notification broke separately: `observeField(field, port)` from a task
        // thread rendezvouses to the render thread, where the port is rebuilt as a fresh empty
        // RoMessagePort, so the render side held a dead observer and the task's real port never
        // fired. `task`-domain fan-out was also skipped wholesale, which is what "WATCHER SAW"
        // guards — a coordinator watching a pool slot it does not own.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Pool Repro ===");
        expect(lines).toContain("SLOT READY");
        expect(lines).toContain("WATCHER READY");
        expect(lines).toContain("DISPATCH: sent");
        expect(lines).toContain("SLOT RESPONSE: echo:ping");
        expect(lines).toContain("WATCHER SAW: echo:ping");
        // The blocking-request pattern: the caller builds a node, port-observes it while it is
        // still task-owned (so that observeField never rendezvouses), then hands it over. The
        // render thread only learns a port is waiting from the `_observed_` data carried across.
        expect(lines).toContain("DISPATCH GOT: echo:ping");
        expect(lines).toContain("DISPATCHER REPLY: echo:ping");
        // One dispatch must raise exactly one event. The owner answers a rendezvous *read* with an
        // update whose action is `set`, and applying it with notification made reading a field
        // indistinguishable from changing it: the slot's own `req = m.top.request` re-fired its port,
        // and an assocarray field always compares unequal so it never settled. A continuous-server
        // loop then re-ran the same work indefinitely, and a coordinator keying completions off such
        // a port credited responses to the wrong caller.
        expect(lines).toContain("SLOT EVENT #1");
        expect(lines).not.toContain("SLOT EVENT #2");
        expect(lines).not.toContain("WATCHER PHANTOM EVENT");
        expect(lines).toContain("=== Task Pool Repro Complete ===");
        expect(lines).toContain("------ Finished 'main.brs' execution [EXIT_USER_NAV] ------");
    }, 30000);

    it("Delivers a field change to a port a Task registered during init()", async () => {
        let command = ["node", brsCliPath, "-r task-globalobserve-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The documented Task pattern (docs/limitations.md): the task registers a port observer in
        // init() — which runs on the render thread, so it never goes through the rendezvous
        // observeField path — and consumes events from its own thread. The only record that the task
        // is waiting is the `hostNode` on the observer callback, so cross-thread fan-out has to
        // attribute observers by it. Picking fan-out targets any other way either misses this task or
        // (if it answers "observed" for every scope) broadcasts each update to all of them.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Global Observe Repro ===");
        expect(lines).toContain("TASK READY");
        expect(lines).toContain("OBSERVER GOT: hello");
        expect(lines).toContain("SCENE SAW: hello");
        expect(lines).not.toContain("OBSERVER: timed out");
        expect(lines).toContain("=== Task Global Observe Repro Complete ===");
    }, 30000);

    it("Delivers a field set between control=run and task launch exactly once", async () => {
        let command = ["node", brsCliPath, "-r task-prelaunch-events-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // `control = "run"` activates the task synchronously (turning render->task fan-out on), but
        // the payload that carries the pre-launch port backlog is only posted on the next
        // processTasks pass. A write landing in between used to be captured by both paths and
        // arrive twice. Both sides of that boundary are asserted here: writes issued *before*
        // control=run must still arrive (they have no other carrier), and writes issued after it
        // must arrive exactly once — including one on m.global, which reaches the task by a
        // different fan-out route than the task node's own fields.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Pre-launch Events Repro ===");
        expect(lines).toContain(
            "TASK SAW: request=before-1,request=before-2,request=after-1,request=after-2,ticket=global-1"
        );
        expect(lines).toContain("SCENE REPORT: 5 events");
        expect(lines).toContain("=== Task Pre-launch Events Repro Complete ===");
    }, 30000);

    it("Terminates the app when a Task thread hits an uncaught error", async () => {
        let command = ["node", brsCliPath, "-r task-crash-app", "source/main.brs", "-c 0"].join(" ");

        // The crash makes the CLI exit non-zero, so the output comes off the rejection.
        let stdout = "";
        let stderr = "";
        try {
            ({ stdout, stderr } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            }));
        } catch (err) {
            stdout = err.stdout ?? "";
            stderr = err.stderr ?? "";
        }
        // An uncaught error in a Task thread terminates the app on a device (device-verified), which
        // is also what the engine does for the app thread and what the browser API already did for a
        // task worker — a task's `end,` reaches the same handler as the app worker's. The Node host
        // relayed it as plain output instead, so the app carried on running with a dead task thread.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Crash Repro ===");
        expect(lines).toContain("STATE: run");
        expect(lines).toContain("TASK CRASHING");
        expect(lines).not.toContain("TASK NOT REACHED");
        expect(stdout + stderr).toContain("'Dot' Operator attempted with invalid BrightScript Component");
        // The app is gone: its own completion print (after the render thread's wait loop) is never
        // reached, and the run ends on the crash reason rather than a normal exit.
        expect(lines).not.toContain("=== Task Crash Repro Complete ===");
        expect(stdout).toContain("[EXIT_BRIGHTSCRIPT_CRASH]");
    }, 30000);

    it("Notifies a Task's port when it mutates a ContentNode held by an observed field", async () => {
        let command = ["node", brsCliPath, "-r task-contentcache-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A ContentNode assigned to a node-typed field notifies that field's observers when its own
        // content changes (`ContentNode.notifyParentFields`) — but that path starts from the field,
        // not from the node holding it, so it skipped the cross-thread fan-out `Node.setValue` does.
        // A task mutating such a ContentNode (a rendezvous call, applied on the render thread) then
        // never heard back about its own change and waited forever.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task ContentCache Repro ===");
        expect(lines).toContain("TASK SAW CACHE CHANGE 1");
        expect(lines).toContain("TASK SAW CACHE CHANGE 2");
        expect(lines).toContain("TASK SAW CACHE CHANGE 3");
        expect(lines).toContain("SCENE SAW ROWS:  3");
        expect(lines).toContain("=== Task ContentCache Repro Complete ===");
    }, 30000);

    it("Clears a node-valued field set to invalid from a Task thread", async () => {
        let command = ["node", brsCliPath, "-r task-clear-node-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Setting a node-valued field to `invalid` from a task sends an update whose value is null.
        // The render side read `_address_` off it to decide whether to reconcile against the node it
        // already held, which threw and aborted the whole task-update pass — the task's later writes
        // never landed and the app hung waiting for them.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("PAYLOAD: Payload");
        expect(lines).toContain("PAYLOAD: invalid");
        expect(lines).toContain("FINISHED: task completed");
        expect(lines).toContain("=== Task Clear Node Repro Complete ===");
    }, 30000);

    it("Resolves an anonymous function observer registered by its toStr() name", async () => {
        let command = ["node", brsCliPath, "-r anon-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // rokucommunity/promises (used by Rooibos node tests) registers a callback by identifying an
        // anonymous function via the name reported by toStr(), then passing that name to observeField.
        // brs-engine names anonymous functions "$anon_..." but did not make them resolvable by that
        // name, so observeField silently failed and the Timer's "fire" observer never ran (every
        // @SGNode Rooibos suite hung). The anonymous-callable registry makes the name resolve again.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Anon Observer Repro ===",
            "observe ok=true",
            "OBSERVER FIRED",
            "=== Anon Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    // This asserts a ~20ms wall-clock budget around a 125ms Timer chain, so it is opted out of the
    // suite's concurrency (not measured while sibling CLI child processes run) and retried: under a
    // fully loaded machine, scheduler noise alone can push a healthy run past the bound. Retrying is
    // safe because the regression it guards is systematic - the frame-throttle coupling made *every*
    // run ~160ms+ - so a genuine regression still fails all attempts.
    it.sequential(
        "Resolves a chain of near-zero-duration Timer nodes without frame-period latency per hop",
        { retry: 2 },
        async () => {
            let command = ["node", brsCliPath, "-r timer-hop-app", "source/main.brs", "-c 0"].join(" ");

            let { stdout } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            // Rooibos-promises resolves promises via a chain of "essentially next tick" SGNode Timers
            // (duration ~0). Timer polling used to be coupled to the screen's frame-rate-limiting busy
            // wait, so each hop in the chain could cost up to a full frame period even though its nominal
            // duration was ~0 - a 125ms Timer plus two such hops measured ~160ms+ instead of ~125ms (this
            // is what made a Rooibos test that passes on a real device fail in brs-desktop/brs-cli). With
            // polling decoupled from the frame throttle, the whole chain resolves within a few ms of the
            // Timer's own duration.
            const match = stdout.match(/total elapsed=\s*(\d+)/);
            expect(match).not.toBeNull();
            const elapsedMs = Number(match[1]);
            expect(elapsedMs).toBeGreaterThanOrEqual(125);
            expect(elapsedMs).toBeLessThan(145);
        },
        30000
    );

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
    }, 30000);

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
    }, 30000);

    it("ButtonGroup leaves custom (non-Button) children unmanaged", async () => {
        let command = ["node", brsCliPath, "-r buttongroup-custom-children-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a keyboard screen whose bottom row is a built-in ButtonGroup used purely as a
        // horizontal layout container for custom Group-based button components, with the screen
        // moving focus between them via setFocus(). The group must not manage such children: it
        // used to capture them into `buttons`, re-stack them vertically at x=0 (drawing the right
        // button over the left), steal focus back to index 0 on every render, and consume OK —
        // firing buttonSelected for the wrong (hidden) button.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ButtonGroup Custom Children Repro ===",
            "left x =  0",
            "right x =  216",
            "left text = Left",
            "right text = Right",
            "right hasFocus = true",
            "left hasFocus = true",
            "right x after focus =  216",
            "children count =  2",
            "=== ButtonGroup Custom Children Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("PanelSet creates the right panel on item focus without hasNextPanel", async () => {
        let command = ["node", brsCliPath, "-r panelset-nextpanel-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a sliding-panels settings screen showing only its left menu. The right detail
        // panel is created via the createNextPanelOnItemFocus mechanism: focusing a grid item sets
        // createNextPanelIndex, and the app responds by setting nextPanel. That whole chain must be
        // driven by createNextPanelOnItemFocus, NOT gated on hasNextPanel (which only governs the
        // right-arrow indicator / forward navigation to a further panel). Before the fix the menu
        // panel's hasNextPanel was false, so the nextPanel callback was never wired: no second panel
        // was appended and numPanels stayed 1.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== PanelSet NextPanel Repro ===",
            "before focus numPanels =  1",
            "created right panel for index  0",
            "after focus numPanels =  2",
            "=== PanelSet NextPanel Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("PanelSet clears the trailing detail panel when the app supplies no next panel", async () => {
        let command = ["node", brsCliPath, "-r panelset-clearpanel-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a sliding-panels settings menu. The left ListPanel uses the
        // createNextPanelOnItemFocus mechanism: focusing a menu item sets createNextPanelIndex and the
        // app responds by assigning a detail Panel to nextPanel. Item 0 supplies a focusable detail
        // panel (numPanels 1 -> 2); item 1 supplies an informational About panel that replaces it
        // (numPanels stays 2); item 2 ("Exit") supplies NO panel — the engine must then clear the
        // trailing detail panel so only the menu remains (numPanels drops back to 1). Before the fix
        // the stale previous detail panel was kept, matching neither Roku nor the app's intent.
        // Returning to item 0 re-creates its detail panel (1 -> 2). Re-focusing the SAME item (as the
        // PanelSet does when focus returns from the left) re-fires createNextPanelIndex for that index;
        // the app re-supplies the same panel and it must NOT be cleared (numPanels stays 2) — the clear
        // only runs on a genuine move to a new item whose app supplies nothing.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== PanelSet ClearPanel Repro ===",
            "item 0 numPanels =  2",
            "item 1 numPanels =  2",
            "item 2 numPanels =  1",
            "back to 0 numPanels =  2",
            "re-focus 0 numPanels =  2",
            "=== PanelSet ClearPanel Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

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
    }, 30000);

    it("includes the source location in roArray warnings (dev mode)", async () => {
        let command = ["node", brsCliPath, "roArrayWarnings.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
            env: { ...process.env, NODE_ENV: "development" },
        });

        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "join result: []",
            "done",
            "------ Finished 'roArrayWarnings.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        expect(stderr).toContain(
            "roArray.Join: Array contains non-string value(s). pkg:/source/roArrayWarnings.brs(4)"
        );
        expect(stderr).toContain("roArray.Sort: Flags contains invalid option(s). pkg:/source/roArrayWarnings.brs(8)");
        expect(stderr).toContain(
            "roArray.SortBy: Flags contains invalid option(s). pkg:/source/roArrayWarnings.brs(12)"
        );
    }, 30000);

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
        }, 30000);

        afterAll(() => {
            if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it("encrypts the whole package container (not a readable zip without the password)", () => {
            const raw = new Uint8Array(fs.readFileSync(bpkPath));
            // Container starts with the BRSBPK1 magic, not the "PK" zip header.
            expect(Array.from(raw.subarray(0, BPK_MAGIC.length))).toEqual(BPK_MAGIC);
            // The plaintext assets are not extractable without the password.
            expect(() => unzipSync(raw)).toThrow();
        }, 30000);

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
        }, 30000);

        it("runs the encrypted SceneGraph app with the correct password", async () => {
            const { stdout } = await exec(
                ["node", brsCliPath, '"' + bpkPath + '"', "--pack", password, "-c 0"].join(" ")
            );
            const lines = stdout.split("\n").map((line) => line.trimEnd());
            expect(lines).toEqual(expect.arrayContaining(expected));
        }, 30000);

        it("fails cleanly with a wrong password", async () => {
            // A wrong password fails at the container layer, before any source is touched.
            const { stderr } = await exec(
                ["node", brsCliPath, '"' + bpkPath + '"', "--pack", "x".repeat(32), "-c 0"].join(" ")
            ).catch((e) => e);
            expect(stderr).toContain("Invalid password for the encrypted package");
        }, 30000);

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
            }, 30000);

            it("prunes the empty component directory tree to a single marker", async () => {
                const entries = Object.keys(unzipSync(await decryptBpk(fs.readFileSync(protBpk), password)));
                const componentEntries = entries.filter((e) => e.toLowerCase().startsWith("components/"));
                // The components/sub/ tree (which only held encrypted files) is gone; only the marker remains.
                expect(componentEntries).toEqual(["components/"]);
            }, 30000);

            it("does not let BrightScript read the decrypted component source", async () => {
                const { stdout } = await exec(
                    ["node", brsCliPath, '"' + protBpk + '"', "--pack", password, "-c 0"].join(" ")
                );
                expect(stdout).toContain("READBRS:[]");
                expect(stdout).toContain("READXML:[]");
                expect(stdout).toContain("LISTDIR_COUNT:0");
                expect(stdout).not.toContain("TOP_SECRET");
            }, 30000);
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
        }, 30000);

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
        }, 30000);
    });

    // Shares a `server` handle across tests, so these must not overlap with each other.
    describe.sequential("ECP query/r2d2-bitmaps", () => {
        const http = require("http");
        const net = require("net");
        let server;
        let ecpPort;
        let url;

        /**
         * Reserves a free port by binding to 0 and releasing it.
         *
         * The ECP server defaults to Roku's fixed 8060, which anything else on the machine may
         * already hold — a desktop build of the engine, another instance, a remote-control tool.
         * These tests then fail for a reason that has nothing to do with the code, so they bind
         * somewhere unoccupied via BRS_ECP_PORT instead.
         */
        function reserveFreePort() {
            return new Promise((resolve, reject) => {
                const probe = net.createServer();
                probe.unref();
                probe.on("error", reject);
                probe.listen(0, "127.0.0.1", () => {
                    const { port } = probe.address();
                    probe.close(() => resolve(port));
                });
            });
        }

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

        beforeEach(async () => {
            ecpPort = await reserveFreePort();
            url = `http://localhost:${ecpPort}/query/r2d2-bitmaps`;
        });

        afterEach(() => {
            server?.kill("SIGKILL");
            server = undefined;
        });

        /** Spawns the CLI with the ECP server bound to this test's reserved port. */
        function spawnEcp(args) {
            return child_process.spawn("node", [brsCliPath, ...args], {
                cwd: path.join(__dirname, "resources"),
                env: { ...process.env, BRS_ECP_PORT: String(ecpPort) },
            });
        }

        it("returns texture-memory data for the running app's bitmaps and fonts in debug mode", async () => {
            server = spawnEcp(["-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp", "--debug"]);
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
            server = spawnEcp(["-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp"]);
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
