import { FieldModel } from "./Field";
import { Group } from "./Group";
import {
    AAMember,
    RoAssociativeArray,
    BrsString,
    BusySpinner,
    Label,
    RSGPalette,
    StandardDialog,
    StdDlgContentArea,
    Float,
    RoArray,
} from "..";
import { Interpreter } from "../..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class StdDlgProgressItem extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "scrollable", type: "boolean", value: "false" },
    ];
    private readonly spinnerUriFHD = "common:/images/busy_spinner_FHD.png";
    private readonly spinnerUriHD = "common:/images/busy_spinner_HD.png";
    private spinner: BusySpinner;
    private label: Label;
    private gap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StdDlgProgressItem") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.spinner = new BusySpinner();
        if (this.resolution === "FHD") {
            this.spinner.setPosterUri(this.spinnerUriFHD);
            this.gap = 30;
        } else {
            this.spinner.setPosterUri(this.spinnerUriHD);
            this.gap = 20;
        }
        this.appendChildToParent(this.spinner);
        this.label = new Label();
        this.appendChildToParent(this.label);
        this.linkField(this.label, "text");
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D): void {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: size.height,
        };
        const dialog = this.getDialog();
        if (dialog instanceof StandardDialog) {
            const palette = dialog.getFieldValue("palette");
            if (palette instanceof RSGPalette) {
                const colors = palette.getFieldValue("colors");
                if (colors instanceof RoAssociativeArray) {
                    this.spinner.setBlendColor(colors.get(new BrsString("DialogItemColor")));
                    const textColor = colors.get(new BrsString("DialogTextColor"));
                    if (textColor instanceof BrsString) {
                        this.label.setFieldValue("color", textColor);
                    }
                }
            }
        }
        const spinnerSize = this.spinner.getDimensions();
        const labelSize = this.label.getMeasured();
        if (spinnerSize.width > 0 && spinnerSize.height > 0) {
            this.label.setFieldValue(
                "translation",
                new RoArray([
                    new Float(spinnerSize.width + this.gap),
                    new Float((spinnerSize.height - labelSize.height) / 2),
                ])
            );
            this.setFieldValue("width", new Float(spinnerSize.width + labelSize.width + this.gap));
            boundingRect.width = spinnerSize.width + labelSize.width + this.gap;
        } else if (labelSize.width > 0 && labelSize.height > 0) {
            this.setFieldValue("width", new Float(labelSize.width));
            boundingRect.width = labelSize.width;
        }
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, draw2D);
        this.updateParentRects(origin, angle);
    }

    private getDialog() {
        const area = this.getNodeParent();
        if (area instanceof StdDlgContentArea) {
            const dialog = area.getNodeParent();
            if (dialog instanceof StandardDialog) {
                return dialog;
            }
        }
        return undefined;
    }
}
