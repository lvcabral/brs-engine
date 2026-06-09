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
 * StandardPinPadDialog — text/voice entry of numeric PIN codes (Roku's replacement for the legacy
 * PinDialog). Composed of a title area, a content area with optional message text plus a keyboard
 * item hosting a pin pad, and a button area. The embedded pad reuses the existing PinPad. The base
 * class handles layout, button wiring, and close; this class adds the pad ⇄ buttons focus model.
 */
export class StandardPinPadDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "stringarray", value: "[]" },
        { name: "buttons", type: "stringarray", value: "[]" },
        { name: "textEditBox", type: "node" },
        { name: "pin", type: "string", value: "" },
    ];
    private readonly keyboardItem: StdDlgKeyboardItem;
    private contentDirty = true;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardPinPadDialog) {
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
        this.keyboardItem.setValue("keyLayout", new BrsString("pinpad"));

        // Share the entered PIN and expose the internal VoiceTextEditBox.
        const pinPad = this.keyboardItem.pinPad;
        if (pinPad) {
            this.linkField(pinPad, "pin", "pin");
        }
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
            sgRoot.setFocused(this.keyboardItem.pinPad ?? this);
            this.isDirty = true;
        }
        return true;
    }

    handleKey(key: string, press: boolean): boolean {
        const pad = this.keyboardItem.pinPad;
        if (press && key === "back") {
            this.setValue("close", BrsBoolean.True);
            return true;
        }
        const focused = sgRoot.focused;
        const buttonsFocused =
            this.buttonArea !== undefined &&
            (focused === this.buttonArea || focused?.getNodeParent() === this.buttonArea);

        if (pad && focused === pad) {
            let handled = pad.handleKey(key, press);
            if (!handled && press && key === "down" && this.buttonArea?.hasButtons) {
                sgRoot.setFocused(this.buttonArea);
                this.isDirty = true;
                handled = true;
            }
            return handled;
        } else if (buttonsFocused) {
            let handled = this.buttonArea!.handleKey(key, press);
            if (!handled && press && key === "up" && pad) {
                sgRoot.setFocused(pad);
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
        this.keyboardItem.syncTextLimit();
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }

    private rebuildContent() {
        if (!this.contentArea) {
            return;
        }
        this.contentArea.clearItems();
        (this.getValueJS("message") as string[])?.forEach((text) => {
            const item = new StdDlgTextItem();
            item.setValue("text", new BrsString(text));
            this.contentArea!.addItem(item);
        });
        this.contentArea.addItem(this.keyboardItem);
        this.contentDirty = false;
    }
}
