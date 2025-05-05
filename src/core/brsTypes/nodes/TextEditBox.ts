import { FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { Float, RoBitmap, Label, Font, BrsString, RoFont, Int32 } from "..";
import { BrsBoolean } from "../BrsType";
import { convertHexColor } from "../../scenegraph/SGUtil";

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
    private drawFont?: RoFont;
    private cursorVisible: boolean = true;
    private lastCursorToggleTime: number = 0;
    private lastCharInputTime: number = 0;
    private readonly cursor?: RoBitmap;
    private readonly textLabel: Label;
    private readonly secureLabel: Label;
    private readonly hintLabel: Label;
    private readonly height: number;
    private readonly paddingX: number;
    private readonly paddingY: number;
    private readonly cursorBlinkInterval = 500; // milliseconds
    private readonly secureDisplayTimeout = 2500; // milliseconds
    private readonly secureChar = "•";

    private readonly backUri = "common:/images/inputField.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "TextEditBox") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.height = 72;
            this.paddingX = 33;
            this.paddingY = 18; // Approximate vertical centering
        } else {
            this.height = 48;
            this.paddingX = 22;
            this.paddingY = 12; // Approximate vertical centering
        }
        this.background = this.loadBitmap(this.backUri);
        const cursorUri = `common:/images/cursor_textInput_${this.resolution}.png`;
        this.cursor = this.loadBitmap(cursorUri);
        this.setFieldValue("height", new Float(this.height));

        // Create Labels for text and hint
        this.textLabel = new Label();
        this.secureLabel = new Label();
        this.hintLabel = new Label();

        // Configure and add labels as children
        this.configureLabel(this.textLabel);
        this.configureLabel(this.secureLabel);
        this.configureLabel(this.hintLabel);
        this.appendChildToParent(this.textLabel);
        this.appendChildToParent(this.secureLabel);
        this.appendChildToParent(this.hintLabel);

        // Link fields
        this.linkField(this.textLabel, "text");
        this.linkField(this.textLabel, "color", "textColor");
        this.linkField(this.hintLabel, "text", "hintText");
        this.hintLabel.setFieldValue("color", new Int32(convertHexColor("0xAAAAAAFF")));
        this.linkField(this.hintLabel, "color", "hintTextColor");

        this.lastCursorToggleTime = Date.now();
    }

    private configureLabel(label: Label) {
        const width = this.getFieldValueJS("width") as number;
        const labelWidth = width > 0 ? width - this.paddingX * 2 : 0;
        label.setTranslation([this.paddingX, this.paddingY]);
        label.setFieldValue("width", new Float(labelWidth));
        label.setFieldValue("height", new Float(this.height - this.paddingY * 2));
        label.setFieldValue("vertAlign", new BrsString("center"));
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (!press) {
            return handled;
        }
        const maxLen = this.getFieldValueJS("maxTextLength") as number;
        let text = this.getFieldValueJS("text") as string;
        let position = this.getFieldValueJS("cursorPosition") as number;

        if (key.startsWith("Lit_")) {
            const charToAdd = key.substring(4);
            if (text.length < maxLen) {
                if (position === 0) {
                    text = charToAdd + text;
                } else {
                    text = text.slice(0, position) + charToAdd + text.slice(position);
                }
                position++;
                this.set(new BrsString("text"), new BrsString(text));
                this.set(new BrsString("cursorPosition"), new Float(position));
                this.lastCharInputTime = Date.now();
                handled = true;
            }
        } else if (key === "replay") {
            if (text.length && position > 0) {
                text = text.slice(0, position - 1) + text.slice(position);
                position--;
                this.set(new BrsString("text"), new BrsString(text));
                this.set(new BrsString("cursorPosition"), new Float(position));
                this.lastCharInputTime = 0;
                handled = true;
            }
        }
        // Reset cursor blink on key press
        if (handled) {
            this.cursorVisible = true;
            this.lastCursorToggleTime = Date.now();
        }
        return handled;
    }

    /** Set the active state of the node */
    setActive(active: boolean) {
        this.set(new BrsString("active"), BrsBoolean.from(active));
    }

    /** Move the cursor a delta or if delta is zero, reset to first position */
    moveCursor(delta: number) {
        let position = this.getFieldValueJS("cursorPosition") as number;
        const text = this.getFieldValueJS("text") as string;

        if (delta === 0) {
            position = 0;
        } else {
            position += delta;
            if (position < 0) {
                position = 0;
            } else if (position > text.length) {
                position = text.length;
            }
        }
        this.set(new BrsString("cursorPosition"), new Float(position));
        // Reset cursor blink on move
        this.cursorVisible = true;
        this.lastCursorToggleTime = Date.now();
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
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
        const text = this.getFieldValueJS("text") as string;
        const secureMode = this.getFieldValueJS("secureMode") as boolean;
        const now = Date.now(); // Get current time for checks

        // Ensure labels have correct width if TextEditBox width changes
        // And update background if URI changes
        if (this.isDirty) {
            const width = this.getFieldValueJS("width") as number;
            const labelWidth = width > 0 ? width - this.paddingX * 2 : 0;
            const labelWidthFloat = new Float(labelWidth);
            this.textLabel.setFieldValue("width", labelWidthFloat);
            this.secureLabel.setFieldValue("width", labelWidthFloat);
            this.hintLabel.setFieldValue("width", labelWidthFloat);
            this.copyField(this.secureLabel, "color", "textColor");
            // Background Image
            const backgroundUri = this.getFieldValueJS("backgroundUri") as string;
            if (backgroundUri && this.background?.getImageName() !== backgroundUri) {
                this.background = this.getBitmap("backgroundUri");
            }
        }

        if (this.drawFont === undefined) {
            const font = this.textLabel.getFieldValue("font") as Font;
            this.drawFont = font.createDrawFont();
        }
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        // Draw Background
        if (this.background?.isValid()) {
            this.drawImage(this.background, rect, 0, combinedOpacity, draw2D);
        }

        // Determine which label to show and configure secure text
        const showHint = text.length === 0;
        let secureText = "";

        if (secureMode && !showHint) {
            if (now - this.lastCharInputTime < this.secureDisplayTimeout && text.length > 0) {
                // Show last character if within timeout
                const prefix = this.secureChar.repeat(text.length - 1);
                const lastChar = text.slice(-1);
                secureText = prefix + lastChar;
            } else {
                // Timeout expired or no recent input, show all secure chars
                secureText = this.secureChar.repeat(text.length);
            }
            this.secureLabel.setFieldValue("text", new BrsString(secureText));
        }

        // Set label visibility AFTER calculating secure text
        this.textLabel.setFieldValue("visible", BrsBoolean.from(!showHint && !secureMode));
        this.hintLabel.setFieldValue("visible", BrsBoolean.from(showHint));
        this.secureLabel.setFieldValue("visible", BrsBoolean.from(!showHint && secureMode));

        // Draw Cursor if active
        this.renderCursor(drawTrans[0], drawTrans[1], size.height, now, text, secureMode, secureText, draw2D);

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, combinedOpacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private renderCursor(
        x: number,
        y: number,
        height: number,
        now: number,
        text: string,
        secureMode: boolean,
        secureText: string,
        draw2D?: IfDraw2D
    ) {
        const isActive = this.getFieldValueJS("active") as boolean;
        if (isActive && this.cursor?.isValid()) {
            if (now - this.lastCursorToggleTime > this.cursorBlinkInterval) {
                this.cursorVisible = !this.cursorVisible;
                this.lastCursorToggleTime = now;
            }
            if (this.cursorVisible) {
                const cursorPosition = this.getFieldValueJS("cursorPosition") as number;
                let textToMeasure: string;

                if (secureMode) {
                    // Use the potentially mixed secure/real text for measurement
                    textToMeasure = secureText.substring(0, Math.min(cursorPosition, secureText.length));
                } else {
                    textToMeasure = text.substring(0, Math.min(cursorPosition, text.length));
                }

                const measured = this.drawFont!.measureTextWidth(textToMeasure);
                const cursorX = x + this.paddingX + measured.width;
                // Center cursor vertically based on its own height relative to the box height
                const cursorY = y + (height - this.cursor.height) / 2;
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
    }
}
