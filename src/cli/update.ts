/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import chalk from "chalk";
import envPaths from "env-paths";
import packageInfo from "../../packages/node/package.json";

const REGISTRY_HOST = "registry.npmjs.org";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Query the registry at most once a day
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const paths = envPaths("brs", { suffix: "cli" });
const cacheFile = path.resolve(paths.cache, "update-check.json");

type UpdateCache = { lastCheck: number; latest: string };
type Version = { major: number; minor: number; patch: number; pre: string };

let latestVersion = "";
let noticeDisplayed = false;

/**
 * Reads the cached registry result (so a notice can be shown with zero latency) and,
 * when the cache is stale, refreshes it in the background for the next run.
 * Safe to call unconditionally: it is a no-op when the check is disabled.
 */
export function startUpdateCheck() {
    if (!isCheckEnabled()) {
        return;
    }
    const cache = readCache();
    latestVersion = cache?.latest ?? "";
    if (!cache || Date.now() - cache.lastCheck >= CHECK_INTERVAL_MS) {
        // Stamp the attempt before the request: a short-lived run can exit before the
        // response arrives (the socket is unref'd), and the registry must not be queried
        // again on every such invocation.
        writeCache(latestVersion);
        fetchLatestVersion();
    }
}

/**
 * Displays the "update available" notice, at most once per process, when the last known
 * published version is newer than the running one.
 */
export function printUpdateNotice() {
    if (noticeDisplayed || !isCheckEnabled() || !isNewer(latestVersion, packageInfo.version)) {
        return;
    }
    noticeDisplayed = true;
    const versions = `${chalk.gray(packageInfo.version)} ${chalk.gray("->")} ${chalk.greenBright(latestVersion)}`;
    console.log(`${chalk.yellowBright("Update available:")} ${versions}`);
    console.log(`${chalk.yellow("Run")} ${chalk.cyanBright(upgradeCommand())} ${chalk.yellow("to update.")}\n`);
}

/**
 * The check is opt-out and only runs on an interactive terminal, so it never interferes
 * with scripted/CI usage nor pollutes redirected output.
 * @returns True when the CLI may check for (and report) a new version
 */
function isCheckEnabled() {
    return (
        process.stdout.isTTY === true &&
        !process.env.CI &&
        !process.env.BRS_NO_UPDATE_CHECK &&
        !process.env.NO_UPDATE_NOTIFIER
    );
}

/**
 * Suggests the command that upgrades the way this copy of the CLI was installed:
 * `npx` when running from the npx cache, a local install when it lives under the
 * current directory's `node_modules`, a global install otherwise (the common case).
 * @returns The upgrade command to display in the notice
 */
function upgradeCommand() {
    const installPath = path.resolve(__dirname);
    if (installPath.split(path.sep).includes("_npx")) {
        return `npx ${packageInfo.name}@latest`;
    }
    const localModules = path.resolve(process.cwd(), "node_modules");
    if (installPath.startsWith(localModules + path.sep)) {
        return `npm install ${packageInfo.name}@latest`;
    }
    return `npm install -g ${packageInfo.name}@latest`;
}

/**
 * Reads the cached registry result from disk.
 * @returns The cached entry, or undefined when missing or malformed
 */
function readCache(): UpdateCache | undefined {
    try {
        const content = fs.readFileSync(cacheFile, "utf8");
        const parsed = JSON.parse(content);
        if (typeof parsed?.lastCheck === "number" && typeof parsed?.latest === "string") {
            return parsed as UpdateCache;
        }
    } catch {
        // No cache yet (or an unreadable one): treat it as a first run.
    }
    return undefined;
}

/**
 * Persists the registry result so the next run can notify without any network access.
 * @param latest - The version published under the `latest` dist-tag
 */
function writeCache(latest: string) {
    try {
        fs.mkdirSync(paths.cache, { recursive: true });
        const cache: UpdateCache = { lastCheck: Date.now(), latest };
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
    } catch {
        // A read-only cache directory just means the check runs again next time.
    }
}

/**
 * Queries the npm registry for the version published under the `latest` dist-tag and
 * caches it. The socket is unref'd so a pending request never delays the CLI exit (a run
 * shorter than the round-trip simply leaves the refresh to a later one), and every
 * failure is silent - a version check must never break or slow down a run.
 */
function fetchLatestVersion() {
    try {
        const request = https.get(
            {
                host: REGISTRY_HOST,
                path: `/${packageInfo.name}/latest`,
                headers: { accept: "application/json", "user-agent": `brs-cli/${packageInfo.version}` },
                timeout: REQUEST_TIMEOUT_MS,
            },
            (response) => {
                if (response.statusCode !== 200) {
                    response.resume();
                    return;
                }
                let body = "";
                response.setEncoding("utf8");
                response.on("data", (chunk: string) => {
                    body += chunk;
                    if (body.length > MAX_RESPONSE_BYTES) {
                        request.destroy();
                    }
                });
                response.on("end", () => {
                    try {
                        const version = JSON.parse(body)?.version;
                        if (typeof version === "string" && parseVersion(version)) {
                            latestVersion = version;
                            writeCache(version);
                        }
                    } catch {
                        // Unexpected payload: ignore it and retry on the next run.
                    }
                });
                response.on("error", () => {});
            }
        );
        request.on("socket", (socket) => socket.unref());
        request.on("timeout", () => request.destroy());
        request.on("error", () => {});
    } catch {
        // Offline or a blocked registry: nothing to report.
    }
}

/**
 * Splits a semantic version into its comparable parts.
 * @param version - The version string to parse (a leading `v` is tolerated)
 * @returns The parsed version, or undefined when it is not semver-like
 */
function parseVersion(version: string): Version | undefined {
    const parts = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/.exec(version.trim());
    if (!parts) {
        return undefined;
    }
    return { major: +parts[1], minor: +parts[2], patch: +parts[3], pre: parts[4] ?? "" };
}

/**
 * Compares two versions, treating a pre-release as older than its own final release
 * (so a user on `2.4.0-beta.1` is notified when `2.4.0` ships).
 * @param latest - The version published on the registry
 * @param current - The version of the running CLI
 * @returns True when `latest` supersedes `current`
 */
export function isNewer(latest: string, current: string) {
    const published = parseVersion(latest);
    const running = parseVersion(current);
    if (!published || !running) {
        return false;
    }
    if (published.major !== running.major) {
        return published.major > running.major;
    }
    if (published.minor !== running.minor) {
        return published.minor > running.minor;
    }
    if (published.patch !== running.patch) {
        return published.patch > running.patch;
    }
    return published.pre === "" && running.pre !== "";
}
