import { AAMember, BrsBoolean, BrsString, BrsType, Float, IfDraw2D, Interpreter, jsValueOf, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { GridPanel, Panel, Poster, SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { sgClock } from "../SGClock";
import { easeOutQuint, TransitionTick, UITransition } from "../SGTransition";

/**
 * Horizontal gap between the left and right panels. DEVICE-MEASURED (Roku Express 4K+, OS 16.0,
 * `test/simulator/probes/panelset-slide-probe`): 40 px in HD — the reference's 30 px is not what a
 * device draws. It also separates the panels stacked offscreen to the left.
 */
const PanelGapHD = 40;

/**
 * When each panel starts moving after a slide begins, by its role in the slide (ms). The panel on
 * the leading edge of the motion leaves first, the one changing slots follows, and the one arriving
 * last. DEVICE-MEASURED: fixed offsets — they do not scale with `slideDuration`.
 */
const SlideLeadDelay = 5;
const SlideMiddleDelay = 80;
const SlideTrailDelay = 115;
/** A panel within this distance (px) of its target has settled; `slidingStatus` falls once all have. */
const SlideSettleEpsilon = 0.1;

type PanelTween = { from: number; to: number; start: number };

export class PanelSet extends Group implements UITransition {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "1280" },
        { name: "height", type: "float", value: "605" },
        // DEVICE-MEASURED: seconds (a Double reading 0.5) — the reference's "integer, milliseconds"
        // is wrong; writing 1500 makes a device slide for 25 minutes.
        { name: "slideDuration", type: "float", value: "0.5" },
        { name: "numPanels", type: "integer", value: "0" },
        { name: "isGoingBack", type: "boolean", value: "false" },
        { name: "slidingStatus", type: "boolean", value: "false" },
        { name: "leftPanelIndex", type: "integer", value: "0" },
        { name: "leftArrowBitmapUri", type: "string", value: "" },
        { name: "rightArrowBitmapUri", type: "string", value: "" },
        { name: "arrowHorizOffset", type: "integer", value: "-99999" },
        { name: "arrowVertOffset", type: "integer", value: "-99999" },
        { name: "goBack", type: "boolean", value: "false" },
    ];
    private readonly panels: Panel[] = [];
    /** Panels already gone from `panels` (and `numPanels`) that stay children until they slide off the right. */
    private exiting: Panel[] = [];
    private readonly leftArrow: Poster;
    private readonly rightArrow: Poster;
    private readonly leftArrowUri: string;
    private readonly rightArrowUri: string;
    private focusIndex: number = 0;
    private wasFocused: boolean = false;
    private handleSelect: boolean = true;
    private appendingPreview: boolean = false;
    /** Panels this PanelSet has positioned at least once (their `translation` is a real slot x). */
    private readonly placed = new WeakSet<Panel>();
    /** The x each panel was last laid out toward. */
    private targets = new Map<Panel, number>();
    /** Index of the panel in the left slot for `targets`, to tell a forward slide from a back one. */
    private targetLeftIndex = 0;
    private readonly tweens = new Map<Panel, PanelTween>();
    /** A navigation (append/back/forward/replace) changed the layout; the next reconcile slides to it. */
    private slidePending = false;
    private sliding = false;
    /** A slide in which no panel moves still reports `slidingStatus` for one `slideDuration`. */
    private slideMinEnd = 0;
    public focusedPanelCallback?: (panel: Panel) => void;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PanelSet) {
        super([], name);
        this.setExtendsType(SGNodeType.PanelSet, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.leftArrowUri = `common:/images/${this.resolution}/panelSet_leftArrow.png`;
        this.rightArrowUri = `common:/images/${this.resolution}/panelSet_rightArrow.png`;

        if (this.resolution === "FHD") {
            this.leftArrow = this.addPoster(this.leftArrowUri, [96, 72], 68, 68);
            this.rightArrow = this.addPoster(this.rightArrowUri, [1755, 72], 68, 68);
            this.setValueSilent("translation", new RoArray([new Float(0), new Float(115 * 1.5)]));
            this.setValueSilent("width", new Float(1920));
            this.setValueSilent("height", new Float(605 * 1.5));
        } else {
            this.leftArrow = this.addPoster(this.leftArrowUri, [64, 48], 45, 45);
            this.rightArrow = this.addPoster(this.rightArrowUri, [1170, 48], 45, 45);
            this.setValueSilent("translation", new RoArray([new Float(0), new Float(115)]));
            this.setValueSilent("width", new Float(1280));
            this.setValueSilent("height", new Float(605));
        }
        this.leftArrow.setValueSilent("visible", BrsBoolean.False);
        this.rightArrow.setValueSilent("visible", BrsBoolean.False);
        this.setValueSilent("focusable", BrsBoolean.True);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (["numpanels", "isgoingback", "slidingstatus"].includes(fieldName)) {
            return; // Read-only fields; do not set
        } else if (fieldName === "leftarrowbitmapuri") {
            const uri = value.toString().trim() || this.leftArrowUri;
            this.leftArrow.setValue("uri", new BrsString(uri));
            this.updateArrowPositions();
        } else if (fieldName === "rightarrowbitmapuri") {
            const uri = value.toString().trim() || this.rightArrowUri;
            this.rightArrow.setValue("uri", new BrsString(uri));
            this.updateArrowPositions();
        } else if (fieldName === "arrowhorizoffset" || fieldName === "arrowvertoffset") {
            super.setValue(index, value, alwaysNotify, kind);
            this.updateArrowPositions();
            return;
        } else if (fieldName === "goback") {
            if (jsValueOf(value) === true) {
                this.goBack();
            }
            return;
        } else if (fieldName === "height") {
            super.setValue(index, value, alwaysNotify, kind);
            for (const panel of this.panels) {
                this.adoptPanel(panel);
            }
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    /**
     * Per the Roku spec, the PanelSet sets each attached Panel's `height` field (apps treat
     * it as read-only and often observe it to size panel-local UI). Must be a notifying
     * write so observers registered in the component's init() fire.
     */
    private adoptPanel(panel: Panel) {
        panel.setValue("height", this.getValue("height"));
    }

    private updateArrowPositions() {
        const horizOffset = this.getValueJS("arrowHorizOffset") as number;
        const vertOffset = this.getValueJS("arrowVertOffset") as number;
        // Apply horizontal offset if not default value
        if (horizOffset !== -99999) {
            const leftY = (this.leftArrow.getValueJS("translation") as number[])[1];
            const rightY = (this.rightArrow.getValueJS("translation") as number[])[1];
            this.leftArrow.setValue("translation", new RoArray([new Float(horizOffset), new Float(leftY)]));
            // Right arrow uses mirrored offset from right edge
            const bmpWidth = this.rightArrow.getValueJS("bitmapWidth") as number;
            const rightArrowX = this.sceneRect.width - horizOffset - bmpWidth;
            this.rightArrow.setValue("translation", new RoArray([new Float(rightArrowX), new Float(rightY)]));
        }
        // Apply vertical offset if not default value
        if (vertOffset !== -99999) {
            const leftX = (this.leftArrow.getValueJS("translation") as number[])[0];
            const rightX = (this.rightArrow.getValueJS("translation") as number[])[0];
            this.leftArrow.setValue("translation", new RoArray([new Float(leftX), new Float(vertOffset)]));
            this.rightArrow.setValue("translation", new RoArray([new Float(rightX), new Float(vertOffset)]));
        }
    }

    setNodeFocus(focusOn: boolean): boolean {
        const focus = super.setNodeFocus(focusOn);
        if (focus) {
            this.refreshFocus();
        }
        return focus;
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press) {
            return false;
        }
        this.syncFocusToActual();
        if (key === "left" || key === "back") {
            return this.goBack();
        } else if (key === "right" || (key === "OK" && this.handleSelect)) {
            return this.goForward();
        }
        return false;
    }

    /**
     * Moves focus one panel back. DEVICE-MEASURED field order: `isGoingBack` pulses true→false around
     * the focus move (it is not held for the slide), and when panels leave, `numPanels` drops and
     * `slidingStatus` rises before `leftPanelIndex` and the focus move.
     */
    protected goBack() {
        if (this.focusIndex === 0) {
            return false;
        }
        const currentPanel = this.panels[this.focusIndex];
        this.focusIndex--;
        super.setValue("isGoingBack", BrsBoolean.True);
        let removed = false;
        if (this.panels.length > 2) {
            if (currentPanel === this.panels.at(-1) && currentPanel.getValueJS("isFullScreen") === true) {
                // A displayed full-screen panel occupies both positions: going back slides it fully
                // offscreen (removed), restoring the pair that preceded it. Focus lands on the panel
                // just before it — the right panel of that pair (DEVICE-MEASURED).
                this.panels.pop();
                this.retirePanel(currentPanel);
                removed = true;
            } else {
                // Only panels that slide fully off the right edge are auto-removed (Roku
                // contract). After the slide the visible pair is [focusIndex, focusIndex + 1];
                // going back from the LAST panel removes nothing — it stays as the right panel,
                // reachable again with a right press.
                while (this.panels.length > 2 && this.panels.length - 1 > this.focusIndex + 1) {
                    this.retirePanel(this.panels.pop()!);
                    removed = true;
                }
            }
        }
        if (removed) {
            this.updateNumPanels();
            this.requestSlide();
            if (this.slideAnimated()) {
                this.setSlidingStatus(true);
            }
        }
        this.releasePanelFocus(currentPanel);
        this.focusCurrentPanel();
        this.syncFocusToActual();
        this.applyInstantSlide();
        super.setValue("isGoingBack", BrsBoolean.False);
        return true;
    }

    protected goForward() {
        // Find the next focusable panel to the right, skipping any non-focusable ones. A panel's own
        // `focusable` field is Roku's authoritative signal for whether the PanelSet can move focus
        // into it: an informational detail panel (e.g. an About panel) sets focusable=false and must
        // not receive focus, while a Panel left at its default (focusable=true) is navigable. Skipping
        // non-focusable panels lets focus reach a focusable panel that sits past a non-focusable one.
        let targetIndex = -1;
        for (let i = this.focusIndex + 1; i < this.panels.length; i++) {
            if (this.panels[i].isFocusable()) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex === -1) {
            return false;
        }
        const currentPanel = this.panels.at(this.focusIndex);
        this.focusIndex = targetIndex;
        this.requestSlide();
        if (currentPanel) {
            this.releasePanelFocus(currentPanel);
        }
        this.focusCurrentPanel();
        this.syncFocusToActual();
        this.applyInstantSlide();
        return true;
    }

    appendChildToParent(child: BrsType): boolean {
        const added = super.appendChildToParent(child);
        if (added && child instanceof Panel) {
            // A panel still sliding off (or already listed) is re-appended as a fresh entry at the end,
            // so the settle doesn't remove it and it isn't listed twice.
            const exitIndex = this.exiting.indexOf(child);
            if (exitIndex >= 0) {
                this.exiting.splice(exitIndex, 1);
            }
            const listedIndex = this.panels.indexOf(child);
            if (listedIndex >= 0) {
                this.panels.splice(listedIndex, 1);
            }
            this.panels.push(child);
            this.adoptPanel(child);
            if (child instanceof GridPanel) {
                // Wire the create-next-panel callback at append time so it does not depend on the
                // PanelSet itself receiving focus — apps commonly focus a contained Panel directly.
                this.wireNextPanel(child);
            }
            if (!this.appendingPreview) {
                if (child.getValueJS("isFullScreen") === true) {
                    this.focusIndex = this.panels.length - 1;
                } else {
                    this.focusIndex = Math.max(0, this.panels.length - 2);
                }
            }
            if (child.getValueJS("isFullScreen") === true) {
                // DEVICE-MEASURED: a full-screen panel counts as two panels, notified one at a time.
                super.setValue("numPanels", new Float(this.countPanels() - 1));
            }
            this.updateNumPanels();
            this.requestSlide();
            this.placeNewPanel(child);
            this.refreshFocus();
            this.applyInstantSlide();
        }
        return added;
    }

    /**
     * `replaceChild` on a PanelSet addresses PANELS: DEVICE-MEASURED, `replaceChild(panel, 1)` replaces
     * the second panel even though child index 1 is the PanelSet's internal right-arrow Poster.
     */
    replaceChildAtIndex(newChild: Node, index: number): boolean {
        if (newChild instanceof Panel && index >= 0 && index < this.panels.length) {
            return this.replacePanel(this.panels[index], newChild);
        }
        return super.replaceChildAtIndex(newChild, index);
    }

    /**
     * Swaps a panel in place: the new panel takes the old one's slot — and, mid-slide, its motion —
     * without sliding (DEVICE-MEASURED), and inherits its focus.
     */
    private replacePanel(oldPanel: Panel, newPanel: Panel): boolean {
        const childIndex = this.children.indexOf(oldPanel);
        if (childIndex < 0 || oldPanel === newPanel) {
            return childIndex >= 0;
        }
        const hadFocus = this.isFocusWithin(oldPanel, sgRoot.focused);
        if (!super.replaceChildAtIndex(newPanel, childIndex)) {
            return false;
        }
        const panelIndex = this.panels.indexOf(oldPanel);
        if (panelIndex >= 0) {
            this.panels[panelIndex] = newPanel;
        }
        this.adoptPanel(newPanel);
        if (newPanel instanceof GridPanel) {
            this.wireNextPanel(newPanel);
        }
        this.updateNumPanels();
        this.inheritSlot(oldPanel, newPanel);
        if (hadFocus) {
            newPanel.setNodeFocus(true);
        }
        this.makeDirty();
        return true;
    }

    /** Overrides `renderChildNodes`, not `renderChildren`, so the PanelSet's own scale still applies. */
    protected renderChildNodes(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        this.reconcileLayout(sgClock.perfNow());
        const psWidth = this.getValueJS("width") as number;
        for (const child of this.children) {
            if (!(child instanceof Panel) || (!this.panels.includes(child) && !this.exiting.includes(child))) {
                continue;
            }
            // Panels wholly off either edge (stacked to the left, or waiting/leaving on the right)
            // are skipped; the PanelSet does not clip, so a partly visible panel draws in full.
            const x = (child.getValueJS("translation") as number[])[0];
            const width = child.getValueJS("width") as number;
            if (x + width <= 0 || x >= psWidth) {
                continue;
            }
            child.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        // DEVICE-MEASURED: both arrows hide for the whole slide.
        let showLeftArrow = false;
        let showRightArrow = false;
        if (!this.sliding && this.panels.length > 0) {
            const focusPanel = this.panels[this.focusIndex];
            const leftPanelIndex = this.getValueJS("leftPanelIndex") as number;
            showLeftArrow = leftPanelIndex > 0 && focusPanel?.getValueJS("suppressLeftArrow") !== true;
            const rightPanel = this.panels.at(-1);
            showRightArrow = this.panels.length > 1 && rightPanel?.getValueJS("hasNextPanel") === true;
        }
        if (showLeftArrow) {
            this.leftArrow.setValueSilent("visible", BrsBoolean.True);
            this.leftArrow.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        if (showRightArrow) {
            this.rightArrow.setValueSilent("visible", BrsBoolean.True);
            this.rightArrow.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        this.changed = false;
    }

    /** Advances the slide: per-panel quintic ease-out over `slideDuration`, staggered by role. */
    tickTransition(now: number): TransitionTick {
        const wasSliding = this.sliding;
        this.reconcileLayout(now);
        if (!this.sliding) {
            return "settled";
        }
        const moving = !wasSliding || this.tweens.size > 0;
        const duration = this.slideDurationMs();
        for (const [panel, tween] of this.tweens) {
            if (panel.getNodeParent() !== this) {
                this.tweens.delete(panel);
                continue;
            }
            const u = duration > 0 ? (now - tween.start) / duration : 1;
            let x = tween.from + (tween.to - tween.from) * easeOutQuint(u);
            if (u >= 1 || Math.abs(tween.to - x) < SlideSettleEpsilon) {
                x = tween.to;
                this.tweens.delete(panel);
            }
            this.movePanel(panel, x);
        }
        if (this.tweens.size > 0) {
            return "moving";
        }
        if (now < this.slideMinEnd) {
            // A slide with nothing to move still holds `slidingStatus` for its duration.
            return moving ? "moving" : "waiting";
        }
        this.settleSlide();
        return "settled";
    }

    private wireNextPanel(panel: GridPanel) {
        panel.nextPanelCallback = (nextPanel: Panel) => {
            if (this.panels.length === 1) {
                // Appending a nextPanel preview must not move focus off the menu panel —
                // even a full-screen preview (which takes over only via direct appendChild).
                this.appendingPreview = true;
                try {
                    this.appendChildToParent(nextPanel);
                } finally {
                    this.appendingPreview = false;
                }
                return;
            }
            const trailing = this.panels.at(-1);
            if (trailing) {
                this.replacePanel(trailing, nextPanel);
            }
        };
        panel.clearNextPanelCallback = () => this.clearTrailingPanel(panel);
    }

    private clearTrailingPanel(source: GridPanel) {
        // Only clear when the trailing panel is the detail panel fed by this menu — i.e. the
        // source menu panel is second-to-last. First-ever focus (menu is the only panel) no-ops.
        if (this.panels.length < 2 || this.panels.at(-2) !== source) {
            return;
        }
        const removed = this.panels.pop();
        if (removed) {
            this.forgetPanel(removed);
            this.removeChildByReference(removed);
        }
        this.focusIndex = Math.max(0, this.panels.length - 1);
        this.updateNumPanels();
        this.isDirty = true;
    }

    private refreshFocus() {
        const currentFocus = sgRoot.focused;
        if (this.panels.length && (currentFocus === this || this.isChildrenFocused())) {
            const focusedPanel = this.panels[this.focusIndex];
            const leftIndex = this.leftPanelIndexFor(focusedPanel);
            // Published even when focus stays put: appending a panel behind the focused one moves
            // the pair (DEVICE-MEASURED: leftPanelIndex follows the append).
            super.setValue("leftPanelIndex", new Float(leftIndex));
            if (focusedPanel && currentFocus !== focusedPanel) {
                this.announceFocusedPanel(focusedPanel, leftIndex);
                // Don't steal focus when it already lives inside the focused panel — e.g. the
                // app's focusedChild observer forwarded focus to a list nested in the panel, and
                // that list's itemFocused observer appended the next detail panel (re-entering
                // here). Re-focusing the panel would pull focus off the inner list, and the app's
                // observer cannot repair it mid-dispatch (Field re-entrancy guard).
                if (!this.isFocusWithin(focusedPanel, currentFocus)) {
                    focusedPanel.setNodeFocus(true);
                }
            }
            this.wasFocused = true;
        } else if (this.wasFocused) {
            this.wasFocused = false;
            this.isDirty = true;
        }
    }

    /** Applies the per-panel state that follows the focused panel, and reports it to the Overhang scene. */
    private announceFocusedPanel(focusedPanel: Panel, leftIndex: number) {
        this.handleSelect = focusedPanel.getValueJS("selectButtonMovesPanelForward") === true;
        // Ensure the focused GridPanel's create-next-panel callback is wired (also done at
        // append time). The mechanism is driven by createNextPanelOnItemFocus (checked in
        // GridPanel), not by hasNextPanel — that field only controls the right-arrow
        // indicator / forward navigation to a further panel.
        if (focusedPanel instanceof GridPanel) {
            this.wireNextPanel(focusedPanel);
        }
        if (this.focusedPanelCallback) {
            focusedPanel.setValue("leftOrientation", BrsBoolean.from(leftIndex === this.focusIndex));
            this.focusedPanelCallback(focusedPanel);
        }
    }

    /**
     * Re-points `focusIndex` at the panel that actually holds focus. Apps redirect focus from a panel's
     * `focusedChild` observer — e.g. going back from a full-screen panel lands on the panel before it,
     * whose observer sees `isGoingBack` and focuses the menu panel instead — and navigation, the
     * Overhang title and `leftPanelIndex` must follow where focus ended up, not where the PanelSet put it.
     */
    private syncFocusToActual() {
        const focused = sgRoot.focused;
        const index = this.panels.findIndex((panel) => this.isFocusWithin(panel, focused));
        if (index < 0 || index === this.focusIndex) {
            return;
        }
        this.focusIndex = index;
        const panel = this.panels[index];
        const leftIndex = this.leftPanelIndexFor(panel);
        super.setValue("leftPanelIndex", new Float(leftIndex));
        this.announceFocusedPanel(panel, leftIndex);
    }

    /** Index of the panel in the left slot when `focusedPanel` has focus. */
    private leftPanelIndexFor(focusedPanel: Panel | undefined): number {
        const isFull = focusedPanel?.getValueJS("isFullScreen") === true;
        const isLast = this.focusIndex === this.panels.length - 1;
        return !isFull && isLast && this.focusIndex > 0 ? this.focusIndex - 1 : this.focusIndex;
    }

    /**
     * Takes the focus off a panel the PanelSet navigates away from. When the focus lives below the panel
     * (its own `focusedChild` observer forwarded it, e.g. to a grid), the focused node is released, which
     * unsets the whole chain: unfocusing the panel itself would only cut its link in the middle of the
     * chain, so the next `setFocus` (which unsets only links still pointing along the old path) would skip
     * it, and its observer would never see it leave the focus chain.
     * @param panel The panel losing the focus.
     */
    private releasePanelFocus(panel: Panel) {
        const focused = sgRoot.focused;
        if (focused instanceof Node && focused !== panel && this.isFocusWithin(panel, focused)) {
            focused.setNodeFocus(false);
        } else {
            panel.setNodeFocus(false);
        }
    }

    /**
     * Moves the focus onto the panel at `focusIndex` for a key navigation. The move is a `setFocus(true)`
     * on that panel completing, after any call nested in it (a panel forwarding the focus to its grid), so
     * it becomes `sgRoot.lastFocusTarget`, like a BrightScript call returning. Otherwise the target stays
     * on whatever the app focused last: after a Left back to a menu, a details panel forwarding to its grid
     * again would find that grid as the last target, write only the grid's self-link, and lose the focus.
     */
    private focusCurrentPanel() {
        this.setNodeFocus(true);
        const panel = this.panels[this.focusIndex];
        if (panel) {
            sgRoot.setLastFocusTarget(panel);
        }
    }

    /** Whether `focused` is the panel itself or a node inside the panel's subtree. */
    private isFocusWithin(panel: Panel, focused: unknown): boolean {
        let node: unknown = focused;
        while (node instanceof Node) {
            if (node === panel) {
                return true;
            }
            node = node.getNodeParent();
        }
        return false;
    }

    // ---- Slide layout ----

    private slideDurationMs(): number {
        const seconds = this.getValueJS("slideDuration") as number;
        return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
    }

    /**
     * Whether a slide plays over time. With transitions off — or a non-positive `slideDuration`,
     * which on a device jumps the panels and then never lowers `slidingStatus` — the layout settles
     * synchronously, exactly as before transitions existed.
     */
    private slideAnimated(): boolean {
        return sgRoot.uiTransitionsEnabled && this.slideDurationMs() > 0;
    }

    private panelGap(): number {
        return this.resolution === "HD" ? PanelGapHD : PanelGapHD * 1.5;
    }

    /** `numPanels` weighs a full-screen panel as two (DEVICE-MEASURED). */
    private countPanels(): number {
        let count = 0;
        for (const panel of this.panels) {
            count += panel.getValueJS("isFullScreen") === true ? 2 : 1;
        }
        return count;
    }

    private updateNumPanels() {
        super.setValue("numPanels", new Float(this.countPanels()));
    }

    /**
     * Marks the layout change as a navigation, so the next reconcile slides to it. An animated slide
     * starts from the next render-loop pass (one frame after the navigation, as a device does); with
     * transitions off, `applyInstantSlide` jumps the panels when the navigation returns.
     */
    private requestSlide() {
        this.slidePending = true;
        this.makeDirty();
        if (this.slideAnimated()) {
            sgRoot.addTransition(this);
        }
    }

    /**
     * With transitions off, applies a pending navigation now: the panels jump, `slidingStatus` pulses
     * and the panels that left are removed, inside the call that navigated, rather than from the next
     * paint (mid-frame, and never while the PanelSet isn't drawn).
     */
    private applyInstantSlide() {
        if (this.slidePending && !this.slideAnimated()) {
            this.reconcileLayout(sgClock.perfNow());
        }
    }

    /** Drops a panel from the layout: it slides off the right first when the slide is animated. */
    private retirePanel(panel: Panel) {
        if (this.slideAnimated() && this.placed.has(panel)) {
            this.exiting.push(panel);
        } else {
            this.forgetPanel(panel);
            this.removeChildByReference(panel);
        }
    }

    private forgetPanel(panel: Panel) {
        this.targets.delete(panel);
        this.tweens.delete(panel);
    }

    /**
     * Positions a newly appended panel. DEVICE-MEASURED: when the append makes other panels slide it
     * starts just past the right edge (x = PanelSet width) and slides in with them; when nothing else
     * moves (the second panel joining a lone first one) it is placed straight into its slot.
     */
    private placeNewPanel(panel: Panel) {
        if (!this.slideAnimated() || this.placed.has(panel)) {
            return;
        }
        const layout = this.computeLayout();
        let othersMove = false;
        for (const [other, target] of layout?.targets ?? []) {
            if (
                other !== panel &&
                this.placed.has(other) &&
                Math.abs(this.currentX(other) - target) >= SlideSettleEpsilon
            ) {
                othersMove = true;
                break;
            }
        }
        const startX = othersMove ? (this.getValueJS("width") as number) : layout?.targets.get(panel) ?? 0;
        this.movePanel(panel, startX);
        this.placed.add(panel);
    }

    /** The replacement takes over the replaced panel's position, target and any running motion. */
    private inheritSlot(oldPanel: Panel, newPanel: Panel) {
        if (this.placed.has(oldPanel)) {
            this.movePanel(newPanel, this.currentX(oldPanel));
            this.placed.add(newPanel);
        }
        const target = this.targets.get(oldPanel);
        if (target !== undefined) {
            this.targets.set(newPanel, target);
        }
        const tween = this.tweens.get(oldPanel);
        if (tween) {
            this.tweens.set(newPanel, tween);
        }
        this.forgetPanel(oldPanel);
        const exitIndex = this.exiting.indexOf(oldPanel);
        if (exitIndex >= 0) {
            this.exiting.splice(exitIndex, 1);
        }
    }

    private currentX(panel: Panel): number {
        return (panel.getValueJS("translation") as number[])[0];
    }

    /**
     * Writes a panel's x. A notifying write: a device updates `translation` (and its observers) on
     * every slide frame. A panel heading back on screen clears `isOffscreenLeft` once its right edge
     * reaches x = 0 (DEVICE-MEASURED: immediately for the nearest stacked panel, mid-slide for one
     * further out).
     */
    private movePanel(panel: Panel, x: number) {
        if (this.currentX(panel) !== x) {
            panel.setTranslationX(x);
        }
        if (panel.getValueJS("isOffscreenLeft") !== true) {
            return;
        }
        const width = panel.getValueJS("width") as number;
        const target = this.targets.get(panel);
        if (target !== undefined && target + width > 0 && x + width >= 0) {
            panel.setValue("isOffscreenLeft", BrsBoolean.False);
        }
    }

    /**
     * The settled layout: the left-slot panel at its own `leftPosition`, the right-slot panel at
     * `left.leftPosition + left.width + gap`, a displayed full-screen panel alone at its own
     * `leftPosition`. Earlier panels stack offscreen to the left — the nearest with its right edge at
     * x = 0, each further one a gap beyond — and panels on their way out sit at the right edge.
     */
    private computeLayout(): { targets: Map<Panel, number>; leftIndex: number } | undefined {
        const count = this.panels.length;
        if (count === 0) {
            return undefined;
        }
        const targets = new Map<Panel, number>();
        const last = this.panels[count - 1];
        // A full-screen panel occupies both positions only once it is the displayed (focused)
        // panel; while it is still an unfocused nextPanel preview it sits on the right like any
        // other panel, per the Roku Panel.isFullScreen contract.
        const takesOver =
            count > 1 && last.getValueJS("isFullScreen") === true && this.panels[this.focusIndex] === last;
        const leftIndex = count === 1 || takesOver ? count - 1 : count - 2;
        const leftPanel = this.panels[leftIndex];
        const leftX = leftPanel.getValueJS("leftPosition") as number;
        targets.set(leftPanel, leftX);
        if (leftIndex < count - 1) {
            const width = leftPanel.getValueJS("width") as number;
            targets.set(last, leftX + width + this.panelGap());
        }
        let edge = 0;
        for (let i = leftIndex - 1; i >= 0; i--) {
            const panel = this.panels[i];
            const x = edge - (panel.getValueJS("width") as number);
            targets.set(panel, x);
            edge = x - this.panelGap();
        }
        const psWidth = this.getValueJS("width") as number;
        for (const panel of this.exiting) {
            targets.set(panel, psWidth);
        }
        return { targets, leftIndex };
    }

    /**
     * Brings panel positions in line with the current layout. A navigation change slides (or, with
     * transitions off, jumps and pulses `slidingStatus`); any other change — a panel resized or
     * repositioned by the app — snaps without a slide.
     */
    private reconcileLayout(now: number) {
        const layout = this.computeLayout();
        if (!layout) {
            this.targets.clear();
            if (this.exiting.length > 0 && !this.sliding) {
                this.settleSlide();
            }
            return;
        }
        let changed = false;
        for (const [panel, target] of layout.targets) {
            if (this.targets.get(panel) !== target) {
                changed = true;
                break;
            }
        }
        if (!changed && layout.targets.size === this.targets.size) {
            this.slidePending = false;
            return;
        }
        const navigation = this.slidePending;
        const forward =
            layout.leftIndex > this.targetLeftIndex ||
            (layout.leftIndex === this.targetLeftIndex && this.exiting.length === 0);
        const previous = this.targets;
        this.targets = layout.targets;
        this.targetLeftIndex = layout.leftIndex;
        this.slidePending = false;
        if (!navigation || !this.slideAnimated()) {
            for (const [panel, target] of layout.targets) {
                this.tweens.delete(panel);
                this.movePanel(panel, target);
                this.placed.add(panel);
            }
            if (navigation) {
                this.setSlidingStatus(true);
                this.settleSlide();
            }
            return;
        }
        // Animated: every panel whose target moved restarts from where it is now, delayed by its role.
        for (const [panel, target] of layout.targets) {
            if (!this.placed.has(panel)) {
                this.movePanel(panel, target);
                this.placed.add(panel);
                continue;
            }
            if (previous.get(panel) === target && !this.tweens.has(panel)) {
                continue;
            }
            const from = this.currentX(panel);
            if (Math.abs(from - target) < SlideSettleEpsilon) {
                this.tweens.delete(panel);
                this.movePanel(panel, target);
                continue;
            }
            const delay = this.roleDelay(panel, target, layout, forward);
            this.tweens.set(panel, { from, to: target, start: now + delay });
        }
        this.slideMinEnd = this.tweens.size === 0 ? now + this.slideDurationMs() : now;
        this.setSlidingStatus(true);
        sgRoot.addTransition(this);
    }

    /**
     * DEVICE-MEASURED stagger. Forward: panels ending offscreen left lead, the new left-slot panel
     * follows, the new right-slot panel trails. Back: panels leaving on the right lead, the new
     * right-slot panel follows, the left-slot panel (and those returning from the left) trail.
     */
    private roleDelay(panel: Panel, target: number, layout: { leftIndex: number }, forward: boolean): number {
        const leftPanel = this.panels[layout.leftIndex];
        const width = panel.getValueJS("width") as number;
        if (forward) {
            if (target + width <= 0) {
                return SlideLeadDelay;
            }
            return panel === leftPanel ? SlideMiddleDelay : SlideTrailDelay;
        }
        if (this.exiting.includes(panel)) {
            return SlideLeadDelay;
        }
        const isRight = panel !== leftPanel && target > 0;
        return isRight ? SlideMiddleDelay : SlideTrailDelay;
    }

    private setSlidingStatus(sliding: boolean) {
        this.sliding = sliding;
        super.setValue("slidingStatus", BrsBoolean.from(sliding));
    }

    /**
     * Ends a slide. DEVICE-MEASURED order: `slidingStatus` falls, panels left wholly offscreen to the
     * left get `isOffscreenLeft`, then the panels that slid off the right are removed as children.
     */
    private settleSlide() {
        this.tweens.clear();
        if (this.sliding) {
            this.setSlidingStatus(false);
        }
        for (const panel of this.panels) {
            const x = this.currentX(panel);
            const offscreen = x + (panel.getValueJS("width") as number) <= 0;
            if (offscreen && panel.getValueJS("isOffscreenLeft") !== true) {
                panel.setValue("isOffscreenLeft", BrsBoolean.True);
            }
        }
        const exiting = this.exiting;
        this.exiting = [];
        for (const panel of exiting) {
            this.forgetPanel(panel);
            this.removeChildByReference(panel);
        }
        this.makeDirty();
    }
}
