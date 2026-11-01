import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    RoArray,
    RoBitmap,
    IfDraw2D,
    isAnyNumber,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { SGNodeFactory } from "../factory/NodeFactory";
import { Label } from "./Label";
import { Poster } from "./Poster";
import { Group } from "./Group";
import { sgRoot } from "../SGRoot";
import { sgClock } from "../SGClock";

/** Hash marks a device builds up front; shown at these slots only once `hashMarkPositions` is set. */
const DEFAULT_HASH_POSITIONS = [0.25, 0.5, 0.75];

const pad2 = (n: number) => n.toString().padStart(2, "0");

/** `M:SS` (unpadded minutes), or `H:MM:SS` from one hour, flooring to whole seconds. */
function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = pad2(Math.floor(seconds % 60));
    return hours > 0 ? `${hours}:${pad2(minutes)}:${secs}` : `${minutes}:${secs}`;
}

/**
 * Child order matches a device (`trickPlayBar.getChild(n)` is relied on by apps such as jellyfin-roku):
 * 0 track, 1 filled bar, 2 thumb, 3 ticker, 4-6 hash marks, 7 thumbnail holder, 8 position label,
 * 9 remaining label, 10 live icon, 11 "LIVE" label. Hash marks beyond the initial three are appended last.
 */
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
        { name: "hashMarkBlendColor", type: "color", value: "0xffffffff" },
        { name: "hashMarkPositions", type: "floatarray", value: "[]" },
    ];
    private readonly barW: number;
    private readonly barH: number;
    private readonly backBack: Poster;
    private readonly barProgress: Poster;
    private readonly barThumb: Poster;
    private readonly barTicker: Poster;
    private readonly hashMarks: Poster[] = [];
    private readonly position: Label;
    private readonly remaining: Label;
    private readonly liveLabel: Label;
    private readonly built: boolean = false;
    private lastClipWidth = 0;
    private readonly bmpIcons: Map<string, RoBitmap>;
    private stateIcon: RoBitmap | undefined;
    private stateIconTimeout: number = -1;
    /** Clock captured on the last paint pass; layout passes reuse it instead of reading the clock. */
    private lastPaintNow: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TrickPlayBar) {
        super([], name);
        this.setExtendsType(SGNodeType.TrickPlayBar, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.barH = this.px(18);
        this.barW = this.px(1716);
        const barBmpUri = `common:/images/${this.resolution}/trickplaybar.9.png`;
        const trackUri = (this.getValueJS("trackImageUri") as string) || barBmpUri;
        const filledUri = (this.getValueJS("filledBarImageUri") as string) || barBmpUri;
        this.backBack = this.addPoster(trackUri, [0, 0], this.barW, this.barH);
        // The filled bar is full width and clipped to the ticker centre, as on a device.
        this.barProgress = this.addPoster(filledUri, [0, 0], this.barW, this.barH);
        // noScaling must be set after the uri is assigned: loading a uri recomputes it (Poster.setValue).
        this.barThumb = this.addPoster(this.tickerUri, [0, 0]);
        this.barThumb.noScaling = true;
        this.barTicker = this.addPoster(this.tickerUri, [0, 0]);
        this.barTicker.noScaling = true;
        this.updateHashMarks(this.getValue("hashMarkPositions"));
        const thumbW = this.px(75);
        const thumbH = this.px(45);
        const thumbnail = this.addPoster("", [(this.barW - thumbW) / 2, this.px(33)], thumbW, thumbH);
        const thumbnailFrame = SGNodeFactory.createNode(SGNodeType.Poster) as Poster;
        thumbnailFrame.setValueSilent("width", new Float(thumbW));
        thumbnailFrame.setValueSilent("height", new Float(thumbH));
        thumbnailFrame.setValueSilent("visible", BrsBoolean.False);
        thumbnail.appendChildToParent(thumbnailFrame);
        const labelH = this.barH * 2;
        this.position = this.addLabel("textColor", [0, labelH], 0, labelH, labelH);
        this.remaining = this.addLabel(
            "textColor",
            [this.px(1542), labelH],
            this.px(174),
            labelH,
            labelH,
            "top",
            "right"
        );
        const liveIcon = this.addPoster("", [this.px(1585), labelH], this.px(36), this.px(36));
        liveIcon.setValueSilent("blendColor", new Int32(-717333761)); // 0xd53e5aff
        liveIcon.setValueSilent("visible", BrsBoolean.False);
        this.liveLabel = this.addLabel(
            "textColor",
            [this.px(1621), labelH],
            this.px(95),
            labelH,
            this.px(45),
            "top",
            "right"
        );
        this.liveLabel.setValueSilent("text", new BrsString("LIVE"));
        this.liveLabel.setValueSilent("visible", BrsBoolean.False);
        this.position.setValueSilent("text", new BrsString("0:00"));
        this.remaining.setValueSilent("text", new BrsString("0:00"));
        this.backBack.setValueSilent("opacity", new Float(0.3));
        this.barProgress.setValueSilent("blendColor", new Int32(1730004479)); // From inspection in Roku debugger
        this.barProgress.setValueSilent("visible", BrsBoolean.False);
        this.lastClipWidth = Math.floor(this.barH / 2);
        this.barProgress.setValue("clippingRect", new RoArray(this.clipRect(this.lastClipWidth)));
        this.barThumb.setValueSilent("blendColor", new Int32(1730004479));
        this.barThumb.setValueSilent("visible", BrsBoolean.False);
        this.barTicker.setValueSilent("visible", BrsBoolean.False);
        this.linkField(this.backBack, "blendColor", "trackBlendColor");
        this.linkField(this.barProgress, "blendColor", "filledBarBlendColor");
        this.linkField(this.barTicker, "blendColor", "currentTimeMarkerBlendColor");
        this.setValueSilent("width", new Int32(this.barW));
        this.built = true;
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

    /** Converts a device FHD pixel value to the current UI resolution. */
    private px(fhd: number): number {
        return Math.round(fhd * (this.resolution === "FHD" ? 1 : 2 / 3));
    }

    private get tickerUri(): string {
        return `common:/images/${this.resolution}/trickplayticker.png`;
    }

    // The bar's visible parts (track, filled bar, ticker, time labels) are internal child
    // nodes built in the constructor and held by private fields (this.backBack, this.barProgress,
    // …). The Video exposes this bar as its `trickPlayBar` field, so it is serialized to a Task
    // even though the Video itself no longer serializes its children. Opting out here keeps those
    // internal children from being reconciled into fresh copies, which would leave the bar's field
    // references pointing at nodes no longer in the render tree — so the bar would draw only its
    // directly-painted state icon (ff/rw) and none of its child posters. See Node.serializesChildren.
    serializesChildren(): boolean {
        return false;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "visible" && value instanceof BrsBoolean) {
            if (this.getValueJS("visible") !== value.toBoolean()) {
                if (!sgRoot.inTaskThread()) postMessage({ trickPlayBarVisible: value.toBoolean() });
            }
        } else if (this.built) {
            this.applyToChildren(fieldName, value);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    /** Forwards a bar-level field to the internal child nodes that realize it. */
    private applyToChildren(fieldName: string, value: BrsType) {
        if (fieldName === "textcolor") {
            this.position.setValue("color", value);
            this.remaining.setValue("color", value);
            this.liveLabel.setValue("color", value);
        } else if (fieldName === "trackimageuri") {
            this.backBack.setValue("uri", value);
        } else if (fieldName === "filledbarimageuri") {
            this.barProgress.setValue("uri", value);
        } else if (fieldName === "hashmarkblendcolor") {
            for (const mark of this.hashMarks) {
                mark.setValue("blendColor", value);
            }
        } else if (fieldName === "hashmarkpositions") {
            this.updateHashMarks(value);
        }
    }

    /**
     * Lays out the hash marks like a device: the existing marks are reused in order, surplus ones are
     * removed from the end and missing ones are appended after the other children. With no positions,
     * the three default marks are kept hidden at their default slots.
     */
    private updateHashMarks(positions: BrsType | undefined) {
        const given =
            positions instanceof RoArray
                ? positions
                      .getElements()
                      .filter(isAnyNumber)
                      .map((element) => Number(element.getValue()))
                      .filter(Number.isFinite)
                : [];
        const hasGiven = given.length > 0;
        const targets = hasGiven ? given : DEFAULT_HASH_POSITIONS;
        while (this.hashMarks.length > targets.length) {
            this.removeChildByReference(this.hashMarks.pop()!);
        }
        const span = this.barW - this.px(12);
        const markSize = this.px(10);
        for (const [i, position] of targets.entries()) {
            let mark = this.hashMarks[i];
            if (mark === undefined) {
                mark = this.addPoster(this.tickerUri, [0, 0], markSize, markSize);
                mark.setValue("blendColor", this.getValue("hashMarkBlendColor"));
                this.hashMarks.push(mark);
            }
            mark.setTranslation([this.px(1) + position * span, this.px(4)]);
            mark.setValue("visible", BrsBoolean.from(hasGiven));
        }
    }

    private clipRect(width: number): Float[] {
        return [new Float(0), new Float(0), new Float(width), new Float(this.barH)];
    }

    setPosition(position: number, duration: number) {
        if (this.position && position >= 0 && duration > 0) {
            const clamped = Math.min(position, duration);
            this.position.setValueSilent("text", new BrsString(formatTime(clamped)));
            this.remaining.setValueSilent("text", new BrsString(formatTime(duration - clamped)));
            // The ticker travels the track minus its own width.
            const tickerX = (clamped / duration) * (this.barW - this.barH);
            this.barProgress.setValueSilent("visible", BrsBoolean.True);
            const clipWidth = Math.floor(tickerX + this.barH / 2);
            if (clipWidth !== this.lastClipWidth) {
                this.lastClipWidth = clipWidth;
                this.barProgress.setValue("clippingRect", new RoArray(this.clipRect(clipWidth)));
            }
            // The thumb is never drawn, so its position only needs to be readable.
            this.barThumb.setValueSilent("translation", new RoArray([new Float(tickerX), new Float(0)]));
            this.barTicker.setValueSilent("visible", BrsBoolean.True);
            this.barTicker.setTranslationX(tickerX);
        } else {
            this.barProgress.setValueSilent("visible", BrsBoolean.False);
            this.barTicker.setValueSilent("visible", BrsBoolean.False);
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
            this.stateIconTimeout = timeout > 0 ? sgClock.now() + timeout : -1;
        }
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible() || sgRoot.inTaskThread()) {
            this.updateRenderTracking(true);
            return;
        }
        const drawTrans = this.getDrawTranslation(origin, angle);

        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        // Check the icon expiry against the clock only on a paint pass; a layout pass reuses the
        // last paint's timestamp so the icon cannot flip mid-refresh (layout must be clock-free).
        if (this.isPaintPass(draw2D)) {
            this.lastPaintNow = sgClock.now();
        }
        if (this.stateIcon && (this.stateIconTimeout === -1 || this.stateIconTimeout > this.lastPaintNow)) {
            const iconRect = {
                x: rect.x + (size.width - this.stateIcon.width) / 2,
                y: rect.y + this.barH,
                width: this.stateIcon.width,
                height: this.stateIcon.height,
            };
            this.drawImage(this.stateIcon, iconRect, angle, opacity, draw2D);
        }
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
