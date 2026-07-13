import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    isBrsString,
    RoAssociativeArray,
    IfDraw2D,
    Rect,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { toAssociativeArray, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { Node } from "./Node";
import { Poster } from "./Poster";
import { Rectangle } from "./Rectangle";
import { RoSGNode } from "../components/RoSGNode";
import { StdDlgTitleArea } from "./StdDlgTitleArea";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { StdDlgButtonArea } from "./StdDlgButtonArea";
import { StdDlgSideCardArea } from "./StdDlgSideCardArea";
import { colorFromPalette } from "./StdDlgItemBase";
import { rotateTranslation } from "../SGUtil";

/**
 * Base of the Standard Dialog Framework. Draws the 9-patch dialog background (palette-tinted) and
 * owns the shared behavior for all standard dialogs:
 *
 * - Discovers its StdDlgTitleArea / StdDlgContentArea / StdDlgButtonArea children — whether authored
 *   in XML (a component extending StandardDialog) or added by a subclass — and stacks them
 *   vertically, sizing the background to fit and recentering on screen.
 * - Surfaces the button area's `buttonSelected` / `buttonFocused` / `focusButton` fields on the dialog.
 * - Grabs focus into the button row on show and restores the prior focus on close, and routes `back`
 *   (and button navigation) to the dialog.
 *
 * Subclasses that embed an interactive widget (keyboard / pin pad) override `setNodeFocus` and
 * `handleKey` for their focus model.
 */
export class StandardDialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "palette", type: "node" },
        { name: "backExitsDialog", type: "boolean", value: "true" },
        { name: "homeExitsDialog", type: "boolean", value: "true" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean", value: "false", alwaysNotify: true },
    ];
    protected readonly dialogBackgroundUri = "common:/images/standard_dialog_background.9.png";
    protected readonly dialogDividerUri = "common:/images/dialog_divider.9.png";
    protected readonly dialogTrans: number[];
    protected readonly background: Poster;
    /** Initial background-image height before the first layout (the dialog then sizes to content). */
    protected readonly minHeight: number;
    protected readonly maxWidth: number;
    /** Horizontal/vertical inset of the 9-patch background relative to the content origin. */
    protected readonly padX: number;
    protected readonly padY: number;
    /** Vertical gap left between the title / content / button areas. */
    protected readonly sectionGap: number;
    /** Usable width for content laid out inside the dialog (subclasses may widen it). */
    protected contentWidth: number;
    protected width: number;
    /** Node that held focus before the dialog grabbed it; focus is returned here on close. */
    protected lastFocus?: RoSGNode;
    /** Set when a content item's size becomes known only after rendering (e.g. a StdDlgCustomItem
     * wrapping a LayoutGroup), so the dialog re-lays-out next frame. Survives the per-render isDirty
     * reset done in nodeRenderingDone. */
    private pendingRelayout = false;

    // Building-block areas, discovered as children are appended (XML-authored or subclass-added).
    protected titleArea?: StdDlgTitleArea;
    protected contentArea?: StdDlgContentArea;
    protected buttonArea?: StdDlgButtonArea;
    // Optional freeform side card (a dialog may contain at most one) and its lazily-created divider.
    protected sideCardArea?: StdDlgSideCardArea;
    protected divider?: Rectangle;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.width = 1038;
            this.maxWidth = 1380;
            this.minHeight = 270;
            this.padX = 90;
            this.padY = 60;
            this.sectionGap = 30;
            this.dialogTrans = [531, 492];
        } else {
            this.width = 692;
            this.maxWidth = 920;
            this.minHeight = 180;
            this.padX = 60;
            this.padY = 40;
            this.sectionGap = 20;
            this.dialogTrans = [354, 328];
        }
        this.contentWidth = this.width - 2 * this.padX;
        this.background = this.addPoster(
            this.dialogBackgroundUri,
            [-this.padX, -this.padY],
            this.width,
            this.minHeight
        );
    }

    appendChildToParent(child: BrsType): boolean {
        const added = super.appendChildToParent(child);
        if (added) {
            if (child instanceof StdDlgTitleArea) {
                this.titleArea = child;
            } else if (child instanceof StdDlgContentArea) {
                this.contentArea = child;
            } else if (child instanceof StdDlgButtonArea) {
                this.buttonArea = child;
                // Surface the button row's state on the dialog (shared field objects) so app
                // observers added in init() fire when focus/selection change.
                this.linkField(child, "buttonSelected");
                this.linkField(child, "buttonFocused");
                this.linkField(child, "focusButton");
            } else if (child instanceof StdDlgSideCardArea && this.sideCardArea === undefined) {
                // A dialog may contain only a single side card; keep the first one appended.
                this.sideCardArea = child;
            }
        }
        return added;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "close") {
            index = "wasClosed";
            value = BrsBoolean.True;
            this.setValue("visible", BrsBoolean.False);
            sgRoot.removeDialog(this);
            if (this.lastFocus instanceof Group) {
                this.lastFocus.setNodeFocus(true);
                this.lastFocus.isDirty = true;
                this.lastFocus = undefined;
            }
        } else if (fieldName === "width") {
            // Roku accepts a resolution-dependent { fhd, hd } map here as well as a plain number.
            const resolved = this.resolveResolutionValue(value);
            if (Number.isFinite(resolved)) {
                this.width = Math.min(resolved, this.maxWidth);
                this.contentWidth = Math.max(this.contentWidth, this.width - 2 * this.padX);
                // Store a numeric value so the float `width` field accepts it (an AA would type-mismatch).
                value = new Float(this.width);
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setDefaultTranslation() {
        this.setTranslation(this.dialogTrans);
    }

    /** Resolves a value that may be a plain number/string or a Roku `{ fhd, hd }` resolution map. */
    private resolveResolutionValue(value: BrsType): number {
        const resolved = jsValueOf(value);
        if (resolved !== null && typeof resolved === "object") {
            const map = resolved as Record<string, unknown>;
            const key = this.resolution === "FHD" ? "fhd" : "hd";
            return Number(map[key] ?? map[key.toUpperCase()] ?? map.hd ?? map.fhd);
        }
        return Number(resolved);
    }

    /** Requests a re-layout on the next frame (used by content items whose size is only known after
     * rendering). Unlike isDirty, this is not cleared by the per-render bookkeeping. */
    requestRelayout() {
        this.pendingRelayout = true;
    }

    setNodeFocus(focusOn: boolean): boolean {
        if (focusOn && sgRoot.focused) {
            const targets = this.getFocusTargets();
            const target = this.buttonArea?.hasButtons ? this.buttonArea : targets[0];
            if (target) {
                // Framework dialog: focus the button row / first content widget once (one-shot so
                // the per-frame render doesn't fight the user's navigation).
                if (this.lastFocus === undefined) {
                    this.lastFocus = sgRoot.focused;
                    this.focusTarget(target);
                }
            } else if (!this.isChildrenFocused() && sgRoot.focused !== this) {
                // Custom dialog with no framework target (e.g. its own ButtonGroup): act like a
                // normal focusable node so it becomes focused and its `focusedChild` observer /
                // `initialFocus` can route focus to the buttons. Re-grab while focus is outside it.
                this.lastFocus ??= sgRoot.focused;
                this.isDirty = true;
                super.setNodeFocus(true);
            }
        }
        return true;
    }

    /**
     * The ordered list of focusable elements the dialog navigates with up/down: each focusable
     * content widget (e.g. the ScrollableText of a scrollable StdDlgTextItem) top-to-bottom, then
     * the button row last.
     */
    protected getFocusTargets(): Group[] {
        const targets: Group[] = [];
        if (this.contentArea) {
            for (const item of this.contentArea.getNodeChildren()) {
                const getter = (item as unknown as { getFocusWidget?: () => Group | undefined }).getFocusWidget;
                if (typeof getter === "function") {
                    const widget = getter.call(item);
                    if (widget instanceof Group) {
                        targets.push(widget);
                    }
                }
            }
        }
        if (this.buttonArea?.hasButtons) {
            targets.push(this.buttonArea);
        }
        return targets;
    }

    /** Gives focus to a target using the proper focus chain so focusedChild propagates (e.g. so a
     * ScrollableText shows its focused scrollbar thumb). */
    private focusTarget(target: Group) {
        target.setNodeFocus(true);
        this.isDirty = true;
    }

    handleKey(key: string, press: boolean): boolean {
        if (key === "back") {
            const backExits = this.getValueJS("backExitsDialog") as boolean;
            if (press && backExits) {
                this.setValue("close", BrsBoolean.True);
            }
            return true;
        }
        const targets = this.getFocusTargets();
        if (targets.length === 0) {
            return false;
        }
        // Find the target that currently holds focus (a target itself, or a child of it such as a
        // focused button inside the button row).
        const focused = sgRoot.focused;
        let index = targets.findIndex(
            (t) => t === focused || (focused instanceof Node && focused.getNodeParent() === t)
        );
        if (index === -1) {
            index = targets.length - 1; // default to the button row
        }
        // Let the focused element handle the key first (scroll the text, move between buttons, …).
        let handled = targets[index].handleKey(key, press);
        // When it didn't consume an up/down (e.g. scrolled to an edge, or top/bottom button), move
        // focus to the adjacent target: down → next element, up → previous element.
        if (!handled && press && (key === "up" || key === "down")) {
            const nextIndex = key === "down" ? index + 1 : index - 1;
            if (nextIndex >= 0 && nextIndex < targets.length) {
                this.focusTarget(targets[nextIndex]);
                handled = true;
            }
        }
        return handled;
    }

    /**
     * Stacks the title / content / button areas vertically, sizes the 9-patch background to wrap
     * them, and recenters the dialog on screen. When a side card is present, the areas occupy a
     * narrower column beside it (see `layoutWithSideCard`).
     */
    protected layoutStandardDialog() {
        if (this.sideCardArea) {
            this.layoutWithSideCard();
            return;
        }
        // Lay content out into the available width (so text wraps to it) but size the dialog to the
        // areas' actual widths, so compact content (e.g. a spinner progress item) yields a narrow
        // dialog while text/keyboard content keeps the full width.
        const layoutWidth = this.contentWidth;
        let width = 0;
        let y = 0;
        if (this.titleArea) {
            this.titleArea.setTranslation([0, y]);
            const height = this.titleArea.layoutTitle(layoutWidth);
            width = Math.max(width, this.titleArea.getDimensions().width);
            if (height > 0) {
                y += height + this.sectionGap;
            }
        }
        if (this.contentArea) {
            this.contentArea.setTranslation([0, y]);
            const height = this.contentArea.layoutArea(layoutWidth);
            width = Math.max(width, this.contentArea.getDimensions().width);
            if (height > 0) {
                y += height + this.sectionGap;
            }
        }
        let buttonHeight = 0;
        if (this.buttonArea) {
            const buttons = this.getValueJS("buttons") as string[];
            if (Array.isArray(buttons) && buttons.length) {
                this.buttonArea.setButtons(buttons);
            }
            // Buttons fill the resolved dialog width (at least one button's min width).
            buttonHeight = this.buttonArea.layoutArea(Math.max(width, 1));
            width = Math.max(width, this.buttonArea.getDimensions().width);
        }
        const contentHeight = y + buttonHeight;
        // Size to content (no artificial minimum) and pin the button area to the bottom.
        const bgHeight = contentHeight + 2 * this.padY;
        if (this.buttonArea && buttonHeight > 0) {
            this.buttonArea.setTranslation([0, bgHeight - 2 * this.padY - buttonHeight]);
        }
        this.layoutBackground(width, contentHeight);
    }

    /**
     * Stacks the title / content areas into a column of the given width, positioned at `xOffset`,
     * and measures the button area (placed at the top by default — the caller bottom-aligns it).
     * Returns the stacked title+content height and the button area's height.
     */
    private layoutColumn(columnWidth: number, xOffset: number): { topHeight: number; buttonHeight: number } {
        let y = 0;
        if (this.titleArea) {
            this.titleArea.setTranslation([xOffset, y]);
            const height = this.titleArea.layoutTitle(columnWidth);
            if (height > 0) {
                y += height + this.sectionGap;
            }
        }
        if (this.contentArea) {
            this.contentArea.setTranslation([xOffset, y]);
            const height = this.contentArea.layoutArea(columnWidth);
            if (height > 0) {
                y += height + this.sectionGap;
            }
        }
        let buttonHeight = 0;
        if (this.buttonArea) {
            const buttons = this.getValueJS("buttons") as string[];
            if (Array.isArray(buttons) && buttons.length) {
                this.buttonArea.setButtons(buttons);
            }
            buttonHeight = this.buttonArea.layoutArea(columnWidth);
            this.buttonArea.setTranslation([xOffset, y]);
        }
        return { topHeight: y, buttonHeight };
    }

    /**
     * Lays the dialog out with a side card beside the area column: resolves the card's size, gives
     * the remaining width to the column, places both on the requested side, draws the optional
     * divider, and sizes the background to the taller of the two.
     */
    private layoutWithSideCard() {
        const card = this.sideCardArea!;
        const horizAlign = (card.getValueJS("horizAlign") as string) ?? "right";
        const extendToEdge = card.getValueJS("extendToDialogEdge") as boolean;
        const showDivider = card.getValueJS("showDivider") as boolean;

        const cardSize = card.layoutSideCard();
        const cardW = cardSize.width;
        const columnWidth = Math.max(0, this.contentWidth - cardW - this.sectionGap);
        const columnX = horizAlign === "left" ? cardW + this.sectionGap : 0;
        const column = this.layoutColumn(columnWidth, columnX);
        const columnHeight = column.topHeight + column.buttonHeight;
        const innerWidth = columnWidth + this.sectionGap + cardW;

        let cardX = horizAlign === "left" ? 0 : columnWidth + this.sectionGap;
        let cardY = 0;
        // The content column always reserves padding; when the card extends to the edge its height
        // defines the full background height (no extra padding), so it is tracked as a minimum
        // background height rather than padded content.
        let innerHeight = Math.max(columnHeight, cardSize.height);
        let minBgHeight = 0;
        if (extendToEdge) {
            cardX += horizAlign === "left" ? -this.padX : this.padX;
            cardY = -this.padY;
            innerHeight = columnHeight;
            minBgHeight = cardSize.height;
        }
        card.setTranslation([cardX, cardY]);

        const bgHeight = Math.max(innerHeight + 2 * this.padY, minBgHeight);
        // The button area is always pinned to the bottom of the dialog's content region.
        const regionHeight = bgHeight - 2 * this.padY;
        if (this.buttonArea && column.buttonHeight > 0) {
            this.buttonArea.setTranslation([columnX, regionHeight - column.buttonHeight]);
        }
        // The divider spans the full background height when the card reaches the edge.
        const dividerTop = extendToEdge ? -this.padY : 0;
        const dividerHeight = extendToEdge ? bgHeight : innerHeight;
        this.layoutDivider(showDivider, horizAlign, columnWidth, cardW, dividerTop, dividerHeight);
        this.layoutBackground(innerWidth, innerHeight, minBgHeight);
    }

    /** Shows/positions a thin vertical divider between the area column and the side card. */
    private layoutDivider(
        show: boolean,
        horizAlign: string,
        columnWidth: number,
        cardW: number,
        top: number,
        height: number
    ) {
        if (!show) {
            this.divider?.setValueSilent("visible", BrsBoolean.False);
            return;
        }
        if (!this.divider) {
            this.divider = new Rectangle();
            this.appendChildToParent(this.divider);
        }
        const thickness = this.resolution === "FHD" ? 3 : 2;
        const color = colorFromPalette(this.getPaletteColors(), "DialogSecondaryItemColor", "0xAAAAAAFF");
        this.divider.setValueSilent("color", new Int32(color));
        this.divider.setValueSilent("width", new Float(thickness));
        this.divider.setValueSilent("height", new Float(height));
        this.divider.setValueSilent("visible", BrsBoolean.True);
        const x = (horizAlign === "left" ? cardW : columnWidth) + this.sectionGap / 2 - thickness / 2;
        this.divider.setTranslation([x, top]);
    }

    /**
     * Sizes the 9-patch background to wrap content of the given size and recenters the dialog on
     * screen. Content is laid out in local coordinates starting at (0, 0); the background is drawn
     * at (-padX, -padY) so the content sits padded inside it.
     */
    protected layoutBackground(contentWidth: number, contentHeight: number, minBgHeight: number = 0) {
        const bgWidth = contentWidth + 2 * this.padX;
        const bgHeight = Math.max(contentHeight + 2 * this.padY, minBgHeight);
        this.width = bgWidth;
        this.background.setValueSilent("width", new Float(bgWidth));
        this.background.setValueSilent("height", new Float(bgHeight));
        this.background.setTranslation([-this.padX, -this.padY]);
        this.setValueSilent("width", new Float(bgWidth));
        this.setValueSilent("height", new Float(bgHeight));
        this.dialogTrans[0] = (this.sceneRect.width - bgWidth) / 2 + this.padX;
        this.dialogTrans[1] = (this.sceneRect.height - bgHeight) / 2 + this.padY;
        this.setTranslation(this.dialogTrans);
    }

    /**
     * Pushes the palette colors onto the button row so the buttons theme correctly: unfocused text
     * (DialogTextColor), focused text (DialogFocusItemColor), the focus bitmap (DialogFocusColor),
     * and the unfocused-area footprint bitmap (DialogFootprintColor). ButtonGroup copies these onto
     * each button when it refreshes.
     */
    private applyButtonPalette(colors: RoAssociativeArray) {
        if (!this.buttonArea) {
            return;
        }
        this.buttonArea.setValueSilent(
            "textColor",
            new Int32(colorFromPalette(colors, "DialogTextColor", "0xDDDDDDFF"))
        );
        this.buttonArea.setValueSilent(
            "focusedTextColor",
            new Int32(colorFromPalette(colors, "DialogFocusItemColor", "0x262626FF"))
        );
        this.buttonArea.setValueSilent(
            "focusBitmapBlendColor",
            new Int32(colorFromPalette(colors, "DialogFocusColor", "0xFFFFFFFF"))
        );
        this.buttonArea.setValueSilent(
            "focusFootprintBlendColor",
            new Int32(colorFromPalette(colors, "DialogFootprintColor", "0xFFFFFFFF"))
        );
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        if (this.isDirty || this.pendingRelayout) {
            this.pendingRelayout = false;
            this.layoutStandardDialog();
        }
        this.setNodeFocus(true);
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: this.width,
            height: size.height,
        };
        const colors = this.getPaletteColors();
        const backColor = colors.get(new BrsString("DialogBackgroundColor"));
        if (isBrsString(backColor)) {
            this.background.setValue("blendColor", backColor);
        }
        this.applyButtonPalette(colors);
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    getPaletteColors() {
        // Resolve the nearest RSGPalette by walking this dialog's ancestors (its own `palette`
        // field, then up through any intermediate palette group to the Scene) — the shared Node
        // resolution, rather than only checking self + Scene.
        const colors = this.resolvePaletteColors();
        if (colors) {
            return colors;
        }
        // Fallback to default colors
        const defaultColors = {
            DialogBackgroundColor: "0x6C6278FF",
            DialogTitleColor: "0xFFFFFFFF",
            DialogTextColor: "0xDDDDDDFF",
            DialogSecondaryTextColor: "0xAAAAAAFF",
            DialogItemColor: "0xFFFFFFFF",
            DialogSecondaryItemColor: "0xAAAAAAFF",
            DialogFocusColor: "0xFFFFFFFF",
            // DialogFocusItemColor and DialogFootprintColor are intentionally omitted: each call site
            // passes its own fallback (e.g. dark focused-button text, white "no tint" for the button
            // footprint so it stays visible, semi-transparent gray for the action card / scrollbar).
        };
        return toAssociativeArray(defaultColors);
    }
}
