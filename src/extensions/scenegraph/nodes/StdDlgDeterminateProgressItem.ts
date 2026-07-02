import { AAMember, Interpreter, BrsBoolean, BrsString, Float, Int32, IfDraw2D, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Label } from "./Label";
import { Rectangle } from "./Rectangle";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";
import { rotateTranslation } from "../SGUtil";

/**
 * A determinate progress indicator for a dialog content area: a horizontal bar that fills to the
 * `percent` value (0–100, clamped) with the percentage shown beside it, plus optional `text`. Maps
 * Roku's StdDlgDeterminateProgressItem (extends StdDlgItemBase → Group; the abstract base is
 * collapsed onto Group, matching the other StdDlg* items). It should only be used inside a
 * StdDlgContentArea.
 */
export class StdDlgDeterminateProgressItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "percent", type: "float", value: "0.0" },
        { name: "text", type: "string", value: "" },
    ];
    private readonly textLabel: Label;
    private readonly track: Rectangle;
    private readonly fill: Rectangle;
    private readonly percentLabel: Label;
    private readonly gap: number;
    private readonly barHeight: number;
    /** Geometry captured during layout so `percent` changes update the fill without a relayout. */
    private barWidth: number = 0;
    private barTop: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgDeterminateProgressItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.gap = this.resolution === "FHD" ? 18 : 12;
        this.barHeight = this.resolution === "FHD" ? 12 : 8;

        this.textLabel = new Label();
        this.textLabel.setValueSilent("wrap", BrsBoolean.True);
        this.textLabel.setValueSilent("horizAlign", new BrsString("left"));
        this.textLabel.setValueSilent("vertAlign", new BrsString("top"));
        this.appendChildToParent(this.textLabel);
        this.linkField(this.textLabel, "text");

        this.track = new Rectangle();
        this.appendChildToParent(this.track);
        this.fill = new Rectangle();
        this.appendChildToParent(this.fill);

        this.percentLabel = new Label();
        this.percentLabel.setValueSilent("horizAlign", new BrsString("right"));
        this.percentLabel.setValueSilent("vertAlign", new BrsString("center"));
        this.appendChildToParent(this.percentLabel);
    }

    /** Reads `percent`, clamping to 0–100. */
    private clampedPercent(): number {
        const value = this.getValueJS("percent") as number;
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
    }

    layoutItem(width: number): number {
        let y = 0;
        const text = (this.getValueJS("text") as string) ?? "";
        if (text === "") {
            this.textLabel.setValueSilent("visible", BrsBoolean.False);
        } else {
            this.textLabel.setValueSilent("visible", BrsBoolean.True);
            this.textLabel.setValueSilent("width", new Float(width));
            this.textLabel.setValue("font", new BrsString("font:SmallSystemFont"));
            this.textLabel.setTranslation([0, y]);
            y += this.textLabel.getMeasured().height + this.gap;
        }

        // Reserve room for the percent label (e.g. "100%") on the right of the bar.
        this.percentLabel.setValue("font", new BrsString("font:SmallSystemFont"));
        this.percentLabel.setValueSilent("text", new BrsString("100%"));
        const pctSize = this.percentLabel.getMeasured();
        const rowHeight = Math.max(this.barHeight, pctSize.height);
        this.barWidth = Math.max(0, width - pctSize.width - this.gap);
        this.barTop = y + (rowHeight - this.barHeight) / 2;

        this.track.setTranslation([0, this.barTop]);
        this.track.setValueSilent("width", new Float(this.barWidth));
        this.track.setValueSilent("height", new Float(this.barHeight));
        this.fill.setTranslation([0, this.barTop]);
        this.fill.setValueSilent("height", new Float(this.barHeight));
        this.percentLabel.setTranslation([this.barWidth + this.gap, y]);
        this.percentLabel.setValueSilent("width", new Float(pctSize.width));
        this.percentLabel.setValueSilent("height", new Float(rowHeight));

        y += rowHeight;
        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(y));
        return y;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const percent = this.clampedPercent();
        const colors = getDialogColors(this);
        const trackColor = colorFromPalette(colors, "DialogSecondaryItemColor", "0xAAAAAA66");
        const fillColor = colorFromPalette(colors, "DialogItemColor", "0xFFFFFFFF");
        const textColor = colorFromPalette(colors, "DialogTextColor", "0xDDDDDDFF");
        this.track.setValueSilent("color", new Int32(trackColor));
        this.fill.setValueSilent("color", new Int32(fillColor));
        this.fill.setValueSilent("width", new Float((this.barWidth * percent) / 100));
        this.textLabel.setValueSilent("color", new Int32(textColor));
        this.percentLabel.setValueSilent("color", new Int32(textColor));
        this.percentLabel.setValueSilent("text", new BrsString(`${percent}%`));

        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: size.height,
        };
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
