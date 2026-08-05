const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const { promisify } = require("util");
const { zipSync } = require("fflate");

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

/**
 * Reserves a free port by binding to 0 and releasing it.
 *
 * The ECP server defaults to Roku's fixed 8060, which anything else on the machine may already
 * hold - a desktop build of the engine, another instance, a remote-control tool. Binding
 * somewhere unoccupied via BRS_ECP_PORT keeps these tests independent of that.
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

/** Performs an HTTP POST with an empty body, resolving with the response body. */
function httpPost(url) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: "POST" }, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve(body));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => req.destroy(new Error("timeout")));
        req.end();
    });
}

/** Polls the endpoint until the response satisfies `ready` (or the attempts run out). */
async function waitForEndpoint(url, ready, attempts = 40, intervalMs = 500) {
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
        await new Promise((r) => setTimeout(r, intervalMs));
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

/** Spawns the CLI with the ECP server bound to a reserved port, resolved from the given cwd. */
function spawnEcp(args, cwd, ecpPort) {
    return child_process.spawn("node", [brsCliPath, ...args], {
        cwd,
        env: { ...process.env, BRS_ECP_PORT: String(ecpPort) },
    });
}

module.exports = {
    exec,
    brsCliPath,
    zipFolder,
    decryptBpk,
    BPK_MAGIC,
    reserveFreePort,
    httpGet,
    httpPost,
    waitForEndpoint,
    waitForStdout,
    spawnEcp,
};
