// Renders decoded region-draw-probe traces as grids, device and engine side by side; text lines (the AlphaEnable
// readouts) are printed as device / engine pairs. Every bitmap is square (8x8 or 12x12).
// . = transparent, R/G/B = an opaque primary, a digit = partial alpha (0-9), * = any other opaque color (blended).
// Usage: node grids.mjs device-trace-decoded.txt engine-trace-decoded.txt
import { readFileSync } from "node:fs";

function load(file) {
    const cases = new Map();
    for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
        const fields = line.split("|");
        const last = fields.at(-1);
        if (last.includes(";")) {
            cases.set(fields.slice(1, -1).join("|"), last.split(";").map((p) => p.split(",").map(Number)));
        } else {
            cases.set(fields.slice(1, 3).join("|"), fields.slice(3).join("|"));
        }
    }
    return cases;
}
function cell([r, g, b, a]) {
    if (a === 0) return ".";
    if (a === 255 && r === 255 && g === 0 && b === 0) return "R";
    if (a === 255 && g === 255 && r === 0 && b === 0) return "G";
    if (a === 255 && b === 255 && r === 0 && g === 0) return "B";
    if (a < 255) return String(Math.round((a / 255) * 9));
    return "*";
}
const device = load(process.argv[2]);
const engine = load(process.argv[3]);
for (const [name, dval] of device) {
    const eval_ = engine.get(name);
    const same = JSON.stringify(dval) === JSON.stringify(eval_);
    if (typeof dval === "string") {
        console.log(`${name}  device ${dval}  engine ${eval_ ?? "-"}${same ? "" : "  <-- differs"}`);
        continue;
    }
    console.log(`${name}${same ? "  (identical)" : ""}`);
    const side = Math.round(Math.sqrt(dval.length));
    const epx = Array.isArray(eval_) ? eval_ : [];
    for (let y = 0; y < side; y++) {
        const row = (px) => Array.from({ length: side }, (_, x) => (px[y * side + x] ? cell(px[y * side + x]) : " ")).join(" ");
        console.log(`  ${row(dval)}    ${row(epx)}`);
    }
}
