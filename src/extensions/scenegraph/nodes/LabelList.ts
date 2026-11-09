import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, Interpreter, BrsString, BrsType, Int32, RoBitmap, IfDraw2D, Rect, RectRect } from "brs-engine";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { brsValueOf } from "../factory/Serializer";

const ValidFocusStyles = new Set(
    [FocusStyle.FixedFocusWrap, FocusStyle.FloatingFocus].map((style) => style.toLowerCase())
);

export class LabelList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "textHorizAlign", type: "string", value: "left" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "focusedColor", type: "color", value: "0x262626ff" },
        { name: "font", type: "font" },
        { name: "focusedFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocusWrap },
    ];

    protected readonly focusUri = "common:/images/focus_list.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.LabelList) {
        super([], name);
        this.setExtendsType(SGNodeType.LabelList, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.setValueSilent("itemSize", brsValueOf([510, 72]));
        } else {
            this.setValueSilent("itemSize", brsValueOf([340, 48]));
        }
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(ArrayGrid.builtinFootprintUri));
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
            // Invalid fields for LabelList
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
        const offset = key === "up" ? -1 : 1;
        const nextIndex = this.getIndex(offset);
        if (nextIndex !== this.focusIndex) {
            this.setValue("animateToItem", new Int32(nextIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        let handled = false;
        let nextIndex: number;
        if (this.wrap) {
            const step = Math.max(1, this.numRows - 2);
            const offset = key === "rewind" ? -step : step;
            nextIndex = this.getIndex(offset);
        } else {
            nextIndex = key === "rewind" ? 0 : this.content.length - 1;
            this.currRow = key === "rewind" ? 0 : this.numRows - 1;
        }
        if (nextIndex !== this.focusIndex) {
            this.setValue("animateToItem", new Int32(nextIndex));
            handled = true;
        }
        return handled;
    }

    protected renderContent(
        _interpreter: Interpreter,
        rect: Rect,
        _rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        }
        const hasSections = this.metadata.length > 0;
        const nodeFocus = sgRoot.focused === this;
        this.currRow = this.updateListCurrRow();
        const displayRows = Math.min(this.content.length, this.numRows);
        const itemSize = this.getValueJS("itemSize") as number[];
        // DEVICE-MEASURED (Streaming Stick, Roku OS 15.2): a LabelList DOES honor rowHeights and
        // rowSpacings, and there is no extra per-row pixel. With rowHeights [100,50,200] and
        // rowSpacings [10,20] over itemSize.y = 40, the reported extent was 350 + 30 + margins —
        // i.e. the per-row values, the gaps AFTER each row (the trailing entry dropped), and nothing
        // else. This loop used to advance by `itemSize[1] + 1`, honoring none of it.
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacings = this.getValueJS("rowSpacings") as number[];
        const spacing = this.getValueJS("itemSpacing") as number[];
        const rowSpacingDefault = Array.isArray(spacing) ? spacing[1] ?? 0 : 0;
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        let sectionIndex = displayRows + 1;
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
            return heightOf(r) + (index < 0 ? rowSpacingDefault : rowSpacings[index] ?? rowSpacingDefault);
        };
        let firstRow = 0;
        let lastRow = displayRows;
        let focusRect: Rect | undefined;
        const drawFocus = this.getValueJS("drawFocusFeedback") as boolean;
        const drawFocusOnTop = this.focusFeedbackOnTop();
        if (motion) {
            const rows = this.motionRowLayout(motion, displayRows, spanOf, heightOf);
            firstRow = rows.firstRow;
            lastRow = rows.lastRow;
            itemRect.y = rect.y + rows.firstY;
            focusRect = this.listMotionFocusRect(rect, rows, itemSize[0]);
            if (drawFocus && !drawFocusOnTop) {
                this.renderMotionFocus(focusRect, motion.visualIndex, opacity, draw2D);
            }
            this.pushMotionClip(rect, rows.viewportHeight, draw2D);
        }
        try {
            this.renderRows(
                firstRow,
                lastRow,
                motion,
                itemRect,
                rowHeights,
                rowSpacings,
                rowSpacingDefault,
                spanOf,
                screen,
                {
                    hasSections,
                    nodeFocus,
                    opacity,
                    sectionIndex,
                    draw2D,
                }
            );
        } finally {
            if (motion) {
                draw2D?.popClip();
            }
        }
        if (motion && focusRect && drawFocus && drawFocusOnTop) {
            this.renderMotionFocus(focusRect, motion.visualIndex, opacity, draw2D);
        }
        this.updateRect(rect, displayRows, itemSize, { firstRow: Math.max(0, this.getRenderRowIndex(0)) });
    }

    /** Draws viewport rows `firstRow`..`lastRow - 1`, advancing `itemRect` down the list. */
    private renderRows(
        firstRow: number,
        lastRow: number,
        motion: { visualIndex: number } | undefined,
        itemRect: Rect,
        rowHeights: number[],
        rowSpacings: number[],
        rowSpacingDefault: number,
        spanOf: (r: number) => number,
        screen: Rect,
        ctx: { hasSections: boolean; nodeFocus: boolean; opacity: number; sectionIndex: number; draw2D?: IfDraw2D }
    ) {
        const { hasSections, nodeFocus, opacity, draw2D } = ctx;
        const itemSize = this.getValueJS("itemSize") as number[];
        let { sectionIndex } = ctx;
        let lastIndex = -1;
        for (let r = firstRow; r < lastRow; r++) {
            const index = motion ? this.motionRowIndex(r) : this.getRenderRowIndex(r);
            if (index < 0) {
                if (motion) {
                    itemRect.y += spanOf(r);
                    continue;
                }
                break;
            }
            // In motion the focused style follows the item nearest the moving focus.
            const focused = index === (motion ? motion.visualIndex : this.focusIndex);
            const item = this.getContentItem(index);
            if (!hasSections && this.wrap && index < lastIndex && r > firstRow) {
                itemRect.y += this.renderWrapDivider(itemRect, opacity, draw2D);
            } else if (hasSections && this.wrap && this.metadata[index]?.divider && r > firstRow) {
                const divText = this.metadata[index].sectionTitle;
                itemRect.y += this.renderSectionDivider(divText, itemRect, opacity, sectionIndex, draw2D);
                sectionIndex++;
            }
            // Per-row overrides are indexed by ABSOLUTE row, top to bottom, falling back to
            // itemSize.y / itemSpacing.y past the end of each array (never repeating the last entry).
            itemRect.height = rowHeights[index] ?? itemSize[1];
            this.renderItem(index, item, itemRect, opacity, nodeFocus, focused, draw2D);
            itemRect.y += itemRect.height + (rowSpacings[index] ?? rowSpacingDefault);
            lastIndex = index;
            if (!motion && !RectRect(screen, itemRect)) {
                break;
            }
        }
    }

    protected renderItem(
        index: number,
        item: ContentNode,
        rect: Rect,
        opacity: number,
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const icons = ["HDListItemIconUrl", "HDListItemIconSelectedUrl"];
        const iconSize = item.getIconSize(icons);
        const text = item.getValueJS("title");
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = iconGap > 0 ? item.getBitmap(icons[iconIndex]) : undefined;
        if (itemFocus) {
            this.renderFocused(index, text, rect, opacity, nodeFocus, iconGap, false, bmp, draw2D);
        } else {
            this.renderUnfocused(index, text, rect, opacity, iconGap, false, bmp, draw2D);
        }
    }

    protected renderUnfocused(
        index: number,
        text: string,
        rect: Rect,
        opacity: number,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getValue("font");
        const color = this.getValueJS("color") as number;
        const align = this.getValueJS("textHorizAlign") as string;
        const textRect = { ...rect, x: rect.x + iconGap, width: rect.width - (iconGap ? this.gap : 0) };
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, opacity, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, opacity, textRect, align, "center", 0, draw2D, "...", index);
    }

    protected renderFocused(
        index: number,
        text: string,
        rect: Rect,
        opacity: number,
        nodeFocus: boolean,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getValue(nodeFocus ? "focusedFont" : "font");
        const color = this.getValueJS(nodeFocus ? "focusedColor" : "color") as number;
        const align = this.getValueJS("textHorizAlign") as string;
        const textRect = { ...rect, x: rect.x + iconGap, width: rect.width - (iconGap ? this.gap : 0) };
        const drawFocus = this.getValueJS("drawFocusFeedback") as boolean;
        // While the focus moves, the indicator is drawn once at its in-transit slot instead.
        const drawItemFocus = drawFocus && !this.motion;
        const drawFocusOnTop = this.focusFeedbackOnTop();
        if (drawItemFocus && !drawFocusOnTop) {
            this.renderFocus(rect, opacity, nodeFocus, draw2D, index);
        }
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, opacity, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, opacity, textRect, align, "center", 0, draw2D, "...", index);
        if (drawItemFocus && drawFocusOnTop) {
            this.renderFocus(rect, opacity, nodeFocus, draw2D, index);
        }
        this.hasNinePatch &&= drawFocus;
    }

    protected focusMargins() {
        // Short list rows must hug: use the grid's marginX/marginY, not the 9-patch's own 19px
        // content margins (which would make the focus frame overflow into the neighbouring rows).
        return { left: this.marginX, right: this.marginX, top: this.marginY, bottom: this.marginY };
    }

    protected renderIcon(bmp: RoBitmap, rect: Rect, opacity: number, draw2D?: IfDraw2D, color?: number) {
        const iconY = rect.y + (rect.height / 2 - bmp.height / 2);
        const iconRect = { ...rect, y: iconY, width: bmp.width, height: bmp.height };
        this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
    }
}
