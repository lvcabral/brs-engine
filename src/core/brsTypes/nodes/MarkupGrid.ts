import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import {
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    createNodeByType,
    Group,
    Int32,
    jsValueOf,
    rootObjects,
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
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected readonly margin: number;
    protected readonly gap: number;
    protected readonly sections: Map<number, Array<Group>>;
    protected wrap: boolean;
    protected currRow: number;
    protected hasNinePatch: boolean;
    protected lastPressHandled: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.sections = new Map();
        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.margin = 36;
        } else {
            this.margin = 24;
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.gap = this.margin / 2;
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
        if (fieldName === "content") {
            this.sections.clear();
        }
        return super.set(index, value, alwaysNotify, kind);
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
        } else if (key === "OK") {
            //handled = this.handleOK(press);
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    protected handleUpDown(key: string) {
        let handled = false;
        const offset = key === "up" ? -1 : 1;
        const nextIndex = this.focusIndex + offset;
        if (nextIndex !== this.focusIndex) {
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
        if (nextIndex !== this.focusIndex) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const itemCompName = this.getFieldValue("itemComponentName") as BrsString;
        const content = this.getFieldValue("content") as ContentNode;
        if (content.getNodeChildren().length === 0 || itemCompName.getValue().trim() === "") {
            return;
        }
        const section = content.getNodeChildren()[0];
        if (this.sections.size === 0) {
            this.sections.set(0, []);
        }
        const items = this.sections.get(0);
        const childCount = section.getNodeChildren().length;
        if (childCount === 0 || items === undefined) {
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const nodeFocus = interpreter.environment.getFocusedNode() === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const itemSize = jsValueOf(this.getFieldValue("itemSize"));
        const spacing = jsValueOf(this.getFieldValue("itemSpacing"));
        const numRows = jsValueOf(this.getFieldValue("numRows"));
        const numCols = jsValueOf(this.getFieldValue("numColumns"));
        if (itemSize[0] === 0 || itemSize[1] === 0 || numRows === 0 || numCols === 0) {
            return;
        }
        let focusRow = jsValueOf(this.getFieldValue("focusRow"));
        if (!this.wrap) {
            this.currRow = Math.max(0, Math.min(this.currRow, numRows - 1));
            this.currRow = Math.min(Math.max(this.currRow, focusRow), this.focusIndex);
        } else {
            this.currRow = focusRow;
        }
        const displayRows = Math.min(Math.ceil(childCount / numCols), numRows);
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        renderRow: for (let r = 0; r < displayRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const index = r * numCols + c;
                if (index >= childCount) {
                    break;
                }
                const focused = index === this.focusIndex;
                const item = section.getNodeChildren()[index];
                if (item instanceof ContentNode) {
                    if (items[index] === undefined) {
                        const itemComp = createNodeByType(interpreter, itemCompName);
                        if (itemComp instanceof Group) {
                            items[index] = itemComp;
                            itemComp.setFieldValue("width", brsValueOf(itemSize[0]));
                            itemComp.setFieldValue("height", brsValueOf(itemSize[1]));
                            itemComp.set(new BrsString("itemContent"), item, true);
                        } else {
                            BrsDevice.stderr.write(
                                `warning,[sg.markupgrid.create.fail] Failed to create markup item ${itemCompName}`
                            );
                            break renderRow;
                        }
                    }
                    const drawFocus = jsValueOf(this.getFieldValue("drawFocusFeedback"));
                    const drawFocusOnTop = jsValueOf(this.getFieldValue("drawFocusFeedbackOnTop"));
                    if (focused && drawFocus && !drawFocusOnTop) {
                        this.renderFocus(itemRect, nodeFocus, draw2D);
                    }
                    if (items[index] instanceof Group) {
                        const itemOrigin = [itemRect.x, itemRect.y];
                        items[index].renderNode(interpreter, itemOrigin, rotation, draw2D);
                    }
                    if (focused && drawFocus && drawFocusOnTop) {
                        this.renderFocus(itemRect, nodeFocus, draw2D);
                    }
                }
                itemRect.x += itemSize[0] + spacing[0];
            }
            itemRect.x = rect.x;
            itemRect.y += itemSize[1] + spacing[1];
        }
        rect.x = rect.x - (this.hasNinePatch ? this.margin : 0);
        rect.y = rect.y - (this.hasNinePatch ? 4 : 0);
        rect.width = numCols * (itemSize[0] + (this.hasNinePatch ? this.margin * 2 : 0));
        rect.height = displayRows * (itemSize[1] + (this.hasNinePatch ? 9 : 0));
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
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

    protected updateCurrRow() {
        if (this.wrap) {
            return jsValueOf(this.getFieldValue("focusRow"));
        }
        return jsValueOf(this.getFieldValue("numRows")) - 1;
    }
}
