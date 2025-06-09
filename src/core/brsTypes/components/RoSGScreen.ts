import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsEvent,
    SGNodeType,
    BrsType,
    createSceneByType,
    RoFontRegistry,
    RoMessagePort,
    Scene,
    initializeNode,
    RoTextureManager,
    Font,
    getFontRegistry,
    getTextureManager,
    rootObjects,
} from "..";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { RoSGScreenEvent } from "../events/RoSGScreenEvent";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    createNewCanvas,
    drawObjectToComponent,
    IfDraw2D,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { BrsDevice } from "../../device/BrsDevice";
import { MediaTrack, BufferType, DataType, MediaEvent } from "../../common";

// Roku Remote Mapping
const rokuKeys: Map<number, string> = new Map([
    [0, "back"],
    [2, "up"],
    [3, "down"],
    [4, "left"],
    [5, "right"],
    [6, "OK"],
    [7, "replay"],
    [8, "rewind"],
    [9, "fastforward"],
    [10, "options"],
    [13, "play"],
]);

export class RoSGScreen extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    private readonly draw2D: IfDraw2D;
    private readonly maxMs: number;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly textureManager: RoTextureManager;
    private readonly fontRegistry: RoFontRegistry;
    private port?: RoMessagePort;
    private sceneType?: BrsString;
    private alphaEnable: boolean;
    private lastMessage: number;
    width: number;
    height: number;
    resolution: string;
    scaleMode: number;
    audioFlags: number;
    audioIndex: number;
    audioDuration: number;
    audioPosition: number;
    videoEvent: number;
    videoIndex: number;
    videoProgress: number;
    videoDuration: number;
    videoPosition: number;
    isDirty: boolean;

    constructor() {
        super("roSGScreen");
        this.draw2D = new IfDraw2D(this);
        this.textureManager = getTextureManager();
        this.fontRegistry = getFontRegistry();
        const systemFont = "Metropolis";
        const fontRegular = this.fontRegistry.registerFont(`common:/Fonts/${systemFont}-Regular.ttf`, true);
        const fontBold = this.fontRegistry.registerFont(`common:/Fonts/${systemFont}-SemiBold.ttf`, true);
        Font.SystemFonts.forEach((font) => {
            font.family = font.bold ? fontBold : fontRegular;
        });
        this.alphaEnable = true;
        this.scaleMode = 1;
        this.audioFlags = -1;
        this.audioIndex = -1;
        this.audioDuration = -1;
        this.audioPosition = -1;
        this.videoEvent = -1;
        this.videoIndex = -1;
        this.videoProgress = -1;
        this.videoDuration = -1;
        this.videoPosition = -1;
        this.isDirty = false;
        this.lastMessage = performance.now();
        const maxFps = BrsDevice.deviceInfo.maxFps;
        this.maxMs = Math.trunc((1 / maxFps) * 1000);
        this.width = 1280;
        this.height = 720;
        this.resolution = "HD";
        this.canvas = createNewCanvas(this.width, this.height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;

        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSGScreen: [
                this.getGlobalNode,
                this.show,
                this.close,
                this.createScene,
                this.getScene,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
        });
    }

    clearCanvas(rgba: number): void {
        if (isNaN(rgba)) {
            rgba = 0xff;
        }
        const ctx = this.context;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if ((rgba & 255) > 0) {
            ctx.fillStyle = rgbaIntToHex(rgba);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.isDirty = true;
    }
    getContext(): BrsCanvasContext2D {
        return this.context;
    }
    getCanvas(): BrsCanvas {
        return this.canvas;
    }
    getRgbaCanvas(rgba: number): BrsCanvas {
        return this.canvas;
    }
    setCanvasAlpha(alphaEnable: boolean): void {
        this.alphaEnable = alphaEnable;
        this.isDirty = true;
    }
    getCanvasAlpha(): boolean {
        return this.alphaEnable;
    }
    drawImage(
        object: BrsComponent,
        x: number,
        y: number,
        scaleX: number = 1,
        scaleY: number = 1,
        rgba?: number
    ): boolean {
        this.isDirty = true;
        return drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba);
    }
    makeDirty(): void {
        this.isDirty = true;
    }
    finishDraw(): void {
        if (this.isDirty) {
            postMessage(this.context.getImageData(0, 0, this.width, this.height));
            this.isDirty = false;
        }
        return;
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    toString() {
        return "<Component: roSGScreen>";
    }

    dispose() {
        releaseCanvas(this.canvas);
    }

    getDebugData() {
        return {
            textures: this.textureManager.count(),
            fonts: this.fontRegistry.count(),
        };
    }

    /** Message callback to handle control keys and Scene rendering */
    private getNewEvents(interpreter: Interpreter) {
        const events: BrsEvent[] = [];
        // Handle control keys
        const event = this.handleNextKey(interpreter);
        if (event instanceof BrsComponent) {
            events.push(event);
        }
        // Handle Scene Events
        if (rootObjects.rootScene) {
            this.processTimers();
            this.processTasks();
            this.processAudio();
            this.processSFX();
            this.processVideo();
            // TODO: Optimize rendering by only rendering if there are changes
            rootObjects.rootScene.renderNode(interpreter, [0, 0], 0, 1, this.draw2D);
            if (rootObjects.rootScene?.dialog?.getNodeParent() instanceof BrsInvalid) {
                const dialog = rootObjects.rootScene.dialog;
                dialog.setFieldValue("visible", BrsBoolean.True);
                const screenRect = { x: 0, y: 0, width: this.width, height: this.height };
                this.draw2D.doDrawRotatedRect(screenRect, 255, 0, [0, 0], 0.5);
                dialog.renderNode(interpreter, [0, 0], 0, 1, this.draw2D);
            }
            let timeStamp = Date.now();
            while (timeStamp - this.lastMessage < this.maxMs) {
                timeStamp = Date.now();
            }
            this.finishDraw();
            this.lastMessage = timeStamp;
        }
        return events;
    }

    /** Update all Application Tasks */
    private processTasks() {
        let updates = false;
        rootObjects.tasks.forEach((task) => {
            updates = task.updateTask();
            if (task.active) {
                task.checkTask();
            }
        });
        this.isDirty = updates;
    }

    private processTimers() {
        let fired = false;
        rootObjects.timers.forEach((timer) => {
            if (timer.active && timer.checkFire()) {
                fired = true;
            }
        });
        this.isDirty = fired;
    }

    private processAudio() {
        if (!rootObjects.audio) {
            return;
        }
        const flags = Atomics.load(BrsDevice.sharedArray, DataType.SND);
        if (flags !== this.audioFlags) {
            this.audioFlags = flags;
            rootObjects.audio.setState(flags);
            this.isDirty = true;
        }
        const index = Atomics.load(BrsDevice.sharedArray, DataType.SDX);
        if (index !== this.audioIndex) {
            this.audioIndex = index;
            rootObjects.audio.setContentIndex(index);
            this.isDirty = true;
        }
        const duration = Atomics.load(BrsDevice.sharedArray, DataType.SDR);
        if (duration !== this.audioDuration) {
            this.audioDuration = duration;
            rootObjects.audio.setDuration(duration);
            this.isDirty = true;
        }
        const position = Atomics.load(BrsDevice.sharedArray, DataType.SPS);
        if (position !== this.audioPosition) {
            this.audioPosition = position;
            rootObjects.audio.setPosition(position);
            this.isDirty = true;
        }
    }

    private processSFX() {
        for (let i = 0; i < rootObjects.sfx.length; i++) {
            const sfx = rootObjects.sfx[i];
            if (!sfx) {
                continue;
            }
            const sfxId = Atomics.load(BrsDevice.sharedArray, DataType.WAV + i);
            if (sfxId >= 0 && sfxId === sfx.getAudioId() && sfx.getState() !== "playing") {
                sfx.setState(MediaEvent.START_PLAY);
                this.isDirty = true;
            } else if (sfx.getState() !== "stopped") {
                sfx.setState(MediaEvent.FINISHED);
                rootObjects.sfx[i] = undefined;
                this.isDirty = true;
            }
        }
    }

    private processVideo() {
        if (!rootObjects.video) {
            return;
        }
        const progress = Atomics.load(BrsDevice.sharedArray, DataType.VLP);
        if (this.videoProgress !== progress && progress >= 0 && progress <= 1000) {
            rootObjects.video.setState(MediaEvent.LOADING, Math.trunc(progress / 10));
            console.debug(`Video Progress: ${progress}`);
        }
        this.videoProgress = progress;
        const eventType = Atomics.load(BrsDevice.sharedArray, DataType.VDO);
        const eventIndex = Atomics.load(BrsDevice.sharedArray, DataType.VDX);
        if (eventType !== this.videoEvent) {
            this.videoEvent = eventType;
            if (eventType >= 0) {
                rootObjects.video.setState(eventType, eventIndex);
                console.debug(
                    `Video State: ${rootObjects.video.getFieldValueJS("state")}  (${eventType}/${eventIndex})`
                );
                Atomics.store(BrsDevice.sharedArray, DataType.VDO, -1);
                this.isDirty = true;
            }
        }
        const selected = Atomics.load(BrsDevice.sharedArray, DataType.VSE);
        if (selected !== this.videoIndex) {
            this.videoIndex = selected;
            if (selected >= 0) {
                rootObjects.video.setContentIndex(selected);
                Atomics.store(BrsDevice.sharedArray, DataType.VSE, -1);
                this.isDirty = true;
            }
        }
        const duration = Atomics.load(BrsDevice.sharedArray, DataType.VDR);
        if (duration !== this.videoDuration) {
            this.videoDuration = duration;
            rootObjects.video.setDuration(duration);
            this.isDirty = true;
        }
        const position = Atomics.load(BrsDevice.sharedArray, DataType.VPS);
        if (position !== this.videoPosition) {
            this.videoPosition = position;
            rootObjects.video.setPosition(position);
            this.isDirty = true;
        }

        const bufferFlag = Atomics.load(BrsDevice.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.MEDIA_TRACKS) {
            const strTracks = BrsDevice.readDataBuffer();
            let audioTracks: MediaTrack[] = [];
            let textTracks: MediaTrack[] = [];
            try {
                const tracks = JSON.parse(strTracks);
                audioTracks = tracks.audio ?? [];
                textTracks = tracks.text ?? [];
            } catch (e) {
                audioTracks = [];
                textTracks = [];
            }
            rootObjects.video.setAudioTracks(audioTracks);
            rootObjects.video.setSubtitleTracks(textTracks);
            this.isDirty = true;
        }

        const audioTrack = Atomics.load(BrsDevice.sharedArray, DataType.VAT);
        if (audioTrack > -1) {
            rootObjects.video.setCurrentAudioTrack(audioTrack);
            Atomics.store(BrsDevice.sharedArray, DataType.VAT, -1);
            this.isDirty = true;
        }

        const subtitleTrack = Atomics.load(BrsDevice.sharedArray, DataType.VTT);
        if (subtitleTrack > -1) {
            rootObjects.video.setCurrentSubtitleTrack(subtitleTrack);
            Atomics.store(BrsDevice.sharedArray, DataType.VTT, -1);
            this.isDirty = true;
        }
    }

    /** Handle control keys */
    private handleNextKey(interpreter: Interpreter) {
        const nextKey = BrsDevice.updateKeysBuffer();
        if (!nextKey || !rootObjects?.rootScene) {
            return BrsInvalid.Instance;
        }
        this.isDirty = true;
        const keyCode = nextKey.key - nextKey.mod;
        let key: BrsString;
        if (keyCode < 32) {
            key = new BrsString(rokuKeys.get(keyCode) ?? "");
        } else {
            key = new BrsString(`Lit_${String.fromCharCode(keyCode)}`);
        }
        const press = BrsBoolean.from(nextKey.mod === 0);
        let handled = false;
        if (rootObjects.rootScene.dialog?.isVisible()) {
            handled = rootObjects.rootScene.dialog.handleKey(key.value, press.toBoolean());
        } else {
            handled = rootObjects.rootScene.handleOnKeyEvent(interpreter, key, press);
        }
        if (press.toBoolean()) {
            this.playNavigationSound(key.value, handled);
            if (key.value === "back" && !handled) {
                return new RoSGScreenEvent(BrsBoolean.True);
            }
        }
        return BrsInvalid.Instance;
    }

    /** Play the navigation sound effect based on key type and handled flag */
    private playNavigationSound(key: string, handled: boolean) {
        let sound = "deadend";
        if (key === "back") {
            sound = "navsingle";
        } else if (["OK", "options"].includes(key) && handled) {
            sound = "select";
        } else if (["rewind", "fastforward"].includes(key) && handled) {
            sound = "navmulti";
        } else if (handled) {
            sound = "navsingle";
        }
        BrsDevice.playSound(sound);
    }

    /** Returns a global reference object for the SceneGraph application. */
    private getGlobalNode = new Callable("getGlobalNode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return rootObjects.mGlobal;
        },
    });

    /** Renders the SceneGraph scene defined by the roSGScreen object on the display screen. */
    private show = new Callable("show", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            if (this.sceneType && rootObjects.rootScene) {
                const typeDef = rootObjects.nodeDefMap.get(this.sceneType.value.toLowerCase());
                initializeNode(interpreter, this.sceneType, typeDef, rootObjects.rootScene);
            }
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Removes the SceneGraph scene from the display screen. */
    private close = new Callable("close", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.port?.pushMessage(new RoSGScreenEvent(BrsBoolean.True));
            return Uninitialized.Instance;
        },
    });

    /** Creates the SceneGraph scene object based on the specified sceneType object. */
    private createScene = new Callable("createScene", {
        signature: {
            args: [new StdlibArgument("sceneType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, sceneType: BrsString) => {
            const manifest = interpreter.manifest;
            const res = manifest.get("ui_resolutions") ?? "HD";
            if (res.length && res !== "HD") {
                const resArray = res.split(",");
                if (resArray[0].toUpperCase() === "FHD") {
                    this.resolution = "FHD";
                    this.width = 1920;
                    this.height = 1080;
                    this.canvas.width = this.width;
                    this.canvas.height = this.height;
                } else if (resArray[0].toUpperCase() === "SD") {
                    this.resolution = "SD";
                    this.width = 720;
                    this.height = 480;
                    this.canvas.width = this.width;
                    this.canvas.height = this.height;
                }
            }
            let returnValue: BrsType = BrsInvalid.Instance;
            if (sceneType.value === SGNodeType.Scene) {
                returnValue = new Scene([], SGNodeType.Scene);
            } else if (rootObjects.nodeDefMap.has(sceneType.value.toLowerCase())) {
                returnValue = createSceneByType(interpreter, sceneType);
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGScreen.CreateScene: No such node ${
                        sceneType.value
                    }: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            if (returnValue instanceof Scene) {
                this.sceneType = sceneType;
                const autoSub = manifest.get("uri_resolution_autosub") ?? "";
                rootObjects.rootScene = returnValue;
                rootObjects.rootScene.setDesignResolution(this.resolution, autoSub);
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGScreen.CreateScene: Type mismatch converting from '${
                        sceneType.value
                    }' to 'Scene': ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            return returnValue;
        },
    });

    /** Returns the roSGScene object associated with the screen. */
    private getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return rootObjects.rootScene ?? BrsInvalid.Instance;
        },
    });
}
