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

const {
    renderAsciiFrame,
    renderUnicodeFrame,
    enableFrameOutput,
    disableFrameOutput,
    renderFrameToTerminal,
    writeTerminalText,
    suspendTextDeferral,
    resumeTextDeferral,
} = loadRenderer();

describe("Micro Debugger terminal handoff", () => {
    const { ImageData } = require("canvas");
    const realStdout = process.stdout;
    let fakeStdout;
    let written;

    const makeFrame = (r, g, b) => {
        const data = new Uint8ClampedArray(4 * 4 * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
        return new ImageData(data, 4, 4);
    };

    const flushImmediates = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
        chalk.level = 0;
        written = [];
        fakeStdout = {
            isTTY: true,
            columns: 80,
            rows: 24,
            write(text) {
                written.push(text);
                return true;
            },
            once() {},
        };
        Object.defineProperty(process, "stdout", { value: fakeStdout, configurable: true });
    });

    afterEach(() => {
        disableFrameOutput();
        Object.defineProperty(process, "stdout", { value: realStdout, configurable: true });
    });

    it("holds frames while the debugger owns the terminal and repaints the newest on resume", async () => {
        enableFrameOutput({ ascii: 8 });
        renderFrameToTerminal(makeFrame(0, 0, 0));
        await flushImmediates();
        const framesPainted = written.filter((text) => text.startsWith("\x1b[H")).length;
        expect(framesPainted).toBe(1);

        suspendTextDeferral();
        written = [];
        renderFrameToTerminal(makeFrame(255, 255, 255));
        await flushImmediates();
        expect(written.filter((text) => text.startsWith("\x1b[H"))).toHaveLength(0);

        resumeTextDeferral();
        await flushImmediates();
        expect(written.some((text) => text.includes("\x1b[2J"))).toBe(true);
        expect(written.filter((text) => text.startsWith("\x1b[H"))).toHaveLength(1);
    });

    it("repaints the last received frame on resume even when the app posts nothing new", async () => {
        enableFrameOutput({ ascii: 8 });
        renderFrameToTerminal(makeFrame(0, 0, 0));
        await flushImmediates();

        suspendTextDeferral();
        written = [];
        resumeTextDeferral();
        await flushImmediates();
        expect(written.filter((text) => text.startsWith("\x1b[H"))).toHaveLength(1);
    });

    it("writes text directly while the debugger owns the terminal, deferring it otherwise", async () => {
        enableFrameOutput({ ascii: 8 });
        writeTerminalText("deferred\n");
        expect(written.join("")).not.toContain("deferred");

        suspendTextDeferral();
        expect(written.join("")).toContain("deferred");

        written = [];
        writeTerminalText("interactive\n");
        expect(written.join("")).toContain("interactive");
        resumeTextDeferral();
        await flushImmediates();
    });
});

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

            const { plain } = renderAsciiFrame(1, source);
            expect(plain.trim()).toBe("@");
        });

        it("maps light pixels to sparse characters", () => {
            const source = createCanvas(1, 1);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 1, 1);

            const { plain } = renderAsciiFrame(1, source);
            // Light pixels map to space, which gets trimmed
            expect(plain.replace(/\n/g, "")).toBe(" ");
        });

        it("renders a gradient with appropriate character progression", () => {
            const source = createCanvas(10, 1);
            const ctx = source.getContext("2d");
            const gradient = ctx.createLinearGradient(0, 0, 10, 0);
            gradient.addColorStop(0, "#000000");
            gradient.addColorStop(1, "#ffffff");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 10, 1);

            const { plain, columns } = renderAsciiFrame(10, source);
            const lines = plain.trimEnd().split("\n");
            // Each line should show gradient progression
            expect(lines.length).toBeGreaterThan(0);
            const firstLine = lines[0];
            // Check we got some output
            expect(firstLine.length).toBeGreaterThan(0);
            // Should transition from dark to light characters
            expect(firstLine[0]).toMatch(/[@%#]/);
            expect(firstLine[firstLine.length - 1]).toMatch(/[.: ]/);
        });

        it("applies RGB colors when chalk level is enabled", () => {
            chalk.level = 3;
            const source = createCanvas(1, 1);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(0, 0, 1, 1);

            const { colored } = renderAsciiFrame(1, source);
            expect(colored).toContain("[38;2;255;0;0m");
            chalk.level = 0;
        });

        it("returns consistent dimensions for multiple frames", () => {
            const source1 = createCanvas(32, 32);
            const ctx1 = source1.getContext("2d");
            ctx1.fillStyle = "#000000";
            ctx1.fillRect(0, 0, 32, 32);

            const result1 = renderAsciiFrame(32, source1);

            const source2 = createCanvas(32, 32);
            const ctx2 = source2.getContext("2d");
            ctx2.fillStyle = "#ffffff";
            ctx2.fillRect(0, 0, 32, 32);

            const result2 = renderAsciiFrame(32, source2);

            expect(result1.columns).toBe(result2.columns);
            expect(result1.rows).toBe(result2.rows);
        });

        it("handles blank frames without flicker by maintaining dimensions", () => {
            const source = createCanvas(1, 1);
            const ctx = source.getContext("2d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, 1, 1);

            const { columns, rows } = renderAsciiFrame(32, source);
            expect(columns).toBeGreaterThan(0);
            expect(rows).toBeGreaterThan(0);
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

            const { plain } = renderUnicodeFrame(8, source);
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

            const { plain } = renderUnicodeFrame(8, source);
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

            const { plain } = renderUnicodeFrame(40, source);
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

            const { plain } = renderUnicodeFrame(32, source);
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

            const { colored } = renderUnicodeFrame(4, source);
            expect(colored).toContain("[48;2;111;26;177m");
            chalk.level = 0;
        });
    });
});
