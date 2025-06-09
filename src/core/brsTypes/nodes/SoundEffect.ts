import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsType, isBrsString, BrsString, isBrsNumber, BrsInvalid, rootObjects } from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { MediaEvent } from "../../common";

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
    private stream: number;
    private audioId: number;

    constructor(members: AAMember[] = [], readonly name: string = "SoundEffect") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
        this.uri = "";
        this.state = "none";
        this.stream = -1;
        this.audioId = -1;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "stop"];
            const control = value.getValue().toLowerCase();
            if (!validControl.includes(control) || this.audioId < 0) {
                value = new BrsString("none");
                return super.set(index, value, alwaysNotify, kind);
            }
            if (control === "play") {
                this.play();
            } else if (control === "stop") {
                this.stop();
            }
        } else if (fieldName === "uri" && isBrsString(value)) {
            if (this.state === "playing") {
                this.stop();
            }
            const uri = value.getValue().toLowerCase();
            this.setUri(uri);
        } else if (fieldName === "volume" && isBrsNumber(value)) {
            const volume = value.getValue() as number;
            if (volume < 0 || volume > 100) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,Volume must be between 0 and 100, received: ${volume}`);
                }
                return BrsInvalid.Instance;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    getAudioId() {
        return this.audioId;
    }

    getState() {
        return this.state;
    }

    setState(flags: number) {
        this.state = "none";
        switch (flags) {
            case MediaEvent.START_PLAY:
                this.state = "playing";
                break;
            case MediaEvent.PARTIAL:
                this.state = "stopped";
                this.stream = -1;
                break;
            case MediaEvent.FINISHED:
                this.state = "finished";
                this.stream = -1;
                break;
            case MediaEvent.FAILED:
                this.state = "notready";
                break;
            case MediaEvent.TOO_MANY:
                this.state = "toomanysounds";
                break;
        }
        super.set(new BrsString("state"), new BrsString(this.state));
    }

    private setUri(uri: string) {
        if ((uri.startsWith("pkg:") && BrsDevice.fileSystem.existsSync(uri)) || uri.startsWith("http")) {
            this.uri = uri;
            const sfxIndex = BrsDevice.sfx.findIndex((wav) => wav === uri);
            if (sfxIndex > -1) {
                this.audioId = sfxIndex;
            } else {
                this.audioId = BrsDevice.sfx.length;
                postMessage(`sfx,new,${uri},${this.audioId}`);
                BrsDevice.sfx.push(uri);
            }
            super.set(new BrsString("loadStatus"), new BrsString("ready"));
        } else {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,Invalid sound effect URI: ${uri}`);
            }
            this.uri = "";
            this.audioId = -1;
            super.set(new BrsString("loadStatus"), new BrsString("failed"));
            this.setState(MediaEvent.FAILED);
        }
    }

    private play() {
        const volume = this.getFieldValueJS("volume") as number;
        this.stream = BrsDevice.getSfxStream(this.audioId);
        if (this.stream === -1) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,No available sound effect streams for ${this.uri}`);
            }
            this.setState(MediaEvent.TOO_MANY);
        } else {
            rootObjects.sfx[this.stream] = this;
            postMessage(`sfx,trigger,${this.uri},${volume},${this.stream}`);
            this.setState(MediaEvent.START_PLAY);
        }
    }

    private stop() {
        postMessage(`sfx,stop,${this.uri}`);
        if (rootObjects.sfx[this.stream] === this) {
            rootObjects.sfx[this.stream] = undefined;
        }
        this.setState(MediaEvent.PARTIAL);
    }
}
