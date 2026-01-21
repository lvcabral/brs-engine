import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    RoArray,
    RoFont,
    IfDraw2D,
    Rect,
    BrsInvalid,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { jsValueOf } from "../factory/Serializer";
import { Button } from "./Button";
import type { Font } from "./Font";
import { Label } from "./Label";
import { LayoutGroup } from "./LayoutGroup";
import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { rotateTranslation } from "../SGUtil";

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
        { name: "buttonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "focusButton", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttons", type: "stringarray", value: "[]" },
    ];

    private readonly margin: number;
    private readonly gap: number;
    private readonly vertOffset: number;
    private width: number;
    private iconSize: number[] = [0, 0];
    private lastPressHandled: string;

    protected focusIndex: number = 0;
    protected wasFocused: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ButtonGroup) {
        super([], name);
        this.setExtendsType(name, SGNodeType.LayoutGroup);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.width = 0;
        if (this.resolution === "FHD") {
            this.margin = 36;
            this.gap = 18;
            this.vertOffset = 18;
            this.iconSize = [36, 36];
            this.setValueSilent("buttonHeight", new Float(75));
            this.setValueSilent("iconUri", new BrsString(Button.iconUriFHD));
            this.setValueSilent("focusedIconUri", new BrsString(Button.iconUriFHD));
        } else {
            this.margin = 24;
            this.gap = 12;
            this.vertOffset = 12;
            this.iconSize = [24, 24];
            this.setValueSilent("buttonHeight", new Float(50));
            this.setValueSilent("iconUri", new BrsString(Button.iconUriHD));
            this.setValueSilent("focusedIconUri", new BrsString(Button.iconUriHD));
        }
        this.setValueSilent("focusBitmapUri", new BrsString(Button.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(Button.footprintUri));
        this.setValueSilent("buttons", new RoArray([]));
        this.lastPressHandled = "";
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "focusbutton") {
            const buttons = this.getValueJS("buttons");
            const newIndex = jsValueOf(value);
            if (typeof newIndex === "number" && newIndex >= 0 && newIndex < buttons.length) {
                this.focusIndex = newIndex;
                super.setValue("buttonFocused", value);
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "buttons" && value instanceof RoArray) {
            this.refreshButtons();
            this.refreshFocus();
        }
    }

    setNodeFocus(focusOn: boolean): boolean {
        const focus = super.setNodeFocus(focusOn);
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
                this.setValue("focusButton", new Int32(nextIndex));
                handled = true;
            }
        } else if (key === "OK") {
            if (press) {
                this.setValue("buttonSelected", new Int32(this.focusIndex));
                handled = true;
            }
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
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
            width: this.width,
            height: size.height,
        };
        this.refreshFocus();
        if (this.isDirty) {
            this.refreshButtons();
            this.isDirty = false;
        }
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        // TODO: update then width/height based on the # of buttons and layout direction
        this.updateBoundingRects(boundingRect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    private refreshButtons() {
        const buttons = jsValueOf(this.getValue("buttons")) as string[];
        if (!buttons) {
            return;
        }
        const buttonsCount = Math.max(buttons.length, this.children.length);
        const focusedFont = this.getValue("focusedTextFont") as Font;
        const buttonHeight = this.getValueJS("buttonHeight") as number;
        this.width = this.calculateButtonWidth(buttons, focusedFont.createDrawFont());
        for (let i = 0; i < buttonsCount; i++) {
            const buttonText = buttons[i];
            if (buttonText) {
                let button = this.children[i] as Button;
                if (!button) {
                    button = this.createButton();
                }
                button.iconSize = this.iconSize;
                button.setValueSilent("text", new BrsString(buttonText));
                this.copyField(button, "textColor");
                this.copyField(button, "focusedTextColor");
                this.copyField(button, "textFont");
                this.copyField(button, "focusedTextFont");
                this.copyField(button, "focusBitmapUri");
                this.copyField(button, "focusFootprintBitmapUri");
                this.copyField(button, "iconUri");
                this.copyField(button, "focusedIconUri");
                this.copyField(button, "height", "buttonHeight");
                button.setValueSilent("minWidth", new Float(this.width));
                this.copyField(button, "maxWidth");
                button.setValueSilent("showFocusFootprint", BrsBoolean.from(this.focusIndex === i));
                // TODO: Implement support for field layoutDirection (vert, horiz)
                const buttonY = i * (Math.max(buttonHeight, this.iconSize[1]) - this.vertOffset);
                const offsetY = Math.max((this.iconSize[1] - buttonHeight) / 2, 0);
                button.setValueSilent("translation", new RoArray([new Float(0), new Float(buttonY + offsetY)]));
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
                child.setValueSilent("horizAlign", new BrsString("left"));
                break;
            }
        }
        this.appendChildToParent(button);
        return button;
    }

    private refreshFocus() {
        const focusedNode = sgRoot.focused;
        if (
            this.children.length &&
            focusedNode instanceof RoSGNode &&
            (focusedNode === this || focusedNode.getNodeParent() === this)
        ) {
            const focusedButton = this.children[this.focusIndex];
            if (focusedNode !== focusedButton && focusedButton instanceof RoSGNode) {
                sgRoot.setFocused(focusedButton);
            }
            this.wasFocused = true;
        } else if (this.wasFocused) {
            this.wasFocused = false;
            this.isDirty = true;
        }
    }

    private calculateButtonWidth(buttons: string[], font: RoFont | BrsInvalid): number {
        const minWidth = this.getValueJS("minWidth") as number;
        const maxWidth = this.getValueJS("maxWidth") as number;
        this.iconSize = this.getIconSize(["iconUri", "focusedIconUri"]);
        const iconGap = this.iconSize[0] > 0 ? this.iconSize[0] + this.gap : 0;
        const labelMax = maxWidth - this.margin * 2 - iconGap;

        let labelWidth = minWidth - this.margin * 2 - iconGap;
        for (let button of buttons) {
            const measured = font instanceof RoFont ? font.measureTextWidth(button, labelMax) : { width: 0, height: 0 };
            labelWidth = Math.max(measured.width, labelWidth);
        }
        return Math.min(maxWidth, labelWidth + this.margin * 2 + iconGap);
    }

    private getIndex(offset: number = 0) {
        const focused = this.getValueJS("buttonFocused") as number;
        const index = focused + offset;
        const buttons = this.getValueJS("buttons") as string[];
        if (index >= buttons.length) {
            return buttons.length - 1;
        } else if (index < 0) {
            return 0;
        }
        return index;
    }
}
