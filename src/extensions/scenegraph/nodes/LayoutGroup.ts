import { AAMember, Interpreter, BrsBoolean, BrsType, RoArray, IfDraw2D } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { jsValueOf } from "../factory/Serializer";
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
        { name: "itemSpacings", type: "array" },
        { name: "addItemSpacingAfterChild", type: "boolean", value: "true" },
    ];

    private layoutDirty = true;
    private metricsUsedThisPass?: WeakMap<Node, LayoutMetrics>;
    private readonly childSizes = new WeakMap<Node, NodeSize>();
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

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        if (this.isLayoutField(fieldName)) {
            this.layoutDirty = true;
        }
    }

    setValueSilent(fieldName: string, value: BrsType) {
        super.setValueSilent(fieldName, value);
        if (this.isLayoutField(fieldName)) {
            this.layoutDirty = true;
        }
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
        if (!this.isVisible()) {
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

        const addAfter = this.shouldAddSpacingAfterChild();

        this.metricsUsedThisPass = undefined;
        if (layoutChildren.length && this.layoutDirty) {
            this.metricsUsedThisPass = new WeakMap<Node, LayoutMetrics>();
            this.applyLayout(layoutChildren, direction, spacings, addAfter, this.metricsUsedThisPass);
            this.layoutDirty = false;
        }

        super.renderNode(interpreter, origin, angle, opacity, draw2D);

        if (layoutChildren.length) {
            this.synchronizeChildMetrics(layoutChildren, direction);
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
        const rect = this.chooseActiveRect(child);
        const metrics: LayoutMetrics = {
            primary: direction === "horiz" ? rect.width : rect.height,
            cross: direction === "horiz" ? rect.height : rect.width,
            crossStart: direction === "horiz" ? rect.y : rect.x,
            primaryStart: direction === "horiz" ? rect.x : rect.y,
        };

        if (metricsMap) {
            metricsMap.set(child, metrics);
        }

        return metrics;
    }

    private chooseActiveRect(child: Group) {
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
                return rect;
            }
        }

        const translation = this.getChildTranslation(child);
        const dims = child.getDimensions();
        const cached = this.childSizes.get(child);

        return {
            x: translation[0],
            y: translation[1],
            width: typeof dims.width === "number" && dims.width > 0 ? dims.width : cached?.width ?? 0,
            height: typeof dims.height === "number" && dims.height > 0 ? dims.height : cached?.height ?? 0,
        };
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

    private getLayoutDirection(): LayoutDirection {
        const direction = this.getValueJS("layoutDirection");
        if (typeof direction === "string") {
            const normalized = direction.toLowerCase();
            if (normalized === "horiz" || normalized === "horizontal") {
                return "horiz";
            }
            if (normalized === "vert" || normalized === "vertical") {
                return "vert";
            }
        }
        return "vert";
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
