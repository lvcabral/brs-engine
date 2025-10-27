import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { BrsType, RoArray, isBrsString, jsValueOf } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { RoSGNode } from "../components/RoSGNode";

type LayoutDirection = "horiz" | "vert";
type HorizontalAlignment = "left" | "center" | "right" | "custom";
type VerticalAlignment = "top" | "center" | "bottom" | "custom";
type HorizontalPrimaryAlignment = "left" | "center" | "right";
type VerticalPrimaryAlignment = "top" | "center" | "bottom";

interface LayoutMetrics {
    primary: number;
    cross: number;
    crossStart: number;
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
        { name: "focusable", type: "boolean", value: "true" },
    ];

    private layoutDirty = true;
    private metricsUsedThisPass?: WeakMap<RoSGNode, LayoutMetrics>;
    private readonly childSizes = new WeakMap<RoSGNode, NodeSize>();
    private lastSpacingSignature = "";
    private lastChildCount = 0;
    private readonly epsilon = 0.25;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "LayoutGroup") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        const result = super.set(index, value, alwaysNotify, kind);
        if (this.isLayoutField(fieldName)) {
            this.layoutDirty = true;
        }
        return result;
    }

    setFieldValue(fieldName: string, value: BrsType, alwaysNotify: boolean = false) {
        super.setFieldValue(fieldName, value, alwaysNotify);
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
            this.metricsUsedThisPass = new WeakMap<RoSGNode, LayoutMetrics>();
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
        metricsMap: WeakMap<RoSGNode, LayoutMetrics>
    ) {
        const metricsList = children.map((child) => this.measureChild(child, direction, metricsMap));
        const primaryAlignment =
            direction === "horiz" ? this.getHorizontalPrimaryAlignment() : this.getVerticalPrimaryAlignment();
        const crossAlignment =
            direction === "horiz" ? this.normalizeVertAlignment(direction) : this.normalizeHorizAlignment(direction);

        const totalPrimary = this.calculateTotalPrimary(metricsList, spacings, addSpacingAfterChild);
        let currentOffset = this.computeStartOffset(direction, totalPrimary, primaryAlignment);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const metrics = metricsList[i];
            const spacing = this.getSpacingValue(spacings, i);
            const translation = [0, 0];

            if (!addSpacingAfterChild) {
                currentOffset += spacing;
            }

            if (direction === "horiz") {
                translation[0] = currentOffset;
                if (crossAlignment && crossAlignment !== "custom") {
                    translation[1] = this.computeCrossPosition(crossAlignment, metrics.cross);
                }
            } else {
                translation[1] = currentOffset;
                if (crossAlignment && crossAlignment !== "custom") {
                    translation[0] = this.computeCrossPosition(crossAlignment, metrics.cross);
                }
            }

            this.setChildTranslation(child, translation);

            currentOffset += metrics.primary;
            if (addSpacingAfterChild) {
                currentOffset += spacing;
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

            // Only compare dimensions (primary/cross), not position (crossStart)
            if (
                expected &&
                (!this.nearlyEqual(expected.primary, actualMetrics.primary) ||
                    !this.nearlyEqual(expected.cross, actualMetrics.cross))
            ) {
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
        metricsMap?: WeakMap<RoSGNode, LayoutMetrics>
    ): LayoutMetrics {
        const rect = this.chooseActiveRect(child);
        const metrics: LayoutMetrics = {
            primary: direction === "horiz" ? rect.width : rect.height,
            cross: direction === "horiz" ? rect.height : rect.width,
            crossStart: direction === "horiz" ? rect.y : rect.x,
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
        for (let i = 0; i < metricsList.length; i++) {
            if (!addAfter) {
                total += this.getSpacingValue(spacings, i);
            }
            total += metricsList[i].primary;
            if (addAfter) {
                total += this.getSpacingValue(spacings, i);
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
        const existing = child.getFieldValueJS("translation");
        if (Array.isArray(existing) && existing.length === 2) {
            return [Number(existing[0]) || 0, Number(existing[1]) || 0];
        }
        return [0, 0];
    }

    private setChildTranslation(child: Group, translation: number[]) {
        const current = child.getFieldValueJS("translation");
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
        const direction = this.getFieldValueJS("layoutDirection");
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
        const raw = this.getFieldValueJS("horizAlignment");
        if (typeof raw === "string") {
            const value = raw.toLowerCase() as HorizontalAlignment;
            if (value === "left" || value === "center" || value === "right" || value === "custom") {
                return direction === "horiz" && value === "custom" ? "left" : value;
            }
        }
        return "left";
    }

    private normalizeVertAlignment(direction: LayoutDirection): VerticalAlignment {
        const raw = this.getFieldValueJS("vertAlignment");
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
        const value = this.getFieldValueJS("addItemSpacingAfterChild");
        return value !== false;
    }

    private getItemSpacingValues() {
        const field = this.getFieldValue("itemSpacings");
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
            this.nearlyEqual(a.crossStart, b.crossStart)
        );
    }

    private sizesClose(a: NodeSize, b: NodeSize) {
        return this.nearlyEqual(a.width, b.width) && this.nearlyEqual(a.height, b.height);
    }
}
