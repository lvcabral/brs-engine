import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsType, isBrsString, BrsString } from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { DataType, MediaEvent } from "../../common";

export class SoundEffect extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "control", type: "string", value: "none", alwaysNotify: true },
        { name: "state", type: "string", value: "none", alwaysNotify: true },
        { name: "loadStatus", type: "string", value: "none", alwaysNotify: true },
        { name: "volume", type: "integer", value: "50" },
    ];
    private uri: string;
    private state: string;
    private audioId?: number;

    constructor(members: AAMember[] = [], readonly name: string = "SoundEffect") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
        this.uri = "";
        this.state = "none";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const fieldName = index.getValue().toLowerCase();

        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "stop"];
            const control = value.getValue().toLowerCase();
            if (!validControl.includes(control) || this.audioId === undefined) {
                value = new BrsString("none");
                return super.set(index, value, alwaysNotify, kind);
            }
            if (control === "play") {
                const volume = this.getFieldValueJS("volume") as number;
                const stream = BrsDevice.getSfxStream(this.audioId);
                if (stream === -1) {
                    if (BrsDevice.isDevMode) {
                        BrsDevice.stderr.write(`warning,No available sound effect streams for ${this.uri}`);
                    }
                    this.state = "toomanysounds";
                } else {
                    console.debug(`SoundEffect.play: ${this.uri} on stream ${stream}`);
                    postMessage(`sfx,trigger,${this.uri},${volume},${stream}`);
                    this.state = "playing";
                }
                super.set(new BrsString("state"), new BrsString(this.state));
            } else if (control === "stop") {
                postMessage(`sfx,stop,${this.uri}`);
                this.setState(MediaEvent.PARTIAL);
            }
        } else if (fieldName === "uri" && isBrsString(value)) {
            if (this.state === "playing") {
                postMessage(`sfx,stop,${this.uri}`);
                this.setState(MediaEvent.PARTIAL);
            }
            const uri = value.getValue().toLowerCase();
            const sfxIndex = BrsDevice.sfx.findIndex((wav) => wav === uri);
            if (sfxIndex > -1) {
                this.uri = uri;
                this.audioId = sfxIndex;
            } else if ((uri.startsWith("pkg:") && BrsDevice.fileSystem.existsSync(uri)) || uri.startsWith("http")) {
                this.uri = uri;
                this.audioId = BrsDevice.sfx.length;
                postMessage(`sfx,new,${uri},${this.audioId}`);
                BrsDevice.sfx.push(uri);
            } else {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,Invalid sound effect URI: ${uri}`);
                }
                this.uri = "";
                this.audioId = undefined;
                this.setState(MediaEvent.FAILED);
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setState(flags: number) {
        //TODO: Create the event to change the state
        this.state = "none";
        switch (flags) {
            case MediaEvent.LOADING:
                this.state = "buffering";
                break;
            case MediaEvent.START_PLAY:
            case MediaEvent.START_STREAM:
            case MediaEvent.SELECTED:
            case MediaEvent.RESUMED:
                this.state = "playing";
                break;
            case MediaEvent.PARTIAL:
                this.state = "stopped";
                break;
            case MediaEvent.FULL:
                this.state = "finished";
                break;
            case MediaEvent.FAILED:
                this.state = "notready";
                break;
        }
        super.set(new BrsString("state"), new BrsString(this.state));
    }
}
