const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const { createCanvas } = require("canvas");
const chalk = require("chalk");

function loadRenderer() {
    const filePath = path.join(__dirname, "../../src/cli/display.ts");
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
    const compiled = new Function("exports", "require", "module", "__filename", "__dirname", outputText);

    compiled(moduleExports.exports, Module.createRequire(filePath), moduleExports, filePath, path.dirname(filePath));

    return moduleExports.exports;
}

const { renderAsciiFrame, renderUnicodeFrame } = loadRenderer();

describe("CLI display rendering", () => {
    describe("renderAsciiFrame", () => {
        beforeEach(() => {
            chalk.level = 0;
        });

        it("maps dark pixels to dense characters", () => {
            const source = createCanvas(1, 1);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, 1, 1);

            const { plain } = renderAsciiFrame(1, source, 1);
            expect(plain.trim()).toBe("@");
        });

        it("clamps to provided max column limit", () => {
            const source = createCanvas(4, 4);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 4, 4);

            const { columns } = renderAsciiFrame(80, source, 50);
            expect(columns).toBe(50);
        });
    });

    describe("renderUnicodeFrame", () => {
        beforeEach(() => {
            chalk.level = 0;
        });

        it("renders bright stripe over dark stripe with upper blocks", () => {
            const source = createCanvas(8, 2);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 8, 1);
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 1, 8, 1);

            const { plain } = renderUnicodeFrame(8, source, 8);
            const lines = plain.trimEnd().split("\n");
            expect(lines).toHaveLength(1);
            expect(lines[0]).toEqual("▀".repeat(8));
        });

        it("renders dark stripe over bright stripe with lower blocks", () => {
            const source = createCanvas(8, 2);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, 8, 1);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 1, 8, 1);

            const { plain } = renderUnicodeFrame(8, source, 8);
            const lines = plain.trimEnd().split("\n");
            expect(lines).toHaveLength(1);
            expect(lines[0]).toEqual("▄".repeat(8));
        });

        it("uses adaptive thresholds to reveal medium gray circle", () => {
            const source = createCanvas(40, 40);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#101010";
            ctx.fillRect(0, 0, 40, 40);
            ctx.fillStyle = "#808080";
            ctx.beginPath();
            ctx.arc(20, 20, 12, 0, Math.PI * 2);
            ctx.fill();

            const { plain } = renderUnicodeFrame(40, source, 40);
            const lines = plain.trimEnd().split("\n");
            const flattened = lines.join("");
            expect(/░|▒|▓/.test(flattened)).toBe(true);
        });

        it("preserves detail on final row for odd heights", () => {
            const source = createCanvas(32, 9);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#050505";
            ctx.fillRect(0, 0, 32, 8);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 8, 32, 1);

            const { plain } = renderUnicodeFrame(32, source, 32);
            const lines = plain.trimEnd().split("\n");
            const lastLine = lines[lines.length - 1];
            expect(lastLine.replace(/\s/g, "")).not.toEqual("");
            expect(/[▄█▓]/.test(lastLine)).toBe(true);
        });

        it("applies background colors when cells contain only spaces", () => {
            chalk.level = 3;
            const source = createCanvas(4, 4);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#6f1ab1";
            ctx.fillRect(0, 0, 4, 4);

            const { colored } = renderUnicodeFrame(4, source, 4);
            expect(colored).toContain("[48;2;111;26;177m");
            chalk.level = 0;
        });
    });
});
