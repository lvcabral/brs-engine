import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { BrsInvalid, BrsString, BrsType, customNodeExists, Int32, isBrsString } from "..";
import { IfDraw2D, Rect, RectRect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../../interpreter";
import { BrsDevice } from "../../device/BrsDevice";

export class MarkupList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];
    protected readonly focusUri = "common:/images/focus_list.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";
    protected readonly gap: number;
    protected wrap: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.gap = 0;
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const style = this.getFieldValueJS("vertFocusAnimationStyle") as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.numRows = this.getFieldValueJS("numRows") as number;
        this.numCols = this.getFieldValueJS("numColumns") as number;
        this.hasNinePatch = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (!["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())) {
                // Invalid vertFocusAnimationStyle
                return;
            }
        } else if (["horizfocusanimationstyle", "numcolumns"].includes(fieldName)) {
            // Invalid fields for MarkupList
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "content" || fieldName === "vertfocusanimationstyle") {
            this.topRow = 0;
        } else if (fieldName === "numrows") {
            this.clampTopRow();
        }
    }

    protected handleUpDown(key: string) {
        let handled = false;
        let offset: number;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind") {
            offset = -Math.min(Math.ceil(this.content.length) - 1, 6);
        } else if (key === "fastforward") {
            offset = Math.min(Math.ceil(this.content.length) - 1, 6);
        } else {
            return false;
        }
        let nextIndex = this.focusIndex + offset;
        if (this.wrap) {
            nextIndex = this.getIndex(offset);
        }
        if (nextIndex >= 0 && nextIndex < this.content.length) {
            const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
            this.setValue("animateToItem", new Int32(itemIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const hasSections = this.metadata.length > 0;
        const itemCompName = this.getFieldValueJS("itemComponentName") as string;
        if (!customNodeExists(new BrsString(itemCompName))) {
            BrsDevice.stderr.write(`warning,[sg.markuplist.create.fail] Failed to create markup item ${itemCompName}`);
            return;
        }
        const itemSize = this.getFieldValueJS("itemSize") as number[];
        if (itemSize[0] === 0 || itemSize[1] === 0 || this.numRows === 0) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const rowHeights = this.getFieldValueJS("rowHeights") as number[];
        const rowSpacings = this.getFieldValueJS("rowSpacings") as number[];
        this.currRow = this.updateListCurrRow();
        let lastIndex = -1;
        let sectionIndex = 0;
        const displayRows = Math.min(Math.ceil(this.content.length), this.numRows);

        const rowWidth = itemSize[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getIndex(r - this.currRow);
            itemRect.height = rowHeights[rowIndex] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, opacity, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && this.metadata[rowIndex]?.divider && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divText = this.metadata[rowIndex].sectionTitle;
                const divHeight = this.renderSectionDivider(divText, divRect, opacity, sectionIndex, draw2D);
                sectionIndex++;
                itemRect.y += divHeight + spacing[1];
            }
            itemRect.width = itemSize[0];
            const index = rowIndex;
            if (index >= this.content.length) {
                break;
            }
            this.renderItemComponent(interpreter, index, itemRect, rotation, opacity, draw2D);
            lastIndex = index;
            itemRect.x = rect.x;
            itemRect.y += itemRect.height + (rowSpacings[r] ?? spacing[1]);
            if (!RectRect(this.sceneRect, itemRect)) {
                break;
            }
        }
        this.updateRect(rect, displayRows, itemSize);
    }
}
