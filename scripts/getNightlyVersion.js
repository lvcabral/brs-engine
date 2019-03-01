#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const semver = require("semver");

/**
 * Parses a version string into an object containing both a `majorMinor` and `patch` properties.
 * Adapted from Microsoft/TypeScript's `configurePrerelease.ts`.
 * @param {string} versionString - a string representation of the current version.
 * @returns {object} an object containing  `majorMinor` and `patch` properties
 */
function parsePackageJsonVersion(versionString) {
    const match = versionString.match(versionRgx);

    if (!match) {
        console.error(`Unable to parse version string, which doesn't match ${versionRgx}`);
        process.exit(1);
    }

    return {
        majorMinor: match[1],
        patch: match[2]
    };
}

const packageJson = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "..", "package.json"),
        "utf-8"
    )
);

const versionRegex = /(\d+\.\d+\.\d+)($|\-)/;
const match = packageJson.version.match(versionRegex);

if (match == null) {
    console.error("Unable to parse current version from package.json");
    process.exit(1);
}

const now = new Date();
const today = now.toISOString().replace(/:|T|\.|-/g, "").slice(0, 8);

console.log(`${match[1]}-nightly.${today}`);

