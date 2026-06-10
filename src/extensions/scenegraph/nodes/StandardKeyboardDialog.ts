import { AAMember, BrsBoolean, BrsString, BrsType, IfDraw2D, Interpreter } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { StandardDialog } from "./StandardDialog";
import { StdDlgTitleArea } from "./StdDlgTitleArea";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { StdDlgButtonArea } from "./StdDlgButtonArea";
import { StdDlgTextItem } from "./StdDlgTextItem";
import { StdDlgKeyboardItem } from "./StdDlgKeyboardItem";
import { sgRoot } from "../SGRoot";

/**
 * StandardKeyboardDialog — text/voice entry of alphanumeric strings (Roku's replacement for the
 * legacy KeyboardDialog). Composed of a title area, a content area with optional message text plus
 * a keyboard item hosting a keyboard, and a button area. The embedded keyboard reuses the existing
 * Keyboard node. The base class handles layout, button wiring, and close; this class adds the
 * keyboard ⇄ buttons focus model.
 */
export class StandardKeyboardDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "stringarray", value: "[]" },
        { name: "buttons", type: "stringarray", value: "[]" },
        { name: "textEditBox", type: "node" },
        { name: "text", type: "string", value: "" },
        { name: "keyboardDomain", type: "string", value: "generic" },
    ];
    private readonly keyboardItem: StdDlgKeyboardItem;
    private contentDirty = true;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardKeyboardDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.StandardDialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const titleArea = new StdDlgTitleArea();
        this.appendChildToParent(titleArea);
        this.linkField(titleArea, "primaryTitle", "title");

        this.appendChildToParent(new StdDlgContentArea());
        this.appendChildToParent(new StdDlgButtonArea());

        this.keyboardItem = new StdDlgKeyboardItem();
        this.keyboardItem.setValue("keyLayout", new BrsString("keyboard"));

        // Widen the dialog to fit the keyboard, then share text/textEditBox.
        const keyboard = this.keyboardItem.keyboard;
        if (keyboard) {
            this.contentWidth = Math.max(this.contentWidth, keyboard.getDimensions().width);
        }
        this.linkField(this.keyboardItem, "text", "text");
        this.linkField(this.keyboardItem, "textEditBox", "textEditBox");
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        if (index.toLowerCase() === "message") {
            this.contentDirty = true;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setNodeFocus(focusOn: boolean): boolean {
        if (focusOn && sgRoot.focused && this.lastFocus === undefined) {
            this.lastFocus = sgRoot.focused;
            sgRoot.setFocused(this.keyboardItem.keyboard ?? this);
            this.isDirty = true;
        }
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        const keyboard = this.keyboardItem.keyboard;
        if (press && key === "back") {
            this.setValue("close", BrsBoolean.True);
            return true;
        }
        const focused = sgRoot.focused;
        const buttonsFocused =
            this.buttonArea !== undefined &&
            (focused === this.buttonArea || focused?.getNodeParent() === this.buttonArea);

        if (keyboard && focused === keyboard) {
            let handled = keyboard.handleKey(key, press);
            if (!handled && press && key === "down" && this.buttonArea?.hasButtons) {
                sgRoot.setFocused(this.buttonArea);
                this.isDirty = true;
                handled = true;
            }
            return handled;
        } else if (buttonsFocused) {
            let handled = this.buttonArea!.handleKey(key, press);
            if (!handled && press && key === "up" && keyboard) {
                sgRoot.setFocused(keyboard);
                this.isDirty = true;
                handled = true;
            }
            return handled;
        }
        return this.buttonArea?.hasButtons ? this.buttonArea.handleKey(key, press) : false;
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
        for (const text of (this.getValueJS("message") as string[]) ?? []) {
            const item = new StdDlgTextItem();
            item.setValue("text", new BrsString(text));
            this.contentArea.addItem(item);
        }
        this.contentArea.addItem(this.keyboardItem);
        this.contentDirty = false;
    }
}
