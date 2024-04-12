// Generic module declarations for libraries without TypeScript support
declare module "nanomatch";
declare module "libwebpjs";
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
