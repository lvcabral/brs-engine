const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, RoArray, RoAssociativeArray } = core;

const fakeInterpreter = {};

/**
 * Builds an RSGPalette node from a name→color map. A number is stored as an integer color, a
 * BrsString as a hex-string color — so a single helper covers both storage forms a palette may use.
 */
function makePalette(colors) {
    const members = Object.entries(colors).map(([name, value]) => ({
        name: new BrsString(name),
        // Colors are 32-bit; store as signed (`| 0`) so a high-alpha value isn't clamped by Int32.
        value: typeof value === "number" ? new Int32(value | 0) : value,
    }));
    const palette = SGNodeFactory.createNode("RSGPalette");
    palette.setValue("colors", new RoAssociativeArray(members));
    return palette;
}

/** Builds a jumpToKey array value [section, row, key]. */
function coords(section, row, key) {
    return new RoArray([new Int32(section), new Int32(row), new Int32(key)]);
}

/** Reads the text currently entered in a keyboard. */
function textOf(node) {
    return node.getValueJS("text");
}

describe("Dynamic voice keyboards", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    describe("factory wiring", () => {
        const types = [
            "DynamicKeyGrid",
            "DynamicKeyboard",
            "DynamicMiniKeyboard",
            "DynamicPinPad",
            "DynamicCustomKeyboard",
        ];
        for (const type of types) {
            test(`creates ${type}`, () => {
                const node = SGNodeFactory.createNode(type);
                expect(node).toBeDefined();
                expect(node.constructor.name).toBe(type);
                expect(node.nodeSubtype).toBe(type);
            });
        }
    });

    describe("DynamicKeyGrid default fields", () => {
        test("exposes the documented fields and defaults", () => {
            const grid = SGNodeFactory.createNode("DynamicKeyGrid");
            const fields = grid.getNodeFields();
            const expected = [
                ["keyDefinitionUri", "string", ""], // "uri" fields are stored as the String kind
                ["mode", "string", ""],
                ["focusVisible", "boolean", true],
                ["horizWrap", "boolean", false],
                ["vertWrap", "boolean", false],
                ["keyFocused", "string", ""],
                ["keySelected", "string", ""],
            ];
            for (const [name, type, value] of expected) {
                const field = fields.get(name.toLowerCase());
                expect(field).toBeDefined();
                expect(field.getType()).toBe(type);
                expect(grid.getValueJS(name)).toBe(value);
            }
        });
    });

    describe("DynamicKeyboardBase fields", () => {
        test("DynamicKeyboard exposes text, hideTextBox, domain and child nodes", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            expect(kbd.getValueJS("text")).toBe("");
            expect(kbd.getValueJS("hideTextBox")).toBe(false);
            expect(kbd.getValueJS("domain")).toBe("generic");
            expect(kbd.textEditBox.constructor.name).toBe("VoiceTextEditBox");
            expect(kbd.keyGrid.constructor.name).toBe("DynamicKeyGrid");
        });

        test("subclass VoiceTextEditBox defaults match the spec", () => {
            const cases = [
                ["DynamicKeyboard", "alphanumeric", 75],
                ["DynamicMiniKeyboard", "alphanumeric", 75],
                ["DynamicPinPad", "numeric", 4],
                ["DynamicCustomKeyboard", "generic", 75],
            ];
            for (const [type, voiceEntryType, maxLen] of cases) {
                const kbd = SGNodeFactory.createNode(type);
                expect(kbd.textEditBox.getValueJS("voiceEntryType")).toBe(voiceEntryType);
                expect(kbd.textEditBox.getValueJS("voiceEnabled")).toBe(true);
                expect(kbd.textEditBox.getValueJS("maxTextLength")).toBe(maxLen);
            }
        });

        test("all dynamic keyboards expose a palette node field that defaults to invalid", () => {
            for (const type of ["DynamicKeyboard", "DynamicMiniKeyboard", "DynamicPinPad", "DynamicCustomKeyboard"]) {
                const kbd = SGNodeFactory.createNode(type);
                const field = kbd.getNodeFields().get("palette");
                expect(field).toBeDefined();
                expect(field.getType()).toBe("node");
                expect(kbd.getValueJS("palette")).toBeNull();
                expect(kbd.getValue("palette").constructor.name).toBe("RoInvalid");
            }
        });

        test("a palette set on the keyboard themes its key grid via the shared Node resolution", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            const palette = makePalette({ PrimaryTextColor: 0x112233ff, FocusItemColor: 0x445566ff });
            kbd.setValue("palette", palette);
            // The key grid is a child of the keyboard, so Node.resolvePaletteColor walks up from the
            // grid, finds the keyboard-level palette, and returns its colors (integer or hex-string).
            expect(kbd.keyGrid.getNodeParent()).toBe(kbd);
            expect(kbd.keyGrid.resolvePaletteColor("PrimaryTextColor", 0xffffffff)).toBe(0x112233ff);
            expect(kbd.keyGrid.resolvePaletteColor("FocusItemColor", 0xffffffff)).toBe(0x445566ff);
            // A color the palette doesn't define falls back to the caller's default.
            expect(kbd.keyGrid.resolvePaletteColor("KeyboardColor", 0xabcdef12)).toBe(0xabcdef12);
        });

        test("resolvePaletteColor accepts hex-string palette values", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.setValue("palette", makePalette({ FocusColor: new BrsString("#0A0B0CFF") }));
            expect(kbd.keyGrid.resolvePaletteColor("FocusColor", 0xffffffff)).toBe(0x0a0b0cff);
        });

        test("rendering themes the text box from the resolved palette, with a fallback", () => {
            const draw2D = {
                doDrawRotatedText() {},
                doDrawScaledObject() {},
                doDrawRotatedBitmap() {},
                drawNinePatch() {},
                doDrawRotatedRect() {},
            };
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            sgRoot.setFocused(kbd);
            const textColor = () => kbd.textEditBox.getValueJS("textColor") >>> 0;

            // No palette anywhere: the text box keeps its own default textColor untouched.
            kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            expect(textColor()).toBe(0xddddddff);

            // A palette defining PrimaryTextColor themes the typed text to match the keys.
            kbd.setValue("palette", makePalette({ PrimaryTextColor: 0x223344ff }));
            kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            expect(textColor()).toBe(0x223344ff);

            // A palette present but missing PrimaryTextColor falls back to the default keyboard color.
            kbd.setValue("palette", makePalette({ FocusColor: 0x010203ff }));
            kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            expect(textColor()).toBe(0xffffffff);
        });

        test("PIN pad digits are themed by the palette PrimaryTextColor", () => {
            const draw2D = {
                doDrawRotatedText() {},
                doDrawScaledObject() {},
                doDrawRotatedBitmap() {},
                drawNinePatch() {},
                doDrawRotatedRect() {},
            };
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            sgRoot.setFocused(pad);
            pad.setValue("palette", makePalette({ PrimaryTextColor: 0x99aabbff }));
            pad.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            // The PIN slots/digits read the same textColor field the palette themes. 0x99AABBFF has a
            // high top byte, so this also covers the signed-color path (no Int32 clamping).
            expect(pad.textEditBox.getValueJS("textColor") >>> 0).toBe(0x99aabbff);
        });
    });

    describe("DynamicPinPad", () => {
        test("key grid matches the legacy keyboard_pinpad size (HD)", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            expect(pad.keyGrid.getValueJS("width")).toBe(272);
            expect(pad.keyGrid.getValueJS("height")).toBe(252);
        });

        test("navigation updates keyFocused across the 3x4 grid", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            const grid = pad.keyGrid;
            expect(grid.getValueJS("keyFocused")).toBe("1");
            pad.handleKey("right", true);
            expect(grid.getValueJS("keyFocused")).toBe("2");
            pad.handleKey("down", true);
            expect(grid.getValueJS("keyFocused")).toBe("5");
        });

        test("selecting digit keys enters numbers and caps at maxTextLength", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            // Focus "1" and select it five times; only four digits should be accepted.
            for (let i = 0; i < 5; i++) {
                pad.keyGrid.setValue("jumpToKey", coords(0, 0, 0)); // key "1"
                pad.handleKey("OK", true);
            }
            expect(textOf(pad)).toBe("1111");
        });

        test("clear and backspace keys edit the entry", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            pad.keyGrid.setValue("jumpToKey", coords(0, 0, 1)); // "2"
            pad.handleKey("OK", true);
            pad.keyGrid.setValue("jumpToKey", coords(0, 1, 0)); // "4"
            pad.handleKey("OK", true);
            expect(textOf(pad)).toBe("24");
            pad.keyGrid.setValue("jumpToKey", coords(0, 3, 2)); // backspace
            pad.handleKey("OK", true);
            expect(textOf(pad)).toBe("2");
            pad.keyGrid.setValue("jumpToKey", coords(0, 3, 0)); // clear
            pad.handleKey("OK", true);
            expect(textOf(pad)).toBe("");
        });

        test("ignores non-digit literal keys", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            expect(pad.handleKey("Lit_a", true)).toBe(false);
            expect(textOf(pad)).toBe("");
            pad.handleKey("Lit_7", true);
            expect(textOf(pad)).toBe("7");
        });
    });

    describe("DynamicMiniKeyboard", () => {
        test("selecting letters, space and clear edits the text", () => {
            const mini = SGNodeFactory.createNode("DynamicMiniKeyboard");
            mini.keyGrid.setValue("jumpToKey", coords(0, 0, 0)); // "a"
            mini.handleKey("OK", true);
            mini.keyGrid.setValue("jumpToKey", coords(0, 0, 1)); // "b"
            mini.handleKey("OK", true);
            expect(textOf(mini)).toBe("ab");
            mini.keyGrid.setValue("jumpToKey", coords(0, 6, 1)); // space
            mini.handleKey("OK", true);
            expect(textOf(mini)).toBe("ab ");
            mini.keyGrid.setValue("jumpToKey", coords(0, 6, 0)); // clear
            mini.handleKey("OK", true);
            expect(textOf(mini)).toBe("");
        });
    });

    describe("DynamicKeyboard", () => {
        test("starts in ABC123Lower mode and inserts lowercase letters", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            expect(kbd.keyGrid.getValueJS("mode")).toBe("ABC123Lower");
            kbd.keyGrid.setValue("jumpToKey", coords(1, 0, 0)); // "a"
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe("a");
        });

        test("capslock toggles to uppercase and inserts uppercase letters", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.keyGrid.setValue("jumpToKey", coords(3, 0, 0)); // capslock toggle (section 4)
            kbd.handleKey("OK", true);
            expect(kbd.keyGrid.getValueJS("mode")).toBe("ABC123Upper");
            kbd.keyGrid.setValue("jumpToKey", coords(1, 0, 0)); // "A"
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe("A");
        });

        test("symbols toggle switches the mode", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.keyGrid.setValue("jumpToKey", coords(3, 2, 0)); // symbols toggle
            kbd.handleKey("OK", true);
            expect(kbd.keyGrid.getValueJS("mode")).toBe("SymbolsLower");
        });

        test("the @ key opens a suggestions pop-up that can be selected", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // "@" with suggestions
            expect(kbd.keyGrid.getValueJS("keyFocused")).toBe("@");
            // First OK opens the pop-up without inserting; second OK picks the first option.
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe("");
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe("@gmail.com");
        });

        test("the @ suggestions include a plain @ as the last (bottom) option", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0));
            kbd.handleKey("OK", true); // open pop-up (index 0)
            for (let i = 0; i < 5; i++) kbd.handleKey("down", true); // move to the last option
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe("@");
        });

        test("left/right dismiss the pop-up and move the keyboard focus", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // "@"
            kbd.handleKey("OK", true); // open pop-up
            kbd.handleKey("right", true); // should close pop-up and move focus to "."
            expect(textOf(kbd)).toBe("");
            expect(kbd.keyGrid.getValueJS("keyFocused")).toBe(".");
            // With the pop-up dismissed, OK now selects the focused "." key.
            kbd.handleKey("OK", true);
            expect(textOf(kbd)).toBe(".");
        });

        // Opens the @ pop-up and returns the focus-indicator rect and the largest pop-up panel rect.
        function capturePopup(kbd) {
            let focus = null;
            let panel = null;
            const draw2D = {
                doDrawRotatedText() {},
                doDrawRotatedRect(rect) {
                    if (panel === null || rect.height > panel.height) panel = { ...rect };
                },
                drawNinePatch(obj, rect) {
                    const n = obj && typeof obj.getImageName === "function" ? obj.getImageName() : "";
                    if (n && n.includes("focus_keyboard") && focus === null) focus = { ...rect };
                },
                doDrawScaledObject() {},
                doDrawRotatedBitmap() {},
            };
            kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            return { focus, panel };
        }

        test("the @ pop-up is anchored to the bottom-left of the focus indicator", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            sgRoot.setFocused(kbd);
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0));
            kbd.handleKey("OK", true); // open pop-up
            const { focus, panel } = capturePopup(kbd);
            expect(focus).not.toBeNull();
            expect(panel).not.toBeNull();
            // Pop-up left edge matches the focus indicator's left edge...
            expect(Math.abs(panel.x - focus.x)).toBeLessThanOrEqual(1);
            // ...and the pop-up bottom matches the focus indicator's bottom (covering the key).
            expect(Math.abs(panel.y + panel.height - (focus.y + focus.height))).toBeLessThanOrEqual(1);
            // It extends upward above the key.
            expect(panel.y).toBeLessThan(focus.y);
        });

        test("the @ pop-up width fits the content (much narrower than the keyboard)", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            sgRoot.setFocused(kbd);
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0));
            kbd.handleKey("OK", true);
            const { panel } = capturePopup(kbd);
            expect(panel.width).toBeGreaterThan(0);
            expect(panel.width).toBeLessThan(kbd.keyGrid.getValueJS("width") / 3);
        });

        test("the @ pop-up auto-opens via the hover timer once the focus dwells on the key", () => {
            let now = 1000;
            const spy = jest.spyOn(Date, "now").mockImplementation(() => now);
            try {
                const kbd = SGNodeFactory.createNode("DynamicKeyboard");
                sgRoot.setFocused(kbd);
                kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // focus "@" at t=1000
                expect(capturePopup(kbd).panel).toBeNull(); // no dwell yet
                now = 3000; // dwell past the hover delay
                expect(capturePopup(kbd).panel).not.toBeNull();
            } finally {
                spy.mockRestore();
            }
        });

        test("the pop-up does not handle back (propagates up) and stays open", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            sgRoot.setFocused(kbd);
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // "@"
            kbd.handleKey("OK", true); // open the pop-up
            // back is not consumed by the pop-up: it returns false so an ancestor can handle it,
            // and the pop-up remains open.
            expect(kbd.handleKey("back", true)).toBe(false);
            expect(capturePopup(kbd).panel).not.toBeNull();
        });

        test("after selecting an option the timer is suppressed until focus leaves and returns", () => {
            let now = 1000;
            const spy = jest.spyOn(Date, "now").mockImplementation(() => now);
            try {
                const kbd = SGNodeFactory.createNode("DynamicKeyboard");
                sgRoot.setFocused(kbd);
                kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // focus "@"
                kbd.handleKey("OK", true); // open
                kbd.handleKey("OK", true); // select first option -> closes + suppresses
                expect(textOf(kbd)).toBe("@gmail.com");
                now = 9000; // even well past the dwell, the timer stays suppressed
                expect(capturePopup(kbd).panel).toBeNull();
                // Pressing OK again on the key still re-opens it explicitly.
                kbd.handleKey("OK", true);
                expect(capturePopup(kbd).panel).not.toBeNull();
                kbd.handleKey("left", true); // directional key closes the pop-up and moves focus away

                // Returning to "@" restarts the dwell timer (suppression cleared on focus change).
                kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // back to "@" at t=9000
                expect(capturePopup(kbd).panel).toBeNull(); // dwell restarted
                now = 11000;
                expect(capturePopup(kbd).panel).not.toBeNull();
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe("rendering", () => {
        // A stub draw surface that records nothing but must never be dereferenced incorrectly.
        const draw2D = {
            doDrawRotatedText() {},
            doDrawScaledObject() {},
            doDrawRotatedBitmap() {},
            doDrawRotatedRect() {},
            drawNinePatch() {},
        };

        for (const type of ["DynamicKeyboard", "DynamicMiniKeyboard", "DynamicPinPad"]) {
            test(`${type} renders while focused without throwing`, () => {
                const kbd = SGNodeFactory.createNode(type);
                sgRoot.setFocused(kbd);
                expect(() => kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
            });
        }

        // Captures the URIs of every bitmap drawn during a render.
        function drawnImageNames(node) {
            const names = [];
            const record = (...args) => {
                const bmp = args.find((a) => a && typeof a.getImageName === "function");
                if (bmp) names.push(bmp.getImageName());
            };
            const capture = {
                doDrawRotatedText() {},
                doDrawRotatedRect() {},
                doDrawScaledObject: record,
                doDrawRotatedBitmap: record,
                drawNinePatch: record,
            };
            sgRoot.setFocused(node);
            node.renderNode(fakeInterpreter, [0, 0], 0, 1, capture);
            return names;
        }

        const backgrounds = [
            ["DynamicKeyboard", "keyboard_full"],
            ["DynamicMiniKeyboard", "keyboard_mini"],
            ["DynamicPinPad", "keyboard_pinpad"],
        ];
        for (const [type, bg] of backgrounds) {
            test(`${type} draws the legacy ${bg} background`, () => {
                const names = drawnImageNames(SGNodeFactory.createNode(type));
                expect(names.some((n) => n.includes(bg))).toBe(true);
            });
        }

        test("DynamicCustomKeyboard draws no keyboard background until a KDF is set", () => {
            const names = drawnImageNames(SGNodeFactory.createNode("DynamicCustomKeyboard"));
            expect(names.some((n) => n.includes("keyboard_"))).toBe(false);
        });

        test("DynamicPinPad renders entered digits as underline slots", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            sgRoot.setFocused(pad);
            pad.keyGrid.setValue("jumpToKey", coords(0, 0, 0));
            pad.handleKey("OK", true); // enter "1"
            expect(() => pad.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
        });

        test("DynamicPinPad text box defaults to secure mode", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            expect(pad.textEditBox.getValueJS("secureMode")).toBe(true);
        });

        test("DynamicPinPad pin slots are a compact group centered in the box", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            sgRoot.setFocused(pad);
            const boxWidth = pad.textEditBox.getValueJS("width");
            const rects = [];
            const cap = {
                doDrawRotatedRect(r) {
                    rects.push({ ...r });
                },
                doDrawRotatedText() {},
                doDrawScaledObject() {},
                doDrawRotatedBitmap() {},
                drawNinePatch() {},
            };
            pad.textEditBox.renderNode(fakeInterpreter, [0, 0], 0, 1, cap);
            expect(rects.length).toBe(4); // one underline per pin slot
            const left = Math.min(...rects.map((r) => r.x));
            const right = Math.max(...rects.map((r) => r.x + r.width));
            // The group is compact (not spread across the whole box) and horizontally centered.
            expect(right - left).toBeLessThan(boxWidth * 0.6);
            expect(Math.abs((left + right) / 2 - boxWidth / 2)).toBeLessThanOrEqual(2);
        });

        test("DynamicKeyboard renders an open suggestions pop-up without throwing", () => {
            const kbd = SGNodeFactory.createNode("DynamicKeyboard");
            sgRoot.setFocused(kbd);
            kbd.keyGrid.setValue("jumpToKey", coords(2, 3, 0)); // "@"
            kbd.handleKey("OK", true); // open the pop-up
            expect(() => kbd.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
        });
    });

    describe("alignment with legacy keyboards", () => {
        // Renders a node and records each glyph position plus the keyboard background origin.
        function captureLayout(node) {
            const glyphs = {};
            let bg = null;
            const draw2D = {
                doDrawRotatedText(text, x, y) {
                    if (glyphs[text] === undefined) glyphs[text] = { x, y };
                },
                doDrawScaledObject(x, y, sx, sy, obj) {
                    const n = obj && typeof obj.getImageName === "function" ? obj.getImageName() : "";
                    if (n && n.includes("keyboard_")) bg = { x, y };
                },
                doDrawRotatedBitmap() {},
                drawNinePatch() {},
                doDrawRotatedRect() {},
            };
            sgRoot.setFocused(node);
            node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            return { glyphs, bg };
        }

        // Asserts the dynamic node draws the given chars at the same offset from the
        // background origin as the legacy node (i.e. centered on the same cells).
        function expectAligned(legacyType, dynamicType, chars) {
            const legacy = captureLayout(SGNodeFactory.createNode(legacyType));
            const dynamic = captureLayout(SGNodeFactory.createNode(dynamicType));
            expect(legacy.bg).not.toBeNull();
            expect(dynamic.bg).not.toBeNull();
            for (const ch of chars) {
                expect(legacy.glyphs[ch]).toBeDefined();
                expect(dynamic.glyphs[ch]).toBeDefined();
                const lx = legacy.glyphs[ch].x - legacy.bg.x;
                const ly = legacy.glyphs[ch].y - legacy.bg.y;
                const dx = dynamic.glyphs[ch].x - dynamic.bg.x;
                const dy = dynamic.glyphs[ch].y - dynamic.bg.y;
                expect(Math.abs(lx - dx)).toBeLessThanOrEqual(6);
                expect(Math.abs(ly - dy)).toBeLessThanOrEqual(6);
            }
        }

        test("DynamicKeyboard keys align with the legacy Keyboard cells", () => {
            expectAligned("Keyboard", "DynamicKeyboard", ["a", "g", "m", "5"]);
        });

        test("DynamicMiniKeyboard keys align with the legacy MiniKeyboard cells", () => {
            expectAligned("MiniKeyboard", "DynamicMiniKeyboard", ["a", "m", "5"]);
        });

        test("DynamicPinPad keys align with the legacy PinPad cells", () => {
            expectAligned("PinPad", "DynamicPinPad", ["1", "5", "9", "0"]);
        });

        // Captures the focus-indicator rect and the keyboard background origin.
        function captureFocus(node, prepare) {
            let bg = null;
            let focus = null;
            const draw2D = {
                doDrawRotatedText() {},
                doDrawRotatedRect() {},
                doDrawScaledObject(x, y, sx, sy, obj) {
                    const n = obj && typeof obj.getImageName === "function" ? obj.getImageName() : "";
                    if (n && n.includes("keyboard_full")) bg = { x, y };
                },
                drawNinePatch(obj, rect) {
                    const n = obj && typeof obj.getImageName === "function" ? obj.getImageName() : "";
                    if (n && n.includes("focus_keyboard") && focus === null) focus = { ...rect };
                },
                doDrawRotatedBitmap() {},
            };
            sgRoot.setFocused(node);
            if (prepare) prepare(node);
            node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            return { bg, focus };
        }

        test("the left sidebar focus aligns with the legacy Keyboard (default-focused key)", () => {
            // Both nodes default the focus to the top-left sidebar key.
            const legacy = captureFocus(SGNodeFactory.createNode("Keyboard"));
            const dynamic = captureFocus(SGNodeFactory.createNode("DynamicKeyboard"));
            expect(legacy.focus).not.toBeNull();
            expect(dynamic.focus).not.toBeNull();
            expect(Math.abs(legacy.focus.x - legacy.bg.x - (dynamic.focus.x - dynamic.bg.x))).toBeLessThanOrEqual(6);
        });

        test("the focus indicator is drawn on whole pixels at FHD (no 9-patch seam line)", () => {
            // At FHD the row height is fractional (333/4 = 83.25); a fractional 9-patch rect
            // leaves a seam where the stretched center meets the edge, showing a background
            // cell border as a divider line. The focus rect must be rounded to whole pixels.
            const prev = sgRoot.scene;
            const scene = SGNodeFactory.createNode("Scene");
            sgRoot.setScene(scene);
            scene.setResolution("FHD");
            try {
                const kbd = SGNodeFactory.createNode("DynamicKeyboard");
                const { focus } = captureFocus(kbd, (n) => n.keyGrid.setValue("jumpToKey", coords(2, 1, 1))); // "5"
                expect(focus).not.toBeNull();
                for (const v of [focus.x, focus.y, focus.width, focus.height]) {
                    expect(Number.isInteger(v)).toBe(true);
                }
            } finally {
                sgRoot.setScene(prev ?? SGNodeFactory.createNode("Scene")); // restore HD scene
            }
        });

        test("the right toggle focus aligns with the legacy Keyboard", () => {
            // Legacy wraps from col 0 to the right toggle column with one left press.
            const legacy = captureFocus(SGNodeFactory.createNode("Keyboard"), (n) => n.handleKey("left", true));
            const dynamic = captureFocus(SGNodeFactory.createNode("DynamicKeyboard"), (n) =>
                n.keyGrid.setValue("jumpToKey", coords(3, 0, 0))
            );
            expect(legacy.focus).not.toBeNull();
            expect(dynamic.focus).not.toBeNull();
            const legacyRight = legacy.focus.x - legacy.bg.x + legacy.focus.width;
            const dynamicRight = dynamic.focus.x - dynamic.bg.x + dynamic.focus.width;
            expect(Math.abs(legacyRight - dynamicRight)).toBeLessThanOrEqual(6);
        });
    });

    describe("DynamicKeyGrid focus management", () => {
        test("disabling the focused key moves focus to an adjacent key", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            const grid = pad.keyGrid;
            expect(grid.getValueJS("keyFocused")).toBe("1");
            grid.setValue("disableKey", new BrsString("1"));
            expect(grid.getValueJS("keyFocused")).not.toBe("1");
        });

        test("horizontal arrows return false at the edge without wrap", () => {
            const pad = SGNodeFactory.createNode("DynamicPinPad");
            // focus is on "1" (top-left); moving left is unhandled and propagates.
            expect(pad.keyGrid.handleKey("left", true)).toBe(false);
        });
    });
});
