/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Canvas, createCanvas, ImageData } from "canvas";
import chalk from "chalk";

const ASCII_ALPHABET = ["@", "%", "#", "*", "+", "=", "-", ":", ".", " "];
const SHADE_CHARS = [" ", "░", "▒", "▓", "█"];
const HALF_BLOCKS = ["▄", "▀"];
const MIN_COLUMNS = 32;
const FALLBACK_COLUMNS = 80;
const COLUMN_PADDING_RATIO = 0.96;
const ROW_PADDING_RATIO = 0.82;
const TARGET_ASPECT_RATIO = 16 / 9;
const CHAR_HEIGHT_TO_WIDTH_RATIO = 2;
const MIN_DIMENSION_FOR_RATIO = 2;
const maxColumns = deriveMaxColumns();
let lastDisplayRatio = TARGET_ASPECT_RATIO;

/**
 * Result of rendering a frame to terminal-compatible text format.
 */
export interface RenderFrameResult {
    /** Plain text representation without ANSI color codes */
    plain: string;
    /** Colored text with ANSI escape sequences for RGB colors */
    colored: string;
    /** Actual number of character columns in rendered output */
    columns: number;
    /** Actual number of character rows in rendered output */
    rows: number;
}

/**
 * Derives the maximum column count that maintains a 16:9 aspect ratio
 * within the current terminal bounds, accounting for character cell dimensions.
 * @returns Maximum columns constrained by terminal width and height
 */
export function deriveMaxColumns() {
    if (typeof process === "undefined" || !process.stdout) {
        return FALLBACK_COLUMNS;
    }
    const terminalColumns = process.stdout.columns ?? 0;
    const terminalRows = process.stdout.rows ?? 0;
    const widthLimit = terminalColumns > 0 ? Math.trunc(terminalColumns * COLUMN_PADDING_RATIO) : 0;
    const rowLimit = terminalRows > 0 ? Math.trunc(terminalRows * ROW_PADDING_RATIO) : 0;
    const rowsToColumnsRatio = TARGET_ASPECT_RATIO * CHAR_HEIGHT_TO_WIDTH_RATIO;
    const heightLimit = rowLimit > 0 ? Math.trunc(rowLimit * rowsToColumnsRatio) : 0;
    const candidates = [widthLimit, heightLimit].filter((value) => value > 0);
    const boundedColumns = candidates.length > 0 ? Math.min(...candidates) : 0;
    const fallback = widthLimit || heightLimit || 0;
    const derived = boundedColumns || fallback;
    return derived > 0 ? Math.max(derived, MIN_COLUMNS) : FALLBACK_COLUMNS;
}

/**
 * Prints a rendered frame to stdout, clearing the terminal and hiding the cursor.
 * Automatically selects colored or plain output based on chalk color support level.
 * @param frame - The frame result containing plain and colored text versions
 * @returns True if the write was flushed; false when stdout applies backpressure
 *          (callers should drop frames until the stream drains)
 */
export function printFrame({ plain, colored }: RenderFrameResult): boolean {
    const output = chalk.level > 0 ? colored : plain;
    return process.stdout.write(`\x1b[H\u001B[?25l${output}\u001B[?25h`);
}

/**
 * Converts an image as ASCII art to be printed on the console.
 * Uses grayscale values to map pixels to ASCII characters.
 * @param columns - The number of columns for ASCII output
 * @param image - The Canvas object containing the screen image
 * @remarks Code adapted from: https://github.com/victorqribeiro/imgToAscii
 */
export function renderAsciiFrame(columns: number, image: Canvas): RenderFrameResult {
    const cols = Math.max(1, Math.min(columns, maxColumns));
    const rows = clampRows(cols, computeDisplayRatio(image));
    const canvas = createCanvas(cols, rows);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const grayStep = Math.ceil(255 / ASCII_ALPHABET.length);
    const canColor = chalk.level > 0;
    const plainLines: string[] = [];
    const coloredLines: string[] = [];

    for (let y = 0; y < height; y++) {
        let plainLine = "";
        let coloredLine = "";
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
            const alphabetIndex = Math.min(ASCII_ALPHABET.length - 1, Math.floor(luminance / grayStep));
            const char = ASCII_ALPHABET[alphabetIndex];
            plainLine += char;
            coloredLine += canColor ? chalk.rgb(r, g, b)(char) : char;
        }
        plainLines.push(plainLine);
        coloredLines.push(canColor ? coloredLine : plainLine);
    }

    const newline = "\n";
    return {
        plain: plainLines.join(newline) + newline,
        colored: coloredLines.join(newline) + newline,
        columns: cols,
        rows,
    };
}

/**
 * Sampled pixel data with computed luminance and transparency information.
 */
interface PixelSample {
    r: number;
    g: number;
    b: number;
    a: number;
    luminance: number;
    level: number;
    isTransparent: boolean;
}

/**
 * Converts an image to Unicode block art for high-quality terminal rendering.
 * Uses half-block characters and shade gradients with full RGB color support.
 * Each output row represents two vertical pixels for doubled vertical resolution.
 * @param columns - The number of columns for Unicode output
 * @param image - The Canvas object containing the screen image
 * @returns Rendered frame with plain and colored text, plus actual dimensions
 */
export function renderUnicodeFrame(columns: number, image: Canvas): RenderFrameResult {
    const cols = Math.max(1, Math.min(columns, maxColumns));
    const rows = clampRows(cols, computeDisplayRatio(image));
    const canvas = createCanvas(cols, Math.max(2, rows * 2));
    const ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const pixelCount = width * height;
    const luminance = new Float32Array(pixelCount);
    const alphaValues = new Uint8Array(pixelCount);
    const alphaThreshold = 32;
    let minLum = Number.POSITIVE_INFINITY;
    let maxLum = Number.NEGATIVE_INFINITY;
    let validCount = 0;

    for (let idx = 0, px = 0; idx < data.length; idx += 4, px++) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;

        luminance[px] = lum;
        alphaValues[px] = a;

        if (a >= alphaThreshold) {
            validCount++;
            if (lum < minLum) {
                minLum = lum;
            }
            if (lum > maxLum) {
                maxLum = lum;
            }
        }
    }

    if (validCount === 0) {
        minLum = 0;
        maxLum = 255;
    } else if (maxLum - minLum < 1) {
        maxLum = Math.min(255, minLum + 1);
    }

    const range = Math.max(maxLum - minLum, 1);
    const canColor = chalk.level > 0;
    const plainLines: string[] = [];
    const coloredLines: string[] = [];

    const getPixel = (x: number, y: number): PixelSample => {
        const clampedY = Math.max(0, Math.min(y, height - 1));
        const index = clampedY * width + x;
        const base = index * 4;
        const r = data[base];
        const g = data[base + 1];
        const b = data[base + 2];
        const a = alphaValues[index];
        const lum = luminance[index];
        const transparent = a < alphaThreshold;
        const normalized = transparent ? 0 : (lum - minLum) / range;
        const level = transparent ? 0 : Math.max(0, Math.min(4, Math.round(normalized * 4)));

        return { r, g, b, a, luminance: lum, level, isTransparent: transparent };
    };

    const colorHalfBlock = (char: string, fg: PixelSample, bg: PixelSample) => {
        if (!canColor) {
            return char;
        }
        if (bg.isTransparent) {
            return chalk.rgb(fg.r, fg.g, fg.b)(char);
        }
        return chalk.bgRgb(bg.r, bg.g, bg.b).rgb(fg.r, fg.g, fg.b)(char);
    };

    const colorSolid = (char: string, r: number, g: number, b: number) => {
        if (!canColor) {
            return char;
        }
        if (char === " ") {
            return chalk.bgRgb(r, g, b)(char);
        }
        return chalk.rgb(r, g, b)(char);
    };

    for (let y = 0; y < height; y += 2) {
        let plainLine = "";
        let coloredLine = "";
        const rowBelow = Math.min(y + 1, height - 1);

        for (let x = 0; x < width; x++) {
            const upper = getPixel(x, y);
            const lower = getPixel(x, rowBelow);
            const levelDiff = Math.abs(upper.level - lower.level);
            const avgLevel = Math.max(0, Math.min(4, Math.round((upper.level + lower.level) / 2)));
            const avgR = Math.round((upper.r + lower.r) / 2);
            const avgG = Math.round((upper.g + lower.g) / 2);
            const avgB = Math.round((upper.b + lower.b) / 2);

            let plainChar: string;
            let coloredChar: string;

            if (upper.isTransparent && lower.isTransparent) {
                plainChar = " ";
                coloredChar = canColor ? chalk.bgBlack(" ") : " ";
            } else if (levelDiff <= 1) {
                plainChar = SHADE_CHARS[avgLevel];
                coloredChar = colorSolid(plainChar, avgR, avgG, avgB);
            } else if (upper.level > lower.level) {
                plainChar = HALF_BLOCKS[1];
                coloredChar = colorHalfBlock(plainChar, upper, lower);
            } else {
                plainChar = HALF_BLOCKS[0];
                coloredChar = colorHalfBlock(plainChar, lower, upper);
            }

            plainLine += plainChar;
            coloredLine += coloredChar;
        }

        plainLines.push(plainLine);
        coloredLines.push(coloredLine);
    }

    const newline = "\n";
    return {
        plain: plainLines.join(newline) + newline,
        colored: coloredLines.join(newline) + newline,
        columns: cols,
        rows,
    };
}

/**
 * Computes the display ratio for the image, caching it to maintain
 * stable dimensions across blank or degenerate frames (e.g., 1x1 transitions).
 * @param image - The source canvas image
 * @returns The display width-to-height ratio adjusted for terminal aspect
 */
function computeDisplayRatio(image: Canvas) {
    const baseHeight = image.height ?? 0;
    const baseWidth = image.width ?? 0;
    if (baseWidth >= MIN_DIMENSION_FOR_RATIO && baseHeight >= MIN_DIMENSION_FOR_RATIO) {
        lastDisplayRatio = (baseWidth / baseHeight) * TARGET_ASPECT_RATIO;
    }
    return lastDisplayRatio;
}

/**
 * Calculates the number of rows for a given column count and aspect ratio.
 * @param columns - The number of character columns
 * @param ratio - The display width-to-height ratio
 * @returns The computed row count, clamped to a minimum of 1
 */
function clampRows(columns: number, ratio: number) {
    const computed = Math.trunc(columns / ratio);
    return Math.max(1, computed);
}

/**
 * How the screen is presented on the terminal while the app runs.
 */
export interface DisplayMode {
    /** ASCII/Unicode art column count (0 = fit the terminal); undefined disables art modes */
    ascii?: number;
    /** Render ASCII art using Unicode block characters */
    unicode?: boolean;
    /** Render frames as terminal images (iTerm2/Kitty native protocols or ANSI fallback) */
    image?: boolean;
}

// terminal-image is ESM-only; load it lazily via dynamic import (kept external by webpack).
type TerminalImage = typeof import("terminal-image").default;
let terminalImage: TerminalImage | undefined;
async function getTerminalImage(): Promise<TerminalImage> {
    terminalImage ??= (await import("terminal-image")).default;
    return terminalImage;
}

// The engine gates the frame rate (DeviceInfo.maxFps), so no CLI-side throttling is applied.
// Terminal writes still need flow control: by default a TTY `stdout.write` is synchronous and
// a slow terminal blocks the event loop inside write(2), starving stdin (in raw mode Ctrl+C
// is just a keypress) and the task broker. `enableFrameOutput` switches stdout to
// non-blocking, so a slow terminal surfaces as ordinary backpressure: rendering pauses on
// `write() === false` and resumes on `drain`, dropping to the newest frame meanwhile. A
// terminal that keeps up renders every engine frame.
let displayMode: DisplayMode = {};
let pendingFrame: ImageData | undefined;
let frameRenderScheduled = false;
let stdoutCongested = false;
let frameOutputEnabled = false;

/**
 * Starts frame output for an app run: stores the display mode, makes stdout writes
 * non-blocking (so frames can never block the event loop — a slow terminal becomes
 * backpressure + `drain` instead) and hides the cursor in image mode.
 * @param mode - The display mode selected by the CLI options
 */
export function enableFrameOutput(mode: DisplayMode) {
    displayMode = mode;
    frameOutputEnabled = true;
    if ((displayMode.ascii !== undefined || displayMode.image) && process.stdout.isTTY) {
        (process.stdout as any)._handle?.setBlocking?.(false);
        if (displayMode.image) {
            // Hide the cursor for the whole run; it would flicker at the image edge on
            // every repaint (restored in disableFrameOutput).
            process.stdout.write("\x1b[?25l");
        }
    }
}

/**
 * Stops frame rendering (dropping any queued frame — the app is over) and restores
 * blocking stdout writes so post-run output can never be truncated on exit.
 */
export function disableFrameOutput() {
    frameOutputEnabled = false;
    pendingFrame = undefined;
    stdoutCongested = false;
    if ((displayMode.ascii !== undefined || displayMode.image) && process.stdout.isTTY) {
        (process.stdout as any)._handle?.setBlocking?.(true);
        if (displayMode.image) {
            process.stdout.write("\x1b[?25h");
        }
    }
}

/**
 * Queues the latest frame for terminal rendering on the next event-loop turn,
 * coalescing to the newest frame while a render is pending or stdout is congested.
 * @param frame - The frame received from the interpreter
 */
export function renderFrameToTerminal(frame: ImageData) {
    if (!frameOutputEnabled) {
        return;
    }
    pendingFrame = frame;
    if (frameRenderScheduled || stdoutCongested) {
        return;
    }
    frameRenderScheduled = true;
    setImmediate(renderPendingFrame);
}

/**
 * Renders the most recent pending frame on the terminal — ASCII/Unicode art, or an
 * image (terminal-image) in image mode — pausing on stdout backpressure until `drain`.
 * The scheduled flag is held for the whole (possibly async) render so frames arriving
 * meanwhile only replace `pendingFrame` and are picked up right after, never in parallel.
 */
async function renderPendingFrame() {
    const frame = pendingFrame;
    pendingFrame = undefined;
    if (!frame || !frameOutputEnabled) {
        frameRenderScheduled = false;
        return;
    }
    const canvas = createCanvas(frame.width, frame.height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(frame, 0, 0);
    let flushed = true;
    if (displayMode.image) {
        flushed = await renderImageFrame(canvas, frame.width, frame.height);
    } else {
        const columns = displayMode.ascii && displayMode.ascii > 0 ? displayMode.ascii : maxColumns;
        flushed = displayMode.unicode
            ? printFrame(renderUnicodeFrame(columns, canvas))
            : printFrame(renderAsciiFrame(columns, canvas));
    }
    frameRenderScheduled = false;
    if (!flushed) {
        stdoutCongested = true;
        process.stdout.once("drain", () => {
            stdoutCongested = false;
            if (pendingFrame && !frameRenderScheduled) {
                frameRenderScheduled = true;
                setImmediate(renderPendingFrame);
            }
        });
    } else if (pendingFrame) {
        // A newer frame arrived while this one was rendering (async image encode).
        frameRenderScheduled = true;
        setImmediate(renderPendingFrame);
    }
}

/**
 * Renders a frame as a terminal image via the terminal's native graphics protocol
 * (iTerm2/Kitty) when available, falling back to ANSI half-blocks.
 * @param canvas - Canvas holding the frame pixels
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @returns True if the write was flushed; false when stdout applies backpressure
 */
async function renderImageFrame(canvas: Canvas, width: number, height: number): Promise<boolean> {
    const imageRenderer = await getTerminalImage();
    // Flatten onto opaque black: a frame carrying alpha would let the terminal's own
    // background color show through the inline image, flashing the theme color.
    const opaque = createCanvas(width, height);
    const octx = opaque.getContext("2d");
    octx.fillStyle = "black";
    octx.fillRect(0, 0, width, height);
    octx.drawImage(canvas, 0, 0);
    const png = opaque.toBuffer("image/png");
    // Begin synchronized-output mode (DEC 2026) and home the cursor BEFORE rendering:
    // the Kitty-protocol path inside terminal-image writes the image escape directly
    // to stdout, so positioning/sync must already be in effect. 2026 makes the
    // terminal swap the old and new frame atomically (no blank gap while the payload
    // decodes); terminals without support ignore the escapes.
    process.stdout.write("\x1b[?2026h\x1b[H");
    let flushed = true;
    try {
        let rendered = await imageRenderer.buffer(png, { height: "90%" });
        if (frameOutputEnabled) {
            // iTerm2 protocol: keep the cursor at home so a frame can never scroll the
            // screen (ansi-escapes does not expose the doNotMoveCursor flag).
            rendered = rendered.replace("\x1b]1337;File=inline=1", "\x1b]1337;File=inline=1;doNotMoveCursor=1");
            flushed = process.stdout.write(`${rendered}\x1b[?2026l`);
        }
    } finally {
        if (!frameOutputEnabled) {
            // App ended mid-render: drop the stale frame but close sync mode.
            process.stdout.write("\x1b[?2026l");
        }
    }
    return flushed;
}

/**
 * Encodes a frame as a PNG buffer (used by the Ctrl+S screenshot shortcut).
 * @param frame - The frame to encode
 * @returns PNG file contents
 */
export function frameToPng(frame: ImageData): Buffer {
    const canvas = createCanvas(frame.width, frame.height);
    canvas.getContext("2d").putImageData(frame, 0, 0);
    return canvas.toBuffer("image/png");
}
