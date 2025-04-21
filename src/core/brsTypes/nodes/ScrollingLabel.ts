import { FieldModel } from "./Field";
import { Label } from "./Label";
import { AAMember, BrsType, isBrsString, Font } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, MeasuredText, Rect } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

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
        super([], name); // Initialize Label base class

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        // Ensure lastUpdateTime is initialized
        this.lastUpdateTime = Date.now();

        // Initial check if scrolling is needed based on default/initialized fields
        // Note: This might be recalculated if fields change later via 'set'
        this.checkForScrolling();
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false) {
        const changed = super.set(index, value, alwaysNotify); // Call base class set

        if (changed && isBrsString(index)) {
            const fieldName = index.getValue().toLowerCase();
            // Fields that affect scrolling behavior
            const scrollFields = [
                "text",
                "font",
                "maxwidth",
                "scrollspeed",
                "repeatcount",
                "ellipsistext",
            ];
            if (scrollFields.includes(fieldName)) {
                // Reset scrolling state if relevant fields change
                this.resetScrollingState();
                this.checkForScrolling(); // Re-evaluate if scrolling is needed
            }
        }
        return changed;
    }

    // Helper to check if scrolling is necessary and calculate initial values
    private checkForScrolling() {
        const text = this.getFieldValueJS("text") as string;
        const font = this.getFieldValue("font") as Font;
        const drawFont = font.createDrawFont();
        const maxWidth = this.getFieldValueJS("maxWidth") as number;
        const ellipsis = this.getFieldValueJS("ellipsisText") || "...";

        if (!text || !font || maxWidth <= 0) {
            // Cannot determine scrolling need without necessary info or drawing context
            this.needsScrolling = false;
            this.scrollState = ScrollState.STATIC;
            return;
        }

        // Measure full text and ellipsis
        this.fullTextWidth = drawFont.measureText(text).width;
        this.ellipsisWidth = drawFont.measureText(ellipsis).width;

        if (this.fullTextWidth > maxWidth) {
            this.needsScrolling = true;
            // Calculate truncated text (simple approach: find chars that fit before ellipsis)
            let currentWidth = 0;
            let truncatedIndex = 0;
            const availableWidth = maxWidth - this.ellipsisWidth;
            for (let i = 0; i < text.length; i++) {
                const charWidth = drawFont.measureText(text[i]).width;
                if (currentWidth + charWidth <= availableWidth) {
                    currentWidth += charWidth;
                    truncatedIndex = i + 1;
                } else {
                    break;
                }
            }
            this.truncatedText = text.substring(0, truncatedIndex) + ellipsis;

            // If state was STATIC, transition to INITIAL_PAUSE
            if (this.scrollState === ScrollState.STATIC) {
                this.resetScrollingState(); // Resets state to INITIAL_PAUSE, counters, etc.
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
        this.lastUpdateTime = Date.now(); // Reset time tracking
        this.measured = undefined; // Force remeasure/redraw
    }

    // Override renderNode to ensure renderLabel is called even if node width/height are 0
    // And to potentially trigger redraws for animation
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
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];

        // Use maxWidth as the effective width for rendering bounds if scrolling might occur
        const maxWidth = this.getFieldValueJS("maxWidth") as number;
        const nodeSize = this.getDimensions(); // Get width/height fields
        const renderWidth = maxWidth > 0 ? maxWidth : nodeSize.width; // Prefer maxWidth if set
        // Height is determined by font, usually single line for scrolling
        const font = this.getFieldValue("font") as Font;
        const drawFont = font.createDrawFont();
        const renderHeight = font ? drawFont.measureText("Mg").height : nodeSize.height;

        const rect = { x: drawTrans[0], y: drawTrans[1], width: renderWidth, height: renderHeight };
        const rotation = angle + this.getRotation();
        const finalOpacity = opacity * this.getOpacity();

        // Call our overridden renderLabel
        this.measured = this.renderLabel(rect, rotation, finalOpacity, draw2D);

        // Update bounding rects based on maxWidth and measured height
        const finalRectWidth = Math.max(this.measured.width, renderWidth); // Use the larger of measured (up to maxWidth) or explicit width
        const finalRectHeight = Math.max(this.measured.height, nodeSize.height); // Use measured height or explicit height
        const finalRect = { ...rect, width: finalRectWidth, height: finalRectHeight };

        this.updateBoundingRects(finalRect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, finalOpacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    // Override renderLabel to implement scrolling logic
    protected renderLabel(
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ): MeasuredText {
        // Ensure scrolling need is evaluated with a draw2D context if not done before
        if (this.fullTextWidth === 0 && this.getFieldValueJS("text")) {
            this.checkForScrolling();
        }

        // --- Time and State Update ---
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        this.elapsedTime += deltaTime;

        const scrollSpeed = this.getFieldValueJS("scrollSpeed") as number; // pixels per second
        const repeatCount = this.getFieldValueJS("repeatCount") as number;
        const maxWidth = this.getFieldValueJS("maxWidth") as number;
        const text = this.getFieldValueJS("text") as string;
        const font = this.getFieldValue("font") as Font;
        const drawFont = font.createDrawFont();
        const color = this.getFieldValueJS("color") as number;
        const horizAlign = this.getFieldValueJS("horizAlign") || "left"; // Scrolling typically assumes left align visually
        const vertAlign = this.getFieldValueJS("vertAlign") || "top";

        let textToDraw = text;
        let drawOffset = 0;
        let isEllipsized = false;

        if (this.needsScrolling && this.scrollState !== ScrollState.FINISHED) {
            const scrollDistance = this.fullTextWidth - maxWidth; // How much the text needs to move
            const scrollDuration =
                scrollDistance > 0 && scrollSpeed > 0 ? (scrollDistance / scrollSpeed) * 1000 : 0; // ms

            switch (this.scrollState) {
                case ScrollState.INITIAL_PAUSE:
                    textToDraw = this.truncatedText;
                    isEllipsized = true;
                    if (this.elapsedTime >= INITIAL_PAUSE_MS) {
                        this.scrollState = ScrollState.SCROLLING;
                        this.elapsedTime = 0; // Reset timer for scrolling phase
                    }
                    break;

                case ScrollState.SCROLLING:
                    textToDraw = text; // Draw the full text
                    // Calculate current offset based on elapsed time in this state
                    this.scrollOffset = Math.min(
                        scrollDistance,
                        (this.elapsedTime / scrollDuration) * scrollDistance
                    );
                    drawOffset = -this.scrollOffset;
                    isEllipsized = false; // Full text is potentially visible

                    if (this.elapsedTime >= scrollDuration) {
                        this.scrollState = ScrollState.END_PAUSE;
                        this.elapsedTime = 0; // Reset timer for end pause
                        this.scrollOffset = scrollDistance; // Ensure it's exactly at the end
                        drawOffset = -this.scrollOffset;
                    }
                    break;

                case ScrollState.END_PAUSE:
                    textToDraw = text; // Keep drawing full text, but fully scrolled
                    drawOffset = -scrollDistance;
                    isEllipsized = false;
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
            drawOffset = 0;
            isEllipsized = true;
        } else {
            // Static case: Text fits or scrolling is disabled/not needed
            textToDraw = text;
            drawOffset = 0;
            isEllipsized = false; // Text fits, no ellipsis applied by scrolling logic
        }

        // --- Drawing ---
        // Use maxWidth for clipping and effective width calculation
        const clipRect: Rect = { ...rect, width: maxWidth };
        const textHeight = drawFont.measureText("Mg").height; // Approx height

        // Calculate drawing position based on alignment (simplified for scrolling - primarily uses left edge)
        let drawX = rect.x + drawOffset; // Start with left edge + scroll offset
        let drawY = rect.y;

        // Adjust Y based on vertical alignment
        if (vertAlign === "center") {
            drawY += (rect.height - textHeight) / 2;
        } else if (vertAlign === "bottom") {
            drawY += rect.height - textHeight;
        }
        // Note: Horizontal alignment is tricky with scrolling. Visually, it behaves like 'left' within the maxWidth.
        // The initial truncated text might respect alignment briefly, but scrolling itself is a leftward movement.

        // Apply clipping
        draw2D?.pushClip(clipRect);

        // Draw the text
        draw2D?.doDrawRotatedText(textToDraw, drawX, drawY, color, opacity, drawFont, rotation);

        // Remove clipping
        draw2D?.popClip();

        // Update the isTextEllipsized field
        this.setEllipsized(isEllipsized);

        // Return measured dimensions - width is capped by maxWidth
        const measuredWidth = this.needsScrolling ? maxWidth : this.fullTextWidth;
        return {
            text: textToDraw, // Return the text actually drawn in this frame
            width: measuredWidth,
            height: textHeight, // Assuming single line for scrolling
            ellipsized: isEllipsized,
        };
    }
}
