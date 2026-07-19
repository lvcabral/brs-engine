const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, Int32, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

describe("ButtonGroup bounding rect", () => {
    beforeAll(() => {
        // ButtonGroup measures its buttons with fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("reports its own measured width even when a child contributes no rect this pass", () => {
        // Regression: the group's bounding rect used to be built from `this.width` BEFORE refreshButtons
        // recomputed it, so on the first render it captured width=0. The child button's rect is normally
        // unioned in and hides this, but a custom button still mid-sizing (its background not yet drawn)
        // contributes nothing that pass — so the group's own width is the only source. With the stale 0,
        // an app centering via `(1920 - boundingRect().width) / 2` placed the group at ~960 (hard right).
        const group = SGNodeFactory.createNode("ButtonGroup");
        const button = SGNodeFactory.createNode("Button");
        button.setValue("text", new BrsString("Manual Login"));
        // Child draws nothing this pass -> no contribution to the parent's unioned bounding rect.
        button.setValue("visible", BrsBoolean.False);
        group.appendChildToParent(button);

        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        // boundingRect() returns rectToParent; it must reflect the group's measured button width, not 0.
        const rect = group.rectToParent;
        expect(rect.width).toBeGreaterThan(100);
        expect(rect.height).toBeGreaterThan(0);
        // Centering must not collapse to the far right (the bug placed it at ~960 on a 1920 screen).
        expect((1920 - rect.width) / 2).toBeLessThan(900);
    });
});

describe("ButtonGroup with custom (non-Button) Group children", () => {
    // Apps use a ButtonGroup as a horizontal layout container for their own focusable button
    // components (Group-based, with a `text` interface field). Roku does not manage such children:
    // the group must behave as a plain LayoutGroup and never reposition, restyle, focus-steal, or
    // consume keys on their behalf.
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function createCustomButton(text, width) {
        // Label stands in for a custom Group component exposing a `text` field.
        const child = SGNodeFactory.createNode("Label");
        child.setValue("text", new BrsString(text));
        child.setValue("width", new Float(width));
        child.setValue("height", new Float(48));
        child.setValue("focusable", BrsBoolean.True);
        return child;
    }

    function createHorizontalGroup() {
        const group = SGNodeFactory.createNode("ButtonGroup");
        group.setValue("layoutDirection", new BrsString("horiz"));
        group.setValue("itemSpacings", new RoArray([new Float(39)]));
        const left = createCustomButton("Back", 177);
        const right = createCustomButton("Continue", 1149);
        group.appendChildToParent(left);
        group.appendChildToParent(right);
        return { group, left, right };
    }

    test("does not capture custom children into the buttons array", () => {
        const { group } = createHorizontalGroup();
        expect(group.getValueJS("buttons")).toEqual([]);
    });

    test("lays custom children out horizontally and keeps them stable across focus changes", () => {
        const { group, left, right } = createHorizontalGroup();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(left.getValueJS("translation")[0]).toBeCloseTo(0, 0);
        expect(right.getValueJS("translation")[0]).toBeCloseTo(177 + 39, 0);

        // Focus each child in turn; the layout must not be recomputed to a vertical/origin stack.
        sgRoot.setFocused(right);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);
        sgRoot.setFocused(left);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(left.getValueJS("translation")[0]).toBeCloseTo(0, 0);
        expect(right.getValueJS("translation")[0]).toBeCloseTo(177 + 39, 0);
        // Custom children keep their own text/size — the group must not overwrite them.
        expect(left.getValueJS("text")).toBe("Back");
        expect(right.getValueJS("text")).toBe("Continue");
    });

    test("does not steal focus from a directly focused custom child", () => {
        const { group, right } = createHorizontalGroup();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        sgRoot.setFocused(right);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(sgRoot.focused).toBe(right);
    });

    test("lets keys bubble to the app instead of consuming them", () => {
        const { group, right } = createHorizontalGroup();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);
        sgRoot.setFocused(right);

        expect(group.handleKey("OK", true)).toBe(false);
        expect(group.handleKey("down", true)).toBe(false);
        expect(group.handleKey("left", true)).toBe(false);
        // OK must not fire a spurious selection of button index 0.
        expect(sgRoot.focused).toBe(right);
    });

    test("keeps custom children through focus-in/focus-out re-renders", () => {
        const { group, right } = createHorizontalGroup();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        sgRoot.setFocused(right);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);
        sgRoot.setFocused();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(group.getNodeChildren().length).toBe(2);
    });
});

describe("ButtonGroup with managed Button children", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("follows a directly focused Button instead of stealing focus back to the previous index", () => {
        const group = SGNodeFactory.createNode("ButtonGroup");
        const first = SGNodeFactory.createNode("Button");
        first.setValue("text", new BrsString("First"));
        const second = SGNodeFactory.createNode("Button");
        second.setValue("text", new BrsString("Second"));
        group.appendChildToParent(first);
        group.appendChildToParent(second);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        sgRoot.setFocused(second);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(sgRoot.focused).toBe(second);
        expect(group.getValueJS("buttonFocused")).toBe(1);
        // OK selects the button that actually holds focus, not the stale index 0.
        expect(group.handleKey("OK", true)).toBe(true);
        expect(group.getValueJS("buttonSelected")).toBe(1);
    });

    test("redirects focus to the current button when the group itself is focused", () => {
        const group = SGNodeFactory.createNode("ButtonGroup");
        const first = SGNodeFactory.createNode("Button");
        first.setValue("text", new BrsString("First"));
        group.appendChildToParent(first);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        sgRoot.setFocused(group);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        expect(sgRoot.focused).toBe(first);
    });

    test("moves focus between buttons on up/down key navigation", () => {
        // Regression (#1060): handleKey updated `focusButton`/`buttonFocused` but not the live
        // focus, and the next render's refreshFocus snapped focusIndex back to the still-focused
        // button — so a focused ButtonGroup could never move focus between its buttons.
        const group = SGNodeFactory.createNode("ButtonGroup");
        group.setValue("buttons", new RoArray([new BrsString("A"), new BrsString("B"), new BrsString("C")]));
        group.setNodeFocus(true);
        const children = group.getNodeChildren();
        const focusedIndex = () => children.indexOf(sgRoot.focused);
        expect(focusedIndex()).toBe(0);

        group.handleKey("down", true);
        group.handleKey("down", false);
        expect(focusedIndex()).toBe(1);
        // A render pass must not snap focus back to the previous button.
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(focusedIndex()).toBe(1);
        expect(group.getValueJS("buttonFocused")).toBe(1);

        group.handleKey("down", true);
        group.handleKey("down", false);
        expect(focusedIndex()).toBe(2);
        // OK selects the button that actually holds focus.
        group.handleKey("OK", true);
        expect(group.getValueJS("buttonSelected")).toBe(2);

        group.handleKey("up", true);
        group.handleKey("up", false);
        expect(focusedIndex()).toBe(1);
    });

    test("setting focusButton on a focused group moves the live focus", () => {
        // App code sets `focusButton` to reposition focus; it must take effect immediately when
        // the group already holds key focus (used by screens returning to a specific action).
        const group = SGNodeFactory.createNode("ButtonGroup");
        group.setValue("buttons", new RoArray([new BrsString("A"), new BrsString("B"), new BrsString("C")]));
        group.setNodeFocus(true);
        const children = group.getNodeChildren();

        group.setValue("focusButton", new Int32(2));
        expect(children.indexOf(sgRoot.focused)).toBe(2);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(children.indexOf(sgRoot.focused)).toBe(2);
    });

    test("setting focusButton before the group is focused does not force focus", () => {
        // onVisibleChange sets `focusButton = 0` before setFocus(true); it must not pull global
        // focus onto the group while nothing in it is focused yet.
        const group = SGNodeFactory.createNode("ButtonGroup");
        group.setValue("buttons", new RoArray([new BrsString("A"), new BrsString("B")]));

        group.setValue("focusButton", new Int32(0));
        expect(sgRoot.focused).not.toBe(group);
        expect(group.getNodeChildren().includes(sgRoot.focused)).toBe(false);
    });
});
