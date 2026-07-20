const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, RoArray, Float } = core;

/** Builds a root ContentNode with `count` flat item children. */
function buildContent(count) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (let i = 0; i < count; i++) {
        const item = SGNodeFactory.createNode("ContentNode");
        item.setValue("title", new BrsString(`item ${i}`));
        root.appendChildToParent(item);
    }
    return root;
}

/**
 * A focused single-row horizontal strip: numRows=1, numColumns = item count (the related-items
 * row recipe). itemSize [252,360] + spacing [16,16] on the headless 1280-wide scene gives
 * floor(1280 / 268) = 4 fully visible columns for the floating-focus math.
 */
function focusedStrip(style, count = 20) {
    const grid = SGNodeFactory.createNode("MarkupGrid");
    grid.setValue("numRows", new Int32(1));
    grid.setValue("numColumns", new Int32(count));
    grid.setValue("itemSize", new RoArray([new Float(252), new Float(360)]));
    grid.setValue("itemSpacing", new RoArray([new Float(16), new Float(16)]));
    if (style) {
        grid.setValue("horizFocusAnimationStyle", new BrsString(style));
    }
    grid.setValue("content", buildContent(count));
    grid.setNodeFocus(true);
    return grid;
}

describe("MarkupGrid horizFocusAnimationStyle handling", () => {
    beforeAll(() => {
        // The grid resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    describe("field acceptance", () => {
        test("fixedFocus is accepted (a device honors it despite the doc's option table)", () => {
            const grid = focusedStrip("fixedFocus");
            expect(grid.getValueJS("horizFocusAnimationStyle")).toBe("fixedFocus");
        });

        test('the shorthand "fixed" resolves to fixedFocus, like the vertical alias', () => {
            const grid = focusedStrip("fixed");
            expect(grid.getValueJS("horizFocusAnimationStyle")).toBe("fixed");
            // Behaves as fixedFocus: the scroll window pins the focused column at the left edge.
            grid.handleKey("right", true);
            expect(grid.scrollCol).toBe(1);
        });

        test("an unrecognized value is ignored, keeping the previous (floating) style", () => {
            const grid = focusedStrip("banana");
            expect(grid.getValueJS("horizFocusAnimationStyle")).toBe("floatingFocus");
        });
    });

    describe("fixedFocus: focused column pinned at the left edge, content scrolls", () => {
        test("right presses advance itemFocused with scrollCol following exactly", () => {
            const grid = focusedStrip("fixedFocus");
            for (let i = 1; i <= 6; i++) {
                expect(grid.handleKey("right", true)).toBe(true);
                expect(grid.getValueJS("itemFocused")).toBe(i);
                expect(grid.scrollCol).toBe(i);
            }
        });

        test("no wrap: right at the last item and left at the first are unhandled (bubble)", () => {
            const grid = focusedStrip("fixedFocus", 5);
            expect(grid.handleKey("left", true)).toBe(false);
            for (let i = 0; i < 4; i++) {
                expect(grid.handleKey("right", true)).toBe(true);
            }
            expect(grid.getValueJS("itemFocused")).toBe(4);
            expect(grid.handleKey("right", true)).toBe(false);
            // Walk back to the start; scrollCol tracks the focused column the whole way.
            for (let i = 3; i >= 0; i--) {
                expect(grid.handleKey("left", true)).toBe(true);
                expect(grid.scrollCol).toBe(i);
            }
            expect(grid.handleKey("left", true)).toBe(false);
        });

        test("jumpToItem scrolls the window to the target column", () => {
            const grid = focusedStrip("fixedFocus");
            grid.setValue("jumpToItem", new Int32(10));
            expect(grid.getValueJS("itemFocused")).toBe(10);
            expect(grid.scrollCol).toBe(10);
        });
    });

    describe("floatingFocus (default): focus floats within the visible window, then scrolls", () => {
        test("scrollCol stays 0 while focus is inside the window, then follows", () => {
            const grid = focusedStrip();
            // 4 columns fit (1280 / 268); focus floats through columns 0..3 without scrolling.
            for (let i = 1; i <= 3; i++) {
                expect(grid.handleKey("right", true)).toBe(true);
                expect(grid.scrollCol).toBe(0);
            }
            // Moving to column 4 scrolls the window by one, and so on.
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.scrollCol).toBe(1);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.scrollCol).toBe(2);
            // Scrolling left only once focus moves before the window's left column.
            expect(grid.handleKey("left", true)).toBe(true);
            expect(grid.scrollCol).toBe(2);
            expect(grid.handleKey("left", true)).toBe(true);
            expect(grid.handleKey("left", true)).toBe(true);
            expect(grid.scrollCol).toBe(2);
            expect(grid.handleKey("left", true)).toBe(true);
            expect(grid.scrollCol).toBe(1);
        });

        test("jumpToItem scrolls minimally to make the target visible", () => {
            const grid = focusedStrip();
            grid.setValue("jumpToItem", new Int32(10));
            // Window of 4: item 10 becomes the rightmost visible column (10 - 4 + 1).
            expect(grid.scrollCol).toBe(7);
        });

        test("no wrap: ends bubble", () => {
            const grid = focusedStrip(undefined, 3);
            expect(grid.handleKey("left", true)).toBe(false);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.handleKey("right", true)).toBe(false);
        });
    });

    describe("fixedFocusWrap: horizontal wrapping not implemented, floats without wrap", () => {
        test("right at the last item is unhandled (bubbles) instead of wrapping", () => {
            const grid = focusedStrip("fixedFocusWrap", 3);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.handleKey("right", true)).toBe(false);
            expect(grid.handleKey("left", true)).toBe(true);
        });
    });

    describe("multi-row grids and placeholders", () => {
        test("right at a row boundary stays in the row (unhandled)", () => {
            const grid = SGNodeFactory.createNode("MarkupGrid");
            grid.setValue("numColumns", new Int32(4));
            grid.setValue("content", buildContent(12));
            grid.setNodeFocus(true);
            for (let i = 0; i < 3; i++) {
                expect(grid.handleKey("right", true)).toBe(true);
            }
            expect(grid.getValueJS("itemFocused")).toBe(3);
            // Item 4 exists but is on the next row — left/right never changes rows.
            expect(grid.handleKey("right", true)).toBe(false);
        });

        test("navigation into a section's padding placeholder is unhandled", () => {
            // A sectioned content tree with a ragged last row: ArrayGrid.processSection pads the
            // row with _placeholder_ nodes, which must not receive focus.
            const root = SGNodeFactory.createNode("ContentNode");
            const section = SGNodeFactory.createNode("ContentNode");
            section.setValue("ContentType", new BrsString("section"));
            section.setValue("title", new BrsString("Section"));
            for (let i = 0; i < 3; i++) {
                const item = SGNodeFactory.createNode("ContentNode");
                item.setValue("title", new BrsString(`item ${i}`));
                section.appendChildToParent(item);
            }
            root.appendChildToParent(section);

            const grid = SGNodeFactory.createNode("MarkupGrid");
            grid.setValue("numColumns", new Int32(4));
            grid.setValue("content", root);
            grid.setNodeFocus(true);
            expect(grid.handleKey("right", true)).toBe(true);
            expect(grid.handleKey("right", true)).toBe(true);
            // Item 3 is the placeholder padding the 4-column row.
            expect(grid.handleKey("right", true)).toBe(false);
        });
    });
});
