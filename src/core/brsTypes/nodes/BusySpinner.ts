import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { BrsInvalid, BrsString, BrsType, Float, isBrsString, Poster, RoArray } from "..";
import { Interpreter } from "../..";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class BusySpinner extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "poster", type: "node" },
        { name: "control", type: "string", value: "none" },
        { name: "clockwise", type: "boolean", value: "true" },
        { name: "spinInterval", type: "float", value: "2.0" }, // seconds
    ];
    private poster: Poster;
    private active: boolean = false;
    private lastRenderTime: number = 0;
    private currentRotation: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "BusySpinner") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.poster = this.addPoster("", [0, 0]);
        this.setFieldValue("poster", this.poster);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.getValue().toLowerCase();

        if (mapKey === "control") {
            let control = value.toString();
            if (control === "start") {
                this.active = true;
                this.lastRenderTime = performance.now();
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
                return BrsInvalid.Instance;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setPosterUri(uri: string) {
        this.poster.set(new BrsString("uri"), new BrsString(uri));
    }

    setBlendColor(color: BrsType) {
        if (color instanceof BrsString) {
            this.poster.set(new BrsString("blendColor"), color);
        }
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
            this.poster.setFieldValue(
                "scaleRotateCenter",
                new RoArray([new Float(bmp.width / 2), new Float(bmp.height / 2)])
            );
            if (size.width !== bmp.width) {
                rect.width = bmp.width;
                this.setFieldValue("width", new Float(bmp.width));
            }
            if (size.height !== bmp.height) {
                rect.height = bmp.height;
                this.setFieldValue("height", new Float(bmp.height));
            }
            if (this.active) {
                const now = performance.now();
                const spinInterval = this.getFieldValueJS("spinInterval") as number;
                const clockwise = this.getFieldValueJS("clockwise") as boolean;
                const direction = clockwise ? -1 : 1;
                const elapsedTime = (now - this.lastRenderTime) / 1000;
                const rotationChange = (2 * Math.PI * elapsedTime) / (spinInterval ?? 2);
                this.currentRotation += direction * rotationChange;
                const spin = this.currentRotation + rotation;
                this.poster.set(new BrsString("rotation"), new Float(spin));
                this.lastRenderTime = now;
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
