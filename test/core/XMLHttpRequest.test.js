import http from "node:http";
import { XMLHttpRequest } from "../../src/core/polyfill/XMLHttpRequest.ts";
const { pollUntil } = require("../testUtils/pollUntil");

// The Node XMLHttpRequest polyfill parses request URLs with the WHATWG URL API: `url.parse()` is
// deprecated (DEP0169), and on Node 24 its warning, printed from the background worker, hung the
// CLI. Node 22 only reports it with --pending-deprecation, so this asserts on Node 24 (CI).
describe("XMLHttpRequest polyfill", () => {
    let server;
    let port;
    const warnings = [];
    const onWarning = (warning) => warnings.push(warning.code ?? warning.name);

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === "/redirect") {
                res.writeHead(302, { Location: "/text?x=1" });
                res.end();
            } else {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end(`${req.headers.host} ${req.url}`);
            }
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        port = server.address().port;
        process.on("warning", onWarning);
    });

    afterAll(async () => {
        process.off("warning", onWarning);
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    async function get(url) {
        const xhr = new XMLHttpRequest();
        let done = false;
        xhr.addEventListener("loadend", () => {
            done = true;
        });
        xhr.open("GET", url, true);
        xhr.send();
        expect(await pollUntil(() => done)).toBe(true);
        return xhr;
    }

    it("requests a URL's host, port, path and query", async () => {
        const xhr = await get(`http://127.0.0.1:${port}/text?a=b`);
        expect(xhr.status).toBe(200);
        expect(xhr.responseText).toBe(`127.0.0.1:${port} /text?a=b`);
    });

    it("follows a redirect", async () => {
        const xhr = await get(`http://127.0.0.1:${port}/redirect`);
        expect(xhr.responseText).toBe(`127.0.0.1:${port} /text?x=1`);
    });

    it("rejects an unsupported protocol", () => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "ftp://127.0.0.1/file", true);
        expect(() => xhr.send()).toThrow("Protocol not supported.");
    });

    it("emits no url.parse() deprecation warning", async () => {
        await new Promise((resolve) => setImmediate(resolve));
        expect(warnings).not.toContain("DEP0169");
    });
});
