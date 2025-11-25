import { FieldModel } from "./Field";
import { Label } from "./Label";
import { AAMember, BrsType, isBrsString, Font } from "..";
import { IfDraw2D, MeasuredText, Rect } from "../interfaces/IfDraw2D";

// Enum to manage the scrolling state
enum ScrollState {
    STATIC, // Text fits, no scrolling needed
    INITIAL_PAUSE, // Paused showing truncated text with ellipsis
    SCROLLING, // Text is actively scrolling left
    END_PAUSE, // Paused showing the end of the text
    FINISHED, // Scrolling completed based on repeatCount
}

// Constants for timing (in milliseconds)
const INITIAL_PAUSE_MS = 2500; // Pause before scrolling starts
const END_PAUSE_MS = 2500; // Pause after scrolling finishes before reset/repeat

export class ScrollingLabel extends Label {
    readonly defaultFields: FieldModel[] = [
        { name: "scrollSpeed", type: "float", value: "100" }, // pixels per second
        { name: "repeatCount", type: "float", value: "-1" }, // -1 for infinite
        { name: "maxWidth", type: "integer", value: "500" },
    ];

    // Internal state for scrolling animation
    private scrollState: ScrollState = ScrollState.STATIC;
    private scrollOffset: number = 0;
    private elapsedTime: number = 0; // Time elapsed in the current state (ms)
    private currentRepeat: number = 0;
    private needsScrolling: boolean = false;
    private fullTextWidth: number = 0;
    private truncatedText: string = "";
    private ellipsisWidth: number = 0;
    private lastUpdateTime: number = 0; // Timestamp of the last update

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ScrollingLabel") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.lastUpdateTime = Date.now();
        this.checkForScrolling();
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false) {
        const wasVisible = this.getValueJS("visible") as boolean;
        super.setValue(index, value, alwaysNotify); // Call base class set

        if (this.isDirty) {
            const fieldName = index.toLowerCase();
            // Fields that affect scrolling behavior
            const scrollFields = ["text", "font", "maxwidth", "scrollspeed", "repeatcount", "ellipsistext"];
            if (scrollFields.includes(fieldName) || wasVisible !== this.getValueJS("visible")) {
                this.resetScrollingState();
                this.checkForScrolling();
            }
        }
    }

    // Helper to check if scrolling is necessary and calculate initial values
    private checkForScrolling() {
        const text = this.getValueJS("text") as string;
        const font = this.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        const maxWidth = this.getValueJS("maxWidth") as number;
        const ellipsis = this.getValueJS("ellipsisText") || "...";

        if (!text || !font || maxWidth <= 0) {
            // Cannot determine scrolling need without necessary info or drawing context
            this.needsScrolling = false;
            this.scrollState = ScrollState.STATIC;
            return;
        }

        // Measure full text and ellipsis
        this.fullTextWidth = drawFont.measureTextWidth(text).width;
        this.ellipsisWidth = drawFont.measureTextWidth(ellipsis).width;

        if (this.fullTextWidth > maxWidth) {
            this.needsScrolling = true;
            let currentWidth = 0;
            let truncatedIndex = 0;
            const availableWidth = maxWidth - this.ellipsisWidth;
            for (let i = 0; i < text.length; i++) {
                const charWidth = drawFont.measureTextWidth(text[i]).width;
                if (currentWidth + charWidth <= availableWidth) {
                    currentWidth += charWidth;
                    truncatedIndex = i + 1;
                } else {
                    break;
                }
            }
            this.truncatedText = text.substring(0, truncatedIndex) + ellipsis;

            if (this.scrollState === ScrollState.STATIC) {
                this.resetScrollingState();
            }
        } else {
            this.needsScrolling = false;
            this.scrollState = ScrollState.STATIC;
            this.scrollOffset = 0;
        }
    }

    // Reset scrolling state variables
    private resetScrollingState() {
        this.scrollState = this.needsScrolling ? ScrollState.INITIAL_PAUSE : ScrollState.STATIC;
        this.scrollOffset = 0;
        this.elapsedTime = 0;
        this.currentRepeat = 0;
        this.lastUpdateTime = Date.now();
        this.measured = undefined;
    }

    // Override renderLabel to implement scrolling logic
    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D): MeasuredText {
        const text = this.getValueJS("text") as string;
        if (this.isDirty || (this.fullTextWidth === 0 && text)) {
            this.checkForScrolling();
        }
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        this.elapsedTime += deltaTime;

        const scrollSpeed = this.getValueJS("scrollSpeed") as number;
        const repeatCount = this.getValueJS("repeatCount") as number;
        const maxWidth = this.getValueJS("maxWidth") as number;
        const font = this.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        const textHeight = drawFont.measureTextHeight();
        rect.width = maxWidth > 0 ? maxWidth : rect.width;
        rect.height = textHeight;
        const color = this.getValueJS("color") as number;
        const vertAlign = this.getValueJS("vertAlign") || "top";

        let textToDraw = text;
        let drawOffset = 0;
        let isEllipsized = false;

        if (this.needsScrolling && this.scrollState !== ScrollState.FINISHED) {
            const scrollDistance = this.fullTextWidth - maxWidth; // How much the text needs to move
            const scrollDuration = scrollDistance > 0 && scrollSpeed > 0 ? (scrollDistance / scrollSpeed) * 1000 : 0; // ms

            switch (this.scrollState) {
                case ScrollState.INITIAL_PAUSE:
                    textToDraw = this.truncatedText;
                    isEllipsized = true;
                    if (this.elapsedTime >= INITIAL_PAUSE_MS) {
                        this.scrollState = ScrollState.SCROLLING;
                        this.elapsedTime = 0;
                    }
                    break;

                case ScrollState.SCROLLING:
                    textToDraw = text; // Draw the full text
                    // Calculate current offset based on elapsed time in this state
                    this.scrollOffset = Math.min(scrollDistance, (this.elapsedTime / scrollDuration) * scrollDistance);
                    drawOffset = -this.scrollOffset;

                    if (this.elapsedTime >= scrollDuration) {
                        this.scrollState = ScrollState.END_PAUSE;
                        this.elapsedTime = 0;
                        this.scrollOffset = scrollDistance; // Ensure it's exactly at the end
                        drawOffset = -this.scrollOffset;
                    }
                    break;

                case ScrollState.END_PAUSE:
                    textToDraw = text; // Keep drawing full text, but fully scrolled
                    drawOffset = -scrollDistance;
                    if (this.elapsedTime >= END_PAUSE_MS) {
                        this.currentRepeat++;
                        if (repeatCount !== -1 && this.currentRepeat >= repeatCount) {
                            this.scrollState = ScrollState.FINISHED;
                            textToDraw = this.truncatedText; // Show truncated at the end
                            drawOffset = 0;
                            isEllipsized = true;
                        } else {
                            // Repeat the cycle
                            this.scrollState = ScrollState.INITIAL_PAUSE;
                            this.elapsedTime = 0;
                            this.scrollOffset = 0;
                            textToDraw = this.truncatedText;
                            drawOffset = 0;
                            isEllipsized = true;
                        }
                    }
                    break;
            }
        } else if (this.scrollState === ScrollState.FINISHED) {
            // If finished, just draw the truncated text statically
            textToDraw = this.truncatedText;
            isEllipsized = true;
        } else {
            // Static case: Text fits or scrolling is disabled/not needed
            textToDraw = text;
        }
        const clipRect: Rect = { ...rect, width: maxWidth };
        let drawX = rect.x + drawOffset;
        let drawY = rect.y;
        if (vertAlign === "center") {
            drawY += (rect.height - textHeight) / 2;
        } else if (vertAlign === "bottom") {
            drawY += rect.height - textHeight;
        }
        draw2D?.pushClip(clipRect);
        draw2D?.doDrawRotatedText(textToDraw, drawX, drawY, color, opacity, drawFont, rotation);
        draw2D?.popClip();
        this.setEllipsized(isEllipsized);
        const measuredWidth = this.needsScrolling ? maxWidth : this.fullTextWidth;
        return {
            text: textToDraw,
            width: measuredWidth,
            height: textHeight,
            ellipsized: isEllipsized,
        };
    }
}
