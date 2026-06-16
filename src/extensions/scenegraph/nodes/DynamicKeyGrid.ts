import {
    AAMember,
    BrsBoolean,
    BrsString,
    BrsType,
    BrsDevice,
    Float,
    IfDraw2D,
    Interpreter,
    Rect,
    RoArray,
    RoBitmap,
    RoFont,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";
import { Font } from "./Font";
import { sgRoot } from "../SGRoot";
import { jsValueOf } from "../factory/Serializer";
import { computeLayout, KeyInset, keyboardSize, KeyLayout, RenderedKey, resolveKeyIcon } from "./kdf/KeyDefinition";

/** Default palette colors used when no RSGPalette is found in the scene graph. */
const DEFAULT_PALETTE: Record<string, number> = {
    KeyboardColor: 0xffffffff, // no tint applied to the keyboard background bitmap
    PrimaryTextColor: 0xffffffff,
    SecondaryItemColor: 0x808080ff,
    FocusColor: 0xffffffff,
    FocusItemColor: 0x000000ff,
};

interface SuggestionPopup {
    options: string[];
    index: number;
    key: RenderedKey;
}

type NavKeys = "up" | "down" | "left" | "right";

/**
 * DynamicKeyGrid implements a grid of keys defined by a Key Definition File (KDF).
 * Used internally by the DynamicKeyboardBase subclasses or as a standalone node.
 */
export class DynamicKeyGrid extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "keyDefinitionUri", type: "uri", value: "" },
        { name: "mode", type: "string", value: "" },
        { name: "focusVisible", type: "boolean", value: "true" },
        { name: "horizWrap", type: "boolean", value: "false" },
        { name: "vertWrap", type: "boolean", value: "false" },
        { name: "palette", type: "node" },
        { name: "keyFocused", type: "string", value: "", alwaysNotify: true },
        { name: "keySelected", type: "string", value: "", alwaysNotify: true },
        { name: "jumpToKey", type: "array" },
        { name: "disableKey", type: "string", value: "" },
        { name: "enableKey", type: "string", value: "" },
    ];

    /** Optional callback invoked (with the key's strOut/label) on every selection. */
    onKeySelected?: (out: string) => void;

    private layout?: KeyLayout;
    private renderedKeys: RenderedKey[] = [];
    private focusIndex = -1;
    private readonly disabledSet = new Set<string>();
    private popup?: SuggestionPopup;
    private focusActive = false;
    private lastFocusTime = 0;
    // Suppresses the hover-timer pop-up after an option was selected, until focus leaves the key.
    private popupSuppressed = false;

    private readonly font: Font;
    private readonly bmpFocus?: RoBitmap;
    private bmpBackground?: RoBitmap;
    private inset: KeyInset = { top: 0, right: 0, bottom: 0, left: 0 };
    private readonly keyFocusDelta: number;
    private readonly bmpIcons = new Map<string, RoBitmap>();

    // The special-key icon assets shared with the legacy Keyboard/MiniKeyboard/PinPad nodes.
    private static readonly ICON_NAMES = [
        "shift",
        "space",
        "delete",
        "clear",
        "moveCursorLeft",
        "moveCursorRight",
        "caps_on",
        "caps_off",
        "alphanum_on",
        "alphanum_off",
        "symbols_on",
        "symbols_off",
        "accent_on",
        "accent_off",
    ];

    private readonly hoverDelay = 800; // ms the focus must dwell on a key before its "hover" pop-up opens

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicKeyGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.font = new Font();
        this.keyFocusDelta = this.resolution === "FHD" ? 15 : 10;
        this.setValueSilent("focusable", BrsBoolean.True);
        this.bmpFocus = this.loadBitmap("common:/images/focus_keyboard.9.png");
        for (const icon of DynamicKeyGrid.ICON_NAMES) {
            const bmp = this.loadBitmap(`common:/images/${this.resolution}/icon_${icon}.png`);
            if (bmp?.isValid()) {
                this.bmpIcons.set(icon, bmp);
            }
        }
    }

    /** Installs a Key Definition File directly (used by the built-in keyboards). */
    setLayout(layout: KeyLayout) {
        this.layout = layout;
        this.rebuild();
    }

    /**
     * Loads a resolution-specific keyboard background bitmap (e.g. "keyboard_full"),
     * drawn at natural size like the legacy nodes, with the matching cell inset so
     * the keys land on the drawn cells.
     */
    setBackground(name: string, insetFHD: KeyInset, insetHD: KeyInset) {
        this.bmpBackground = name ? this.loadBitmap(`common:/images/${this.resolution}/${name}.png`) : undefined;
        this.inset = this.resolution === "FHD" ? insetFHD : insetHD;
        this.rebuild();
    }

    /** Called by the owning keyboard each render so focus only shows while focused. */
    setFocusActive(active: boolean) {
        this.focusActive = active;
    }

    private get mode(): string {
        return (this.getValueJS("mode") as string) ?? "";
    }

    private rebuild() {
        if (!this.layout) {
            this.renderedKeys = [];
            this.focusIndex = -1;
            return;
        }
        const res = this.resolution === "FHD" ? "FHD" : "HD";
        this.renderedKeys = computeLayout(this.layout, this.mode, res, this.inset);
        const [w, h] = keyboardSize(this.layout, res);
        this.setValueSilent("width", new Float(w));
        this.setValueSilent("height", new Float(h));
        if (this.focusIndex < 0 || !this.keyFocusable(this.renderedKeys[this.focusIndex])) {
            this.focusIndex = this.renderedKeys.findIndex((k) => this.keyFocusable(k));
        }
        this.updateKeyFocused();
        this.isDirty = true;
    }

    private keyFocusable(key?: RenderedKey): boolean {
        return !!key && key.focusable && !this.disabledSet.has(key.out);
    }

    private updateKeyFocused() {
        const key = this.renderedKeys[this.focusIndex];
        super.setValue("keyFocused", new BrsString(key?.out ?? ""));
        // Focus moved to a (possibly) different key: restart the hover dwell timer and
        // clear any pop-up suppression, so the timer applies again on the newly focused key.
        this.lastFocusTime = Date.now();
        this.popupSuppressed = false;
    }

    private selectKey(out: string) {
        super.setValue("keySelected", new BrsString(out));
        this.onKeySelected?.(out);
    }

    // -------------------------------------------------------------------------
    // Field writes (mode, KDF load, jump/disable/enable)
    // -------------------------------------------------------------------------

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync?: boolean) {
        const fieldName = index.toLowerCase();
        if (fieldName === "keydefinitionuri") {
            super.setValue(index, value, alwaysNotify, kind, sync);
            this.loadKeyDefinition(jsValueOf(value) as string);
            return;
        } else if (fieldName === "mode") {
            super.setValue(index, value, alwaysNotify, kind, sync);
            this.rebuild();
            return;
        } else if (fieldName === "jumptokey" && value instanceof RoArray) {
            this.jumpToKey(value.getElements().map((e) => (jsValueOf(e) as number) ?? -1));
            return;
        } else if (fieldName === "disablekey") {
            const key = jsValueOf(value) as string;
            if (key) {
                this.setKeyDisabled(key, true);
            }
            return;
        } else if (fieldName === "enablekey") {
            const key = jsValueOf(value) as string;
            if (key) {
                this.setKeyDisabled(key, false);
            }
            return;
        }
        super.setValue(index, value, alwaysNotify, kind, sync);
    }

    private loadKeyDefinition(uri: string) {
        if (!uri?.trim()) {
            return;
        }
        try {
            const contents = BrsDevice.fileSystem.readFileSync(uri, "utf-8") as string;
            this.layout = JSON.parse(contents) as KeyLayout;
            this.focusIndex = -1;
            this.rebuild();
        } catch (err: any) {
            BrsDevice.stderr.write(
                `warning,DynamicKeyGrid: failed to load Key Definition File "${uri}": ${err?.message}`
            );
        }
    }

    private jumpToKey(coords: number[]) {
        if (coords.length < 3) {
            return;
        }
        const [section, row, key] = coords;
        const index = this.renderedKeys.findIndex(
            (k) => k.section === section && k.row === row && k.col === key && this.keyFocusable(k)
        );
        if (index >= 0) {
            this.focusIndex = index;
            this.updateKeyFocused();
            this.isDirty = true;
        }
    }

    private setKeyDisabled(out: string, disabled: boolean) {
        if (disabled) {
            this.disabledSet.add(out);
            // If the focused key was just disabled, move focus to an adjacent enabled key.
            if (this.renderedKeys[this.focusIndex]?.out === out) {
                const next =
                    this.findNeighbor("up") ??
                    this.findNeighbor("down") ??
                    this.findNeighbor("right") ??
                    this.findNeighbor("left") ??
                    this.renderedKeys.findIndex((k) => this.keyFocusable(k));
                if (next !== undefined && next >= 0) {
                    this.focusIndex = next;
                    this.updateKeyFocused();
                }
            }
        } else {
            this.disabledSet.delete(out);
        }
        this.isDirty = true;
    }

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    handleKey(key: string, press: boolean): boolean {
        if (!press) {
            return false;
        }
        if (this.popup) {
            // Left/right dismiss the pop-up and move the keyboard focus; up/down/OK/back drive the pop-up.
            if (key === "left" || key === "right") {
                this.popup = undefined;
                this.isDirty = true;
            } else {
                return this.handlePopupKey(key);
            }
        }
        switch (key) {
            case "up":
            case "down":
            case "left":
            case "right":
                return this.moveFocus(key);
            case "OK":
                return this.handleOK();
            default:
                return false;
        }
    }

    private moveFocus(dir: NavKeys): boolean {
        let next = this.findNeighbor(dir);
        if (next === undefined) {
            const horiz = dir === "left" || dir === "right";
            const wrap = horiz ? (this.getValueJS("horizWrap") as boolean) : (this.getValueJS("vertWrap") as boolean);
            if (!wrap) {
                return false; // propagate to ancestors
            }
            next = this.findWrap(dir);
        }
        if (next === undefined || next < 0) {
            return false;
        }
        this.focusIndex = next;
        this.updateKeyFocused();
        this.isDirty = true;
        return true;
    }

    /** Finds the nearest focusable key in a direction, or undefined if none. */
    private findNeighbor(dir: NavKeys): number | undefined {
        const cur = this.renderedKeys[this.focusIndex];
        if (!cur) {
            return undefined;
        }
        const cx = cur.x + cur.width / 2;
        const cy = cur.y + cur.height / 2;
        let best: number | undefined;
        let bestScore = Infinity;
        for (let i = 0; i < this.renderedKeys.length; i++) {
            if (i === this.focusIndex || !this.keyFocusable(this.renderedKeys[i])) {
                continue;
            }
            const k = this.renderedKeys[i];
            const dx = k.x + k.width / 2 - cx;
            const dy = k.y + k.height / 2 - cy;
            let primary: number;
            let secondary: number;
            if (dir === "right") {
                if (dx <= 1) continue;
                primary = dx;
                secondary = Math.abs(dy);
            } else if (dir === "left") {
                if (dx >= -1) continue;
                primary = -dx;
                secondary = Math.abs(dy);
            } else if (dir === "down") {
                if (dy <= 1) continue;
                primary = dy;
                secondary = Math.abs(dx);
            } else {
                if (dy >= -1) continue;
                primary = -dy;
                secondary = Math.abs(dx);
            }
            const score = primary + secondary * 4; // weight cross-axis to keep alignment
            if (score < bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    /** Wraps focus to the opposite edge of the grid, aligned to the current key. */
    private findWrap(dir: NavKeys): number | undefined {
        const cur = this.renderedKeys[this.focusIndex];
        if (!cur) {
            return undefined;
        }
        const cx = cur.x + cur.width / 2;
        const cy = cur.y + cur.height / 2;
        let best: number | undefined;
        let bestScore = Infinity;
        for (let i = 0; i < this.renderedKeys.length; i++) {
            if (i === this.focusIndex || !this.keyFocusable(this.renderedKeys[i])) {
                continue;
            }
            const k = this.renderedKeys[i];
            const kx = k.x + k.width / 2;
            const ky = k.y + k.height / 2;
            let primary: number;
            let secondary: number;
            if (dir === "right") {
                primary = kx; // leftmost
                secondary = Math.abs(ky - cy);
            } else if (dir === "left") {
                primary = -kx; // rightmost
                secondary = Math.abs(ky - cy);
            } else if (dir === "down") {
                primary = ky; // topmost
                secondary = Math.abs(kx - cx);
            } else {
                primary = -ky; // bottommost
                secondary = Math.abs(kx - cx);
            }
            const score = primary + secondary * 4;
            if (score < bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    private handleOK(): boolean {
        const key = this.renderedKeys[this.focusIndex];
        if (!key || !this.keyFocusable(key)) {
            return false;
        }
        if (key.suggestions && this.triggersInclude(key, "select")) {
            this.openPopup(key);
            return true;
        }
        this.selectKey(key.out);
        return true;
    }

    // -------------------------------------------------------------------------
    // Suggestion pop-up
    // -------------------------------------------------------------------------

    private triggersInclude(key: RenderedKey, trigger: string): boolean {
        const triggers = key.suggestions?.triggers;
        if (triggers === undefined) {
            return false;
        }
        return Array.isArray(triggers) ? triggers.includes(trigger) : triggers === trigger;
    }

    private openPopup(key: RenderedKey) {
        const opts = key.suggestions?.options;
        const options = opts === undefined ? [] : Array.isArray(opts) ? opts : [opts];
        if (options.length === 0) {
            return;
        }
        this.popup = { options, index: 0, key };
        this.isDirty = true;
    }

    private handlePopupKey(key: string): boolean {
        if (!this.popup) {
            return false;
        }
        switch (key) {
            case "up":
                this.popup.index = Math.max(0, this.popup.index - 1);
                this.isDirty = true;
                return true;
            case "down":
                this.popup.index = Math.min(this.popup.options.length - 1, this.popup.index + 1);
                this.isDirty = true;
                return true;
            case "OK": {
                const choice = this.popup.options[this.popup.index];
                this.popup = undefined;
                // Keep focus on the key but do not let the hover timer reopen the pop-up
                // until the focus leaves and returns to the key.
                this.popupSuppressed = true;
                this.isDirty = true;
                this.selectKey(choice);
                return true;
            }
            default:
                // Only OK and the directional keys drive the pop-up. Everything else (including
                // "back") is left unhandled so it propagates up the scene graph to be handled
                // by an ancestor (e.g. closing the dialog/screen).
                return false;
        }
    }

    // -------------------------------------------------------------------------
    // Palette
    // -------------------------------------------------------------------------

    private getPaletteColor(name: string): number {
        let node: Node | undefined = this;
        while (node) {
            const palette = node.getValue("palette");
            if (palette instanceof Node) {
                const colors = palette.getValue("colors");
                const value = (jsValueOf(colors) as Record<string, unknown>)?.[name];
                if (typeof value === "number") {
                    return value;
                }
            }
            const parent = node.getNodeParent();
            node = parent instanceof Node ? parent : undefined;
        }
        return DEFAULT_PALETTE[name];
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        const standalone = sgRoot.focused === this;
        const showFocus = (this.focusActive || standalone) && (this.getValueJS("focusVisible") as boolean);

        // Auto-open a "hover" suggestion pop-up once the focus has dwelled on the key, unless it
        // was suppressed by a previous selection (until focus leaves and returns to the key).
        if (showFocus && !this.popup && !this.popupSuppressed) {
            const key = this.renderedKeys[this.focusIndex];
            if (
                key?.suggestions &&
                this.triggersInclude(key, "hover") &&
                Date.now() - this.lastFocusTime > this.hoverDelay
            ) {
                this.openPopup(key);
            }
        }

        const primary = this.getPaletteColor("PrimaryTextColor");
        const secondary = this.getPaletteColor("SecondaryItemColor");
        const focusItem = this.getPaletteColor("FocusItemColor");
        const focusColor = this.getPaletteColor("FocusColor");

        // Keyboard background cell artwork (same image as the legacy nodes), at natural size.
        if (this.bmpBackground?.isValid() && this.renderedKeys.length > 0) {
            const bgRect = { x: rect.x, y: rect.y, width: 0, height: 0 };
            this.drawImage(this.bmpBackground, bgRect, 0, opacity, draw2D, this.getPaletteColor("KeyboardColor"));
        }

        for (let i = 0; i < this.renderedKeys.length; i++) {
            const key = this.renderedKeys[i];
            const hasContent = key.label.length > 0 || (key.icon ?? "").length > 0;
            if (!hasContent) {
                continue;
            }
            const disabled = !key.focusable || this.disabledSet.has(key.out);
            const focused = showFocus && i === this.focusIndex;
            const keyRect: Rect = {
                x: rect.x + key.x,
                y: rect.y + key.y,
                width: key.width,
                height: key.height,
            };
            if (focused && this.bmpFocus?.isValid()) {
                // The focus indicator is a halo slightly larger than the key cell (legacy look).
                // Round to whole pixels: the key cells are fractional (even-distribution layout),
                // and a fractional 9-patch rect leaves a seam where the stretched center meets the
                // edges, letting a background cell border show through as a divider line.
                const fx = Math.round(keyRect.x - this.keyFocusDelta);
                const fy = Math.round(keyRect.y - this.keyFocusDelta);
                const focusRect: Rect = {
                    x: fx,
                    y: fy,
                    width: Math.round(keyRect.x + keyRect.width + this.keyFocusDelta) - fx,
                    height: Math.round(keyRect.y + keyRect.height + this.keyFocusDelta) - fy,
                };
                this.drawImage(this.bmpFocus, focusRect, 0, opacity, draw2D, focusColor);
            }
            const color = disabled ? secondary : focused ? focusItem : primary;
            this.renderKeyContent(key, keyRect, color, opacity, i, draw2D);
        }

        if (this.popup) {
            this.renderPopup(rect, primary, focusItem, focusColor, opacity, draw2D);
        }

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    /**
     * Maps a key's strOut to a legacy icon asset name, honoring the current mode for
     * the on/off toggle keys (caps/alphanum/symbols/accents), matching the legacy Keyboard.
     */
    private iconAssetFor(strOut: string): string | undefined {
        const mode = this.mode;
        const upper = mode.endsWith("Upper") || mode.endsWith("Shift");
        const base = mode.startsWith("Symbols") ? "Symbols" : mode.startsWith("Accents") ? "Accents" : "ABC123";
        switch (strOut) {
            case "shift":
                return "shift";
            case "space":
                return "space";
            case "backspace":
                return "delete";
            case "clear":
                return "clear";
            case "left":
                return "moveCursorLeft";
            case "right":
                return "moveCursorRight";
            case "capslock":
                return upper ? "caps_on" : "caps_off";
            case "abc123":
                return base === "ABC123" ? "alphanum_on" : "alphanum_off";
            case "symbols":
                return base === "Symbols" ? "symbols_on" : "symbols_off";
            case "accents":
                return base === "Accents" ? "accent_on" : "accent_off";
            default:
                return undefined;
        }
    }

    private renderKeyContent(
        key: RenderedKey,
        rect: Rect,
        color: number,
        opacity: number,
        index: number,
        draw2D?: IfDraw2D
    ) {
        // Icon keys: prefer the legacy bitmap asset (drawn at natural size), else a glyph.
        if (key.strOut.length > 0 && key.label.length === 0) {
            const iconName = this.iconAssetFor(key.strOut);
            const bmp = iconName ? this.bmpIcons.get(iconName) : undefined;
            if (bmp?.isValid()) {
                const iconX = rect.x + Math.floor((rect.width - bmp.width) / 2);
                const iconY = rect.y + Math.floor((rect.height - bmp.height) / 2);
                this.drawImage(
                    bmp,
                    { x: iconX, y: iconY, width: bmp.width, height: bmp.height },
                    0,
                    opacity,
                    draw2D,
                    color
                );
                return;
            }
            const glyph = resolveKeyIcon(key.strOut)?.glyph ?? key.strOut;
            this.drawText(glyph, this.font, color, opacity, rect, "center", "center", 0, draw2D, "", index);
            return;
        }
        if (key.label.length > 0) {
            this.drawText(key.label, this.font, color, opacity, rect, "center", "center", 0, draw2D, "", index);
        }
    }

    private renderPopup(
        rect: Rect,
        textColor: number,
        focusItem: number,
        focusColor: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.popup) {
            return;
        }
        const key = this.popup.key;
        const lineH = this.resolution === "FHD" ? 54 : 36;
        const padX = this.resolution === "FHD" ? 18 : 12;
        // Width fits the widest option text plus a small side margin.
        let contentWidth = 0;
        const drawFont = this.font.createDrawFont();
        if (drawFont instanceof RoFont) {
            for (const option of this.popup.options) {
                contentWidth = Math.max(contentWidth, drawFont.measureTextWidth(option).width);
            }
        }
        const width = Math.ceil(contentWidth) + padX * 2;
        const totalH = this.popup.options.length * lineH;
        // Anchor the pop-up to the bottom-left of the key's focus indicator and extend upward,
        // so it covers the focused key while shown; clamp to the top edge if needed.
        const x = rect.x + key.x - this.keyFocusDelta;
        let y = rect.y + key.y + key.height + this.keyFocusDelta - totalH;
        if (y < 0) {
            y = 0;
        }
        // Per spec: pop-up background uses FocusColor; the focused option is highlighted
        // with FocusItemColor (its label drawn in PrimaryTextColor); other labels use FocusItemColor.
        draw2D?.doDrawRotatedRect({ x, y, width, height: totalH }, focusColor, 0, [0, 0], opacity);
        for (let i = 0; i < this.popup.options.length; i++) {
            const itemRect: Rect = { x, y: y + i * lineH, width, height: lineH };
            const focused = i === this.popup.index;
            if (focused) {
                draw2D?.doDrawRotatedRect(itemRect, focusItem, 0, [0, 0], opacity);
            }
            const labelRect: Rect = { x: x + padX, y: itemRect.y, width: width - padX * 2, height: lineH };
            this.drawText(
                this.popup.options[i],
                this.font,
                focused ? textColor : focusItem,
                opacity,
                labelRect,
                "left",
                "center",
                0,
                draw2D,
                "",
                1000 + i
            );
        }
    }
}
