import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, Float, Int32, RoAssociativeArray, RoDateTime } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import { ExifSections, exifTags, exifTagEnums } from "../ExifTags";
import * as exifParser from "exif-parser";

export class RoImageMetadata extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private fields = new RoAssociativeArray([]);
    private url: BrsString = new BrsString("");

    constructor() {
        super("roImageMetadata");

        this.registerMethods({
            ifImageMetadata: [
                this.setUrl,
                this.getMetadata,
                this.getThumbnail,
                this.getRawExif,
                this.getRawExifTag,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roImageMetadata>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    loadFile(interpreter: Interpreter, file: string) {
        let url = new URL(file);
        let image: Buffer | undefined;
        const volume = interpreter.fileSystem.get(url.protocol);
        if (volume) {
            try {
                image = volume.readFileSync(url.pathname);
            } catch (err: any) {
                postMessage(`error,Error loading bitmap:${url.pathname} - ${err.message}`);
            }
        } else {
            postMessage(`error,Invalid volume:${url.pathname}`);
        }
        return image;
    }

    getTagData(tag: any, tags: Map<number, string> = exifTags.exif) {
        let tagValue = new BrsString("");
        switch (typeof tag.value) {
            case "string":
                tagValue = new BrsString(tag.value);
                break;
            case "number":
                const tagType: string = tags.get(tag.type) ?? "";
                const tagEnum = exifTagEnums[tagType];
                if (tagEnum !== undefined) {
                    tagValue = new BrsString(tagEnum[tag.value] ?? tag.value.toString());
                } else {
                    tagValue = new BrsString(tag.value.toString());
                }
                break;
            default:
                if (tag.value instanceof Buffer) {
                    switch (tags.get(tag.type)) {
                        case "UserComment":
                            tagValue = new BrsString(this.decodeUserComment(tag.value));
                            break;
                        case "ComponentsConfiguration":
                            tagValue = new BrsString(this.decodeComponentsConfiguration(tag.value));
                            break;
                        case "FileSource":
                            tagValue = new BrsString(
                                tag.value.toString("ascii") === "\x03"
                                    ? "DSC"
                                    : tag.value.toString()
                            );
                            break;
                        case "SceneType":
                            tagValue = new BrsString(
                                tag.value.toString("ascii") === "\x01"
                                    ? "Directly photographed"
                                    : tag.value.toString()
                            );
                            break;
                        case "ExifVersion":
                            tagValue = new BrsString(
                                `Exif Version ${this.decodeVersion(tag.value)}`
                            );
                            break;
                        case "FlashpixVersion":
                            tagValue = new BrsString(
                                `Flashpix Version ${this.decodeVersion(tag.value)}`
                            );
                            break;
                        case "InteroperabilityVersion":
                            tagValue = new BrsString(tag.value.toString("ascii"));
                            break;
                        default:
                            tagValue = new BrsString(`${tag.value.length} bytes undefined data`);
                    }
                } else if (Array.isArray(tag.value)) {
                    const tagType: string = tags.get(tag.type) ?? "";
                    if (tagType === "GPSTimeStamp") {
                        tagValue = new BrsString(tag.value.join(":"));
                    } else if (tagType === "SubjectArea") {
                        tagValue = new BrsString(this.decodeExifSubjectArea(tag.value));
                    } else {
                        tagValue = new BrsString(tag.value.join(", "));
                    }
                } else {
                    tagValue = new BrsString(tag.value.toString());
                }
        }
        return new RoAssociativeArray([
            { name: new BrsString("tag"), value: new Int32(tag.type) },
            { name: new BrsString("value"), value: tagValue },
        ]);
    }

    decodeComponentsConfiguration(buffer: Buffer): string {
        const components = ["-", "Y", "Cb", "Cr", "R", "G", "B"];
        let configuration = "";
        for (let i = 0; i < Math.max(buffer.length, 4); i++) {
            configuration += components[buffer[i]] + " ";
        }
        return configuration.trim();
    }

    decodeUserComment(buffer: Buffer): string {
        let encoding = buffer.toString("ascii", 0, 8);
        let commentBuffer = buffer.subarray(8);

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

    decodeExifSubjectArea(subjectArea: number[]): string {
        switch (subjectArea.length) {
            case 2:
                return `(x,y) = (${subjectArea[0]}, ${subjectArea[1]})`;
            case 3:
                return `Within distance ${subjectArea[2]} of (x, y) = (${subjectArea[0]}, ${subjectArea[1]})`;
            case 4:
                return `Within rectangle (width ${subjectArea[0]}, height ${subjectArea[1]}) around (x,y) = (${subjectArea[2]}, ${subjectArea[3]})`;
            default:
                return `Unexpected number of components (${subjectArea.length}, expected 2, 3, or 4). ${subjectArea.join(", ")}`;
        }
    }

    decodeVersion(buffer: Buffer) {
        let decoded = new TextDecoder("ascii").decode(buffer);
        let version = parseFloat(`${decoded.slice(0, 2)}.${decoded.slice(2)}`);
        return Number.isInteger(version) ? version + ".0" : version.toString();
    }

    private setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, url: BrsString) => {
            this.url = url;
            return BrsInvalid.Instance;
        },
    });

    private getMetadata = new Callable("getMetadata", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const fileData = this.loadFile(interpreter, this.url.value);
            if (!fileData) {
                return new RoAssociativeArray([]);
            }
            const buffer = Buffer.from(fileData);
            const parser = exifParser.create(buffer);
            parser.enableBinaryFields(true);
            const result = parser.parse();
            let imageSize = result.getImageSize();

            if (result.tags) {
                if (result.tags["UserComment"] instanceof Buffer) {
                    this.fields.set(
                        new BrsString("comment"),
                        new BrsString(this.decodeUserComment(result.tags["UserComment"]))
                    );
                } else {
                    this.fields.set(new BrsString("comment"), new BrsString(""));
                }
                if (typeof result.tags["CreateDate"] === "number") {
                    this.fields.set(
                        new BrsString("datetime"),
                        new RoDateTime(result.tags["CreateDate"])
                    );
                }
                const tagEnum = exifTagEnums["Orientation"];
                this.fields.set(new BrsString("width"), new Int32(imageSize?.width ?? 0));
                this.fields.set(new BrsString("height"), new Int32(imageSize?.height ?? 0));
                this.fields.set(
                    new BrsString("orientation"),
                    new BrsString(tagEnum[result.tags["Orientation"] ?? 0] ?? "")
                );
            }
            return this.fields;
        },
    });

    private getThumbnail = new Callable("getThumbnail", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            // Implementation to retrieve thumbnail from the image at this.url
            // This is a placeholder and should be replaced with actual implementation
            return new RoAssociativeArray([]);
        },
    });

    private getRawExif = new Callable("getRawExif", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const fileData = this.loadFile(interpreter, this.url.value);
            if (!fileData) {
                return new RoAssociativeArray([]);
            }
            const sectionExif = new RoAssociativeArray([]);
            const sectionGPS = new RoAssociativeArray([]);
            const sectionImage = new RoAssociativeArray([]);
            const sectionInterop = new RoAssociativeArray([]);
            const sectionThumbnail = new RoAssociativeArray([]);
            const buffer = Buffer.from(fileData);
            const parser = exifParser.create(buffer);
            parser.enablePointers(true);
            parser.enableBinaryFields(true);
            parser.enableTagNames(false);
            const result = parser.parse();
            result.tags.forEach((tag: any) => {
                const tagsMap = tag.section === ExifSections.GPS ? exifTags.gps : exifTags.exif;
                const tagTypeName = tagsMap.get(tag.type as number) ?? "";
                if (tagTypeName === "") {
                    return;
                }
                if (tag.section === ExifSections.EXIF || tag.section === ExifSections.Interop) {
                    if (tagTypeName.startsWith("Interop")) {
                        sectionInterop.set(new BrsString(tagTypeName), this.getTagData(tag), true);
                    } else {
                        sectionExif.set(new BrsString(tagTypeName), this.getTagData(tag), true);
                    }
                } else if (tag.section === ExifSections.GPS) {
                    sectionGPS.set(new BrsString(tagTypeName), this.getTagData(tag, tagsMap), true);
                } else if (tag.section === ExifSections.Image) {
                    sectionImage.set(new BrsString(tagTypeName), this.getTagData(tag), true);
                } else if (tag.section === ExifSections.Thumbnail) {
                    sectionThumbnail.set(new BrsString(tagTypeName), this.getTagData(tag), true);
                }
            });
            return new RoAssociativeArray([
                { name: new BrsString("exif"), value: sectionExif },
                { name: new BrsString("gps"), value: sectionGPS },
                { name: new BrsString("image"), value: sectionImage },
                { name: new BrsString("interoperability"), value: sectionInterop },
                { name: new BrsString("thumbnail"), value: sectionThumbnail },
            ]);
        },
    });

    private getRawExifTag = new Callable("getRawExifTag", {
        signature: {
            args: [
                new StdlibArgument("ifd", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("tagnum", ValueKind.Int32 | ValueKind.Float),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, ifd: Int32 | Float, tag: Int32 | Float) => {
            // Implementation to retrieve a specific raw Exif tag from the image at this.url
            // This is a placeholder and should be replaced with actual implementation
            return BrsInvalid.Instance;
        },
    });
}
