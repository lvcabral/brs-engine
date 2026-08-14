const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec, brsCliPath } = require("./cli-test-utils");

// Each test spawns its own isolated `node brs.cli.js` child process and shares no in-process
// state, so they run concurrently (capped by `maxConcurrency` in vitest.config.mts). Related
// suites live in sibling files: SceneGraph runtime behavior in cli-scenegraph.test.js, `.bpk`
// packaging/encryption in cli-bpk.test.js, and the ECP endpoints in cli-ecp.test.js (which opt
// out of concurrency via `describe.sequential` since they share a bound port per test block).
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

    it("roAnimatedImage: SetContent/SetPretranslation/Draw*Object end-to-end", async () => {
        // Proves the roAnimatedImage/ifAnimatedImage surface works end-to-end against a real
        // animated WebP: local pkg: load, ready event (GetMessage/GetInfo), GetWidth/Height,
        // pretranslation, and compatibility as a DrawObject/DrawRotatedObject/DrawScaledObject
        // source.
        let command = ["node", brsCliPath, "--root .", "roAnimatedImage.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "SetContent returned:true",
            "ready message:ready",
            "ready id:true",
            "width: 4",
            "height: 4",
            "pretranslation x:-2",
            "pretranslation y:-2",
            "drew roAnimatedImage via DrawObject/DrawRotatedObject/DrawScaledObject",
            "------ Finished 'roAnimatedImage.brs' execution [EXIT_USER_NAV] ------",
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
        // Regression: node-canvas v4-rc1 aborts the process (SIGTRAP) when its text APIs
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

    it.todo("add tests for the remaining CLI options");
});
