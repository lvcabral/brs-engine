import { AAMember, BrsType, Interpreter, IfDraw2D, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { TargetGroup } from "./TargetGroup";
import { TargetSet } from "./TargetSet";
import { sgRoot } from "../SGRoot";

/**
 * TargetList extends {@link TargetGroup} with the higher-level focus behavior of a typical list/row:
 * it swaps between a focused and an unfocused {@link TargetSet} as it gains/loses focus, and maps the
 * configurable `advanceKey`/`reverseKey` remote buttons to moving the focused item.
 *
 * Simplification (functional version): when `focusedTargetSet` holds multiple TargetSets the focus
 * does not "float" across them — the first entry is used and advance/reverse simply move the focused
 * item (snap).
 */
export class TargetList extends TargetGroup {
    readonly defaultFields: FieldModel[] = [
        { name: "focusedTargetSet", type: "nodearray", value: "[]" },
        { name: "unfocusedTargetSet", type: "node" },
        { name: "advanceKey", type: "string", value: "down" },
        { name: "reverseKey", type: "string", value: "up" },
    ];

    // Tracks the focus state observed on the previous render so we can swap target sets on transition.
    private hadFocus = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TargetList) {
        super([], name);
        this.setExtendsType(name, SGNodeType.TargetGroup);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        // focusedTargetSet is an array field, but apps commonly assign a single TargetSet to it
        // (fixed-focus case). Field validation rejects a lone Node into an array field, so wrap it.
        if (index.toLowerCase() === "focusedtargetset" && value instanceof TargetSet) {
            value = new RoArray([value]);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        // Swap the active target set when focus changes. The engine moves focus between sibling nodes
        // by rewriting the focus chain (it does not call setNodeFocus(false) on the node losing focus),
        // so detecting the transition here is the reliable place to react. Doing it before super's
        // render means the swap takes effect in this same frame.
        this.syncFocusTargetSet();
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }

    private syncFocusTargetSet() {
        const hasFocus = sgRoot.focused === this;
        if (hasFocus === this.hadFocus) {
            return;
        }
        this.hadFocus = hasFocus;
        const targetSet = hasFocus ? this.getFocusedTargetSet() : this.getUnfocusedTargetSet();
        if (targetSet instanceof TargetSet) {
            this.setValue("targetSet", targetSet);
        }
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        const advanceKey = (this.getValueJS("advanceKey") as string)?.toLowerCase() ?? "down";
        const reverseKey = (this.getValueJS("reverseKey") as string)?.toLowerCase() ?? "up";
        const lowerKey = key.toLowerCase();
        let handled = false;
        if (press && lowerKey === advanceKey) {
            handled = this.moveFocus(1);
        } else if (press && lowerKey === reverseKey) {
            handled = this.moveFocus(-1);
        } else {
            return super.handleKey(key, press);
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    private moveFocus(offset: number): boolean {
        const previous = this.focusIndex;
        this.setFocusedItem(this.focusIndex + offset);
        return this.focusIndex !== previous;
    }

    private getFocusedTargetSet(): TargetSet | undefined {
        const value = this.getValue("focusedTargetSet");
        if (value instanceof RoArray) {
            for (const element of value.getElements()) {
                if (element instanceof TargetSet) {
                    return element;
                }
            }
        } else if (value instanceof TargetSet) {
            return value;
        }
        return undefined;
    }

    private getUnfocusedTargetSet(): TargetSet | undefined {
        const value = this.getValue("unfocusedTargetSet");
        return value instanceof TargetSet ? value : undefined;
    }
}
