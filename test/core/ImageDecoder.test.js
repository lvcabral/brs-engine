import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "canvas";
import { decodeImage } from "../../src/core/device/ImageDecoder.ts";

function canvasImage(width, height, mime) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, width, height);
    return new Uint8Array(canvas.toBuffer(mime));
}

/** A bottom-up 24-bit BMP, all pixels blue. */
function bmpImage(width, height) {
    const rowSize = Math.ceil((width * 3) / 4) * 4;
    const buffer = Buffer.alloc(54 + rowSize * height);
    buffer.write("BM", 0, "ascii");
    buffer.writeUInt32LE(buffer.length, 2);
    buffer.writeUInt32LE(54, 10);
    buffer.writeUInt32LE(40, 14);
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(height, 22);
    buffer.writeUInt16LE(1, 26);
    buffer.writeUInt16LE(24, 28);
    buffer.writeUInt32LE(rowSize * height, 34);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            buffer[54 + y * rowSize + x * 3] = 0xff;
        }
    }
    return new Uint8Array(buffer);
}

// 1x1 transparent GIF
const gif1x1 = new Uint8Array(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));

describe("ImageDecoder", () => {
    describe("decodeImage", () => {
        it("decodes PNG, JPEG, GIF and BMP into RGBA8 pixels", () => {
            const png = decodeImage(canvasImage(4, 2, "image/png"));
            expect([png.width, png.height, png.data.length]).toEqual([4, 2, 32]);
            expect(Array.from(png.data.subarray(0, 4))).toEqual([255, 0, 0, 255]);

            const jpg = decodeImage(canvasImage(8, 8, "image/jpeg"));
            expect([jpg.width, jpg.height, jpg.data.length]).toEqual([8, 8, 256]);

            const gif = decodeImage(gif1x1);
            expect([gif.width, gif.height, gif.data.length]).toEqual([1, 1, 4]);

            const bmp = decodeImage(bmpImage(3, 2));
            expect([bmp.width, bmp.height]).toEqual([3, 2]);
            expect(Array.from(bmp.data.subarray(0, 4))).toEqual([0, 0, 255, 255]);
        });

        it("decodes the first frame of an animated WebP", () => {
            const webp = decodeImage(
                new Uint8Array(fs.readFileSync(path.join(__dirname, "../brsTypes/resources/animated.webp")))
            );
            expect(webp.width).toBeGreaterThan(0);
            expect(webp.data.length).toBe(webp.width * webp.height * 4);
        });

        it("returns undefined for an unsupported format", () => {
            expect(decodeImage(new Uint8Array(Buffer.from("not an image at all")))).toBeUndefined();
        });
    });
});
