import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { LayoutGroup } from "./LayoutGroup";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../..";
import { rotateTranslation } from "../../scenegraph/SGUtil";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    Button,
    Float,
    Font,
    Int32,
    jsValueOf,
    Label,
    RoFont,
    rootObjects,
    RoSGNode,
    ValueKind,
} from "..";

export class ButtonGroup extends LayoutGroup {
    readonly defaultFields: FieldModel[] = [
        { name: "textColor", type: "color", value: "0xddddddff" },
        { name: "focusedTextColor", type: "color", value: "0x262626ff" },
        { name: "textFont", type: "font" },
        { name: "focusedTextFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "iconUri", type: "uri", value: "" },
        { name: "focusedIconUri", type: "uri", value: "" },
        { name: "minWidth", type: "float", value: "0.0" },
        { name: "maxWidth", type: "float", value: "32767" },
        { name: "buttonHeight", type: "float", value: "0.0" },
        { name: "rightJustify", type: "boolean", value: "false" },
        { name: "buttonSelected", type: "integer", value: "0" },
        { name: "buttonFocused", type: "integer", value: "0" },
        { name: "focusButton", type: "integer", value: "0" },
        { name: "buttons", type: "array" },
    ];

    private readonly margin: number;
    private readonly gap: number;
    private readonly vertOffset: number;
    private width: number;
    private iconSize: number[] = [0, 0];
    private lastPressHandled: string;

    protected focusIndex: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ButtonGroup") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.width = 0;
        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.margin = 36;
            this.gap = 18;
            this.vertOffset = 21;
            this.iconSize = [36, 36];
            this.setFieldValue("buttonHeight", new Float(96));
            this.setFieldValue("iconUri", new BrsString(Button.iconUriFHD));
            this.setFieldValue("focusedIconUri", new BrsString(Button.iconUriFHD));
        } else {
            this.margin = 24;
            this.gap = 12;
            this.vertOffset = 14;
            this.iconSize = [24, 24];
            this.setFieldValue("buttonHeight", new Float(64));
            this.setFieldValue("iconUri", new BrsString(Button.iconUriHD));
            this.setFieldValue("focusedIconUri", new BrsString(Button.iconUriHD));
        }
        this.setFieldValue("focusBitmapUri", new BrsString(Button.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(Button.footprintUri));
        this.lastPressHandled = "";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "focusbutton") {
            const focusedIndex = jsValueOf(this.getFieldValue("buttonFocused"));
            if (focusedIndex !== jsValueOf(value)) {
                this.focusIndex = jsValueOf(value);
                index = new BrsString("buttonFocused");
            } else {
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "buttonfocused") {
            // Read-only field
            return BrsInvalid.Instance;
        }
        const retValue = super.set(index, value, alwaysNotify, kind);
        if (fieldName === "buttons") {
            this.refreshButtons();
            this.refreshFocus();
        }
        return retValue;
    }

    setNodeFocus(interpreter: Interpreter, focusOn: boolean): boolean {
        const focus = super.setNodeFocus(interpreter, focusOn);
        if (focus) {
            this.refreshFocus();
        }
        return focus;
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "up" || key === "down") {
            const nextIndex = this.getIndex(key === "up" ? -1 : 1);
            if (press && nextIndex !== this.focusIndex) {
                this.set(new BrsString("focusButton"), new Int32(nextIndex));
                handled = true;
            }
        } else if (key === "OK") {
            if (press) {
                this.set(new BrsString("buttonSelected"), new Int32(this.focusIndex));
                handled = true;
            }
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
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
            width: this.width,
            height: size.height,
        };
        if (this.isDirty) {
            this.refreshButtons();
            this.isDirty = false;
        }
        this.refreshFocus();
        // TODO: update then width/height based on the # of buttons and layout direction
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, draw2D);
        this.updateParentRects(origin, angle);
    }

    private refreshButtons() {
        const buttons = jsValueOf(this.getFieldValue("buttons")) as string[];
        if (!buttons) {
            return;
        }
        const buttonsCount = Math.max(buttons.length, this.children.length);
        const focusedFont = this.getFieldValue("focusedTextFont") as Font;
        const buttonHeight = jsValueOf(this.getFieldValue("buttonHeight")) as number;
        this.width = this.calculateButtonWidth(buttons, focusedFont.createDrawFont());
        for (let i = 0; i < buttonsCount; i++) {
            const buttonText = buttons[i];
            if (buttonText) {
                let button = this.children[i] as Button;
                if (!button) {
                    button = this.createButton();
                }
                button.iconSize = this.iconSize;
                button.setFieldValue("text", new BrsString(buttonText));
                this.copyField(button, "textColor");
                this.copyField(button, "focusedTextColor");
                this.copyField(button, "textFont");
                this.copyField(button, "focusedTextFont");
                this.copyField(button, "focusBitmapUri");
                this.copyField(button, "focusFootprintBitmapUri");
                this.copyField(button, "iconUri");
                this.copyField(button, "focusedIconUri");
                this.copyField(button, "height", "buttonHeight");
                button.setFieldValue("minWidth", new Float(this.width));
                this.copyField(button, "maxWidth");
                button.setFieldValue("showFocusFootprint", BrsBoolean.from(this.focusIndex === i));
                // TODO: Implement support for field layoutDirection (vert, horiz)
                const buttonY = i * (Math.max(buttonHeight, this.iconSize[1]) - this.vertOffset);
                const offsetY = Math.max((this.iconSize[1] - buttonHeight) / 2, 0);
                button.setFieldValue("translation", brsValueOf([0, buttonY + offsetY]));
            } else {
                break;
            }
        }
        this.children.splice(buttons.length);
    }

    private createButton(): Button {
        const button = new Button();
        for (let child of button.getNodeChildren()) {
            if (child instanceof Label) {
                child.setFieldValue("horizAlign", new BrsString("left"));
                break;
            }
        }
        this.children.push(button);
        button.setNodeParent(this);
        return button;
    }

    private refreshFocus() {
        const focusedNode = rootObjects.focused;
        if (
            this.children.length &&
            focusedNode instanceof RoSGNode &&
            (focusedNode === this || focusedNode.getNodeParent() === this)
        ) {
            const focusedButton = this.children[this.focusIndex];
            if (focusedNode !== focusedButton) {
                rootObjects.focused = focusedButton;
            }
        }
    }

    private calculateButtonWidth(buttons: string[], font: RoFont): number {
        const minWidth = jsValueOf(this.getFieldValue("minWidth")) as number;
        const maxWidth = jsValueOf(this.getFieldValue("maxWidth")) as number;
        this.iconSize = this.getIconSize(["iconUri", "focusedIconUri"]);
        const iconGap = this.iconSize[0] > 0 ? this.iconSize[0] + this.gap : 0;
        const labelMax = maxWidth - this.margin * 2 - iconGap;

        let labelWidth = minWidth - this.margin * 2 - iconGap;
        for (let button of buttons) {
            const measured = font.measureTextWidth(button, labelMax);
            labelWidth = Math.max(measured.width, labelWidth);
        }
        return Math.min(maxWidth, labelWidth + this.margin * 2 + iconGap);
    }

    private getIndex(offset: number = 0) {
        const focused = jsValueOf(this.getFieldValue("buttonFocused")) as number;
        const index = focused + offset;
        const buttons = jsValueOf(this.getFieldValue("buttons")) as string[];
        if (index >= buttons.length) {
            return buttons.length - 1;
        } else if (index < 0) {
            return 0;
        }
        return index;
    }
}
