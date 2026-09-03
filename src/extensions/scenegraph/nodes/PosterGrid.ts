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
    RoBitmap,
    RoFont,
    isBrsString,
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
    textHeight: number;
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

/**
 * Vertical padding a device reserves around a cell's caption block, TOTAL (above plus below), added
 * once when at least one caption line is requested. Above this base the zone is font-metric-driven.
 *
 * DEVICE-MEASURED, and it does NOT scale to FHD — 23 at both resolutions, unlike every other grid
 * margin. See the caption-zone section in `.claude/docs/scenegraph-invariants.md`.
 */
const CaptionZoneBase = 23;

/**
 * Where the caption text starts inside {@link CaptionZoneBase}, from the poster's bottom edge, when
 * `captionBackgroundBitmapUri` resolves to a flat (non-9-patch) bitmap. DEVICE-MEASURED as zero at
 * HD (`postergrid-margins-probe`, group P): the whole zone sits BELOW the text rather than being
 * split around it.
 *
 * That probe's fixture always overrode the background to a transparent, non-`.9.png` bitmap to keep
 * its ink-detection clean — so it could not see what `postergrid-caption-offset-probe` measured next:
 * with the DEFAULT background (a real 9-patch), a device insets the text by that bitmap's own
 * content-margin instead of drawing it flush. See {@link resolveCaptionTextOffset}.
 */
const CaptionTextOffset = 0;

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
    private readonly defaultCaptionBackgroundUri: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PosterGrid) {
        super([], name);
        this.setExtendsType(SGNodeType.PosterGrid, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.applyVertFocusStyle();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
        if (this.resolution === "FHD") {
            this.focusPaddingTop = 18;
            this.focusPaddingBottom = 18;
        } else {
            this.focusPaddingTop = 12;
            this.focusPaddingBottom = 12;
        }
        this.focusPaddingX = this.marginX / 2;
        this.focusField = "gridHasFocus";
        this.defaultCaptionBackgroundUri = `common:/images/${this.resolution}/caption_background.9.png`;
    }

    /**
     * Per-axis outset the reported bounding rect adds around the laid-out extent — LEFT, RIGHT and
     * TOP only. The bottom is larger and lives in {@link rectMarginBottom}.
     *
     * DEVICE-MEASURED on both axes at both resolutions, where `ArrayGrid`'s shared default would give
     * 24/4: `{x:-14, y:-14, w:128}` HD and `{x:-21, y:-21, w:142}` FHD, so `left == right == top`.
     * Probe: `test/simulator/probes/postergrid-margins-probe` (group M).
     */
    protected rectMargins(): { x: number; y: number } {
        const margin = this.resolution === "FHD" ? 21 : 14;
        return { x: margin, y: margin };
    }

    /**
     * Outset the reported rect adds BELOW the last row — 50 HD / 75 FHD, not the 14/21 added above it.
     * A PosterGrid's vertical outset is asymmetric, which is why this is separate from
     * {@link rectMargins} (one value per axis cannot express "14 above, 50 below").
     *
     * DEVICE-MEASURED, including the gate: the allowance is charged once per grid rather than per row,
     * and is absent exactly when the grid is a horizontal strip — `rows == 1 && numColumns > 1`. That
     * CONJUNCTION is load-bearing; every single-variable rule (column count, content shape, width
     * threshold, drawn item count) was measured and rejected, so do not simplify the condition. See
     * the `PosterGrid` extent section in `.claude/docs/scenegraph-invariants.md`.
     *
     * `rows` is the count actually DISPLAYED, so the hidden and visible passes agree and because the
     * outset is a property of the laid-out extent. No probe case separates that from the declared
     * `numRows` (every case set them equal), so a grid with `numRows = 12`, several columns and one
     * row's worth of content is a GUESS.
     */
    protected rectMarginBottom(displayRows: number): number {
        if (displayRows === 1 && this.numCols > 1) {
            return this.rectMargins().y;
        }
        return this.resolution === "FHD" ? 75 : 50;
    }

    /**
     * Row/column terms BOTH layout passes must derive identically, kept in one place because they
     * silently drifted when each pass computed its own: `getRenderRowIndex` reads `currRow`, and
     * `rectMarginBottom`/`computeReportedWidth` read `numCols`, so a pass that skips either resolves
     * different rows for the same content and reports a different extent. `rowSpacing` is returned for
     * the same reason — both passes charge a gap after every row, so it is resolved once and passed on
     * rather than re-read from `itemSpacing` per pass.
     */
    private resolveLayoutTerms(baseSize: number[]) {
        const spacing = this.normalizeVector(this.getValueJS("itemSpacing"), [0, 0]);
        const columnSpacingValues = this.getValueJS("columnSpacings");
        const defaultColumnSpacing = this.resolveSpacingValue(columnSpacingValues, 0, spacing[0]);
        this.numCols = Math.max(1, this.numCols || this.inferColumnCount(baseSize[0], defaultColumnSpacing));
        const totalRows = Math.ceil(this.content.length / this.numCols);
        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        // Settle the scroll position before any row is resolved: a scrolled grid whose `currRow` is
        // still 0 reads the wrong rows out of `getRenderRowIndex`.
        this.currRow = this.isFixedFocusMode() ? this.updateCurrRow() : this.updateListCurrRow();
        return {
            rowSpacing: spacing[1],
            defaultColumnSpacing,
            displayRows: Math.max(1, Math.min(desiredRows, totalRows)),
            columnWidths: this.resolveColumnWidths(baseSize[0]),
            // DEVICE-MEASURED: a column past the end of `columnSpacings` falls back to `itemSpacing.x`,
            // NOT to the array's first entry (which is what `defaultColumnSpacing` holds — it stays for
            // inferColumnCount, a separate "how many columns fit" heuristic).
            columnSpacings: this.resolveColumnSpacings(spacing[0], columnSpacingValues),
        };
    }

    /**
     * Measure the extent while invisible using the SAME per-row terms the visible pass accumulates.
     *
     * `ArrayGrid.measureHiddenExtent`'s generic per-track arithmetic (`itemSize[1] + margin.y * 2` per
     * row) is correct only for grids whose vertical outset is symmetric and per-row. A PosterGrid is
     * neither — its outset is asymmetric and charged once per grid, and its rows carry a caption zone
     * `rowHeights` cannot express — so inheriting it made a hidden grid disagree with its own visible
     * extent at every row count except one.
     *
     * Everything the two passes share goes through {@link resolveLayoutTerms}, and the content refresh
     * below mirrors what `ArrayGrid.renderNodeContent` runs before the visible pass. Both are load
     * bearing: this override is reached straight from the hidden branch of `renderNodeContent`, which
     * does neither for us, so anything derived here that the visible pass derives differently shows up
     * as a hidden grid disagreeing with itself.
     */
    protected measureHiddenExtent(origin: number[], angle: number) {
        const contentNode = this.getValue("content");
        if (contentNode instanceof ContentNode && contentNode.changed) {
            this.refreshContent();
            contentNode.changed = false;
        }
        const baseSize = this.getValueJS("basePosterSize") as number[];
        if (this.content.length === 0 || !baseSize?.[0] || !baseSize?.[1]) {
            super.measureHiddenExtent(origin, angle);
            return;
        }
        const { rowSpacing, displayRows, columnWidths, columnSpacings } = this.resolveLayoutTerms(baseSize);
        const margin = this.rectMargins();
        const drawTrans = this.getDrawTranslation(origin, angle);
        const rect = { x: drawTrans[0], y: drawTrans[1], ...this.getDimensions() };
        const { extent, renderedRows } = this.accumulateRowExtent(displayRows, baseSize, drawTrans[1], rowSpacing);
        this.updateRect(rect, displayRows, [Math.max(...columnWidths), baseSize[1]], {
            width: this.computeReportedWidth(columnWidths, columnSpacings, displayRows),
            // Both terms take the rows actually covered, not the rows requested — the same count the
            // visible pass reports, which is what the bottom allowance is gated on.
            height: renderedRows === 0 ? 0 : extent + margin.y + this.rectMarginBottom(renderedRows),
        });
        this.updateBoundingRects(rect, origin, angle + this.getRotation());
    }

    /**
     * Sum of every displayed row's height (poster + caption zone) plus the gap AFTER each row,
     * including the last — the device-measured trailing-gap rule. Arithmetic-only twin of what
     * `renderContent`'s loop accumulates into `itemRect.y`, and it has to advance on exactly the same
     * terms: the wrap/section divider between rows and the scene-edge cutoff both change the extent,
     * and both are field reads that need no laid-out items. It also reports how many rows it actually
     * covered, because the bottom allowance is gated on that count and not on the requested one.
     *
     * `startY` is where the visible pass starts advancing; it cancels out of the returned extent and
     * matters only for the scene-edge test.
     */
    private accumulateRowExtent(displayRows: number, baseSize: number[], startY: number, baseRowSpacing: number) {
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacingValues = this.getValueJS("rowSpacings");
        const placement = this.getCaptionPlacement();
        const captionsExtendLayout = this.requiresCaptionZone(placement);
        const hasSections = this.metadata.length > 0;
        const sceneBottom = (this.sceneRect?.y ?? 0) + (this.sceneRect?.height ?? 0);
        let lastRowIndex = -1;
        let lastRowNumber = -1;
        let renderedRows = 0;
        let y = startY;
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0 || rowIndex >= this.content.length) {
                break;
            }
            const rowNumber = Math.floor(rowIndex / this.numCols);
            if (r > 0 && this.wrap) {
                const divider = hasSections
                    ? this.getPosterMetadata(rowIndex)?.divider && this.getValueJS("sectionDividerHeight")
                    : rowIndex < lastRowIndex && this.getValueJS("wrapDividerHeight");
                if (typeof divider === "number") {
                    const gapAfterPreviousRow =
                        lastRowNumber >= 0
                            ? this.resolveSpacingValue(rowSpacingValues, lastRowNumber, baseRowSpacing)
                            : baseRowSpacing;
                    y += divider + gapAfterPreviousRow;
                }
            }
            y += this.resolveTrackValue(rowHeights, rowNumber, baseSize[1]);
            y += captionsExtendLayout ? this.computeRowCaptionHeight(rowIndex, placement) : 0;
            y += this.resolveSpacingValue(rowSpacingValues, rowNumber, baseRowSpacing);
            lastRowIndex = rowIndex;
            lastRowNumber = rowNumber;
            renderedRows++;
            if (y > sceneBottom) {
                break;
            }
        }
        return { extent: y - startY, renderedRows };
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "vertfocusanimationstyle" && isBrsString(value)) {
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
        const {
            rowSpacing: baseRowSpacing,
            defaultColumnSpacing,
            displayRows,
            columnWidths,
            columnSpacings,
        } = this.resolveLayoutTerms(baseSize);
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
        // Accumulate the extent actually laid out. Each row's height is its poster height PLUS its
        // caption zone, which updateRect cannot re-derive from rowHeights alone — measuring from
        // rowHeights there would silently drop every caption. `startY` is captured before the loop so
        // wrap/section dividers, which also advance itemRect.y, are counted.
        const startY = itemRect.y;
        let renderedRows = 0;
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0 || rowIndex >= contentLength) {
                break;
            }
            const rowNumber = Math.floor(rowIndex / this.numCols);
            // resolveTrackValue, not resolveNumber: a row past the end of `rowHeights` falls back
            // to basePosterSize.y rather than repeating the array's last entry, matching the rule the
            // spacing arrays follow. (resolveNumber still repeats and is left alone — ZoomRowList
            // depends on it and its behavior is unmeasured.)
            const posterHeight = this.resolveTrackValue(rowHeights, rowNumber, baseSize[1]);
            const rowCaptionHeight = captionsExtendLayout ? this.computeRowCaptionHeight(rowIndex, placement) : 0;
            // Content-only width: the trailing gap belongs to the REPORTED extent (device-measured),
            // not to the drawn section/wrap divider, which would otherwise extend past the last poster.
            const rowWidth = this.computeRowWidth(columnWidths, columnSpacings, false);
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
            renderedRows++;
            // Advance identically on both exits: the gap after the LAST row counts toward the
            // extent, so breaking on the scene edge must not silently drop it.
            const rowGap = this.resolveSpacingValue(rowSpacingValues, rowNumber, baseRowSpacing);
            itemRect.y += rowHeightWithCaptions + rowGap;
            if (itemRect.y > (this.sceneRect?.y ?? 0) + (this.sceneRect?.height ?? 0)) {
                break;
            }
        }
        // Explicit extents, both including the focus outset the arithmetic path would otherwise add
        // per track (these values are the whole reported rect, not just the content).
        //
        // DEVICE-MEASURED: the gap AFTER the last row counts, exactly as it does after the last
        // column — 3 rows of 100 with `itemSpacing.y = 50` measured 3 x 100 + 3 x 50 + margins, not
        // 2 gaps. So the loop's accumulated `itemRect.y` is used as-is, with nothing backed out (the
        // loop breaks AFTER advancing, so the scene-edge exit already includes that trailing gap too).
        //
        // Asymmetric on Y: `margin.y` above the first row, `rectMarginBottom()` below the last. That
        // bottom value is gated on the row count, so it takes the rows actually RENDERED — the same
        // count `itemRect.y` accumulated over. The requested count would disagree with the extent
        // whenever the scene edge cut the loop short.
        const margin = this.rectMargins();
        const height = renderedRows === 0 ? 0 : itemRect.y - startY + margin.y + this.rectMarginBottom(renderedRows);
        this.updateRect(rect, displayRows, [Math.max(...columnWidths), maxCellHeight || baseSize[1]], {
            width: this.computeReportedWidth(columnWidths, columnSpacings, displayRows),
            height,
        });
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
        itemComp.setValue("width", new Float(itemRect.width), false);
        itemComp.setValue("height", new Float(itemRect.height), false);
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
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D, index);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        this.renderItemClipped(interpreter, itemComp, itemOrigin, itemRect, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D, index);
        }
    }

    /**
     * A PosterGrid's focus frame tracks the POSTER, not the whole cell: a cell reserves a caption zone
     * below (or above) the poster, and a frame around the whole cell would enclose the captions too.
     * `layoutByIndex` holds that per-cell geometry keyed by content index, which is why the hook needs
     * the index — it replaces a `focusLayoutOverride` field that the two call sites set and cleared
     * around `renderFocus` purely to smuggle the layout in.
     *
     * Deliberately NOT gated on `bmp.ninePatch`, unlike the base: this outset is
     * `marginY + focusPadding*`, device-measured constants, not the 9-patch's own content margins, so
     * there is nothing marker-derived to gate on. Note it uses only `posterRect`'s x/width — the frame's
     * top stays at the cell top, so with `captionVertAlignment = "above"` it spans the caption zone too.
     */
    protected focusFrameRect(itemRect: Rect, _bmp: RoBitmap, index: number): Rect {
        // Fall back to the whole cell when this index has not been laid out yet (the frame is then just
        // outset from itemRect, which is also what a direct renderFocus call in a test sees).
        const posterRect = this.layoutByIndex.get(index)?.posterRect;
        const posterX = itemRect.x + (posterRect?.x ?? 0);
        const posterWidth = posterRect?.width ?? itemRect.width;
        const outsetTop = this.marginY + this.focusPaddingTop;
        const outsetBottom = this.marginY + this.focusPaddingBottom;
        return {
            x: posterX - this.focusPaddingX,
            y: itemRect.y - outsetTop,
            width: posterWidth + this.focusPaddingX * 2,
            height: itemRect.height + outsetTop + outsetBottom,
        };
    }

    protected createItemComponent(_interpreter: Interpreter, itemRect: Rect, content: ContentNode) {
        if (content.name === "_placeholder_") {
            return new Group();
        }
        const item = new PosterGridItem(this, Math.max(this.pendingIndex, 0));
        item.setNodeParent(this);
        item.setValueSilent("width", new Float(itemRect.width));
        item.setValueSilent("height", new Float(itemRect.height));
        item.setValue("itemContent", content, true);
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

    /**
     * The below/above caption text's vertical offset from the top of its reserved zone.
     *
     * DEVICE-MEASURED (`postergrid-caption-offset-probe`, HD): a flat non-9-patch background (a
     * transparent override, or none) reads {@link CaptionTextOffset} (0, text flush against the
     * poster) — but the DEFAULT `captionBackgroundBitmapUri` resolves to a real `.9.png`, and a
     * device insets the text by that bitmap's own content-margin instead, the same way
     * `ArrayGrid.focusMargins()` already honors a focus bitmap's content-margin over a flat fallback.
     * `caption_background.9.png` (`src/extensions/scenegraph/common/images/<res>/`) is calibrated so
     * its `margins.top` matches this reading (11 HD) — a CUSTOM `captionBackgroundBitmapUri` that is
     * itself a 9-patch is untested and simply inherited by this same mechanism.
     *
     * FHD (17) is INFERRED by the 1.5× scale other margins in this node use, not device-measured —
     * see the caption-zone section of `.claude/docs/scenegraph-invariants.md`.
     */
    private resolveCaptionTextOffset(): number {
        const background = this.getCaptionBackground();
        if (!background?.ninePatch) {
            return CaptionTextOffset;
        }
        return background.getPatchSizes()?.margins.top ?? CaptionTextOffset;
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

    /**
     * Column widths, all taken from `basePosterSize.x`.
     *
     * DEVICE-MEASURED: PosterGrid **ignores** the inherited ArrayGrid `columnWidths` field — a
     * single-column grid with `basePosterSize=[100,100]` measured the same 128 whether or not
     * `columnWidths=[200]` was set. Note the axes are NOT symmetric here: `rowHeights` IS honored
     * (a 3-row grid with `rowHeights=[200,50,100]` measured those heights), so do not "unify" these
     * two into one helper.
     */
    private resolveColumnWidths(defaultWidth: number) {
        return new Array(this.numCols).fill(defaultWidth);
    }

    /**
     * How many columns are actually occupied — the widest row that gets laid out.
     *
     * DEVICE-MEASURED: a grid declaring `numColumns = 3` but holding only 2 items reports a rect two
     * cells wide (HD 228), so the reported WIDTH follows the items drawn. The same case measures the
     * bottom allowance as absent, which only a gate reading the DECLARED `numColumns` produces — so
     * this node holds two device-backed notions of "columns" at once, this one and
     * {@link rectMarginBottom}'s. Do NOT unify them.
     *
     * Below `numCols` only when no row is full (`content.length < numColumns`).
     */
    private countDrawnColumns(displayRows: number) {
        let drawn = 0;
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0 || rowIndex >= this.content.length) {
                break;
            }
            drawn = Math.max(drawn, Math.min(this.numCols, this.content.length - rowIndex));
            if (drawn >= this.numCols) {
                break;
            }
        }
        return Math.max(1, drawn);
    }

    private resolveColumnSpacings(defaultSpacing: number, values?: any) {
        const source = values ?? this.getValueJS("columnSpacings");
        const result: number[] = [];
        for (let i = 0; i < this.numCols; i++) {
            result.push(this.resolveSpacingValue(source, i, defaultSpacing));
        }
        return result;
    }

    /**
     * Resolves one entry of `columnSpacings`/`rowSpacings`.
     *
     * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2; probes `out/postergrid-spacing-probe` and
     * `out/postergrid-rows-probe`): an index past the end of the array falls back to
     * `itemSpacing.x`/`.y`. It does NOT repeat the last entry, which is what this used to do —
     * `columnSpacings=[10]` across 3 columns measured 438 on device (10 + 50 + 50), where repeating
     * would have given 358. Note `LayoutGroup.itemSpacings` IS device-confirmed to repeat, so the
     * two genuinely differ; that is why this was measured rather than assumed.
     */
    private resolveSpacingValue(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || index >= values.length) {
            return fallback;
        }
        const parsed = Number(values[index]);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    /**
     * Reported width: the drawn columns plus their gaps and the horizontal margins. Slicing to the
     * drawn column count is device-measured — see {@link countDrawnColumns}.
     */
    private computeReportedWidth(widths: number[], spacings: number[], displayRows: number) {
        const drawn = this.countDrawnColumns(displayRows);
        return this.computeRowWidth(widths.slice(0, drawn), spacings) + this.rectMargins().x * 2;
    }

    /**
     * Laid-out width of one row: every column's width plus its own trailing gap.
     *
     * DEVICE-MEASURED: the gap AFTER the last column is part of the reported extent — 3 columns of
     * 100 with `itemSpacing.x = 50` measured 478 (3 x 100 + 3 x 50 + margins), not 428. That matches
     * the reference's wording for the sibling field ("the spacing after each row").
     */
    private computeRowWidth(widths: number[], spacings: number[], includeTrailingGap: boolean = true) {
        return widths.reduce((acc, width, index) => {
            const isLast = index === widths.length - 1;
            const gap = isLast && !includeTrailingGap ? 0 : spacings[index] ?? 0;
            return acc + width + gap;
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
        const verticalMargins = caption1Lines > 0 || caption2Lines > 0 ? CaptionZoneBase : 0;
        return {
            caption1Lines,
            caption2Lines,
            caption1Height: height1,
            caption2Height: height2,
            textHeight,
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
            this.addCaptionRects(
                layout,
                captionStart,
                columnWidth,
                metrics,
                lineSpacing,
                this.resolveCaptionTextOffset()
            );
        } else {
            // No zone is reserved for an on-poster caption (requiresCaptionZone() is false here), so
            // center/bottom on textHeight alone — NOT totalHeight, which adds CaptionZoneBase for the
            // below/above zone that this branch never draws. The background 9-patch's content-margin
            // (below/above only, see resolveCaptionTextOffset) does not apply here either — an
            // on-poster caption isn't inset from a zone edge, it's centered/aligned to the poster.
            let offset = 0;
            if (placement !== "top") {
                offset =
                    placement === "center"
                        ? Math.max(0, (posterHeight - metrics.textHeight) / 2)
                        : Math.max(0, posterHeight - metrics.textHeight);
            }
            this.addCaptionRects(layout, offset, columnWidth, metrics, lineSpacing, 0);
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
        lineSpacing: number,
        textOffset: number
    ) {
        const textStartY = startY + textOffset;
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

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        if (index.toLowerCase() === "itemcontent" && value instanceof ContentNode) {
            this.content = value;
            this.needsChildRefresh = true;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const isVisible = this.isVisible();
        if (!isVisible || !this.layout || !this.content) {
            this.clearChildNodes();
            if (!isVisible) {
                this.updateRenderTracking(true);
            }
            return;
        }
        this.syncChildNodes();
        const drawTrans = this.getDrawTranslation(origin, angle);
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
        this.nodeRenderingDone(origin, angle, combinedOpacity, draw2D);
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
