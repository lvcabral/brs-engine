import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Dialog,
    getTextureManager,
    Int32,
    isBrsString,
    RoArray,
    RoBitmap,
    RoMessagePort,
    rootObjects,
    RoSGNode,
    StandardDialog,
    toAssociativeArray,
} from "..";
import { Scope } from "../..";
import { BlockEnd } from "../../parser/Statement";
import { Stmt } from "../../parser";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: FieldKind.Color, value: "0x2F3140FF" },
        { name: "backExitsScene", type: FieldKind.Boolean, value: "true" },
        { name: "dialog", type: FieldKind.Node },
        { name: "currentDesignResolution", type: FieldKind.AssocArray },
        { name: "palette", type: FieldKind.Node },
        { name: "focusable", type: FieldKind.Boolean, value: "true" },
    ];
    readonly ui = { width: 1280, height: 720, resolution: "HD" };
    dialog?: Dialog | StandardDialog;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setDesignResolution("HD");
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "dialog") {
            if (value instanceof Dialog || value instanceof StandardDialog) {
                this.dialog?.set(new BrsString("close"), BrsBoolean.True);
                this.dialog = value;
            } else if (value instanceof BrsInvalid) {
                this.dialog?.set(new BrsString("close"), BrsBoolean.True);
            } else {
                return BrsInvalid.Instance;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
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
        if (!interpreter.environment.hostNode) {
            interpreter.environment.hostNode = this;
        }
        return super.addObserver(interpreter, scope, fieldName, funcOrPort, infoFields);
    }

    setDesignResolution(resolution: string) {
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
        this.fields.get("currentdesignresolution")?.setValue(toAssociativeArray(this.ui));
    }

    renderNode(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            return;
        }
        const rotation = angle + this.getRotation();
        const backColor = this.getFieldValueJS("backgroundColor") as number;
        opacity = opacity * this.getOpacity();
        draw2D?.doClearCanvas(backColor);
        const backURI = this.getFieldValueJS("backgroundUri") as string;
        if (draw2D && backURI.trim() !== "") {
            const textureManager = getTextureManager();
            const bitmap = textureManager.loadTexture(backURI, this.httpAgent.customHeaders);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                const scaleX = this.ui.width / bitmap.width;
                const scaleY = this.ui.height / bitmap.height;
                draw2D.doDrawScaledObject(0, 0, scaleX, scaleY, bitmap, undefined, opacity);
            }
        }
        this.renderChildren(interpreter, origin, rotation, opacity, draw2D);
    }

    /** Handle SceneGraph onKeyEvent event */
    handleOnKeyEvent(interpreter: Interpreter, key: BrsString, press: BrsBoolean) {
        if (rootObjects.focused instanceof RoSGNode) {
            const path = this.createPath(rootObjects.focused, false);
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

    private handleKeyByNode(
        interpreter: Interpreter,
        hostNode: RoSGNode,
        key: BrsString,
        press: BrsBoolean
    ): boolean {
        const typeDef = interpreter.environment.nodeDefMap.get(hostNode.nodeSubtype.toLowerCase());
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
            }
            return BrsBoolean.False;
        }, nodeEnv);
        return handled instanceof BrsBoolean && handled.toBoolean();
    }
}
