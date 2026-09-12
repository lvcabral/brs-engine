/**
 * Built-in Key Definition Files for the fixed-layout Dynamic keyboards.
 *
 * Transcribed from the Roku reference KDF examples
 * (`scenegraph/dynamic-voice-keyboard-nodes/key-definition-file.md`), including its `theme:*`
 * icon identifiers verbatim — the same ones real device KDFs use (e.g. Roku's own
 * dynamic-voice-enabled-keyboards sample app). The engine maps each to a bundled substitute
 * bitmap (`DynamicKeyGrid.THEME_ICON_ALIASES`/`resolveIcon()`) since it doesn't ship Roku's
 * actual system theme graphics.
 */
import { KeyLayout } from "./KeyDefinition";

const clearKey = { icon: "theme:DKB_ClearKeyBitmap", focusIcon: "theme:DKB_ClearKeyFocusBitmap", strOut: "clear" };
const spaceKey = { icon: "theme:DKB_SpaceKeyBitmap", focusIcon: "theme:DKB_SpaceKeyFocusBitmap", strOut: "space" };
const deleteKey = {
    icon: "theme:DKB_DeleteKeyBitmap",
    focusIcon: "theme:DKB_DeleteKeyFocusBitmap",
    autoRepeat: 1,
    strOut: "backspace",
};

/** DynamicPinPad — single numeric 3×4 grid (1-9, clear/0/backspace). Sized to the legacy keyboard_pinpad.png. */
export const dynamicPinPadKDF: KeyLayout = {
    keyboardWidthFHD: 408,
    keyboardHeightFHD: 378,
    keyboardWidthHD: 272,
    keyboardHeightHD: 252,
    sections: [
        {
            grids: [
                {
                    rows: [
                        { keys: [{ label: "1" }, { label: "2" }, { label: "3" }] },
                        { keys: [{ label: "4" }, { label: "5" }, { label: "6" }] },
                        { keys: [{ label: "7" }, { label: "8" }, { label: "9" }] },
                        { keys: [clearKey, { label: "0" }, deleteKey] },
                    ],
                },
            ],
        },
    ],
};

/** DynamicMiniKeyboard — 6×6 a-z/0-9 grid plus a clear/space/backspace row. Sized to the legacy keyboard_mini.png. */
export const dynamicMiniKeyboardKDF: KeyLayout = {
    keyboardWidthFHD: 582,
    keyboardHeightFHD: 627,
    keyboardWidthHD: 388,
    keyboardHeightHD: 418,
    sections: [
        {
            grids: [
                {
                    rows: [
                        { keys: "abcdef".split("").map((label) => ({ label })) },
                        { keys: "ghijkl".split("").map((label) => ({ label })) },
                        { keys: "mnopqr".split("").map((label) => ({ label })) },
                        { keys: "stuvwx".split("").map((label) => ({ label })) },
                        { keys: "yz1234".split("").map((label) => ({ label })) },
                        { keys: "567890".split("").map((label) => ({ label })) },
                        { keys: [clearKey, spaceKey, deleteKey] },
                    ],
                },
            ],
        },
    ],
};

// Helper to turn a string of single-character labels into a row of keys.
const lblRow = (chars: string) => ({ keys: chars.split("").map((label) => ({ label })) });
// Same, but from an explicit array (for rows containing quotes/backslashes).
const rowOf = (labels: string[]) => ({ keys: labels.map((label) => ({ label })) });
// A mode-toggle sidebar key (caps/abc123/symbols/accents), themed with Roku's DKB_*Mod{On,Off}
// icon pair for the given on/off state.
const modKey = (base: string, on: boolean, strOut: string) => {
    const state = on ? "On" : "Off";
    return {
        icon: `theme:DKB_${base}Mod${state}KeyBitmap`,
        focusIcon: `theme:DKB_${base}Mod${state}KeyFocusBitmap`,
        strOut,
    };
};
// The four mode-toggle sidebar rows (caps / abc123 / symbols / accents) for one mode-group grid:
// `caps` is the caps-lock state and `active` names which of the three character sets is showing
// (so its icon is "on" and the other two are "off").
const sidebarRows = (caps: boolean, active: "ABC123" | "Symbols" | "Accents") => [
    { keys: [modKey("Caps", caps, "capslock")] },
    { keys: [modKey("ABC123", active === "ABC123", "abc123")] },
    { keys: [modKey("Symbols", active === "Symbols", "symbols")] },
    { keys: [modKey("Accents", active === "Accents", "accents")] },
];

/**
 * DynamicKeyboard — full WiFi-style keyboard matching the legacy Keyboard layout.
 * Four sections: modifier sidebar, alpha grids (ABC123/Symbols/Accents × Lower/Upper),
 * numeric+symbol grid, and a mode-toggle sidebar.
 */
export const dynamicKeyboardKDF: KeyLayout = {
    keyboardWidthFHD: 1395,
    keyboardHeightFHD: 363,
    keyboardWidthHD: 930,
    keyboardHeightHD: 242,
    sections: [
        // Section 1: shift / space / delete / left-right modifier sidebar (shared across modes).
        {
            sectionWidthFHD: 184,
            sectionWidthHD: 121,
            grids: [
                {
                    rows: [
                        {
                            keys: [
                                {
                                    icon: "theme:DKB_ShiftKeyBitmap",
                                    focusIcon: "theme:DKB_ShiftKeyFocusBitmap",
                                    strOut: "shift",
                                },
                            ],
                        },
                        { keys: [spaceKey] },
                        { keys: [deleteKey] },
                        {
                            keys: [
                                {
                                    icon: "theme:DKB_LeftKeyBitmap",
                                    focusIcon: "theme:DKB_LeftKeyFocusBitmap",
                                    strOut: "left",
                                },
                                {
                                    icon: "theme:DKB_RightKeyBitmap",
                                    focusIcon: "theme:DKB_RightKeyFocusBitmap",
                                    strOut: "right",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        // Section 2: the main alpha/symbol/accent character grids.
        {
            sectionWidthFHD: 637,
            sectionWidthHD: 422,
            grids: [
                { modes: "ABC123Lower", rows: ["abcdefg", "hijklmn", "opqrstu", "vwxyz-_"].map(lblRow) },
                {
                    modes: ["ABC123Upper", "ABC123Shift"],
                    rows: ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ-_"].map(lblRow),
                },
                {
                    modes: "SymbolsLower",
                    rows: [
                        lblRow("!?*#$%^"),
                        rowOf(["&", ",", ":", ";", "`", "'", '"']),
                        lblRow("(){}[]~"),
                        rowOf(["¡", "¿", "<", ">", "|", "\\", "/"]),
                    ],
                },
                {
                    modes: ["SymbolsUpper", "SymbolsShift"],
                    rows: [lblRow("•·¢£¥€§"), lblRow("®©™«»‹›"), lblRow("†‡ƒ¶¹²³"), lblRow("º°ª…")],
                },
                {
                    modes: "AccentsLower",
                    rows: [lblRow("àáâãäåæ"), lblRow("èéêëìíî"), lblRow("ïòóôõöø"), lblRow("œùúûüçñ")],
                },
                {
                    modes: ["AccentsUpper", "AccentsShift"],
                    rows: [lblRow("ÀÁÂÃÄÅÆ"), lblRow("ÈÉÊËÌÍÎ"), lblRow("ÏÒÓÔÕÖØ"), lblRow("ŒÙÚÛÜÇÑ")],
                },
            ],
        },
        // Section 3: numeric keypad / extra symbols.
        {
            sectionWidthFHD: 272,
            sectionWidthHD: 180,
            grids: [
                {
                    modes: ["ABC123Lower", "ABC123Upper", "ABC123Shift"],
                    rows: [
                        lblRow("123"),
                        lblRow("456"),
                        lblRow("789"),
                        {
                            keys: [
                                {
                                    label: "@",
                                    suggestions: {
                                        options: [
                                            "@gmail.com",
                                            "@yahoo.com",
                                            "@outlook.com",
                                            "@aol.com",
                                            "@icloud.com",
                                            "@",
                                        ],
                                        triggers: ["hover", "select"],
                                    },
                                },
                                { label: "." },
                                { label: "0" },
                            ],
                        },
                    ],
                },
                {
                    modes: "SymbolsLower",
                    rows: [lblRow("´ˆ˜"), lblRow("¨¯¸"), lblRow("=+×"), lblRow("÷±‰")],
                },
                {
                    modes: ["SymbolsUpper", "SymbolsShift"],
                    rows: [lblRow("¼½¾"), lblRow("“”„"), lblRow("‘’‚"), lblRow("–—")],
                },
                {
                    modes: "AccentsLower",
                    rows: [lblRow("ýÿš"), lblRow("žðþ"), lblRow("ß")],
                },
                {
                    modes: ["AccentsUpper", "AccentsShift"],
                    rows: [lblRow("ÝŸŠ"), lblRow("ŽÐÞ")],
                },
            ],
        },
        // Section 4: mode-toggle sidebar (caps / abc123 / symbols / accents). Each grid's icons
        // reflect that mode's on/off state directly (one grid per mode group, matching Roku's
        // WiFi-keyboard reference KDF sample), so the renderer needs no mode-aware icon logic.
        {
            sectionWidthFHD: 181,
            sectionWidthHD: 120,
            grids: [
                { modes: ["ABC123Lower", "ABC123Shift"], rows: sidebarRows(false, "ABC123") },
                { modes: "ABC123Upper", rows: sidebarRows(true, "ABC123") },
                { modes: ["SymbolsLower", "SymbolsShift"], rows: sidebarRows(false, "Symbols") },
                { modes: "SymbolsUpper", rows: sidebarRows(true, "Symbols") },
                { modes: ["AccentsLower", "AccentsShift"], rows: sidebarRows(false, "Accents") },
                { modes: "AccentsUpper", rows: sidebarRows(true, "Accents") },
            ],
        },
    ],
};
