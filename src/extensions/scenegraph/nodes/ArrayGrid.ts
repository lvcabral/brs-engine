import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    isNumberComp,
    isBrsString,
    IfDraw2D,
    Rect,
    RectRect,
    RoBitmap,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { Poster, SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";
import type { RoSGNode } from "../components/RoSGNode";
import { Field } from "./Field";
import { createNode, SGNodeFactory } from "../factory/NodeFactory";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { positiveMod, UNIT_SCALE } from "../SGUtil";
import { sgClock } from "../SGClock";
import { easeOutCubic, TransitionTick, UITransition } from "../SGTransition";

export enum FocusStyle {
    FixedFocusWrap = "fixedFocusWrap",
    FloatingFocus = "floatingFocus",
    FixedFocus = "fixedFocus",
}

/**
 * Resolves a raw focus-animation-style string (either axis: `vertFocusAnimationStyle` or
 * `horizFocusAnimationStyle`) to a canonical {@link FocusStyle}, or `undefined` when the value is
 * not recognized. Matching is case-insensitive.
 *
 * The abbreviated value `"fixed"` is accepted as an alias for `fixedFocus`: real apps set
 * `vertFocusAnimationStyle="fixed"` to mean non-wrapping fixed focus, and a device honors that
 * intent rather than keeping the field's previous (possibly `fixedFocusWrap`) value. Without this,
 * a grid whose default is `fixedFocusWrap` (MarkupGrid/PosterGrid) would keep wrapping and never let
 * an Up press at the top row bubble to a parent that moves focus elsewhere. `fixedFocus` is likewise
 * honored for the horizontal axis even though the reference's option table omits it — a real device
 * accepts it and pins the focused column at the grid's left edge.
 */
export function resolveFocusStyle(raw: string | undefined): FocusStyle | undefined {
    const value = (raw ?? "").toLowerCase();
    for (const style of Object.values(FocusStyle)) {
        if (style.toLowerCase() === value) {
            return style;
        }
    }
    if (value === "fixed") {
        return FocusStyle.FixedFocus;
    }
    return undefined;
}

export declare namespace ArrayGrid {
    type Metadata = {
        index: number;
        divider: boolean;
        sectionTitle: string;
    };
}

/**
 * Stand-in for `focusFeedbackPoster.renderNode`'s interpreter param when `sgRoot.interpreter` is not
 * yet registered (a direct-render unit test that never calls `sgRoot.setInterpreter`). Safe because
 * that param only ever reaches `renderChildren`, and this poster is never given scenegraph children.
 */
const noopInterpreter = {} as Interpreter;

/**
 * Focus motion, DEVICE-MEASURED (Roku OS 16.0; `test/simulator/probes/list-focus-motion-probe` and
 * `grid-focus-motion-probe`). Every step is a cubic ease-out: ~200 ms per row on a list, ~330 ms per row or
 * column on a grid (~315 ms per row when a grid's rows wrap). A held key, after one step and a pause
 * (~400 ms list, ~530 ms grid), keeps stepping at that pace, accelerating from rest on the first repeat; on
 * release the step in flight eases out to its cell.
 */
const ListStepMs = 200;
const ListHoldDelayMs = 400;
export const GridStepMs = 330;
export const GridWrapRowStepMs = 315;
export const GridHoldDelayMs = 530;
/** Fraction of the first held-key repeat spent accelerating from rest to the steady pace. */
const HoldRampFraction = 0.3;
/** A cell's in-transit `focusPercent` below this reads 0 (DEVICE-MEASURED: 0.063 is followed by 0). */
const FocusPercentFloor = 0.05;

export type MotionAxis = "row" | "col";
type MotionCurve = "out" | "linear" | "rampIn";
/** One axis of a focus motion: rows are unwrapped (a wrap continues past the end), columns never wrap. */
type MotionSegment = { from: number; to: number; start: number; duration: number; curve: MotionCurve };

/** A list's or grid's in-flight focus motion. */
export type FocusMotion = {
    row: MotionSegment;
    col: MotionSegment;
    /** One key press received mid-step: the next step's target. */
    queued?: { row: number; col: number };
    /** Both axes reached their target; the settle goes out on a later frame. */
    arrived: boolean;
    /** Floating focus: the visual top row when the motion began. */
    topFrom: number;
    /** Data-model index published as `itemFocused` when the motion settles. */
    contentIndex: number;
    /** Axes whose direction field still reads a direction (reset to "none" as each one finishes). */
    vertOpen: boolean;
    horizOpen: boolean;
    /** Axes that moved at all during this motion. */
    rowMoved: boolean;
    colMoved: boolean;
    /** A held key's motion is waiting at a cell for the repeat to start (see `onMotionPaused`). */
    paused: boolean;
    /** Focus came back mid-motion: the target item already has focus (see `publishMotionRegain`). */
    regained?: boolean;
};

export class ArrayGrid extends Group implements UITransition {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "itemSize", type: "vector2d", value: "[0,0]" },
        { name: "itemSpacing", type: "vector2d", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "focusRow", type: "integer", value: "0", alwaysNotify: true },
        { name: "focusColumn", type: "integer", value: "0", alwaysNotify: true },
        { name: "horizFocusAnimationStyle", type: "string", value: FocusStyle.FloatingFocus },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FloatingFocus },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "fadeFocusFeedbackWhenAutoScrolling", type: "boolean", value: "false" },
        { name: "currFocusFeedbackOpacity", type: "float", value: "0" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFeedbackPoster", type: "node" }, // Introduced in OS 16.0
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerWidth", type: "float", value: "0" },
        { name: "wrapDividerHeight", type: "float", value: "36" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "numRenderPasses", type: "integer", value: "1" },
        { name: "rowHeights", type: "floatarray", value: "[]" },
        { name: "columnWidths", type: "floatarray", value: "[]" },
        { name: "rowSpacings", type: "floatarray", value: "[]" },
        { name: "columnSpacings", type: "floatarray", value: "[]" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "sectionDividerTextColor", type: "color", value: "0xddddddff" },
        { name: "sectionDividerSpacing", type: "float", value: "0.0" },
        { name: "sectionDividerWidth", type: "float", value: "0.0" },
        { name: "sectionDividerHeight", type: "float", value: "40" },
        { name: "sectionDividerMinWidth", type: "float", value: "0.0" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0.0" },
        { name: "itemClippingRect", type: "rect2d", value: "[0.0,0.0,0.0,0.0]" },
        { name: "itemSelected", type: "integer", value: "-1", alwaysNotify: true },
        { name: "itemFocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "itemUnfocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "jumpToItem", type: "integer", value: "-1", alwaysNotify: true },
        { name: "animateToItem", type: "integer", value: "-1", alwaysNotify: true },
        // Read-only on device: true while the list/grid is scrolling the focus. Documented under
        // ZoomRowList but present on all ArrayGrid-derived nodes on a real Roku (apps alias it on
        // plain RowList). Pulsed true→false around a key-driven focus move (see armScrollPulse).
        { name: "scrollingStatus", type: "boolean", value: "false" },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
        // Read-only on device: the direction ("up"/"down"/"none") of the most recent vertical focus
        // move. Undocumented in the public reference but present on real Roku ArrayGrid-derived nodes;
        // apps observe it to track scroll direction (e.g. to position an in-transit overlay toward the
        // incoming row). Emitted as up/down on a vertical nav then reset to "none".
        { name: "vertFocusDirection", type: "string", value: "none" },
        // Read-only on device: the direction ("left"/"right"/"none") of the focus move in progress along
        // a grid row (DEVICE-MEASURED, grid-focus-motion-probe). Undocumented, like vertFocusDirection.
        { name: "horizFocusDirection", type: "string", value: "none" },
        { name: "skipFocusAnimations", type: "boolean", value: "false" },
    ];
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    /**
     * The built-in footprint a list (LabelList, MarkupList) draws on its focused item while it doesn't
     * have the focus. Grids and row lists have none: unless the app sets `focusFootprintBitmapUri`, they
     * draw nothing there (DEVICE-MEASURED, focus-footprint-layer-probe). Subclasses seed it themselves.
     */
    protected static readonly builtinFootprintUri = "common:/images/focus_footprint.9.png";
    protected readonly content: ContentNode[] = [];
    protected readonly metadata: ArrayGrid.Metadata[] = [];
    protected readonly itemComps: Group[] = [];
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly lineHeight: number;
    protected focusIndex: number = 0;
    protected numRows: number = 0;
    protected numCols: number = 0;
    protected currRow: number = 0;
    protected topRow: number = 0;
    // Set when the focus/scroll position changes and cleared once renderNode re-lays-out the grid.
    // While set, a subBoundingRect query refreshes layout first so it reports the settled focus-band
    // position instead of the newly focused item's stale, pre-scroll cached rect (see
    // needsSubBoundingRectRefresh / Node.getSubBoundingRect).
    protected focusLayoutDirty: boolean = false;
    protected wrap: boolean = false;
    protected lastPressHandled: string;
    /**
     * A navigation key is being handled and `scrollingStatus` may still need its rising edge. Armed
     * by `armScrollPulse`, consumed by the first `emitScrollPulse` (see `armScrollPulse`).
     */
    protected scrollPulseArmed: boolean = false;
    /** The rising edge has been emitted and the falling edge is still owed. */
    protected scrollPulseActive: boolean = false;
    protected hasNinePatch: boolean;
    protected focusField: string;
    protected vertFocusAnimationStyleName: string = FocusStyle.FloatingFocus.toLowerCase();
    protected horizFocusAnimationStyleName: string = FocusStyle.FloatingFocus.toLowerCase();
    public itemFocusCallback?: (index: number) => void;
    /** Focus motion (see `focusMotionEnabled`). */
    protected motion?: FocusMotion;
    /** The visual focus row: unwrapped while moving, the focused row when idle. */
    protected motionPos = 0;
    /** The visual focus column. */
    protected motionCol = 0;
    /** Items holding a fractional `focusPercent` from the last motion frame. */
    private readonly motionPercentItems = new Set<number>();
    /**
     * The navigation key being handled (`navDirection`, `navAxis`) and an `animateToItem` being applied
     * (`animateRequested`). Each holds only at the observer depth it was set at: an observer those
     * moves raise runs app code, and a `jumpToItem` it writes is an app write, not part of the move.
     */
    private navState = { direction: 0, axis: "" as MotionAxis | "", depth: 0 };
    private animateState = { requested: false, depth: 0 };

    /** Set while `animateToItem` (app write or key navigation) is being applied. */
    protected get animateRequested(): boolean {
        return this.animateState.requested && this.animateState.depth === Field.currentObserverDepth();
    }
    protected set animateRequested(requested: boolean) {
        this.animateState = { requested, depth: Field.currentObserverDepth() };
    }

    /** Direction (+1 down/right, -1 up/left) of the navigation key being handled; 0 otherwise. */
    protected get navDirection(): number {
        return this.navState.depth === Field.currentObserverDepth() ? this.navState.direction : 0;
    }
    protected set navDirection(direction: number) {
        this.navState = { ...this.navState, direction, depth: Field.currentObserverDepth() };
    }

    /** Axis of the navigation key being handled; "" otherwise. */
    protected get navAxis(): MotionAxis | "" {
        return this.navState.depth === Field.currentObserverDepth() ? this.navState.axis : "";
    }
    protected set navAxis(axis: MotionAxis | "") {
        this.navState = { ...this.navState, axis, depth: Field.currentObserverDepth() };
    }
    /** The navigation key still held down, and when it was pressed. */
    private heldKey = "";
    private heldSince = 0;
    private holdRepeating = false;
    /** Repeats of the held key so far (the first one accelerates from rest). */
    private holdRepeats = 0;
    /** The app wrote `drawFocusFeedbackOnTop` (XML or BrightScript); see `focusFeedbackOnTop`. */
    private focusOnTopWritten = false;
    /** While a settle publishes: the motions its observers started, begun once the settle is complete. */
    private settleFollowUps: (() => void)[] | undefined;
    /** A motion that settled outside the focus chain: the item a focus gain lands on (see `focusGainIndex`). */
    private unfocusedSettleIndex: number | undefined;
    /** New content reset the focus to item 0; its `itemFocused` goes out later (see `resetFocusForNewContent`). */
    private pendingContentFocus = false;
    /** `setNodeFocus` is re-applying the focus on a gain (see `setFocusedItem`). */
    private gainingFocus = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ArrayGrid) {
        super([], name);
        this.setExtendsType(SGNodeType.ArrayGrid, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        // Roku leaves the `content` node field invalid until the app assigns it; apps rely on
        // `content = invalid` to detect "not loaded yet" (e.g. SGDEX's lazy content managers).
        // Do NOT seed an empty ContentNode here — all readers guard with `instanceof ContentNode`.
        if (this.resolution === "FHD") {
            this.marginX = 36;
            this.marginY = 6;
            this.lineHeight = 4.5;
            this.setValueSilent("wrapDividerHeight", new Float(36));
            this.setValueSilent("sectionDividerHeight", new Float(60));
            this.setValueSilent("sectionDividerMinWidth", new Float(126));
            this.setValueSilent("sectionDividerSpacing", new Float(15));
        } else {
            this.marginX = 24;
            this.marginY = 4;
            this.lineHeight = 3;
            this.setValueSilent("wrapDividerHeight", new Float(24));
            this.setValueSilent("sectionDividerHeight", new Float(40));
            this.setValueSilent("sectionDividerMinWidth", new Float(117));
            this.setValueSilent("sectionDividerSpacing", new Float(10));
        }
        this.gap = this.marginX / 2;
        this.setValueSilent("focusable", BrsBoolean.True);
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.setValueSilent("sectionDividerBitmapUri", new BrsString(this.dividerUri));
        const focusFeedbackPoster = SGNodeFactory.createNode(SGNodeType.Poster) as Poster;
        focusFeedbackPoster.setNodeParent(this);
        this.setValueSilent("focusFeedbackPoster", focusFeedbackPoster);
        this.applyVertFocusStyle();
        this.applyHorizFocusStyle();
        this.lastPressHandled = "";
        this.hasNinePatch = false;
        this.focusField = "listHasFocus";
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "drawfocusfeedbackontop") {
            this.focusOnTopWritten = true;
        }
        if (fieldName === "content" && value instanceof ContentNode) {
            this.abortMotion();
            super.setValue(index, value, alwaysNotify, kind);
            this.itemComps.length = 0;
            this.refreshContent();
            this.resetFocusForNewContent(true);
            return;
        } else if (fieldName === "jumptoitem" && isNumberComp(value)) {
            this.jumpToItem(value);
        } else if (fieldName === "animatetoitem" && isNumberComp(value)) {
            this.animateToItem(value);
        } else if (!this.acceptFieldValue(fieldName, value)) {
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
        this.afterFieldSet(fieldName);
    }

    /** An app's `jumpToItem` write: the focus lands at once. */
    private jumpToItem(value: BrsType) {
        this.settleMotion();
        this.flushContentFocus();
        if (this.listFocusModel() && sgRoot.focused !== this && !this.isChildrenFocused()) {
            // An unfocused jump reports that no item has the focus, on every write (DEVICE-MEASURED,
            // list-focus-dispatch-probe R2-R4).
            super.setValue("itemUnfocused", new Int32(-1));
        }
        this.setFocusedItem(jsValueOf(value));
    }

    /** An app's `animateToItem` write: the focus moves like a key press. */
    private animateToItem(value: BrsType) {
        this.flushContentFocus();
        this.animateRequested = true;
        try {
            this.setFocusedItem(jsValueOf(value));
        } finally {
            this.animateRequested = false;
        }
    }

    /**
     * Applies a field whose value this grid caches or validates before it is stored. Returns false when
     * the write is rejected and the field keeps its current value.
     */
    private acceptFieldValue(fieldName: string, value: BrsType): boolean {
        if (fieldName === "focusfeedbackposter") {
            // Must stay a Poster (matches BusySpinner's `poster` field). No private cache is kept for
            // it — `renderFocus` re-reads the field every draw, because `Node.cloneNode` aliases a
            // node-valued field onto the SAME node while still re-running this constructor, which
            // would desync a cache from the field the moment a grid is cloned.
            if (!(value instanceof Poster)) {
                return false;
            }
            value.setNodeParent(this);
        } else if (fieldName === "vertfocusanimationstyle" && isBrsString(value)) {
            // An invalid style is ignored.
            const style = resolveFocusStyle(value.toString());
            if (!style) {
                return false;
            }
            this.vertFocusAnimationStyleName = style.toLowerCase();
            this.wrap = style === FocusStyle.FixedFocusWrap;
        } else if (fieldName === "horizfocusanimationstyle" && isBrsString(value)) {
            // An invalid style keeps the field's current value (device behavior).
            const style = resolveFocusStyle(value.toString());
            if (!style) {
                return false;
            }
            this.horizFocusAnimationStyleName = style.toLowerCase();
        }
        return true;
    }

    /** Refreshes the state derived from a field after it is stored. */
    private afterFieldSet(fieldName: string) {
        if (fieldName === "focusedchild" && sgRoot.focused !== this && !this.isChildrenFocused()) {
            // Leaving the focus chain drops the item's focus at once, even on a hidden list (DEVICE-MEASURED,
            // focus-motion-edge-probe C/D); the render pass would only catch up once the list is drawn.
            this.updateItemFocus(this.focusIndex, true, false);
        }
        // Refresh cached row/column counts from the (possibly coerced) field value, so a
        // numeric string such as "7" from a settings lookup is honored — not just a raw
        // number. super.setValue coerces the string into the integer field the same way a
        // Roku device does, making the field the single source of truth.
        if (fieldName === "numrows") {
            this.numRows = this.getValueJS("numrows") as number;
        } else if (fieldName === "numcolumns") {
            this.numCols = this.getValueJS("numcolumns") as number;
        }
        const rowFields = ["vertfocusanimationstyle", "numrows", "focusrow"];
        // Update the current row if some fields changed
        if (rowFields.includes(fieldName)) {
            this.currRow = this.updateCurrRow();
        }
    }

    setNodeFocus(focusOn: boolean): boolean {
        if (!focusOn) {
            // Losing focus mid-motion: land the focus first, while the list is still in the chain.
            this.settleMotion();
        }
        const focus = super.setNodeFocus(focusOn);
        // Node.setNodeFocus reports focusability, not a gain: only a gain re-applies itemFocused, and an
        // observer may have moved the focus on before it returned.
        const gained = focus && focusOn && sgRoot.focused === this;
        if (gained && this.motion) {
            this.publishMotionRegain(this.motion);
        } else if (gained) {
            let focusIndex = this.focusGainIndex();
            if (focusIndex < 0) {
                // No item has been focused yet: default to the first item (Roku's itemFocused
                // default is 0). Rebuild the internal content view first so items added in place
                // (e.g. via ContentNode.update() after the content node was assigned empty) count.
                this.refreshContent();
                if (this.content.length > 0) {
                    focusIndex = 0;
                }
            }
            if (focusIndex >= 0) {
                this.gainingFocus = true;
                try {
                    this.setFocusedItem(focusIndex);
                } finally {
                    this.gainingFocus = false;
                }
            }
        }
        return focus;
    }

    /**
     * The item a focus gain lands on: the last `itemFocused`, or -1 when none was focused yet. A motion that
     * settled while the focus was elsewhere leaves `itemFocused` on the item it left (DEVICE-MEASURED,
     * focus-motion-edge-probe A), but the gain lands on the motion's target.
     */
    protected focusGainIndex(): number {
        return this.unfocusedSettleIndex ?? (this.getValueJS("itemFocused") as number);
    }

    /**
     * Lists and grids follow the device-measured focus model (list-focus-dispatch-probe): a gain publishes
     * no `itemUnfocused`, an unfocused `jumpToItem` publishes `itemUnfocused` -1, and new content
     * publishes its reset lazily. Row lists and TimeGrid keep their own model until measured.
     */
    protected listFocusModel(): boolean {
        return true;
    }

    /** Publishes the reset to item 0 that new content left pending, when the list is in the focus chain. */
    protected flushContentFocus() {
        if (!this.pendingContentFocus) {
            return;
        }
        this.pendingContentFocus = false;
        if ((sgRoot.focused === this || this.isChildrenFocused()) && this.content.length > 0) {
            super.setValue("itemFocused", new Int32(0));
            // The owning ListPanel/GridPanel creates its next panel from this focus, as on any other
            // focus landing (setFocusedItem, the motion settle).
            this.itemFocusCallback?.(0);
        }
    }

    /**
     * Focus regained mid-motion (DEVICE-MEASURED, focus-motion-edge-probe B): the target item's
     * `itemHasFocus`, then `itemFocused`, while the motion runs on; its settle publishes `itemFocused` again.
     */
    protected publishMotionRegain(motion: FocusMotion) {
        motion.regained = true;
        this.updateItemFocus(this.focusIndex, true, sgRoot.focused === this);
        super.setValue("itemFocused", new Int32(motion.contentIndex));
    }

    /**
     * Reconciles the focus cursor after the content view changes (a fresh `content` assignment, or
     * an in-place populate/mutation detected during render).
     *
     * On a real device `itemFocused` only changes when focus moves onto an item — loading content
     * into a list that is not in the focus chain does NOT fire it (verified on hardware). So:
     * - If the grid currently has focus and content is non-empty, focus item 0 now (emitting
     *   `itemFocused`) so a focused list reflects the newly loaded content, matching Roku.
     * - If the grid is not focused, stay silent: reset the internal cursor and, for a fresh content
     *   assignment, clear `itemFocused` back to the "never focused" sentinel so a later focus-gain
     *   (`setNodeFocus`) fires `itemFocused = 0`. A non-fresh in-place change on an unfocused grid
     *   leaves any established value untouched.
     *
     * @param freshContent True when a brand-new `content` node was assigned (vs. an in-place
     *   populate/mutation of the existing tree). A fresh assignment resets the cursor to item 0.
     */
    protected resetFocusForNewContent(freshContent: boolean) {
        this.unfocusedSettleIndex = undefined;
        const focused = sgRoot.focused === this || this.isChildrenFocused();
        if (freshContent && this.listFocusModel()) {
            // DEVICE-MEASURED (list-focus-dispatch-probe D2, D5, S): a content write publishes nothing. The
            // focus resets to item 0 at once, and its `itemFocused` 0 goes out before the next jump or once
            // the current handler (or init) returns, and only if the list is in the focus chain by then.
            this.focusIndex = 0;
            this.focusLayoutDirty = true;
            this.updateHorizScroll(0);
            this.setValueSilent("itemFocused", new Int32(focused && this.content.length > 0 ? 0 : -1));
            if (this.content.length > 0 && !this.pendingContentFocus) {
                this.pendingContentFocus = true;
                Field.runAfterConstruction(() => this.flushContentFocus());
            }
            return;
        }
        if (focused) {
            if (this.content.length > 0 && (freshContent || (this.getValueJS("itemFocused") as number) < 0)) {
                this.setFocusedItem(0);
            }
            return;
        }
        if (freshContent) {
            // Unfocused, brand-new content: reset the cursor and the sentinel silently (no observer
            // fire). setNodeFocus will emit itemFocused = 0 when focus later lands on the grid.
            this.focusIndex = 0;
            this.focusLayoutDirty = true;
            this.setValueSilent("itemFocused", new Int32(-1));
        }
    }

    /**
     * Moves the focus cursor to `index`, emitting the focus-move fields (`itemUnfocused`,
     * `itemFocused`) ONLY when the grid is actually in the focus chain.
     *
     * On a real device `itemFocused` changes only when an item gains the key focus — writing
     * `jumpToItem`/`animateToItem`, assigning `content`, or populating content on a grid that is
     * NOT in the focus chain does not fire it (verified on hardware). So when the grid is unfocused
     * this records the target index SILENTLY (no observer notification): the internal cursor and the
     * `itemFocused` value are updated so the position is remembered, and `setNodeFocus` re-emits
     * `itemFocused` when focus later lands on the grid. This prevents list-driven side effects (e.g.
     * an app starting a preview video off an `itemFocused` observer) from triggering while focus is
     * still elsewhere.
     */
    protected setFocusedItem(index: number) {
        const newFocus = this.findContentIndex(index);
        if (newFocus === -1) {
            return;
        }
        this.unfocusedSettleIndex = undefined;
        const nodeFocus = sgRoot.focused === this;
        const inFocusChain = nodeFocus || this.isChildrenFocused();
        if (inFocusChain && this.animateRequested && this.focusMotionEnabled() && sgRoot.uiTransitionsEnabled) {
            this.moveFocusAnimated(index, newFocus);
            return;
        }
        if (inFocusChain) {
            // Skipped when unfocused: that path publishes no focus fields at all (see armScrollPulse).
            this.openScrollPulse();
        }
        const focusedIndex = this.getValueJS("itemFocused") as number;
        // A gain re-applies the focus where it is (DEVICE-MEASURED, list-focus-dispatch-probe): no
        // `itemUnfocused`, and the item keeps its focus rather than dropping and regaining it.
        const gaining = this.gainingFocus;
        if (!gaining || newFocus !== this.focusIndex) {
            this.updateItemFocus(this.focusIndex, false, nodeFocus);
        }
        // A key-driven move publishes its direction right after itemUnfocused and resets it after the
        // settle (DEVICE-MEASURED order, list/grid-focus-motion-probe).
        const directionField = this.navAxis ? this.directionFieldFor(this.navAxis) : "";
        const direction =
            this.navDirection === 0 || !this.navAxis || !directionField
                ? ""
                : this.directionName(this.navAxis, this.navDirection);
        if (inFocusChain && !gaining) {
            super.setValue("itemUnfocused", new Int32(focusedIndex));
            if (direction) {
                super.setValue(directionField, new BrsString(direction));
            }
        }
        // The new item gains its focus after itemUnfocused (DEVICE-MEASURED, list-focus-dispatch-probe D1).
        this.focusIndex = newFocus;
        this.focusLayoutDirty = true;
        this.updateHorizScroll(newFocus);
        this.updateItemFocus(this.focusIndex, true, nodeFocus);
        if (inFocusChain) {
            // currFocusRow/currFocusColumn must already reflect the new position before
            // itemFocused fires: apps commonly read them synchronously from an itemFocused
            // observer (see RowList.setFocusedItem for the same ordering requirement).
            const numCols = Math.max(1, this.numCols || 1);
            super.setValue("currFocusRow", new Float(Math.floor(newFocus / numCols)));
            super.setValue("currFocusColumn", new Float(newFocus % numCols));
            super.setValue("itemFocused", new Int32(index));
            this.closeScrollPulse();
            if (direction) {
                super.setValue(directionField, new BrsString("none"));
            }
        } else {
            // Unfocused: remember the target without notifying observers. setNodeFocus emits it on
            // focus-gain (it reads itemFocused, defaulting to 0 when still at the -1 sentinel).
            this.setValueSilent("itemFocused", new Int32(index));
        }
        if (this.itemFocusCallback) {
            this.itemFocusCallback(index);
        }
    }

    // ---- Focus motion ----

    /**
     * Whether this node animates its focus moves (`animateToItem` and key navigation). Each list, grid and
     * row list opts in; the base stays instant.
     */
    protected focusMotionEnabled(): boolean {
        return false;
    }

    /** Duration of one step along `axis` (DEVICE-MEASURED): lists 200 ms; grids override. */
    protected motionStepMs(_axis: MotionAxis): number {
        return ListStepMs;
    }

    /** How long a key must be held before it starts repeating (DEVICE-MEASURED): lists 400 ms. */
    protected motionHoldDelayMs(): number {
        return ListHoldDelayMs;
    }

    private motionColumns(): number {
        return Math.max(1, this.numCols || 1);
    }

    protected motionRows(): number {
        return Math.max(1, Math.ceil(this.content.length / this.motionColumns()));
    }

    /**
     * Starts or extends the focus motion toward `newFocus`. DEVICE-MEASURED field timing: the motion
     * opens with `scrollingStatus` true, the old item's `itemHasFocus` false, `itemUnfocused` and the
     * direction fields; `currFocusRow`/`currFocusColumn` and the neighboring items' `focusPercent` then
     * follow the motion frame by frame, and `itemFocused` only goes out when it settles (see
     * `settleMotion`). The focus cursor itself moves now, so further keys navigate from the target.
     */
    protected moveFocusAnimated(index: number, newFocus: number) {
        const numCols = this.motionColumns();
        const rows = this.motionRows();
        const motion = this.motion;
        const baseRow = motion ? motion.queued?.row ?? motion.row.to : Math.floor(this.focusIndex / numCols);
        const baseCol = motion ? motion.queued?.col ?? motion.col.to : this.focusIndex % numCols;
        const deltaRow = this.motionDelta(
            Math.floor(newFocus / numCols),
            baseRow,
            rows,
            this.wrap,
            this.rowKeyBackward()
        );
        const deltaCol = (newFocus % numCols) - Math.round(baseCol);
        if (deltaRow === 0 && deltaCol === 0) {
            return;
        }
        const target = { row: baseRow + deltaRow, col: Math.round(baseCol) + deltaCol };
        this.startFocusMotion(index, { row: baseRow, col: baseCol }, target, () => {
            this.focusIndex = newFocus;
            this.focusLayoutDirty = true;
            this.updateHorizScroll(newFocus);
        });
    }

    /**
     * Steps from the motion position `base` to slot `index` among `count` slots. A wrapping axis scrolls
     * the way the key points (`backward`); a programmatic move always scrolls forward.
     */
    protected motionDelta(index: number, base: number, count: number, wraps: boolean, backward: boolean): number {
        const delta = index - positiveMod(Math.round(base), count);
        if (!wraps) {
            return delta;
        }
        const forward = positiveMod(delta, count);
        return forward !== 0 && backward ? forward - count : forward;
    }

    /** Whether an Up key is driving the move (a wrapping row axis then scrolls backward). */
    protected rowKeyBackward(): boolean {
        return this.navAxis === "row" && this.navDirection < 0;
    }

    /**
     * Starts or extends a focus motion toward `target` (unwrapped rows/columns). `base` is where an idle
     * focus starts from; `apply` moves the logical focus cursor, which happens now so further keys
     * navigate from the target. A key press mid-step is queued (one at most); a held key's repeat or a
     * programmatic move retargets from where the focus is.
     */
    protected startFocusMotion(
        contentIndex: number,
        base: { row: number; col: number },
        target: { row: number; col: number },
        apply: () => void
    ) {
        if (this.settleFollowUps) {
            // A settle observer moved the focus on: the new motion opens after the settle's last field,
            // still timed as the request it came from (an `animateToRow` steps faster than a key).
            const animate = this.animateRequested;
            this.settleFollowUps.push(() => {
                const previous = this.animateRequested;
                this.animateRequested = animate;
                try {
                    this.startFocusMotion(contentIndex, base, target, apply);
                } finally {
                    this.animateRequested = previous;
                }
            });
            return;
        }
        this.startOrExtendMotion(contentIndex, base, target, apply);
    }

    private startOrExtendMotion(
        contentIndex: number,
        base: { row: number; col: number },
        target: { row: number; col: number },
        apply: () => void
    ) {
        const now = sgClock.perfNow();
        this.scrollPulseArmed = false;
        const motion = this.motion;
        if (motion) {
            if (!motion.arrived && this.navDirection !== 0 && !this.holdRepeating) {
                motion.queued = target;
            } else {
                // A retarget supersedes any press waiting behind the step in flight.
                motion.queued = undefined;
                this.startMotionSegments(motion, target, now);
            }
            motion.contentIndex = contentIndex;
            apply();
        } else if (!this.beginMotion(contentIndex, base, target, now, apply)) {
            return;
        }
        if (this.getValueJS("skipFocusAnimations") === true) {
            this.motionPos = target.row;
            this.motionCol = target.col;
            this.emitMotionFrame();
            this.settleMotion();
            return;
        }
        sgRoot.addTransition(this);
    }

    /**
     * Opens a motion from rest. Returns false when an observer of the opening fields superseded it (an
     * app's `jumpToItem` lands the motion at once): the move is dropped and the app's write stands.
     */
    private beginMotion(
        contentIndex: number,
        base: { row: number; col: number },
        target: { row: number; col: number },
        now: number,
        apply: () => void
    ): boolean {
        const idle = (at: number): MotionSegment => ({ from: at, to: at, start: now, duration: 0, curve: "out" });
        const motion: FocusMotion = {
            row: idle(base.row),
            col: idle(base.col),
            arrived: false,
            topFrom: Math.round(base.row) - this.currRow,
            contentIndex,
            vertOpen: false,
            horizOpen: false,
            rowMoved: false,
            colMoved: false,
            paused: false,
        };
        this.motion = motion;
        this.motionPos = base.row;
        this.motionCol = base.col;
        this.motionPercentItems.clear();
        this.openMotion(target);
        if (this.motion !== motion) {
            return false;
        }
        apply();
        this.startMotionSegments(motion, target, now);
        return true;
    }

    /**
     * Publishes the opening of a motion (DEVICE-MEASURED): `scrollingStatus` true, the old item's
     * `itemHasFocus` false, then `itemUnfocused`. The direction fields follow from `startMotionSegments`.
     */
    protected openMotion(_target: { row: number; col: number }) {
        const oldFocus = this.focusIndex;
        super.setValue("scrollingStatus", BrsBoolean.True);
        this.motionPercentItems.add(oldFocus);
        this.updateItemFocus(oldFocus, false, sgRoot.focused === this);
        super.setValue("itemUnfocused", new Int32(this.getValueJS("itemFocused") as number));
    }

    /** The direction field an axis reports, or "" when the node has none for it. */
    protected directionFieldFor(axis: MotionAxis): string {
        return axis === "col" ? "horizFocusDirection" : "vertFocusDirection";
    }

    /** A held key's motion paused at a cell before repeating; nodes that publish an interim settle override. */
    protected onMotionPaused() {
        // ArrayGrid publishes nothing until the release.
    }

    /** The held key's repeat left the cell it paused at. */
    protected onMotionResumed() {
        // ArrayGrid publishes nothing.
    }

    /**
     * Starts the next step on both axes from where the focus is now. A key step eases out over the
     * measured step time per cell; a held key's repeats run at that same pace, the first one
     * accelerating from rest. An axis that starts moving publishes its direction (horizontal first).
     */
    private startMotionSegments(motion: FocusMotion, target: { row: number; col: number }, now: number) {
        if (motion.paused) {
            motion.paused = false;
            this.onMotionResumed();
        }
        let curve: MotionCurve = "out";
        if (this.holdRepeating && this.canStepPast(target)) {
            curve = this.holdRepeats <= 1 ? "rampIn" : "linear";
        }
        const stretch = curve === "rampIn" ? 1 / (1 - HoldRampFraction / 2) : 1;
        const axes: [MotionAxis, MotionSegment, number, number][] = [
            ["col", motion.col, this.motionCol, target.col],
            ["row", motion.row, this.motionPos, target.row],
        ];
        for (const [axis, segment, from, to] of axes) {
            segment.from = from;
            segment.to = to;
            segment.start = now;
            segment.duration = Math.abs(to - from) * this.motionStepMs(axis) * stretch;
            segment.curve = curve;
            if (to === from) {
                continue;
            }
            const field = this.directionFieldFor(axis);
            if (axis === "col") {
                motion.colMoved = true;
                if (field && !motion.horizOpen) {
                    motion.horizOpen = true;
                    super.setValue(field, new BrsString(this.directionName("col", to - from)));
                }
            } else {
                motion.rowMoved = true;
                if (field && !motion.vertOpen) {
                    motion.vertOpen = true;
                    super.setValue(field, new BrsString(this.directionName("row", to - from)));
                }
            }
        }
        motion.arrived = false;
    }

    /**
     * Whether the held key could move on past `target`. A repeat that can't — the last cell of a
     * non-wrapping row or column — eases out from rest like a single step (DEVICE-MEASURED).
     */
    protected canStepPast(target: { row: number; col: number }): boolean {
        const numCols = this.motionColumns();
        const rows = this.motionRows();
        const row = positiveMod(Math.round(target.row), rows);
        if (this.navAxis === "col") {
            const col = target.col + this.navDirection;
            return col >= 0 && col < numCols && row * numCols + col < this.content.length;
        }
        if (this.wrap) {
            return true;
        }
        const next = row + this.navDirection;
        return next >= 0 && next < rows && next * numCols < this.content.length;
    }

    /** The axis position at `now` along its curve. */
    private segmentValue(segment: MotionSegment, now: number): number {
        if (segment.duration <= 0) {
            return segment.to;
        }
        const u = Math.min(Math.max((now - segment.start) / segment.duration, 0), 1);
        let fraction: number;
        if (segment.curve === "linear") {
            fraction = u;
        } else if (segment.curve === "rampIn") {
            // Constant acceleration over the first HoldRampFraction of the step, then the steady pace.
            const r = HoldRampFraction;
            fraction = u < r ? (u * u) / (2 * r * (1 - r / 2)) : (u - r / 2) / (1 - r / 2);
        } else {
            fraction = easeOutCubic(u);
        }
        return segment.from + (segment.to - segment.from) * fraction;
    }

    private segmentDone(segment: MotionSegment, now: number): boolean {
        return now >= segment.start + segment.duration;
    }

    private directionName(axis: MotionAxis, direction: number): string {
        if (axis === "col") {
            return direction > 0 ? "right" : "left";
        }
        return direction > 0 ? "down" : "up";
    }

    /** One press already waits behind the step in flight. */
    private motionQueueFull(): boolean {
        return this.motion !== undefined && !this.motion.arrived && this.motion.queued !== undefined;
    }

    /**
     * `focusPercent` while moving: along each axis the cell being left holds `1 - fraction` and the next
     * one `fraction`; on a grid the two axes multiply. (Approximation: a device moving diagonally — only
     * `animateToItem` does — appears to follow the row axis alone.)
     */
    protected motionFocusPercent(index: number): number {
        const numCols = this.motionColumns();
        const rows = this.motionRows();
        if (this.content.length === 0) {
            return 0;
        }
        const row = positiveMod(this.motionPos, rows);
        const row0 = Math.floor(row);
        const rowFraction = row - row0;
        const col0 = Math.floor(this.motionCol);
        const colFraction = this.motionCol - col0;
        const itemRow = Math.floor(index / numCols);
        const itemCol = index % numCols;
        let rowWeight = 0;
        if (itemRow === row0) {
            rowWeight = 1 - rowFraction;
        } else if (rowFraction > 0 && itemRow === (row0 + 1) % rows) {
            rowWeight = rowFraction;
        }
        let colWeight = 0;
        if (itemCol === col0) {
            colWeight = 1 - colFraction;
        } else if (colFraction > 0 && itemCol === col0 + 1) {
            colWeight = colFraction;
        }
        return this.publishedPercent(rowWeight * colWeight);
    }

    /** An in-transit percent as published: 0 below the device's floor, rounded to 3 decimals. */
    protected publishedPercent(percent: number): number {
        return percent < FocusPercentFloor ? 0 : Math.round(percent * 1000) / 1000;
    }

    /** Publishes the in-transit fields: `currFocusRow` (wrapping), `currFocusColumn`, and the cells' `focusPercent`. */
    protected emitMotionFrame() {
        const numCols = this.motionColumns();
        const rows = this.motionRows();
        const row = positiveMod(this.motionPos, rows);
        super.setValue("currFocusRow", new Float(row));
        super.setValue("currFocusColumn", new Float(this.motionCol));
        const row0 = Math.floor(row);
        const row1 = (row0 + 1) % rows;
        const col0 = Math.floor(this.motionCol);
        const touched = new Set(this.motionPercentItems);
        for (const r of [row0, row1]) {
            for (const c of [col0, col0 + 1]) {
                if (c < numCols && r * numCols + c < this.content.length) {
                    touched.add(r * numCols + c);
                }
            }
        }
        this.motionPercentItems.clear();
        for (const item of touched) {
            const percent = this.motionFocusPercent(item);
            this.itemComps[item]?.setValue("focusPercent", new Float(percent), false);
            if (percent > 0) {
                this.motionPercentItems.add(item);
            }
        }
    }

    // ---- Row-list motion helpers (RowList, ZoomRowList: a matrix of item components) ----

    /** Rows and cells holding an in-transit row percent / `focusPercent` from the last motion frame. */
    private readonly motionRowSet = new Set<number>();
    private readonly motionCellSet = new Set<string>();

    /**
     * Whether a row or column loop can stop at `itemRect`, the next item's slot. At rest that is any slot
     * off the screen. Mid-motion rows scrolled off the top are followed by visible ones, so only a slot at
     * or past the bottom or right edge ends the loop: nothing after it can show, and drawing it would
     * create its item component for nothing.
     */
    protected pastVisibleArea(screen: Rect, itemRect: Rect, moving: boolean): boolean {
        if (!moving) {
            return !RectRect(screen, itemRect);
        }
        return itemRect.y >= screen.y + screen.height || itemRect.x >= screen.x + screen.width;
    }

    /**
     * Top row of a floating-focus window mid-motion: it stays where the motion found it until the focus
     * reaches an edge, then follows it, within the content.
     */
    protected floatingVisualTop(motion: FocusMotion, displayRows: number): number {
        const maxTop = Math.max(0, this.motionRows() - displayRows);
        const kept = Math.min(Math.max(motion.topFrom, this.motionPos - (displayRows - 1)), this.motionPos);
        return Math.min(Math.max(kept, 0), maxTop);
    }

    /** The row's item count (at least 1), read without building its content list: it runs per cell per frame. */
    protected rowColumnCount(rowIndex: number): number {
        return Math.max(1, this.content[rowIndex]?.getNodeChildren().length ?? 0);
    }

    /**
     * `canStepPast` for a row list: a held key runs on along a row that wraps its columns (`colsWrap`) or
     * has a further item, and across rows when they wrap (`rowsWrap`) or there is a further row.
     */
    protected rowListCanStepPast(
        target: { row: number; col: number },
        colsWrap: (row: number) => boolean,
        rowsWrap: boolean
    ): boolean {
        const rows = this.motionRows();
        const row = positiveMod(Math.round(target.row), rows);
        if (this.navAxis === "col") {
            if (colsWrap(row)) {
                return true;
            }
            const col = target.col + this.navDirection;
            return col >= 0 && col < this.rowColumnCount(row);
        }
        if (rowsWrap) {
            return true;
        }
        const next = row + this.navDirection;
        return next >= 0 && next < rows;
    }

    /** Weight of row `rowIndex` in the vertical motion: the row being left `1 - f`, the next one `f`. */
    protected motionRowWeight(rowIndex: number): number {
        if (!this.motion) {
            return this.focusIndex === rowIndex ? 1 : 0;
        }
        const rows = this.motionRows();
        const pos = positiveMod(this.motionPos, rows);
        const row0 = Math.floor(pos);
        const fraction = pos - row0;
        if (rowIndex === row0) {
            return 1 - fraction;
        }
        return fraction > 0 && rowIndex === (row0 + 1) % rows ? fraction : 0;
    }

    /**
     * Row lists: the row the motion's step in flight is on (its row segment's target), `focusIndex` at
     * rest. A press queued behind the step moves `focusIndex` at once, so code that draws or publishes the
     * motion reads this instead: the new row must not take the old row's in-transit column, nor its place.
     */
    protected stepRow(): number {
        const motion = this.motion;
        if (!motion) {
            return this.focusIndex;
        }
        const rows = this.motionRows();
        const row = Math.round(motion.row.to);
        return positiveMod(row, rows);
    }

    /** Row lists: the row sliding along its items while the column segment is in flight, -1 otherwise. */
    protected slidingRow(): number {
        const motion = this.motion;
        return motion?.colMoved && this.motionCol !== motion.col.to ? this.stepRow() : -1;
    }

    /**
     * Row lists: the column the in-transit indicator points at on `rowIndex`. The moving column while that
     * row slides, and on a row that doesn't wrap (a row change keeps the indicator's column slot); a
     * wrapping row at rest holds its focus at the fixed slot, `focusedCol`.
     */
    protected motionIndicatorCol(rowIndex: number, focusedCol: number, wraps: boolean): number {
        const slides = rowIndex === this.slidingRow() || (this.motion?.colMoved === true && !wraps);
        return slides ? this.motionCol : focusedCol;
    }

    /**
     * In-transit `focusPercent` of [row, col] in a row list: the row's weight times the column's weight
     * within the moving row (`focusedCol` is the column a non-moving row holds).
     */
    protected motionCellPercentIn(rowIndex: number, colIndex: number, focusedCol: number, numCols: number): number {
        const rowWeight = this.motionRowWeight(rowIndex);
        if (rowWeight === 0) {
            return 0;
        }
        if (rowIndex !== this.slidingRow()) {
            return colIndex === focusedCol ? this.publishedPercent(rowWeight) : 0;
        }
        const pos = positiveMod(this.motionCol, numCols);
        const col0 = Math.floor(pos);
        const fraction = pos - col0;
        let colWeight = 0;
        if (colIndex === col0) {
            colWeight = 1 - fraction;
        } else if (fraction > 0 && colIndex === (col0 + 1) % numCols) {
            colWeight = fraction;
        }
        return this.publishedPercent(rowWeight * colWeight);
    }

    /** Starts tracking the cells a row-list motion writes in-transit percents to. */
    protected beginRowMotionTracking(oldRow: number, oldCol: number) {
        this.motionRowSet.clear();
        this.motionCellSet.clear();
        this.motionRowSet.add(oldRow);
        this.motionCellSet.add(`${oldRow},${oldCol}`);
    }

    /** Writes the row percents (`rowFields`) and cells' `focusPercent` for this motion frame. */
    protected emitRowMotionFrame(
        comps: (Group | undefined)[][],
        rowFocus: number[],
        numColsOf: (row: number) => number,
        rowFields: string[]
    ) {
        const rows = this.motionRows();
        const row0 = Math.floor(positiveMod(this.motionPos, rows));
        const touchedRows = new Set([...this.motionRowSet, row0, (row0 + 1) % rows]);
        this.motionRowSet.clear();
        for (const rowIndex of touchedRows) {
            const weight = this.publishedPercent(this.motionRowWeight(rowIndex));
            this.setRowPercent(comps[rowIndex], rowFields, weight);
            if (weight > 0) {
                this.motionRowSet.add(rowIndex);
            }
        }
        const touchedCells = new Set(this.motionCellSet);
        for (const rowIndex of this.motionRowSet) {
            touchedCells.add(`${rowIndex},${rowFocus[rowIndex] ?? 0}`);
            if (rowIndex === this.slidingRow()) {
                const numCols = Math.max(1, numColsOf(rowIndex));
                const col0 = Math.floor(positiveMod(this.motionCol, numCols));
                touchedCells.add(`${rowIndex},${col0}`);
                touchedCells.add(`${rowIndex},${(col0 + 1) % numCols}`);
            }
        }
        this.motionCellSet.clear();
        for (const key of touchedCells) {
            const [rowIndex, colIndex] = key.split(",").map(Number);
            const percent = this.motionCellPercentIn(
                rowIndex,
                colIndex,
                rowFocus[rowIndex] ?? 0,
                Math.max(1, numColsOf(rowIndex))
            );
            comps[rowIndex]?.[colIndex]?.setValue("focusPercent", new Float(percent), false);
            if (percent > 0) {
                this.motionCellSet.add(key);
            }
        }
    }

    /** Lands the row percents and `focusPercent` on [row, col] when a row-list motion settles. */
    protected settleRowMotionPercents(comps: (Group | undefined)[][], row: number, col: number, rowFields: string[]) {
        for (const rowIndex of this.motionRowSet) {
            if (rowIndex !== row) {
                this.setRowPercent(comps[rowIndex], rowFields, 0);
            }
        }
        for (const key of this.motionCellSet) {
            const [rowIndex, colIndex] = key.split(",").map(Number);
            if (rowIndex !== row || colIndex !== col) {
                comps[rowIndex]?.[colIndex]?.setValue("focusPercent", new Float(0), false);
            }
        }
        this.motionRowSet.clear();
        this.motionCellSet.clear();
        this.setRowPercent(comps[row], rowFields, 1);
        comps[row]?.[col]?.setValue("focusPercent", new Float(1), false);
    }

    /** Writes one percent to each of `rowFields` on every item component of a row. */
    private setRowPercent(rowComps: (Group | undefined)[] | undefined, rowFields: string[], percent: number) {
        const value = new Float(percent);
        for (const comp of rowComps ?? []) {
            for (const field of rowFields) {
                comp?.setValue(field, value, false);
            }
        }
    }

    /** Advances the focus motion one frame. */
    tickTransition(now: number): TransitionTick {
        const motion = this.motion;
        if (!motion) {
            return "settled";
        }
        if (this.content.length === 0) {
            this.abortMotion();
            return "settled";
        }
        if (this.heldKey && sgRoot.focused !== this && !this.isChildrenFocused()) {
            // The focus moved away while the key was held: its release goes to another node.
            this.releaseHeldKey();
        }
        if (motion.arrived) {
            // DEVICE-MEASURED: a held key keeps stepping after a pause, and the motion only settles once
            // the key is released (even when the focus has reached the end).
            if (this.heldKey) {
                let tick: TransitionTick = "waiting";
                if (!motion.paused) {
                    motion.paused = true;
                    this.onMotionPaused();
                    tick = "moving";
                }
                if (now - this.heldSince >= this.motionHoldDelayMs() && this.repeatHeldKey()) {
                    tick = "moving";
                }
                // At the end of a non-wrapping list the repeat steps nothing: no frame to redraw.
                return tick;
            }
            this.settleMotion();
            return "settled";
        }
        this.motionPos = this.segmentValue(motion.row, now);
        this.motionCol = this.segmentValue(motion.col, now);
        const rowDone = this.segmentDone(motion.row, now);
        const colDone = this.segmentDone(motion.col, now);
        this.emitMotionFrame();
        // An axis that lands while the other still moves resets its direction now (DEVICE-MEASURED);
        // the last one resets with the settle.
        if (colDone && !rowDone && motion.horizOpen) {
            motion.horizOpen = false;
            super.setValue(this.directionFieldFor("col"), new BrsString("none"));
        } else if (rowDone && !colDone && motion.vertOpen) {
            motion.vertOpen = false;
            super.setValue(this.directionFieldFor("row"), new BrsString("none"));
        }
        if (rowDone && colDone) {
            motion.arrived = true;
            if (motion.queued) {
                const queued = motion.queued;
                motion.queued = undefined;
                this.startMotionSegments(motion, queued, now);
            } else if (this.heldKey && now - this.heldSince >= this.motionHoldDelayMs()) {
                this.repeatHeldKey();
            }
        }
        this.makeDirty();
        return "moving";
    }

    /** Steps once more in the held key's direction; false at the end of a non-wrapping row or column. */
    private repeatHeldKey(): boolean {
        const key = this.heldKey;
        this.holdRepeating = true;
        this.holdRepeats++;
        this.navDirection = key === "up" || key === "left" ? -1 : 1;
        this.navAxis = key === "left" || key === "right" ? "col" : "row";
        try {
            return key === "left" || key === "right" ? this.handleLeftRight(key) : this.handleUpDown(key);
        } finally {
            this.holdRepeating = false;
            this.navDirection = 0;
            this.navAxis = "";
        }
    }

    /** On release, the held key's step in flight eases out to its cell (DEVICE-MEASURED). */
    private releaseHeldKey() {
        this.clearHeldKey();
        const motion = this.motion;
        if (!motion || motion.arrived) {
            return;
        }
        const now = sgClock.perfNow();
        const axes: [MotionAxis, MotionSegment][] = [
            ["row", motion.row],
            ["col", motion.col],
        ];
        for (const [axis, segment] of axes) {
            if (segment.curve === "out" || this.segmentDone(segment, now)) {
                continue;
            }
            const from = this.segmentValue(segment, now);
            segment.from = from;
            segment.start = now;
            segment.duration = Math.abs(segment.to - from) * this.motionStepMs(axis);
            segment.curve = "out";
        }
    }

    /**
     * Lands the focus. DEVICE-MEASURED order: the new item's `itemHasFocus`, `itemFocused`, then
     * `scrollingStatus` false and the direction fields back to "none" — the same order the instant path
     * uses (see `armScrollPulse`).
     */
    protected settleMotion() {
        const motion = this.dropMotion();
        if (!motion) {
            return;
        }
        const followUps: (() => void)[] = [];
        this.settleFollowUps = followUps;
        try {
            this.publishMotionSettle(motion);
        } finally {
            this.settleFollowUps = undefined;
        }
        this.makeDirty();
        for (const followUp of followUps) {
            followUp();
        }
    }

    /**
     * Publishes the settle (DEVICE-MEASURED order): the new item's `itemHasFocus`, `itemFocused`, then
     * `scrollingStatus` false and the direction fields back to "none".
     */
    protected publishMotionSettle(motion: FocusMotion) {
        const numCols = this.motionColumns();
        this.motionPos = Math.floor(this.focusIndex / numCols);
        this.motionCol = this.focusIndex % numCols;
        const nodeFocus = sgRoot.focused === this;
        const inFocusChain = nodeFocus || this.isChildrenFocused();
        for (const item of this.motionPercentItems) {
            if (item !== this.focusIndex) {
                this.updateItemFocus(item, false, nodeFocus);
            }
        }
        this.motionPercentItems.clear();
        super.setValue("currFocusRow", new Float(this.motionPos));
        super.setValue("currFocusColumn", new Float(this.motionCol));
        this.updateItemFocus(this.focusIndex, true, nodeFocus);
        if (inFocusChain) {
            super.setValue("itemFocused", new Int32(motion.contentIndex));
        } else {
            // The field keeps the item the motion left until the focus comes back (DEVICE-MEASURED).
            this.unfocusedSettleIndex = motion.contentIndex;
        }
        if (this.itemFocusCallback) {
            this.itemFocusCallback(motion.contentIndex);
        }
        super.setValue("scrollingStatus", BrsBoolean.False);
        this.closeMotionDirections(motion);
    }

    protected closeMotionDirections(motion: FocusMotion) {
        if (motion.horizOpen) {
            super.setValue(this.directionFieldFor("col"), new BrsString("none"));
        }
        if (motion.vertOpen) {
            super.setValue(this.directionFieldFor("row"), new BrsString("none"));
        }
    }

    /** Forgets the held navigation key and its repeat count. */
    private clearHeldKey() {
        this.heldKey = "";
        this.holdRepeats = 0;
    }

    /**
     * Ends the motion in flight without publishing anything: clears it, the held key and its transition.
     * @returns The motion that was running, for the caller to settle or abort; undefined when there was none.
     */
    private dropMotion(): FocusMotion | undefined {
        const motion = this.motion;
        if (motion) {
            this.motion = undefined;
            this.clearHeldKey();
            sgRoot.removeTransition(this);
        }
        return motion;
    }

    /** Drops a motion whose content went away, without publishing a settle. */
    private abortMotion() {
        const motion = this.dropMotion();
        if (!motion) {
            return;
        }
        this.motionPercentItems.clear();
        super.setValue("scrollingStatus", BrsBoolean.False);
        this.closeMotionDirections(motion);
    }

    /**
     * Where a list or grid draws while its focus moves, relative to the settled layout `renderContent`
     * just computed (`currRow` for the target): every row is drawn `shift` rows further down than its
     * settled row, and the focus indicator sits at viewport row `focusSlot` and (absolute) column
     * `focusCol`. Fixed-focus styles keep the indicator's row still and scroll the rows; floating focus
     * glides the indicator and scrolls only when the focus would leave the window. Paint-time only:
     * bounding rects keep the settled layout, as a device reports them.
     */
    protected listMotionFrame(
        displayRows: number
    ): { shift: number; focusSlot: number; focusCol: number; visualIndex: number } | undefined {
        const motion = this.motion;
        if (!motion || this.content.length === 0) {
            return undefined;
        }
        const numCols = this.motionColumns();
        const rows = this.motionRows();
        const target = motion.queued?.row ?? motion.row.to;
        const targetTop = target - this.currRow;
        const visualTop = this.isFixedFocusMode()
            ? this.motionPos - this.currRow
            : this.floatingVisualTop(motion, displayRows);
        const nearestRow = positiveMod(Math.round(this.motionPos), rows);
        const nearestCol = Math.min(Math.max(Math.round(this.motionCol), 0), numCols - 1);
        const visualIndex = Math.min(nearestRow * numCols + nearestCol, this.content.length - 1);
        return {
            shift: targetTop - visualTop,
            focusSlot: this.motionPos - visualTop,
            focusCol: this.motionCol,
            visualIndex,
        };
    }

    /** First data index of the row drawn at viewport row `r` (which may be outside the window while scrolling), or -1. */
    protected motionRowIndex(r: number): number {
        if (this.isFixedFocusMode()) {
            return this.getRenderRowIndex(r);
        }
        const numCols = this.motionColumns();
        const row = Math.floor(this.focusIndex / numCols) - this.currRow + r;
        return row >= 0 && row < this.motionRows() ? row * numCols : -1;
    }

    /**
     * Whether the focus indicator is drawn over the items, at rest and while moving (DEVICE-MEASURED,
     * `focus-opaque-layer-probe`). A written `drawFocusFeedbackOnTop` (XML attribute or BrightScript) is
     * honored as is. Left unwritten, the field reads false, but a grid or row list still draws the
     * indicator over its items, while a list (`focusOnTopByDefault` false) draws it under.
     */
    protected focusFeedbackOnTop(): boolean {
        if (this.focusOnTopWritten) {
            return this.getValueJS("drawFocusFeedbackOnTop") === true;
        }
        return this.focusOnTopByDefault();
    }

    /** A clone keeps whether `drawFocusFeedbackOnTop` was written, which the copied field alone can't tell. */
    protected cloneNode(
        isDeepCopy: boolean,
        interpreter?: Interpreter,
        visitedNodes?: WeakMap<RoSGNode, RoSGNode>
    ): BrsType {
        const cloned = super.cloneNode(isDeepCopy, interpreter, visitedNodes);
        if (cloned instanceof ArrayGrid) {
            cloned.focusOnTopWritten = this.focusOnTopWritten;
        }
        return cloned;
    }

    /** Where the indicator goes while `drawFocusFeedbackOnTop` was never written: over the items on a grid. */
    protected focusOnTopByDefault(): boolean {
        return true;
    }

    /**
     * Draws the focus indicator at its in-transit rect (per-item focus frames are suppressed while moving).
     * Callers draw it before their items, or after them when `focusFeedbackOnTop()`.
     */
    protected renderMotionFocus(focusRect: Rect, index: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.getValueJS("drawFocusFeedback")) {
            return;
        }
        this.renderFocus(focusRect, opacity, sgRoot.focused === this, draw2D, index);
    }

    /**
     * The in-transit indicator rect of a grid: at viewport y `slotY`, interpolated between the columns
     * either side of `focusCol` (absolute column), laid out from `firstCol` with each column's width and
     * the gap after it.
     */
    protected gridMotionFocusRect(
        rect: Rect,
        slotY: number,
        height: number,
        focusCol: number,
        firstCol: number,
        widthOf: (col: number) => number,
        gapAfter: (col: number) => number
    ): Rect {
        const xOf = (col: number) => {
            let x = rect.x;
            for (let c = firstCol; c < col; c++) {
                x += widthOf(c) + gapAfter(c);
            }
            return x;
        };
        const col0 = Math.floor(focusCol);
        const fraction = focusCol - col0;
        const x0 = xOf(col0);
        const width0 = widthOf(col0);
        if (fraction === 0) {
            return { x: x0, y: slotY, width: width0, height };
        }
        const x1 = xOf(col0 + 1);
        const width1 = widthOf(col0 + 1);
        return { x: x0 + (x1 - x0) * fraction, y: slotY, width: width0 + (width1 - width0) * fraction, height };
    }

    /**
     * A list's or grid's rows and indicator while its focus moves, in pixels from the viewport top
     * (DEVICE-MEASURED, `markupgrid-focus-resize-probe`). Each row keeps its own height and spacing: `spanOf(r)` is the
     * height plus the gap after the row drawn at viewport row `r` of the settled layout, `heightOf(r)`
     * its height alone. A fraction of a row scrolls that fraction of the row's span, and the indicator
     * takes the same fraction between the rects of the two rows it is between, so it grows or shrinks to
     * the size of the item it goes to. Returns the rows to draw (`firstRow` at `firstY`, up to but not
     * including `lastRow`), the indicator's y and height, and the settled window's height.
     */
    protected motionRowLayout(
        frame: { shift: number; focusSlot: number },
        displayRows: number,
        spanOf: (r: number) => number,
        heightOf: (r: number) => number
    ) {
        const spans = new Map<number, number>();
        const span = (r: number) => {
            let value = spans.get(r);
            if (value === undefined) {
                value = Math.max(0, spanOf(r));
                spans.set(r, value);
            }
            return value;
        };
        const offset = (pos: number) => {
            const whole = Math.floor(pos);
            let y = (pos - whole) * span(whole);
            for (let r = 0; r < whole; r++) {
                y += span(r);
            }
            for (let r = whole; r < 0; r++) {
                y -= span(r);
            }
            return y;
        };
        const last = Math.max(0, displayRows - 1);
        const viewportHeight = offset(last) + heightOf(last);
        const top = offset(-frame.shift);
        const firstRow = Math.floor(Math.min(0, -frame.shift));
        const firstY = offset(firstRow) - top;
        let lastRow = firstRow;
        const maxRow = firstRow + this.motionRows() + displayRows + 2;
        for (let y = firstY; y < viewportHeight && lastRow < maxRow; lastRow++) {
            y += span(lastRow);
        }
        const slot = frame.focusSlot - frame.shift;
        const whole = Math.floor(slot);
        const fraction = slot - whole;
        let focusHeight = heightOf(whole);
        if (fraction > 0) {
            focusHeight += (heightOf(whole + 1) - focusHeight) * fraction;
        }
        return { firstRow, lastRow, firstY, focusY: offset(slot) - top, focusHeight, viewportHeight };
    }

    /**
     * The space the wrap or section divider drawn above motion slot `r` takes, 0 when there is none, so a
     * node's `spanOf(r - 1)` can include it and `motionRowLayout` places the rows below it where they are
     * drawn. A wrapping list draws a wrap divider where the content wraps and, with sections, one ahead of
     * each section's first row; `gap` is the spacing the node adds after it.
     */
    protected motionDividerSpace(r: number, gap: number): number {
        if (!this.wrap) {
            return 0;
        }
        const index = this.motionRowIndex(r);
        const previous = this.motionRowIndex(r - 1);
        if (index < 0 || previous < 0 || index >= this.content.length) {
            return 0;
        }
        if (this.metadata.length === 0) {
            return index < previous ? (this.getValueJS("wrapDividerHeight") as number) + gap : 0;
        }
        return this.metadata[index]?.divider ? (this.getValueJS("sectionDividerHeight") as number) + gap : 0;
    }

    /** A list's in-transit indicator rect: the list's width, at the y and height `motionRowLayout` gave. */
    protected listMotionFocusRect(rect: Rect, rows: { focusY: number; focusHeight: number }, width: number): Rect {
        return { x: rect.x, y: rect.y + rows.focusY, width, height: rows.focusHeight };
    }

    /** Clips scrolling rows to the viewport (horizontally unbounded). */
    protected pushMotionClip(rect: Rect, viewportHeight: number, draw2D?: IfDraw2D) {
        draw2D?.pushClip({ x: rect.x - 100000, y: rect.y, width: 200000, height: viewportHeight });
    }

    protected findContentIndex(index: number) {
        if (index < 0 || index >= this.content.length) {
            return -1;
        } else if (this.metadata.length > 0) {
            return this.metadata.findIndex((item) => item.index === index);
        }
        return index;
    }

    /**
     * Resolves an ifSGNodeBoundingRect sub part identifier to the matching item component:
     * `itemX` (data-model index X), `itemX_Y` (row X — list nodes hold one component per row),
     * `focusItem` and `focusIndicator` (the focused item; the indicator hugs the item rect).
     * Item components are created lazily during rendering, so an off-screen item resolves to
     * undefined and the caller falls back to the node's own bounding rect (matching Roku's
     * "if the subpart does not exist" behavior).
     */
    protected needsSubBoundingRectRefresh(): boolean {
        return this.focusLayoutDirty;
    }

    protected resolveSubpart(itemNumber: string): Node | undefined {
        const name = itemNumber.trim().toLowerCase();
        let compIndex = -1;
        if (name === "focusitem" || name === "focusindicator") {
            compIndex = this.focusIndex;
        } else if (name.startsWith("item")) {
            const contentIndex = Number.parseInt(name.slice(4), 10);
            if (Number.isInteger(contentIndex)) {
                compIndex = this.findContentIndex(contentIndex);
            }
        }
        return compIndex >= 0 ? this.itemComps[compIndex] : undefined;
    }

    protected updateItemFocus(index: number, focus: boolean, nodeFocus: boolean) {
        const itemComp = this.itemComps[index];
        if (!itemComp) return;
        // Per the reference, an item only "has focus" when it is the focused cell AND the grid itself
        // has focus; a defocused grid must report itemHasFocus=false for every item (see RowList).
        // While the focus is in motion no item "has" it (DEVICE-MEASURED): itemHasFocus drops when the
        // motion starts and returns on the new item when it settles, and focusPercent follows the motion.
        const moving = this.motion !== undefined;
        const held = moving && !this.motion?.regained;
        itemComp.setValue("itemHasFocus", BrsBoolean.from(focus && nodeFocus && !held), false);
        itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus), false);
        let percent = focus ? 1 : 0;
        if (moving) {
            percent = this.motionFocusPercent(index);
        }
        itemComp.setValue("focusPercent", new Float(percent), false);
    }

    /**
     * Arms a `scrollingStatus` pulse for a navigation key, without emitting anything yet.
     *
     * `scrollingStatus` reports that the list is scrolling the focus (see zoomrowlist.md — the field
     * is documented under ZoomRowList but exists on every ArrayGrid-derived node on a device, and
     * apps alias it from a plain RowList). It was declared here but never emitted, so an observer on
     * it never fired.
     *
     * DEVICE-MEASURED order of a move (RowList OS 15.3, `list-refocus-settle-probe`; LabelList and
     * MarkupList OS 16.0, `list-focus-motion-probe`): `scrollingStatus` true, `itemUnfocused`, the
     * in-transit `currFocusRow` values, then `currFocusRow`, `itemFocused`, `scrollingStatus` false and
     * finally `rowItemFocused`. Apps rely on the tail: the falling edge is where they tear transient
     * scroll state down (hiding a shared overlay/preview player that belongs to the outgoing item),
     * and the `rowItemFocused` settle is what rebuilds it at the new position. When the move is
     * instant both edges land in one frame and that ORDER is the whole contract — `openScrollPulse`
     * goes out first and `closeScrollPulse` right after `itemFocused`.
     *
     * Hence "armed" rather than "open": the pulse is only *emitted* by the focus-settle paths. A key
     * that scrolls nothing — a boundary press on a non-wrapping list, or any key while the grid is
     * outside the focus chain (both of which publish no focus fields at all) — must emit NOTHING,
     * exactly as a device does. Pulsing there would hand an app a teardown edge with no settle behind
     * it to rebuild from.
     */
    protected armScrollPulse() {
        this.scrollPulseArmed = true;
    }

    /**
     * Rising edge of a key-driven scroll: emitted once per press, ahead of the first focus field the
     * move publishes (`itemUnfocused`). A no-op unless `armScrollPulse` armed it, so a key that moves
     * nothing emits nothing.
     */
    protected openScrollPulse() {
        if (!this.scrollPulseArmed) {
            return;
        }
        this.scrollPulseArmed = false;
        this.scrollPulseActive = true;
        super.setValue("scrollingStatus", BrsBoolean.True);
    }

    /**
     * Falling edge: DEVICE-MEASURED after `itemFocused` and before `rowItemFocused` (RowList, OS 15.3,
     * `list-refocus-settle-probe`; LabelList/MarkupList, OS 16.0, `list-focus-motion-probe`). Idempotent.
     */
    protected closeScrollPulse() {
        if (!this.scrollPulseActive) {
            return;
        }
        this.scrollPulseActive = false;
        super.setValue("scrollingStatus", BrsBoolean.False);
    }

    /**
     * Both edges back to back, ahead of the settle. Used by TimeGrid, whose channel/program settle order
     * has not been measured on a device yet, and by ZoomRowList's instant move along a row.
     */
    protected emitScrollPulse() {
        this.openScrollPulse();
        this.closeScrollPulse();
    }

    /**
     * Disarms at the end of a key press, and closes the pulse if an exception unwound between the
     * two edges — the field must never be left stranded at `true`, which would suppress every later
     * notification (it is not `alwaysNotify`, so a same-value write is silent).
     */
    protected endScrollPulse() {
        this.scrollPulseArmed = false;
        if (!this.scrollPulseActive) {
            return;
        }
        this.scrollPulseActive = false;
        super.setValue("scrollingStatus", BrsBoolean.False);
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && key === this.heldKey) {
            this.releaseHeldKey();
        }
        if (press && this.motionQueueFull() && ["up", "down", "left", "right", "rewind", "fastforward"].includes(key)) {
            // A device takes one press ahead of the motion in flight; further ones are dropped.
            this.lastPressHandled = key;
            return true;
        }
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "OK") {
            if (press) {
                this.landMotionForSelect();
            }
            handled = this.handleOK(press);
        } else if (press && ["up", "down", "left", "right", "rewind", "fastforward"].includes(key)) {
            try {
                // Arm inside the try so an exception from either edge's observers still unwinds
                // through the finally below and cannot strand the field at true.
                this.armScrollPulse();
                this.navDirection = key === "up" || key === "left" || key === "rewind" ? -1 : 1;
                this.navAxis = key === "left" || key === "right" ? "col" : "row";
                if (key === "up" || key === "down") {
                    handled = this.handleUpDown(key);
                } else if (key === "left" || key === "right") {
                    handled = this.handleLeftRight(key);
                } else {
                    handled = this.handlePageUpDown(key);
                }
            } finally {
                this.navDirection = 0;
                this.navAxis = "";
                // Disarm: a key that scrolled nothing emits no pulse at all (see armScrollPulse).
                this.endScrollPulse();
            }
            if (handled && this.motion && ["up", "down", "left", "right"].includes(key)) {
                this.heldKey = key;
                this.heldSince = sgClock.perfNow();
                this.holdRepeats = 0;
            }
        }
        this.lastPressHandled = handled && key !== "OK" ? key : "";
        return handled;
    }

    /**
     * Hook invoked by setFocusedItem after the focus cursor moves, so grid types that keep a
     * horizontal column-scroll window (MarkupGrid) can update it for every focus path — key
     * navigation, jumpToItem/animateToItem, and focus-gain. No-op for other node types.
     */
    protected updateHorizScroll(_index: number) {
        // Overridden by MarkupGrid to maintain its horizontal column-scroll window.
    }

    protected handleUpDown(_key: string) {
        return false;
    }

    protected handleLeftRight(_key: string) {
        return false;
    }

    protected handlePageUpDown(_key: string) {
        return false;
    }

    /**
     * OK pressed while the focus moves lands the motion first (DEVICE-MEASURED, grid-ok-midmotion-probe):
     * the settle publishes `itemFocused` and `scrollingStatus` false at once, then `itemFocused` goes out
     * again ahead of `itemSelected`, so an app reading its focused item on `itemFocused` selects the item
     * the motion was heading to. At rest, OK publishes only `itemSelected`.
     */
    private landMotionForSelect() {
        const motion = this.motion;
        if (!motion) {
            return;
        }
        this.settleMotion();
        if (this.listFocusModel() && sgRoot.focused === this) {
            super.setValue("itemFocused", new Int32(motion.contentIndex));
        }
    }

    protected handleOK(press: boolean) {
        if (press) {
            const index = this.metadata[this.focusIndex]?.index ?? this.focusIndex;
            this.setValue("itemSelected", new Int32(index));
        }
        return false;
    }

    protected getContentItem(index: number): ContentNode {
        if (this.content[index] instanceof ContentNode) {
            return this.content[index];
        }
        return new ContentNode();
    }

    /**
     * Children of a content row/section, tolerating a missing node. Callers index into `this.content`
     * (`this.content[row]`), which is empty while the app has not assigned `content` yet or assigned an
     * empty tree — the focus cursor can still point at row 0, so the lookup yields `undefined`. A real
     * device simply has nothing to navigate there; returning an empty list lets the caller report the
     * key as unhandled (so it bubbles to the parent) instead of throwing.
     */
    protected getContentChildren(content?: ContentNode): ContentNode[] {
        if (!(content instanceof ContentNode)) {
            return [];
        }
        return content.getNodeChildren().map((child) => {
            if (child instanceof ContentNode) {
                return child;
            }
            return new ContentNode();
        });
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            // Layout-pass only, and `isLayoutPass` rather than a bare `!draw2D`: this is not a pure
            // measurement — `measureHiddenExtent` refreshes content as a side effect — so running it for a
            // hidden grid inside a faded-out ancestor would do content work on painted frames, in the very
            // path whose purpose is to suppress work.
            if (this.isLayoutPass(draw2D)) {
                this.measureHiddenExtent(origin, angle);
            }
            return;
        }
        const scale = this.getValueJS("scale") as number[];
        const drawTrans = this.getDrawTranslation(origin, angle, scale);
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], ...size };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const content = this.getValue("content");
        if (content instanceof ContentNode && content.changed) {
            this.refreshContent();
            content.changed = false;
        }
        // The clippingRect bracket lives in the renderNode template, so it wraps this whole body.
        // Items, focus feedback and every other part are laid out in local units from drawTrans, so
        // the grid's own scale applies to all of them as one frame (`contentScale` keeps the draw
        // helpers from applying it again). DEVICE-MEASURED (Roku OS 15.3, probe
        // `test/simulator/probes/group-scale-probe` R4): a LabelList scaled 0.5 at [500,820] draws
        // its 300x50 items at 150x25, 25 apart, and reports boundingRect {482,816,186,102}.
        // The item components are parented to the grid, but updateBoundingRects below replaces
        // every rect they would union into.
        this.rederivesBounds = true;
        this.withScaleFrame(drawTrans, scale, draw2D, () => {
            this.renderContent(interpreter, rect, rotation, opacity, draw2D);
        });
        this.rederivesBounds = false;
        // The grid was just laid out for the current focus/scroll state, so item rects are fresh.
        this.focusLayoutDirty = false;
        this.updateBoundingRects(rect, origin, rotation, scale);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D, scale);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    /** The grid's own scale is applied as a frame around its whole content (`renderNodeContent`). */
    protected contentScale(): number[] {
        return UNIT_SCALE;
    }

    protected renderContent(
        _interpreter: Interpreter,
        _rect: Rect,
        _rotation: number,
        _opacity: number,
        _draw2D?: IfDraw2D
    ) {
        // To be overwritten by derivate classes
    }

    /**
     * Refreshes this grid's bounding rects while it is invisible, for a measurement pass (no draw
     * target). On Roku, layout and bounding rects are independent of visibility — apps size sibling
     * UI (e.g. a background poster) from a hidden grid's boundingRect() before revealing it. The
     * hard skip in renderNode must stay for real draws (a hidden grid must not create item
     * components or load textures), so the extent is derived arithmetically from the content length,
     * itemSize and spacing via updateRect — no item components are instantiated. renderNode still
     * returns before nodeRenderingDone, so the hidden grid does not union into its parent's bounds.
     */
    protected measureHiddenExtent(origin: number[], angle: number) {
        const contentNode = this.getValue("content");
        if (contentNode instanceof ContentNode && contentNode.changed) {
            this.refreshContent();
            contentNode.changed = false;
        }
        const itemSize = this.getValueJS("itemSize") as number[];
        if (this.content.length === 0 || !itemSize?.[0] || !itemSize?.[1] || !this.numRows || !this.numCols) {
            return;
        }
        const drawTrans = this.getDrawTranslation(origin, angle);
        const rect = { x: drawTrans[0], y: drawTrans[1], ...this.getDimensions() };
        const displayRows = Math.min(Math.ceil(this.content.length / this.numCols), this.numRows);
        this.updateRect(rect, displayRows, itemSize, { firstRow: this.topRow });
        this.updateBoundingRects(rect, origin, angle + this.getRotation());
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
        const nodeFocus = sgRoot.focused === this;
        const focused = index === this.focusIndex;
        if (!this.itemComps[index]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            if (itemComp instanceof Group) {
                this.itemComps[index] = itemComp;
            }
        }
        if (!this.itemComps[index]) {
            // Item component creation failed: skip the slot instead of crashing the render pass.
            return;
        }
        // Re-apply the per-item size every frame. Width/height are otherwise only set at creation
        // time (createItemComponent); a cached item first created before the grid's real item size
        // was applied would stay frozen at the wrong (full-width) size — stretching the item.
        this.itemComps[index].setValue("width", new Float(itemRect.width), false);
        this.itemComps[index].setValue("height", new Float(itemRect.height), false);
        // itemComps[] is keyed by POSITION, not by content identity. A reorder (removeChild/
        // insertChild/appendChild-as-move) only dirties the container ContentNode, never the moved
        // child itself, so content.changed alone misses "this slot now holds a different object".
        // Compare against what the cached item component was last told, too.
        const currentContent = this.itemComps[index].getValue("itemContent");
        if (content.changed || currentContent !== content) {
            this.itemComps[index].setValue("itemContent", content, true);
            content.changed = false;
        }
        this.updateItemFocus(index, focused, nodeFocus);
        // While the focus moves, the indicator is drawn once at its in-transit slot instead.
        const drawFocus = this.getValueJS("drawFocusFeedback") && !this.motion;
        const drawFocusOnTop = this.focusFeedbackOnTop();
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D, index);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        this.renderItemClipped(interpreter, this.itemComps[index], itemOrigin, itemRect, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D, index);
        }
    }

    /**
     * Renders an item component clipped to its cell (`itemRect`, i.e. the grid's `itemSize`), matching
     * Roku: content an item draws beyond its own width/height is not shown. Apps rely on this to collapse
     * item content by shrinking `itemSize` — e.g. a vertical button bar whose label is parked just past the
     * item's right edge so only the icon shows until the bar expands. Clipping only happens on a real draw
     * pass; a measurement pass (no `draw2D`) must stay unclipped so hidden-UI bounding rects still compute.
     * The focus feedback is drawn by the caller outside this clip so its indicator can outset the item.
     */
    protected renderItemClipped(
        interpreter: Interpreter,
        itemComp: Group,
        itemOrigin: number[],
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (draw2D) {
            draw2D.pushClip({ x: itemRect.x, y: itemRect.y, width: itemRect.width, height: itemRect.height });
        }
        try {
            // The item component runs app BrightScript (its init(), field observers); an error
            // escaping from there must not strand the cell clip on the canvas for the rest of the
            // frame, which would silently clip everything drawn after it.
            itemComp.renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
        } finally {
            if (draw2D) {
                draw2D.popClip();
            }
        }
    }

    /**
     * Draws the focus frame (or, when the grid itself is unfocused, the footprint) around an item.
     *
     * TEMPLATE METHOD — override `focusFrameRect`, never this. Everything here is shared contract: the
     * uri and blend field the focus state selects, the validity guard, the `hasNinePatch` write that
     * `rectMargins()` reads, and the draw itself — via `focusFeedbackPoster` (Roku OS 16.0), the Poster
     * node this grid uses to draw its focus indicator, so an app-assigned `effect` on it (rounded/
     * asymmetric corners matching a custom item shape) is honored through `Poster.renderNodeContent`'s
     * own `applyNodeEffect` call.
     */
    protected renderFocus(itemRect: Rect, opacity: number, nodeFocus: boolean, draw2D?: IfDraw2D, index = -1) {
        const bmpUri = nodeFocus ? "focusBitmapUri" : "focusFootprintBitmapUri";
        const blendField = nodeFocus ? "focusBitmapBlendColor" : "focusFootprintBlendColor";
        const bmp = this.getBitmap(bmpUri);
        if (!bmp?.isValid()) {
            return;
        }
        this.hasNinePatch = bmp.ninePatch;
        const frameRect = this.focusFrameRect(itemRect, bmp, index);
        // Dry run (no draw target, so every draw2D call inside is skipped) purely to resolve
        // frameRect's final width/height the same way a real draw would — see the ALIASING note above.
        this.drawImage(bmp, frameRect, 0, opacity);
        // Read the field fresh rather than a cached property — see `setValue`'s `focusfeedbackposter`
        // branch for why.
        const poster = this.getValue("focusFeedbackPoster");
        if (!(poster instanceof Poster)) {
            return;
        }
        this.copyField(poster, "uri", bmpUri);
        this.copyField(poster, "blendColor", blendField);
        poster.setValue("width", new Float(frameRect.width), false);
        poster.setValue("height", new Float(frameRect.height), false);
        poster.renderNode(sgRoot.interpreter ?? noopInterpreter, [frameRect.x, frameRect.y], 0, opacity, draw2D);
    }

    /**
     * The rect the focus frame is DRAWN in, given the item's cell rect and the resolved frame bitmap.
     * Override this to specialize a grid's focus geometry.
     *
     * `index` is the content index of the focused item, or -1 when the caller has none: the
     * `renderItemComponent` call sites know it, `LabelList.renderFocused` and `TimeGrid` do not.
     * `PosterGrid` needs it to find that cell's laid-out poster rect.
     *
     * ALIASING: the non-9-patch branch returns `itemRect` ITSELF, not a copy. `Group.drawImage` writes
     * `rect.width`/`rect.height` for a plain bitmap, and `renderItemComponent` then positions and clips
     * the item against the same object — so the scaled size the draw computes is what the item is laid
     * out against. Pre-existing and load-bearing; an override returning a fresh object severs that link,
     * which is what every override wants, but do it deliberately.
     */
    protected focusFrameRect(itemRect: Rect, bmp: RoBitmap, index: number): Rect {
        if (!bmp.ninePatch) {
            return itemRect;
        }
        const { left, right, top, bottom } = this.focusMargins(bmp);
        return {
            x: itemRect.x - left,
            y: itemRect.y - top,
            width: itemRect.width + left + right,
            height: itemRect.height + top + bottom,
        };
    }

    /**
     * Per-side outset (in pixels) applied to the item rect before drawing the focus 9-patch frame.
     * Grids honor the 9-patch's own content-margin markers so the frame hugs large items, falling
     * back to the grid's marginX/marginY for frames that don't declare content margins. List nodes
     * (short rows) override this to keep the tighter marginX/marginY outset — the 9-patch's 19px
     * margins would otherwise make the frame overflow into the neighbouring rows.
     */
    protected focusMargins(bmp: RoBitmap): { left: number; right: number; top: number; bottom: number } {
        const margins = bmp.ninePatch ? bmp.getPatchSizes()?.margins : undefined;
        return {
            left: margins?.left || this.marginX,
            right: margins?.right || this.marginX,
            top: margins?.top || this.marginY,
            bottom: margins?.bottom || this.marginY,
        };
    }

    protected renderSectionDivider(
        title: string,
        itemRect: Rect,
        opacity: number,
        textLine: number,
        draw2D?: IfDraw2D
    ) {
        const dividerHeight = this.getValueJS("sectionDividerHeight") as number;
        const dividerSpacing = this.getValueJS("sectionDividerSpacing") as number;
        const divRect = { ...itemRect, height: dividerHeight };
        let margin = 0;
        if (title.length !== 0) {
            const font = this.getValue("sectionDividerFont");
            const color = this.getValueJS("sectionDividerTextColor");
            const size = this.drawText(
                title,
                font,
                color,
                opacity,
                divRect,
                "left",
                "center",
                0,
                draw2D,
                "...",
                textLine
            );
            margin = size.width + dividerSpacing;
        }
        const bmp = this.getBitmap("sectionDividerBitmapUri");
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? this.lineHeight : bmp.height;
            const rect = {
                x: divRect.x + margin,
                y: divRect.y + Math.round((dividerHeight - height) / 2),
                width: divRect.width - margin,
                height: height,
            };
            this.drawImage(bmp, rect, 0, opacity, draw2D);
        }
        return dividerHeight;
    }

    protected renderWrapDivider(itemRect: Rect, opacity: number, draw2D?: IfDraw2D) {
        const bmp = this.getBitmap("wrapDividerBitmapUri");
        const dividerHeight = this.getValueJS("wrapDividerHeight") as number;
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? this.lineHeight : bmp.height;
            const topOffset = Math.round((dividerHeight - height) / 2);
            const rect = { ...itemRect, y: itemRect.y + topOffset, height: height };
            this.drawImage(bmp, rect, 0, opacity, draw2D);
        }
        return dividerHeight;
    }

    protected refreshContent() {
        this.content.length = 0;
        this.metadata.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const sections = this.getContentChildren(content);
        let itemIndex = 0;
        for (const section of sections) {
            if (section.getValueJS("ContentType")?.toLowerCase() === "section") {
                itemIndex = this.processSection(section, itemIndex);
            }
        }
        if (this.content.length === 0 && sections.length > 0) {
            this.content.push(...sections);
        }
    }

    protected processSection(section: ContentNode, itemIndex: number) {
        const content = this.getContentChildren(section);
        const numCols = this.numCols || 1;
        if (content.length === 0) {
            return itemIndex;
        }
        for (const [index, _item] of content.entries()) {
            const metadata = { index: itemIndex, divider: false, sectionTitle: "" };
            if (index === 0) {
                metadata.divider = true;
                metadata.sectionTitle = section.getValueJS("title") ?? "";
            }
            this.metadata.push(metadata);
            itemIndex++;
        }
        this.content.push(...content);
        // check if the items count is multiple of numCols, otherwise fill with empty nodes
        const remainder = content.length % numCols;
        if (remainder > 0) {
            const emptyContent = new ContentNode("_placeholder_");
            const emptyMetadata = { index: -1, divider: false, sectionTitle: "" };
            for (let i = 0; i < numCols - remainder; i++) {
                this.content.push(emptyContent);
                this.metadata.push(emptyMetadata);
            }
        }
        return itemIndex;
    }

    protected createItemComponent(interpreter: Interpreter, itemRect: Rect, content: ContentNode) {
        if (content.name === "_placeholder_") {
            return new Group();
        }
        const itemCompName = this.getValueJS("itemComponentName") ?? "";
        const itemComp = itemCompName ? createNode(itemCompName, interpreter, this) : new ArrayGridItem();
        if (itemComp instanceof Group) {
            itemComp.setNodeParent(this);
            itemComp.setValue("width", brsValueOf(itemRect.width), false);
            itemComp.setValue("height", brsValueOf(itemRect.height), false);
            itemComp.setValue("itemContent", content, false);
        }
        return itemComp;
    }

    protected isFixedFocusMode() {
        return (
            this.vertFocusAnimationStyleName === FocusStyle.FixedFocusWrap.toLowerCase() ||
            this.vertFocusAnimationStyleName === FocusStyle.FixedFocus.toLowerCase()
        );
    }

    /**
     * Derives the cached `vertFocusAnimationStyleName` and `wrap` flag from the current
     * `vertFocusAnimationStyle` field, resolving aliases (e.g. `"fixed"` → `fixedFocus`) and falling
     * back to `floatingFocus` for unrecognized values. Called from the constructors so the cached
     * state stays consistent with whatever value XML/initialized fields stored on the node.
     */
    protected applyVertFocusStyle() {
        const style =
            resolveFocusStyle(this.getValueJS("vertFocusAnimationStyle") as string) ?? FocusStyle.FloatingFocus;
        this.vertFocusAnimationStyleName = style.toLowerCase();
        this.wrap = style === FocusStyle.FixedFocusWrap;
    }

    /**
     * Derives the cached `horizFocusAnimationStyleName` from the current `horizFocusAnimationStyle`
     * field, resolving aliases (e.g. `"fixed"` → `fixedFocus`) and falling back to `floatingFocus`
     * for unrecognized values. Called from the constructors so the cached state stays consistent
     * with whatever value XML/initialized fields stored on the node.
     */
    protected applyHorizFocusStyle() {
        const style =
            resolveFocusStyle(this.getValueJS("horizFocusAnimationStyle") as string) ?? FocusStyle.FloatingFocus;
        this.horizFocusAnimationStyleName = style.toLowerCase();
    }

    protected getRenderRowIndex(rowPosition: number) {
        const numCols = Math.max(1, this.numCols || 1);
        if (this.isFixedFocusMode() && !this.wrap) {
            const focusRow = Math.floor(this.focusIndex / numCols);
            const totalRows = Math.max(1, Math.ceil(this.content.length / numCols));
            const desiredRow = focusRow + (rowPosition - this.currRow);
            if (desiredRow < 0 || desiredRow >= totalRows) {
                return -1;
            }
            return desiredRow * numCols;
        }
        return this.getIndex(rowPosition - this.currRow);
    }

    protected updateCurrRow() {
        const numCols = this.numCols || 1;
        const focusRow = this.getValueJS("focusRow") as number;
        const fixedFocus = this.isFixedFocusMode();
        if (!this.wrap && !fixedFocus) {
            const currentFocus = Math.floor(this.focusIndex / numCols);
            const numRows = this.getValueJS("numRows") as number;

            if (currentFocus >= 0 && currentFocus < numRows) {
                return currentFocus;
            }

            const rowStep1 = Math.min(this.currRow, numRows - 1);
            const rowStep2 = Math.max(0, rowStep1);
            const rowStep3 = Math.max(rowStep2, focusRow);
            return Math.min(rowStep3, currentFocus);
        }
        return focusRow;
    }

    protected updateListCurrRow() {
        if (this.wrap || this.isFixedFocusMode()) {
            this.topRow = 0;
            return this.updateCurrRow();
        }

        const numCols = this.numCols || 1;
        if (numCols <= 0) {
            this.topRow = 0;
            return 0;
        }

        const totalRows = Math.ceil(this.content.length / numCols);
        if (totalRows <= 0) {
            this.topRow = 0;
            return 0;
        }

        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        const visibleRows = Math.max(1, Math.min(desiredRows, totalRows));

        let focusRowIndex = Math.floor(this.focusIndex / numCols);
        focusRowIndex = Math.max(0, Math.min(focusRowIndex, totalRows - 1));

        if (focusRowIndex < this.topRow) {
            this.topRow = focusRowIndex;
        } else if (focusRowIndex > this.topRow + (visibleRows - 1)) {
            this.topRow = focusRowIndex - (visibleRows - 1);
        }

        const maxTopRow = Math.max(0, totalRows - visibleRows);
        this.topRow = Math.max(0, Math.min(this.topRow, maxTopRow));

        return Math.max(0, focusRowIndex - this.topRow);
    }

    protected clampTopRow() {
        const numCols = this.numCols || 1;
        if (numCols <= 0) {
            this.topRow = 0;
            return;
        }

        const totalRows = Math.ceil(this.content.length / numCols);
        if (totalRows <= 0) {
            this.topRow = 0;
            return;
        }

        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        const visibleRows = Math.max(1, Math.min(desiredRows, totalRows));
        const maxTopRow = Math.max(0, totalRows - visibleRows);
        this.topRow = Math.max(0, Math.min(this.topRow, maxTopRow));
    }

    /**
     * Per-axis outset the reported bounding rect adds around the item extent when the focus
     * bitmap is a 9-patch. This affects ONLY the rects reported by boundingRect() and friends,
     * never the drawn focus frame (see focusMargins). Node types whose device-reported rect is
     * exactly the laid-out item extent override this to zero (MarkupGrid).
     */
    protected rectMargins(): { x: number; y: number } {
        if (this.hasNinePatch) {
            return { x: this.marginX, y: this.marginY };
        }
        return { x: 0, y: 0 };
    }

    /**
     * Whether this node lays its columns out from `columnWidths`/`columnSpacings`. Per the ArrayGrid
     * reference those fields are "not used by lists", so only grids opt in.
     */
    protected usesColumnWidths(): boolean {
        return false;
    }

    /**
     * Resolves a per-row/per-column override array against its uniform fallback. Per the ArrayGrid
     * reference the arrays are indexed by ABSOLUTE row/column, top to bottom, and any index past the
     * end of the array falls back to the `itemSize`/`itemSpacing` value — it does NOT repeat the last
     * entry (unlike `LayoutGroup.itemSpacings`, which is device-confirmed to repeat).
     */
    protected resolveTrackValue(values: unknown, index: number, fallback: number): number {
        if (!Array.isArray(values)) {
            return fallback;
        }
        const value = values[index];
        return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    }

    /**
     * Sizes the reported bounding rect to the laid-out extent.
     *
     * Inter-item spacing is part of that extent: the render loop advances by `itemSize + itemSpacing`
     * per row/column, so N uniform rows span `N*itemH + (N-1)*spacing`. `boundingRect` reported only
     * `N*itemH` before, omitting the gaps — an app centering a vertical menu via
     * `(screenH - boundingRect().height)/2` then placed it too low by the total gap height.
     *
     * Rows and columns are not necessarily uniform, though: `rowHeights`/`rowSpacings` (and
     * `columnWidths`/`columnSpacings` on grids) override `itemSize`/`itemSpacing` per track, and the
     * render loops honor them. Measuring uniformly made every variable-height list report a rect that
     * disagreed with what it drew.
     *
     * @param layout.firstRow Absolute index of the first RENDERED row — a scrolled list starts its
     *   window at `topRow`, not 0, so the per-row overrides have to be indexed from there.
     * @param layout.width/height An extent the caller already accumulated while laying out, which
     *   wins over the arithmetic below. RowList and PosterGrid need this: their rows grow by amounts
     *   (a label/counter band, a caption zone) that cannot be re-derived here without duplicating the
     *   measurement.
     */
    protected updateRect(
        rect: Rect,
        numRows: number,
        itemSize: number[],
        layout?: { firstRow?: number; width?: number; height?: number }
    ) {
        const numCols = this.numCols || 1;
        const spacing = this.getValueJS("itemSpacing") as number[];
        const colSpacing = Array.isArray(spacing) ? spacing[0] ?? 0 : 0;
        const rowSpacing = Array.isArray(spacing) ? spacing[1] ?? 0 : 0;
        const margin = this.rectMargins();
        rect.x = rect.x - margin.x;
        rect.y = rect.y - margin.y;

        if (typeof layout?.width === "number") {
            rect.width = layout.width;
        } else if (this.usesColumnWidths()) {
            const columnWidths = this.getValueJS("columnWidths");
            const columnSpacings = this.getValueJS("columnSpacings");
            let width = 0;
            for (let c = 0; c < numCols; c++) {
                width += this.resolveTrackValue(columnWidths, c, itemSize[0]) + margin.x * 2;
                if (c < numCols - 1) {
                    width += this.resolveTrackValue(columnSpacings, c, colSpacing);
                }
            }
            rect.width = width;
        } else {
            rect.width = numCols * (itemSize[0] + margin.x * 2) + Math.max(0, numCols - 1) * colSpacing;
        }

        if (typeof layout?.height === "number") {
            rect.height = layout.height;
            return;
        }
        const rowHeights = this.getValueJS("rowHeights");
        const rowSpacings = this.getValueJS("rowSpacings");
        const totalRows = Math.max(1, Math.ceil(this.content.length / numCols));
        const firstRow = layout?.firstRow ?? 0;
        let height = 0;
        for (let r = 0; r < numRows; r++) {
            // A wrapping list renders a contiguous window that can run past the last row and resume
            // at the top, so the override arrays are indexed modulo the row count.
            const absolute = this.wrap ? positiveMod(firstRow + r, totalRows) : firstRow + r;
            height += this.resolveTrackValue(rowHeights, absolute, itemSize[1]) + margin.y * 2;
            if (r < numRows - 1) {
                // Per the reference, rowSpacings[i] is the spacing AFTER row i, so the last rendered
                // row contributes none.
                height += this.resolveTrackValue(rowSpacings, absolute, rowSpacing);
            }
        }
        rect.height = height;
    }

    protected getIndex(offset: number = 0, currIndex?: number) {
        currIndex ??= this.focusIndex;
        const numCols = this.numCols || 1;
        const focusRow = Math.floor(currIndex / numCols);
        const maxRows = Math.ceil(this.content.length / numCols);

        let nextRow = focusRow + offset;

        if (this.wrap) {
            nextRow = (nextRow + maxRows) % maxRows;
        } else if (nextRow >= maxRows) {
            nextRow = maxRows - 1;
        } else if (nextRow < 0) {
            nextRow = 0;
        }
        return nextRow * numCols;
    }

    protected resolveBoolean(values: any, index: number, fallback: boolean) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Boolean(values[index]);
        }
        return Boolean(values.at(-1));
    }

    protected resolveVector(values: any, index: number, fallback: number[]) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (values.length === 2 && typeof values[0] === "number" && typeof values[1] === "number") {
            return [Number(values[0]) || 0, Number(values[1]) || 0];
        }
        const select = index < values.length ? values[index] : values.at(-1);
        if (Array.isArray(select) && select.length >= 2) {
            return [Number(select[0]) || 0, Number(select[1]) || 0];
        }
        return fallback;
    }

    protected resolveNumber(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            const value = Number(values[index]);
            return Number.isFinite(value) && value > 0 ? value : fallback;
        }
        const lastValue = Number(values.at(-1));
        return Number.isFinite(lastValue) && lastValue > 0 ? lastValue : fallback;
    }

    protected resolveColor(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Number(values[index]) || fallback;
        }
        return Number(values.at(-1)) || fallback;
    }
}

export class ArrayGridItem extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "index", type: "int", value: "-1" },
        { name: "rowIndex", type: "int", value: "-1" },
        { name: "rowHasFocus", type: "boolean", value: "false" },
        { name: "rowListHasFocus", type: "boolean", value: "false" },
        { name: "itemContent", type: "node" },
        { name: "itemHasFocus", type: "boolean", value: "false" },
        { name: "focusPercent", type: "float", value: "0.0" },
        { name: "listHasFocus", type: "boolean", value: "false" },
    ];
    private readonly MissingImageUri: string;
    private readonly poster: Poster;

    constructor() {
        super([], SGNodeType.ArrayGridItem);
        this.setExtendsType(SGNodeType.ArrayGridItem, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);

        this.MissingImageUri = `common:/images/${this.resolution}/missingImage.9.png`;
        this.poster = this.addPoster("", [0, 0]);
        this.poster.setValue("failedBitmapUri", new BrsString(this.MissingImageUri));
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind): void {
        const fieldName = index.toLowerCase();
        if (fieldName === "itemcontent" && value instanceof ContentNode) {
            this.poster.setValue("uri", new BrsString(this.getPosterUri(value)));
        } else if (fieldName === "width" || fieldName === "height") {
            this.poster.setValue(index, value, alwaysNotify, kind);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    private getPosterUri(content: ContentNode) {
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
        return "";
    }
}
