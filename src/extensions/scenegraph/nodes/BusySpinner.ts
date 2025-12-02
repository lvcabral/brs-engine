import { FieldKind, FieldModel } from "../SGTypes";
import { Group } from "./Group";
import { AAMember, BrsString, BrsType, RoArray, Float } from "brs-engine";
import { Interpreter } from "brs-engine";
import { IfDraw2D } from "brs-engine";
import { rotateTranslation } from "../SGUtil";
import { Poster } from "./Poster";

export class BusySpinner extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "poster", type: "node" },
        { name: "control", type: "string", value: "none" },
        { name: "clockwise", type: "boolean", value: "true" },
        { name: "spinInterval", type: "float", value: "2.0" }, // seconds
    ];
    private poster: Poster;
    private active: boolean = true;
    private lastRenderTime: number = 0;
    private currentRotation: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "BusySpinner") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.poster = this.addPoster("", [0, 0]);
        this.setValueSilent("poster", this.poster);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const mapKey = index.toLowerCase();

        if (mapKey === "control") {
            let control = value.toString();
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
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setPosterUri(uri: string) {
        this.poster.setValue("uri", new BrsString(uri));
    }

    setBlendColor(color: BrsType) {
        if (color instanceof BrsString) {
            this.poster.setValue("blendColor", color);
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const bmp = this.poster.getBitmap("uri");
        if (bmp?.isValid()) {
            this.poster.setValueSilent(
                "scaleRotateCenter",
                new RoArray([new Float(bmp.width / 2), new Float(bmp.height / 2)])
            );
            if (size.width !== bmp.width) {
                rect.width = bmp.width;
                this.setValueSilent("width", new Float(bmp.width));
            }
            if (size.height !== bmp.height) {
                rect.height = bmp.height;
                this.setValueSilent("height", new Float(bmp.height));
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
                this.currentRotation += direction * rotationChange;
                const spin = this.currentRotation + rotation;
                this.poster.setValue("rotation", new Float(spin));
                this.lastRenderTime = now;
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
