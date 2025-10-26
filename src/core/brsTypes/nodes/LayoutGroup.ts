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
        const metricsList: LayoutMetrics[] = [];
        for (const child of children) {
            metricsList.push(this.measureChild(child, direction, metricsMap));
        }

        const primaryAlignment =
            direction === "horiz" ? this.getHorizontalPrimaryAlignment() : this.getVerticalPrimaryAlignment();
        const verticalAlignment = direction === "horiz" ? this.normalizeVertAlignment(direction) : undefined;
        const horizontalAlignment = direction === "vert" ? this.normalizeHorizAlignment(direction) : undefined;

        const totalPrimary = this.calculateTotalPrimary(metricsList, spacings, addSpacingAfterChild);
        let currentOffset = this.computeStartOffset(direction, totalPrimary, primaryAlignment);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const metrics = metricsList[i];
            const spacing = this.getSpacingValue(spacings, i);
            const translation = this.getChildTranslation(child);

            if (!addSpacingAfterChild) {
                currentOffset += spacing;
            }

            if (direction === "horiz") {
                translation[0] = currentOffset;
                if (verticalAlignment && verticalAlignment !== "custom") {
                    translation[1] = this.computeVerticalOffset(verticalAlignment, metrics.cross);
                }
            } else {
                translation[1] = currentOffset;
                if (horizontalAlignment && horizontalAlignment !== "custom") {
                    translation[0] = this.computeHorizontalOffset(horizontalAlignment, metrics.cross);
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
            const renderedSize = this.readRenderedSize(child);
            const previousSize = this.childSizes.get(child);
            const used = this.metricsUsedThisPass?.get(child);
            const actualMetrics: LayoutMetrics = {
                primary: direction === "horiz" ? renderedSize.width : renderedSize.height,
                cross: direction === "horiz" ? renderedSize.height : renderedSize.width,
            };

            this.childSizes.set(child, renderedSize);

            if (previousSize && !this.sizesClose(previousSize, renderedSize)) {
                needsRelayout = true;
            }

            if (used && !this.metricsClose(used, actualMetrics)) {
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
        metricsMap: WeakMap<RoSGNode, LayoutMetrics>
    ): LayoutMetrics {
        const size = this.extractChildSize(child);
        const metrics: LayoutMetrics = {
            primary: direction === "horiz" ? size.width : size.height,
            cross: direction === "horiz" ? size.height : size.width,
        };
        metricsMap.set(child, metrics);
        return metrics;
    }

    private extractChildSize(child: Group): NodeSize {
        let width = Math.max(0, child.rectLocal.width);
        let height = Math.max(0, child.rectLocal.height);

        if (width <= 0 || height <= 0) {
            width = Math.max(width, child.rectToParent.width ?? 0);
            height = Math.max(height, child.rectToParent.height ?? 0);
        }

        if (width <= 0 || height <= 0) {
            const dims = child.getDimensions();
            if (width <= 0 && typeof dims.width === "number" && dims.width > 0) {
                width = dims.width;
            }
            if (height <= 0 && typeof dims.height === "number" && dims.height > 0) {
                height = dims.height;
            }
        }

        if (width <= 0 || height <= 0) {
            const cached = this.childSizes.get(child);
            if (cached) {
                if (width <= 0) {
                    width = cached.width;
                }
                if (height <= 0) {
                    height = cached.height;
                }
            }
        }

        return { width: width > 0 ? width : 0, height: height > 0 ? height : 0 };
    }

    private readRenderedSize(child: Group): NodeSize {
        let width = Math.max(0, child.rectLocal.width);
        let height = Math.max(0, child.rectLocal.height);

        if (width <= 0 || height <= 0) {
            width = Math.max(width, child.rectToParent.width ?? 0);
            height = Math.max(height, child.rectToParent.height ?? 0);
        }

        if (width <= 0 || height <= 0) {
            const dims = child.getDimensions();
            if (width <= 0 && typeof dims.width === "number" && dims.width > 0) {
                width = dims.width;
            }
            if (height <= 0 && typeof dims.height === "number" && dims.height > 0) {
                height = dims.height;
            }
        }

        return { width, height };
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

    private computeHorizontalOffset(alignment: Exclude<HorizontalAlignment, "custom">, width: number) {
        switch (alignment) {
            case "center":
                return -width / 2;
            case "right":
                return -width;
            default:
                return 0;
        }
    }

    private computeVerticalOffset(alignment: Exclude<VerticalAlignment, "custom">, height: number) {
        switch (alignment) {
            case "center":
                return -height / 2;
            case "bottom":
                return -height;
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
            return typeof result === "number" && isFinite(result) ? result : 0;
        });
    }

    private getSpacingValue(spacings: number[], index: number) {
        if (!spacings.length) {
            return 0;
        }
        const resolved = spacings[Math.min(index, spacings.length - 1)];
        if (typeof resolved === "number" && isFinite(resolved)) {
            return resolved;
        }
        return 0;
    }

    private createSpacingSignature(spacings: number[]) {
        if (spacings.length === 0) {
            return "";
        }
        const signatureValues = spacings.map((value) =>
            typeof value === "number" && isFinite(value) ? value.toFixed(4) : "nan"
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
        return this.nearlyEqual(a.primary, b.primary) && this.nearlyEqual(a.cross, b.cross);
    }

    private sizesClose(a: NodeSize, b: NodeSize) {
        return this.nearlyEqual(a.width, b.width) && this.nearlyEqual(a.height, b.height);
    }
}
