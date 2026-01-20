import { AAMember, BrsBoolean, BrsString, BrsType, Float, IfDraw2D, Interpreter, jsValueOf, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { Panel, Poster, SGNodeType } from ".";
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
    public sceneCallback?: Function;

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
        this.focusIndex--;
        if (this.panels.length > 1) {
            const removedPanel = this.panels.pop();
            this.removeChildByReference(removedPanel!);
            this.setValue("numPanels", new Float(this.panels.length));
            this.setNodeFocus(true);
        } else {
            this.refreshFocus();
        }
        return true;
    }

    protected goForward() {
        if (this.focusIndex >= this.panels.length - 1) {
            return false;
        }
        const lastPanel = this.panels.at(-1);
        if (lastPanel?.getValueJS("hasNextPanel") === true) {
            this.focusIndex++;
            this.refreshFocus();
            return true;
        }
        return false;
    }

    appendChildToParent(child: BrsType): boolean {
        const added = super.appendChildToParent(child);
        if (added && child instanceof Panel) {
            this.panels.push(child);
            this.setValue("numPanels", new Float(this.panels.length));
        }
        return added;
    }

    renderChildren(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        const visiblePanels: Panel[] = this.panels.slice(-2);
        let showLeftArrow = this.focusIndex > 0;
        let showRightArrow = false;
        if (visiblePanels.length > 0) {
            const panel = visiblePanels[0];
            panel.setTranslationX(panel.getValueJS("leftPosition") as number);
            if (visiblePanels.length > 1) {
                const panel2 = visiblePanels[1];
                if (panel2.getValueJS("panelSize") === "full") {
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
                if (panel2.getValueJS("suppressLeftArrow")) {
                    showLeftArrow = false;
                }
                showRightArrow = panel2.getValueJS("hasNextPanel") === true;
            } else {
                panel.renderNode(interpreter, origin, angle, opacity, draw2D);
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
                focusedPanel.setNodeFocus(true);
                this.setValue("leftPanelIndex", new Float(this.focusIndex));
                this.handleSelect = focusedPanel.getValueJS("selectButtonMovesPanelForward") === true;
                if (this.sceneCallback) {
                    this.sceneCallback(focusedPanel);
                }
            }
            this.wasFocused = true;
        } else if (this.wasFocused) {
            this.wasFocused = false;
            this.isDirty = true;
        }
    }
}
