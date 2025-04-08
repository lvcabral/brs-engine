import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    customNodeExists,
    Int32,
    jsValueOf,
    rootObjects,
    ValueKind,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
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
    protected readonly margin: number;
    protected wrap: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.margin = 36;
        } else {
            this.margin = 24;
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";

        this.hasNinePatch = true;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (!["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())) {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (["horizfocusanimationstyle", "numcolumns"].includes(fieldName)) {
            // Invalid fields for LabelList
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
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
            this.set(new BrsString("animateToItem"), new Int32(itemIndex));
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
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const hasSections = this.metadata.length > 0;
        const itemCompName = this.getFieldValue("itemComponentName") as BrsString;
        if (!customNodeExists(interpreter, itemCompName)) {
            BrsDevice.stderr.write(
                `warning,[sg.markuplist.create.fail] Failed to create markup item ${itemCompName}`
            );
            return;
        }
        const itemSize = jsValueOf(this.getFieldValue("itemSize"));
        const numRows = jsValueOf(this.getFieldValue("numRows"));
        if (itemSize[0] === 0 || itemSize[1] === 0 || numRows === 0) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = jsValueOf(this.getFieldValue("itemSpacing"));
        const rowHeights = jsValueOf(this.getFieldValue("rowHeights"));
        const rowSpacings = jsValueOf(this.getFieldValue("rowSpacings"));
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const displayRows = Math.min(Math.ceil(this.content.length), numRows);

        const rowWidth = itemSize[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getIndex(r - this.currRow);
            itemRect.height = rowHeights[rowIndex] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && this.metadata[rowIndex]?.divider && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divText = this.metadata[rowIndex].sectionTitle;
                const divHeight = this.renderSectionDivider(divText, divRect, draw2D);
                itemRect.y += divHeight + spacing[1];
            }
            itemRect.width = itemSize[0];
            const index = rowIndex;
            if (index >= this.content.length) {
                break;
            }
            this.renderItemComponent(interpreter, index, itemRect, rotation, draw2D);
            lastIndex = index;
            itemRect.x = rect.x;
            itemRect.y += itemRect.height + (rowSpacings[r] ?? spacing[1]);
        }
        rect.x = rect.x - (this.hasNinePatch ? this.margin : 0);
        rect.y = rect.y - (this.hasNinePatch ? 4 : 0);
        rect.width = itemSize[0] + (this.hasNinePatch ? this.margin * 2 : 0);
        rect.height = displayRows * (itemSize[1] + (this.hasNinePatch ? 9 : 0));
    }
}
