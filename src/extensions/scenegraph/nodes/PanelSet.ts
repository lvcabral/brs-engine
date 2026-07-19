import { AAMember, BrsBoolean, BrsString, BrsType, Float, IfDraw2D, Interpreter, jsValueOf, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { GridPanel, Panel, Poster, SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";
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
    private appendingPreview: boolean = false;
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
            if (currentPanel === this.panels.at(-1) && currentPanel.getValueJS("isFullScreen") === true) {
                // A displayed full-screen panel occupies both positions: going back slides it
                // fully offscreen (removed), restoring the pair — and focus — that preceded it.
                this.panels.pop();
                this.focusIndex = Math.max(0, this.panels.length - 2);
                this.removeChildByReference(currentPanel);
                super.setValue("numPanels", new Float(this.panels.length));
            } else {
                // Only panels that slide fully off the right edge are auto-removed (Roku
                // contract). After the slide the visible pair is [focusIndex, focusIndex + 1];
                // going back from the LAST panel removes nothing — it stays as the right panel,
                // reachable again with a right press.
                let removed = false;
                while (this.panels.length > 2 && this.panels.length - 1 > this.focusIndex + 1) {
                    const removedPanel = this.panels.pop()!;
                    this.removeChildByReference(removedPanel);
                    removed = true;
                }
                if (removed) {
                    super.setValue("numPanels", new Float(this.panels.length));
                }
            }
        }
        currentPanel.setNodeFocus(false);
        this.setNodeFocus(true);
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
        super.setValue("isGoingBack", BrsBoolean.False);
        currentPanel?.setNodeFocus(false);
        this.setNodeFocus(true);
        return true;
    }

    appendChildToParent(child: BrsType): boolean {
        const added = super.appendChildToParent(child);
        if (added && child instanceof Panel) {
            this.panels.push(child);
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
                // A full-screen panel occupies both positions only once it is the displayed
                // (focused) panel; while it is still an unfocused nextPanel preview it sits on
                // the right like any other panel, per the Roku Panel.isFullScreen contract.
                const panel2TakesOver =
                    panel2.getValueJS("isFullScreen") === true && this.panels[this.focusIndex] === panel2;
                if (panel2TakesOver) {
                    const panel2PosX = panel2.getValueJS("leftPosition") as number;
                    panel2.setTranslationX(panel2PosX);
                } else {
                    panel.renderNode(interpreter, origin, angle, opacity, draw2D);
                    // Per Roku spec: right panel origin = left panel leftPosition + left panel width + spacing
                    const panel2PosX =
                        (panel.getValueJS("leftPosition") as number) +
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
            const removed = this.panels.splice(-1, 1, nextPanel);
            const removedIndex = this.children.indexOf(removed[0]);
            this.replaceChildAtIndex(nextPanel, removedIndex);
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
            this.removeChildByReference(removed);
        }
        this.focusIndex = Math.max(0, this.panels.length - 1);
        super.setValue("numPanels", new Float(this.panels.length));
        this.isDirty = true;
    }

    private refreshFocus() {
        const currentFocus = sgRoot.focused;
        if (this.panels.length && (currentFocus === this || this.isChildrenFocused())) {
            const focusedPanel = this.panels[this.focusIndex];
            if (focusedPanel && currentFocus !== focusedPanel) {
                this.handleSelect = focusedPanel.getValueJS("selectButtonMovesPanelForward") === true;
                // Ensure the focused GridPanel's create-next-panel callback is wired (also done at
                // append time). The mechanism is driven by createNextPanelOnItemFocus (checked in
                // GridPanel), not by hasNextPanel — that field only controls the right-arrow
                // indicator / forward navigation to a further panel.
                if (focusedPanel instanceof GridPanel) {
                    this.wireNextPanel(focusedPanel);
                }
                const isFull = focusedPanel.getValueJS("isFullScreen") === true;
                const isLast = this.focusIndex === this.panels.length - 1;
                const leftIndex = !isFull && isLast && this.focusIndex > 0 ? this.focusIndex - 1 : this.focusIndex;
                super.setValue("leftPanelIndex", new Float(leftIndex));
                if (this.focusedPanelCallback) {
                    focusedPanel.setValue("leftOrientation", BrsBoolean.from(leftIndex === this.focusIndex));
                    this.focusedPanelCallback(focusedPanel);
                }
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
}
