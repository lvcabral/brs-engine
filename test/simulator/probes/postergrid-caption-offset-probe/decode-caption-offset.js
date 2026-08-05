#!/usr/bin/env node
/**
 * Decodes the PosterGrid caption-offset probe from a screenshot.
 *
 * Same method as postergrid-margins-probe/decode-caption-offset.js — a real PosterGrid cell next to
 * a hand-built reconstruction whose caption box sits at a known offset of exactly 0 below the
 * poster's bottom edge:
 *
 *     CaptionTextOffset = firstInkedRow(real column) - firstInkedRow(offset-0 reconstruction)
 *
 * Both columns draw the same glyphs, in the same font, in a box of the same height, with the same
 * vertical alignment, over posters whose bottom edges are at the same scene y. So the unknown
 * "where does ink sit inside its own box" term is identical on both sides and cancels — as does
 * anti-aliasing. This probe varies caption1Font (bold vs. plain) and captionBackgroundBitmapUri
 * (transparent vs. the device default) across 8 columns / 5 pairs — see CaptionOffsetScene.brs for
 * what each column is.
 *
 * Caption ink is pure red (0xFF0000FF) and the posters are deliberately red-free, so locating ink is
 * a channel test rather than a visual one. The 1px green rule along the posters' bottom edges is a
 * registration mark only: this script reports it so a reader can confirm all eight posters were
 * flush, but the answer does not depend on it.
 *
 *     node decode-caption-offset.js <screenshot.png> [--design=1920] [--scale=0.667]
 *
 * All coordinates in CaptionOffsetScene.brs are DESIGN pixels; a screenshot is in DEVICE pixels. The
 * scale between them is `image.width / designWidth`, so an FHD run must pass `--design=1920`:
 *
 *   - HD app, engine or device (1280 wide)   -> default, scale 1
 *   - FHD app, engine `--snapshot` (1920)    -> `--design=1920`, scale 1
 *   - FHD app, device screenshot (1280)      -> `--design=1920`, scale 0.667
 *
 * That last case is why the flag exists: a Roku device's screenshot utility captures HD even for an
 * FHD app. `--scale` overrides the computation outright. The script prints the scale it used and the
 * raw row indices, so a wrong scale is visible rather than silent.
 */

const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("canvas");

// Design-resolution x ranges of the eight columns, matching CaptionOffsetScene.brs. Kept here rather
// than inferred from the image so a column that failed to render reads as "no ink" instead of
// silently shifting every other column's window.
const COLUMNS = [
    { name: "C1 real  bold  transparent", x: 60, width: 100 },
    { name: "C2 recon bold  offset0", x: 215, width: 100 },
    { name: "C3 real  plain transparent", x: 370, width: 100 },
    { name: "C4 recon plain offset0", x: 525, width: 100 },
    { name: "C5 real  plain DEFAULT-bg", x: 680, width: 100 },
    { name: "C6 real  plain transparent stacked", x: 835, width: 100 },
    { name: "C7 recon plain offset0 stacked", x: 990, width: 100 },
    { name: "C8 real  bold  DEFAULT-bg", x: 1145, width: 100 },
];
const POSTER_BOTTOM = 360; // design-resolution scene y of every poster's bottom edge
const RULE_WIDTH = 1245; // design-resolution width of the green registration rule (xC8 + 100)

// Pairs to decode: [label, realColumnIndex, reconColumnIndex]
const PAIRS = [
    ["control (bold, transparent) — expect 0", 0, 1],
    ["font weight (plain, transparent)", 2, 3],
    ["default background (plain)", 4, 3],
    ["plain, stacked (2 blocks)", 5, 6],
    ["default background (bold)", 7, 1],
];

/** Rows at or below the poster's bottom edge that contain pure-ish red ink inside `column`. */
function inkedRows(data, imgWidth, imgHeight, column, scale) {
    const x0 = Math.round(column.x * scale);
    const x1 = Math.min(imgWidth, Math.round((column.x + column.width) * scale));
    const yStart = Math.max(0, Math.round(POSTER_BOTTOM * scale));
    const rows = [];
    for (let y = yStart; y < imgHeight; y++) {
        let count = 0;
        for (let x = x0; x < x1; x++) {
            const i = (y * imgWidth + x) * 4;
            // Red-dominant: the caption is 0xFF0000FF, the posters carry no red at all, and the
            // registration rule is pure green. Anti-aliased glyph edges stay red-dominant.
            if (data[i] > 100 && data[i] > data[i + 1] * 2 + 40 && data[i] > data[i + 2] * 2 + 40) {
                count++;
            }
        }
        if (count > 0) {
            rows.push({ y, count });
        }
    }
    return rows;
}

/** The 1px green registration rule, reported as a cross-check that the columns share a baseline. */
function ruleRow(data, imgWidth, imgHeight, scale) {
    const yStart = Math.max(0, Math.round((POSTER_BOTTOM - 4) * scale));
    const yEnd = Math.min(imgHeight, Math.round((POSTER_BOTTOM + 5) * scale));
    // Threshold against the rule's OWN scaled width, not the image width — see
    // postergrid-margins-probe/decode-caption-offset.js for why.
    const minCount = (RULE_WIDTH * scale) / 2;
    for (let y = yStart; y < yEnd; y++) {
        let count = 0;
        for (let x = 0; x < imgWidth; x++) {
            const i = (y * imgWidth + x) * 4;
            // Green-DOMINANT, not green-BRIGHT — a device anti-aliases the 1px rule across two rows
            // at partial intensity. See postergrid-margins-probe/decode-caption-offset.js.
            const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
            if (g > 40 && g > r + 15 && g > b + 15) {
                count++;
            }
        }
        if (count > minCount) {
            return y;
        }
    }
    return undefined;
}

async function main() {
    const args = process.argv.slice(2);
    const file = args.find((a) => !a.startsWith("--"));
    if (!file) {
        console.error(`usage: node ${path.basename(__filename)} <screenshot.png> [--design=1280|1920] [--scale=N]`);
        process.exit(2);
    }
    const scaleArg = args.find((a) => a.startsWith("--scale="));
    const designArg = args.find((a) => a.startsWith("--design="));
    const image = await loadImage(fs.readFileSync(file));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);

    const designWidth = designArg ? Number(designArg.split("=")[1]) : 1280;
    const scale = scaleArg ? Number(scaleArg.split("=")[1]) : image.width / designWidth;
    const scaleSource = scaleArg ? "from --scale" : `${image.width} / ${designWidth} design px`;

    console.log(`image      : ${file} (${image.width}x${image.height})`);
    console.log(`scale      : ${scale} (${scaleSource})`);
    const rule = ruleRow(data, image.width, image.height, scale);
    console.log(`rule row   : ${rule ?? "NOT FOUND — posters may not be flush; check the screenshot"}`);
    console.log("");

    const firstRows = [];
    for (const column of COLUMNS) {
        const rows = inkedRows(data, image.width, image.height, column, scale);
        const first = rows[0];
        firstRows.push(first?.y);
        const span = rows.length > 0 ? `${rows[0].y}..${rows[rows.length - 1].y}` : "none";
        console.log(
            `${column.name.padEnd(34)} first inked row = ${String(first?.y ?? "NONE").padStart(5)}   ink rows ${span}`
        );
    }
    console.log("");

    for (const [label, realIdx, reconIdx] of PAIRS) {
        const real = firstRows[realIdx];
        const recon = firstRows[reconIdx];
        if (real === undefined || recon === undefined) {
            console.log(`${label}: INCONCLUSIVE — a column had no caption ink`);
            continue;
        }
        const px = real - recon;
        console.log(`${label}: CaptionTextOffset = ${px} device px = ${(px / scale).toFixed(2)} design px`);
    }
    console.log("");
    console.log("Compare the 'font weight' and 'default background' pairs against the control (expect 0,");
    console.log("matching postergrid-margins-probe). If either differs from 0, that variable explains the");
    console.log("PosterGridExample regression and CaptionTextOffset needs to depend on it, not be a flat");
    console.log("constant.");
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
