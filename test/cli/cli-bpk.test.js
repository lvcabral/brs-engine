const path = require("path");
const fs = require("fs");
const os = require("os");
const { zipSync, unzipSync, strToU8 } = require("fflate");
const { exec, brsCliPath, zipFolder, decryptBpk, BPK_MAGIC } = require("./cli-test-utils");

// `--pack`/.bpk packaging & encryption. Each test spawns its own isolated `node brs.cli.js`
// child process and shares no in-process state, so they run concurrently (capped by
// `maxConcurrency` in vitest.config.mts). See cli.test.js for non-SceneGraph CLI behavior,
// cli-scenegraph.test.js for SceneGraph runtime behavior, and cli-ecp.test.js for ECP endpoints.
describe.concurrent("cli bpk", () => {
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
});
