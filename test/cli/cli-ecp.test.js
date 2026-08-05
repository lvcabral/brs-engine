const path = require("path");
const fs = require("fs");
const os = require("os");
const {
    brsCliPath,
    zipFolder,
    reserveFreePort,
    httpGet,
    httpPost,
    waitForEndpoint,
    waitForStdout,
    spawnEcp,
} = require("./cli-test-utils");

// The ECP debug endpoints (`--ecp`). Unlike the other cli-*.test.js files these opt out of
// concurrency via `describe.sequential`: each block spawns a long-lived CLI server and shares a
// `server` handle across its own tests, so those must not overlap with each other (a reserved
// free port keeps them independent of anything else on the machine, including a sibling suite).
// See cli.test.js for non-SceneGraph CLI behavior, cli-scenegraph.test.js for SceneGraph runtime
// behavior, and cli-bpk.test.js for `.bpk` packaging/encryption.

describe.sequential("ECP query/r2d2-bitmaps", () => {
    let server;
    let ecpPort;
    let url;

    beforeEach(async () => {
        ecpPort = await reserveFreePort();
        url = `http://localhost:${ecpPort}/query/r2d2-bitmaps`;
    });

    afterEach(() => {
        server?.kill("SIGKILL");
        server = undefined;
    });

    it("returns texture-memory data for the running app's bitmaps and fonts in debug mode", async () => {
        server = spawnEcp(
            ["-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp", "--debug"],
            path.join(__dirname, "resources"),
            ecpPort
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
        server = spawnEcp(
            ["-r", "r2d2-bitmaps-app", "source/main.brs", "--ecp"],
            path.join(__dirname, "resources"),
            ecpPort
        );
        // Wait until the app has created its bitmaps, then confirm the registry stayed empty.
        await waitForStdout(server, "R2D2 ready");
        const xml = await waitForEndpoint(url, (body) => body.includes("<status>OK</status>"));

        expect(xml).toContain("<r2d2-bitmaps>");
        expect(xml).not.toContain("<bitmap>");
        expect(xml).not.toContain("pkg:/images/alpha.png");
    }, 30000);
});

describe.sequential("ECP query/sgrendezvous", () => {
    let server;
    let ecpPort;
    let trackUrl;
    let queryUrl;
    let untrackUrl;
    let tmpDir;
    let zipPath;

    beforeEach(async () => {
        ecpPort = await reserveFreePort();
        trackUrl = `http://localhost:${ecpPort}/sgrendezvous/track`;
        queryUrl = `http://localhost:${ecpPort}/query/sgrendezvous`;
        untrackUrl = `http://localhost:${ecpPort}/sgrendezvous/untrack`;
        // Run from a real zip package (not `-r`/`--root`) so `<file>` in the response matches
        // how a packaged app resolves `pkg:/...` paths — `--root` mode records component script
        // locations relative to the mounted folder, which would leak the fixture's folder name.
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brs-sgrdz-"));
        zipPath = path.join(tmpDir, "app.zip");
        fs.writeFileSync(zipPath, zipFolder(path.join(__dirname, "resources", "sgrendezvous-app")));
    });

    afterEach(() => {
        server?.kill("SIGKILL");
        server = undefined;
        if (tmpDir) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("tracks and reports SceneGraph cross-thread rendezvous events in debug mode", async () => {
        server = spawnEcp([zipPath, "--ecp", "--debug"], path.join(__dirname, "resources"), ecpPort);
        await waitForStdout(server, "SGRENDEZVOUS ready");

        const trackXml = await httpPost(trackUrl);
        expect(trackXml).toContain("<sgrendezvous>");
        expect(trackXml).toContain("<tracking-enabled>true</tracking-enabled>");

        // The task rendezvouses every 200ms, so a couple of poll cycles are enough to catch one.
        const xml = await waitForEndpoint(queryUrl, (body) => body.includes("<item>"), 40, 200);
        expect(xml).toContain("<sgrendezvous>");
        expect(xml).toContain("<tracking-enabled>true</tracking-enabled>");
        expect(xml).toContain("<plugin-id>dev</plugin-id>");
        expect(xml).toContain("<plugin-title>SGRendezvous Test</plugin-title>");
        expect(xml).toMatch(/<id>\d+<\/id>/);
        expect(xml).toMatch(/<start-tm>\d+<\/start-tm>/);
        expect(xml).toMatch(/<end-tm>\d+<\/end-tm>/);
        expect(xml).toMatch(/<line-number>\d+<\/line-number>/);
        expect(xml).toMatch(/<file>pkg:\/[^<]+<\/file>/);
        expect(xml).toContain("<status>OK</status>");

        const untrackXml = await httpPost(untrackUrl);
        expect(untrackXml).toContain("<tracking-enabled>false</tracking-enabled>");
    }, 30000);

    it("reports tracking disabled and no events in production mode (no --debug)", async () => {
        server = spawnEcp([zipPath, "--ecp"], path.join(__dirname, "resources"), ecpPort);
        await waitForStdout(server, "SGRENDEZVOUS ready");

        const trackXml = await httpPost(trackUrl);
        expect(trackXml).toContain("<tracking-enabled>false</tracking-enabled>");

        // Give the task a couple of rendezvous cycles, then confirm none were queued.
        await new Promise((r) => setTimeout(r, 700));
        const xml = await httpGet(queryUrl);
        expect(xml).toContain("<tracking-enabled>false</tracking-enabled>");
        expect(xml).toContain("<count>0</count>");
        expect(xml).not.toContain("<item>");
    }, 30000);
});
