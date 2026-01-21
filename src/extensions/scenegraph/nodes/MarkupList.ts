import { AAMember, Interpreter, BrsDevice, BrsString, BrsType, Int32, IfDraw2D, Rect, RectRect } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { customNodeExists } from "../factory/NodeFactory";

const ValidFocusStyles = new Set(
    [FocusStyle.FixedFocusWrap, FocusStyle.FloatingFocus].map((style) => style.toLowerCase())
);

export class MarkupList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocusWrap },
    ];
    protected readonly focusUri = "common:/images/focus_list.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";
    protected readonly gap: number;
    protected wrap: boolean;
    private itemComponentErrorLogged = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MarkupList) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.gap = 0;
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const style = this.getValueJS("vertFocusAnimationStyle") as string;
        this.wrap = style.toLowerCase() === FocusStyle.FixedFocusWrap.toLowerCase();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (!ValidFocusStyles.has(value.toString().toLowerCase())) {
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
        const itemCompName = this.getValueJS("itemComponentName") as string;
        if (!customNodeExists(itemCompName)) {
            if (!this.itemComponentErrorLogged) {
                const name = itemCompName.trim() || "missing 'itemComponentName'";
                BrsDevice.stderr.write(`error,[sg.markuplist.create.fail] Failed to create item: ${name}`);
                this.itemComponentErrorLogged = true;
            }
            return;
        }
        const itemSize = this.getValueJS("itemSize") as number[];
        if (itemSize[0] === 0 || itemSize[1] === 0 || this.numRows === 0) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = this.getValueJS("itemSpacing") as number[];
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacings = this.getValueJS("rowSpacings") as number[];
        this.currRow = this.updateListCurrRow();
        let lastIndex = -1;
        let sectionIndex = 0;
        const displayRows = Math.min(Math.ceil(this.content.length), this.numRows);

        const rowWidth = itemSize[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0) {
                break;
            }
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
