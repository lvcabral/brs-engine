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
    isBrsString,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { jsValueOf } from "../factory/Serializer";
import { Button } from "./Button";
import type { Font } from "./Font";
import { Label } from "./Label";
import { Group } from "./Group";
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
        { name: "focusBitmapBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "color", value: "0xFFFFFFFF" },
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
        this.lastPressHandled = "";
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "focusbutton") {
            const buttons = this.getValueJS("buttons");
            const newIndex = jsValueOf(value);
            if (typeof newIndex === "number" && newIndex >= 0 && newIndex < buttons.length) {
                this.focusIndex = newIndex;
                super.setValue("buttonFocused", value);
                // When key focus is already within the group, moving `focusButton` (via up/down
                // navigation in handleKey, or app code) must move the actual focus to the target
                // button. Otherwise refreshFocus would snap focusIndex back to the still-focused
                // previous button and navigation would appear stuck.
                const target = this.children[newIndex];
                if (this.hasKeyFocus() && target instanceof RoSGNode && sgRoot.focused !== target) {
                    sgRoot.setFocused(target);
                }
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "buttons" && value instanceof RoArray) {
            this.refreshButtons();
            this.refreshFocus();
        }
    }

    appendChildToParent(child: BrsType): boolean {
        // Only Button children are managed by the group; custom Group components keep their
        // own text/size/position and are laid out by the inherited LayoutGroup behavior.
        if (child instanceof Button) {
            const buttonText = child.getValue("text");
            const buttons = this.getValue("buttons");
            if (buttons instanceof RoArray && isBrsString(buttonText)) {
                buttons.elements.push(buttonText);
                this.setValueSilent("buttons", buttons);
                this.isDirty = true;
            }
        }
        return super.appendChildToParent(child);
    }

    /**
     * The group manages layout, appearance and focus only for Button children (created from the
     * `buttons` string array or appended directly). A group holding only custom Group components
     * behaves as a plain LayoutGroup, as on Roku.
     */
    private isManagedMode(): boolean {
        const buttons = jsValueOf(this.getValue("buttons")) as string[] | undefined;
        if (buttons?.length) {
            return true;
        }
        return this.children.some((child) => child instanceof Button);
    }

    /** True when key focus is on the group itself or on one of its managed Button children. */
    private hasKeyFocus(): boolean {
        const focused = sgRoot.focused;
        return focused === this || (focused instanceof Button && focused.getNodeParent() === this);
    }

    setNodeFocus(focusOn: boolean): boolean {
        const focus = super.setNodeFocus(focusOn);
        if (focus) {
            this.refreshFocus();
        }
        return focus;
    }

    handleKey(key: string, press: boolean): boolean {
        // Only consume keys when the group manages Button children and the key focus is on the
        // group or one of those buttons — otherwise let the key bubble to the app's onKeyEvent.
        if (!this.isManagedMode() || !this.hasKeyFocus()) {
            return false;
        }
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
        if (!this.isManagedMode()) {
            // No managed Button children: behave as a plain LayoutGroup so the app's
            // layoutDirection/itemSpacings and child translations are honored.
            super.renderNode(interpreter, origin, angle, opacity, draw2D);
            return;
        }
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        // Refresh focus/buttons before building the bounding rect so `this.width` is current and
        // the rect reflects the actual laid-out size (otherwise boundingRect() reports the stale
        // width — 0 on the first pass — which breaks callers that center the group by its width).
        this.refreshFocus();
        if (this.isDirty) {
            this.refreshButtons();
        }
        const buttons = jsValueOf(this.getValue("buttons")) as string[] | undefined;
        const buttonsCount = buttons?.length ?? this.children.length;
        const rowHeight = Math.max(this.getValueJS("buttonHeight") as number, this.iconSize[1]);
        const height = buttonsCount > 0 ? (buttonsCount - 1) * (rowHeight - this.vertOffset) + rowHeight : 0;
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: this.width,
            height,
        };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private refreshButtons() {
        const buttons = jsValueOf(this.getValue("buttons")) as string[];
        if (!buttons?.length) {
            return;
        }
        const buttonsCount = Math.max(buttons.length, this.children.length);
        const focusedFont = this.getValue("focusedTextFont") as Font;
        const buttonHeight = this.getValueJS("buttonHeight") as number;
        this.width = this.calculateButtonWidth(buttons, focusedFont.createDrawFont());
        for (let i = 0; i < buttonsCount; i++) {
            const buttonText = buttons[i];
            if (buttonText) {
                let button = this.children[i];
                if (button instanceof Group && !(button instanceof Button)) {
                    // Custom Group child: not managed — leave its text/size/position alone.
                    continue;
                }
                if (!(button instanceof Button)) {
                    button = this.createButton();
                }
                button.setValueSilent("text", new BrsString(buttonText));
                button.setValueSilent("minWidth", new Float(this.width));
                this.copyField(button, "textColor");
                if (button instanceof Button) {
                    button.iconSize = this.iconSize;
                    this.copyField(button, "focusedTextColor");
                    this.copyField(button, "textFont");
                    this.copyField(button, "focusedTextFont");
                    this.copyField(button, "focusBitmapUri");
                    this.copyField(button, "focusFootprintBitmapUri");
                    this.copyField(button, "focusBitmapBlendColor");
                    this.copyField(button, "focusFootprintBlendColor");
                    this.copyField(button, "iconUri");
                    this.copyField(button, "focusedIconUri");
                    this.copyField(button, "height", "buttonHeight");
                    this.copyField(button, "maxWidth");
                }
                button.setValueSilent("showFocusFootprint", BrsBoolean.from(this.focusIndex === i));
                const buttonY = i * (Math.max(buttonHeight, this.iconSize[1]) - this.vertOffset);
                const offsetY = Math.max((this.iconSize[1] - buttonHeight) / 2, 0);
                button.setValueSilent("translation", new RoArray([new Float(0), new Float(buttonY + offsetY)]));
            } else {
                break;
            }
        }
        // Drop only surplus managed Buttons beyond the `buttons` array — never custom children.
        for (let i = this.children.length - 1; i >= buttons.length; i--) {
            if (this.children[i] instanceof Button) {
                this.children.splice(i, 1);
            }
        }
    }

    private createButton(): Button {
        const button = new Button();
        for (let child of button.getNodeChildren()) {
            if (child instanceof Label) {
                child.setValueSilent("horizAlign", new BrsString("left"));
                break;
            }
        }
        super.appendChildToParent(button);
        return button;
    }

    private refreshFocus() {
        if (!this.isManagedMode()) {
            return;
        }
        const focusedNode = sgRoot.focused;
        if (this.children.length && focusedNode === this) {
            // Per Roku: when the ButtonGroup itself has focus, key focus goes to one of its buttons.
            const focusedButton = this.children[this.focusIndex];
            if (focusedButton instanceof RoSGNode) {
                sgRoot.setFocused(focusedButton);
            }
            this.wasFocused = true;
        } else if (
            focusedNode instanceof Button &&
            focusedNode.getNodeParent() === this &&
            this.children.includes(focusedNode)
        ) {
            // A managed button was focused directly (e.g. by app code): follow it instead of
            // stealing focus back to the previously focused index.
            const index = this.children.indexOf(focusedNode);
            if (index !== this.focusIndex) {
                this.focusIndex = index;
                super.setValue("buttonFocused", new Int32(index));
                this.isDirty = true;
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
