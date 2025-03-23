// Poster  -  BackGround
// 597x597 (fhd)
// Width 700 (hd) 1050 (fhd)
// Height 203 (variable) 440 (fhd rokanban)
// Translation 290, 258.5 (hd) 435, 320 (fhd)

// Poster - Icon
//    blend color -572662273
//    "/RokuOS/Artwork/SceneGraph/GenevaTheme/Base/HD/icon_dialog_info.webp" 40x40 (hd) 60x60 (fhd)
//    translation 492, 283 (hd) 788, 352 (fhd)
// Label - Title
//    horizAlign = center
//    vertAlign = top
//    translation 366, 288.5 (hd) 549, 365
//    font size 28 (hd) 42 (fhd)
//    width = 548 (hd) 822 (fhd)
// Poster - Divider
//    "/RokuOS/Artwork/SceneGraph/GenevaTheme/Base/HD/dividerHorizontal.9.png" 4x98 (hd) 6x147 (fhd)
//    translation 366, 327.5 (hd) 549, 422
//    width = 548 (hd) 822 (fhd)

// Label - message
//    color = -16843009
//    font size 24 (hd) 34 (fhd)
//    translation 349, 362.5 (hd) 523,474 (fhd)
//    width 582 (hd) 874 (fhd)
// ScrollableText - ???
//    "/RokuOS/Artwork/SceneGraph/GenevaTheme/Base/HD/scrollBarTrack.9.png"
//    "/RokuOS/Artwork/SceneGraph/GenevaTheme/Base/HD/scrollBarHandle_off.9.png"
//    "/RokuOS/Artwork/SceneGraph/GenevaTheme/Base/HD/scrollBarHandle_icon.webp"

// BulletText - Bulleted Text list
// Same translation left from message, same font size, same spacing between buttons
//     Label (0) - width 845 (fhd) translation 29, 0 (fhd)
//     Label (1) - "•" width 0 translation 0,0
//     Label (2) - width 845 (fhd) translation 29, 48 (fhd)
//     Label (3) - "•" width 0 translation 0,48
//     Label (4) - width 845 (fhd) translation 29, 96 (fhd)
//     Label (5) - "•" width 0 translation 0,96

// Poster - ???

// Label - ???
// ButtonGroup - Buttons
//     Maxwidth and MinWidth = 600 (HD) 900 (FHD)
//     Font size 36 (fhd)
//     translation fhd 510, 559
//     layoutDirection vert
// Label - ???

// Dialog translation = 0,0
// Dialog width HD 700 / FHD 1050
import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { Environment, Interpreter } from "../..";
import { rotateTranslation } from "../../scenegraph/SGUtil";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ButtonGroup,
    Float,
    Font,
    jsValueOf,
    Label,
    Poster,
    RoArray,
    rootObjects,
    RoSGNode,
    ValueKind,
} from "..";

export class Dialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string" },
        { name: "titleColor", type: "color", value: "0xddddddff" },
        { name: "titleFont", type: "font" },
        { name: "message", type: "string" },
        { name: "messageColor", type: "color", value: "0xddddddff" },
        { name: "messageFont", type: "font" },
        { name: "numberedBullets", type: "boolean", value: "false" },
        { name: "bulletText", type: "array" },
        { name: "bulletTextColor", type: "color", value: "0xddddddff" },
        { name: "bulletTextFont", type: "font" },
        { name: "buttons", type: "array" },
        { name: "buttonGroup", type: "node" },
        { name: "graphicUri", type: "uri", value: "" },
        { name: "graphicWidth", type: "float", value: "0.0" },
        { name: "graphicHeight", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0" },
        { name: "buttonFocused", type: "integer", value: "0" },
        { name: "focusButton", type: "integer", value: "0" },
        { name: "optionsDialog", type: "boolean", value: "false" },
        { name: "backgroundUri", type: "uri", value: "" },
        { name: "iconUri", type: "uri", value: "" },
        { name: "dividerUri", type: "uri", value: "" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean", value: "false" },
        { name: "width", type: "float", value: "-1.0" },
        { name: "maxHeight", type: "float", value: "-1.0" },
    ];

    private readonly background: Poster;
    private readonly icon: Poster;
    private readonly divider: Poster;
    private readonly title: Label;
    private readonly message: Label;
    private readonly gap: number;
    private readonly vertOffset: number;
    private readonly resolution: string;
    private readonly screenRect: Rect;
    private readonly minHeight: number;
    private readonly buttonGroup: ButtonGroup;
    private lastFocus?: RoSGNode;
    private width: number;
    private height: number;
    private dialogTrans: number[];
    private iconSize: number;
    private iconTrans: number[];

    protected readonly backUri = "common:/images/dialog_background.9.png";
    protected readonly iconUriHD = "common:/images/icon_dialog_info_HD.png";
    protected readonly iconUriFHD = "common:/images/icon_dialog_info_FHD.png";
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected focusIndex: number = 0;
    protected hasButtons: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Dialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.buttonGroup = new ButtonGroup();
        this.resolution = rootObjects.rootScene?.ui.resolution ?? "HD";
        if (this.resolution === "FHD") {
            this.screenRect = { x: 0, y: 0, width: 1920, height: 1080 };
            this.width = 1050;
            this.minHeight = 216;
            this.gap = 18;
            this.vertOffset = 89;
            this.dialogTrans = [435, 432];
            this.iconSize = 60;
            this.iconTrans = [882, 469];
            this.background = this.addPoster(
                this.backUri,
                this.dialogTrans,
                this.width,
                this.minHeight
            );
            this.icon = this.addPoster(
                this.iconUriFHD,
                this.iconTrans,
                this.iconSize,
                this.iconSize
            );
            this.title = this.addLabel("titleColor", [549, 477], 822, 46, 42, "top", "center");
            this.divider = this.addPoster(this.dividerUri, [549, 535.5], 822, 6);
            this.message = this.addLabel("messageColor", [523, 588], 873, 38, 34);
            this.setFieldValue("iconUri", new BrsString(this.iconUriFHD));
            this.buttonGroup.setFieldValue("minWidth", new Float(900));
            this.buttonGroup.setFieldValue("maxWidth", new Float(900));
        } else {
            this.screenRect = { x: 0, y: 0, width: 1280, height: 720 };
            this.width = 700;
            this.minHeight = 144;
            this.gap = 12;
            this.vertOffset = 59;
            this.dialogTrans = [290, 288];
            this.iconSize = 40;
            this.iconTrans = [588, 313];
            this.background = this.addPoster(
                this.backUri,
                this.dialogTrans,
                this.width,
                this.minHeight
            );
            this.icon = this.addPoster(
                this.iconUriHD,
                this.iconTrans,
                this.iconSize,
                this.iconSize
            );
            this.title = this.addLabel("titleColor", [366, 318], 548, 30, 28, "top", "center");
            this.divider = this.addPoster(this.dividerUri, [366, 357], 548, 4);
            this.message = this.addLabel("messageColor", [349, 392], 582, 26, 24);
            this.setFieldValue("iconUri", new BrsString(this.iconUriHD));
            this.buttonGroup.setFieldValue("minWidth", new Float(600));
            this.buttonGroup.setFieldValue("maxWidth", new Float(600));
        }
        this.height = this.minHeight;
        this.setFieldValue("width", new Float(this.width));
        this.setFieldValue("backgroundUri", new BrsString(this.backUri));
        this.setFieldValue("dividerUri", new BrsString(this.dividerUri));
        this.setFieldValue("buttonGroup", this.buttonGroup);
        this.linkField(this.buttonGroup, "buttons");
        this.linkField(this.buttonGroup, "buttonSelected");
        this.linkField(this.buttonGroup, "buttonFocused");
        this.linkField(this.buttonGroup, "focusButton");
        this.children.push(this.buttonGroup);
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
        } else if (fieldName === "close") {
            index = new BrsString("wasClosed");
            value = BrsBoolean.True;
            rootObjects.dialog = undefined;
            if (this.lastFocus) {
                rootObjects.focused = this.lastFocus;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setNodeFocus(_: Interpreter, focusOn: boolean): boolean {
        if (focusOn && this.hasButtons && rootObjects.focused && this.lastFocus === undefined) {
            this.lastFocus = rootObjects.focused;
            rootObjects.focused = this.buttonGroup;
        }
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        const optionsDialog = this.getFieldValue("optionsDialog") as BrsBoolean;
        if (press && (key === "back" || (key === "options" && optionsDialog.toBoolean()))) {
            this.set(new BrsString("close"), BrsBoolean.True);
        } else if (this.hasButtons) {
            this.buttonGroup.handleKey(key, press);
        }
        return true;
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
        this.updateChildren();
        if (this.hasButtons) {
            this.setNodeFocus(interpreter, true);
        }
        draw2D?.doDrawRotatedRect(this.screenRect, 255, 0, [0, 0], 0.5);
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, draw2D);
        this.updateParentRects(origin, angle);
    }

    protected addPoster(
        defaultUri: string,
        translation: number[],
        width?: number,
        height?: number
    ) {
        const poster = new Poster();
        if (defaultUri) {
            poster.set(new BrsString("uri"), new BrsString(defaultUri));
        }
        poster.set(new BrsString("translation"), brsValueOf(translation));
        if (height) {
            poster.set(new BrsString("height"), new Float(height));
        }
        if (width) {
            poster.set(new BrsString("width"), new Float(width));
        }
        this.children.push(poster);
        poster.setNodeParent(this);
        return poster;
    }

    protected addLabel(
        colorField: string,
        translation: number[],
        width: number,
        height: number,
        fontSize: number,
        vertAlign?: string,
        horizAlign?: string
    ) {
        const label = new Label();
        const labelFields = label.getNodeFields();
        const color = this.fields.get(colorField.toLowerCase());
        if (color) {
            labelFields.set("color", color);
        }
        const labelFont = labelFields.get("font")?.getValue();
        if (labelFont && labelFont instanceof Font) {
            labelFont.setSize(fontSize);
        }
        label.set(new BrsString("width"), new Float(width));
        label.set(new BrsString("height"), new Float(height));
        label.set(
            new BrsString("translation"),
            new RoArray([new Float(translation[0]), new Float(translation[1])])
        );
        if (vertAlign) {
            label.set(new BrsString("vertalign"), new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.set(new BrsString("horizalign"), new BrsString(horizAlign));
        }
        this.children.push(label);
        label.setNodeParent(this);
        return label;
    }

    private updateChildren() {
        this.height = this.minHeight;
        const width = this.getFieldValue("width");
        if (width instanceof Float && width.getValue() > 0) {
            this.background.set(new BrsString("width"), width);
            this.width = width.getValue();
        }
        this.copyField(this.background, "uri", "backgroundUri");
        this.copyField(this.title, "text", "title");
        this.copyField(this.title, "color", "titleColor");
        this.copyField(this.title, "font", "titleFont");
        const iconUri = this.copyField(this.icon, "uri", "iconUri");
        if (iconUri instanceof BrsString && iconUri.value) {
            const measured = this.title.getMeasured();
            if (measured.width > 0) {
                const centerX = (this.screenRect.width - measured.width) / 2;
                this.iconTrans[0] = centerX - this.iconSize - this.gap;
                const newTrans = [new Float(this.iconTrans[0]), new Float(this.iconTrans[1])];
                this.icon.set(new BrsString("translation"), new RoArray(newTrans));
            }
        }
        this.copyField(this.divider, "uri", "dividerUri");
        const message = this.copyField(this.message, "text", "message");
        if (message.toString() !== "") {
            this.height += this.vertOffset;
        }
        this.copyField(this.message, "color", "messageColor");
        this.copyField(this.message, "font", "messageFont");

        const buttons = jsValueOf(this.getFieldValue("buttons")) as string[];
        if (buttons?.length) {
            const buttonHeight = this.buttonGroup.getFieldValue("buttonHeight") as Float;
            const buttonsHeight = buttonHeight.getValue() * buttons.length;
            this.height += this.vertOffset;
            const msgTrans = this.message.getFieldValue("translation") as RoArray;
            const buttonsTrans = [
                msgTrans.elements[0],
                new Float(this.dialogTrans[1] + this.height - buttonsHeight),
            ];
            this.buttonGroup.setFieldValue("translation", new RoArray(buttonsTrans));
            this.hasButtons = true;
        } else {
            this.hasButtons = false;
        }

        this.background.set(new BrsString("height"), new Float(this.height));
        this.isDirty = false;
    }
}
