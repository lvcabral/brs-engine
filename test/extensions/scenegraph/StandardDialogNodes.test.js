const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, BrsBoolean, RoArray, RoAssociativeArray } = core;

/** Builds an RSGPalette node with the given name→hex color map. */
function makePalette(colors) {
    const palette = SGNodeFactory.createNode("RSGPalette");
    const members = Object.entries(colors).map(([name, hex]) => ({
        name: new BrsString(name),
        value: new BrsString(hex),
    }));
    palette.setValue("colors", new RoAssociativeArray(members));
    return palette;
}

/** Depth-first search for the first descendant whose constructor name matches. */
function findDescendant(node, typeName) {
    for (const child of node.getNodeChildren()) {
        if (child.constructor.name === typeName) {
            return child;
        }
        const found = findDescendant(child, typeName);
        if (found) {
            return found;
        }
    }
    return undefined;
}

const EXPECTED_PIN_KEY = "brs.parentalControlPin";

/** Wraps a JS string array as an RoArray of BrsString (the stringarray field shape). */
function stringArray(values) {
    return new RoArray(values.map((v) => new BrsString(v)));
}

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

describe("Standard Dialog Framework nodes", () => {
    beforeAll(() => {
        // The pin pad / labels need the common: fonts; mount the common volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        BrsDevice.registry.current.delete(EXPECTED_PIN_KEY);
        sgRoot.setFocused();
    });

    describe("factory wiring", () => {
        const cases = [
            ["StandardMessageDialog", "StandardMessageDialog"],
            ["StandardPinPadDialog", "StandardPinPadDialog"],
            ["StandardKeyboardDialog", "StandardKeyboardDialog"],
            ["StandardProgressDialog", "StandardProgressDialog"],
            ["ParentalControlPinPad", "ParentalControlPinPad"],
            ["StdDlgTextItem", "StdDlgTextItem"],
            ["StdDlgBulletTextItem", "StdDlgBulletTextItem"],
            ["StdDlgMultiStyleTextItem", "StdDlgMultiStyleTextItem"],
            ["StdDlgButton", "StdDlgButton"],
            ["StdDlgButtonArea", "StdDlgButtonArea"],
            ["StdDlgKeyboardItem", "StdDlgKeyboardItem"],
            ["StdDlgSideCardArea", "StdDlgSideCardArea"],
            ["StdDlgActionCardItem", "StdDlgActionCardItem"],
            ["StdDlgCustomItem", "StdDlgCustomItem"],
            ["StdDlgDeterminateProgressItem", "StdDlgDeterminateProgressItem"],
        ];
        test.each(cases)("CreateObject('roSGNode', '%s') resolves", (type, expected) => {
            const node = SGNodeFactory.createNode(type);
            expect(node).toBeDefined();
            expect(node.constructor.name).toBe(expected);
        });
    });

    describe("StandardMessageDialog", () => {
        test("exposes the documented fields with their defaults", () => {
            const dialog = SGNodeFactory.createNode("StandardMessageDialog");
            expect(dialog.getValueJS("title")).toBe("");
            expect(dialog.getValueJS("message")).toEqual([]);
            expect(dialog.getValueJS("bulletText")).toEqual([]);
            expect(dialog.getValueJS("bulletType")).toBe("bullet");
            expect(dialog.getValueJS("bottomMessage")).toEqual([]);
            expect(dialog.getValueJS("buttons")).toEqual([]);
        });

        test("rebuilds the content area from message/bulletText/bottomMessage on render", () => {
            const dialog = SGNodeFactory.createNode("StandardMessageDialog");
            dialog.setValue("title", new BrsString("Heads up"));
            dialog.setValue("message", stringArray(["Top one", "Top two"]));
            dialog.setValue("bulletText", stringArray(["a", "b"]));
            dialog.setValue("bottomMessage", stringArray(["Bottom"]));
            dialog.setValue("buttons", stringArray(["OK", "Cancel"]));

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const contentArea = dialog.getNodeChildren().find((c) => c.constructor.name === "StdDlgContentArea");
            const itemTypes = contentArea.getNodeChildren().map((c) => c.constructor.name);
            // 2 top text items + 1 bullet list + 1 bottom text item.
            expect(itemTypes).toEqual(["StdDlgTextItem", "StdDlgTextItem", "StdDlgBulletTextItem", "StdDlgTextItem"]);
            expect(dialog.getValueJS("height")).toBeGreaterThan(0);
        });
    });

    describe("StdDlgTextItem", () => {
        const longText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40);

        test("uses a wrapping Label by default and a ScrollableText when scrollable", () => {
            const wrapping = SGNodeFactory.createNode("StdDlgTextItem");
            wrapping.setValue("text", new BrsString("A regular wrapping block of text"));
            expect(wrapping.getValueJS("scrollable")).toBe(false);
            wrapping.layoutItem(600);
            expect(wrapping.getNodeChildren()[0].constructor.name).toBe("Label");

            const scrolling = SGNodeFactory.createNode("StdDlgTextItem");
            scrolling.setValue("scrollable", BrsBoolean.True);
            scrolling.setValue("text", new BrsString(longText));
            const height = scrolling.layoutItem(600);
            const child = scrolling.getNodeChildren()[0];
            expect(child.constructor.name).toBe("ScrollableText");
            expect(child.getValueJS("width")).toBe(600);
            // Long text is capped to the scrollable viewport (and the item reports that height).
            expect(height).toBe(child.getValueJS("height"));
            expect(height).toBeLessThanOrEqual(600);
            expect(height).toBeGreaterThan(0);
            // The shared text field still drives the inner node.
            expect(child.getValueJS("text")).toContain("Lorem ipsum");
        });

        test("a scrollable text item takes focus when pressing up from the buttons", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgTextItem");
            item.setValue("scrollable", BrsBoolean.True);
            item.setValue("text", new BrsString(longText));
            contentArea.appendChildToParent(item);
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            buttonArea.appendChildToParent(ok);
            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);

            const list = SGNodeFactory.createNode("Group");
            list.setValue("focusable", BrsBoolean.True);
            sgRoot.setFocused(list);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            const widget = item.getFocusWidget();
            expect(widget.constructor.name).toBe("ScrollableText");
            // Initial focus is on the button row, not the text.
            expect(sgRoot.focused).not.toBe(widget);

            // Up from the buttons moves focus into the scrollable text.
            expect(dialog.handleKey("up", true)).toBe(true);
            expect(sgRoot.focused).toBe(widget);

            // Down past the (headless, non-scrolling) widget returns focus to the buttons.
            expect(dialog.handleKey("down", true)).toBe(true);
            expect(sgRoot.focused).not.toBe(widget);
        });

        test("scrolls to the bottom then returns focus to the buttons (with rendering)", () => {
            // A draw2D stub so ScrollableText computes its line layout / needsScroll state.
            const draw2D = new Proxy({}, { get: () => () => undefined });
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgTextItem");
            item.setValue("scrollable", BrsBoolean.True);
            item.setValue("text", new BrsString(longText));
            contentArea.appendChildToParent(item);
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            buttonArea.appendChildToParent(ok);
            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);

            const list = SGNodeFactory.createNode("Group");
            list.setValue("focusable", BrsBoolean.True);
            sgRoot.setFocused(list);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            const widget = item.getFocusWidget();

            // Up moves focus into the text.
            dialog.handleKey("up", true);
            expect(sgRoot.focused).toBe(widget);

            // Pressing down scrolls until the bottom, then hands focus back to the buttons.
            let scrolls = 0;
            for (let i = 0; i < 100 && sgRoot.focused === widget; i++) {
                dialog.handleKey("down", true);
                dialog.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
                if (sgRoot.focused === widget) {
                    scrolls++;
                }
            }
            expect(scrolls).toBeGreaterThan(0); // it actually scrolled before leaving
            expect(sgRoot.focused).not.toBe(widget); // focus returned to the buttons
        });

        test("swaps the inner node when scrollable toggles at runtime", () => {
            const item = SGNodeFactory.createNode("StdDlgTextItem");
            item.setValue("text", new BrsString("Toggle me"));
            item.layoutItem(500);
            expect(item.getNodeChildren()[0].constructor.name).toBe("Label");

            item.setValue("scrollable", BrsBoolean.True);
            item.layoutItem(500);
            const child = item.getNodeChildren()[0];
            expect(child.constructor.name).toBe("ScrollableText");
            expect(item.getNodeChildren().length).toBe(1);
            expect(child.getValueJS("text")).toBe("Toggle me");
        });
    });

    describe("StdDlgMultiStyleTextItem", () => {
        /** Builds a case-preserving drawingStyles AA (as the interpreter does). */
        function drawingStyles(styles) {
            const outer = Object.entries(styles).map(([name, def]) => {
                const inner = [];
                if (def.fontUri !== undefined)
                    inner.push({ name: new BrsString("fontUri"), value: new BrsString(def.fontUri) });
                if (def.fontSize !== undefined)
                    inner.push({ name: new BrsString("fontSize"), value: new Int32(def.fontSize) });
                if (def.color !== undefined)
                    inner.push({ name: new BrsString("color"), value: new BrsString(def.color) });
                return { name: new BrsString(name), value: new RoAssociativeArray(inner) };
            });
            return new RoAssociativeArray(outer);
        }

        test("exposes the documented fields with their defaults", () => {
            const item = SGNodeFactory.createNode("StdDlgMultiStyleTextItem");
            expect(item.getValueJS("text")).toBe("");
            expect(item.getValueJS("audioGuideText")).toBe("");
            expect(item.getNodeFields().get("drawingstyles")).toBeDefined();
        });

        test("renders the text through a wrapping MultiStyleLabel sharing text/drawingStyles", () => {
            const item = SGNodeFactory.createNode("StdDlgMultiStyleTextItem");
            item.setValue(
                "drawingStyles",
                drawingStyles({
                    default: { fontUri: "font:MediumSystemFont", color: "#EFEFEFFF" },
                    url: { fontUri: "font:MediumSystemFont", color: "#00FF00FF" },
                })
            );
            item.setValue("text", new BrsString("Visit <url>http://www.roku.com</url> for details."));

            const label = item.getNodeChildren()[0];
            expect(label.constructor.name).toBe("MultiStyleLabel");
            expect(label.getValueJS("wrap")).toBe(true);
            // The shared fields drive the inner label.
            expect(label.getValueJS("text")).toContain("roku.com");
            expect(label.getValueJS("drawingStyles").url.color).toBe("#00FF00FF");

            const height = item.layoutItem(600);
            expect(height).toBeGreaterThan(0);
            expect(item.getValueJS("width")).toBe(600);
            expect(item.getValueJS("height")).toBe(height);
            expect(label.getValueJS("width")).toBe(600);
        });

        test("lays out inside a StandardDialog content area", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const content = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgMultiStyleTextItem");
            item.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:MediumSystemFont" } }));
            item.setValue("text", new BrsString("Plain dialog text item"));
            content.appendChildToParent(item);
            dialog.appendChildToParent(content);

            expect(() => dialog.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
            expect(item.getValueJS("height")).toBeGreaterThan(0);
        });
    });

    describe("StandardDialog width", () => {
        test("resolves a { fhd, hd } resolution map (and recenters to a valid position)", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const content = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgTextItem");
            item.setValue("text", new BrsString("Body"));
            content.appendChildToParent(item);
            dialog.appendChildToParent(content);

            // Roku accepts a resolution-dependent width map; HD picks the `hd` value.
            dialog.setValue(
                "width",
                new RoAssociativeArray([
                    { name: new BrsString("fhd"), value: new Int32(1380) },
                    { name: new BrsString("hd"), value: new Int32(920) },
                ])
            );
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            expect(dialog.getValueJS("width")).toBe(920);
            // Layout produced finite geometry (a broken width collapses everything to NaN/0).
            const translation = dialog.getValueJS("translation");
            expect(Number.isFinite(translation[0])).toBe(true);
            expect(Number.isFinite(translation[1])).toBe(true);
            expect(dialog.getValueJS("height")).toBeGreaterThan(0);
            expect(content.getValueJS("width")).toBeGreaterThan(0);
        });
    });

    describe("StdDlgTitleArea", () => {
        test("draws a divider below the title and hides it when there is no title", () => {
            const withTitle = SGNodeFactory.createNode("StdDlgTitleArea");
            withTitle.setValue("primaryTitle", new BrsString("StandardMessageDialog Test"));
            const height = withTitle.layoutTitle(900);
            const divider = withTitle.getNodeChildren().find((c) => c.constructor.name === "Poster");
            expect(divider).toBeDefined();
            expect(divider.getValueJS("uri")).toContain("dialog_divider");
            expect(divider.getValueJS("visible")).toBe(true);
            expect(divider.getValueJS("width")).toBe(900);
            // The divider sits below the title, and the area height includes it.
            expect(divider.getValueJS("translation")[1]).toBeGreaterThan(0);
            expect(height).toBeGreaterThan(divider.getValueJS("translation")[1]);

            const empty = SGNodeFactory.createNode("StdDlgTitleArea");
            expect(empty.layoutTitle(900)).toBe(0);
            const emptyDivider = empty.getNodeChildren().find((c) => c.constructor.name === "Poster");
            expect(emptyDivider.getValueJS("visible")).toBe(false);
        });
    });

    describe("focus and back handling", () => {
        test("dialog grabs focus on show, closes on back, and restores prior focus", () => {
            const list = SGNodeFactory.createNode("Group");
            list.setValue("focusable", BrsBoolean.True);
            sgRoot.setFocused(list);

            const dialog = SGNodeFactory.createNode("StandardMessageDialog");
            dialog.setValue("title", new BrsString("Confirm"));
            dialog.setValue("buttons", stringArray(["OK", "Cancel"]));

            // Rendering lays the dialog out and grabs focus into its button row.
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(sgRoot.focused).not.toBe(list);

            // Back must be handled by the dialog (not bubble to the app) and restore focus.
            const handled = dialog.handleKey("back", true);
            expect(handled).toBe(true);
            expect(dialog.getValueJS("wasClosed")).toBe(true);
            expect(sgRoot.focused).toBe(list);
        });
    });

    describe("StandardPinPadDialog", () => {
        test("links the pin field to the embedded pad and exposes a VoiceTextEditBox", () => {
            const dialog = SGNodeFactory.createNode("StandardPinPadDialog");
            expect(dialog.getValueJS("pin")).toBe("");
            const textEditBox = dialog.getValue("textEditBox");
            expect(textEditBox).toBeDefined();
            expect(textEditBox.constructor.name).toBe("VoiceTextEditBox");

            // Writing pin on the dialog is reflected by the shared field.
            dialog.setValue("pin", new BrsString("12"));
            expect(dialog.getValueJS("pin")).toBe("12");
        });
    });

    describe("palette theming", () => {
        const palette = {
            DialogBackgroundColor: "0x002040FF",
            DialogTextColor: "0x00FFFFFF",
            DialogFocusColor: "0xFF00FFFF",
            DialogFocusItemColor: "0x112233FF",
            DialogFootprintColor: "0x44556680",
        };
        const WHITE = 0xffffffff;

        test("themes the keyboard keys, buttons, and title from the palette", () => {
            const dialog = SGNodeFactory.createNode("StandardKeyboardDialog");
            dialog.setValue("palette", makePalette(palette));
            dialog.setValue("title", new BrsString("Pick a color"));
            dialog.setValue("buttons", stringArray(["OK"]));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const buttonArea = findDescendant(dialog, "StdDlgButtonArea");
            const keyboard = findDescendant(dialog, "Keyboard");
            expect(keyboard).toBeDefined();

            // Key glyphs and unfocused button text both use DialogTextColor.
            const textColor = keyboard.getValueJS("keyColor");
            expect(textColor).not.toBe(WHITE);
            expect(buttonArea.getValueJS("textColor")).toBe(textColor);
            // Focused button background uses DialogFocusColor; focused text uses DialogFocusItemColor.
            expect(buttonArea.getValueJS("focusBitmapBlendColor")).not.toBe(WHITE);
            expect(buttonArea.getValueJS("focusBitmapBlendColor")).not.toBe(textColor);
            expect(buttonArea.getValueJS("focusedTextColor")).not.toBe(textColor);
            // Buttons receive the propagated colors.
            const button = buttonArea.getNodeChildren()[0];
            expect(button.getValueJS("textColor")).toBe(textColor);
            expect(button.getValueJS("focusBitmapBlendColor")).toBe(buttonArea.getValueJS("focusBitmapBlendColor"));
            // The per-key focus highlight is tinted with DialogFocusColor (same as the button focus).
            expect(keyboard.getValueJS("focusBitmapBlendColor")).toBe(buttonArea.getValueJS("focusBitmapBlendColor"));
        });

        test("themes the scrollable text's scrollbar from the palette", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            dialog.setValue("palette", makePalette(palette));
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgTextItem");
            item.setValue("scrollable", BrsBoolean.True);
            item.setValue("text", new BrsString("Lorem ipsum ".repeat(60)));
            contentArea.appendChildToParent(item);
            dialog.appendChildToParent(contentArea);
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const scroll = findDescendant(dialog, "ScrollableText");
            const footprint = scroll.getValueJS("scrollbarTrackBlendColor");
            // Track and unfocused thumb share DialogFootprintColor; focused thumb uses DialogFocusColor.
            expect(footprint).not.toBe(0xffffffff);
            expect(scroll.getValueJS("scrollbarThumbBlendColor")).toBe(footprint);
            expect(scroll.getValueJS("scrollbarThumbFocusedBlendColor")).not.toBe(footprint);
        });

        test("keeps the focused-button text dark and the focus bitmap untinted without a palette", () => {
            const dialog = SGNodeFactory.createNode("StandardMessageDialog");
            dialog.setValue("title", new BrsString("No palette"));
            dialog.setValue("buttons", stringArray(["OK"]));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const buttonArea = findDescendant(dialog, "StdDlgButtonArea");
            // Focused-button text must stay dark (0x262626ff), not become white.
            expect(buttonArea.getValueJS("focusedTextColor")).toBe(0x262626ff);
            // No palette → focus AND footprint bitmaps untinted (white = no blend) so the footprint
            // stays visible when the button row loses focus.
            expect(buttonArea.getValueJS("focusBitmapBlendColor") >>> 0).toBe(0xffffffff);
            expect(buttonArea.getValueJS("focusFootprintBlendColor") >>> 0).toBe(0xffffffff);
        });
    });

    describe("StandardKeyboardDialog", () => {
        test("composes a keyboard item and exposes the documented fields", () => {
            const dialog = SGNodeFactory.createNode("StandardKeyboardDialog");
            expect(dialog.constructor.name).toBe("StandardKeyboardDialog");
            expect(dialog.getValueJS("keyboardDomain")).toBe("generic");
            expect(dialog.getValueJS("text")).toBe("");
            const textEditBox = dialog.getValue("textEditBox");
            expect(textEditBox).toBeDefined();
            // textEditBox exposes the keyboard's edit box fields (e.g. hintText).
            textEditBox.setValue("hintText", new BrsString("Type a color..."));
            expect(textEditBox.getValueJS("hintText")).toBe("Type a color...");

            dialog.setValue("title", new BrsString("Favorite color?"));
            dialog.setValue("message", stringArray(["Pick one"]));
            dialog.setValue("buttons", stringArray(["OK"]));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const contentArea = dialog.getNodeChildren().find((c) => c.constructor.name === "StdDlgContentArea");
            expect(contentArea.getNodeChildren().map((c) => c.constructor.name)).toEqual([
                "StdDlgTextItem",
                "StdDlgKeyboardItem",
            ]);
            expect(dialog.getValueJS("height")).toBeGreaterThan(0);
        });
    });

    describe("StandardProgressDialog", () => {
        test("contains a progress item and defaults the message", () => {
            const dialog = SGNodeFactory.createNode("StandardProgressDialog");
            dialog.setValue("title", new BrsString("Changing Theme"));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            expect(dialog.getValueJS("message")).toBe("Please wait...");
            const contentArea = dialog.getNodeChildren().find((c) => c.constructor.name === "StdDlgContentArea");
            expect(contentArea.getNodeChildren().map((c) => c.constructor.name)).toEqual(["StdDlgProgressItem"]);
            expect(dialog.getValueJS("height")).toBeGreaterThan(0);
        });

        test("sizes to its content — narrower and shorter than a fuller dialog", () => {
            const progress = SGNodeFactory.createNode("StandardProgressDialog");
            progress.setValue("message", new BrsString("Loading..."));
            progress.renderNode(fakeInterpreter, [0, 0], 0, 1);

            const message = SGNodeFactory.createNode("StandardMessageDialog");
            message.setValue("message", stringArray(["Line one", "Line two", "Line three", "Line four"]));
            message.setValue("buttons", stringArray(["OK", "Cancel"]));
            message.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // The progress dialog (spinner + short message) wraps its compact content rather than
            // forcing the full dialog width/height like a fuller text dialog does.
            expect(progress.getValueJS("width")).toBeGreaterThan(0);
            expect(progress.getValueJS("height")).toBeGreaterThan(0);
            expect(progress.getValueJS("width")).toBeLessThan(message.getValueJS("width"));
            expect(progress.getValueJS("height")).toBeLessThan(message.getValueJS("height"));
        });
    });

    describe("authored StdDlgButtonArea children", () => {
        test("a StandardDialog with authored areas surfaces button state and getChild", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            contentArea.appendChildToParent(SGNodeFactory.createNode("StdDlgProgressItem"));
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            const cancel = SGNodeFactory.createNode("StdDlgButton");
            cancel.setValue("text", new BrsString("Cancel"));
            buttonArea.appendChildToParent(ok);
            buttonArea.appendChildToParent(cancel);
            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);

            const list = SGNodeFactory.createNode("Group");
            list.setValue("focusable", BrsBoolean.True);
            sgRoot.setFocused(list);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            // The authored buttons remain real StdDlgButton children reachable by index.
            expect(buttonArea.getNodeChildren().map((c) => c.getValueJS("text"))).toEqual(["OK", "Cancel"]);
            // Focus moved into the button row.
            expect(sgRoot.focused).not.toBe(list);

            // Navigation + selection propagate to the dialog (linked fields).
            dialog.handleKey("down", true);
            dialog.handleKey("down", false);
            expect(dialog.getValueJS("buttonFocused")).toBe(1);
            dialog.handleKey("OK", true);
            dialog.handleKey("OK", false);
            expect(dialog.getValueJS("buttonSelected")).toBe(1);
        });
    });

    describe("StdDlgSideCardArea", () => {
        test("exposes the documented fields with their defaults", () => {
            const card = SGNodeFactory.createNode("StdDlgSideCardArea");
            expect(card.getValueJS("extendToDialogEdge")).toBe(true);
            expect(card.getValueJS("horizAlign")).toBe("right");
            expect(card.getValueJS("showDivider")).toBe(false);
            expect(card.getValueJS("width")).toBe(0);
        });

        /** Builds a StandardDialog with title/content/button areas plus a side card holding a Poster. */
        function buildDialogWithSideCard(horizAlign) {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const titleArea = SGNodeFactory.createNode("StdDlgTitleArea");
            titleArea.setValue("primaryTitle", new BrsString("Side Card"));
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const text = SGNodeFactory.createNode("StdDlgTextItem");
            text.setValue("text", new BrsString("Some annotative text"));
            contentArea.appendChildToParent(text);
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            buttonArea.appendChildToParent(ok);

            const card = SGNodeFactory.createNode("StdDlgSideCardArea");
            card.setValue("horizAlign", new BrsString(horizAlign));
            const poster = SGNodeFactory.createNode("Poster");
            poster.setValue("width", new Float(200));
            poster.setValue("height", new Float(300));
            card.appendChildToParent(poster);

            dialog.appendChildToParent(titleArea);
            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);
            dialog.appendChildToParent(card);
            return { dialog, contentArea, card };
        }

        test("sizes the dialog around the card and never takes focus (horizAlign right)", () => {
            const list = SGNodeFactory.createNode("Group");
            list.setValue("focusable", BrsBoolean.True);
            sgRoot.setFocused(list);

            const { dialog, contentArea, card } = buildDialogWithSideCard("right");
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // Auto width (0) resolves to the card's children bounding width.
            expect(card.getValueJS("width")).toBe(200);
            // Dialog height grows to fit the taller side card.
            expect(dialog.getValueJS("height")).toBeGreaterThanOrEqual(300);
            // Right-aligned: card sits to the right of the area column.
            expect(card.getValueJS("translation")[0]).toBeGreaterThan(contentArea.getValueJS("translation")[0]);
            // The side card never gains focus; focus lands on the button row instead.
            expect(sgRoot.focused).not.toBe(list);
            expect(sgRoot.focused).not.toBe(card);
        });

        test("pins the button area to the bottom and gives buttons no icon", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const text = SGNodeFactory.createNode("StdDlgTextItem");
            text.setValue("text", new BrsString("Short text"));
            contentArea.appendChildToParent(text);
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            const cancel = SGNodeFactory.createNode("StdDlgButton");
            cancel.setValue("text", new BrsString("Cancel"));
            buttonArea.appendChildToParent(ok);
            buttonArea.appendChildToParent(cancel);
            // A tall side card forces extra vertical space below the short content column.
            const card = SGNodeFactory.createNode("StdDlgSideCardArea");
            const poster = SGNodeFactory.createNode("Poster");
            poster.setValue("width", new Float(200));
            poster.setValue("height", new Float(600));
            card.appendChildToParent(poster);

            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);
            dialog.appendChildToParent(card);
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // The button area sits well below the content (bottom-aligned), not stacked under it.
            const buttonTop = buttonArea.getValueJS("translation")[1];
            const contentBottom = contentArea.getValueJS("translation")[1] + contentArea.getValueJS("height");
            expect(buttonTop).toBeGreaterThan(contentBottom + 50);

            // The standard dialog buttons carry no icon.
            for (const button of buttonArea.getNodeChildren()) {
                expect(button.getValueJS("iconUri")).toBe("");
                expect(button.getValueJS("focusedIconUri")).toBe("");
            }
        });

        test("places the card to the left of the column for horizAlign left", () => {
            const { dialog, contentArea, card } = buildDialogWithSideCard("left");
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(card.getValueJS("translation")[0]).toBeLessThan(contentArea.getValueJS("translation")[0]);
        });

        test("sizes the dialog from a Poster's loaded bitmap when the card has no explicit width", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const text = SGNodeFactory.createNode("StdDlgTextItem");
            text.setValue("text", new BrsString("Annotative text"));
            contentArea.appendChildToParent(text);

            const card = SGNodeFactory.createNode("StdDlgSideCardArea");
            const poster = SGNodeFactory.createNode("Poster");
            // No explicit width/height — the side card must size to the loaded bitmap.
            poster.setValue("uri", new BrsString("common:/images/video_trickplay_overlay.png"));
            card.appendChildToParent(poster);

            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(card);

            const bitmapHeight = poster.getValueJS("bitmapHeight");
            const bitmapWidth = poster.getValueJS("bitmapWidth");
            expect(bitmapHeight).toBeGreaterThan(0);
            expect(bitmapWidth).toBeGreaterThan(0);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // Card width resolves to the bitmap width; dialog height covers the bitmap height.
            expect(card.getValueJS("width")).toBe(bitmapWidth);
            expect(dialog.getValueJS("height")).toBeGreaterThanOrEqual(bitmapHeight);
        });

        test("keeps only a single side card per dialog", () => {
            const { dialog } = buildDialogWithSideCard("right");
            const second = SGNodeFactory.createNode("StdDlgSideCardArea");
            dialog.appendChildToParent(second);
            const cards = dialog.getNodeChildren().filter((c) => c.constructor.name === "StdDlgSideCardArea");
            // Both remain as children, but the dialog only lays out the first (no crash on render).
            expect(cards.length).toBe(2);
            expect(() => dialog.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
        });
    });

    describe("StdDlgActionCardItem", () => {
        test("exposes the documented fields with their defaults and is focusable", () => {
            const card = SGNodeFactory.createNode("StdDlgActionCardItem");
            expect(card.getValueJS("iconType")).toBe("none");
            expect(card.getValueJS("iconStatus")).toBe(false);
            expect(card.getValueJS("selected")).toBe(false);
            expect(card.getValueJS("focusable")).toBe(true);
        });

        test("fires `selected` when OK is pressed and ignores the release", () => {
            const card = SGNodeFactory.createNode("StdDlgActionCardItem");
            expect(card.handleKey("OK", true)).toBe(true);
            expect(card.getValueJS("selected")).toBe(true);
            // Non-OK keys are not consumed by the card.
            expect(card.handleKey("down", true)).toBe(false);
        });

        test("lays out a background and a left-side icon for a checkbox card", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const card = SGNodeFactory.createNode("StdDlgActionCardItem");
            card.setValue("iconType", new BrsString("checkbox"));
            card.setValue("iconStatus", BrsBoolean.True);
            const label = SGNodeFactory.createNode("Label");
            label.setValue("text", new BrsString("Check Box Action Card"));
            card.appendChildToParent(label);
            contentArea.appendChildToParent(card);
            dialog.appendChildToParent(contentArea);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // The card has a background rectangle and an icon poster plus the label child.
            const types = card.getNodeChildren().map((c) => c.constructor.name);
            expect(types).toEqual(["Rectangle", "Poster", "Label"]);
            expect(card.getValueJS("height")).toBeGreaterThan(0);
            // Checked checkbox resolves to the ON icon; the label is offset right of the icon.
            const icon = card.getNodeChildren()[1];
            expect(icon.getValueJS("uri")).toContain("icon_checkboxON");
            expect(label.getValueJS("translation")[0]).toBeGreaterThan(0);
        });

        test("resolves the more_info arrow on the right and no icon for 'none'", () => {
            const moreInfo = SGNodeFactory.createNode("StdDlgActionCardItem");
            moreInfo.setValue("iconType", new BrsString("more_info"));
            moreInfo.layoutItem(600);
            moreInfo.renderNode(fakeInterpreter, [0, 0], 0, 1);
            const arrow = moreInfo.getNodeChildren()[1];
            expect(arrow.getValueJS("uri")).toContain("panelSet_rightArrow");
            // Right-aligned icon.
            expect(arrow.getValueJS("translation")[0]).toBeGreaterThan(300);

            const none = SGNodeFactory.createNode("StdDlgActionCardItem");
            none.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(none.getNodeChildren()[1].getValueJS("uri")).toBe("");
        });
    });

    describe("StdDlgCustomItem", () => {
        test("exposes the documented fields with their defaults", () => {
            const item = SGNodeFactory.createNode("StdDlgCustomItem");
            expect(item.getValueJS("widthField")).toBe(0);
            expect(item.getValueJS("fixedWidthField")).toBe(0);
            // width/height exist (inherited from Group on a device) so apps can observe/read `width`.
            expect(item.getValueJS("width")).toBe(0);
            expect(item.getValueJS("height")).toBe(0);
        });

        test("layout sets a real `width` field (so apps can observe/read it for column sizing)", () => {
            const item = SGNodeFactory.createNode("StdDlgCustomItem");
            item.layoutItem(600);
            // The width field exists and holds the resolved width — setValue on a missing field would
            // be a no-op (leaving it undefined), which previously prevented the width observer firing.
            expect(item.getValueJS("width")).toBe(600);
        });

        test("reports the resolved width via widthField and measures child height", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgCustomItem");
            const child = SGNodeFactory.createNode("Rectangle");
            child.setValue("width", new Float(120));
            child.setValue("height", new Float(80));
            item.appendChildToParent(child);
            contentArea.appendChildToParent(item);
            dialog.appendChildToParent(contentArea);

            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            // With no fixed width, widthField follows the content area's width (> 0).
            expect(item.getValueJS("widthField")).toBeGreaterThan(0);
            expect(item.getValueJS("height")).toBe(80);
        });

        test("honors fixedWidthField when set", () => {
            const item = SGNodeFactory.createNode("StdDlgCustomItem");
            item.setValue("fixedWidthField", new Float(444));
            expect(item.layoutItem(900)).toBe(0);
            expect(item.getValueJS("widthField")).toBe(444);
        });

        test("measures a LayoutGroup child and pushes the buttons below it", () => {
            const draw2D = new Proxy({}, { get: () => () => undefined });
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const custom = SGNodeFactory.createNode("StdDlgCustomItem");
            const list = SGNodeFactory.createNode("LayoutGroup");
            list.setValue("layoutDirection", new BrsString("vert"));
            list.setValue("itemSpacings", new RoArray([new Float(20)]));
            for (const t of ["One Week", "One Month", "One Year"]) {
                const label = SGNodeFactory.createNode("Label");
                label.setValue("text", new BrsString(t));
                list.appendChildToParent(label);
            }
            custom.appendChildToParent(list);
            contentArea.appendChildToParent(custom);
            const buttonArea = SGNodeFactory.createNode("StdDlgButtonArea");
            const ok = SGNodeFactory.createNode("StdDlgButton");
            ok.setValue("text", new BrsString("OK"));
            buttonArea.appendChildToParent(ok);
            dialog.appendChildToParent(contentArea);
            dialog.appendChildToParent(buttonArea);

            // Frame 1: the LayoutGroup measures itself during render; frame 2 re-lays-out the dialog.
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            const listHeight = list.getValueJS("height");
            // The LayoutGroup reports its stacked size (3 rows + 2 gaps), and the custom item wraps it.
            expect(listHeight).toBeGreaterThan(0);
            expect(custom.getValueJS("height")).toBe(listHeight);
            // The button row sits below the custom item's content, not overlapping it.
            const buttonTop = buttonArea.getValueJS("translation")[1];
            const customBottom = custom.getValueJS("translation")[1] + custom.getValueJS("height");
            expect(buttonTop).toBeGreaterThanOrEqual(customBottom);
        });
    });

    describe("StdDlgDeterminateProgressItem", () => {
        test("exposes the documented fields with their defaults", () => {
            const item = SGNodeFactory.createNode("StdDlgDeterminateProgressItem");
            expect(item.getValueJS("percent")).toBe(0);
            expect(item.getValueJS("text")).toBe("");
        });

        test("renders a track + fill bar whose fill tracks the clamped percent", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgDeterminateProgressItem");
            item.setValue("text", new BrsString("Downloading…"));
            item.setValue("percent", new Float(50));
            contentArea.appendChildToParent(item);
            dialog.appendChildToParent(contentArea);
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);

            // Children: text label, track rectangle, fill rectangle, percent label.
            const types = item.getNodeChildren().map((c) => c.constructor.name);
            expect(types).toEqual(["Label", "Rectangle", "Rectangle", "Label"]);
            const [, track, fill] = item.getNodeChildren();
            // At 50% the fill is about half the track width.
            const trackWidth = track.getValueJS("width");
            expect(trackWidth).toBeGreaterThan(0);
            expect(fill.getValueJS("width")).toBeCloseTo(trackWidth / 2, 1);
            expect(item.getValueJS("height")).toBeGreaterThan(0);
        });

        test("clamps out-of-range percent to 0..100", () => {
            const dialog = SGNodeFactory.createNode("StandardDialog");
            const contentArea = SGNodeFactory.createNode("StdDlgContentArea");
            const item = SGNodeFactory.createNode("StdDlgDeterminateProgressItem");
            contentArea.appendChildToParent(item);
            dialog.appendChildToParent(contentArea);

            item.setValue("percent", new Float(150));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            const [, track, fill] = item.getNodeChildren();
            expect(fill.getValueJS("width")).toBe(track.getValueJS("width"));

            item.setValue("percent", new Float(-20));
            dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(item.getNodeChildren()[2].getValueJS("width")).toBe(0);
        });
    });

    describe("ParentalControlPinPad", () => {
        test("private/forced fields ignore BrightScript writes", () => {
            const pad = SGNodeFactory.createNode("ParentalControlPinPad");
            expect(pad.getValueJS("pinSuccess")).toBe("incomplete");
            expect(pad.getValueJS("secureMode")).toBe(true);
            expect(pad.getValueJS("pinLength")).toBe(4);

            pad.setValue("secureMode", BrsBoolean.False);
            pad.setValue("pinLength", new Int32(6));
            expect(pad.getValueJS("secureMode")).toBe(true);
            expect(pad.getValueJS("pinLength")).toBe(4);
        });

        test("pinSuccess reflects matching/incorrect entry against the configured PIN", () => {
            BrsDevice.registry.current.set(EXPECTED_PIN_KEY, "1234");
            const pad = SGNodeFactory.createNode("ParentalControlPinPad");

            pad.setValue("pin", new BrsString("12"));
            expect(pad.getValueJS("pinSuccess")).toBe("incomplete");

            pad.setValue("pin", new BrsString("1234"));
            expect(pad.getValueJS("pinSuccess")).toBe("true");
            expect(pad.getValueJS("pin")).toBe("1234");
        });

        test("incorrect entry sets pinSuccess false and auto-clears the pin", () => {
            BrsDevice.registry.current.set(EXPECTED_PIN_KEY, "1234");
            const pad = SGNodeFactory.createNode("ParentalControlPinPad");

            pad.setValue("pin", new BrsString("9999"));
            expect(pad.getValueJS("pinSuccess")).toBe("false");
            expect(pad.getValueJS("pin")).toBe("");
        });

        test("a complete entry resolves to false when no expected PIN is configured", () => {
            const pad = SGNodeFactory.createNode("ParentalControlPinPad");
            pad.setValue("pin", new BrsString("1234"));
            expect(pad.getValueJS("pinSuccess")).toBe("false");
        });
    });
});
