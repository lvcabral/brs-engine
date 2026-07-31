import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    RoArray,
    IfDraw2D,
    Rect,
    isBrsString,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { Group } from "./Group";
import { Node } from "./Node";

type LayoutDirection = "horiz" | "vert";
type HorizontalAlignment = "left" | "center" | "right" | "custom";
type VerticalAlignment = "top" | "center" | "bottom" | "custom";
type HorizontalPrimaryAlignment = "left" | "center" | "right";
type VerticalPrimaryAlignment = "top" | "center" | "bottom";

interface LayoutMetrics {
    primary: number;
    cross: number;
    crossStart: number;
    primaryStart: number;
}

interface NodeSize {
    width: number;
    height: number;
}

export class LayoutGroup extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "layoutDirection", type: "string", value: "vert" },
        { name: "horizAlignment", type: "string", value: "left" },
        { name: "vertAlignment", type: "string", value: "top" },
        { name: "itemSpacings", type: "floatarray" },
        { name: "addItemSpacingAfterChild", type: "boolean", value: "true" },
    ];

    /** Divergence backstop for the layout-pass convergence loop; never reached by settling layouts. */
    private static readonly MAX_LAYOUT_PASSES = 8;
    /** @internal Passes the last layout call ran; exposed for convergence tests. */
    lastPassCount = 0;
    private layoutDirty = true;
    private metricsUsedThisPass?: WeakMap<Node, LayoutMetrics>;
    private readonly childSizes = new WeakMap<Node, NodeSize>();
    // Translation applyLayout last assigned to each child. The LayoutGroup owns its children's
    // managed-axis positions, so if a child's translation drifts from this (e.g. an app writes a
    // child's translation directly after layout, as SGDEX ButtonBar does to its label), re-layout
    // must run to re-impose the aligned position — a translation change alone does not dirty layout.
    private readonly assignedTranslations = new WeakMap<Node, number[]>();
    private lastSpacingSignature = "";
    private lastChildCount = 0;
    private readonly epsilon = 0.25;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.LayoutGroup) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.setValueSilent("focusable", BrsBoolean.True);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        super.setValue(index, this.canonicalizeDirection(fieldName, value), alwaysNotify, kind);
        if (this.isLayoutField(fieldName)) {
            this.layoutDirty = true;
        }
    }

    setValueSilent(fieldName: string, value: BrsType) {
        super.setValueSilent(fieldName, this.canonicalizeDirection(fieldName.toLowerCase(), value));
        if (this.isLayoutField(fieldName)) {
            this.layoutDirty = true;
        }
    }

    /**
     * XML attributes are written straight into the field map by `registerInitializedFields`, never
     * through `setValue`, so canonicalize once more after they land. The device applies the same
     * enum normalization to both paths — `<LayoutGroup layoutDirection="Horiz" />` reads back
     * `"horiz"` exactly as a runtime write does.
     */
    protected registerInitializedFields(fields: AAMember[]) {
        super.registerInitializedFields(fields);
        // Read the primitive: getValue hands back a boxed RoString for string fields.
        const current = this.getValueJS("layoutDirection");
        if (typeof current === "string") {
            const canonical = this.canonicalDirectionValue(current);
            if (canonical !== current) {
                this.setValueSilent("layoutDirection", new BrsString(canonical));
            }
        }
    }

    /**
     * `layoutDirection` is an ENUM field on Roku, not free text. Device-measured behavior (all
     * spellings below, identical for XML attributes and runtime writes):
     *
     * - `horiz` / `vert` match case-insensitively and are stored in canonical lowercase, so
     *   writing `"HORIZ"` reads back as `"horiz"`.
     * - Anything else is REJECTED rather than stored-and-ignored: the field reads back as `""`.
     *   `horizontal`, `vertical`, `horz` and `bogus` all land here — near-misses get no leniency.
     * - A rejected write clobbers a previously valid one (`horiz` then `horz` reads back `""`).
     *
     * The layout consequence of that empty state lives in `getLayoutDirection`.
     */
    private canonicalizeDirection(fieldName: string, value: BrsType): BrsType {
        // isBrsString (not instanceof) so a boxed roString assignment normalizes like a literal.
        if (fieldName !== "layoutdirection" || !isBrsString(value)) {
            return value;
        }
        const raw = jsValueOf(value);
        if (typeof raw !== "string") {
            return value;
        }
        const canonical = this.canonicalDirectionValue(raw);
        return canonical === raw ? value : new BrsString(canonical);
    }

    /** "horiz"/"vert" match case-insensitively; everything else collapses to the rejected state. */
    private canonicalDirectionValue(value: string): string {
        const normalized = value.toLowerCase();
        return normalized === "horiz" || normalized === "vert" ? normalized : "";
    }

    appendChildToParent(child: BrsType): boolean {
        const appended = super.appendChildToParent(child);
        if (appended) {
            this.layoutDirty = true;
        }
        return appended;
    }

    removeChildByReference(child: BrsType): boolean {
        const removed = super.removeChildByReference(child);
        if (removed) {
            this.layoutDirty = true;
        }
        return removed;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (this.skipRender(draw2D)) {
            return;
        }

        const direction = this.getLayoutDirection();
        const layoutChildren = this.getLayoutChildren();
        const spacings = this.getItemSpacingValues();
        const spacingSignature = this.createSpacingSignature(spacings);

        if (spacingSignature !== this.lastSpacingSignature) {
            this.lastSpacingSignature = spacingSignature;
            this.layoutDirty = true;
        }

        if (layoutChildren.length !== this.lastChildCount) {
            this.lastChildCount = layoutChildren.length;
            this.layoutDirty = true;
        }

        // Re-layout if any child's translation drifted from what applyLayout last assigned it — an
        // external write to a managed child's translation would otherwise persist, since a translation
        // change does not dirty layout on its own.
        if (!this.layoutDirty) {
            for (const child of layoutChildren) {
                const assigned = this.assignedTranslations.get(child);
                if (!assigned) {
                    continue;
                }
                const current = this.getChildTranslation(child);
                if (!this.nearlyEqual(assigned[0], current[0]) || !this.nearlyEqual(assigned[1], current[1])) {
                    this.layoutDirty = true;
                    break;
                }
            }
        }

        const addAfter = this.shouldAddSpacingAfterChild();

        // On a layout/measurement pass (no draw target — getBoundingRect's full-tree refresh and
        // its single-subtree fallback both render with draw2D undefined), converge the layout to a
        // FIXED POINT in this one call instead of deferring to the next frame. When a child's
        // settled size differs from what applyLayout used (a wrapped Label laid out at a shorter
        // height then rendered taller shifts its siblings), synchronizeChildMetrics re-dirties the
        // layout and the loop runs another pass; it exits only once a pass leaves the layout clean,
        // so a one-shot boundingRect() query never reads a pre-convergence size. The former cap of
        // 2 could exit while still dirty, returning rects that kept creeping on later refreshes.
        // MAX_LAYOUT_PASSES is a divergence backstop, not the terminator — hitting it means child
        // metrics oscillate (a bug to fix, not a state to paper over). A real frame draw (draw2D
        // present) keeps a single pass, preserving its next-frame correction.
        const maxPasses = draw2D === undefined && layoutChildren.length ? LayoutGroup.MAX_LAYOUT_PASSES : 1;
        // Each inner pass ends with nodeRenderingDone → updateParentRects, unioning this group's
        // rect into its PARENT — whose rects are reset once per ITS pass, not per inner pass here.
        // Without restoring them between passes, a converging layout leaves the union of every
        // intermediate position in the parent (e.g. a centered child's pre-center span ∪ its
        // centered span — a 55-tall child reporting 82.5). Snapshot before the loop and restore
        // before each retry so only the final, converged pass's union survives.
        const parentGroup = this.parent instanceof Group ? this.parent : undefined;
        const savedParentRects = parentGroup
            ? {
                  local: { ...parentGroup.rectLocal },
                  toParent: { ...parentGroup.rectToParent },
                  toScene: { ...parentGroup.rectToScene },
              }
            : undefined;
        this.lastPassCount = 0;
        for (let pass = 0; pass < maxPasses; pass++) {
            if (pass > 0 && parentGroup && savedParentRects) {
                parentGroup.rectLocal = { ...savedParentRects.local };
                parentGroup.rectToParent = { ...savedParentRects.toParent };
                parentGroup.rectToScene = { ...savedParentRects.toScene };
            }
            this.lastPassCount = pass + 1;
            this.metricsUsedThisPass = undefined;
            if (layoutChildren.length && this.layoutDirty) {
                this.measureUnsizedChildren(layoutChildren, interpreter);
                this.metricsUsedThisPass = new WeakMap<Node, LayoutMetrics>();
                this.applyLayout(layoutChildren, direction, spacings, addAfter, this.metricsUsedThisPass);
                this.layoutDirty = false;
            }

            super.renderNode(interpreter, origin, angle, opacity, draw2D);

            if (layoutChildren.length) {
                this.synchronizeChildMetrics(layoutChildren, direction);
            }

            // Stop once the layout settled (or on a live frame's single pass).
            if (!this.layoutDirty) {
                break;
            }
        }
    }

    /**
     * A child whose size derives from ITS OWN children (e.g. an icon `Group` wrapping a `Poster`, or
     * a nested `LayoutGroup`) reports width/height 0 until it has rendered — `getDimensions()` reads
     * its unset width field and `chooseActiveRect` finds no laid-out rect, so `applyLayout` would drop
     * it from the row total (a button's background then fits only the text, not the icon). Render such
     * a child's subtree once as a measurement pass (no `draw2D`, so nothing is drawn) to populate its
     * `rectToParent` before it is measured. Children that already know their size (Labels, sized
     * Posters, already-laid-out nodes) are skipped, so this is a no-op in the common case.
     */
    private measureUnsizedChildren(children: Group[], interpreter: Interpreter) {
        // Never prune this scoped measurement: it runs at origin [0,0] regardless of the child's
        // tree position, so cached last-layout contexts do not apply — a skip here would also
        // union the child's cached rect into this group's just-reset rects at the wrong moment.
        const wasPruning = sgRoot.pruneLayout;
        sgRoot.pruneLayout = false;
        try {
            for (const child of children) {
                const dims = child.getDimensions();
                const rectKnown =
                    child.rectToParent.width > 0 || child.rectToScene.width > 0 || child.rectLocal.width > 0;
                if (!rectKnown && !(typeof dims.width === "number" && dims.width > 0)) {
                    child.layoutNode(interpreter, [0, 0], 0, 1);
                    // The [0,0] measurement clobbered the subtree's rectToScene with origin-less
                    // values; deep-mark it so the surrounding pruned refresh re-descends and
                    // re-establishes in-tree rects instead of skipping the settled subtree.
                    child.markSubtreeStaleDeep();
                }
            }
        } finally {
            sgRoot.pruneLayout = wasPruning;
        }
    }

    private applyLayout(
        children: Group[],
        direction: LayoutDirection,
        spacings: number[],
        addSpacingAfterChild: boolean,
        metricsMap: WeakMap<Node, LayoutMetrics>
    ) {
        const metricsList = children.map((child) => this.measureChild(child, direction, metricsMap));
        const primaryAlignment =
            direction === "horiz" ? this.getHorizontalPrimaryAlignment() : this.getVerticalPrimaryAlignment();
        const crossAlignment =
            direction === "horiz" ? this.normalizeVertAlignment(direction) : this.normalizeHorizAlignment(direction);

        const totalPrimary = this.calculateTotalPrimary(metricsList, spacings, addSpacingAfterChild);
        let currentOffset = this.computeStartOffset(direction, totalPrimary, primaryAlignment);

        const childCount = children.length;

        for (let i = 0; i < childCount; i++) {
            const child = children[i];
            const metrics = metricsList[i];
            const spacing = this.getSpacingValue(spacings, i);
            const translation = this.getChildTranslation(child);
            let expectedCrossStart = metrics.crossStart;

            if (!addSpacingAfterChild) {
                currentOffset += spacing;
            }

            const positionOffset = currentOffset;

            if (direction === "horiz") {
                translation[0] += positionOffset - metrics.primaryStart;
                if (crossAlignment && crossAlignment !== "custom") {
                    const targetCrossStart = this.computeCrossPosition(crossAlignment, metrics.cross);
                    const delta = targetCrossStart - metrics.crossStart;
                    translation[1] += delta;
                    expectedCrossStart = targetCrossStart;
                }
            } else {
                translation[1] += positionOffset - metrics.primaryStart;
                if (crossAlignment && crossAlignment !== "custom") {
                    const targetCrossStart = this.computeCrossPosition(crossAlignment, metrics.cross);
                    const delta = targetCrossStart - metrics.crossStart;
                    translation[0] += delta;
                    expectedCrossStart = targetCrossStart;
                }
            }

            this.setChildTranslation(child, translation);
            this.assignedTranslations.set(child, translation.slice());

            currentOffset = positionOffset + metrics.primary;
            if (addSpacingAfterChild && i < childCount - 1) {
                currentOffset += spacing;
            }

            if (metricsMap) {
                metricsMap.set(child, {
                    primary: metrics.primary,
                    cross: metrics.cross,
                    crossStart: expectedCrossStart,
                    primaryStart: positionOffset,
                });
            }
        }

        // Report the group's own bounding size so parents can measure it (e.g. a StdDlgCustomItem
        // sizing the dialog around it). The primary axis is the stacked total; the cross axis is the
        // widest/tallest child.
        const maxCross = metricsList.reduce((acc, m) => Math.max(acc, m.cross), 0);
        if (direction === "horiz") {
            this.setLayoutDimensions(totalPrimary, maxCross);
        } else {
            this.setLayoutDimensions(maxCross, totalPrimary);
        }
    }

    private setLayoutDimensions(width: number, height: number) {
        if (!this.nearlyEqual(this.getValueJS("width") as number, width)) {
            super.setValueSilent("width", new Float(width));
        }
        if (!this.nearlyEqual(this.getValueJS("height") as number, height)) {
            super.setValueSilent("height", new Float(height));
        }
    }

    private synchronizeChildMetrics(children: Group[], direction: LayoutDirection) {
        let needsRelayout = false;
        for (const child of children) {
            const actualMetrics = this.measureChild(child, direction);
            const actualSize =
                direction === "horiz"
                    ? { width: actualMetrics.primary, height: actualMetrics.cross }
                    : { width: actualMetrics.cross, height: actualMetrics.primary };
            const previousSize = this.childSizes.get(child);
            const expected = this.metricsUsedThisPass?.get(child);

            this.childSizes.set(child, actualSize);

            if (previousSize && !this.sizesClose(previousSize, actualSize)) {
                needsRelayout = true;
            }

            if (expected && !this.metricsClose(expected, actualMetrics)) {
                needsRelayout = true;
            }
        }

        if (needsRelayout) {
            this.layoutDirty = true;
            this.isDirty = true;
        }

        this.metricsUsedThisPass = undefined;
    }

    private measureChild(
        child: Group,
        direction: LayoutDirection,
        metricsMap?: WeakMap<Node, LayoutMetrics>
    ): LayoutMetrics {
        const { rect, cached } = this.chooseActiveRect(child);
        let originX = rect.x;
        let originY = rect.y;
        // A cached rect's origin reflects the translation applyLayout assigned last time (the child
        // rendered there), NOT the child's current translation. If the app has since moved the child,
        // shift the measured origin by that drift so applyLayout positions from the CURRENT translation
        // plus the child's intrinsic offset — otherwise the delta-based positioning below leaves the
        // child at the app's translation on the managed axes (e.g. a ButtonBar label stuck low). The
        // fallback rect already uses the current translation, so it needs no shift.
        if (cached) {
            const assigned = this.assignedTranslations.get(child);
            if (assigned) {
                const current = this.getChildTranslation(child);
                originX += current[0] - assigned[0];
                originY += current[1] - assigned[1];
            }
        }
        const metrics: LayoutMetrics = {
            primary: direction === "horiz" ? rect.width : rect.height,
            cross: direction === "horiz" ? rect.height : rect.width,
            crossStart: direction === "horiz" ? originY : originX,
            primaryStart: direction === "horiz" ? originX : originY,
        };

        if (metricsMap) {
            metricsMap.set(child, metrics);
        }

        return metrics;
    }

    private chooseActiveRect(child: Group): { rect: Rect; cached: boolean } {
        const candidates = [child.rectToParent, child.rectToScene, child.rectLocal];
        for (const rect of candidates) {
            if (
                Number.isFinite(rect.x) &&
                Number.isFinite(rect.y) &&
                Number.isFinite(rect.width) &&
                Number.isFinite(rect.height) &&
                rect.width > 0 &&
                rect.height > 0
            ) {
                return { rect, cached: true };
            }
        }

        const translation = this.getChildTranslation(child);
        const dims = child.getDimensions();
        const cached = this.childSizes.get(child);

        const rect = {
            x: translation[0],
            y: translation[1],
            width: typeof dims.width === "number" && dims.width > 0 ? dims.width : cached?.width ?? 0,
            height: typeof dims.height === "number" && dims.height > 0 ? dims.height : cached?.height ?? 0,
        };
        return { rect, cached: false };
    }

    private calculateTotalPrimary(metricsList: LayoutMetrics[], spacings: number[], addAfter: boolean) {
        let total = 0;
        const count = metricsList.length;
        for (let i = 0; i < count; i++) {
            const spacing = this.getSpacingValue(spacings, i);
            if (!addAfter) {
                total += spacing;
            }
            total += metricsList[i].primary;
            if (addAfter && i < count - 1) {
                total += spacing;
            }
        }
        return total;
    }

    private computeCrossPosition(alignment: "top" | "center" | "bottom" | "left" | "right", crossSize: number): number {
        // According to Roku spec, alignment sets the LayoutGroup's local coordinate origin
        // For center: origin is at the center, so children are positioned at -size/2
        // For left/top: origin is at the edge, so children start at 0
        // For right/bottom: origin is at the far edge, so children end at 0
        switch (alignment) {
            case "center":
                return -crossSize / 2;
            case "bottom":
            case "right":
                return -crossSize;
            default: // left or top
                return 0;
        }
    }

    private computeStartOffset(
        direction: LayoutDirection,
        totalPrimary: number,
        alignment: HorizontalPrimaryAlignment | VerticalPrimaryAlignment
    ) {
        if (direction === "horiz") {
            switch (alignment as HorizontalPrimaryAlignment) {
                case "center":
                    return -totalPrimary / 2;
                case "right":
                    return -totalPrimary;
                default:
                    return 0;
            }
        }
        switch (alignment as VerticalPrimaryAlignment) {
            case "center":
                return -totalPrimary / 2;
            case "bottom":
                return -totalPrimary;
            default:
                return 0;
        }
    }

    private getChildTranslation(child: Group) {
        const existing = child.getValueJS("translation");
        if (Array.isArray(existing) && existing.length === 2) {
            return [Number(existing[0]) || 0, Number(existing[1]) || 0];
        }
        return [0, 0];
    }

    private setChildTranslation(child: Group, translation: number[]) {
        const current = child.getValueJS("translation");
        if (Array.isArray(current) && current.length === 2) {
            if (this.nearlyEqual(current[0], translation[0]) && this.nearlyEqual(current[1], translation[1])) {
                return;
            }
        }
        child.setTranslation(translation);
    }

    private getLayoutChildren() {
        const children: Group[] = [];
        for (const child of this.children) {
            if (child instanceof Group) {
                children.push(child);
            }
        }
        return children;
    }

    /**
     * Only a stored `"vert"` lays out vertically. Every other state — `"horiz"`, or the `""` that
     * `canonicalizeDirection` leaves after a rejected write — lays out HORIZONTALLY on the device.
     *
     * That asymmetry is the counter-intuitive part, so spell it out: an untouched field keeps its
     * `"vert"` default and stacks vertically, but a field written with an unrecognized value ends
     * up empty and rows out horizontally. `<LayoutGroup layoutDirection="horz" />` is therefore a
     * horizontal row on hardware, even though `horz` is not a documented value.
     */
    private getLayoutDirection(): LayoutDirection {
        return this.getValueJS("layoutDirection") === "vert" ? "vert" : "horiz";
    }

    private normalizeHorizAlignment(direction: LayoutDirection): HorizontalAlignment {
        const raw = this.getValueJS("horizAlignment");
        if (typeof raw === "string") {
            const value = raw.toLowerCase() as HorizontalAlignment;
            if (value === "left" || value === "center" || value === "right" || value === "custom") {
                return direction === "horiz" && value === "custom" ? "left" : value;
            }
        }
        return "left";
    }

    private normalizeVertAlignment(direction: LayoutDirection): VerticalAlignment {
        const raw = this.getValueJS("vertAlignment");
        if (typeof raw === "string") {
            const value = raw.toLowerCase() as VerticalAlignment;
            if (value === "top" || value === "center" || value === "bottom" || value === "custom") {
                return direction === "vert" && value === "custom" ? "top" : value;
            }
        }
        return "top";
    }

    private getHorizontalPrimaryAlignment(): HorizontalPrimaryAlignment {
        const alignment = this.normalizeHorizAlignment("horiz");
        return alignment === "custom" ? "left" : alignment;
    }

    private getVerticalPrimaryAlignment(): VerticalPrimaryAlignment {
        const alignment = this.normalizeVertAlignment("vert");
        return alignment === "custom" ? "top" : alignment;
    }

    private shouldAddSpacingAfterChild() {
        const value = this.getValueJS("addItemSpacingAfterChild");
        return value !== false;
    }

    private getItemSpacingValues() {
        const field = this.getValue("itemSpacings");
        if (!(field instanceof RoArray)) {
            return [] as number[];
        }
        return field.getElements().map((element) => {
            const result = jsValueOf(element);
            return typeof result === "number" && Number.isFinite(result) ? result : 0;
        });
    }

    private getSpacingValue(spacings: number[], index: number) {
        if (!spacings.length) {
            return 0;
        }
        const resolved = spacings[Math.min(index, spacings.length - 1)];
        if (typeof resolved === "number" && Number.isFinite(resolved)) {
            return resolved;
        }
        return 0;
    }

    private createSpacingSignature(spacings: number[]) {
        if (spacings.length === 0) {
            return "";
        }
        const signatureValues = spacings.map((value) =>
            typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "nan"
        );
        return `${spacings.length}:${signatureValues.join("|")}`;
    }

    private isLayoutField(fieldName: string) {
        const key = fieldName.toLowerCase();
        return (
            key === "layoutdirection" ||
            key === "horizalignment" ||
            key === "vertalignment" ||
            key === "itemspacings" ||
            key === "additemspacingafterchild"
        );
    }

    private nearlyEqual(a: number, b: number) {
        return Math.abs((a || 0) - (b || 0)) <= this.epsilon;
    }

    private metricsClose(a: LayoutMetrics, b: LayoutMetrics) {
        return (
            this.nearlyEqual(a.primary, b.primary) &&
            this.nearlyEqual(a.cross, b.cross) &&
            this.nearlyEqual(a.crossStart, b.crossStart) &&
            this.nearlyEqual(a.primaryStart, b.primaryStart)
        );
    }

    private sizesClose(a: NodeSize, b: NodeSize) {
        return this.nearlyEqual(a.width, b.width) && this.nearlyEqual(a.height, b.height);
    }
}
