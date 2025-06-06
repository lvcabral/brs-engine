import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsString, Float, Label, Poster, BrsBoolean, Int32, BrsType, isBrsString, RoBitmap } from "..";
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
    private readonly bmpIcons: Map<string, RoBitmap>;
    private stateIcon: RoBitmap | undefined;
    private stateIconTimeout: number = -1;

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
        this.setFieldValue("width", new Int32(this.barW));
        this.bmpIcons = new Map<string, RoBitmap>([
            ["skip-right", this.loadBitmap(`common:/images/${this.resolution}/icon_skipAhead.png`)!],
            ["skip-left", this.loadBitmap(`common:/images/${this.resolution}/icon_skipBack.png`)!],
            ["replay", this.loadBitmap(`common:/images/${this.resolution}/icon_replay.png`)!],
            ["ff-x1", this.loadBitmap(`common:/images/${this.resolution}/icon_FFx1.png`)!],
            ["ff-x2", this.loadBitmap(`common:/images/${this.resolution}/icon_FFx2.png`)!],
            ["ff-x3", this.loadBitmap(`common:/images/${this.resolution}/icon_FFx3.png`)!],
            ["rw-x1", this.loadBitmap(`common:/images/${this.resolution}/icon_RWx1.png`)!],
            ["rw-x2", this.loadBitmap(`common:/images/${this.resolution}/icon_RWx2.png`)!],
            ["rw-x3", this.loadBitmap(`common:/images/${this.resolution}/icon_RWx3.png`)!],
        ]);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "textcolor") {
            this.position.set(new BrsString("color"), value);
            this.remaining.set(new BrsString("color"), value);
        } else if (fieldName === "visible" && value instanceof BrsBoolean) {
            if (this.getFieldValueJS("visible") !== value.toBoolean()) {
                postMessage({ trickPlayBarVisible: value.toBoolean() });
            }
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

    setStateIcon(iconName: string, timeout: number = -1) {
        // Timeout of 0 means no icon, -1 means no timeout
        if (timeout === 0) {
            this.stateIcon = undefined;
            this.stateIconTimeout = 0;
        }
        this.stateIcon = this.bmpIcons.get(iconName);
        if (this.stateIcon) {
            this.stateIconTimeout = timeout > 0 ? Date.now() + timeout : -1;
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
        if (this.stateIcon && (this.stateIconTimeout === -1 || this.stateIconTimeout > Date.now())) {
            const iconRect = {
                x: rect.x + (size.width - this.stateIcon.width) / 2,
                y: rect.y + this.barH,
                width: this.stateIcon.width,
                height: this.stateIcon.height,
            };
            this.drawImage(this.stateIcon, iconRect, angle, opacity, draw2D);
        }
        this.updateParentRects(origin, angle);
    }
}
