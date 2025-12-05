import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    RoArray,
    RoMessagePort,
    Scope,
    Stmt,
    IfDraw2D,
    BlockEnd,
} from "brs-engine";
import { toAssociativeArray } from "../factory/serialization";
import { sgRoot } from "../SGRoot";
import { Dialog } from "./Dialog";
import { Group } from "./Group";
import { Node } from "./Node";
import { StandardDialog } from "./StandardDialog";
import { FieldKind, FieldModel } from "../SGTypes";

export class Scene extends Group {
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
    subSearch: string;
    subReplace: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("focusable", BrsBoolean.True);
        this.setDesignResolution("HD", "");
        this.subSearch = "";
        this.subReplace = "";
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        if (fieldName === "dialog") {
            if (value instanceof Dialog || value instanceof StandardDialog) {
                this.dialog?.setValue("close", BrsBoolean.True);
                this.dialog = value;
            } else if (value instanceof BrsInvalid) {
                this.dialog?.setValue("close", BrsBoolean.True);
            } else {
                return;
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
        // Notify other threads of field changes
        if (sync && sgRoot.tasks.length > 0 && this.changed && this.fields.has(fieldName)) {
            this.sendThreadUpdate(sgRoot.taskId, "scene", fieldName, value);
            if (sgRoot.inTaskThread()) this.changed = false;
        }
    }

    protected cloneNode(_isDeepCopy: boolean, _interpreter?: Interpreter): BrsType {
        // Override to prevent cloning Scene nodes
        return BrsInvalid.Instance;
    }

    getDimensions() {
        return { width: this.ui.width, height: this.ui.height };
    }

    addObserver(
        interpreter: Interpreter,
        scope: "permanent" | "scoped" | "unscoped",
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: RoArray
    ) {
        interpreter.environment.hostNode ??= this;
        return super.addObserver(interpreter, scope, fieldName, funcOrPort, infoFields);
    }

    setDesignResolution(resolution: string, autoSub: string) {
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
        if (autoSub.split(",").length === 4) {
            const subs = autoSub.split(",");
            this.subSearch = subs[0];
            if (this.ui.resolution === "SD") {
                this.subReplace = subs[1];
            } else if (this.ui.resolution === "HD") {
                this.subReplace = subs[2];
            } else {
                this.subReplace = subs[3];
            }
        }
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
        const handled = interpreter.inSubEnv((subInterpreter) => {
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
                        interpreter.location
                    );
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[1].name.text,
                        press,
                        interpreter.location
                    );
                    impl(subInterpreter, key, press);
                }
            } catch (err) {
                if (!(err instanceof BlockEnd)) {
                    throw err;
                } else if (err instanceof Stmt.ReturnValue) {
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
}
