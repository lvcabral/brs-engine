import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    ContentNode,
    Float,
    Font,
    Int32,
    jsValueOf,
    rootObjects,
    RoSGNode,
    ValueKind,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";

export class ArrayGrid extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "itemSize", type: "array", value: "[0,0]" },
        { name: "itemSpacing", type: "array", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "focusRow", type: "integer", value: "0" },
        { name: "focusColumn", type: "integer", value: "0" },
        { name: "horizFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "vertFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "fadeFocusFeedbackWhenAutoScrolling", type: "boolean", value: "false" },
        { name: "currFocusFeedbackOpacity", type: "float", value: "read-only" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerWidth", type: "float", value: "0" },
        { name: "wrapDividerHeight", type: "float", value: "36" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "numRenderPasses", type: "integer", value: "1" },
        { name: "rowHeights", type: "array", value: "[]" },
        { name: "columnWidths", type: "array", value: "[]" },
        { name: "rowSpacings", type: "array", value: "[]" },
        { name: "columnSpacings", type: "array", value: "[]" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "sectionDividerTextColor", type: "color", value: "0xddddddff" },
        { name: "sectionDividerSpacing", type: "float", value: "0.0" },
        { name: "sectionDividerWidth", type: "float", value: "0.0" },
        { name: "sectionDividerHeight", type: "float", value: "40" },
        { name: "sectionDividerMinWidth", type: "float", value: "0.0" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0.0" },
        { name: "itemClippingRect", type: "array", value: "[ 0.0, 0.0, 0.0, 0.0 ]" },
        { name: "itemSelected", type: "integer", value: "-1" },
        { name: "itemFocused", type: "integer", value: "-1" },
        { name: "itemUnfocused", type: "integer", value: "-1" },
        { name: "jumpToItem", type: "integer", value: "0" },
        { name: "animateToItem", type: "integer", value: "0" },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
    ];
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected contentLength: number = 0;
    protected focusIndex: number = 0;
    protected currRow: number = 0;
    protected wrap: boolean = false;
    protected lastPressHandled: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ArrayGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setFieldValue("content", new ContentNode());
        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.setFieldValue("wrapDividerHeight", new Float(36));
            this.setFieldValue("sectionDividerHeight", new Float(60));
            this.setFieldValue("sectionDividerMinWidth", new Float(126));
            this.setFieldValue("sectionDividerSpacing", new Float(15));
        } else {
            this.setFieldValue("wrapDividerHeight", new Float(24));
            this.setFieldValue("sectionDividerHeight", new Float(40));
            this.setFieldValue("sectionDividerMinWidth", new Float(117));
            this.setFieldValue("sectionDividerSpacing", new Float(10));
        }
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.setFieldValue("sectionDividerBitmapUri", new BrsString(this.dividerUri));
        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.lastPressHandled = "";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "content") {
            const retValue = super.set(index, value, alwaysNotify, kind);
            let focus = -1;
            if (value instanceof ContentNode && value.getNodeChildren().length) {
                focus = 0;
            }
            this.set(new BrsString("jumpToItem"), new Int32(focus));
            return retValue;
        } else if (["jumptoitem", "animatetoitem"].includes(fieldName)) {
            const focusedIndex = jsValueOf(this.getFieldValue("itemFocused"));
            if (focusedIndex !== jsValueOf(value)) {
                super.set(new BrsString("itemUnfocused"), new Int32(this.focusIndex));
                this.focusIndex = jsValueOf(value);
                index = new BrsString("itemFocused");
            } else {
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "itemfocused" || fieldName === "itemunfocused") {
            // Read-only fields
            return BrsInvalid.Instance;
        } else if (fieldName === "vertfocusanimationstyle") {
            const style = value.toString().toLowerCase();
            if (["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(style)) {
                this.wrap = style === "fixedfocuswrap";
            } else {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (
            fieldName === "horizfocusanimationstyle" &&
            !["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())
        ) {
            // Invalid horizFocusAnimationStyle
            return BrsInvalid.Instance;
        }
        const result = super.set(index, value, alwaysNotify, kind);
        // Update the current row if some fields changed
        if (
            ["vertfocusanimationstyle", "numrows", "focusrow"].includes(index.value.toLowerCase())
        ) {
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
            handled = press ? this.handleUpDown(key) : false;
        } else if (key === "left" || key === "right") {
            handled = press ? this.handleLeftRight(key) : false;
        } else if (key === "rewind" || key === "fastforward") {
            handled = press ? this.handlePageUpDown(key) : false;
        } else if (key === "OK") {
            handled = this.handleOK(press);
        }
        this.lastPressHandled = handled && key !== "OK" ? key : "";
        return handled;
    }

    protected handleUpDown(_key: string) {
        return false;
    }

    protected handleLeftRight(_key: string) {
        return false;
    }

    protected handlePageUpDown(_key: string) {
        return false;
    }

    protected handleOK(_press: boolean) {
        return false;
    }

    protected renderSectionDivider(title: string, itemRect: Rect, draw2D?: IfDraw2D) {
        const dividerHeight = jsValueOf(this.getFieldValue("sectionDividerHeight")) as number;
        const dividerSpacing = jsValueOf(this.getFieldValue("sectionDividerSpacing")) as number;
        const divRect = { ...itemRect, height: dividerHeight };
        let margin = 0;
        if (title.length !== 0) {
            const font = this.getFieldValue("sectionDividerFont") as Font;
            const color = jsValueOf(this.getFieldValue("sectionDividerTextColor"));
            const size = this.drawText(title, font, color, divRect, "left", "center", 0, draw2D);
            margin = size.width + dividerSpacing;
        }
        const bmp = this.getBitmap("sectionDividerBitmapUri");
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? 2 : bmp.height;
            const rect = {
                x: divRect.x + margin,
                y: divRect.y + Math.round((dividerHeight - height) / 2),
                width: divRect.width - margin,
                height: height,
            };
            this.drawImage(bmp, rect, 0, draw2D);
        }
        return dividerHeight;
    }

    protected renderWrapDivider(itemRect: Rect, draw2D?: IfDraw2D) {
        const bmp = this.getBitmap("wrapDividerBitmapUri");
        const dividerHeight = jsValueOf(this.getFieldValue("wrapDividerHeight"));
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? 2 : bmp.height;
            const topOffset = Math.round((dividerHeight - height) / 2);
            const rect = { ...itemRect, y: itemRect.y + topOffset, height: height };
            this.drawImage(bmp, rect, 0, draw2D);
        }
        return dividerHeight;
    }

    protected getContentItems() {
        const content = this.getFieldValue("content") as ContentNode;
        const sections = content.getNodeChildren();
        const items: RoSGNode[] = [];
        const dividers: string[] = [];
        for (const section of sections) {
            if (section.getFieldValue("ContentType").toString().toLowerCase() === "section") {
                const sectItems = section.getNodeChildren();
                const sectDivs = new Array(sectItems.length).fill("");
                sectDivs[0] = "-" + section.getFieldValue("title").toString();
                dividers.push(...sectDivs);
                items.push(...sectItems);
            }
        }
        if (items.length === 0 && sections.length > 0) {
            items.push(...sections);
        }
        this.contentLength = items.length;
        return { items, dividers };
    }

    protected updateCurrRow() {
        const numCols = jsValueOf(this.getFieldValue("numColumns")) || 1;
        const focusRow = jsValueOf(this.getFieldValue("focusRow")) as number;
        if (!this.wrap) {
            const currentFocus = Math.floor(this.focusIndex / numCols);
            const numRows = jsValueOf(this.getFieldValue("numRows")) as number;

            if (currentFocus >= 0 && currentFocus < numRows) {
                return currentFocus;
            }

            const rowStep1 = Math.min(this.currRow, numRows - 1);
            const rowStep2 = Math.max(0, rowStep1);
            const rowStep3 = Math.max(rowStep2, focusRow);
            return Math.min(rowStep3, currentFocus);
        }
        return focusRow;
    }

    protected getIndex(offset: number = 0) {
        const numCols = jsValueOf(this.getFieldValue("numColumns")) || 1;
        const focusRow = Math.floor(this.focusIndex / numCols);
        const maxRows = Math.ceil(this.contentLength / numCols);

        let nextRow = focusRow + offset;

        if (this.wrap) {
            nextRow = (nextRow + maxRows) % maxRows;
        } else if (nextRow >= maxRows) {
            nextRow = maxRows - 1;
        } else if (nextRow < 0) {
            nextRow = 0;
        }
        return nextRow * numCols;
    }
}
