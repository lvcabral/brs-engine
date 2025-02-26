import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { Font } from "./Font";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    Int32,
    jsValueOf,
    rootObjects,
    ValueKind,
} from "..";
import { Interpreter } from "../..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class LabelList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "textHorizAlign", type: "string", value: "left" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "focusedColor", type: "color", value: "0x262626ff" },
        { name: "font", type: "font" },
        { name: "focusedFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "itemSize", type: "array", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];

    private readonly focusUri = "common:/images/focus_list.9.png";
    private readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    private wrap: boolean;
    private currRow: number;
    private hasNinePatch: boolean;
    private lastPressHandled: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "LabelList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.setFieldValue("itemSize", brsValueOf([510, 72]));
        } else {
            this.setFieldValue("itemSize", brsValueOf([340, 48]));
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));

        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() !== "floatingfocus";
        this.hasNinePatch = true;
        this.lastPressHandled = "";
        this.currRow = this.updateCurrRow();
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())) {
                this.wrap = value.toString().toLowerCase() !== "floatingfocus";
            } else {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "horizfocusanimationstyle") {
            // Invalid field for LabelList
            return BrsInvalid.Instance;
        }
        const result = super.set(index, value, alwaysNotify, kind);
        // Update the current row if some fields changed
        if (["vertfocusanimationstyle", "numrows", "focusrow"].includes(fieldName)) {
            this.currRow = this.updateCurrRow();
        }
        return result;
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "up" || key === "down") {
            const offset = key === "up" ? -1 : 1;
            const nextIndex = this.getIndex(offset);
            if (press && nextIndex !== this.focusIndex) {
                this.set(new BrsString("animateToItem"), new Int32(nextIndex));
                handled = true;
                this.currRow += this.wrap ? 0 : offset;
            }
        } else if (key === "OK") {
            if (press) {
                this.set(new BrsString("itemSelected"), new Int32(this.focusIndex));
                handled = true;
            }
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeFocus = interpreter.environment.getFocusedNode() === this;
        const content = this.getFieldValue("content") as ContentNode;
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const itemSize = jsValueOf(this.getFieldValue("itemSize"));
        const numRows = jsValueOf(this.getFieldValue("numRows"));
        const itemFocused = jsValueOf(this.getFieldValue("itemFocused"));
        let focusRow = jsValueOf(this.getFieldValue("focusRow"));
        if (!this.wrap) {
            this.currRow = Math.max(0, Math.min(this.currRow, numRows - 1));
            this.currRow = Math.min(Math.max(this.currRow, focusRow), itemFocused);
        } else {
            this.currRow = focusRow;
        }
        const childCount = content.getNodeChildren().length;
        const displayRows = Math.min(childCount, numRows);
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        let lastIndex = -1;
        for (let r = 0; r < displayRows; r++) {
            const index = this.getIndex(r - this.currRow);
            if (this.wrap && index < lastIndex) {
                this.renderWrapDivider(itemRect, rotation, draw2D);
            }
            const row = content.getNodeChildren()[index];
            const text = jsValueOf(row.getFieldValue("title"));
            const focused = index === itemFocused;
            this.renderItem(nodeFocus, text, itemRect, rotation, focused, draw2D);
            itemRect.y += itemSize[1] + 1;
            lastIndex = index;
        }
        rect.x = rect.x - (this.hasNinePatch ? 24 : 0);
        rect.y = rect.y - (this.hasNinePatch ? 4 : 0);
        rect.width = itemSize[0] + (this.hasNinePatch ? 48 : 0);
        rect.height = displayRows * (itemSize[1] + (this.hasNinePatch ? 9 : 0));
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }

    private renderItem(
        nodeFocus: boolean,
        text: string,
        itemRect: Rect,
        rotation: number,
        focused: boolean,
        draw2D?: IfDraw2D
    ) {
        let font = this.getFieldValue("font") as Font;
        let color = jsValueOf(this.getFieldValue("color"));
        const align = jsValueOf(this.getFieldValue("textHorizAlign"));
        if (!focused) {
            this.drawText(text, font, color, itemRect, align, "center", rotation, draw2D);
            return;
        }
        const drawFocus = jsValueOf(this.getFieldValue("drawFocusFeedback"));
        const drawFocusOnTop = jsValueOf(this.getFieldValue("drawFocusFeedbackOnTop"));
        if (drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, rotation, draw2D);
        }
        if (nodeFocus) {
            font = this.getFieldValue("focusedFont") as Font;
            color = jsValueOf(this.getFieldValue("focusedColor"));
        }
        this.drawText(text, font, color, itemRect, align, "center", rotation, draw2D);
        if (drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, rotation, draw2D);
        }
        this.hasNinePatch = this.hasNinePatch && drawFocus;
    }

    private renderFocus(itemRect: Rect, nodeFocus: boolean, rotation: number, draw2D?: IfDraw2D) {
        const focusBitmap = this.getBitmap("focusBitmapUri");
        const focusFootprint = this.getBitmap("focusFootprintBitmapUri");
        this.hasNinePatch = (focusBitmap?.ninePatch || focusFootprint?.ninePatch) === true;
        const ninePatchRect = {
            x: itemRect.x - 24,
            y: itemRect.y - 4,
            width: itemRect.width + 48,
            height: itemRect.height + 9,
        };
        if (nodeFocus && focusBitmap) {
            const rect = focusBitmap.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusBitmap, rect, rotation, draw2D);
        } else if (!nodeFocus && focusFootprint) {
            const rect = focusFootprint.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusFootprint, rect, rotation, draw2D);
        }
    }

    private renderWrapDivider(itemRect: Rect, rotation: number, draw2D?: IfDraw2D) {
        const bmp = this.getBitmap("wrapDividerBitmapUri");
        const dividerHeight = jsValueOf(this.getFieldValue("wrapDividerHeight"));
        if (bmp?.isValid()) {
            const rect = { ...itemRect, y: itemRect.y + dividerHeight / 2 - 1, height: 2 };
            this.drawImage(bmp, rect, rotation, draw2D);
        }
        itemRect.y += dividerHeight;
    }

    private getIndex(offset: number = 0) {
        const itemFocused = jsValueOf(this.getFieldValue("itemFocused")) as number;
        const index = itemFocused + offset;
        const content = this.getFieldValue("content") as ContentNode;
        const childCount = content.getNodeChildren().length;
        if (this.wrap) {
            return (index + childCount) % childCount;
        }
        if (index >= childCount) {
            return childCount - 1;
        } else if (index < 0) {
            return 0;
        }
        return index;
    }

    private updateCurrRow() {
        if (this.wrap) {
            return jsValueOf(this.getFieldValue("focusRow"));
        }
        return jsValueOf(this.getFieldValue("numRows")) - 1;
    }
}
