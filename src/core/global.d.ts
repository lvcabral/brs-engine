// Generic module declarations for libraries without TypeScript support
declare module "nanomatch";
declare module "@lvcabral/libwebp";
declare module "mp3-parser";

declare module "exif-parser" {
    export function create(buffer: Buffer): Parser;
    export interface Parser {
        parse(): Result;
        getImage(): Buffer | null;
        enablePointers(enable: boolean): void;
        enableSimpleValues(enable: boolean): void;
        enableBinaryFields(enable: boolean): void;
        enableReturnTags(enable: boolean): void;
        enableTagNames(enable: boolean): void;
        enableImageSize(enable: boolean): void;
    }
    export interface Result {
        tags: any;
        getImageSize(): { width: number; height: number } | null;
        hasThumbnail(format: string): boolean;
        getThumbnailSize(): { width: number; height: number } | null;
        getThumbnailBuffer(): Buffer | null;
    }
}

declare module "*.brs" {
    const content: any;
    export default content;
}
declare module "*.csv" {
    const content: any;
    export default content;
}

declare module "omggif" {
    export type ByteArray = Uint8Array | Buffer;

    export interface OmggifModule {
        GifWriter: GifWriter;
        GifReader: GifReader;
    }

    export interface GlobalOptions {
        loop?: number; // 0 = unending loop; n > 0 = (n+1) iterations; null = once
        palette?: number[]; // global palette RGB by color index
        background?: number; // background index; most browsers may ignore this
    }

    export interface FrameOptions {
        palette?: number[]; // RGB by color index
        delay?: number; // duation in 100s of a second
        disposal?: number; // what to do with background color (0-3)
        transparent?: number; // transparency index
    }

    export class GifWriter {
        constructor(buffer: ByteArray, width: number, height: number, gopts?: GlobalOptions);
        addFrame(
            x: number,
            y: number,
            width: number,
            height: number,
            indexedPixels: ArrayBuffer,
            opts?: FrameOptions
        ): number; // returns size of buffer at end of frame
        getOutputBuffer(): ByteArray;
        setOutputBuffer(buffer: ByteArray): void;
        getOutputBufferPosition(): number;
        setOutputBufferPosition(position: number): void;
        end(): number; // ends GIF and returns size of buffer
    }

    export class GifReader {
        width: number;
        height: number;
        constructor(buffer: ByteArray);
        numFrames(): number;
        loopCount(): number;
        frameInfo(frameNumber: number): FrameInfo;
        decodeAndBlitFrameBGRA(frameNumber: number, pixels: ArrayBuffer): void;
        decodeAndBlitFrameRGBA(frameNumber: number, pixels: ArrayBuffer): void;
    }

    export interface FrameInfo {
        x: number;
        y: number;
        width: number;
        height: number;
        has_local_palette: boolean;
        palette_offset: number;
        data_offset: number;
        data_length: number;
        transparent_index: number;
        interlaced: boolean;
        delay: number; // 100ths of a second
        disposal: number;
    }
}

// Only supported by Chromium browsers, added to compile without errors
interface ChromiumPerformance extends Performance {
    memory?: {
        /** The maximum size of the heap, in bytes, that is available to the context. */
        jsHeapSizeLimit: number;
        /** The total allocated heap size, in bytes. */
        totalJSHeapSize: number;
        /** The currently active segment of JS heap, in bytes. */
        usedJSHeapSize: number;
    };
}
