import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsEvent,
    BrsNodeType,
    BrsType,
    createNodeByType,
    KeyEvent,
    mGlobal,
    RoFontRegistry,
    RoMessagePort,
    Scene,
} from "..";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { RoSGScreenEvent } from "../events/RoSGScreenEvent";
import { BlockEnd } from "../../parser/Statement";
import { Scope } from "../..";
import { Stmt } from "../../parser";
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
import { download } from "../../interpreter/Network";

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

export class roSGScreen extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    readonly width: number;
    readonly height: number;
    private readonly interpreter: Interpreter;
    private readonly draw2D: IfDraw2D;
    private readonly keysBuffer: KeyEvent[];
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly disposeCanvas: boolean;
    private readonly fontRegistry: RoFontRegistry;
    private port?: RoMessagePort;
    private sceneNode?: Scene;
    private lastKey: number;
    private alphaEnable: boolean;
    isDirty: boolean;

    constructor(interpreter: Interpreter) {
        super("roSGScreen");
        this.interpreter = interpreter;
        this.draw2D = new IfDraw2D(this);
        this.fontRegistry = new RoFontRegistry(interpreter);
        this.lastKey = -1;
        this.keysBuffer = [];
        this.alphaEnable = true;
        this.isDirty = false;
        const platform = interpreter.deviceInfo.get("platform");
        this.disposeCanvas = platform?.inIOS ?? false;
        this.width = 1280;
        this.height = 720;
        const displayMode = interpreter.deviceInfo.get("displayMode") ?? "720p";
        if (displayMode === "1080p") {
            this.width = 1920;
            this.height = 1080;
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

    /** Message callback to handle control keys and Scene rendering */
    private getNewEvents() {
        const events: BrsEvent[] = [];
        // Handle control keys
        this.interpreter.updateKeysBuffer(this.keysBuffer);
        const nextKey = this.keysBuffer.shift();
        if (nextKey && nextKey.key !== this.lastKey) {
            if (this.interpreter.singleKeyEvents) {
                if (nextKey.mod === 0) {
                    if (this.lastKey >= 0 && this.lastKey < 100) {
                        this.keysBuffer.unshift({ ...nextKey });
                        nextKey.key = this.lastKey + 100;
                        nextKey.mod = 100;
                    }
                } else if (nextKey.key !== this.lastKey + 100) {
                    return events;
                }
            }
            this.interpreter.lastKeyTime = this.interpreter.currKeyTime;
            this.interpreter.currKeyTime = performance.now();
            this.lastKey = nextKey.key;

            const key = new BrsString(rokuKeys.get(nextKey.key - nextKey.mod) ?? "");
            const press = BrsBoolean.from(nextKey.mod === 0);
            const handled = this.handleOnKeyEvent(key, press);

            if (key.value === "back" && !handled) {
                events.push(new RoSGScreenEvent(BrsBoolean.True));
            }
            // TODO: Make the scene dirty only if changes were made in Nodes
            this.isDirty = true;
        }
        // Handle Scene rendering
        if (this.isDirty && this.sceneNode) {
            this.sceneNode.renderNode(this.interpreter, this.draw2D, this.fontRegistry, [0, 0], 0);
            this.finishDraw();
        }
        return events;
    }

    handleOnKeyEvent(key: BrsString, press: BrsBoolean): boolean {
        const hostNode = this.sceneNode;
        if (!hostNode) {
            return false;
        }
        const handled = this.interpreter.inSubEnv((subInterpreter) => {
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setRootM(hostNode.m);
            subInterpreter.environment.setM(hostNode.m);
            let onKeyEvent = subInterpreter.getCallableFunction("onKeyEvent");
            if (!(onKeyEvent instanceof Callable) || key.value === "") {
                return BrsBoolean.False;
            }
            try {
                const satisfiedSignature = onKeyEvent?.getFirstSatisfiedSignature([key, press]);
                if (satisfiedSignature) {
                    let { signature, impl } = satisfiedSignature;
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[0].name.text,
                        key,
                        this.interpreter.location
                    );
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[1].name.text,
                        press,
                        this.interpreter.location
                    );
                    impl(subInterpreter, key, press);
                }
            } catch (err) {
                if (!(err instanceof BlockEnd)) {
                    throw err;
                } else if (err instanceof Stmt.ReturnValue) {
                    return err.value ?? BrsBoolean.False;
                }
            }
            return BrsBoolean.False;
        }, this.interpreter.environment);
        return handled instanceof BrsBoolean && handled.toBoolean();
    }

    /** Returns a global reference object for the SceneGraph application. */
    private getGlobalNode = new Callable("getGlobalNode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return mGlobal ?? BrsInvalid.Instance;
        },
    });

    /** Renders the SceneGraph scene defined by the roSGScreen object on the display screen. */
    private show = new Callable("show", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // TODO: Implement show: Only start Scene rendering if the SceneGraph scene is valid.
            this.isDirty = true;
            return BrsBoolean.False;
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
            if (sceneType.value === BrsNodeType.Scene) {
                returnValue = new Scene([], BrsNodeType.Scene);
            } else {
                const typeDef = interpreter.environment.nodeDefMap.get(
                    sceneType.value.toLowerCase()
                );
                if (typeDef && typeDef.extends === BrsNodeType.Scene) {
                    returnValue = createNodeByType(interpreter, sceneType);
                }
            }
            if (returnValue instanceof Scene) {
                this.sceneNode = returnValue;
                this.sceneNode.width = this.width;
                this.sceneNode.height = this.height;
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
            return this.sceneNode ?? BrsInvalid.Instance;
        },
    });
}
