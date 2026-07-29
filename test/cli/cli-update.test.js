const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

function loadUpdateChecker() {
    const filePath = path.join(__dirname, "../../src/cli/update.ts");
    const source = fs.readFileSync(filePath, "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2019,
            esModuleInterop: true,
            resolveJsonModule: true,
        },
        fileName: filePath,
    });

    const moduleExports = { exports: {} };
    const compiled = new Function("exports", "require", "module", "__filename", "__dirname", outputText);

    compiled(moduleExports.exports, Module.createRequire(filePath), moduleExports, filePath, path.dirname(filePath));

    return moduleExports.exports;
}

const { isNewer } = loadUpdateChecker();

describe("cli/update", () => {
    describe("isNewer", () => {
        it("detects a newer major, minor or patch release", () => {
            expect(isNewer("3.0.0", "2.3.0")).toBe(true);
            expect(isNewer("2.4.0", "2.3.9")).toBe(true);
            expect(isNewer("2.3.1", "2.3.0")).toBe(true);
        });

        it("does not report the same or an older version", () => {
            expect(isNewer("2.3.0", "2.3.0")).toBe(false);
            expect(isNewer("2.2.9", "2.3.0")).toBe(false);
            expect(isNewer("1.9.9", "2.0.0")).toBe(false);
            expect(isNewer("2.3.0", "2.4.0-beta.1")).toBe(false);
        });

        it("compares each part numerically, not as text", () => {
            expect(isNewer("2.10.0", "2.9.0")).toBe(true);
            expect(isNewer("2.9.0", "2.10.0")).toBe(false);
            expect(isNewer("10.0.0", "9.0.0")).toBe(true);
        });

        it("treats a pre-release as older than its own final release", () => {
            expect(isNewer("2.4.0", "2.4.0-beta.1")).toBe(true);
            expect(isNewer("2.4.0-beta.2", "2.4.0")).toBe(false);
            expect(isNewer("2.4.0-beta.2", "2.4.0-beta.1")).toBe(false);
        });

        it("ignores versions that are not semver-like", () => {
            expect(isNewer("", "2.3.0")).toBe(false);
            expect(isNewer("latest", "2.3.0")).toBe(false);
            expect(isNewer("2.4", "2.3.0")).toBe(false);
            expect(isNewer("v2.4.0", "2.3.0")).toBe(true);
        });
    });
});
