import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    IfDraw2D,
    Rect,
    RoFont,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { ContentNode } from "./ContentNode";
import { Font } from "./Font";
import { Group } from "./Group";
import { Poster } from "./Poster";
import { Label } from "./Label";
import { ScrollingLabel } from "./ScrollingLabel";
import { rotateTranslation } from "../SGUtil";
import { sgRoot } from "../SGRoot";

type PosterGridMetadata = ArrayGrid.Metadata & {
    caption1Lines?: number;
    caption2Lines?: number;
};

type CaptionMetrics = {
    caption1Lines: number;
    caption2Lines: number;
    caption1Height: number;
    caption2Height: number;
    totalHeight: number;
};

type PosterItemLayout = {
    width: number;
    height: number;
    posterRect: Rect;
    caption1Rect?: Rect;
    caption2Rect?: Rect;
    captionBackgroundRect?: Rect;
    captionPlacement: string;
    caption1Lines: number;
    caption2Lines: number;
    captionLineSpacing: number;
    offsetY?: number;
};

const HorizAlignments = new Set(["left", "center", "right"]);
const VertAlignments = new Set(["above", "top", "center", "bottom", "below"]);
const ValidFocusStyles = new Set(Object.values(FocusStyle).map((style) => style.toLowerCase()));

export class PosterGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "basePosterSize", type: "vector2d", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocusWrap },
        { name: "useAtlas", type: "boolean", value: "true" },
        { name: "posterDisplayMode", type: "string", value: "noScale" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "imageWellBitmapUri", type: "string", value: "" },
        { name: "loadingBitmapUri", type: "string", value: "" },
        { name: "loadingBitmapOpacity", type: "float", value: "1.0" },
        { name: "failedBitmapUri", type: "string", value: "" },
        { name: "failedBitmapOpacity", type: "float", value: "1.0" },
        { name: "caption1Font", type: "font", value: "font:SmallerBoldSystemFont" },
        { name: "caption1Color", type: "color", value: "0xddddddff" },
        { name: "caption1NumLines", type: "integer", value: "0" },
        { name: "caption2Font", type: "font", value: "font:SmallerBoldSystemFont" },
        { name: "caption2Color", type: "color", value: "0xddddddff" },
        { name: "caption2NumLines", type: "integer", value: "0" },
        { name: "captionBackgroundBitmapUri", type: "string", value: "" },
        { name: "captionHorizAlignment", type: "string", value: "center" },
        { name: "captionVertAlignment", type: "string", value: "below" },
        { name: "captionLineSpacing", type: "float", value: "0.0" },
        { name: "showBackgroundForEmptyCaptions", type: "boolean", value: "true" },
        { name: "enableCaptionScrolling", type: "boolean", value: "true" },
    ];

    private readonly focusUri = "common:/images/focus_grid.9.png";
    private readonly layoutByIndex = new Map<number, PosterItemLayout>();
    private pendingIndex: number = -1;
    private fontHeightCache = new WeakMap<Font, number>();
    private readonly focusPaddingX: number;
    private readonly focusPaddingTop: number;
    private readonly focusPaddingBottom: number;
    private readonly captionVerticalMargin: number;
    private readonly defaultCaptionBackgroundUri: string;
    private focusLayoutOverride?: PosterItemLayout;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PosterGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        const style = (this.getValueJS("vertFocusAnimationStyle") as string) ?? FocusStyle.FixedFocusWrap;
        this.vertFocusAnimationStyleName = style.toLowerCase();
        this.wrap = this.vertFocusAnimationStyleName === FocusStyle.FixedFocusWrap.toLowerCase();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
        if (this.resolution === "FHD") {
            this.focusPaddingTop = 18;
            this.focusPaddingBottom = 18;
            this.captionVerticalMargin = 18;
        } else {
            this.focusPaddingTop = 12;
            this.focusPaddingBottom = 12;
            this.captionVerticalMargin = 12;
        }
        this.focusPaddingX = this.marginX / 2;
        this.focusField = "gridHasFocus";
        this.defaultCaptionBackgroundUri = `common:/images/${this.resolution}/caption_background.9.png`;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "vertfocusanimationstyle" && value instanceof BrsString) {
            const style = value.getValue().toLowerCase();
            if (ValidFocusStyles.has(style)) {
                this.vertFocusAnimationStyleName = style;
                this.wrap = style === FocusStyle.FixedFocusWrap.toLowerCase();
            } else {
                return;
            }
        }
        const affectsLayout = this.shouldResetLayout(fieldName);
        const invalidateVisuals = this.shouldInvalidateItemVisuals(fieldName);
        super.setValue(index, value, alwaysNotify, kind);
        if (affectsLayout) {
            this.layoutByIndex.clear();
            if (fieldName === "numcolumns" || fieldName === "basepostersize") {
                this.itemComps.length = 0;
            }
        }
        if (invalidateVisuals) {
            this.invalidateItemComponents();
        }
    }

    protected processSection(section: ContentNode, itemIndex: number) {
        const content = this.getContentChildren(section);
        const numCols = this.numCols || 1;
        if (content.length === 0) {
            return itemIndex;
        }
        const caption1Override = Number(section.getValueJS("gridCaption1NumLines"));
        const caption2Override = Number(section.getValueJS("gridCaption2NumLines"));
        for (const [index, _item] of content.entries()) {
            const metadata: PosterGridMetadata = { index: itemIndex, divider: false, sectionTitle: "" };
            if (index === 0) {
                metadata.divider = true;
                metadata.sectionTitle = section.getValueJS("title") ?? "";
            }
            if (Number.isFinite(caption1Override)) {
                metadata.caption1Lines = caption1Override;
            }
            if (Number.isFinite(caption2Override)) {
                metadata.caption2Lines = caption2Override;
            }
            this.metadata.push(metadata);
            itemIndex++;
        }
        this.content.push(...content);
        const remainder = content.length % numCols;
        if (remainder > 0) {
            const emptyContent = new ContentNode("_placeholder_");
            const emptyMetadata: PosterGridMetadata = { index: -1, divider: false, sectionTitle: "" };
            for (let i = 0; i < numCols - remainder; i++) {
                this.content.push(emptyContent);
                this.metadata.push(emptyMetadata);
            }
        }
        return itemIndex;
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const contentLength = this.content.length;
        if (contentLength === 0) {
            this.renderImageWell(rect, opacity, draw2D);
            return;
        }
        const baseSize = this.getValueJS("basePosterSize") as number[];
        if (!baseSize || baseSize.length < 2 || baseSize[0] <= 0 || baseSize[1] <= 0) {
            return;
        }
        this.layoutByIndex.clear();
        this.fontHeightCache = new WeakMap();
        const spacing = this.normalizeVector(this.getValueJS("itemSpacing"), [0, 0]);
        const baseColumnSpacing = spacing[0];
        const baseRowSpacing = spacing[1];
        const columnSpacingValues = this.getValueJS("columnSpacings");
        const defaultColumnSpacing = this.resolveSpacingValue(columnSpacingValues, 0, baseColumnSpacing);
        this.numCols = Math.max(1, this.numCols || this.inferColumnCount(baseSize[0], defaultColumnSpacing));
        const totalRows = Math.ceil(contentLength / this.numCols);
        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        const displayRows = Math.max(1, Math.min(desiredRows, totalRows));
        const fixedFocusMode = this.isFixedFocusMode();
        this.currRow = fixedFocusMode ? this.updateCurrRow() : this.updateListCurrRow();
        const columnWidths = this.resolveColumnWidths(baseSize[0]);
        const columnSpacings = this.resolveColumnSpacings(defaultColumnSpacing, columnSpacingValues);
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacingValues = this.getValueJS("rowSpacings");
        const hasSections = this.metadata.length > 0;
        const placement = this.getCaptionPlacement();
        const captionsExtendLayout = this.requiresCaptionZone(placement);
        let lastRowIndex = -1;
        let lastRowNumber = -1;
        let sectionIndex = 0;
        let maxCellHeight = 0;
        const itemRect = { ...rect, width: columnWidths[0], height: baseSize[1] };
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0 || rowIndex >= contentLength) {
                break;
            }
            const rowNumber = Math.floor(rowIndex / this.numCols);
            const posterHeight = this.resolveNumber(rowHeights, rowNumber, baseSize[1]);
            const rowCaptionHeight = captionsExtendLayout ? this.computeRowCaptionHeight(rowIndex, placement) : 0;
            const rowWidth = this.computeRowWidth(columnWidths, columnSpacings);
            const rowHeightWithCaptions = posterHeight + rowCaptionHeight;
            itemRect.height = rowHeightWithCaptions;
            if (!hasSections && this.wrap && rowIndex < lastRowIndex && r > 0) {
                const dividerRect = { ...itemRect, x: rect.x, width: rowWidth };
                const gapAfterPreviousRow =
                    lastRowNumber >= 0
                        ? this.resolveSpacingValue(rowSpacingValues, lastRowNumber, baseRowSpacing)
                        : baseRowSpacing;
                itemRect.y += this.renderWrapDivider(dividerRect, opacity, draw2D) + gapAfterPreviousRow;
            } else if (hasSections && this.wrap && this.getPosterMetadata(rowIndex)?.divider && r > 0) {
                const dividerRect = { ...itemRect, x: rect.x, width: rowWidth };
                const divText = this.getPosterMetadata(rowIndex)?.sectionTitle ?? "";
                const gapAfterPreviousRow =
                    lastRowNumber >= 0
                        ? this.resolveSpacingValue(rowSpacingValues, lastRowNumber, baseRowSpacing)
                        : baseRowSpacing;
                itemRect.y +=
                    this.renderSectionDivider(divText, dividerRect, opacity, sectionIndex, draw2D) +
                    gapAfterPreviousRow;
                sectionIndex++;
            }
            itemRect.x = rect.x;
            for (let c = 0; c < this.numCols; c++) {
                const index = rowIndex + c;
                if (index >= contentLength) {
                    break;
                }
                itemRect.width = columnWidths[c];
                const captionMetrics = this.computeCaptionMetrics(index);
                const captionHeight = captionsExtendLayout ? captionMetrics.totalHeight : 0;
                const offsetY =
                    captionsExtendLayout && placement === "above" ? Math.max(0, rowCaptionHeight - captionHeight) : 0;
                const layout = this.buildItemLayout(
                    columnWidths[c],
                    posterHeight,
                    captionHeight,
                    placement,
                    captionMetrics
                );
                if (offsetY !== 0) {
                    layout.offsetY = offsetY;
                }
                this.layoutByIndex.set(index, layout);
                this.pendingIndex = index;
                this.renderItemComponent(interpreter, index, itemRect, rotation, opacity, draw2D);
                this.pendingIndex = -1;
                const columnGap = columnSpacings[c] ?? defaultColumnSpacing;
                itemRect.x += columnWidths[c] + columnGap;
            }
            maxCellHeight = Math.max(maxCellHeight, rowHeightWithCaptions);
            lastRowIndex = rowIndex;
            lastRowNumber = rowNumber;
            if (itemRect.y > (this.sceneRect?.y ?? 0) + (this.sceneRect?.height ?? 0)) {
                break;
            }
            const rowGap = this.resolveSpacingValue(rowSpacingValues, rowNumber, baseRowSpacing);
            itemRect.y += rowHeightWithCaptions + rowGap;
        }
        this.updateRect(rect, displayRows, [Math.max(...columnWidths), maxCellHeight || baseSize[1]]);
    }

    protected handleUpDown(key: string) {
        const numCols = Math.max(1, this.numCols || 1);
        let offset: number;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind" || key === "fastforward") {
            const pageJump = Math.min(Math.ceil(this.content.length / numCols) - 1, 6);
            if (pageJump <= 0) {
                return false;
            }
            offset = key === "rewind" ? -pageJump : pageJump;
        } else {
            return false;
        }

        if (this.content.length === 0) {
            return false;
        }

        const currentRowStart = Math.floor(this.focusIndex / numCols) * numCols;
        const targetRowStart = this.getIndex(offset);
        if (!this.wrap && targetRowStart === currentRowStart) {
            return false;
        }

        const currentColumn = this.focusIndex % numCols;
        const candidate = this.findFocusableColumnIndex(targetRowStart, currentColumn, -1);
        if (candidate === -1 || candidate === this.focusIndex) {
            return false;
        }

        const itemIndex = this.metadata[candidate]?.index ?? candidate;
        if (itemIndex < 0) {
            return false;
        }

        this.setValue("animateToItem", new Int32(itemIndex));
        const isFixedFocus = this.isFixedFocusMode();
        this.currRow += isFixedFocus ? 0 : offset;
        return true;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected handleLeftRight(key: string) {
        const offset = key === "left" ? -1 : key === "right" ? 1 : 0;
        if (offset === 0) {
            return false;
        }
        const numCols = Math.max(1, this.numCols || 1);
        const rowStart = Math.floor(this.focusIndex / numCols) * numCols;
        let targetColumn = (this.focusIndex % numCols) + offset;
        if (targetColumn < 0 || targetColumn >= numCols) {
            return false;
        }
        const candidate = this.findFocusableColumnIndex(rowStart, targetColumn, offset);
        if (candidate === -1 || candidate === this.focusIndex) {
            return false;
        }
        const itemIndex = this.metadata[candidate]?.index ?? candidate;
        if (itemIndex < 0) {
            return false;
        }
        this.setValue("animateToItem", new Int32(itemIndex));
        return true;
    }

    protected renderItemComponent(
        interpreter: Interpreter,
        index: number,
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const content = this.getContentItem(index);
        const layout = this.layoutByIndex.get(index);
        const nodeFocus = sgRoot.focused === this;
        const focused = index === this.focusIndex;
        if (!this.itemComps[index]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            if (itemComp instanceof Group) {
                this.itemComps[index] = itemComp;
            }
        }
        const itemComp = this.itemComps[index];
        if (!itemComp) {
            return;
        }
        itemComp.setValueSilent("width", new Float(itemRect.width));
        itemComp.setValueSilent("height", new Float(itemRect.height));
        if (itemComp instanceof PosterGridItem) {
            itemComp.setLayout(layout);
        }
        if (content.changed) {
            itemComp.setValue("itemContent", content, true);
            content.changed = false;
        }
        this.updateItemFocus(index, focused, nodeFocus);
        const drawFocus = this.getValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getValueJS("drawFocusFeedbackOnTop");
        if (focused && drawFocus && !drawFocusOnTop) {
            this.focusLayoutOverride = layout;
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
            this.focusLayoutOverride = undefined;
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        itemComp.renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.focusLayoutOverride = layout;
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
            this.focusLayoutOverride = undefined;
        }
    }

    protected renderFocus(itemRect: Rect, opacity: number, nodeFocus: boolean, draw2D?: IfDraw2D) {
        const bmpUri = nodeFocus ? "focusBitmapUri" : "focusFootprintBitmapUri";
        const bmp = this.getBitmap(bmpUri);
        if (!bmp?.isValid()) {
            return;
        }
        const layout = this.focusLayoutOverride;
        const posterRect = layout?.posterRect;
        const baseX = posterRect ? itemRect.x + posterRect.x : itemRect.x;
        const baseWidth = posterRect?.width ?? itemRect.width;
        const baseY = itemRect.y;
        const baseHeight = itemRect.height;
        const extraTop = this.marginY + this.focusPaddingTop;
        const extraBottom = this.marginY + this.focusPaddingBottom;
        const extraHorizontal = this.focusPaddingX;
        const focusRect: Rect = {
            x: baseX - extraHorizontal,
            y: baseY - extraTop,
            width: baseWidth + extraHorizontal * 2,
            height: baseHeight + extraTop + extraBottom,
        };
        this.drawImage(bmp, focusRect, 0, opacity, draw2D);
    }

    protected createItemComponent(_interpreter: Interpreter, itemRect: Rect, content: ContentNode) {
        if (content.name === "_placeholder_") {
            return new Group();
        }
        const item = new PosterGridItem(this, Math.max(this.pendingIndex, 0));
        item.setNodeParent(this);
        item.setValueSilent("width", new Float(itemRect.width));
        item.setValueSilent("height", new Float(itemRect.height));
        item.setValue("itemContent", content);
        return item;
    }

    getLayoutForIndex(index: number) {
        return this.layoutByIndex.get(index);
    }

    getPosterUri(content: ContentNode) {
        const isFHD = this.resolution === "FHD";
        const preferences = isFHD
            ? ["fhdGridPosterUrl", "fhdPosterUrl", "hdGridPosterUrl", "hdPosterUrl", "sdGridPosterUrl", "sdPosterUrl"]
            : ["hdGridPosterUrl", "hdPosterUrl", "fhdGridPosterUrl", "fhdPosterUrl", "sdGridPosterUrl", "sdPosterUrl"];
        for (const field of preferences) {
            const uri = content.getValueJS(field);
            if (typeof uri === "string" && uri.trim().length > 0) {
                return uri;
            }
        }
        const imageWell = this.getValueJS("imageWellBitmapUri");
        if (typeof imageWell === "string" && imageWell.trim().length > 0) {
            return imageWell;
        }
        return undefined;
    }

    getPosterDisplayMode() {
        const mode = (this.getValueJS("posterDisplayMode") as string) ?? "noScale";
        return mode.trim().toLowerCase();
    }

    getCaptionHorizAlign() {
        const align = ((this.getValueJS("captionHorizAlignment") as string) ?? "center").toLowerCase();
        return HorizAlignments.has(align) ? align : "center";
    }

    getCaptionBackgroundUri() {
        const configured = this.getValueJS("captionBackgroundBitmapUri") as string;
        if (typeof configured === "string" && configured.trim().length > 0) {
            return configured;
        }
        return this.defaultCaptionBackgroundUri;
    }

    getCaptionBackground() {
        const background = this.getBitmap("captionBackgroundBitmapUri");
        if (background?.isValid()) {
            return background;
        }
        return this.loadBitmap(this.defaultCaptionBackgroundUri);
    }

    shouldShowBackgroundForEmptyCaptions() {
        return Boolean(this.getValueJS("showBackgroundForEmptyCaptions"));
    }

    getFallbackBitmap(kind: "loading" | "failed" | "imageWell") {
        let field = "";
        if (kind === "loading") {
            field = "loadingBitmapUri";
        } else if (kind === "failed") {
            field = "failedBitmapUri";
        } else {
            field = "imageWellBitmapUri";
        }
        const bmp = this.getBitmap(field);
        if (!bmp?.isValid()) {
            return undefined;
        }
        if (kind === "loading") {
            const alpha = Number(this.getValueJS("loadingBitmapOpacity")) || 1;
            return { bitmap: bmp, opacity: alpha };
        } else if (kind === "failed") {
            const alpha = Number(this.getValueJS("failedBitmapOpacity")) || 1;
            return { bitmap: bmp, opacity: alpha };
        }
        return { bitmap: bmp, opacity: 1 };
    }

    private renderImageWell(rect: Rect, opacity: number, draw2D?: IfDraw2D) {
        const fallback = this.getFallbackBitmap("imageWell");
        if (!fallback?.bitmap) {
            return;
        }
        this.drawImage(fallback.bitmap, rect, 0, opacity * fallback.opacity, draw2D);
    }

    private shouldResetLayout(fieldName: string) {
        return new Set([
            "basepostersize",
            "itemspacing",
            "numrows",
            "numcolumns",
            "rowheights",
            "columnwidths",
            "rowspacings",
            "columnspacings",
            "captionvertalignment",
            "caption1numlines",
            "caption2numlines",
        ]).has(fieldName);
    }

    private shouldInvalidateItemVisuals(fieldName: string) {
        return new Set([
            "caption1color",
            "caption2color",
            "caption1font",
            "caption2font",
            "captionlinespacing",
            "enablecaptionscrolling",
            "captionhorizontalignment",
            "captionbackgroundbitmapuri",
            "showbackgroundforemptycaptions",
            "posterdisplaymode",
        ]).has(fieldName);
    }

    private invalidateItemComponents() {
        for (const item of this.itemComps) {
            if (item instanceof PosterGridItem) {
                item.notifyVisualChange();
            }
        }
    }

    private normalizeVector(values: any, fallback: number[]) {
        if (!Array.isArray(values) || values.length < 2) {
            return fallback.slice();
        }
        return [Number(values[0]) || fallback[0], Number(values[1]) || fallback[1]];
    }

    private inferColumnCount(posterWidth: number, spacing: number) {
        const available = this.sceneRect?.width ?? posterWidth;
        const step = posterWidth + spacing;
        if (step <= 0) {
            return 1;
        }
        return Math.max(1, Math.floor(available / step));
    }

    private resolveColumnWidths(defaultWidth: number) {
        const values = this.getValueJS("columnWidths");
        const result: number[] = [];
        for (let i = 0; i < this.numCols; i++) {
            result.push(this.resolveNumber(values, i, defaultWidth));
        }
        return result;
    }

    private resolveColumnSpacings(defaultSpacing: number, values?: any) {
        const source = values ?? this.getValueJS("columnSpacings");
        const result: number[] = [];
        for (let i = 0; i < this.numCols; i++) {
            result.push(this.resolveSpacingValue(source, i, defaultSpacing));
        }
        return result;
    }

    private resolveSpacingValue(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        const selected = index < values.length ? values[index] : values.at(-1);
        const parsed = Number(selected);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    private computeRowWidth(widths: number[], spacings: number[]) {
        return widths.reduce((acc, width, index) => {
            const spacing = index < widths.length - 1 ? spacings[index] ?? 0 : 0;
            return acc + width + spacing;
        }, 0);
    }

    private computeRowCaptionHeight(rowIndex: number, placement: string) {
        if (!this.requiresCaptionZone(placement)) {
            return 0;
        }
        let maxHeight = 0;
        for (let c = 0; c < this.numCols; c++) {
            const index = rowIndex + c;
            if (index >= this.content.length) {
                break;
            }
            const metrics = this.computeCaptionMetrics(index);
            maxHeight = Math.max(maxHeight, metrics.totalHeight);
        }
        return maxHeight;
    }

    private requiresCaptionZone(placement: string) {
        return placement === "above" || placement === "below";
    }

    private getCaptionPlacement() {
        const placement = ((this.getValueJS("captionVertAlignment") as string) ?? "below").toLowerCase();
        return VertAlignments.has(placement) ? placement : "below";
    }

    private computeCaptionMetrics(index: number): CaptionMetrics {
        const meta = this.getPosterMetadata(index);
        const caption1Lines = Math.max(0, this.resolveCaptionLines(meta?.caption1Lines, "caption1NumLines"));
        const caption2Lines = Math.max(0, this.resolveCaptionLines(meta?.caption2Lines, "caption2NumLines"));
        const font1 = this.getValue("caption1Font") as Font;
        const font2 = this.getValue("caption2Font") as Font;
        const lineSpacing = Number(this.getValueJS("captionLineSpacing")) || 0;
        const height1 =
            caption1Lines > 0
                ? this.measureFontHeight(font1) * caption1Lines + lineSpacing * Math.max(0, caption1Lines - 1)
                : 0;
        const height2 =
            caption2Lines > 0
                ? this.measureFontHeight(font2) * caption2Lines + lineSpacing * Math.max(0, caption2Lines - 1)
                : 0;
        const textHeight = height1 + height2 + (caption1Lines > 0 && caption2Lines > 0 ? lineSpacing : 0);
        const verticalMargins = caption1Lines > 0 || caption2Lines > 0 ? this.captionVerticalMargin * 2 : 0;
        return {
            caption1Lines,
            caption2Lines,
            caption1Height: height1,
            caption2Height: height2,
            totalHeight: textHeight + verticalMargins,
        };
    }

    private resolveCaptionLines(overrideValue: number | undefined, field: string) {
        if (Number.isFinite(overrideValue)) {
            return overrideValue as number;
        }
        return Number(this.getValueJS(field)) || 0;
    }

    private measureFontHeight(font: Font) {
        const defaultHeight = this.resolution === "FHD" ? 36 : 24;
        if (!font) return defaultHeight;
        const cached = this.fontHeightCache.get(font);
        if (cached) return cached;
        const drawFont = font.createDrawFont();
        const height = drawFont instanceof RoFont ? drawFont.measureTextHeight() : defaultHeight;
        this.fontHeightCache.set(font, height);
        return height;
    }

    private buildItemLayout(
        columnWidth: number,
        posterHeight: number,
        captionHeight: number,
        placement: string,
        metrics: CaptionMetrics
    ): PosterItemLayout {
        const lineSpacing = Number(this.getValueJS("captionLineSpacing")) || 0;
        const extendsLayout = this.requiresCaptionZone(placement);
        const layout: PosterItemLayout = {
            width: columnWidth,
            height: posterHeight + (extendsLayout ? captionHeight : 0),
            posterRect: { x: 0, y: 0, width: columnWidth, height: posterHeight },
            captionPlacement: placement,
            caption1Lines: metrics.caption1Lines,
            caption2Lines: metrics.caption2Lines,
            captionLineSpacing: lineSpacing,
        };
        if (extendsLayout) {
            const captionStart = placement === "above" ? 0 : posterHeight;
            if (placement === "above") {
                layout.posterRect.y = captionHeight;
            }
            layout.captionBackgroundRect = { x: 0, y: captionStart, width: columnWidth, height: captionHeight };
            this.addCaptionRects(layout, captionStart, columnWidth, metrics, lineSpacing);
        } else {
            let offset = 0;
            if (placement !== "top") {
                offset =
                    placement === "center"
                        ? Math.max(0, (posterHeight - metrics.totalHeight) / 2)
                        : Math.max(0, posterHeight - metrics.totalHeight);
            }
            this.addCaptionRects(layout, offset, columnWidth, metrics, lineSpacing);
            if (metrics.caption1Lines > 0 || metrics.caption2Lines > 0) {
                const endY =
                    (layout.caption2Rect?.y ?? layout.caption1Rect?.y ?? offset) +
                    (metrics.caption2Lines > 0 ? metrics.caption2Height : metrics.caption1Height);
                layout.captionBackgroundRect = {
                    x: 0,
                    y: offset,
                    width: columnWidth,
                    height: endY - offset,
                };
            }
        }
        return layout;
    }

    private addCaptionRects(
        layout: PosterItemLayout,
        startY: number,
        columnWidth: number,
        metrics: CaptionMetrics,
        lineSpacing: number
    ) {
        const textStartY = startY + this.captionVerticalMargin;
        if (metrics.caption1Lines > 0) {
            layout.caption1Rect = { x: 0, y: textStartY, width: columnWidth, height: metrics.caption1Height };
        }
        if (metrics.caption2Lines > 0) {
            const gap = metrics.caption1Lines > 0 ? lineSpacing : 0;
            const secondY = metrics.caption1Lines > 0 ? textStartY + metrics.caption1Height + gap : textStartY;
            layout.caption2Rect = { x: 0, y: secondY, width: columnWidth, height: metrics.caption2Height };
        }
    }

    private getPosterMetadata(index: number) {
        return this.metadata[index] as PosterGridMetadata;
    }

    private isPlaceholderIndex(index: number) {
        if (index < 0 || index >= this.content.length) {
            return true;
        }
        const metadata = this.metadata[index] as PosterGridMetadata | undefined;
        if (metadata?.index === -1) {
            return true;
        }
        const entry = this.content[index];
        return entry instanceof ContentNode && entry.name === "_placeholder_";
    }

    private findFocusableColumnIndex(rowStart: number, targetColumn: number, direction: number) {
        const numCols = Math.max(1, this.numCols || 1);
        let column = targetColumn;
        const step = direction >= 0 ? 1 : -1;
        while (column >= 0 && column < numCols) {
            const candidate = rowStart + column;
            if (candidate < this.content.length && !this.isPlaceholderIndex(candidate)) {
                return candidate;
            }
            column += step;
        }
        return -1;
    }
}

class PosterGridItem extends Group {
    private content?: ContentNode;
    private layout?: PosterItemLayout;
    private posterNode?: Poster;
    private captionBackgroundNode?: Poster;
    private caption1Node?: Label | ScrollingLabel;
    private caption2Node?: Label | ScrollingLabel;
    private needsChildRefresh = true;

    constructor(private readonly grid: PosterGrid, private readonly index: number) {
        super([], `${grid.name}_PosterGridItem_${index}`);
        this.setExtendsType(`PosterGridItem_${index}`, SGNodeType.Group);
    }

    notifyVisualChange() {
        this.needsChildRefresh = true;
        this.isDirty = true;
    }

    setLayout(layout?: PosterItemLayout) {
        this.layout = layout;
        this.needsChildRefresh = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.toLowerCase() === "itemcontent" && value instanceof ContentNode) {
            this.content = value;
            this.needsChildRefresh = true;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible() || !this.layout || !this.content) {
            this.clearChildNodes();
            return;
        }
        this.syncChildNodes();
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const offsetY = this.layout.offsetY ?? 0;
        const rect = {
            x: drawTrans[0],
            y: drawTrans[1] + offsetY,
            width: this.layout.width,
            height: this.layout.height,
        };
        const rotation = angle + this.getRotation();
        const combinedOpacity = opacity * this.getOpacity();
        this.updateBoundingRects(rect, origin, rotation);
        const childOrigin = [drawTrans[0], drawTrans[1] + offsetY];
        this.renderChildren(interpreter, childOrigin, rotation, combinedOpacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private syncChildNodes() {
        if (!this.layout || !this.content) {
            this.clearChildNodes();
            return;
        }
        if (!this.needsChildRefresh) {
            return;
        }
        this.syncPosterNode();
        const caption1 = this.getCaptionText("shortDescriptionLine1");
        const caption2 = this.getCaptionText("shortDescriptionLine2");
        const hasCaptionText = caption1.length > 0 || caption2.length > 0;
        this.syncCaptionBackground(hasCaptionText);
        const useScrolling = Boolean(this.grid.getValueJS("enableCaptionScrolling"));
        this.updateCaptionNode(1, this.layout.caption1Rect, caption1, this.layout.caption1Lines ?? 0, useScrolling);
        this.updateCaptionNode(2, this.layout.caption2Rect, caption2, this.layout.caption2Lines ?? 0, useScrolling);
        this.needsChildRefresh = false;
    }

    private syncPosterNode() {
        if (!this.layout || !this.content) {
            return;
        }
        const posterRect = this.layout.posterRect;
        const poster = this.ensurePosterNode();
        poster.setTranslation([posterRect.x, posterRect.y]);
        poster.setValueSilent("width", new Float(posterRect.width));
        poster.setValueSilent("height", new Float(posterRect.height));
        poster.setValue("loadDisplayMode", new BrsString(this.grid.getPosterDisplayMode()));
        poster.setValue("loadingBitmapUri", new BrsString((this.grid.getValueJS("loadingBitmapUri") as string) ?? ""));
        poster.setValue("loadingBitmapOpacity", new Float(Number(this.grid.getValueJS("loadingBitmapOpacity")) || 1));
        poster.setValue("failedBitmapUri", new BrsString((this.grid.getValueJS("failedBitmapUri") as string) ?? ""));
        poster.setValue("failedBitmapOpacity", new Float(Number(this.grid.getValueJS("failedBitmapOpacity")) || 1));
        const posterUri = this.grid.getPosterUri(this.content) ?? "";
        poster.setValue("uri", new BrsString(posterUri));
        const shouldShow = posterRect.width > 0 && posterRect.height > 0 && posterUri.length > 0;
        poster.setValue("visible", BrsBoolean.from(shouldShow));
    }

    private syncCaptionBackground(hasCaptionText: boolean) {
        const rect = this.layout?.captionBackgroundRect;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            if (this.captionBackgroundNode) {
                this.captionBackgroundNode.setValue("visible", BrsBoolean.False);
            }
            return;
        }
        const shouldShow = hasCaptionText || this.grid.shouldShowBackgroundForEmptyCaptions();
        const background = this.ensureCaptionBackgroundNode();
        background.setTranslation([rect.x, rect.y]);
        background.setValueSilent("width", new Float(rect.width));
        background.setValueSilent("height", new Float(rect.height));
        background.setValue("uri", new BrsString(this.grid.getCaptionBackgroundUri() ?? ""));
        background.setValue("visible", BrsBoolean.from(shouldShow));
    }

    private updateCaptionNode(
        slot: 1 | 2,
        rect: Rect | undefined,
        text: string,
        rawLines: number,
        useScrolling: boolean
    ) {
        const trimmed = text.trim();
        const lines = Math.max(0, Math.floor(rawLines));
        const shouldRender = Boolean(rect && rect.width > 0 && rect.height > 0 && trimmed.length > 0 && lines > 0);
        let node = slot === 1 ? this.caption1Node : this.caption2Node;
        const needsScrollingNode = useScrolling;
        if (node && needsScrollingNode !== node instanceof ScrollingLabel) {
            this.removeChildByReference(node);
            node = undefined;
        }
        if (!node) {
            node = needsScrollingNode ? this.addScrollingLabel("", [0, 0]) : this.addLabel("", [0, 0]);
            if (slot === 1) {
                this.caption1Node = node;
            } else {
                this.caption2Node = node;
            }
        }
        node.setValue("visible", BrsBoolean.from(shouldRender));
        if (!shouldRender || !rect) {
            return;
        }
        node.setTranslation([rect.x, rect.y]);
        node.setValueSilent("width", new Float(rect.width));
        node.setValueSilent("height", new Float(rect.height));
        node.setValue("text", new BrsString(trimmed));
        const fontField = slot === 1 ? "caption1Font" : "caption2Font";
        const colorField = slot === 1 ? "caption1Color" : "caption2Color";
        const fontValue = this.grid.getValue(fontField);
        if (fontValue) {
            node.setValue("font", fontValue);
        }
        node.setValue("color", new Int32(Number(this.grid.getValueJS(colorField)) || 0xffffffff));
        const horizAlign = this.grid.getCaptionHorizAlign();
        node.setValue("horizAlign", new BrsString(horizAlign));
        const vertAlign = lines > 1 ? "top" : "center";
        node.setValue("vertAlign", new BrsString(vertAlign));
        if (node instanceof ScrollingLabel) {
            node.setValue("maxWidth", new Int32(Math.round(rect.width)));
        } else {
            node.setValue("wrap", BrsBoolean.from(lines > 1));
            node.setValue("numLines", new Int32(lines));
            node.setValue("maxLines", new Int32(lines));
            node.setValue("lineSpacing", new Float(this.layout?.captionLineSpacing ?? 0));
        }
    }

    private ensurePosterNode(): Poster {
        this.posterNode ??= this.addPoster("", [0, 0]);
        return this.posterNode;
    }

    private ensureCaptionBackgroundNode(): Poster {
        this.captionBackgroundNode ??= this.addPoster("", [0, 0]);
        return this.captionBackgroundNode;
    }

    private getCaptionText(field: "shortDescriptionLine1" | "shortDescriptionLine2") {
        const value = this.content?.getValueJS(field);
        return typeof value === "string" ? value : "";
    }

    private clearChildNodes() {
        for (const node of [this.posterNode, this.captionBackgroundNode, this.caption1Node, this.caption2Node]) {
            if (node) {
                this.removeChildByReference(node);
            }
        }
        this.posterNode = undefined;
        this.captionBackgroundNode = undefined;
        this.caption1Node = undefined;
        this.caption2Node = undefined;
        this.needsChildRefresh = true;
    }
}
