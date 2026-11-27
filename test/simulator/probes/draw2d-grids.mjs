// Renders decoded Draw2D probe traces (PROBE|case|r,g,b,a;...) as pixel grids, device and engine side by side.
// A trace line without pixels (e.g. PROBE|case|label|value) is printed as a device / engine pair.
// . = transparent, R/G/B = an opaque primary, a digit = partial alpha (0-9), * = any other opaque color (blended).
// Shared by the Draw2D probes in this folder.
// Usage: node ../draw2d-grids.mjs device-trace-decoded.txt engine-trace-decoded.txt [width] (default: square)
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
    if (a < 255) return String(Math.round((a / 255) * 9));
    if (r === 255 && g === 0 && b === 0) return "R";
    if (r === 0 && g === 255 && b === 0) return "G";
    if (r === 0 && g === 0 && b === 255) return "B";
    return "*";
}

function row(px, y, width) {
    return Array.from({ length: width }, (_, x) => {
        const p = px[y * width + x];
        return p ? cell(p) : " ";
    }).join(" ");
}

const device = load(process.argv[2]);
const engine = load(process.argv[3]);
for (const [name, dev] of device) {
    const eng = engine.get(name);
    const same = JSON.stringify(dev) === JSON.stringify(eng);
    if (typeof dev === "string") {
        console.log(`${name}  device ${dev}  engine ${eng ?? "-"}${same ? "" : "  <-- differs"}`);
        continue;
    }
    console.log(`${name}${same ? "  (identical)" : ""}`);
    const width = Number(process.argv[4]) || Math.round(Math.sqrt(dev.length));
    const enginePx = Array.isArray(eng) ? eng : [];
    for (let y = 0; y < dev.length / width; y++) {
        console.log(`  ${row(dev, y, width)}    ${row(enginePx, y, width)}`);
    }
}
