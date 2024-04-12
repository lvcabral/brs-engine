import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType, Int32, RoAssociativeArray, RoByteArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import NodeID3 from "node-id3";

export class RoAudioMetadata extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private fileData: Buffer | undefined;
    private url: BrsString = new BrsString("");

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
            // Parse the audio file data and return the audio properties as a RoAssociativeArray.
            // This is a placeholder implementation and may need to be adjusted based on your specific requirements.
            let properties = new RoAssociativeArray([]);
            return properties;
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
            const options = {
                include: ["APIC"],
                noRaw: true,
            };
            const iD3tags = NodeID3.read(this.fileData, options);
            if (typeof iD3tags?.image !== "object") {
                return BrsInvalid.Instance;
            }
            const image = iD3tags.image;
            const cover = new RoAssociativeArray([]);
            const imageArray = new Uint8Array(Buffer.from(image.imageBuffer))
            cover.set(new BrsString("bytes"), new RoByteArray(imageArray));
            cover.set(new BrsString("type"), new BrsString(image.mime));
            return cover;
        },
    });
}
