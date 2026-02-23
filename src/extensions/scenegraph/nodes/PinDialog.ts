import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, Float, BrsString, BrsBoolean, BrsDevice, isBrsString } from "brs-engine";
import { Dialog } from "./Dialog";
import { PinPad } from "./PinPad";
import { Label } from "./Label";
import { sgRoot } from "../SGRoot";

export class PinDialog extends Dialog {
    readonly defaultFields: FieldModel[] = [
        { name: "pin", type: "string", value: "" },
        { name: "pinPad", type: "node" },
        { name: "privacyHintColor", type: "color", value: "0xddddddff" },
        { name: "pinPadFocused", type: "boolean", value: "true" },
    ];

    protected readonly minHeight: number;
    private readonly pinPadNode: PinPad;
    private readonly privacyHint: Label;
    private readonly pinPadY: number;
    private readonly privacyHintHeight: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PinDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Dialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.pinPadNode = new PinPad();
        this.setValueSilent("pinPad", this.pinPadNode);

        let contentWidth: number;
        let contentX: number;
        let titleTrans: number[];
        let dividerTrans: number[];
        let msgTrans: number[];
        let pinPadTrans: number[];
        let privacyHintTrans: number[];
        let privacyHintSize: number;
        let privacyHintWidth: number;

        if (this.resolution === "FHD") {
            this.width = 990;
            contentWidth = this.width - 177;
            contentX = (this.sceneRect.width - contentWidth) / 2;
            this.pinPadY = 219;
            this.privacyHintHeight = 36;
            // pinPad FHD dimensions: 408w x 450h (378 img + 72 pinDisplay)
            const pinPadWidth = 408;
            const pinPadX = (this.sceneRect.width - pinPadWidth) / 2;
            const pinPadHeight = 450;
            this.minHeight = this.pinPadY + pinPadHeight + this.privacyHintHeight;
            this.height = this.minHeight;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.height) / 2];
            titleTrans = [contentX, this.dialogTrans[1] + 45];
            dividerTrans = [contentX, this.dialogTrans[1] + 105];
            msgTrans = [contentX, titleTrans[1] + 111];
            pinPadTrans = [pinPadX, this.dialogTrans[1] + this.pinPadY];
            privacyHintWidth = this.width - 177;
            privacyHintTrans = [contentX, this.dialogTrans[1] + this.pinPadY + pinPadHeight];
            privacyHintSize = 27;
        } else {
            this.width = 660;
            contentWidth = this.width - 118;
            contentX = (this.sceneRect.width - contentWidth) / 2;
            this.pinPadY = 146;
            this.privacyHintHeight = 24;
            // pinPad HD dimensions: 272w x 300h (252 img + 48 pinDisplay)
            const pinPadWidth = 272;
            const pinPadX = (this.sceneRect.width - pinPadWidth) / 2;
            const pinPadHeight = 300;
            this.minHeight = this.pinPadY + pinPadHeight + this.privacyHintHeight;
            this.height = this.minHeight;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.height) / 2];
            titleTrans = [contentX, this.dialogTrans[1] + 30];
            dividerTrans = [contentX, this.dialogTrans[1] + 70];
            msgTrans = [contentX, titleTrans[1] + 74];
            pinPadTrans = [pinPadX, this.dialogTrans[1] + this.pinPadY];
            privacyHintWidth = contentWidth;
            privacyHintTrans = [contentX, this.dialogTrans[1] + this.pinPadY + pinPadHeight];
            privacyHintSize = 18;
        }

        // Reposition elements that Dialog base class created using its own dimensions
        this.background.setValueSilent("width", new Float(this.width));
        this.background.setValueSilent("height", new Float(this.minHeight));
        this.background.setTranslation(this.dialogTrans);
        this.title.setValueSilent("width", new Float(contentWidth));
        this.divider.setValueSilent("width", new Float(contentWidth));
        this.title.setTranslation(titleTrans);
        this.divider.setTranslation(dividerTrans);
        this.message.setTranslation(msgTrans);
        this.message.setValueSilent("width", new Float(contentWidth));

        // Privacy hint label (bottom of dialog)
        this.privacyHint = this.addLabel(
            "privacyHintColor",
            privacyHintTrans,
            privacyHintWidth,
            this.privacyHintHeight,
            privacyHintSize,
            "top",
            "center"
        );
        this.privacyHint.setValueSilent(
            "text",
            new BrsString(BrsDevice.getTerm("(press * to hide/show highlight in keypad)"))
        );

        this.pinPadNode.setTranslation(pinPadTrans);
        this.appendChildToParent(this.pinPadNode);

        this.buttonGroup.setValueSilent("minWidth", new Float(contentWidth));
        this.buttonGroup.setValueSilent("maxWidth", new Float(contentWidth));
        this.setValueSilent("width", new Float(this.width));
        this.setValueSilent("iconUri", new BrsString(""));
        this.icon.setValueSilent("visible", BrsBoolean.False);

        // Link the pin field bidirectionally with the PinPad
        this.linkField(this.pinPadNode, "pin");
    }

    setNodeFocus(focusOn: boolean): boolean {
        if (focusOn && sgRoot.focused && this.lastFocus === undefined) {
            this.lastFocus = sgRoot.focused;
            const pinPadFocused = this.getValueJS("pinPadFocused") as boolean;
            sgRoot.setFocused(pinPadFocused || !this.hasButtons ? this.pinPadNode : this.buttonGroup);
            this.isDirty = true;
        }
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        const optionsDialog = this.getValueJS("optionsDialog") as boolean;
        let handled = false;
        if (press && (key === "back" || (key === "options" && optionsDialog))) {
            this.setValue("close", BrsBoolean.True);
            handled = true;
        } else if (press && key === "options") {
            // Toggle PinPad focus visibility (privacy feature)
            const focusVisible = !((this.pinPadNode.getValueJS("focusVisible") as boolean) ?? true);
            this.pinPadNode.setValue("focusVisible", BrsBoolean.from(focusVisible));
            handled = true;
        } else if (sgRoot.focused === this.pinPadNode) {
            handled = this.pinPadNode.handleKey(key, press);
            if (!handled && press && key === "down" && this.hasButtons) {
                sgRoot.setFocused(this.buttonGroup);
                this.isDirty = true;
                handled = true;
            }
        } else if (sgRoot.focused === this.buttonGroup) {
            handled = this.buttonGroup.handleKey(key, press);
            if (!handled && press && key === "up") {
                sgRoot.setFocused(this.pinPadNode);
                this.isDirty = true;
                handled = true;
            }
        }
        return handled;
    }

    protected updateChildren() {
        this.height = this.minHeight;
        const width = this.getValueJS("width") as number;
        if (width) {
            this.background.setValue("width", new Float(width));
            this.width = width;
        }
        this.copyField(this.background, "uri", "backgroundUri");
        this.copyField(this.title, "text", "title");
        this.copyField(this.title, "color", "titleColor");
        this.copyField(this.title, "font", "titleFont");
        const iconUri = this.copyField(this.icon, "uri", "iconUri").toString();
        if (iconUri) {
            const measured = this.title.getMeasured();
            if (measured.width > 0) {
                const centerX = (this.sceneRect.width - measured.width) / 2;
                this.iconTrans[0] = centerX - this.iconSize - this.gap;
            }
        }
        this.copyField(this.divider, "uri", "dividerUri");
        const message = this.copyField(this.message, "text", "message");
        if (isBrsString(message) && message.getValue() !== "") {
            const measured = this.message.getMeasured();
            this.height += measured.height + this.vertOffset;
            this.pinPadNode.setTranslationY(this.dialogTrans[1] + this.pinPadY);
        } else {
            this.height += this.vertOffset;
            this.pinPadNode.setTranslationY(this.dialogTrans[1] + this.pinPadY - this.vertOffset);
        }
        this.copyField(this.message, "color", "messageColor");
        this.copyField(this.message, "font", "messageFont");

        // Sync pin field
        const pin = this.getValueJS("pin") as string;
        if (pin !== undefined) {
            this.pinPadNode.setValueSilent("pin", new BrsString(pin));
        }

        // Update privacy hint color
        this.copyField(this.privacyHint, "color", "privacyHintColor");

        const buttons = this.getValueJS("buttons") as string[];
        const buttonHeight = this.buttonGroup.getValueJS("buttonHeight") as number;
        if (buttons?.length) {
            this.height += buttonHeight * buttons.length;
            this.hasButtons = true;
        } else {
            this.height += this.vertOffset;
            this.hasButtons = false;
        }

        // Set new Dialog height and reposition elements
        const newY = (this.sceneRect.height - this.height) / 2;
        const offsetY = newY - this.dialogTrans[1];
        this.dialogTrans[1] = newY;
        this.background.setTranslation(this.dialogTrans);
        this.background.setValue("height", new Float(this.height));
        if (iconUri) {
            this.iconTrans[1] += offsetY;
            this.icon.setTranslation(this.iconTrans);
        }
        this.title.setTranslationOffset(0, offsetY);
        this.divider.setTranslationOffset(0, offsetY);
        this.message.setTranslationOffset(0, offsetY);
        this.pinPadNode.setTranslationOffset(0, offsetY);
        this.privacyHint.setTranslationOffset(0, offsetY);
        if (this.hasButtons) {
            const msgTrans = this.message.getValueJS("translation") as number[];
            const buttonsTrans = [
                msgTrans[0],
                this.dialogTrans[1] + this.height - buttonHeight * buttons.length - this.vertOffset,
            ];
            this.buttonGroup.setTranslation(buttonsTrans);
        }
    }
}
