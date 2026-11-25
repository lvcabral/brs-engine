// Replaces each px:<png hex>:<raw hex> readout in a probe trace with its pixels as r,g,b,a (joined by ';').
// The raw GetByteArray bytes are used unless they are all zero (the device reads back zeros; every probe pixel is
// opaque), else the PNG is decoded.
// Shared by the Draw2D probes in this folder. Usage: node ../decode-px.mjs <trace.txt> (from a probe folder)
import { readFileSync } from "node:fs";
import UPNG from "@lvcabral/upng";

function format(data) {
    const out = [];
    for (let i = 0; i < data.length; i += 4) {
        out.push(Array.from(data.subarray(i, i + 4)).join(","));
    }
    return out.join(";");
}

function pixels(pngHex, rawHex) {
    const raw = Buffer.from(rawHex, "hex");
    if (raw.some((byte) => byte !== 0)) {
        return format(raw);
    }
    try {
        const png = Buffer.from(pngHex, "hex");
        const image = UPNG.decode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
        return format(new Uint8Array(UPNG.toRGBA8(image)[0]));
    } catch (err) {
        return `png-error(${err.message})`;
    }
}

for (const line of readFileSync(process.argv[2], "utf8").split("\n")) {
    if (line) {
        console.log(line.replaceAll(/px:([0-9A-Fa-f]*):([0-9A-Fa-f]*)/g, (_, png, raw) => pixels(png, raw)));
    }
}
