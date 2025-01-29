import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsEvent,
    BrsNodeType,
    BrsType,
    createNodeByType,
    Float,
    Font,
    Int32,
    KeyEvent,
    Label,
    mGlobal,
    NodeFactory,
    RoArray,
    RoFont,
    RoFontRegistry,
    RoMessagePort,
    RoSGNode,
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
    private sceneNode?: RoSGNode;
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
        this.alphaEnable = false;
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
            rgba = 0xFF;
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
        rgba: Int32 | BrsInvalid,
        x: number,
        y: number,
        scaleX?: number,
        scaleY?: number
    ): boolean {
        this.isDirty = true;
        return drawObjectToComponent(this, object, rgba, x, y, scaleX, scaleY);
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

    /** Message callback to handle control keys */
    private getNewEvents() {
        const events: BrsEvent[] = [];
        this.interpreter.updateKeysBuffer(this.keysBuffer);
        const nextKey = this.keysBuffer.shift();
        if (nextKey && nextKey.key !== this.lastKey && this.sceneNode) {
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
            const hostNode = this.sceneNode;

            let handled = this.interpreter.inSubEnv((subInterpreter) => {
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
            if (key.value === "back" && handled instanceof BrsBoolean && !handled.toBoolean()) {
                events.push(new RoSGScreenEvent(BrsBoolean.True));
            }
        }
        if (this.isDirty && this.sceneNode) {
            const backColor = Number(this.sceneNode.getNodeFields().get("backgroundcolor")?.getValue().toString());
            if (! isNaN(backColor)) {
                console.log("Clearing canvas with color: ", backColor);
                this.clearCanvas(backColor);
            }
            this.sceneNode.getNodeChildren().forEach((node) => {
                if (node instanceof Label) {
                    const text = node.getNodeFields().get("text")?.getValue();
                    if (text === undefined || text.toString().trim() === "") {
                        return;
                    }
                    const translation = node.getNodeFields().get("translation")?.getValue();
                    const pos = [0, 0];
                    if (translation instanceof RoArray && translation.elements.length === 2) {
                        translation.elements.map((element, index) => {
                            if (element instanceof Int32 || element instanceof Float) {
                                pos[index] = element.getValue();
                            }
                        });
                    }
                    const color = Number(node.getNodeFields().get("color")?.getValue()?.toString());
                    const font = node.getNodeFields().get("font")?.getValue();
                    let fontSize = 24;
                    if (font instanceof Font) {
                        const value = font.getNodeFields().get("size")?.getValue();
                        if (value instanceof Int32 || value instanceof Float) {
                            fontSize = value.getValue();
                        }
                    }
                    const defaultFontFamily = this.interpreter.deviceInfo.get("defaultFont");
                    const drawFont = this.fontRegistry.createFont(
                        new BrsString(defaultFontFamily),
                        new Int32(fontSize),
                        BrsBoolean.False,
                        BrsBoolean.False
                    );

                    const horizAlign =
                        node.getNodeFields().get("horizalign")?.getValue()?.toString() ?? "left";
                    const vertAlign =
                        node.getNodeFields().get("vertalign")?.getValue()?.toString() ?? "top";
                    const width = node.getNodeFields().get("width")?.getValue();
                    const height = node.getNodeFields().get("height")?.getValue();
                    if (
                        drawFont instanceof RoFont &&
                        (width instanceof Int32 || width instanceof Float) &&
                        (height instanceof Int32 || height instanceof Float)
                    ) {
                        // Calculate the text position based on the alignment
                        const textWidth = drawFont.measureTextWidth(text as BrsString, width);
                        const textHeight = drawFont.measureTextHeight();
                        if (horizAlign === "center") {
                            pos[0] += (width.getValue() - textWidth.getValue()) / 2;
                        } else if (horizAlign === "right") {
                            pos[0] += width.getValue() - textWidth.getValue();
                        }
                        if (vertAlign === "center") {
                            pos[1] += (height.getValue() - textHeight.getValue()) / 2;
                        } else if (vertAlign === "bottom") {
                            pos[1] += (height.getValue() - textHeight.getValue());
                        }
                        // Draw the text
                        this.draw2D.doDrawText(text.toString(), pos[0], pos[1], color, drawFont);
                    }
                }
            });
            this.finishDraw();
        }
        return events;
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
            if (sceneType.value === "Scene") {
                returnValue = NodeFactory.createNode(BrsNodeType.Scene) ?? BrsInvalid.Instance;
            } else {
                const typeDef = interpreter.environment.nodeDefMap.get(
                    sceneType.value.toLowerCase()
                );
                if (typeDef && typeDef.extends === "Scene") {
                    returnValue = createNodeByType(interpreter, sceneType);
                }
            }
            if (returnValue instanceof RoSGNode) {
                this.sceneNode = returnValue;
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
