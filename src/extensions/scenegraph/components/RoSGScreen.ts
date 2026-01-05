import {
    BrsComponent,
    ValueKind,
    BrsString,
    BrsValue,
    BrsBoolean,
    Uninitialized,
    BrsInvalid,
    Callable,
    StdlibArgument,
    Interpreter,
    BrsDevice,
    BrsType,
    RoMessagePort,
    RoFontRegistry,
    RoTextureManager,
    getFontRegistry,
    getTextureManager,
    BrsEvent,
    IfGetMessagePort,
    IfSetMessagePort,
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    createNewCanvas,
    drawObjectToComponent,
    IfDraw2D,
    releaseCanvas,
    rgbaIntToHex,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { Scene, SGNodeType } from "../nodes";
import { createSceneByType, initializeNode } from "../factory/NodeFactory";
import { RoSGScreenEvent } from "../events/RoSGScreenEvent";

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
    isDirty: boolean;

    constructor() {
        super("roSGScreen");
        this.draw2D = new IfDraw2D(this);
        this.textureManager = getTextureManager();
        this.fontRegistry = getFontRegistry();
        this.alphaEnable = true;
        this.scaleMode = 1;
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
        if (Number.isNaN(rgba)) {
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
        if (event instanceof BrsEvent) {
            events.push(event);
        }
        // Handle Scene Events
        if (sgRoot.scene) {
            const timersFired = sgRoot.processTimers();
            const animUpdated = sgRoot.processAnimations();
            const tasksUpdated = sgRoot.processTasks();
            const audioUpdated = sgRoot.processAudio();
            const sfxUpdated = sgRoot.processSFX();
            const videoUpdated = sgRoot.processVideo();
            this.isDirty ||= timersFired || animUpdated || tasksUpdated || audioUpdated || sfxUpdated || videoUpdated;
            // TODO: Optimize rendering by only rendering if there are changes
            sgRoot.scene.renderNode(interpreter, [0, 0], 0, 1, this.draw2D);
            if (sgRoot.scene?.dialog?.getNodeParent() instanceof BrsInvalid) {
                const dialog = sgRoot.scene.dialog;
                dialog.setValueSilent("visible", BrsBoolean.True);
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

    /** Handle control keys */
    private handleNextKey(interpreter: Interpreter) {
        const nextKey = BrsDevice.updateKeysBuffer();
        if (!nextKey || !sgRoot?.scene) {
            return BrsInvalid.Instance;
        }
        this.isDirty = true;
        const keyCode = nextKey.key - nextKey.mod;
        let key: BrsString;
        if (keyCode < 32) {
            key = new BrsString(rokuKeys.get(keyCode) ?? "");
        } else {
            key = new BrsString(`Lit_${String.fromCodePoint(keyCode)}`);
        }
        const press = BrsBoolean.from(nextKey.mod === 0);
        let handled = false;
        if (sgRoot.scene.dialog?.isVisible()) {
            handled = sgRoot.scene.dialog.handleKey(key.value, press.toBoolean());
        } else {
            handled = sgRoot.scene.handleOnKeyEvent(interpreter, key, press);
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
    private readonly getGlobalNode = new Callable("getGlobalNode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return sgRoot.mGlobal;
        },
    });

    /** Renders the SceneGraph scene defined by the roSGScreen object on the display screen. */
    private readonly show = new Callable("show", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            if (this.sceneType && sgRoot.scene) {
                const typeDef = sgRoot.nodeDefMap.get(this.sceneType.value.toLowerCase());
                initializeNode(interpreter, this.sceneType.value, typeDef, sgRoot.scene);
            }
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Removes the SceneGraph scene from the display screen. */
    private readonly close = new Callable("close", {
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
    private readonly createScene = new Callable("createScene", {
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
            let returnValue: BrsType;
            if (sceneType.value === SGNodeType.Scene) {
                returnValue = new Scene([], SGNodeType.Scene);
            } else if (sgRoot.nodeDefMap.has(sceneType.value.toLowerCase())) {
                returnValue = createSceneByType(interpreter, sceneType.value);
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
                sgRoot.setScene(returnValue);
                sgRoot.scene?.setDesignResolution(this.resolution, autoSub);
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
    private readonly getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return sgRoot.scene ?? BrsInvalid.Instance;
        },
    });
}
