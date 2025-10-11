import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, FlexObject, Int32, RoAssociativeArray, RoByteArray, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import mp3Parser from "mp3-parser";
import { BrsDevice } from "../../device/BrsDevice";

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

    private loadFile(file: string) {
        let audio: Buffer | undefined;
        try {
            audio = BrsDevice.fileSystem?.readFileSync(file);
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roAudioMetadata] Error loading audio:${file} - ${err.message}`);
            }
        }
        if (audio instanceof Buffer) {
            return new DataView(audio.buffer);
        }
        return audio ? new DataView(audio as any) : undefined;
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
                const imageArray = new RoByteArray(
                    new Uint8Array(
                        frame.content.pictureData.buffer,
                        frame.content.pictureData.byteOffset,
                        frame.content.pictureData.byteLength
                    )
                );
                const coverArt = { bytes: imageArray, type: frame.content.mimeType };
                return toAssociativeArray(coverArt);
            }
        }
        return null;
    }

    private parseIntSafe(str: string): number {
        const result = Number.parseInt(str, 10);
        return Number.isNaN(result) ? 0 : result;
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
        impl: (_: Interpreter, url: BrsString) => {
            this.fileData = this.loadFile(url.value);
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
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }

            try {
                const audioProps = mp3Parser.readTags(this.fileData);
                const tags = toAssociativeArray({
                    genre: "",
                    title: "",
                    artist: "",
                    album: "",
                    composer: "",
                    comment: "",
                    year: 0,
                    track: 0,
                });
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
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roAudioMetadata] Error getting audio tags:${err.message}`);
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
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const audioProps = mp3Parser.readTags(this.fileData);
                if (audioProps instanceof Array && audioProps.length > 0) {
                    const properties: FlexObject = {};
                    for (let section of audioProps) {
                        if (section?._section?.type !== "frame") {
                            continue;
                        }
                        const fileSize = this.fileData.byteLength;
                        const headerSize = section._section?.offset ?? 0;
                        const bitrate = section.header?.bitrate ?? 48;
                        const length = Math.round(((fileSize - headerSize) * 8) / (bitrate * 1000));
                        const sampleRate = audioProps[1]?.header?.samplingRate ?? 0;
                        const channels = audioProps[1]?.header?.channelModeBits === "11" ? 1 : 2;
                        properties.length = length;
                        properties.bitrate = bitrate;
                        properties.samplerate = sampleRate;
                        properties.channels = channels;
                        break;
                    }
                    return toAssociativeArray(properties);
                }
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roAudioMetadata] Error reading audio properties:${err.message}`);
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
        impl: (_: Interpreter) => {
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
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[roAudioMetadata] Error getting cover art:${err.message}`);
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
