import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, Int32, RoAssociativeArray, RoByteArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import NodeID3 from "node-id3";
import mp3Parser from "mp3-parser";
import util from "util";

export class RoAudioMetadata extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private fileData: Buffer | undefined;
    private url: BrsString = new BrsString("");
    private devMode = false;

    constructor() {
        super("roAudioMetadata");
        if (process.env.NODE_ENV === "development") {
            // Only raise errors when in development mode
            this.devMode = true;
        }

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

    loadFile(interpreter: Interpreter, file: string) {
        let url = new URL(file);
        let audio: Buffer | undefined;
        const volume = interpreter.fileSystem.get(url.protocol);
        if (volume) {
            try {
                audio = volume.readFileSync(url.pathname);
            } catch (err: any) {
                postMessage(`error,Error loading audio:${url.pathname} - ${err.message}`);
            }
        } else {
            postMessage(`error,Invalid volume:${url.pathname}`);
        }
        return audio ? Buffer.from(audio) : undefined;
    }

    setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, url: BrsString) => {
            this.fileData = this.loadFile(interpreter, url.value);
            this.url = url;
            return BrsBoolean.from(this.fileData !== undefined);
        },
    });

    getTags = new Callable("getTags", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            const options = {
                exclude: ["APIC"],
                noRaw: true,
            };
            const iD3tags = NodeID3.read(this.fileData, options);
            if (!iD3tags || Object.keys(iD3tags).length === 0) {
                return BrsInvalid.Instance;
            }
            let tags = new RoAssociativeArray([]);
            tags.set(new BrsString("title"), new BrsString(iD3tags.title ?? ""));
            tags.set(new BrsString("artist"), new BrsString(iD3tags.artist ?? ""));
            tags.set(new BrsString("album"), new BrsString(iD3tags.album ?? ""));
            tags.set(new BrsString("composer"), new BrsString(iD3tags.composer ?? ""));
            tags.set(new BrsString("comment"), new BrsString(iD3tags.comment?.text ?? ""));
            tags.set(new BrsString("genre"), new BrsString(iD3tags.genre ?? ""));
            const year = iD3tags.year ? parseInt(iD3tags.year) : 0;
            tags.set(new BrsString("year"), new Int32(year));
            const track = iD3tags.trackNumber ? parseInt(iD3tags.trackNumber) : 0;
            tags.set(new BrsString("track"), new Int32(track));
            return tags;
        },
    });

    getAudioProperties = new Callable("getAudioProperties", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            try {
                const dataView = new DataView(this.fileData.buffer);
                const audioProps = mp3Parser.readTags(dataView);
                if (this.devMode) {
                    console.log("\nTags:\n-----");
                    console.log(util.inspect(audioProps, { depth: 5, colors: true }));
                }
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
                } else {
                    return BrsInvalid.Instance;
                }
            } catch (err: any) {
                if (this.devMode) {
                    postMessage(`warning,Error reading audio properties:${err.message}`);
                }
                return BrsInvalid.Instance;
            }
        },
    });

    getCoverArt = new Callable("getCoverArt", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (!this.fileData) {
                return BrsInvalid.Instance;
            }
            const dataView = new DataView(this.fileData.buffer);
            const audioProps = mp3Parser.readTags(dataView);
            if (audioProps instanceof Array && audioProps.length > 0) {
                for (let section of audioProps) {
                    if (section?._section?.type !== "ID3v2") {
                        continue;
                    }
                    for (let frame of section.frames) {
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
                    break;
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
