import { AAMember, BrsBoolean, BrsString, BrsType, Float, IfDraw2D, Interpreter, jsValueOf, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { GridPanel, Panel, Poster, SGNodeType } from ".";
import { Group } from "./Group";
import { sgRoot } from "../SGRoot";

const DefaultPanelGapHD = 30;

export class PanelSet extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "1280" },
        { name: "height", type: "float", value: "605" },
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
    private readonly leftArrow: Poster;
    private readonly rightArrow: Poster;
    private readonly leftArrowUri: string;
    private readonly rightArrowUri: string;
    private focusIndex: number = 0;
    private wasFocused: boolean = false;
    private handleSelect: boolean = true;
    public focusedPanelCallback?: (panel: Panel) => void;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PanelSet) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

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
        }
        super.setValue(index, value, alwaysNotify, kind);
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
        if (key === "left" || key === "back") {
            return this.goBack();
        } else if (key === "right" || (key === "OK" && this.handleSelect)) {
            return this.goForward();
        }
        return false;
    }

    protected goBack() {
        if (this.focusIndex === 0) {
            return false;
        }
        const currentPanel = this.panels[this.focusIndex];
        this.focusIndex--;
        super.setValue("isGoingBack", BrsBoolean.True);
        if (this.panels.length > 2) {
            const removedPanel = this.panels.pop();
            if (removedPanel?.getValueJS("isFullScreen") === true) {
                this.focusIndex = Math.max(0, this.panels.length - 2);
            }
            this.removeChildByReference(removedPanel!);
            super.setValue("numPanels", new Float(this.panels.length));
        }
        currentPanel.setNodeFocus(false);
        this.setNodeFocus(true);
        return true;
    }

    protected goForward() {
        if (this.focusIndex >= this.panels.length - 1) {
            return false;
        }
        const currentPanel = this.panels.at(this.focusIndex);
        if (currentPanel?.getValueJS("hasNextPanel") === true) {
            this.focusIndex++;
            super.setValue("isGoingBack", BrsBoolean.False);
            currentPanel.setNodeFocus(false);
            this.setNodeFocus(true);
            return true;
        }
        return false;
    }

    appendChildToParent(child: BrsType): boolean {
        const added = super.appendChildToParent(child);
        if (added && child instanceof Panel) {
            this.panels.push(child);
            if (child.getValueJS("isFullScreen") === true) {
                this.focusIndex = this.panels.length - 1;
            } else {
                this.focusIndex = Math.max(0, this.panels.length - 2);
            }
            super.setValue("numPanels", new Float(this.panels.length));
            this.refreshFocus();
        }
        return added;
    }

    renderChildren(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        const visiblePanels: Panel[] = this.panels.slice(-2);
        const leftPanelIndex = this.getValueJS("leftPanelIndex") as number;
        let showLeftArrow = leftPanelIndex > 0;
        let showRightArrow = false;
        if (visiblePanels.length > 0) {
            const panel = visiblePanels[0];
            panel.setTranslationX(panel.getValueJS("leftPosition") as number);
            if (visiblePanels.length > 1) {
                const panel2 = visiblePanels[1];
                if (panel2.getValueJS("isFullScreen") === true) {
                    const panel2PosX = panel2.getValueJS("leftPosition") as number;
                    panel2.setTranslationX(panel2PosX);
                } else {
                    panel.renderNode(interpreter, origin, angle, opacity, draw2D);
                    const panel2PosX =
                        (panel2.getValueJS("leftPosition") as number) +
                        (panel.getValueJS("width") as number) +
                        (this.resolution === "HD" ? DefaultPanelGapHD : DefaultPanelGapHD * 1.5);
                    panel2.setTranslationX(panel2PosX);
                }
                panel2.renderNode(interpreter, origin, angle, opacity, draw2D);
                showRightArrow = panel2.getValueJS("hasNextPanel") === true;
            } else {
                panel.renderNode(interpreter, origin, angle, opacity, draw2D);
            }
            const focusPanel = this.panels[this.focusIndex];
            if (showLeftArrow && focusPanel.getValueJS("suppressLeftArrow") === true) {
                showLeftArrow = false;
            }
        }
        if (showLeftArrow) {
            this.leftArrow.setValueSilent("visible", BrsBoolean.from(showLeftArrow));
            this.leftArrow.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        if (showRightArrow) {
            this.rightArrow.setValueSilent("visible", BrsBoolean.from(showRightArrow));
            this.rightArrow.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        this.changed = false;
    }

    private refreshFocus() {
        const currentFocus = sgRoot.focused;
        if (this.panels.length && (currentFocus === this || this.isChildrenFocused())) {
            const focusedPanel = this.panels[this.focusIndex];
            if (focusedPanel && currentFocus !== focusedPanel) {
                this.handleSelect = focusedPanel.getValueJS("selectButtonMovesPanelForward") === true;
                const hasNextPanel = focusedPanel.getValueJS("hasNextPanel") === true;
                if (hasNextPanel && focusedPanel instanceof GridPanel) {
                    focusedPanel.nextPanelCallback = (nextPanel: Panel) => {
                        if (this.panels.length === 1) {
                            this.appendChildToParent(nextPanel);
                            return;
                        }
                        const removed = this.panels.splice(-1, 1, nextPanel);
                        const removedIndex = this.children.indexOf(removed[0]);
                        this.replaceChildAtIndex(nextPanel, removedIndex);
                    };
                } else if (focusedPanel instanceof GridPanel) {
                    focusedPanel.nextPanelCallback = undefined;
                }
                const isFull = focusedPanel.getValueJS("isFullScreen") === true;
                const isLast = this.focusIndex === this.panels.length - 1;
                const leftIndex = !isFull && isLast && this.focusIndex > 0 ? this.focusIndex - 1 : this.focusIndex;
                super.setValue("leftPanelIndex", new Float(leftIndex));
                if (this.focusedPanelCallback) {
                    focusedPanel.setValue("leftOrientation", BrsBoolean.from(leftIndex === this.focusIndex));
                    this.focusedPanelCallback(focusedPanel);
                }
                focusedPanel.setNodeFocus(true);
            }
            this.wasFocused = true;
        } else if (this.wasFocused) {
            this.wasFocused = false;
            this.isDirty = true;
        }
    }
}
