import { AAMember, Interpreter, RoAssociativeArray, BrsString, Float, IfDraw2D, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { BusySpinner } from "./BusySpinner";
import { Label } from "./Label";
import { StandardDialog } from "./StandardDialog";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { rotateTranslation } from "../SGUtil";

export class StdDlgProgressItem extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "scrollable", type: "boolean", value: "false" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
    ];
    private readonly spinner: BusySpinner;
    private readonly label: Label;
    private readonly gap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgProgressItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.spinner = new BusySpinner();
        this.gap = this.resolution === "FHD" ? 30 : 20;
        this.spinner.setValue("control", new BrsString("start"));
        this.appendChildToParent(this.spinner);
        this.label = new Label();
        this.appendChildToParent(this.label);
        this.linkField(this.label, "text");
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
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: size.height,
        };
        const colors = this.getPaletteColors();
        const itemColor = colors.get(new BrsString("DialogItemColor"));
        if (itemColor instanceof BrsString) {
            this.spinner.setBlendColor(itemColor);
        }
        const textColor = colors.get(new BrsString("DialogTextColor"));
        if (textColor instanceof BrsString) {
            this.label.setValueSilent("color", textColor);
        }
        const spinnerSize = this.spinner.getDimensions();
        const labelSize = this.label.getMeasured();
        if (spinnerSize.width > 0 && spinnerSize.height > 0) {
            const labelTrans = [spinnerSize.width + this.gap, (spinnerSize.height - labelSize.height) / 2];
            this.label.setTranslation(labelTrans);
            boundingRect.width = spinnerSize.width + labelSize.width + this.gap;
            this.setValue("width", new Float(boundingRect.width));
        } else if (labelSize.width > 0 && labelSize.height > 0) {
            boundingRect.width = labelSize.width;
            this.setValue("width", new Float(boundingRect.width));
        }
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private getPaletteColors() {
        const area = this.getNodeParent();
        if (area instanceof StdDlgContentArea) {
            const dialog = area.getNodeParent();
            if (dialog instanceof StandardDialog) {
                return dialog.getPaletteColors();
            }
        }
        return new RoAssociativeArray([]);
    }
}
