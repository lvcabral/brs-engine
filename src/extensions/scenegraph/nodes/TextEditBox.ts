import {
    AAMember,
    Interpreter,
    IfDraw2D,
    Rect,
    RoBitmap,
    RoFont,
    Float,
    BrsString,
    Int32,
    BrsBoolean,
} from "brs-engine";
import { sgClock } from "../SGClock";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { convertHexColor } from "../SGUtil";
import { Label } from "./Label";
import { Font } from "./Font";

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
    ];

    private background?: RoBitmap;
    private drawFont?: RoFont;
    private cursorVisible: boolean = true;
    private lastCursorToggleTime: number = 0;
    private lastCharInputTime: number = 0;
    /** Clock captured on the last paint pass; layout passes reuse it instead of reading the clock. */
    private lastPaintNow: number = 0;
    private readonly cursor?: RoBitmap;
    private readonly textLabel: Label;
    private readonly secureLabel: Label;
    private readonly hintLabel: Label;
    private readonly chromePaddingX: number;
    private readonly lineHeight: number;
    private height: number = 0;
    private paddingX: number = 0;
    private paddingY: number = 0;
    /**
     * Vertical shift applied to everything drawn inside the box (labels, cursor, background),
     * on top of `paddingY`. Zero when the built-in background is shown (content is laid out
     * top-down from the box's own translation, matching the original look). With a custom
     * background, a real device centers the box's content on its own translation.y rather than
     * dropping it straight down from that point the way a top-left translation normally would —
     * device-confirmed via `test/simulator/probes/texteditbox-vertical-anchor-probe`
     * (`device-trace-fhd.txt`: reported `boundingRect().y` is `-lineHeight/2` off translation.y
     * on every custom-background case, matching this exactly, including a non-symmetric
     * translation where a top-anchored guess would have been off by tens of pixels, not one).
     */
    private contentOffsetY: number = 0;
    /** Tracks the last-seen `backgroundUri` so chrome is only recomputed on a real change. */
    private lastBackgroundUri: string;
    private readonly cursorBlinkInterval = 500; // milliseconds
    private readonly secureDisplayTimeout = 2500; // milliseconds
    private readonly secureChar = "•";

    private readonly backUri = "common:/images/inputField.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TextEditBox) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        // Create Labels for text and hint
        this.textLabel = new Label();
        this.secureLabel = new Label();
        this.hintLabel = new Label();

        // Size the box from the resolved default font's real line height instead of a fixed
        // guess. TextEditBox has no documented "height" field on real Roku devices; the built-in
        // background (inputField.9.png) is drawn with generous chrome around the text (matching
        // the previous fixed 48/72 look, now derived from the font instead of hardcoded), but
        // apps that hide it via backgroundUri commonly draw their own — often sized tightly
        // around a single line of text — so in that case the box hugs the text instead of
        // padding it out to that same chrome height, which used to push the text out of a tight
        // custom background entirely.
        const fallbackLineHeight = this.resolution === "FHD" ? 36 : 24;
        const font = this.textLabel.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        this.lineHeight = drawFont instanceof RoFont ? drawFont.measureTextHeight() : fallbackLineHeight;

        this.chromePaddingX = this.resolution === "FHD" ? 33 : 22;
        this.lastBackgroundUri = this.getValueJS("backgroundUri") as string;
        this.applyChrome(this.lastBackgroundUri !== "");

        this.background = this.loadBitmap(this.backUri);
        const cursorUri = `common:/images/${this.resolution}/cursor_textInput.png`;
        this.cursor = this.loadBitmap(cursorUri);
        this.setValueSilent("focusable", BrsBoolean.True);

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
        this.hintLabel.setValueSilent("color", new Int32(convertHexColor("0xAAAAAAFF")));
        this.linkField(this.hintLabel, "color", "hintTextColor");

        this.lastCursorToggleTime = sgClock.now();
    }

    /**
     * Sets `height`/`paddingX`/`paddingY` for the current background mode. The built-in
     * background keeps generous chrome around the text (matching the original fixed 48/72 look
     * and the fixed left inset `chromePaddingX`, now derived from the font instead of hardcoded
     * for height); a custom background hugs the text tightly with no added left padding, since
     * the app owns the box's visual size/position in that case (see the constructor's
     * `lineHeight` comment) and typically already accounts for its own left margin via the
     * box's translation.x relative to its own background — adding `chromePaddingX` on top of
     * that double-counts it, over-indenting the text/hint from the app's visible box.
     */
    private applyChrome(customBackground: boolean) {
        if (customBackground) {
            this.paddingX = 0;
            this.paddingY = 0;
            this.height = this.lineHeight;
            this.contentOffsetY = -this.lineHeight / 2;
        } else {
            this.paddingX = this.chromePaddingX;
            this.paddingY = this.lineHeight / 2;
            this.height = this.lineHeight + this.paddingY * 2;
            this.contentOffsetY = 0;
        }
        this.setValueSilent("height", new Float(this.height));
    }

    private configureLabel(label: Label) {
        const width = this.getValueJS("width") as number;
        const labelWidth = width > 0 ? width - this.paddingX * 2 : 0;
        label.setTranslation([this.paddingX, this.paddingY + this.contentOffsetY]);
        label.setValueSilent("width", new Float(labelWidth));
        label.setValueSilent("height", new Float(this.height - this.paddingY * 2));
        label.setValueSilent("vertAlign", new BrsString("center"));
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (!press) {
            return handled;
        }
        const maxLen = this.getValueJS("maxTextLength") as number;
        let text = this.getValueJS("text") as string;
        let position = this.getValueJS("cursorPosition") as number;

        if (key.startsWith("Lit_")) {
            const charToAdd = key.substring(4);
            if (text.length < maxLen) {
                if (position === 0) {
                    text = charToAdd + text;
                } else {
                    text = text.slice(0, position) + charToAdd + text.slice(position);
                }
                position++;
                this.setValue("text", new BrsString(text));
                this.setValue("cursorPosition", new Float(position));
                this.lastCharInputTime = sgClock.now();
                handled = true;
            }
        } else if (key === "replay") {
            if (text.length && position > 0) {
                text = text.slice(0, position - 1) + text.slice(position);
                position--;
                this.setValue("text", new BrsString(text));
                this.setValue("cursorPosition", new Float(position));
                this.lastCharInputTime = 0;
                handled = true;
            }
        }
        // Reset cursor blink on key press
        if (handled) {
            this.cursorVisible = true;
            this.lastCursorToggleTime = sgClock.now();
        }
        return handled;
    }

    /** Set the active state of the node */
    setActive(active: boolean) {
        this.setValue("active", BrsBoolean.from(active));
    }

    /** Move the cursor a delta or if delta is zero, reset to first position */
    moveCursor(delta: number) {
        let position = this.getValueJS("cursorPosition") as number;
        const text = this.getValueJS("text") as string;

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
        this.setValue("cursorPosition", new Float(position));
        // Reset cursor blink on move
        this.cursorVisible = true;
        this.lastCursorToggleTime = sgClock.now();
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const drawTrans = this.getDrawTranslation(origin, angle);
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const combinedOpacity = opacity * this.getOpacity();
        const text = this.getValueJS("text") as string;
        const secureMode = this.getValueJS("secureMode") as boolean;
        // Read the clock only on a paint pass; a layout pass reuses the last paint's timestamp so
        // its output (secure-char reveal, cursor phase) is identical between frames — layout must
        // be pure and clock-free.
        if (this.isPaintPass(draw2D)) {
            this.lastPaintNow = sgClock.now();
        }
        const now = this.lastPaintNow;

        // Ensure labels have correct width if TextEditBox width changes
        // And update background if URI changes
        if (this.isDirty) {
            // Background Image
            const backgroundUri = this.getValueJS("backgroundUri") as string;
            if (backgroundUri !== this.lastBackgroundUri) {
                this.lastBackgroundUri = backgroundUri;
                this.applyChrome(backgroundUri !== "");
            }
            if (backgroundUri) {
                if (this.background?.getImageName() !== backgroundUri) {
                    this.background = this.getBitmap("backgroundUri");
                }
            } else if (this.background?.getImageName() !== this.backUri) {
                // backgroundUri was cleared back to "" - revert to the built-in background;
                // otherwise a stale custom image stays stretched into the now-larger chrome box.
                this.background = this.loadBitmap(this.backUri);
            }
            // Re-applies width/height/translation from the current width and chrome mode.
            this.configureLabel(this.textLabel);
            this.configureLabel(this.secureLabel);
            this.configureLabel(this.hintLabel);
            this.copyField(this.secureLabel, "color", "textColor");
        }

        // NOTE: `updateBoundingRects` below rotates around this same shifted rect when `rotation
        // !== 0` (Group.updateBoundingRects -> SGUtil.rotateRect uses rect.y as its base), so a
        // rotated custom-background TextEditBox pivots around its shifted content rect rather
        // than its raw translation.y. Untested combination (form inputs are essentially never
        // rotated) with no device reading either way - left as the simplest, most internally
        // consistent option (one definition of "this box's rect" everywhere) rather than
        // special-casing rotation without evidence of what a device actually does.
        const rect = {
            x: drawTrans[0],
            y: drawTrans[1] + this.contentOffsetY,
            width: size.width,
            height: size.height,
        };

        // Draw Background
        if (this.background?.isValid()) {
            this.drawImage(this.background, rect, 0, combinedOpacity, draw2D);
        }

        // Determine which label to show and configure secure text
        const showHint = text.length === 0;
        const secureText = this.getSecureText(text, now, secureMode, showHint);

        // Set label visibility AFTER calculating secure text
        this.textLabel.setValueSilent("visible", BrsBoolean.from(!showHint && !secureMode));
        this.hintLabel.setValueSilent("visible", BrsBoolean.from(showHint));
        this.secureLabel.setValueSilent("visible", BrsBoolean.from(!showHint && secureMode));

        this.renderCursor(rect, now, text, secureMode, secureText, combinedOpacity, draw2D);

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, combinedOpacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private getSecureText(text: string, now: number, secureMode: boolean, showHint: boolean): string {
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
            this.secureLabel.setValueSilent("text", new BrsString(secureText));
        }
        return secureText;
    }

    private renderCursor(
        rect: Rect,
        now: number,
        text: string,
        secureMode: boolean,
        secureText: string,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const isActive = this.getValueJS("active") as boolean;
        if (!isActive || !this.cursor?.isValid()) {
            return;
        }
        // Flip the blink phase only on a paint pass — layout renders the stored phase.
        if (this.isPaintPass(draw2D) && now - this.lastCursorToggleTime > this.cursorBlinkInterval) {
            this.cursorVisible = !this.cursorVisible;
            this.lastCursorToggleTime = now;
        }
        if (this.cursorVisible) {
            const cursorPosition = this.getValueJS("cursorPosition") as number;
            let textToMeasure: string;

            if (secureMode) {
                // Use the potentially mixed secure/real text for measurement
                textToMeasure = secureText.substring(0, Math.min(cursorPosition, secureText.length));
            } else {
                textToMeasure = text.substring(0, Math.min(cursorPosition, text.length));
            }
            if (this.drawFont === undefined) {
                const font = this.textLabel.getValue("font") as Font;
                const maybeFont = font.createDrawFont();
                if (maybeFont instanceof RoFont) {
                    this.drawFont = maybeFont;
                } else {
                    return;
                }
            }
            // Measure the text to determine cursor position
            const measured = this.drawFont.measureTextWidth(textToMeasure);
            const cursorX = rect.x + this.paddingX + measured.width;
            // Center cursor vertically based on its own height relative to the box height
            const cursorY = rect.y + (rect.height - this.cursor.height) / 2;
            const cursorRect = {
                x: cursorX,
                y: cursorY,
                width: this.cursor.width,
                height: this.cursor.height,
            };
            // Draw cursor at the node's combined opacity — a near-transparent text box (e.g. an
            // app "hiding" the box via opacity) must not show a fully opaque blinking cursor.
            this.drawImage(this.cursor, cursorRect, 0, opacity, draw2D);
        }
    }
}
