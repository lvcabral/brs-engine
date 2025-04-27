import { FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { Float, getTextureManager, RoBitmap, Label, Font, BrsString, RoFont } from "..";
import { BrsBoolean } from "../BrsType";

export class TextEditBox extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "hintText", type: "string", value: "" },
        { name: "maxTextLength", type: "integer", value: "15" },
        { name: "cursorPosition", type: "integer", value: "0" },
        { name: "clearOnDownKey", type: "boolean", value: "true" },
        { name: "active", type: "boolean", value: "false" },
        { name: "secureMode", type: "boolean", value: "false" },
        { name: "textColor", type: "color", value: "0xFFFFFFFF" },
        { name: "hintTextColor", type: "color", value: "0xAAAAAAFF" },
        { name: "width", type: "float", value: "-1.0" },
        { name: "backgroundUri", type: "string", value: "" },
        { name: "leadingEllipsis", type: "boolean", value: "false" },
        { name: "focusable", type: "boolean", value: "true" },
    ];

    private background?: RoBitmap;
    private cursor?: RoBitmap;
    private drawFont?: RoFont;
    private textLabel: Label;
    private hintLabel: Label;
    private height: number;
    private paddingX: number;
    private paddingY: number;
    private cursorVisible: boolean = true;
    private lastCursorToggleTime: number = 0;
    private readonly cursorBlinkInterval = 500; // milliseconds

    private readonly backUri = "common:/images/inputField.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "TextEditBox") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.background = getTextureManager().loadTexture(
            this.getFieldValueJS("backgroundUri") || this.backUri
        );

        if (this.resolution === "FHD") {
            this.height = 72;
            this.paddingX = 18;
            this.paddingY = 18; // Approximate vertical centering
        } else {
            this.height = 48;
            this.paddingX = 12;
            this.paddingY = 12; // Approximate vertical centering
        }
        const cursorUri = `common:/images/cursor_textInput_${this.resolution}.png`;
        this.cursor = getTextureManager().loadTexture(cursorUri);
        this.setFieldValue("height", new Float(this.height));

        // Create Labels for text and hint
        this.textLabel = new Label();
        this.hintLabel = new Label();

        // Configure and add labels as children
        this.configureLabels();
        this.appendChildToParent(this.textLabel);
        this.appendChildToParent(this.hintLabel);

        // Link fields
        this.linkField(this.textLabel, "text");
        this.linkField(this.textLabel, "color", "textColor");
        this.linkField(this.hintLabel, "text", "hintText");
        this.linkField(this.hintLabel, "color", "hintTextColor");

        this.lastCursorToggleTime = Date.now();
    }

    private configureLabels() {
        const width = this.getFieldValueJS("width") as number;
        const labelWidth = width > 0 ? width - this.paddingX * 2 : 0;

        this.textLabel.setTranslation([this.paddingX, this.paddingY]);
        this.textLabel.setFieldValue("width", new Float(labelWidth));
        this.textLabel.setFieldValue("height", new Float(this.height - this.paddingY * 2));
        this.textLabel.setFieldValue("vertAlign", new BrsString("center"));

        this.hintLabel.setTranslation([this.paddingX, this.paddingY]);
        this.hintLabel.setFieldValue("width", new Float(labelWidth));
        this.hintLabel.setFieldValue("height", new Float(this.height - this.paddingY * 2));
        this.hintLabel.setFieldValue("vertAlign", new BrsString("center"));
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (!press) {
            return handled;
        }
        if (key.startsWith("Lit_")) {
            let text = this.getFieldValueJS("text") as string;
            let position = this.getFieldValueJS("cursorPosition") as number;
            if (position === 0) {
                text = key.substring(4) + text;
            } else {
                text = text.slice(0, position) + key.substring(4) + text.slice(position);
            }
            position++;
            this.set(new BrsString("text"), new BrsString(text));
            this.set(new BrsString("cursorPosition"), new Float(position));
            handled = true;
        } else if (key === "replay") {
            let text = this.getFieldValueJS("text") as string;
            let position = this.getFieldValueJS("cursorPosition") as number;
            if (text.length && position > 0) {
                text = text.slice(0, position - 1) + text.slice(position);
                position--;
                this.set(new BrsString("text"), new BrsString(text));
                this.set(new BrsString("cursorPosition"), new Float(position));
                handled = true;
            }
        }
        return handled;
    }

    renderNode(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const combinedOpacity = opacity * this.getOpacity();
        const isActive = this.getFieldValueJS("active") as boolean;
        const text = this.getFieldValueJS("text") as string;

        // Ensure labels have correct width if TextEditBox width changes
        if (this.isDirty) {
            const width = this.getFieldValueJS("width") as number;
            const labelWidth = width > 0 ? width - this.paddingX * 2 : 0;
            this.textLabel.setFieldValue("width", new Float(labelWidth));
            this.hintLabel.setFieldValue("width", new Float(labelWidth));
            this.drawFont = undefined;
            // Background Image
            const backgroundUri = this.getFieldValueJS("backgroundUri") as string;
            if (backgroundUri && this.background?.getImageName() !== backgroundUri) {
                this.background = getTextureManager().loadTexture(backgroundUri);
            } else if (this.background?.getImageName() !== this.backUri) {
                this.background = getTextureManager().loadTexture(this.backUri);
            }
            // Determine which label to show and render children (Labels)
            const showText = text.length > 0 || isActive;
            this.textLabel.setFieldValue("visible", BrsBoolean.from(showText));
            this.hintLabel.setFieldValue("visible", BrsBoolean.from(!showText));
            this.isDirty = false;
        }
        if (this.drawFont === undefined) {
            const font = this.textLabel.getFieldValue("font") as Font;
            this.drawFont = font.createDrawFont();
        }
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (this.background?.isValid()) {
            this.drawImage(this.background, rect, 0, combinedOpacity, draw2D);
        }
        // Draw Cursor if active
        if (isActive && this.cursor?.isValid()) {
            const now = Date.now();
            if (now - this.lastCursorToggleTime > this.cursorBlinkInterval) {
                this.cursorVisible = !this.cursorVisible;
                this.lastCursorToggleTime = now;
            }
            if (this.cursorVisible) {
                const cursorPosition = this.getFieldValueJS("cursorPosition") as number;
                const secureMode = this.getFieldValueJS("secureMode") as boolean;

                let textToMeasure: string;
                if (secureMode) {
                    // In secure mode, cursor is always at the end, measure obscured text
                    textToMeasure = "*".repeat(text.length);
                } else {
                    textToMeasure = text.substring(0, Math.min(cursorPosition, text.length));
                }
                const measured = this.drawFont.measureTextWidth(textToMeasure);
                const cursorX = drawTrans[0] + this.paddingX + measured.width;
                const cursorY = drawTrans[1] + (size.height - this.cursor.height) / 2;
                const cursorRect = {
                    x: cursorX,
                    y: cursorY,
                    width: this.cursor.width,
                    height: this.cursor.height,
                };

                // Draw cursor with full opacity regardless of combinedOpacity for visibility
                this.drawImage(this.cursor, cursorRect, 0, 1.0, draw2D);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, combinedOpacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
