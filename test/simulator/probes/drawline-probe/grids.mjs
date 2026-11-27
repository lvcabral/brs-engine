// Renders decoded drawline-probe traces (PROBE|case|r,g,b,a;...) as 12x8 grids, device and engine side by side.
// . = transparent, R/G = the opaque line color, B = the opaque blue background, a digit = partial alpha (0-9),
// * = any other opaque color (a blended pixel).
// Usage: node grids.mjs device-trace-decoded.txt engine-trace-decoded.txt
import { readFileSync } from "node:fs";

function load(file) {
    const cases = new Map();
    for (const line of readFileSync(file, "utf8").split("\n")) {
        const [, name, px] = line.split("|");
        if (name && px) cases.set(name, px.split(";").map((p) => p.split(",").map(Number)));
    }
    return cases;
}
function cell([r, g, b, a]) {
    if (a === 0) return ".";
    if (a === 255 && b === 255 && r === 0 && g === 0) return "B";
    if (a === 255 && r === 255 && g === 0 && b === 0) return "R";
    if (a === 255 && g === 255 && r === 0 && b === 0) return "G";
    if (a < 255) return String(Math.round((a / 255) * 9));
    return "*";
}
const device = load(process.argv[2]);
const engine = load(process.argv[3]);
for (const [name, dpx] of device) {
    const epx = engine.get(name) ?? [];
    const same = JSON.stringify(dpx) === JSON.stringify(epx);
    console.log(`${name}${same ? "  (identical)" : ""}`);
    for (let y = 0; y < 8; y++) {
        const row = (px) => Array.from({ length: 12 }, (_, x) => (px[y * 12 + x] ? cell(px[y * 12 + x]) : " ")).join(" ");
        console.log(`  ${row(dpx)}    ${row(epx)}`);
    }
}
