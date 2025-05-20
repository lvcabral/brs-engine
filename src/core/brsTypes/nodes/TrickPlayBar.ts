import { FieldModel } from "./Field";
import { AAMember, BrsString, Float, Label, Poster, BrsBoolean, Int32 } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { convertHexColor } from "../../scenegraph/SGUtil";

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
    private readonly trickPlayBar: Poster;
    private readonly trickPlayPrg: Poster;
    private readonly trickPlayTic: Poster;
    private readonly trickPlayPos: Label;
    private readonly trickPlayRem: Label;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "TrickPlayBar") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.barH = 18;
            this.barW = 1716;
            this.trickPlayRem = this.addLabel("textColor", [1543, 36], 174, 36, 36, "top", "right");
        } else {
            this.barH = 12;
            this.barW = 1144;
            this.trickPlayRem = this.addLabel("textColor", [1028, 24], 116, 24, 24, "top", "right");
        }
        this.trickPlayBar = this.addPoster(`common:/images/${this.resolution}/trickplaybar.9.png`, [0, 0], this.barW, this.barH);
        this.trickPlayPrg = this.addPoster(`common:/images/${this.resolution}/trickplaybar.9.png`, [0, 0], 1, this.barH);
        this.trickPlayTic = this.addPoster(`common:/images/${this.resolution}/trickplayticker.png`, [0, 0], this.barH, this.barH);
        this.trickPlayPos = this.addLabel("textColor", [0, this.barH * 2], 0, this.barH * 2);
        this.trickPlayBar.setFieldValue("opacity", new Float(0.3));
        this.trickPlayPrg.setFieldValue("visible", BrsBoolean.False);
        this.trickPlayPrg.setFieldValue("blendColor", new Int32(convertHexColor("0x6F1AB1FF")));
        this.trickPlayTic.setFieldValue("visible", BrsBoolean.False);
    }

    setPosition(position: number, duration: number) {
        if (this.trickPlayPos && position >= 0 && duration > 0) {
            const remaining = duration - position;
            const posStr = `${Math.floor(position / 60)}:${Math.floor(position % 60)
                .toString()
                .padStart(2, "0")}`;
            const remStr = `${Math.floor(remaining / 60)}:${Math.floor(remaining % 60)
                .toString()
                .padStart(2, "0")}`;
            this.trickPlayPos.setFieldValue("text", new BrsString(posStr));
            this.trickPlayRem.setFieldValue("text", new BrsString(remStr));
            const width = this.trickPlayBar.getFieldValueJS("width") as number;
            const progress = (position / duration) * width;
            if (progress >= this.barH) {
                this.trickPlayPrg.setFieldValue("visible", BrsBoolean.True);
                this.trickPlayPrg.setFieldValue("width", new Int32(progress));
                this.trickPlayTic.setFieldValue("visible", BrsBoolean.True);
                this.trickPlayTic.setTranslationX(progress - this.barH);
            } else {
                this.trickPlayPrg.setFieldValue("visible", BrsBoolean.False);
                this.trickPlayTic.setFieldValue("visible", BrsBoolean.False);
            }
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
