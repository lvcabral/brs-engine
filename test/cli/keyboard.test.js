const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

// Unit tests for the CLI keyboard key translation (terminal keypress → Roku remote key).
// The module is transpiled in isolation (same approach as cli-display.test.js) so the
// pure `translateKey` function can be tested without a TTY or the built bundle.

function loadKeyboard() {
    const filePath = path.join(__dirname, "../../src/cli/keyboard.ts");
    const source = fs.readFileSync(filePath, "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2019,
            esModuleInterop: true,
        },
        fileName: filePath,
    });

    const moduleExports = { exports: {} };
    const load = new Function("exports", "require", "module", "__filename", "__dirname", outputText);
    const localRequire = Module.createRequire(filePath);
    // Stub the sibling TypeScript modules (control/util/common) — `translateKey` is pure and
    // only the module-level imports would otherwise need the built bundle.
    const stubRequire = (id) => {
        if (id.startsWith(".")) {
            return new Proxy({}, { get: () => () => {} });
        }
        return localRequire(id);
    };
    load(moduleExports.exports, stubRequire, moduleExports, filePath, path.dirname(filePath));
    return moduleExports.exports;
}

describe("cli keyboard translateKey", () => {
    const { translateKey } = loadKeyboard();

    it("maps navigation keys to Roku remote keys", () => {
        expect(translateKey(undefined, { name: "up" })).toEqual("up");
        expect(translateKey(undefined, { name: "down" })).toEqual("down");
        expect(translateKey(undefined, { name: "left" })).toEqual("left");
        expect(translateKey(undefined, { name: "right" })).toEqual("right");
        expect(translateKey("\r", { name: "return" })).toEqual("select");
        expect(translateKey(undefined, { name: "escape" })).toEqual("back");
        expect(translateKey(undefined, { name: "backspace" })).toEqual("instantreplay");
        expect(translateKey(undefined, { name: "home" })).toEqual("home");
        expect(translateKey(undefined, { name: "end" })).toEqual("play");
    });

    it("maps ctrl combinations to media keys", () => {
        expect(translateKey(undefined, { name: "left", ctrl: true })).toEqual("rev");
        expect(translateKey(undefined, { name: "right", ctrl: true })).toEqual("fwd");
        expect(translateKey(undefined, { name: "return", ctrl: true })).toEqual("play");
        expect(translateKey(undefined, { name: "a", ctrl: true })).toEqual("a");
        expect(translateKey(undefined, { name: "z", ctrl: true })).toEqual("b");
    });

    it("maps printable characters to literal text keys", () => {
        expect(translateKey("a", { name: "a" })).toEqual("lit_a");
        expect(translateKey("Z", { name: "z" })).toEqual("lit_Z");
        expect(translateKey("5", { name: "5" })).toEqual("lit_5");
        expect(translateKey(" ", { name: "space" })).toEqual("lit_ ");
    });

    it("returns undefined for unmapped keys", () => {
        expect(translateKey(undefined, { name: "f1" })).toBeUndefined();
        expect(translateKey(undefined, { name: "x", ctrl: true })).toBeUndefined();
        expect(translateKey("", { name: "c", ctrl: true })).toBeUndefined();
        expect(translateKey("", { name: "" })).toBeUndefined();
    });
});
