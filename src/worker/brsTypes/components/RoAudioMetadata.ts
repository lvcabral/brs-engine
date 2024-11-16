import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, Int32, RoAssociativeArray, RoByteArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import mp3Parser from "mp3-parser";

export class RoAudioMetadata extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private fileData: DataView | undefined;

    constructor() {
        super("roAudioMetadata");

        this.registerMethods({
            ifAudioMetadata: [this.setUrl, this.getTags, this.getAudioProperties, this.getCoverArt],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioMetadata>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    private loadFile(interpreter: Interpreter, file: string) {
        let audio: Buffer | undefined;
        const fileData = interpreter.getFileData(file);
        if (fileData.url && fileData.volume) {
            try {
                audio = fileData.volume.readFileSync(fileData.url.pathname);
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,[roAudioMetadata] Error loading audio:${file} - ${err.message}`
                    );
                }
            }
        } else if (interpreter.isDevMode) {
            interpreter.stderr.write(`warning,[roAudioMetadata] Invalid file/volume:${file}`);
        }
        if (audio instanceof Buffer) {
            return new DataView(audio.buffer);
        }
        return audio ? new DataView(audio as ArrayBuffer) : undefined;
    }

    private updateTagsFromSection(tags: RoAssociativeArray, frames: any) {
        const idToTagMap = new Map([
            ["TCON", "genre"],
            ["TIT2", "title"],
            ["TPE1", "artist"],
            ["TALB", "album"],
            ["TCOM", "composer"],
            ["COMM", "comment"],
            ["TYER", "year"],
            ["TRCK", "track"],
        ]);
        for (let frame of frames) {
            const tagName = idToTagMap.get(frame?.header?.id);
            const tagContent = frame?.content?.value;
            if (typeof tagName === "string" && typeof tagContent === "string") {
                if (["year", "track"].includes(tagName)) {
                    tags.set(new BrsString(tagName), new Int32(this.parseIntSafe(tagContent)));
                } else {
                    tags.set(new BrsString(tagName), new BrsString(tagContent));
                }
            }
        }
    }

    private getCoverArtFromSection(frames: any): RoAssociativeArray | null {
        for (let frame of frames) {
            if (frame?.header?.id === "APIC") {
                const cover = new RoAssociativeArray([]);
                const imageArray = new Uint8Array(
                    frame.content.pictureData.buffer,
                    frame.content.pictureData.byteOffset,
                    frame.content.pictureData.byteLength
                );
                cover.set(new BrsString("bytes"), new RoByteArray(imageArray));
                cover.set(new BrsString("type"), new BrsString(frame.content.mimeType));
                return cover;
            }
        }
        return null;
    }

    private parseIntSafe(str: string): number {
        const result = parseInt(str, 10);
        return isNaN(result) ? 0 : result;
    }

    // ifAudioMetadata -------------------------------------------

    /**
     * Sets the URL to the audio file. Only file URLs are initially supported.
     */
    private readonly setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, url: BrsString) => {
            this.fileData = this.loadFile(interpreter, url.value);
            return BrsBoolean.from(this.fileData !== undefined);
        },
    });

    /**
     * Returns an associative array that contains a simple set of tags that are common to most audio formats.
     */
    private readonly getTags = new Callable("getTags", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }

            try {
                const audioProps = mp3Parser.readTags(this.fileData);
                let tags = new RoAssociativeArray([
                    { name: new BrsString("genre"), value: new BrsString("") },
                    { name: new BrsString("title"), value: new BrsString("") },
                    { name: new BrsString("artist"), value: new BrsString("") },
                    { name: new BrsString("album"), value: new BrsString("") },
                    { name: new BrsString("composer"), value: new BrsString("") },
                    { name: new BrsString("comment"), value: new BrsString("") },
                    { name: new BrsString("year"), value: new Int32(0) },
                    { name: new BrsString("track"), value: new Int32(0) },
                ]);
                if (audioProps instanceof Array && audioProps.length > 0) {
                    for (let section of audioProps) {
                        if (section?._section?.type === "ID3v2") {
                            this.updateTagsFromSection(tags, section.frames);
                            break;
                        }
                    }
                    return tags;
                }
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,[roAudioMetadata] Error getting audio tags:${err.message}`
                    );
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns an associative array with a simple set of audio properties.
     */
    private readonly getAudioProperties = new Callable("getAudioProperties", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const audioProps = mp3Parser.readTags(this.fileData);
                if (audioProps instanceof Array && audioProps.length > 0) {
                    const properties = new RoAssociativeArray([]);
                    for (let section of audioProps) {
                        if (section?._section?.type !== "frame") {
                            continue;
                        }
                        const fileSizeInBytes = this.fileData.byteLength;
                        const headerSize = section._section?.offset ?? 0;
                        const bitrateInKbps = section.header?.bitrate ?? 48;
                        const lengthInSeconds =
                            ((fileSizeInBytes - headerSize) * 8) / (bitrateInKbps * 1000);
                        properties.set(new BrsString("length"), new Int32(lengthInSeconds));
                        properties.set(new BrsString("bitrate"), new Int32(bitrateInKbps));
                        const sampleRate = audioProps[1]?.header?.samplingRate ?? 0;
                        properties.set(new BrsString("samplerate"), new Int32(sampleRate));
                        const channels = audioProps[1]?.header?.channelModeBits === "11" ? 1 : 2;
                        properties.set(new BrsString("channels"), new Int32(channels));
                        break;
                    }
                    return properties;
                }
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,[roAudioMetadata] Error reading audio properties:${err.message}`
                    );
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns the cover art, if available.
     */
    private readonly getCoverArt = new Callable("getCoverArt", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const audioProps = mp3Parser.readTags(this.fileData);
                if (audioProps instanceof Array && audioProps.length > 0) {
                    for (let section of audioProps) {
                        if (section?._section?.type === "ID3v2") {
                            const coverArt = this.getCoverArtFromSection(section.frames);
                            return coverArt ?? BrsInvalid.Instance;
                        }
                    }
                }
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,[roAudioMetadata] Error getting cover art:${err.message}`
                    );
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
