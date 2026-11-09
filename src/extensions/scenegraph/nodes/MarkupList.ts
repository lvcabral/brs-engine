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
    protected readonly gap: number;
    private itemComponentErrorLogged = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MarkupList) {
        super([], name);
        this.setExtendsType(SGNodeType.MarkupList, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.gap = 0;
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(ArrayGrid.builtinFootprintUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        // Re-derive the cached focus style now that this node's own default (fixedFocusWrap) and any
        // XML/initialized value are in place — the ArrayGrid constructor cached its floatingFocus default.
        this.applyVertFocusStyle();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
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

    /** A list draws its indicator under the items unless `drawFocusFeedbackOnTop` is written true. */
    protected focusOnTopByDefault(): boolean {
        return false;
    }

    protected focusMotionEnabled(): boolean {
        return true;
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
        // A wrap on a single-item list resolves to the focused index itself: the move is a no-op
        // and must NOT report handled, so the key bubbles to an ancestor's onKeyEvent.
        if (nextIndex >= 0 && nextIndex < this.content.length && nextIndex !== this.focusIndex) {
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
        const displayRows = Math.min(Math.ceil(this.content.length), this.numRows);

        const rowWidth = itemSize[0];
        // Culling bound for the loop below; the scene map does not change inside it.
        const screen = this.visibleSceneRect();
        // Focus in motion: the settled layout scrolled by the rows it passes, plus the rows scrolling in/out.
        const motion = this.listMotionFrame(displayRows);
        const heightOf = (r: number) => {
            const index = this.motionRowIndex(r);
            return index < 0 ? itemSize[1] : rowHeights[index] ?? itemSize[1];
        };
        const spanOf = (r: number) => {
            const index = this.motionRowIndex(r);
            return heightOf(r) + (index < 0 ? spacing[1] : rowSpacings[index] ?? spacing[1]);
        };
        let firstRow = 0;
        let lastRow = displayRows;
        let focusRect: Rect | undefined;
        const drawFocusOnTop = this.focusFeedbackOnTop();
        if (motion) {
            const rows = this.motionRowLayout(motion, displayRows, spanOf, heightOf);
            firstRow = rows.firstRow;
            lastRow = rows.lastRow;
            itemRect.y = rect.y + rows.firstY;
            focusRect = this.listMotionFocusRect(rect, rows, itemSize[0]);
            // The moving indicator goes under the items unless it is drawn on top (see focusFeedbackOnTop).
            if (!drawFocusOnTop) {
                this.renderMotionFocus(focusRect, motion.visualIndex, opacity, draw2D);
            }
            this.pushMotionClip(rect, rows.viewportHeight, draw2D);
        }
        try {
            this.renderRows(interpreter, firstRow, lastRow, motion !== undefined, itemRect, rect, {
                hasSections,
                spacing,
                rowHeights,
                rowSpacings,
                itemSize,
                rowWidth,
                spanOf,
                screen,
                rotation,
                opacity,
                draw2D,
            });
        } finally {
            if (motion) {
                draw2D?.popClip();
            }
        }
        if (motion && focusRect && drawFocusOnTop) {
            this.renderMotionFocus(focusRect, motion.visualIndex, opacity, draw2D);
        }
        this.updateRect(rect, displayRows, itemSize, { firstRow: Math.max(0, this.getRenderRowIndex(0)) });
    }

    /** Draws viewport rows `firstRow`..`lastRow - 1`, advancing `itemRect` down the list. */
    private renderRows(
        interpreter: Interpreter,
        firstRow: number,
        lastRow: number,
        moving: boolean,
        itemRect: Rect,
        rect: Rect,
        ctx: {
            hasSections: boolean;
            spacing: number[];
            rowHeights: number[];
            rowSpacings: number[];
            itemSize: number[];
            rowWidth: number;
            spanOf: (r: number) => number;
            screen: Rect;
            rotation: number;
            opacity: number;
            draw2D?: IfDraw2D;
        }
    ) {
        const {
            hasSections,
            spacing,
            rowHeights,
            rowSpacings,
            itemSize,
            rowWidth,
            spanOf,
            screen,
            rotation,
            opacity,
            draw2D,
        } = ctx;
        let lastIndex = -1;
        let sectionIndex = 0;
        for (let r = firstRow; r < lastRow; r++) {
            const rowIndex = moving ? this.motionRowIndex(r) : this.getRenderRowIndex(r);
            if (rowIndex < 0) {
                if (moving) {
                    itemRect.y += spanOf(r);
                    continue;
                }
                break;
            }
            itemRect.height = rowHeights[rowIndex] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && r > firstRow) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, opacity, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && this.metadata[rowIndex]?.divider && r > firstRow) {
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
            // Per-row overrides are indexed by ABSOLUTE row, top to bottom — not by the display slot,
            // which differs as soon as the list is scrolled (rowHeights above already does this).
            itemRect.y += itemRect.height + (rowSpacings[rowIndex] ?? spacing[1]);
            if (!moving && !RectRect(screen, itemRect)) {
                break;
            }
        }
    }

    protected focusMargins() {
        // Like LabelList, a MarkupList is a short-row list: use the grid's marginX/marginY, not the
        // 9-patch's own 19px content margins, so the focus frame hugs the row instead of overflowing.
        return { left: this.marginX, right: this.marginX, top: this.marginY, bottom: this.marginY };
    }

    /**
     * Like MarkupGrid, a real device reports a MarkupList's bounding rect as exactly the laid-out
     * item extent (rows of itemSize plus spacing) with NO focus-bitmap outset. The outset would
     * also be unstable: renderFocus re-derives hasNinePatch from whichever bitmap was drawn last,
     * so a list whose focus bitmap is a 9-patch but whose footprint is a plain image would grow
     * when focused and shrink when not — visibly shifting siblings a LayoutGroup places below it.
     * The marginX/marginY outset still drives the drawn focus frame (focusMargins), just not the
     * reported rects.
     */
    protected rectMargins(): { x: number; y: number } {
        return { x: 0, y: 0 };
    }
}
