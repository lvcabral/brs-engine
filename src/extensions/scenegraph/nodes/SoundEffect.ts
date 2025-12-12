import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, BrsDevice, BrsString, BrsType, MediaEvent, isBrsNumber, isBrsString } from "brs-engine";
import { jsValueOf } from "../factory/serialization";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";

export class SoundEffect extends Node {
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

    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.SoundEffect) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
        this.uri = "";
        this.state = "none";
        this.stream = -1;
        this.audioId = -1;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "stop"];
            const control = value.getValue().toLowerCase();
            if (!validControl.includes(control) || this.audioId < 0) {
                value = new BrsString("none");
                super.setValue(index, value, alwaysNotify, kind);
                return;
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
        } else if (fieldName === "volume" && isBrsNumber(value) && (jsValueOf(value) < 0 || jsValueOf(value) > 100)) {
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
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
            case MediaEvent.StartPlay:
                this.state = "playing";
                break;
            case MediaEvent.Partial:
                this.state = "stopped";
                this.stream = -1;
                break;
            case MediaEvent.Finished:
                this.state = "finished";
                this.stream = -1;
                break;
            case MediaEvent.Failed:
                this.state = "notready";
                break;
            case MediaEvent.TooMany:
                this.state = "toomanysounds";
                break;
        }
        super.setValue("state", new BrsString(this.state));
    }

    private setUri(uri: string) {
        if ((uri.startsWith("pkg:") && BrsDevice.fileSystem.existsSync(uri)) || uri.startsWith("http")) {
            this.uri = uri;
            const sfxIndex = BrsDevice.sfx.indexOf(uri);
            if (sfxIndex > -1) {
                this.audioId = sfxIndex;
            } else {
                this.audioId = BrsDevice.sfx.length;
                if (!sgRoot.inTaskThread()) postMessage(`sfx,new,${uri},${this.audioId}`);
                BrsDevice.sfx.push(uri);
            }
            super.setValue("loadStatus", new BrsString("ready"));
        } else {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,Invalid sound effect URI: ${uri}`);
            }
            this.uri = "";
            this.audioId = -1;
            super.setValue("loadStatus", new BrsString("failed"));
            this.setState(MediaEvent.Failed);
        }
    }

    private play() {
        const volume = this.getValueJS("volume") as number;
        this.stream = BrsDevice.getSfxStream(this.audioId);
        if (this.stream === -1) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,No available sound effect streams for ${this.uri}`);
            }
            this.setState(MediaEvent.TooMany);
        } else {
            sgRoot.sfx[this.stream] = this;
            if (!sgRoot.inTaskThread()) postMessage(`sfx,trigger,${this.uri},${volume},${this.stream}`);
            this.setState(MediaEvent.StartPlay);
        }
    }

    private stop() {
        if (!sgRoot.inTaskThread()) postMessage(`sfx,stop,${this.uri}`);
        if (sgRoot.sfx[this.stream] === this) {
            sgRoot.sfx[this.stream] = undefined;
        }
        this.setState(MediaEvent.Partial);
    }
}
