/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { parseGIF, decompressFrames } from "gifuct-js";
import fileType from "file-type";
import UPNG from "@lvcabral/upng";
import * as JPEG from "jpeg-js";
import BMP from "decode-bmp";
import { WebPRiffParser, WebPDecoder } from "@lvcabral/libwebp";
import { isTypeOf } from "../common";

/** Decoded image as RGBA8 pixels (`width * height * 4` bytes). */
export interface DecodedImage {
    width: number;
    height: number;
    data: Uint8Array;
}

/**
 * Decodes PNG, JPEG, WebP (first frame), GIF (first frame) or BMP into RGBA8 pixels.
 * Returns `undefined` for an unsupported format; throws if the data is corrupt.
 */
export function decodeImage(image: Uint8Array): DecodedImage | undefined {
    const mime = fileType(image)?.mime;
    // UPNG and gifuct type their input as ArrayBuffer, but both just wrap it in a new Uint8Array.
    const input = image as unknown as ArrayBuffer;
    if (mime === "image/png") {
        const png = UPNG.decode(input);
        const frames = UPNG.toRGBA8(png);
        return frames.length ? { width: png.width, height: png.height, data: toBytes(frames[0]) } : undefined;
    } else if (mime === "image/jpeg") {
        const jpg = JPEG.decode(image);
        return { width: jpg.width, height: jpg.height, data: toBytes(jpg.data) };
    } else if (mime === "image/webp") {
        const imgBuffer = Buffer.from(image);
        const imgArray = WebPRiffParser(imgBuffer, 0);
        if (imgArray?.frames?.length) {
            const width = [0];
            const height = [0];
            const frame = imgArray.frames[0];
            const data = new WebPDecoder().WebPDecodeRGBA(
                imgBuffer,
                frame["src_off"],
                frame["src_size"],
                width,
                height
            );
            return data ? { width: width[0], height: height[0], data: toBytes(data) } : undefined;
        }
    } else if (mime === "image/gif") {
        const frames = decompressFrames(parseGIF(input), true);
        if (frames.length) {
            const { width, height } = frames[0].dims;
            return { width, height, data: toBytes(frames[0].patch) };
        }
    } else if (mime === "image/bmp") {
        const bmp = BMP(image);
        return { width: bmp.width, height: bmp.height, data: toBytes(bmp.data) };
    }
    return undefined;
}

/** Views decoder output as bytes; arrays of wider elements (one byte value each) are converted. */
export function toBytes(data: ArrayBufferLike | ArrayBufferView | ArrayLike<number>): Uint8Array {
    if (ArrayBuffer.isView(data) && (data as Uint8Array).BYTES_PER_ELEMENT === 1) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer || isTypeOf(data, "ArrayBuffer")) {
        return new Uint8Array(data as ArrayBuffer);
    }
    return Uint8Array.from(data as ArrayLike<number>);
}

/** Returns the image type's MIME string, as detected from its header bytes. */
export function imageMimeType(image: Uint8Array): string | undefined {
    return fileType(image)?.mime;
}
