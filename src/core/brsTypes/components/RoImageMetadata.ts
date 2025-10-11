import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, Float, Int32, RoAssociativeArray, RoByteArray, RoDateTime, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import { ExifSections, exifTags, exifTagEnums, ExifTag } from "../ExifTags";
import * as exifParser from "exif-parser";
import { BrsDevice } from "../../device/BrsDevice";

export class RoImageMetadata extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private fileData: Buffer | undefined;

    constructor() {
        super("roImageMetadata");

        this.registerMethods({
            ifImageMetadata: [this.setUrl, this.getMetadata, this.getThumbnail, this.getRawExif, this.getRawExifTag],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roImageMetadata>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    private loadFile(_: Interpreter, file: string) {
        let image: Buffer | undefined;
        try {
            image = BrsDevice.fileSystem?.readFileSync(file);
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roImageMetadata] Error loading bitmap:${file} - ${err.message}`);
            }
        }
        return image;
    }

    private findValue(tags: ExifTag[], section: number, type: number): any {
        const tag = tags.find((tag) => tag.section === section && tag.type === type);
        return tag ?? null;
    }

    private getTagData(tag: any, tags: Map<number, string> = exifTags.exif) {
        let tagValue: string;
        const tagType: string = tags.get(tag.type) ?? "";
        const tagEnum = exifTagEnums[tagType];
        switch (typeof tag.value) {
            case "string":
                tagValue = tag.value;
                break;
            case "number":
                if (tagEnum !== undefined) {
                    tagValue = tagEnum[tag.value] ?? tag.value.toString();
                } else {
                    tagValue = tag.value.toString();
                }
                break;
            default:
                if (tag.value instanceof Buffer) {
                    tagValue = this.processBufferTag(tagType, tag.value);
                } else if (tag.value instanceof ArrayBuffer) {
                    tagValue = this.processBufferTag(tagType, Buffer.from(tag.value));
                } else if (tag.value instanceof Array) {
                    if (tagType === "GPSTimeStamp") {
                        tagValue = tag.value.join(":");
                    } else if (tagType === "SubjectArea") {
                        tagValue = this.decodeExifSubjectArea(tag.value);
                    } else {
                        tagValue = tag.value.join(", ");
                    }
                } else {
                    tagValue = tag.value.toString();
                }
        }
        return toAssociativeArray({ tag: tag.type, tagValue: tagValue });
    }

    private processBufferTag(tagType: string, tagValue: Buffer): string {
        let value: string;
        switch (tagType) {
            case "UserComment":
                value = this.decodeUserComment(tagValue);
                break;
            case "ComponentsConfiguration":
                value = this.decodeComponentsConfiguration(tagValue);
                break;
            case "FileSource":
                value = tagValue.toString("ascii") === "\x03" ? "DSC" : tagValue.toString();
                break;
            case "SceneType":
                value = tagValue.toString("ascii") === "\x01" ? "Directly photographed" : tagValue.toString();
                break;
            case "ExifVersion":
                value = `Exif Version ${this.decodeVersion(tagValue)}`;
                break;
            case "FlashpixVersion":
                value = `Flashpix Version ${this.decodeVersion(tagValue)}`;
                break;
            case "InteroperabilityVersion":
                value = tagValue.toString("ascii");
                break;
            default:
                value = `${tagValue.length} bytes undefined data`;
        }
        return value;
    }

    private decodeComponentsConfiguration(buffer: Buffer): string {
        const components = ["-", "Y", "Cb", "Cr", "R", "G", "B"];
        let configuration = "";
        for (let i = 0; i < Math.max(buffer.length, 4); i++) {
            configuration += components[buffer[i]] + " ";
        }
        return configuration.trim();
    }

    private decodeUserComment(buffer: Buffer): string {
        if (buffer instanceof Buffer) {
            const encoding = buffer.toString("ascii", 0, 8);
            const commentBuffer = buffer.subarray(8);
            try {
                switch (encoding) {
                    case "ASCII\0\0\0":
                        return new TextDecoder("ascii").decode(commentBuffer);
                    case "UNICODE\0":
                        return new TextDecoder("utf-16").decode(commentBuffer);
                    case "JIS\0\0\0\0\0":
                        return new TextDecoder("iso-2022-jp").decode(commentBuffer);
                    default:
                        // If no encoding is specified, assume ASCII
                        return new TextDecoder("ascii").decode(commentBuffer);
                }
            } catch (err: any) {
                return "";
            }
        }
        return "";
    }

    private decodeExifSubjectArea(subjectArea: number[]): string {
        switch (subjectArea.length) {
            case 2:
                return `(x,y) = (${subjectArea[0]}, ${subjectArea[1]})`;
            case 3:
                return `Within distance ${subjectArea[2]} of (x, y) = (${subjectArea[0]}, ${subjectArea[1]})`;
            case 4:
                return `Within rectangle (width ${subjectArea[0]}, height ${subjectArea[1]}) around (x,y) = (${subjectArea[2]}, ${subjectArea[3]})`;
            default:
                return `Unexpected number of components (${
                    subjectArea.length
                }, expected 2, 3, or 4). ${subjectArea.join(", ")}`;
        }
    }

    private decodeVersion(buffer: Buffer) {
        let decoded = new TextDecoder("ascii").decode(buffer);
        let version = parseFloat(`${decoded.slice(0, 2)}.${decoded.slice(2)}`);
        return Number.isInteger(version) ? version + ".0" : version.toString();
    }

    // ifImageMetadata -------------------------------------------

    /**
     * Set the URL of the image file to read metadata from.
     */
    private readonly setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, url: BrsString) => {
            this.fileData = this.loadFile(interpreter, url.value);
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns a set of simple and common image metadata
     */
    private readonly getMetadata = new Callable("getMetadata", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            const fields = new Map<string, any>();
            try {
                const parser = exifParser.create(this.fileData);
                parser.enableBinaryFields(true);
                const result = parser.parse();
                let imageSize = result.getImageSize();
                if (result.tags) {
                    fields.set("comment", this.decodeUserComment(result.tags["UserComment"]));
                    if (typeof result.tags["CreateDate"] === "number") {
                        fields.set("datetime", new RoDateTime(result.tags["CreateDate"]));
                    }
                    const tagEnum = exifTagEnums["Orientation"];
                    fields.set("width", imageSize?.width ?? 0);
                    fields.set("height", imageSize?.height ?? 0);
                    fields.set("orientation", tagEnum[result.tags["Orientation"] ?? 0] ?? "");
                }
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roImageMetadata] Error reading metadata:${err.message}`);
                }
                fields.set("width", 0);
                fields.set("height", 0);
                fields.set("comment", "");
                fields.set("orientation", "");
            }
            return toAssociativeArray(fields);
        },
    });

    /**
     * Returns a thumbnail image if one is embedded in the image metadata and the corresponding associative array with image data.
     */
    private readonly getThumbnail = new Callable("getThumbnail", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const parser = exifParser.create(this.fileData);
                parser.enableReturnTags(false);
                const result = parser.parse();
                if (result.hasThumbnail("image/jpeg")) {
                    const thumbnail = result.getThumbnailBuffer();
                    if (thumbnail) {
                        const thumbData = new RoByteArray(new Uint8Array(thumbnail));
                        return toAssociativeArray({ bytes: thumbData, type: "image/jpeg" });
                    }
                }
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roImageMetadata] Error getting thumbnail:${err.message}`);
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns all of the raw EXIF metadata.
     */
    private readonly getRawExif = new Callable("getRawExif", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const sectionExif = new Map<string, any>();
                const sectionGPS = new Map<string, any>();
                const sectionImage = new Map<string, any>();
                const sectionInterop = new Map<string, any>();
                const sectionThumbnail = new Map<string, any>();
                const parser = exifParser.create(this.fileData);
                parser.enablePointers(true);
                parser.enableBinaryFields(true);
                parser.enableTagNames(false);
                parser.enableImageSize(false);
                const result = parser.parse();
                for (const tag of result.tags) {
                    const tagsMap = tag.section === ExifSections.GPS ? exifTags.gps : exifTags.exif;
                    const tagTypeName = tagsMap.get(tag.type as number) ?? "";
                    if (tagTypeName === "") {
                        continue;
                    }
                    if (tag.section === ExifSections.EXIF || tag.section === ExifSections.Interop) {
                        if (tagTypeName.startsWith("Interop")) {
                            sectionInterop.set(tagTypeName, this.getTagData(tag));
                        } else {
                            sectionExif.set(tagTypeName, this.getTagData(tag));
                        }
                    } else if (tag.section === ExifSections.GPS) {
                        sectionGPS.set(tagTypeName, this.getTagData(tag, tagsMap));
                    } else if (tag.section === ExifSections.Image) {
                        sectionImage.set(tagTypeName, this.getTagData(tag));
                    } else if (tag.section === ExifSections.Thumbnail) {
                        sectionThumbnail.set(tagTypeName, this.getTagData(tag));
                    }
                }
                const rawExif = {
                    exif: sectionExif,
                    gps: sectionGPS,
                    image: sectionImage,
                    interoperability: sectionInterop,
                    thumbnail: sectionThumbnail,
                };
                return toAssociativeArray(rawExif);
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roImageMetadata] Error getting raw exif:${err.message}`);
                }
                return new RoAssociativeArray([]);
            }
        },
    });

    /**
     * Returns the raw data for an Exif tag. The method provides direct access to a specific raw EXIF tag.
     */
    private readonly getRawExifTag = new Callable("getRawExifTag", {
        signature: {
            args: [
                new StdlibArgument("ifd", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("tagnum", ValueKind.Int32 | ValueKind.Float),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, ifd: Int32 | Float, tagnum: Int32 | Float) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const parser = exifParser.create(this.fileData);
                parser.enablePointers(true);
                parser.enableBinaryFields(true);
                parser.enableTagNames(false);
                parser.enableImageSize(false);
                const result = parser.parse();
                const tagsMap = ifd.getValue() === ExifSections.GPS ? exifTags.gps : exifTags.exif;
                const sectionIdMap: { [key: number]: ExifSections } = {
                    0: ExifSections.Image,
                    1: ExifSections.Thumbnail,
                    2: ExifSections.EXIF,
                    3: ExifSections.GPS,
                    4: ExifSections.EXIF, // the exif-parser library mix interoperability tags with exif tags
                };
                const sectionId = sectionIdMap[ifd.getValue()] ?? ExifSections.EXIF;
                const tag = this.findValue(result.tags, sectionId, tagnum.getValue());
                return tag ? this.getTagData(tag, tagsMap) : new RoAssociativeArray([]);
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roImageMetadata] Error getting raw exif tag:${err.message}`);
                }
                return new RoAssociativeArray([]);
            }
        },
    });
}
