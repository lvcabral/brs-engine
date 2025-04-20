import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsEvent,
    SGNodeType,
    BrsType,
    createNodeByType,
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
import { KeyEvent } from "../../common";

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
    readonly width: number;
    readonly height: number;
    readonly resolution: string;
    private readonly interpreter: Interpreter;
    private readonly draw2D: IfDraw2D;
    private readonly keysBuffer: KeyEvent[];
    private readonly maxMs: number;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly disposeCanvas: boolean;
    private readonly textureManager: RoTextureManager;
    private readonly fontRegistry: RoFontRegistry;
    private port?: RoMessagePort;
    private sceneType?: BrsString;
    private lastKey: number;
    private alphaEnable: boolean;
    private lastMessage: number;
    scaleMode: number;
    isDirty: boolean;

    constructor(interpreter: Interpreter) {
        super("roSGScreen");
        this.interpreter = interpreter;
        this.draw2D = new IfDraw2D(this);
        this.textureManager = getTextureManager();
        this.fontRegistry = getFontRegistry();
        const sgFont = BrsDevice.deviceInfo.sgFont;
        const fontRegular = this.fontRegistry.registerFont(`common:/Fonts/${sgFont}-Regular.ttf`);
        const fontSemiBold = this.fontRegistry.registerFont(`common:/Fonts/${sgFont}-SemiBold.ttf`);
        Font.SystemFonts.forEach((font) => {
            if (font.family === "Regular") {
                font.family = fontRegular;
            } else if (font.family === "SemiBold") {
                font.family = fontSemiBold;
            }
        });
        this.lastKey = -1;
        this.keysBuffer = [];
        this.alphaEnable = true;
        this.scaleMode = 1;
        this.isDirty = false;
        this.disposeCanvas = BrsDevice.deviceInfo.platform?.inIOS ?? false;
        this.lastMessage = performance.now();
        const maxFps = BrsDevice.deviceInfo.maxFps;
        this.maxMs = Math.trunc((1 / maxFps) * 1000);
        this.width = 1280;
        this.height = 720;
        this.resolution = "HD";
        const res = interpreter.manifest.get("ui_resolutions") ?? "HD";
        if (res.length && res !== "HD") {
            const resArray = res.split(",");
            if (resArray[0].toUpperCase() === "FHD") {
                this.resolution = "FHD";
                this.width = 1920;
                this.height = 1080;
            }
        }
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
        if (this.disposeCanvas) {
            releaseCanvas(this.canvas);
        }
    }

    getDebugData() {
        return {
            textures: this.textureManager.count(),
            fonts: this.fontRegistry.count(),
        };
    }

    /** Message callback to handle control keys and Scene rendering */
    private getNewEvents() {
        const events: BrsEvent[] = [];
        // Handle control keys
        const event = this.handleNextKey();
        if (event instanceof BrsComponent) {
            events.push(event);
        }
        // Handle Scene Events
        if (rootObjects.rootScene) {
            this.processTimers();
            this.processTasks();
            // TODO: Optimize rendering by only rendering if there are changes
            rootObjects.rootScene.renderNode(this.interpreter, [0, 0], 0, 1, this.draw2D);
            if (rootObjects.rootScene?.dialog?.getNodeParent() instanceof BrsInvalid) {
                const dialog = rootObjects.rootScene.dialog;
                const screenRect = { x: 0, y: 0, width: this.width, height: this.height };
                this.draw2D.doDrawRotatedRect(screenRect, 255, 0, [0, 0], 0.5);
                dialog.renderNode(this.interpreter, [0, 0], 0, 1, this.draw2D);
            }
            let timeStamp = performance.now();
            while (timeStamp - this.lastMessage < this.maxMs) {
                timeStamp = performance.now();
            }
            this.finishDraw();
            this.lastMessage = timeStamp;
        }
        return events;
    }

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

    /** Handle control keys */
    private handleNextKey() {
        BrsDevice.updateKeysBuffer(this.keysBuffer);
        const nextKey = this.keysBuffer.shift();
        if (!nextKey || nextKey.key === this.lastKey || !rootObjects?.rootScene) {
            return BrsInvalid.Instance;
        }
        if (this.interpreter.singleKeyEvents) {
            if (nextKey.mod === 0) {
                if (this.lastKey >= 0 && this.lastKey < 100) {
                    this.keysBuffer.unshift({ ...nextKey });
                    nextKey.key = this.lastKey + 100;
                    nextKey.mod = 100;
                }
            } else if (nextKey.key !== this.lastKey + 100) {
                return BrsInvalid.Instance;
            }
        }
        BrsDevice.lastKeyTime = BrsDevice.currKeyTime;
        BrsDevice.currKeyTime = performance.now();
        this.lastKey = nextKey.key;
        this.isDirty = true;
        const key = new BrsString(rokuKeys.get(nextKey.key - nextKey.mod) ?? "");
        const press = BrsBoolean.from(nextKey.mod === 0);
        let handled = false;
        if (rootObjects.rootScene.dialog?.isVisible()) {
            handled = rootObjects.rootScene.dialog.handleKey(key.value, press.toBoolean());
        } else {
            handled = rootObjects.rootScene.handleOnKeyEvent(this.interpreter, key, press);
        }
        if (press.toBoolean()) {
            this.playNavigationSound(key.value, handled);
            if (key.value === "back" && !handled) {
                return new RoSGScreenEvent(BrsBoolean.True);
            }
        }
        return BrsInvalid.Instance;
    }

    private playNavigationSound(key: string, handled: boolean) {
        if (key === "back") {
            postMessage("audio,trigger,navsingle,50,0");
        } else if (["OK", "options"].includes(key) && handled) {
            postMessage("audio,trigger,select,50,0");
        } else if (["rewind", "fastforward"].includes(key) && handled) {
            postMessage("audio,trigger,navmulti,50,0");
        } else if (handled) {
            postMessage("audio,trigger,navsingle,50,0");
        } else {
            postMessage("audio,trigger,deadend,50,0");
        }
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
                const typeDef = interpreter.environment.nodeDefMap.get(
                    this.sceneType.value.toLowerCase()
                );
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
            let returnValue: BrsType = BrsInvalid.Instance;
            if (sceneType.value === SGNodeType.Scene) {
                returnValue = new Scene([], SGNodeType.Scene);
            } else if (interpreter.environment.nodeDefMap.has(sceneType.value.toLowerCase())) {
                returnValue = createNodeByType(interpreter, sceneType);
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
                rootObjects.rootScene = returnValue;
                rootObjects.rootScene.setDesignResolution(this.resolution);
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

    /** The roSGScene object associated with the screen. */
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
