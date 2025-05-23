import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsString, Float, Label, Poster, BrsBoolean, Int32, BrsType, isBrsString } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";

export class TrickPlayBar extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "currentTimeMarkerBlendColor", type: "color", value: "0xffffffff" },
        { name: "textColor", type: "color", value: "0xfefefeff" },
        { name: "thumbBlendColor", type: "color", value: "0xffffffff" },
        { name: "filledBarBlendColor", type: "color", value: "0xffffffff" },
        { name: "liveFilledBarBlendColor", type: "color", value: "0xffffffff" },
        { name: "filledBarImageUri", type: "uri" },
        { name: "trackBlendColor", type: "color", value: "0xffffffff" },
        { name: "trackImageUri", type: "uri" },
    ];
    private readonly barW: number;
    private readonly barH: number;
    private readonly backBack: Poster;
    private readonly barProgress: Poster;
    private readonly barTicker: Poster;
    private readonly position: Label;
    private readonly remaining: Label;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "TrickPlayBar") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.barH = 18;
            this.barW = 1716;
            this.remaining = this.addLabel("textColor", [1542, 36], 174, 36, 36, "top", "right");
        } else {
            this.barH = 12;
            this.barW = 1144;
            this.remaining = this.addLabel("textColor", [1028, 24], 116, 24, 24, "top", "right");
        }
        const barBmpUri = `common:/images/${this.resolution}/trickplaybar.9.png`;
        this.backBack = this.addPoster(barBmpUri, [0, 0], this.barW, this.barH);
        this.barProgress = this.addPoster(barBmpUri, [0, 0], 1, this.barH);
        this.barTicker = this.addPoster(`common:/images/${this.resolution}/trickplayticker.png`, [0, 0]);
        this.position = this.addLabel("textColor", [0, this.barH * 2], 0, this.barH * 2);
        this.backBack.setFieldValue("opacity", new Float(0.3));
        this.barProgress.setFieldValue("visible", BrsBoolean.False);
        this.barProgress.setFieldValue("blendColor", new Int32(1730004479)); // From inspection in Roku debugger
        this.barTicker.setFieldValue("visible", BrsBoolean.False);
        this.linkField(this.backBack, "blendColor", "trackBlendColor");
        this.linkField(this.backBack, "uri", "trackImageUri");
        this.linkField(this.barProgress, "blendColor", "filledBarBlendColor");
        this.linkField(this.barProgress, "uri", "filledBarImageUri");
        this.linkField(this.barTicker, "blendColor", "currentTimeMarkerBlendColor");
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "textcolor") {
            this.position.set(new BrsString("color"), value);
            this.remaining.set(new BrsString("color"), value);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setPosition(position: number, duration: number) {
        if (this.position && position >= 0 && duration > 0) {
            const remaining = duration - position;
            const posStr = `${Math.floor(position / 60)}:${Math.floor(position % 60)
                .toString()
                .padStart(2, "0")}`;
            const remStr = `${Math.floor(remaining / 60)}:${Math.floor(remaining % 60)
                .toString()
                .padStart(2, "0")}`;
            this.position.setFieldValue("text", new BrsString(posStr));
            this.remaining.setFieldValue("text", new BrsString(remStr));
            const width = this.backBack.getFieldValueJS("width") as number;
            const progress = (position / duration) * width;
            this.barProgress.setFieldValue("visible", BrsBoolean.from(progress > this.barH));
            this.barProgress.setFieldValue("width", new Int32(progress));
            this.barTicker.setFieldValue("visible", BrsBoolean.True);
            this.barTicker.setTranslationX(Math.max(progress - this.barH, 0));
        } else {
            this.barProgress.setFieldValue("visible", BrsBoolean.False);
            this.barTicker.setFieldValue("visible", BrsBoolean.False);
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const drawTrans = this.getTranslation();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];

        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
