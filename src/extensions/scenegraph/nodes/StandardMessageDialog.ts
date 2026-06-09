import { AAMember, BrsString, BrsType, IfDraw2D, Interpreter, RoArray } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { StandardDialog } from "./StandardDialog";
import { StdDlgTitleArea } from "./StdDlgTitleArea";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { StdDlgButtonArea } from "./StdDlgButtonArea";
import { StdDlgTextItem } from "./StdDlgTextItem";
import { StdDlgBulletTextItem } from "./StdDlgBulletTextItem";

/**
 * StandardMessageDialog — displays a message to the user with (top to bottom): one or more blocks
 * of text, an optional bulleted/numbered/lettered list, one or more blocks of bottom text, and a
 * button area. Composed from the StandardDialog framework building blocks; the base class handles
 * layout, focus, button wiring, and back/close.
 */
export class StandardMessageDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "stringarray", value: "[]" },
        { name: "bulletText", type: "stringarray", value: "[]" },
        { name: "bulletType", type: "string", value: "bullet" },
        { name: "bottomMessage", type: "stringarray", value: "[]" },
        { name: "buttons", type: "stringarray", value: "[]" },
    ];
    private contentDirty = true;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardMessageDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.StandardDialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const titleArea = new StdDlgTitleArea();
        this.appendChildToParent(titleArea);
        this.linkField(titleArea, "primaryTitle", "title");

        this.appendChildToParent(new StdDlgContentArea());
        this.appendChildToParent(new StdDlgButtonArea());
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        if (["message", "bullettext", "bullettype", "bottommessage"].includes(index.toLowerCase())) {
            this.contentDirty = true;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        if (this.contentDirty) {
            this.rebuildContent();
        }
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }

    private rebuildContent() {
        if (!this.contentArea) {
            return;
        }
        this.contentArea.clearItems();
        const addText = (text: string) => {
            const item = new StdDlgTextItem();
            item.setValue("text", new BrsString(text));
            this.contentArea!.addItem(item);
        };
        (this.getValueJS("message") as string[])?.forEach(addText);

        const bulletText = (this.getValueJS("bulletText") as string[]) ?? [];
        if (bulletText.length) {
            const bullets = new StdDlgBulletTextItem();
            bullets.setValue("bulletText", new RoArray(bulletText.map((t) => new BrsString(t))));
            bullets.setValue("bulletType", new BrsString((this.getValueJS("bulletType") as string) || "bullet"));
            this.contentArea.addItem(bullets);
        }

        (this.getValueJS("bottomMessage") as string[])?.forEach(addText);
        this.contentDirty = false;
    }
}
