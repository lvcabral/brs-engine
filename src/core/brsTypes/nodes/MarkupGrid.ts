import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import {
    BrsBoolean,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    createNodeByType,
    customNodeExists,
    Group,
    Int32,
    jsValueOf,
    rootObjects,
    RoSGNode,
    ValueKind,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../../interpreter";
import { rotateTranslation } from "../../scenegraph/SGUtil";
import { BrsDevice } from "../../device/BrsDevice";

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "true" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly margin: number;
    protected readonly sections: Map<number, Array<Group>>;
    protected wrap: boolean;
    protected hasNinePatch: boolean;
    protected contentLength: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.sections = new Map();
        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.margin = 36;
        } else {
            this.margin = 24;
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";

        this.hasNinePatch = true;
        this.contentLength = 0;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "content") {
            this.sections.clear();
        } else if (["jumptoitem", "animatetoitem"].includes(fieldName)) {
            const nextFocus = jsValueOf(value);
            if (this.focusIndex !== nextFocus) {
                this.updateItemFocus(this.focusIndex, false);
                this.updateItemFocus(nextFocus, true);
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    private updateItemFocus(index: number, focus: boolean) {
        const items = this.sections.get(0);
        if (items?.[index]) {
            items[index].set(new BrsString("itemHasFocus"), BrsBoolean.from(focus));
            items[index].set(new BrsString("focusPercent"), new Int32(focus ? 1 : 0));
        }
    }

    protected handleUpDown(key: string) {
        let handled = false;
        const numCols = jsValueOf(this.getFieldValue("numColumns")) as number;
        const offset = key === "up" ? -1 : 1;
        const nextIndex = this.wrap ? this.getIndex(offset) : this.focusIndex + offset * numCols;

        if (nextIndex >= 0 && nextIndex < this.contentLength) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handleLeftRight(key: string) {
        let handled = false;
        const offset = key === "left" ? -1 : 1;
        const nextIndex = this.focusIndex + offset;

        if (nextIndex >= 0 && nextIndex < this.contentLength) {
            const numCols = jsValueOf(this.getFieldValue("numColumns")) as number;
            const currentRow = Math.floor(this.focusIndex / numCols);
            const nextRow = Math.floor(nextIndex / numCols);
            if (currentRow === nextRow) {
                this.set(new BrsString("animateToItem"), new Int32(nextIndex));
                handled = true;
            }
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        let handled = false;
        const numCols = jsValueOf(this.getFieldValue("numColumns")) as number;
        const currentRow = Math.floor(this.focusIndex / numCols);
        const lastRow = Math.floor(this.contentLength / numCols) - 1;
        const offset =
            key === "rewind" ? -(currentRow * numCols) : (lastRow - currentRow) * numCols;
        let nextIndex = this.focusIndex + offset;

        if (nextIndex >= 0 && nextIndex < this.contentLength) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
        }
        return handled;
    }

    protected handleOK(press: boolean) {
        if (press) {
            this.set(new BrsString("itemSelected"), new Int32(this.focusIndex));
        }
        return false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        if (this.sections.size === 0) {
            this.sections.set(0, []);
        }
        this.renderGrid(interpreter, rect, rotation, draw2D);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }

    protected renderGrid(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        draw2D?: IfDraw2D
    ) {
        const { items, dividers } = this.getContentItems();
        if (this.contentLength === 0) {
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const hasSections = dividers.length > 0;
        const itemCompName = this.getFieldValue("itemComponentName") as BrsString;
        if (!customNodeExists(interpreter, itemCompName)) {
            BrsDevice.stderr.write(
                `warning,[sg.markupgrid.create.fail] Failed to create markup item ${itemCompName}`
            );
            return;
        }
        const itemSize = jsValueOf(this.getFieldValue("itemSize"));
        const numRows = jsValueOf(this.getFieldValue("numRows"));
        const numCols = jsValueOf(this.getFieldValue("numColumns"));
        if (itemSize[0] === 0 || itemSize[1] === 0 || numRows === 0 || numCols === 0) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = jsValueOf(this.getFieldValue("itemSpacing"));
        const columnWidths = jsValueOf(this.getFieldValue("columnWidths"));
        const columnSpacings = jsValueOf(this.getFieldValue("columnSpacings"));
        const rowHeights = jsValueOf(this.getFieldValue("rowHeights"));
        const rowSpacings = jsValueOf(this.getFieldValue("rowSpacings"));
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const displayRows = Math.min(Math.ceil(this.contentLength / numCols), numRows);

        const rowWidth = numCols * itemSize[0] + (numCols - 1) * spacing[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getIndex(r - this.currRow);
            const focused = rowIndex === this.focusIndex;
            itemRect.height = rowHeights[rowIndex / numCols] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && !focused) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && dividers[rowIndex] !== "" && !focused) {
                const divRect = { ...itemRect, width: rowWidth };
                const divText = dividers[rowIndex].substring(1);
                const divHeight = this.renderSectionDivider(divText, divRect, draw2D);
                itemRect.y += divHeight + spacing[1];
            }
            for (let c = 0; c < numCols; c++) {
                itemRect.width = columnWidths[c] ?? itemSize[0];
                const index = rowIndex + c;
                if (index >= this.contentLength) {
                    break;
                }
                this.renderItem(interpreter, index, itemRect, items[index], rotation, draw2D);
                itemRect.x += itemRect.width + (columnSpacings[c] ?? spacing[0]);
                lastIndex = index;
            }
            itemRect.x = rect.x;
            itemRect.y += itemRect.height + (rowSpacings[r] ?? spacing[1]);
        }
        rect.x = rect.x - (this.hasNinePatch ? this.margin : 0);
        rect.y = rect.y - (this.hasNinePatch ? 4 : 0);
        rect.width = numCols * (itemSize[0] + (this.hasNinePatch ? this.margin * 2 : 0));
        rect.height = displayRows * (itemSize[1] + (this.hasNinePatch ? 9 : 0));
    }

    protected renderItem(
        interpreter: Interpreter,
        index: number,
        itemRect: Rect,
        content: RoSGNode,
        rotation: number,
        draw2D?: IfDraw2D
    ) {
        const section = this.sections.get(0);
        if (!(content instanceof ContentNode) || !section) {
            return;
        }
        const nodeFocus = rootObjects.focused === this;
        const focused = index === this.focusIndex;
        if (section[index] === undefined) {
            const itemCompName = this.getFieldValue("itemComponentName") as BrsString;
            const itemComp = createNodeByType(interpreter, itemCompName);
            if (itemComp instanceof Group) {
                section[index] = itemComp;
                itemComp.setFieldValue("width", brsValueOf(itemRect.width));
                itemComp.setFieldValue("height", brsValueOf(itemRect.height));
                itemComp.set(new BrsString("itemContent"), content, true);
                itemComp.set(new BrsString("itemHasFocus"), BrsBoolean.from(focused));
                itemComp.set(new BrsString("focusPercent"), new Int32(focused ? 1 : 0));
            }
        }
        const drawFocus = jsValueOf(this.getFieldValue("drawFocusFeedback"));
        const drawFocusOnTop = jsValueOf(this.getFieldValue("drawFocusFeedbackOnTop"));
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, draw2D);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        section[index].renderNode(interpreter, itemOrigin, rotation, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, draw2D);
        }
    }

    protected renderFocus(itemRect: Rect, nodeFocus: boolean, draw2D?: IfDraw2D) {
        const focusBitmap = this.getBitmap("focusBitmapUri");
        const focusFootprint = this.getBitmap("focusFootprintBitmapUri");
        this.hasNinePatch = (focusBitmap?.ninePatch || focusFootprint?.ninePatch) === true;
        const ninePatchRect = {
            x: itemRect.x - 15,
            y: itemRect.y - 15,
            width: itemRect.width + 31,
            height: itemRect.height + 30,
        };
        if (nodeFocus && focusBitmap) {
            const rect = focusBitmap.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusBitmap, rect, 0, draw2D);
        } else if (!nodeFocus && focusFootprint) {
            const rect = focusFootprint.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusFootprint, rect, 0, draw2D);
        }
    }
}
