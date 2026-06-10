import { AAMember, Interpreter, BrsBoolean, BrsString, Float, Int32, IfDraw2D, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Poster } from "./Poster";
import { Rectangle } from "./Rectangle";
import { Label } from "./Label";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";
import { sgRoot } from "../SGRoot";
import { rotateTranslation } from "../SGUtil";

/**
 * A focusable content-area item that highlights its child nodes on a rectangular background
 * (tinted with the palette's DialogFootprintColor) and adds an optional icon:
 *
 * - `more_info`  → a right-arrow icon on the right of the children.
 * - `checkbox`   → a check box on the left; checked when `iconStatus` is true.
 * - `radiobutton`→ a radio indicator on the left; filled when `iconStatus` is true.
 *
 * The icon is tinted with DialogFocusItemColor when focused, DialogTextColor otherwise. Pressing OK
 * while focused fires the `selected` field so the app can react. Maps Roku's StdDlgActionCardItem
 * (extends StdDlgItemBase → Group; we collapse the abstract base onto Group, matching the other
 * StdDlg* items).
 *
 * Note: the common volume has no dedicated radio-circle assets, so the radio indicator approximates
 * with the pin-pad dot (filled) and the empty checkbox (unfilled).
 */
export class StdDlgActionCardItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "iconStatus", type: "boolean", value: "false" },
        { name: "iconType", type: "string", value: "none" },
        // Notified when the focused action card is activated (OK pressed). Not in the spec's Fields
        // table but used by the reference examples via observeField("selected", …).
        { name: "selected", type: "boolean", value: "false", alwaysNotify: true },
    ];
    private readonly background: Rectangle;
    private readonly icon: Poster;
    private readonly iconSize: number;
    private readonly gap: number;
    private readonly pad: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgActionCardItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        // The action card is designed to be focusable so it can receive key events.
        this.setValueSilent("focusable", BrsBoolean.True);
        this.iconSize = this.resolution === "FHD" ? 36 : 24;
        this.gap = this.resolution === "FHD" ? 18 : 12;
        this.pad = this.resolution === "FHD" ? 15 : 10;

        // Background first (drawn behind), then the icon, then the app-authored children.
        this.background = new Rectangle();
        this.appendChildToParent(this.background);
        this.icon = this.addPoster("", [0, 0], this.iconSize, this.iconSize);
    }

    setNodeFocus(focusOn: boolean): boolean {
        // Re-tint the icon on focus changes.
        this.isDirty = true;
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        if (press && key === "OK") {
            this.setValue("selected", BrsBoolean.True);
            return true;
        }
        return false;
    }

    /** App-authored renderable children (everything except the background and icon helpers). */
    private contentChildren(): Group[] {
        return this.children.filter(
            (child) => child instanceof Group && child !== this.background && child !== this.icon
        ) as Group[];
    }

    private childHeight(child: Group): number {
        if (child instanceof Label) {
            return child.getMeasured().height;
        }
        let height = (child.getValueJS("height") as number) ?? 0;
        if (height <= 0) {
            height = (child.getValueJS("bitmapHeight") as number) ?? 0;
        }
        return height;
    }

    layoutItem(width: number): number {
        const type = (this.getValueJS("iconType") as string) || "none";
        const leftIcon = type === "checkbox" || type === "radiobutton";
        const rightIcon = type === "more_info";
        const leftSpace = leftIcon ? this.iconSize + this.gap : 0;
        const rightSpace = rightIcon ? this.iconSize + this.gap : 0;
        const contentX = this.pad + leftSpace;
        const lineGap = this.resolution === "FHD" ? 6 : 4;

        const content = this.contentChildren();
        let y = this.pad;
        for (let index = 0; index < content.length; index++) {
            const child = content[index];
            child.setTranslation([contentX, y]);
            y += this.childHeight(child);
            if (index < content.length - 1) {
                y += lineGap;
            }
        }
        const contentHeight = y - this.pad;
        const rowHeight = Math.max(contentHeight, this.iconSize) + 2 * this.pad;

        this.background.setTranslation([0, 0]);
        this.background.setValueSilent("width", new Float(width));
        this.background.setValueSilent("height", new Float(rowHeight));

        const iconY = (rowHeight - this.iconSize) / 2;
        if (leftIcon) {
            this.icon.setTranslation([this.pad, iconY]);
        } else if (rightIcon) {
            this.icon.setTranslation([width - this.iconSize - this.pad, iconY]);
        }

        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(rowHeight));
        return rowHeight;
    }

    /** Resolves the icon image for the current type/status (empty when no icon). */
    private iconUri(): string {
        const type = (this.getValueJS("iconType") as string) || "none";
        const status = this.getValueJS("iconStatus") as boolean;
        const res = this.resolution;
        switch (type) {
            case "checkbox":
                return `common:/images/${res}/${status ? "icon_checkboxON" : "icon_checkboxOFF"}.png`;
            case "radiobutton":
                return status
                    ? `common:/images/${res}/dialog_pinpad_dot.png`
                    : `common:/images/${res}/icon_checkboxOFF.png`;
            case "more_info":
                return `common:/images/${res}/panelSet_rightArrow.png`;
            default:
                return "";
        }
    }

    private updateVisuals() {
        const colors = getDialogColors(this);
        const footprint = colorFromPalette(colors, "DialogFootprintColor", "0x55555580");
        this.background.setValueSilent("color", new Int32(footprint));

        const focused = sgRoot.focused === this;
        const tint = focused
            ? colorFromPalette(colors, "DialogFocusItemColor", "0xFFFFFFFF")
            : colorFromPalette(colors, "DialogTextColor", "0xDDDDDDFF");
        const uri = this.iconUri();
        this.icon.setValue("uri", new BrsString(uri));
        this.icon.setValue("blendColor", new Int32(tint));
        this.icon.setValueSilent("visible", BrsBoolean.from(uri !== ""));
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        this.updateVisuals();
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: size.height,
        };
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
