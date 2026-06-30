import { AAMember, Interpreter, BrsBoolean, BrsType, Float, Int32, isNumberComp, IfDraw2D, Rect } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { ContentNode } from "./ContentNode";
import { TargetSet } from "./TargetSet";
import { sgRoot } from "../SGRoot";
import { createNode } from "../factory/NodeFactory";
import { brsValueOf } from "../factory/Serializer";
import { rotateTranslation } from "../SGUtil";

/**
 * TargetGroup maps the items of its `content` ContentNode onto the rectangular regions defined by a
 * {@link TargetSet}. An `itemComponentName` XML component is instantiated on demand for each visible
 * item and positioned at its current target rectangle.
 *
 * This is a functional ("snap to target") implementation: `jumpToItem` and `animateToItem` both move
 * focus immediately, so `currFocusItemIndex`/`currTarget` stay integer and `focusPercent` is 0 or 1.
 * The `duration`/`easeFunction`/`advancing`/`reversing` fields are registered and stored but do not
 * yet drive a time-based tween.
 */
export class TargetGroup extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "content", type: "node" },
        { name: "targetSet", type: "node" },
        { name: "defaultTargetSetFocusIndex", type: "integer", value: "0" },
        { name: "wrap", type: "boolean", value: "false" },
        { name: "duration", type: "time", value: "0.3" },
        { name: "showTargetRects", type: "boolean", value: "false" },
        { name: "currFocusItemIndex", type: "float", value: "-1.0", alwaysNotify: true },
        { name: "currTargetSet", type: "node" },
        { name: "itemSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "itemFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "itemUnfocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "jumpToItem", type: "integer", value: "0", alwaysNotify: true },
        { name: "animateToItem", type: "integer", value: "0", alwaysNotify: true },
        { name: "animateToTargetSet", type: "node" },
        { name: "easeFunction", type: "string", value: "inOutCubic" },
        { name: "advancing", type: "boolean", value: "false" },
        { name: "reversing", type: "boolean", value: "false" },
    ];

    protected readonly content: ContentNode[] = [];
    protected readonly itemComps: Group[] = [];
    protected focusIndex: number = 0;
    protected wrap: boolean = false;
    protected lastPressHandled: string = "";

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TargetGroup) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("content", new ContentNode());
        this.setValueSilent("focusable", BrsBoolean.True);
        this.wrap = (this.getValueJS("wrap") as boolean) ?? false;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "content" && value instanceof ContentNode) {
            super.setValue(index, value, alwaysNotify, kind);
            this.itemComps.length = 0;
            this.refreshContent();
            // Initialize focus on the first item. setFocusedItem() short-circuits when the index is
            // unchanged, so seed the focus fields directly to leave currFocusItemIndex at 0 (not -1).
            this.focusIndex = 0;
            if (this.content.length > 0) {
                super.setValueSilent("currFocusItemIndex", new Float(0));
                super.setValue("itemFocused", new Int32(0));
            }
            return;
        } else if (fieldName === "targetset" && value instanceof TargetSet) {
            super.setValue(index, value, alwaysNotify, kind);
            this.isDirty = true;
            super.setValueSilent("currTargetSet", value);
            return;
        } else if (fieldName === "animatetotargetset" && value instanceof TargetSet) {
            // Functional version: snap to the new TargetSet immediately.
            this.setValue("targetSet", value);
            return;
        } else if (["jumptoitem", "animatetoitem"].includes(fieldName) && isNumberComp(value)) {
            this.setFocusedItem(value.getValue() as number);
        } else if (fieldName === "wrap") {
            this.wrap = value instanceof BrsBoolean ? value.toBoolean() : this.wrap;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setNodeFocus(focusOn: boolean): boolean {
        const focus = super.setNodeFocus(focusOn);
        this.isDirty = true;
        return focus;
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "OK") {
            handled = this.handleOK(press);
        }
        this.lastPressHandled = handled && key !== "OK" ? key : "";
        return handled;
    }

    protected handleOK(press: boolean): boolean {
        if (press && this.focusIndex >= 0 && this.focusIndex < this.content.length) {
            this.setValue("itemSelected", new Int32(this.focusIndex));
        }
        return false;
    }

    protected setFocusedItem(index: number) {
        if (this.content.length === 0) {
            return;
        }
        if (this.wrap) {
            index = ((index % this.content.length) + this.content.length) % this.content.length;
        } else if (index < 0 || index >= this.content.length) {
            return;
        }
        if (index === this.focusIndex) {
            return;
        }
        super.setValue("itemUnfocused", new Int32(this.focusIndex));
        this.focusIndex = index;
        super.setValueSilent("currFocusItemIndex", new Float(index));
        super.setValue("itemFocused", new Int32(index));
        this.isDirty = true;
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        for (const child of content.getNodeChildren()) {
            if (child instanceof ContentNode) {
                this.content.push(child);
            }
        }
    }

    /** Returns the TargetSet currently driving layout (`currTargetSet`, falling back to `targetSet`). */
    protected getActiveTargetSet(): TargetSet | undefined {
        const curr = this.getValue("currTargetSet");
        if (curr instanceof TargetSet) {
            return curr;
        }
        const target = this.getValue("targetSet");
        return target instanceof TargetSet ? target : undefined;
    }

    protected getTargetFocusIndex(targetSet: TargetSet): number {
        const setIndex = targetSet.getFocusIndex();
        if (setIndex >= 0) {
            return setIndex;
        }
        return (this.getValueJS("defaultTargetSetFocusIndex") as number) ?? 0;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();

        const content = this.getValue("content");
        if (content instanceof ContentNode && content.changed) {
            this.refreshContent();
            content.changed = false;
        }

        const targetSet = this.getActiveTargetSet();
        if (targetSet) {
            this.renderItems(interpreter, targetSet, drawTrans, rotation, opacity, draw2D);
        }

        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private renderItems(
        interpreter: Interpreter,
        targetSet: TargetSet,
        drawTrans: number[],
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const rects = targetSet.getTargetRects();
        if (rects.length === 0) {
            return;
        }
        const setFocusIndex = this.getTargetFocusIndex(targetSet);
        const groupHasFocus = sgRoot.focused === this;

        if (this.getValueJS("showTargetRects")) {
            this.drawTargetRects(rects, drawTrans, targetSet.getColor(), opacity, draw2D);
        }

        for (let i = 0; i < this.content.length; i++) {
            // currTarget is the target-rect index this item occupies. In snap mode the focused item
            // (this.focusIndex) sits at the TargetSet's focus index; neighbors fill adjacent rects.
            let currTarget = setFocusIndex + (i - this.focusIndex);
            if (this.wrap) {
                currTarget = ((currTarget % rects.length) + rects.length) % rects.length;
            } else if (currTarget < 0 || currTarget >= rects.length) {
                continue;
            }
            const targetRect = rects[currTarget];
            const focused = i === this.focusIndex;
            this.renderItemComponent(
                interpreter,
                i,
                currTarget,
                targetRect,
                focused,
                groupHasFocus,
                drawTrans,
                rotation,
                opacity,
                draw2D
            );
        }
    }

    private renderItemComponent(
        interpreter: Interpreter,
        index: number,
        currTarget: number,
        targetRect: Rect,
        focused: boolean,
        groupHasFocus: boolean,
        drawTrans: number[],
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const content = this.content[index];
        if (!this.itemComps[index]) {
            const itemComp = this.createItemComponent(interpreter, targetRect, content);
            if (itemComp instanceof Group) {
                this.itemComps[index] = itemComp;
            } else {
                return;
            }
        }
        const itemComp = this.itemComps[index];
        // Update the documented interface fields, in order.
        itemComp.setValue("currTarget", new Float(currTarget), false);
        itemComp.setValue(
            "currRect",
            brsValueOf([targetRect.x, targetRect.y, targetRect.width, targetRect.height]),
            false
        );
        itemComp.setValue("index", new Int32(index), false);
        itemComp.setValue("groupHasFocus", BrsBoolean.from(groupHasFocus), false);
        itemComp.setValue("itemContent", content, true);
        itemComp.setValue("focusPercent", new Float(focused ? 1 : 0), false);
        itemComp.setValue("itemHasFocus", BrsBoolean.from(focused && groupHasFocus), false);

        const itemOrigin = [drawTrans[0] + targetRect.x, drawTrans[1] + targetRect.y];
        itemComp.renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
    }

    protected createItemComponent(interpreter: Interpreter, itemRect: Rect, content: ContentNode) {
        const itemCompName = (this.getValueJS("itemComponentName") as string) ?? "";
        const itemComp = itemCompName ? createNode(itemCompName, interpreter, this) : new Group();
        if (itemComp instanceof Group) {
            itemComp.setNodeParent(this);
            itemComp.setValue("width", new Float(itemRect.width), false);
            itemComp.setValue("height", new Float(itemRect.height), false);
            itemComp.setValue("itemContent", content, false);
        }
        return itemComp;
    }

    private drawTargetRects(rects: Rect[], drawTrans: number[], color: number, opacity: number, draw2D?: IfDraw2D) {
        if (!draw2D) {
            return;
        }
        for (const rect of rects) {
            const drawRect = {
                x: drawTrans[0] + rect.x,
                y: drawTrans[1] + rect.y,
                width: rect.width,
                height: rect.height,
            };
            draw2D.doDrawRotatedRect(drawRect, color, 0, [0, 0], opacity);
        }
    }
}
