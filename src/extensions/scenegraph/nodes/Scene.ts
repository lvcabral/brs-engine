import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Scope,
    Stmt,
    IfDraw2D,
    RuntimeError,
    DebugMode,
    isBrsString,
} from "brs-engine";
import { toAssociativeArray } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { Dialog } from "./Dialog";
import { Group } from "./Group";
import { Node } from "./Node";
import { StandardDialog } from "./StandardDialog";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export class Scene extends Group {
    private _initState: "none" | "initializing" | "initialized" = "none";
    private readonly _preInitSet: Map<string, BrsType> = new Map();
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: FieldKind.Color, value: "0x2F3140FF" },
        { name: "backExitsScene", type: FieldKind.Boolean, value: "true" },
        { name: "dialog", type: FieldKind.Node },
        { name: "currentDesignResolution", type: FieldKind.AssocArray },
        { name: "palette", type: FieldKind.Node },
    ];
    readonly ui = { width: 1280, height: 720, resolution: "HD" };
    dialog?: Dialog | StandardDialog;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Scene) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.owner = 0; // Scene node is always owned by render thread

        this.setResolution("HD");
    }

    setInitState(state: "initializing" | "initialized") {
        if (this._initState === "initialized") {
            // prevent re-initialization
            return;
        }
        this._initState = state;
        if (state === "initialized") {
            for (const [index, value] of this._preInitSet) {
                this.setValue(index, value);
            }
            this.setValueSilent("focusable", BrsBoolean.True);
            this._preInitSet.clear();
        }
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        if (this._initState === "none" && !sgRoot.inTaskThread()) {
            this._preInitSet.set(index, value);
            return;
        }
        const fieldName = index.toLowerCase();
        if (fieldName === "dialog") {
            if (value instanceof Dialog || value instanceof StandardDialog) {
                this.dialog?.setValue("close", BrsBoolean.True);
                if (value instanceof StandardDialog) {
                    value.setDefaultTranslation();
                    value.setNodeParent(this);
                }
                this.dialog = value;
            } else if (value instanceof BrsInvalid) {
                this.dialog?.removeParent();
                this.dialog?.setValue("close", BrsBoolean.True);
            } else {
                return;
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected cloneNode(_isDeepCopy: boolean, _interpreter?: Interpreter): BrsType {
        // Override to prevent cloning Scene nodes
        return BrsInvalid.Instance;
    }

    getDimensions() {
        return { width: this.ui.width, height: this.ui.height };
    }

    setResolution(resolution: string) {
        if (!["SD", "HD", "FHD"].includes(resolution.toUpperCase())) {
            // invalid resolution
            return;
        }
        this.ui.resolution = resolution.toUpperCase();
        if (this.ui.resolution === "FHD") {
            this.ui.width = 1920;
            this.ui.height = 1080;
        } else if (this.ui.resolution === "HD") {
            this.ui.width = 1280;
            this.ui.height = 720;
        } else if (this.ui.resolution === "SD") {
            this.ui.width = 720;
            this.ui.height = 480;
        }
        this.rectLocal = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.rectToParent = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.rectToScene = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.setValueSilent("currentDesignResolution", toAssociativeArray(this.ui));
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const rotation = angle + this.getRotation();
        const backColor = this.getValueJS("backgroundColor") as number;
        opacity = opacity * this.getOpacity();
        if (draw2D) {
            draw2D.doClearCanvas(backColor);
            const bitmap = this.getBitmap("backgroundUri");
            if (bitmap?.isValid()) {
                const scaleX = this.ui.width / bitmap.width;
                const scaleY = this.ui.height / bitmap.height;
                draw2D.doDrawScaledObject(0, 0, scaleX, scaleY, bitmap, undefined, opacity);
            }
        }
        this.renderChildren(interpreter, origin, rotation, opacity, draw2D);
    }

    /** Handle SceneGraph onKeyEvent event */
    handleOnKeyEvent(interpreter: Interpreter, key: BrsString, press: BrsBoolean) {
        if (sgRoot.focused instanceof Node) {
            const path = this.createPath(sgRoot.focused, false);
            for (let node of path) {
                if (this.handleKeyByNode(interpreter, node, key, press)) {
                    return true;
                }
            }
        } else {
            return this.handleKeyByNode(interpreter, this, key, press);
        }
        return false;
    }

    private handleKeyByNode(interpreter: Interpreter, hostNode: Node, key: BrsString, press: BrsBoolean): boolean {
        const typeDef = sgRoot.nodeDefMap.get(hostNode.nodeSubtype.toLowerCase());
        if (typeDef?.environment === undefined) {
            if (hostNode instanceof Group) {
                return hostNode.handleKey(key.value, press.toBoolean());
            }
            return false;
        }
        const nodeEnv = typeDef.environment;
        const originalLocation = interpreter.location;
        const handled = interpreter.inSubEnv((subInterpreter) => {
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setRootM(hostNode.m);
            subInterpreter.environment.setM(hostNode.m);
            const onKeyEvent = subInterpreter.getCallableFunction("onKeyEvent");
            if (!(onKeyEvent instanceof Callable) || key.value === "") {
                return BrsBoolean.False;
            }
            try {
                const satisfiedSignature = onKeyEvent?.getFirstSatisfiedSignature([key, press]);
                if (satisfiedSignature) {
                    let { signature, impl } = satisfiedSignature;
                    const funcLoc = onKeyEvent.getLocation() ?? originalLocation;
                    interpreter.addToStack({
                        functionName: onKeyEvent.getName(),
                        functionLocation: funcLoc,
                        callLocation: originalLocation,
                        signature: satisfiedSignature.signature,
                    });
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[0].name.text,
                        key,
                        originalLocation
                    );
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[1].name.text,
                        press,
                        originalLocation
                    );
                    impl(subInterpreter, key, press);
                    interpreter.popFromStack();
                    interpreter.location = originalLocation;
                }
            } catch (err) {
                if (err instanceof RuntimeError) {
                    interpreter.checkCrashDebug(err);
                }
                if (interpreter.debugMode === DebugMode.EXIT) {
                    throw err;
                }
                interpreter.popFromStack();
                interpreter.location = originalLocation;
                if (err instanceof Stmt.ReturnValue) {
                    return err.value ?? BrsBoolean.False;
                }
                throw err;
            }
            return BrsBoolean.False;
        }, nodeEnv);
        const keyHandled = handled instanceof BrsBoolean && handled.toBoolean();
        if (!keyHandled && hostNode instanceof Group) {
            return hostNode.handleKey(key.value, press.toBoolean());
        }
        return keyHandled;
    }

    public setOwner(_threadId: number): void {
        // Scene node owner cannot be changed
        return;
    }
}
