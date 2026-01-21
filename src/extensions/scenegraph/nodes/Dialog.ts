import { AAMember, Interpreter, BrsBoolean, BrsString, BrsType, Float, isBrsString, IfDraw2D, Rect } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { rotateTranslation } from "../SGUtil";
import { jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { ButtonGroup } from "./ButtonGroup";
import { Label } from "./Label";
import { Poster } from "./Poster";
import { RoSGNode } from "../components/RoSGNode";

export class Dialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string" },
        { name: "titleColor", type: "color", value: "0xddddddff" },
        { name: "titleFont", type: "font" },
        { name: "message", type: "string" },
        { name: "messageColor", type: "color", value: "0xddddddff" },
        { name: "messageFont", type: "font" },
        { name: "numberedBullets", type: "boolean", value: "false" },
        { name: "bulletText", type: "stringarray", value: "[]" },
        { name: "bulletTextColor", type: "color", value: "0xddddddff" },
        { name: "bulletTextFont", type: "font" },
        { name: "buttons", type: "stringarray", value: "[]" },
        { name: "buttonGroup", type: "node" },
        { name: "graphicUri", type: "uri", value: "" },
        { name: "graphicWidth", type: "float", value: "0.0" },
        { name: "graphicHeight", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "focusButton", type: "integer", value: "0" },
        { name: "optionsDialog", type: "boolean", value: "false" },
        { name: "backgroundUri", type: "uri", value: "" },
        { name: "iconUri", type: "uri", value: "" },
        { name: "dividerUri", type: "uri", value: "" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean", value: "false", alwaysNotify: true },
        { name: "width", type: "float", value: "-1.0" },
        { name: "maxHeight", type: "float", value: "-1.0" },
    ];

    protected readonly background: Poster;
    protected readonly icon: Poster;
    protected readonly divider: Poster;
    protected readonly title: Label;
    protected readonly message: Label;
    protected readonly gap: number;
    protected readonly vertOffset: number;
    protected readonly minHeight: number;
    protected readonly buttonGroup: ButtonGroup;
    protected readonly lineHeight: number;
    protected lastFocus?: RoSGNode;
    protected width: number;
    protected height: number;
    protected dialogTrans: number[];
    protected iconSize: number;
    protected iconTrans: number[];

    protected readonly backUri = "common:/images/dialog_background.9.png";
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected focusIndex: number = 0;
    protected hasButtons: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Dialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        let titleWidth: number;
        let titleHeight: number;
        let titleX: number;
        let titleY: number;
        let titleSize: number;
        let dividerY: number;
        let msgWidth: number;
        let msgX: number;
        let msgY: number;
        let msgSize: number;

        this.buttonGroup = new ButtonGroup();
        const iconUri = `common:/images/${this.resolution}/icon_dialog_info.png`;

        if (this.resolution === "FHD") {
            this.width = 1050;
            this.minHeight = 216;
            this.gap = 18;
            this.vertOffset = 30;
            this.lineHeight = 4.5;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.minHeight) / 2];
            this.iconSize = 60;
            this.iconTrans = [this.dialogTrans[0] + 447, this.dialogTrans[1] + 36];
            titleWidth = this.width - 228;
            titleHeight = 46;
            titleSize = 42;
            titleX = (this.sceneRect.width - titleWidth) / 2;
            titleY = this.dialogTrans[1] + 45;
            dividerY = this.dialogTrans[1] + 105;
            msgWidth = this.width - 177;
            msgX = (this.sceneRect.width - msgWidth) / 2;
            msgY = titleY + 111;
            msgSize = 34;
            this.buttonGroup.setValueSilent("minWidth", new Float(900));
            this.buttonGroup.setValueSilent("maxWidth", new Float(900));
        } else {
            this.width = 700;
            this.minHeight = 144;
            this.gap = 12;
            this.vertOffset = 20;
            this.lineHeight = 3;
            this.dialogTrans = [(this.sceneRect.width - this.width) / 2, (this.sceneRect.height - this.minHeight) / 2];
            this.iconSize = 40;
            this.iconTrans = [this.dialogTrans[0] + 298, this.dialogTrans[1] + 24];
            titleWidth = this.width - 152;
            titleHeight = 30;
            titleSize = 28;
            titleX = (this.sceneRect.width - titleWidth) / 2;
            titleY = this.dialogTrans[1] + 30;
            dividerY = this.dialogTrans[1] + 70;
            msgWidth = this.width - 118;
            msgX = (this.sceneRect.width - msgWidth) / 2;
            msgY = titleY + 74;
            msgSize = 24;
            this.buttonGroup.setValueSilent("minWidth", new Float(600));
            this.buttonGroup.setValueSilent("maxWidth", new Float(600));
        }
        this.height = this.minHeight;
        this.setValueSilent("iconUri", new BrsString(iconUri));
        this.background = this.addPoster(this.backUri, this.dialogTrans, this.width, this.height);
        this.title = this.addLabel("titleColor", [titleX, titleY], titleWidth, titleHeight, titleSize, "top", "center");
        this.icon = this.addPoster(iconUri, this.iconTrans, this.iconSize, this.iconSize);
        this.divider = this.addPoster(this.dividerUri, [titleX, dividerY], titleWidth, this.lineHeight);
        this.message = this.addLabel("messageColor", [msgX, msgY], msgWidth, 0, msgSize, "top", "left", true);
        this.setValueSilent("width", new Float(this.width));
        this.setValueSilent("backgroundUri", new BrsString(this.backUri));
        this.setValueSilent("dividerUri", new BrsString(this.dividerUri));
        this.setValueSilent("buttonGroup", this.buttonGroup);
        this.linkField(this.buttonGroup, "buttons");
        this.linkField(this.buttonGroup, "buttonSelected");
        this.linkField(this.buttonGroup, "buttonFocused");
        this.linkField(this.buttonGroup, "focusButton");
        this.appendChildToParent(this.buttonGroup);
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
        } else if (fieldName === "close") {
            index = "wasClosed";
            value = BrsBoolean.True;
            this.setValue("visible", BrsBoolean.False);
            if (sgRoot.scene?.dialog === this) {
                sgRoot.scene.dialog = undefined;
            }
            if (this.lastFocus instanceof Group) {
                sgRoot.setFocused(this.lastFocus);
                this.lastFocus.isDirty = true;
                this.lastFocus = undefined;
            }
        } else if (fieldName === "buttons") {
            this.buttonGroup.setValue(index, value);
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setNodeFocus(focusOn: boolean): boolean {
        if (focusOn && this.hasButtons && sgRoot.focused && this.lastFocus === undefined) {
            this.lastFocus = sgRoot.focused;
            sgRoot.setFocused(this.buttonGroup);
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
        } else if (this.hasButtons) {
            handled = this.buttonGroup.handleKey(key, press);
        }
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
        if (this.isDirty) {
            this.updateChildren();
        }
        this.setNodeFocus(true);
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
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
