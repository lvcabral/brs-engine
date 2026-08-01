import { AAMember, BrsType, IfDraw2D, MeasuredText, Rect, RoFont } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Label } from "./Label";
import { Font } from "./Font";
import { sgRoot } from "../SGRoot";
import { sgClock } from "../SGClock";

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

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ScrollingLabel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Label);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.lastUpdateTime = sgClock.now();
        this.checkForScrolling();
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean) {
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
        const font = this.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return;
        }
        const text = this.getValueJS("text") as string;
        const maxWidth = this.getValueJS("maxWidth") as number;
        const ellipsis = this.getValueJS("ellipsisText") || "...";
        if (!text || !font || maxWidth <= 0 || !(drawFont instanceof RoFont)) {
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

    /**
     * Advances the marquee state machine by the wall-clock time since the last paint. Called only
     * from paint passes — layout renders the stored state without touching the clock.
     */
    private advanceScroll(scrollDistance: number, scrollDuration: number, repeatCount: number) {
        const now = sgClock.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        this.elapsedTime += deltaTime;

        switch (this.scrollState) {
            case ScrollState.INITIAL_PAUSE:
                if (this.elapsedTime >= INITIAL_PAUSE_MS) {
                    this.scrollState = ScrollState.SCROLLING;
                    this.elapsedTime = 0;
                    this.scrollOffset = 0;
                }
                break;

            case ScrollState.SCROLLING:
                this.scrollOffset = Math.min(scrollDistance, (this.elapsedTime / scrollDuration) * scrollDistance);
                if (this.elapsedTime >= scrollDuration) {
                    this.scrollState = ScrollState.END_PAUSE;
                    this.elapsedTime = 0;
                    this.scrollOffset = scrollDistance; // Ensure it's exactly at the end
                }
                break;

            case ScrollState.END_PAUSE:
                if (this.elapsedTime >= END_PAUSE_MS) {
                    this.currentRepeat++;
                    if (repeatCount !== -1 && this.currentRepeat >= repeatCount) {
                        this.scrollState = ScrollState.FINISHED;
                    } else {
                        // Repeat the cycle
                        this.scrollState = ScrollState.INITIAL_PAUSE;
                        this.elapsedTime = 0;
                    }
                    this.scrollOffset = 0;
                }
                break;
        }
    }

    // Reset scrolling state variables
    private resetScrollingState() {
        this.scrollState = this.needsScrolling ? ScrollState.INITIAL_PAUSE : ScrollState.STATIC;
        this.scrollOffset = 0;
        this.elapsedTime = 0;
        this.currentRepeat = 0;
        this.lastUpdateTime = sgClock.now();
        this.measured = undefined;
    }

    // Override renderLabel to implement scrolling logic
    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D): MeasuredText {
        const text = this.getValueJS("text") as string;
        if (this.isDirty || (this.fullTextWidth === 0 && text)) {
            this.checkForScrolling();
        }
        const font = this.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return { text, width: 0, height: 0, ellipsized: false };
        }
        const scrollSpeed = this.getValueJS("scrollSpeed") as number;
        const repeatCount = this.getValueJS("repeatCount") as number;
        const maxWidth = this.getValueJS("maxWidth") as number;
        const textHeight = drawFont.measureTextHeight();
        const horizAlign = (this.getValueJS("horizAlign") as string) || "left";
        const constrainedWidth = maxWidth > 0 ? maxWidth : rect.width;
        const boxHeight = rect.height;
        rect.width = constrainedWidth;
        rect.height = textHeight;
        const color = this.getValueJS("color") as number;
        const vertAlign = this.getValueJS("vertAlign") || "top";

        const scrollDistance = this.fullTextWidth - maxWidth; // How much the text needs to move
        const scrollDuration = scrollDistance > 0 && scrollSpeed > 0 ? (scrollDistance / scrollSpeed) * 1000 : 0; // ms

        // Advance the marquee only on a paint pass: a layout pass (a bounding-rect refresh) must
        // be pure and clock-free — it renders the stored scroll position. Consuming the time delta
        // here used to make measurement frequency change the scroll speed, and the makeDirty from
        // inside a refresh re-dirtied the scene from a boundingRect() query.
        if (this.needsScrolling && this.scrollState !== ScrollState.FINISHED && this.isPaintPass(draw2D)) {
            sgRoot.makeDirty(); // Ensure continuous updates during scrolling
            this.advanceScroll(scrollDistance, scrollDuration, repeatCount);
        }

        // Derive what to draw purely from the stored scroll state.
        let textToDraw = text;
        let drawOffset = 0;
        let isEllipsized = false;
        if (this.needsScrolling) {
            switch (this.scrollState) {
                case ScrollState.SCROLLING:
                    drawOffset = -this.scrollOffset;
                    break;
                case ScrollState.END_PAUSE:
                    drawOffset = -scrollDistance;
                    break;
                default:
                    // INITIAL_PAUSE and FINISHED show the truncated text at rest.
                    textToDraw = this.truncatedText;
                    isEllipsized = true;
                    break;
            }
        }
        const clipRect: Rect = { ...rect, height: Math.max(boxHeight, textHeight) };
        let drawX = rect.x + drawOffset;
        let drawY = rect.y;
        if (boxHeight > textHeight) {
            if (vertAlign === "center") {
                drawY += (boxHeight - textHeight) / 2;
            } else if (vertAlign === "bottom") {
                drawY += boxHeight - textHeight;
            }
        }
        if (drawOffset === 0 && constrainedWidth > 0) {
            const measuredWidth = drawFont.measureTextWidth(textToDraw).width;
            if (constrainedWidth > measuredWidth) {
                if (horizAlign === "center") {
                    drawX += (constrainedWidth - measuredWidth) / 2;
                } else if (horizAlign === "right") {
                    drawX += constrainedWidth - measuredWidth;
                }
            }
        }
        draw2D?.pushClip(clipRect);
        try {
            draw2D?.doDrawRotatedText(textToDraw, drawX, drawY, color, opacity, drawFont, rotation);
        } finally {
            draw2D?.popClip();
        }
        // Safe on layout passes too (matching the base Label): with the scroll state frozen
        // during layout, the value derives purely from stored state, and setValue only notifies
        // on a genuine change — idempotent.
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
