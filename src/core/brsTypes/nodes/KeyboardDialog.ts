import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Dialog } from "./Dialog";
import { Keyboard, BrsBoolean, BrsString, Float, isBrsString, sgRoot } from "..";
import { Interpreter } from "../../interpreter";

export class KeyboardDialog extends Dialog {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "keyboard", type: "node" },
    ];

    protected readonly minHeight: number;
    private readonly keyboard: Keyboard;
    private readonly keyboardY: number;
    private focus: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "KeyboardDialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.keyboard = new Keyboard();
        this.setValueSilent("keyboard", this.keyboard);

        let contentWidth: number;
        let contentX: number;
        let titleTrans: number[];
        let dividerTrans: number[];
        let msgTrans: number[];
        let keyboardTrans: number[];
        if (this.resolution === "FHD") {
            this.width = 1530;
            this.minHeight = 645;
            this.height = this.minHeight;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.height) / 2];
            contentWidth = this.width - 177;
            contentX = (this.sceneRect.width - contentWidth) / 2;
            titleTrans = [contentX, this.dialogTrans[1] + 45];
            dividerTrans = [contentX, this.dialogTrans[1] + 105];
            msgTrans = [contentX, titleTrans[1] + 111];
            this.keyboardY = 219;
            keyboardTrans = [264, this.dialogTrans[1] + this.keyboardY];
        } else {
            this.width = 1020;
            this.minHeight = 430;
            this.height = this.minHeight;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.height) / 2];
            contentWidth = this.width - 118;
            contentX = (this.sceneRect.width - contentWidth) / 2;
            titleTrans = [contentX, this.dialogTrans[1] + 30];
            dividerTrans = [contentX, this.dialogTrans[1] + 70];
            msgTrans = [contentX, titleTrans[1] + 74];
            this.keyboardY = 146;
            keyboardTrans = [177, this.dialogTrans[1] + this.keyboardY];
        }
        this.background.setValueSilent("width", new Float(this.width));
        this.background.setValueSilent("height", new Float(this.minHeight));
        this.background.setTranslation(this.dialogTrans);
        this.title.setValueSilent("width", new Float(contentWidth));
        this.divider.setValueSilent("width", new Float(contentWidth));
        this.title.setTranslation(titleTrans);
        this.divider.setTranslation(dividerTrans);
        this.message.setTranslation(msgTrans);
        this.message.setValueSilent("width", new Float(contentWidth));
        this.keyboard.setTranslation(keyboardTrans);
        this.appendChildToParent(this.keyboard);
        this.buttonGroup.setValueSilent("minWidth", new Float(contentWidth));
        this.buttonGroup.setValueSilent("maxWidth", new Float(contentWidth));
        this.setValueSilent("width", new Float(this.width));
        this.setValueSilent("iconUri", new BrsString(""));
        this.linkField(this.keyboard, "text");
        this.icon.setValueSilent("visible", BrsBoolean.False);
        this.focus = "";
    }

    setNodeFocus(_: Interpreter, focusOn: boolean): boolean {
        if (focusOn && sgRoot.focused && this.lastFocus === undefined) {
            this.lastFocus = sgRoot.focused;
            sgRoot.setFocused(this.hasButtons ? this.buttonGroup : this.keyboard);
            this.isDirty = true;
        }
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        const optionsDialog = this.getValueJS("optionsDialog") as boolean;
        let handled = false;
        if (press && (key === "back" || (key === "options" && optionsDialog))) {
            this.setValue("close", BrsBoolean.True);
            this.focus = "";
            this.keyboard.textEditBox.setActive(false);
            this.keyboard.textEditBox.moveCursor(0);
            handled = true;
        } else if (this.hasButtons && this.focus === "buttons") {
            handled = this.buttonGroup.handleKey(key, press);
        } else if (this.focus === "keyboard") {
            handled = this.keyboard.handleKey(key, press);
        }
        if (handled) {
            return true;
        }
        if (press && key === "up" && this.focus === "buttons") {
            sgRoot.setFocused(this.keyboard);
            this.focus = "keyboard";
            this.isDirty = true;
            handled = true;
        } else if (press && key === "down" && this.focus === "keyboard") {
            sgRoot.setFocused(this.buttonGroup);
            this.focus = "buttons";
            this.isDirty = true;
            handled = true;
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
            this.keyboard.setTranslationY(this.dialogTrans[1] + this.keyboardY);
        } else {
            this.height += this.vertOffset;
            this.keyboard.setTranslationY(this.dialogTrans[1] + this.keyboardY - this.vertOffset);
        }
        this.copyField(this.message, "color", "messageColor");
        this.copyField(this.message, "font", "messageFont");

        const buttons = this.getValueJS("buttons") as string[];
        const buttonHeight = this.buttonGroup.getValueJS("buttonHeight") as number;
        if (buttons?.length) {
            this.height += buttonHeight * buttons.length;
            this.hasButtons = true;
        } else {
            this.height += this.vertOffset;
            this.hasButtons = false;
        }
        if (this.focus === "") {
            this.focus = this.hasButtons ? "buttons" : "keyboard";
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
        this.keyboard.setTranslationOffset(0, offsetY);
        if (this.hasButtons) {
            const msgTrans = this.message.getValueJS("translation") as number[];
            const buttonsTrans = [
                msgTrans[0],
                this.dialogTrans[1] + this.height - buttonHeight * buttons.length - this.vertOffset,
            ];
            this.buttonGroup.setTranslation(buttonsTrans);
        }
        this.isDirty = false;
    }
}
