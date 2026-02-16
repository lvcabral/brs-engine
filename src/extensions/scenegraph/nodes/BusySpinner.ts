import { AAMember, Interpreter, BrsString, BrsType, RoArray, Float, IfDraw2D, Rect } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { rotateTranslation } from "../SGUtil";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Poster } from "./Poster";

export class BusySpinner extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "poster", type: "node" },
        { name: "uri", type: "uri" },
        { name: "control", type: "string", value: "none" },
        { name: "clockwise", type: "boolean", value: "true" },
        { name: "spinInterval", type: "float", value: "2.0" }, // seconds
    ];
    private poster: Poster;
    private active: boolean = true;
    private width: number = 0;
    private height: number = 0;
    private lastRenderTime: number = 0;
    private currentRotation: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.BusySpinner) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const size = this.resolution === "FHD" ? 120 : 80;
        this.poster = this.addPoster(`common:/images/${this.resolution}/spinner.png`, [0, 0], size, size);
        this.setValueSilent("poster", this.poster);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const mapKey = index.toLowerCase();

        if (mapKey === "control") {
            const control = value.toString();
            if (control === "start") {
                this.active = true;
                this.lastRenderTime = Date.now();
            } else if (control === "stop") {
                this.active = false;
            } else {
                value = new BrsString("none");
            }
        } else if (mapKey === "poster") {
            if (value instanceof Poster) {
                this.removeChildByReference(this.poster);
                this.appendChildToParent(value);
                this.poster = value;
            } else {
                return;
            }
        } else if (mapKey === "uri") {
            this.poster.setValue("uri", value);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setBlendColor(color: BrsType) {
        if (color instanceof BrsString) {
            this.poster.setValue("blendColor", color);
        }
    }

    getDimensions() {
        return { width: this.width, height: this.height };
    }

    private updateChildren() {
        const width = this.poster.getValueJS("width") || this.poster.getValueJS("bitmapWidth");
        const height = this.poster.getValueJS("height") || this.poster.getValueJS("bitmapHeight");
        if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
            return;
        }
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            const rotationCenterX = new Float(width / 2);
            const rotationCenterY = new Float(height / 2);
            this.poster.setValueSilent("scaleRotateCenter", new RoArray([rotationCenterX, rotationCenterY]));
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        if (this.isDirty) {
            this.updateChildren();
        }
        if (this.active) {
            if (this.lastRenderTime === 0) {
                this.lastRenderTime = Date.now();
            }
            const now = Date.now();
            const spinInterval = this.getValueJS("spinInterval") as number;
            const clockwise = this.getValueJS("clockwise") as boolean;
            const direction = clockwise ? -1 : 1;
            const elapsedTime = (now - this.lastRenderTime) / 1000;
            const rotationChange = (2 * Math.PI * elapsedTime) / (spinInterval ?? 2);
            if (rotationChange !== 0) {
                this.currentRotation += direction * rotationChange;
                const spin = this.currentRotation + rotation;
                this.poster.setValue("rotation", new Float(spin));
                this.lastRenderTime = now;
            }
        }
        const rect: Rect = { x: drawTrans[0], y: drawTrans[1], width: this.width, height: this.height };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
