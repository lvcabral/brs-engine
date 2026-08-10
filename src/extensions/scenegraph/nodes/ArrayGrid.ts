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
    RoBitmap,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { Poster, SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";
import { Field } from "./Field";
import { createNode } from "../factory/NodeFactory";
import { normalizeBlendColor } from "../SGUtil";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { sgClock } from "../SGClock";
import { ContentNode } from "./ContentNode";
import { Font } from "./Font";

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
    /**
     * An in-flight animated focus scroll started by `animateToItem`.
     *
     * `from` is fractional so a mid-flight retarget continues from the position currently on screen
     * rather than restarting — device-measured (probe A3: an interrupt at 0.52 resumed at 0.658).
     */
    type ScrollAnimation = {
        /** Fractional content index the scroll started from. */
        from: number;
        /** Content index being scrolled to. */
        to: number;
        /** Target index as the app wrote it, for the `itemFocused` payload at completion. */
        toIndex: number;
        /** `sgClock.perfNow()` at the frame the scroll started. */
        start: number;
        /** Total duration in ms, scaled by the distance travelled. */
        duration: number;
        /**
         * Fractional position sampled once per frame by `tickScrollAnimation`, so every reader within
         * that frame agrees. Reading the clock per accessor instead let the anchor's `Math.floor` and
         * the sub-row remainder straddle a row boundary — a one-row layout jump — and violated the
         * clock-free layout-pass contract (`docs/scenegraph-layout-passes.md`), since `renderContent`
         * is reachable from a layout pass.
         */
        position: number;
    };
}

export class ArrayGrid extends Group {
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
        // Documented on ArrayGrid: "Specifies whether changes in the focus item should be animated."
        // Declared for compatibility so an app reading it gets `false` rather than `invalid` (which
        // crashes a strongly-typed BrightScript helper). Deliberately NOT wired to the scroll
        // animation: device-measured (grid-scroll-animation-probe A7) that setting it true does NOT
        // suppress the scroll — the move still ramped over the same ~1s/3 rows. Its wording is about
        // the focus *indicator*'s repositioning/scaling, so treating it as a scroll on/off switch
        // would diverge from hardware.
        { name: "skipFocusAnimations", type: "boolean", value: "false" },
    ];
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    /**
     * The unfocused-item footprint frame. Unlike `focusUri` — which genuinely varies by type
     * (`focus_grid` for grids, `focus_list` for lists) and so stays per-subclass — every ArrayGrid
     * derivative uses this same asset, so it is seeded once here. Subclasses that were each setting it
     * in their own constructor drifted: four of the seven had no footprint at all.
     */
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";
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
    /**
     * The in-flight `animateToItem` scroll, or undefined when settled.
     *
     * Device-measured (`test/simulator/probes/grid-scroll-animation-probe`): `animateToItem` starts a
     * multi-frame eased scroll, ~340 ms per row traversed, publishing fractional `currFocusRow` every
     * frame and the settled focus fields only at completion. `jumpToItem` stays instant.
     */
    protected scrollAnim?: ArrayGrid.ScrollAnimation;
    /**
     * Set while an animated scroll's settle runs, so `setFocusedItem` skips the two emissions the
     * animation already made at its START: the `scrollingStatus` pulse and `itemUnfocused`. Without
     * this the settle would re-emit both, which a device does exactly once per scroll.
     */
    protected settlingScrollAnim: boolean = false;
    /**
     * A completing animated scroll still owes its `scrollingStatus=false`, which the settle path emits
     * at the device's interleave point — after `itemFocused`, before `rowItemFocused`. See
     * `emitPendingScrollFallingEdge`.
     */
    protected pendingScrollFallingEdge: boolean = false;
    /**
     * Set while the grid's own key handling writes `animateToItem` as an internal shortcut, so the
     * write takes the INSTANT path instead of starting an animated scroll.
     *
     * A device animates key navigation too, but that is a much wider behavior change: the key-driven
     * emission order is pinned by `test/extensions/scenegraph/ArrayGridFields.test.js` and several CLI
     * fixtures read focus fields synchronously right after `handleKey`. Animating app-written
     * `animateToItem` is what the reported failure needs; animating key navigation is a separate
     * change that should come with its own regression pass.
     */
    protected keyNavMove: boolean = false;
    protected hasNinePatch: boolean;
    protected focusField: string;
    protected vertFocusAnimationStyleName: string = FocusStyle.FloatingFocus.toLowerCase();
    protected horizFocusAnimationStyleName: string = FocusStyle.FloatingFocus.toLowerCase();
    public itemFocusCallback?: (index: number) => void;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ArrayGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

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
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.applyVertFocusStyle();
        this.applyHorizFocusStyle();
        this.lastPressHandled = "";
        this.hasNinePatch = false;
        this.focusField = "listHasFocus";
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "content" && value instanceof ContentNode) {
            super.setValue(index, value, alwaysNotify, kind);
            this.itemComps.length = 0;
            this.refreshContent();
            this.resetFocusForNewContent(true);
            return;
        } else if (fieldName === "jumptoitem" && isNumberComp(value)) {
            // Documented as an immediate move, and device-measured as one (probe A2: no
            // scrollingStatus, no fractional currFocusRow, every focus field in the same millisecond).
            this.cancelScrollAnimation();
            this.setFocusedItem(jsValueOf(value));
        } else if (fieldName === "animatetoitem" && isNumberComp(value)) {
            // `keyNavMove` marks the grid's OWN move shortcut during key handling. An app observer that
            // fires synchronously from the key-driven settle and writes animateToItem itself must not be
            // caught by it — that write is app-initiated and should animate. Field.invoke already stashes
            // the engine-emission markers for the duration of a callback for the same reason; this asks
            // it whether a callback is executing right now.
            if (this.keyNavMove && !Field.inObserverCallback()) {
                this.setFocusedItem(jsValueOf(value));
            } else {
                this.startScrollAnimation(jsValueOf(value) as number);
            }
        } else if (fieldName === "vertfocusanimationstyle" && isBrsString(value)) {
            const style = resolveFocusStyle(value.toString());
            if (style) {
                this.vertFocusAnimationStyleName = style.toLowerCase();
                this.wrap = style === FocusStyle.FixedFocusWrap;
            } else {
                // Invalid vertFocusAnimationStyle
                return;
            }
        } else if (fieldName === "horizfocusanimationstyle" && isBrsString(value)) {
            const style = resolveFocusStyle(value.toString());
            if (style) {
                this.horizFocusAnimationStyleName = style.toLowerCase();
            } else {
                // Invalid horizFocusAnimationStyle: keep the field's current value (device behavior)
                return;
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
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
        const focus = super.setNodeFocus(focusOn);
        if (focus) {
            let focusIndex = this.getValueJS("itemFocused") as number;
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
                // Device-measured (`test/simulator/probes/list-refocus-settle-probe`, R2/R4/R5): a
                // focus-gain re-publishes the settle and its observers run BETWEEN the probe's
                // `before` and `after` records — i.e. before `setFocus` returns.
                //
                // That timing is load-bearing, not cosmetic: an app that re-grabs focus from the
                // resulting `rowItemFocused` observer (an overlay re-showing itself) must be
                // classified by `Node.isFocusRequestDropped` as a backwards steal and dropped. That
                // rule keys off `Node.focusNotifyOwners`, which is loaded only while the focus
                // transaction is on the stack — so a deferred settle escapes it, the steal wins the
                // live focus, and the app is stranded on the node it was navigating away from.
                //
                // Scoped to exactly that case: inline ONLY when a `focusedChild` notification is
                // dispatching. A plain `setFocus` from app code has no transaction to defend, and
                // forcing its settle inline there re-creates the reentrancy the deferral exists to
                // prevent — an observer that assigns content to several lists and moves focus between
                // the assignments would have a later list's `itemFocused` handler run while an
                // earlier `content` is still `invalid` (deferred-observer-app).
                const syncSettle = Node.inFocusNotification();
                if (syncSettle) {
                    Field.enterSyncFocusSettle();
                }
                try {
                    this.setFocusedItem(focusIndex);
                } finally {
                    if (syncSettle) {
                        Field.exitSyncFocusSettle();
                    }
                }
            }
        }
        return focus;
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
        const focused = sgRoot.focused === this || this.isChildrenFocused();
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
        const nodeFocus = sgRoot.focused === this;
        const inFocusChain = nodeFocus || this.isChildrenFocused();
        if (inFocusChain && !this.settlingScrollAnim) {
            // Emit the scroll pulse BEFORE the settled focus fields go out: on a device
            // scrollingStatus falls while the scroll finishes and the focus settles afterward, and
            // apps depend on that order (the falling edge tears transient scroll state down, the
            // focus settle rebuilds it at the new position). Deliberately outside the internal-update
            // bracket below — these notifications must dispatch synchronously here, not defer past
            // the settle they precede. Skipped when unfocused: that path publishes no focus fields at
            // all, so a pulse would be a teardown with nothing to rebuild from (see armScrollPulse).
            // Also skipped while an animated scroll settles: that pulse opened at animation start and
            // its falling edge is emitted by tickScrollAnimation.
            this.emitScrollPulse();
        }
        // Focus fields are emitted by the grid's internal machinery, not by a direct BrightScript
        // assignment — on Roku their observers dispatch from the message loop, so a reentrant
        // notification defers (see Field.enterInternalUpdate).
        Field.enterInternalUpdate();
        try {
            const focusedIndex = this.getValueJS("itemFocused") as number;
            this.updateItemFocus(this.focusIndex, false, nodeFocus);
            this.focusIndex = newFocus;
            this.focusLayoutDirty = true;
            this.updateHorizScroll(newFocus);
            this.updateItemFocus(this.focusIndex, true, nodeFocus);
            if (inFocusChain) {
                // An animated scroll already emitted itemUnfocused at its start (device-measured), so
                // re-emitting it here would double-report one scroll.
                if (!this.settlingScrollAnim) {
                    super.setValue("itemUnfocused", new Int32(focusedIndex));
                }
                // currFocusRow/currFocusColumn must already reflect the new position before
                // itemFocused fires: apps commonly read them synchronously from an itemFocused
                // observer (see RowList.setFocusedItem for the same ordering requirement).
                const numCols = Math.max(1, this.numCols || 1);
                super.setValue("currFocusRow", new Float(Math.floor(newFocus / numCols)));
                super.setValue("currFocusColumn", new Float(newFocus % numCols));
                super.setValue("itemFocused", new Int32(index));
            } else {
                // Unfocused: remember the target without notifying observers. setNodeFocus emits it on
                // focus-gain (it reads itemFocused, defaulting to 0 when still at the -1 sentinel).
                this.setValueSilent("itemFocused", new Int32(index));
            }
            if (this.itemFocusCallback) {
                this.itemFocusCallback(index);
            }
        } finally {
            Field.exitInternalUpdate();
        }
        // A completing animated scroll closes its pulse HERE, right after itemFocused — the device's
        // interleave point (see emitPendingScrollFallingEdge). Outside the bracket above so it
        // dispatches synchronously rather than deferring past the settle it must sit inside. A grid
        // type settles entirely in this method; RowList overrides the placement so the edge still
        // precedes its own rowItemFocused.
        this.emitPendingScrollFallingEdge();
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
        itemComp.setValue("itemHasFocus", BrsBoolean.from(focus && nodeFocus), false);
        itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus), false);
        itemComp.setValue("focusPercent", new Float(focus ? 1 : 0), false);
    }

    /**
     * Arms a `scrollingStatus` pulse for a navigation key, without emitting anything yet.
     *
     * `scrollingStatus` reports that the list is scrolling the focus (see zoomrowlist.md — the field
     * is documented under ZoomRowList but exists on every ArrayGrid-derived node on a device, and
     * apps alias it from a plain RowList). It was declared here but never emitted, so an observer on
     * it never fired.
     *
     * On a device the scroll spans several frames: the field goes true, the focus fields pass
     * through in-transit values, and it goes false BEFORE the focus finally settles. Apps rely on
     * that interleave — the falling edge is where they tear transient scroll state down (hiding a
     * shared overlay/preview player that belongs to the outgoing item), and the *settle* emission of
     * the focus fields is what rebuilds it at the new position. Our scroll is instant, so both edges
     * land in one frame and the ORDER is the whole contract: the falling edge must precede the focus
     * settle, or the teardown runs last and the app is left with its overlay torn down and nothing
     * to restore it.
     *
     * Hence "armed" rather than "open": the pulse is only *emitted* by `emitScrollPulse`, called
     * from the focus-settle paths. A key that scrolls nothing — a boundary press on a non-wrapping
     * list, or any key while the grid is outside the focus chain (both of which publish no focus
     * fields at all) — must emit NOTHING, exactly as a device does. Pulsing there would hand an app
     * a teardown edge with no settle behind it to rebuild from, which is the same failure as
     * emitting the edges in the wrong order.
     */
    protected armScrollPulse() {
        this.scrollPulseArmed = true;
    }

    /**
     * Emits the rising edge the first time a focus move is about to publish its settled fields, then
     * immediately the falling edge — the pair a device produces around an instant scroll. Called by
     * every settle path right before it emits the focus fields, and idempotent per key press: later
     * calls within the same press (a move that touches several settle paths) do nothing.
     */
    protected emitScrollPulse() {
        if (!this.scrollPulseArmed) {
            return;
        }
        this.scrollPulseArmed = false;
        this.scrollPulseActive = true;
        super.setValue("scrollingStatus", BrsBoolean.True);
        this.scrollPulseActive = false;
        super.setValue("scrollingStatus", BrsBoolean.False);
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

    /**
     * Milliseconds of scroll per row/column traversed.
     *
     * Device-measured on a Roku Streaming Stick+ (OS 15.3), `grid-scroll-animation-probe`: a 1-row
     * move took 364 ms, 2 rows 686 ms, 3 rows 1021 ms — i.e. the duration scales with the distance
     * rather than being fixed, at ~340 ms per row.
     */
    protected static readonly scrollMsPerItem = 340;

    /**
     * Starts (or retargets) the animated focus scroll for `animateToItem`.
     *
     * Emission contract, all device-measured (probe A1):
     * - `scrollingStatus = true` and `itemUnfocused` go out **here**, at animation START, before the
     *   app's assignment even returns — NOT in the settle bracket where the key-navigation path emits
     *   `itemUnfocused`.
     * - `currFocusRow`/`currFocusColumn` then carry fractional in-transit values every frame
     *   (`tickScrollAnimation`).
     * - The settled fields (`itemFocused`, `rowItemFocused`) are emitted only at completion.
     *
     * A write landing while a scroll is already running RETARGETS it, continuing from the fractional
     * position currently on screen — no restart, no second pulse, and nothing emitted for the
     * abandoned target (probe A3).
     *
     * @param index Content index to scroll to, as the app wrote it.
     * @param column Column to settle on, or -1 to reuse the row's remembered column (RowList).
     */
    protected startScrollAnimation(index: number) {
        const target = this.findContentIndex(index);
        if (target === -1) {
            return;
        }
        const retarget = this.scrollAnim;
        // Continue from where the scroll actually is, so a retarget does not visibly jump back.
        const from = retarget ? this.currentScrollPosition(retarget) : this.focusIndex;
        if (!retarget) {
            // Start-of-scroll emissions. An unfocused grid still pulses and still ramps on a device
            // (probe A6) — only the SETTLE fields are focus-gated — so this is deliberately not
            // wrapped in an inFocusChain check. itemUnfocused reports the sentinel when nothing was
            // focused, exactly as the device did (A6 record 248: itemUnfocused = -1).
            // Both dispatch synchronously, matching the device: it emitted scrollingStatus=true and
            // itemUnfocused BEFORE the app's assignment returned (probe A1 records 008-009 precede
            // `after-write` at 010). Deliberately NOT wrapped in enterInternalUpdate, which would
            // defer them past the writing statement.
            super.setValue("scrollingStatus", BrsBoolean.True);
            super.setValue("itemUnfocused", new Int32(this.getValueJS("itemFocused") as number));
        }
        this.scrollAnim = {
            from,
            to: target,
            toIndex: index,
            start: sgClock.perfNow(),
            duration: this.scrollDuration(from, target),
            position: from,
        };
        this.enqueueScrollAnimation();
    }

    /**
     * Duration for a scroll from `from` to `to`, both flat content indices.
     *
     * `scrollMsPerItem` is per ROW traversed (device-measured), so the distance has to be converted out
     * of the flat index space first: on a 6-column grid one row down is a flat delta of 6, and charging
     * 340 ms per flat step made that move take ~2 s instead of ~364 ms. A grid scrolls vertically, so the
     * row delta is what counts; RowList overrides this because its indices ARE rows.
     */
    protected scrollDuration(from: number, to: number): number {
        const numCols = Math.max(1, this.numCols || 1);
        const rows = Math.abs(Math.floor(to / numCols) - Math.floor(from / numCols));
        return Math.max(1, rows) * ArrayGrid.scrollMsPerItem;
    }

    /**
     * Publishes an in-transit fractional scroll position to the focus-position fields.
     *
     * A grid's flat content index maps onto both axes; a list scrolls only along rows and leaves the
     * column alone (device-measured: a RowList's vertical scroll emitted no `currFocusColumn` at all
     * during the ramp), so RowList overrides this.
     * @param position Fractional content index currently on screen.
     */
    protected publishScrollPosition(position: number) {
        const numCols = Math.max(1, this.numCols || 1);
        super.setValue("currFocusRow", new Float(position / numCols));
        // Only ramp the column when the scroll actually crosses columns. Mapping a flat index onto both
        // axes emitted nonsense otherwise: on a single-column list `position % 1` is the ROW fraction, so
        // `currFocusColumn` oscillated 0.14, 0.50, 0.02, … on a field whose only valid value is 0; and on
        // a multi-column grid a purely vertical move swept the column 0 → numCols-1 → 0 while the focused
        // column never changed. A device emits no column ramp for a vertical scroll at all.
        if (this.scrollCrossesColumns()) {
            super.setValue("currFocusColumn", new Float(position % numCols));
        }
    }

    /**
     * Whether the in-flight scroll actually changes the focused column.
     *
     * `from` is fractional (a retarget resumes mid-flight), so the starting column comes from its floor.
     * A vertical-only move keeps the column, and a device emits no column ramp for one.
     */
    private scrollCrossesColumns(): boolean {
        const numCols = Math.max(1, this.numCols || 1);
        if (numCols === 1 || !this.scrollAnim) {
            return false;
        }
        return Math.floor(this.scrollAnim.from) % numCols !== this.scrollAnim.to % numCols;
    }

    /**
     * How far, in rows, an in-flight animated scroll has travelled past the row the render window is
     * anchored to — always in `[0, 1)` after the integer part is folded into the anchor row.
     *
     * This is what makes the scroll VISIBLE rather than merely observable: the render path lays rows out
     * from an integer anchor (`currRow`) plus a per-row Y advance, so without a sub-row offset the
     * fields ramp while the pixels stay put until the settle snaps them. Returns 0 when nothing is
     * animating, so every non-animated path renders exactly as before.
     */
    protected scrollRowOffset(): number {
        const row = this.scrollRowPosition();
        return row === undefined ? 0 : row - Math.floor(row);
    }

    /**
     * The in-flight scroll's position in ROW space, or undefined when nothing is animating.
     *
     * Row space, not flat content index: a grid's index spans columns, so `position` on a 6-column
     * MarkupGrid mid-way through `animateToItem(6)` is 3.4 — an *item* fraction of 0.4, where the true
     * row progress is 3.4/6. Dividing here keeps `scrollRowOffset`/`scrollAnchorRow` meaningful for
     * every subclass rather than only for RowList, whose indices already are rows.
     */
    protected scrollRowPosition(): number | undefined {
        if (!this.scrollAnim) {
            return undefined;
        }
        return this.scrollAnim.position / Math.max(1, this.numCols || 1);
    }

    /**
     * The integer row the render window is anchored to while a scroll is in flight, or undefined when
     * nothing is animating. Together with `scrollRowOffset` this splits the fractional position into
     * "which row is at the top" and "how far past it we are".
     */
    protected scrollAnchorRow(): number | undefined {
        if (!this.scrollAnim) {
            return undefined;
        }
        const row = this.scrollRowPosition();
        return row === undefined ? undefined : Math.floor(row);
    }

    /** The fractional content index an in-flight scroll currently sits at. */
    private currentScrollPosition(anim: ArrayGrid.ScrollAnimation): number {
        const elapsed = sgClock.perfNow() - anim.start;
        if (elapsed >= anim.duration || anim.duration <= 0) {
            return anim.to;
        }
        const eased = ArrayGrid.easeInOut(Math.max(0, elapsed) / anim.duration);
        return anim.from + (anim.to - anim.from) * eased;
    }

    /**
     * Ease-in-out over a normalized 0..1 progress. The device curve accelerates to ~0.13 rows/frame
     * mid-flight and decays to ~0.004 approaching the target; smoothstep reproduces that shape.
     */
    private static easeInOut(t: number): number {
        const clamped = Math.min(1, Math.max(0, t));
        return clamped * clamped * (3 - 2 * clamped);
    }

    /**
     * Advances the in-flight scroll one frame. Called from the render loop via
     * `sgRoot.processScrollAnimations`.
     * @returns True while the scroll is still running (so the frame is marked dirty).
     */
    tickScrollAnimation(): boolean {
        const anim = this.scrollAnim;
        if (!anim) {
            return false;
        }
        const elapsed = sgClock.perfNow() - anim.start;
        // Sample once per frame; every reader this frame (publish below, and the render path's
        // scrollRowOffset/scrollAnchorRow) uses this value rather than re-reading the clock.
        anim.position = this.currentScrollPosition(anim);
        if (elapsed < anim.duration) {
            // In transit: publish the fractional position. currFocusRow/currFocusColumn are floats
            // precisely so they can carry these values (arraygrid.md: currFocusRow "will go directly
            // from 3.0 to 4.0 instead of taking on values between" only when animations are skipped).
            //
            // Deliberately NOT setting focusLayoutDirty here. Its only consumer is
            // needsSubBoundingRectRefresh, which makes a subBoundingRect query run a full-scene layout
            // refresh — doing that per in-transit frame turns one layout pass per scroll into ~60 for
            // any app measuring from a currFocusRow observer, which this ramp is what causes to fire
            // every frame. The tick returns true so the frame repaints anyway, leaving rects at most one
            // frame stale (the staleness Node.getSubBoundingRect already declares acceptable), and the
            // settle still marks it dirty.
            Field.enterInternalUpdate();
            try {
                this.publishScrollPosition(anim.position);
            } finally {
                Field.exitInternalUpdate();
            }
            return true;
        }
        // Completed: hand off to the normal settle path, which applies the focus gate to the settled
        // fields (and stays silent for an unfocused grid, matching probe A6).
        this.scrollAnim = undefined;
        this.dequeueScrollAnimation();
        // The falling edge is INTERLEAVED into the settle, not appended after it: a device emits
        // `itemFocused`, then `scrollingStatus=false`, then `rowItemFocused` last (probe A1 records
        // 067/068/069). `pendingScrollFallingEdge` makes the settle path emit it at that point.
        //
        // This is load-bearing, not cosmetic. An app tears transient scroll state down on the RISING
        // edge and rebuilds it on the FALLING edge, reading the settled focus position there — while
        // treating the `rowItemFocused` observer as the authoritative "focus settled" callback that
        // then re-derives its own state. Emitting the edge AFTER `rowItemFocused` inverts that: the
        // rebuild runs first and the settle handler overwrites it, leaving the overlay hidden until
        // some later navigation re-triggers it.
        this.pendingScrollFallingEdge = true;
        try {
            this.settleScrollAnimation(anim);
        } finally {
            // Backstop: if the settle path never reached the interleave point (an empty/rejected
            // target, or a subclass that settles without emitting), the edge must still close or
            // `scrollingStatus` is stranded at true and silently suppresses every later notification.
            this.emitPendingScrollFallingEdge();
        }
        return true;
    }

    /**
     * Emits the owed `scrollingStatus=false` for a completing animated scroll, if it has not gone out
     * yet. Called from the settle path at the device's interleave point (between `itemFocused` and
     * `rowItemFocused`) and again as a backstop when the settle returns.
     */
    protected emitPendingScrollFallingEdge() {
        if (!this.pendingScrollFallingEdge) {
            return;
        }
        this.pendingScrollFallingEdge = false;
        super.setValue("scrollingStatus", BrsBoolean.False);
    }

    /**
     * Emits the settled focus fields at the end of an animated scroll. Overridden by the list types
     * that settle a [row, column] pair rather than a single index.
     */
    protected settleScrollAnimation(anim: ArrayGrid.ScrollAnimation) {
        this.settlingScrollAnim = true;
        try {
            this.setFocusedItem(anim.toIndex);
        } finally {
            this.settlingScrollAnim = false;
        }
    }

    /**
     * Abandons an in-flight scroll without emitting anything. Used by `jumpToItem` (an immediate move
     * supersedes a running one) and by teardown paths.
     */
    protected cancelScrollAnimation() {
        if (!this.scrollAnim) {
            return;
        }
        this.scrollAnim = undefined;
        this.dequeueScrollAnimation();
        // Drop any owed interleave edge with the animation that owed it, or it leaks into whatever
        // settles next and closes a pulse that settle never opened.
        this.pendingScrollFallingEdge = false;
        // The pulse was opened by startScrollAnimation, so it must be closed or the field is stranded
        // at true — which would silently suppress every later notification (it is not alwaysNotify).
        super.setValue("scrollingStatus", BrsBoolean.False);
    }

    /**
     * A detached grid stops scrolling: keep ticking and it forces a repaint every frame and eventually
     * runs its settle — dispatching focus observers — on a node no longer in the tree.
     */
    removeParent() {
        this.cancelScrollAnimation();
        super.removeParent();
    }

    /** Registers with sgRoot so the render loop ticks this grid's scroll each frame. */
    private enqueueScrollAnimation() {
        if (!sgRoot.scrollAnimations.includes(this)) {
            sgRoot.scrollAnimations.push(this);
        }
    }

    /** Removes this grid from the render loop's scroll list. */
    private dequeueScrollAnimation() {
        const index = sgRoot.scrollAnimations.indexOf(this);
        if (index > -1) {
            sgRoot.scrollAnimations.splice(index, 1);
        }
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "OK") {
            handled = this.handleOK(press);
        } else if (press && ["up", "down", "left", "right", "rewind", "fastforward"].includes(key)) {
            try {
                // Arm inside the try so an exception from either edge's observers still unwinds
                // through the finally below and cannot strand the field at true.
                // A key press supersedes an app-initiated scroll that is still in flight, exactly as
                // jumpToItem does. Without this the abandoned animation kept ticking against the old
                // target and the pulse came out garbled: emitScrollPulse's rising edge was a no-op (the
                // animation had already set scrollingStatus true), its falling edge fired mid-scroll, and
                // the settle's own falling edge then wrote an already-false value and notified nobody —
                // so an app that rebuilds state on the falling edge saw the teardown but never the
                // rebuild. Cancel first, so the pulse below starts from a clean false.
                this.cancelScrollAnimation();
                this.armScrollPulse();
                // Mark this as internal key navigation, so a subclass writing `animateToItem` as its
                // move shortcut settles instantly rather than starting an animated scroll.
                this.keyNavMove = true;
                if (key === "up" || key === "down") {
                    handled = this.handleUpDown(key);
                } else if (key === "left" || key === "right") {
                    handled = this.handleLeftRight(key);
                } else {
                    handled = this.handlePageUpDown(key);
                }
            } finally {
                this.keyNavMove = false;
                // Disarm: a key that scrolled nothing emits no pulse at all (see armScrollPulse).
                this.endScrollPulse();
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
        const drawTrans = this.getDrawTranslation(origin, angle);
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
        this.renderContent(interpreter, rect, rotation, opacity, draw2D);
        // The grid was just laid out for the current focus/scroll state, so item rects are fresh.
        this.focusLayoutDirty = false;
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
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
        const drawFocus = this.getValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getValueJS("drawFocusFeedbackOnTop");
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
     * `rectMargins()` reads, and the `drawImage` call.
     */
    protected renderFocus(itemRect: Rect, opacity: number, nodeFocus: boolean, draw2D?: IfDraw2D, index = -1) {
        const bmpUri = nodeFocus ? "focusBitmapUri" : "focusFootprintBitmapUri";
        const blendField = nodeFocus ? "focusBitmapBlendColor" : "focusFootprintBlendColor";
        const bmp = this.getBitmap(bmpUri);
        if (!bmp?.isValid()) {
            return;
        }
        this.hasNinePatch = bmp.ninePatch;
        const blendColor = normalizeBlendColor(this.getValueJS(blendField));
        this.drawImage(bmp, this.focusFrameRect(itemRect, bmp, index), 0, opacity, draw2D, blendColor);
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
            const font = this.getValue("sectionDividerFont") as Font;
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
            const absolute = this.wrap ? (((firstRow + r) % totalRows) + totalRows) % totalRows : firstRow + r;
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
