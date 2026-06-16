import { AAMember, BrsBoolean, BrsString, Float, IfDraw2D, Int32, Interpreter } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { VoiceTextEditBox } from "./VoiceTextEditBox";
import { DynamicKeyGrid } from "./DynamicKeyGrid";
import { KeyInset, KeyLayout } from "./kdf/KeyDefinition";
import { sgRoot } from "../SGRoot";

/**
 * Abstract base for the Dynamic voice keyboards. Combines a DynamicKeyGrid (the
 * keys) and a VoiceTextEditBox (the display), wiring key selection to text edits
 * and keyboard-mode switching. Subclasses install a Key Definition File and
 * configure the VoiceTextEditBox.
 */
export class DynamicKeyboardBase extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "textEditBox", type: "node" },
        { name: "hideTextBox", type: "boolean", value: "false" },
        { name: "keyGrid", type: "node" },
        { name: "domain", type: "string", value: "generic" },
    ];

    readonly textEditBox: VoiceTextEditBox;
    readonly keyGrid: DynamicKeyGrid;
    private readonly textBoxHeight: number;
    private readonly gap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicKeyboardBase) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.textBoxHeight = this.resolution === "FHD" ? 72 : 48;
        this.gap = this.resolution === "FHD" ? 18 : 12;

        this.textEditBox = new VoiceTextEditBox();
        this.keyGrid = new DynamicKeyGrid();
        this.keyGrid.onKeySelected = (out) => this.applyKey(out);

        this.setValueSilent("textEditBox", this.textEditBox);
        this.setValueSilent("keyGrid", this.keyGrid);
        this.setValueSilent("focusable", BrsBoolean.True);

        // Keep `text` and the VoiceTextEditBox's `text` as a single shared field.
        this.linkField(this.textEditBox, "text");

        this.appendChildToParent(this.textEditBox);
        this.appendChildToParent(this.keyGrid);
    }

    /**
     * Installs a Key Definition File, initial mode, and optional keyboard background
     * image (e.g. "keyboard_full") shared with the legacy nodes, along with the cell
     * insets that align the keys to the background's drawn cells.
     */
    protected setKeyDefinition(
        layout: KeyLayout,
        initialMode: string,
        background?: { name: string; insetFHD: KeyInset; insetHD: KeyInset }
    ) {
        this.keyGrid.setValueSilent("mode", new BrsString(initialMode));
        if (background) {
            this.keyGrid.setBackground(background.name, background.insetFHD, background.insetHD);
        }
        this.keyGrid.setLayout(layout);
        const gridWidth = this.keyGrid.getValueJS("width") as number;
        const gridHeight = this.keyGrid.getValueJS("height") as number;
        this.textEditBox.setValueSilent("width", new Float(gridWidth));
        this.textEditBox.setValueSilent("height", new Float(this.textBoxHeight));
        this.setValueSilent("width", new Float(gridWidth));
        this.setValueSilent("height", new Float(gridHeight + this.textBoxHeight + this.gap));
        this.layoutChildren(false);
    }

    /** Configures the internal VoiceTextEditBox. */
    protected configureVoiceBox(opts: { voiceEntryType: string; voiceEnabled: boolean; maxTextLength: number }) {
        this.textEditBox.setValueSilent("voiceEntryType", new BrsString(opts.voiceEntryType));
        this.textEditBox.setValueSilent("voiceEnabled", BrsBoolean.from(opts.voiceEnabled));
        this.textEditBox.setValueSilent("maxTextLength", new Int32(opts.maxTextLength));
    }

    /** Re-syncs the text box and node dimensions from the key grid (e.g. after a custom KDF loads). */
    private syncSize() {
        const gridWidth = this.keyGrid.getValueJS("width") as number;
        const gridHeight = this.keyGrid.getValueJS("height") as number;
        if (gridWidth > 0 && (this.textEditBox.getValueJS("width") as number) !== gridWidth) {
            this.textEditBox.setValueSilent("width", new Float(gridWidth));
            this.textEditBox.setValueSilent("height", new Float(this.textBoxHeight));
            this.setValueSilent("width", new Float(gridWidth));
            this.setValueSilent("height", new Float(gridHeight + this.textBoxHeight + this.gap));
        }
    }

    private layoutChildren(hideTextBox: boolean) {
        this.textEditBox.setValueSilent("visible", BrsBoolean.from(!hideTextBox));
        this.textEditBox.setTranslation([0, 0]);
        this.keyGrid.setTranslation([0, hideTextBox ? 0 : this.textBoxHeight + this.gap]);
    }

    // -------------------------------------------------------------------------
    // Key selection → text editing / mode switching
    // -------------------------------------------------------------------------

    /** Applies a selected key (its strOut or label) to the text and keyboard mode. */
    protected applyKey(out: string) {
        switch (out) {
            case "clear":
                this.textEditBox.setValue("text", new BrsString(""));
                this.textEditBox.moveCursor(0);
                return;
            case "backspace":
                this.backspace();
                return;
            case "space":
                this.insertText(" ");
                return;
            case "left":
                this.textEditBox.moveCursor(-1);
                return;
            case "right":
                this.textEditBox.moveCursor(1);
                return;
            case "shift":
            case "capslock":
            case "UpperLower":
                this.toggleCase();
                return;
            case "abc123":
                this.setBaseMode("ABC123");
                return;
            case "symbols":
                this.setBaseMode("Symbols");
                return;
            case "accents":
                this.setBaseMode("Accents");
                return;
            default:
                this.insertText(out);
        }
    }

    private insertText(str: string) {
        const maxLen = this.textEditBox.getValueJS("maxTextLength") as number;
        let text = this.textEditBox.getValueJS("text") as string;
        let pos = this.textEditBox.getValueJS("cursorPosition") as number;
        const room = maxLen - text.length;
        if (room <= 0) {
            return;
        }
        if (str.length > room) {
            str = str.slice(0, room);
        }
        text = text.slice(0, pos) + str + text.slice(pos);
        pos += str.length;
        this.textEditBox.setValue("text", new BrsString(text));
        this.textEditBox.setValue("cursorPosition", new Float(pos));
    }

    private backspace() {
        let text = this.textEditBox.getValueJS("text") as string;
        let pos = this.textEditBox.getValueJS("cursorPosition") as number;
        if (text.length === 0 || pos === 0) {
            return;
        }
        text = text.slice(0, pos - 1) + text.slice(pos);
        pos--;
        this.textEditBox.setValue("text", new BrsString(text));
        this.textEditBox.setValue("cursorPosition", new Float(pos));
    }

    private parseMode(mode: string): { base: string; upper: boolean } {
        const base = mode.startsWith("Symbols") ? "Symbols" : mode.startsWith("Accents") ? "Accents" : "ABC123";
        const upper = mode.endsWith("Upper") || mode.endsWith("Shift");
        return { base, upper };
    }

    private toggleCase() {
        const mode = this.keyGrid.getValueJS("mode") as string;
        if (!mode) {
            return;
        }
        const { base, upper } = this.parseMode(mode);
        this.keyGrid.setValue("mode", new BrsString(base + (upper ? "Lower" : "Upper")));
    }

    private setBaseMode(base: string) {
        const mode = this.keyGrid.getValueJS("mode") as string;
        if (!mode) {
            return;
        }
        const { upper } = this.parseMode(mode);
        this.keyGrid.setValue("mode", new BrsString(base + (upper ? "Upper" : "Lower")));
    }

    // -------------------------------------------------------------------------
    // Input routing + rendering
    // -------------------------------------------------------------------------

    handleKey(key: string, press: boolean): boolean {
        if (!press) {
            return false;
        }
        if (key.startsWith("Lit_") || key === "replay") {
            return this.textEditBox.handleKey(key, press);
        }
        return this.keyGrid.handleKey(key, press);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const focused = sgRoot.focused === this;
        const hideTextBox = this.getValueJS("hideTextBox") as boolean;
        this.syncSize();
        this.layoutChildren(hideTextBox);
        this.textEditBox.setActive(focused);
        this.keyGrid.setFocusActive(focused);
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }
}
