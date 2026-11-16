const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray, RoMessagePort } = core;

/**
 * In-place changes to a list's content node (DEVICE-MEASURED, test/simulator/probes/focus-populate-buttons-probe
 * A1-A6): nothing is published at the write; once the handler returns, a focused list publishes `itemFocused`
 * for the item it is on. Unit tests have no message loop, so they call `flushContentFocus()` where a device would
 * have returned from the handler.
 */
describe("List in-place content changes", () => {
    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
    let now;
    let log;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        now = 300_000;
        sgClock.setSource({ now: () => now, perfNow: () => now });
        log = [];
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.uiTransitionsEnabled = false;
        sgRoot.setFocused();
    });

    function observe(node, fields = ["itemFocused"]) {
        const port = new RoMessagePort();
        port.pushMessage = (event) => {
            log.push(`${event.fieldName.getValue()}=${event.fieldValue?.getValue?.()}`);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
    }

    function item(title) {
        const node = SGNodeFactory.createNode("ContentNode");
        node.setValue("title", new BrsString(title));
        return node;
    }

    function fill(content, count, prefix = "I") {
        const start = content.getNodeChildren().length;
        for (let i = 0; i < count; i++) {
            content.appendChildToParent(item(`${prefix}${start + i}`));
        }
    }

    function makeList(type, count) {
        const list = SGNodeFactory.createNode(type);
        list.setValue("itemSize", new RoArray([new Float(400), new Float(48)]));
        list.setValue("numRows", new Int32(4));
        const content = SGNodeFactory.createNode("ContentNode");
        fill(content, count);
        list.setValue("content", content);
        list.setNodeFocus(true);
        list.flushContentFocus();
        return list;
    }

    test("a focused list filled in place publishes item 0 once the handler returns, not at each write", () => {
        const list = SGNodeFactory.createNode("MarkupGrid");
        list.setValue("numColumns", new Int32(4));
        const content = SGNodeFactory.createNode("ContentNode");
        list.setValue("content", content);
        observe(list);

        list.setNodeFocus(true);
        expect(log).toEqual(["itemFocused=-1"]); // A gain on an empty list.
        fill(content, 6);
        expect(log).toEqual(["itemFocused=-1"]);
        list.flushContentFocus();
        expect(log).toEqual(["itemFocused=-1", "itemFocused=0"]);
    });

    test("an unfocused list takes item 0 silently when its first item arrives", () => {
        const list = SGNodeFactory.createNode("LabelList");
        const content = SGNodeFactory.createNode("ContentNode");
        list.setValue("content", content);
        observe(list);

        fill(content, 3);
        expect(list.getValueJS("itemFocused")).toBe(0);
        list.flushContentFocus();
        expect(log).toEqual([]);
    });

    test("publishes the data index, not the position, in a sectioned grid", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numColumns", new Int32(4));
        const root = SGNodeFactory.createNode("ContentNode");
        for (const [title, count] of [
            ["S1", 3],
            ["S2", 4],
        ]) {
            const section = SGNodeFactory.createNode("ContentNode");
            section.setValue("ContentType", new BrsString("section"));
            section.setValue("title", new BrsString(title));
            fill(section, count, title);
            root.appendChildToParent(section);
        }
        grid.setValue("content", root);
        grid.setNodeFocus(true);
        grid.flushContentFocus();
        // Section 1 pads its row with one placeholder, so data item 3 sits at position 4.
        grid.setValue("jumpToItem", new Int32(3));
        observe(grid);

        const section = SGNodeFactory.createNode("ContentNode");
        section.setValue("ContentType", new BrsString("section"));
        fill(section, 2, "S3");
        root.appendChildToParent(section);
        grid.flushContentFocus();
        expect(log).toEqual(["itemFocused=3"]);
    });

    test("removing the items below the focus moves it to the last item left", () => {
        const list = makeList("LabelList", 8);
        list.setValue("jumpToItem", new Int32(7));
        observe(list, ["itemFocused", "currFocusRow"]);
        const content = list.getValue("content");

        content.removeChildrenAtIndex(4, 4);
        expect(content.getNodeChildren().length).toBe(4);
        list.flushContentFocus();
        expect(log).toEqual(["currFocusRow=3", "itemFocused=3"]);

        // The cursor moved too: the next key goes up from item 3.
        log.length = 0;
        list.handleKey("up", true);
        expect(log).toContain("itemFocused=2");
    });

    test("an in-place change during a focus motion leaves the publish to the settle", () => {
        sgRoot.uiTransitionsEnabled = true;
        const list = makeList("MarkupList", 10);
        observe(list);

        list.handleKey("down", true);
        list.handleKey("down", false);
        expect(list.motion).toBeDefined();
        fill(list.getValue("content"), 5);
        list.flushContentFocus();
        expect(log).toEqual([]);
        for (let t = 0; t < 1000; t += 16) {
            now += 16;
            sgRoot.processTransitions();
        }
        expect(log).toEqual(["itemFocused=1"]);
    });

    test("a gain rebuilds the content view when another consumer cleared the shared changed flag", () => {
        const content = SGNodeFactory.createNode("ContentNode");
        const other = SGNodeFactory.createNode("LabelList");
        const list = SGNodeFactory.createNode("LabelList");
        other.setValue("content", content);
        list.setValue("content", content);
        fill(content, 3);
        // The other list's render parses the content and clears the flag both lists share.
        content.changed = false;
        observe(list);

        list.setNodeFocus(true);
        expect(log).toEqual(["itemFocused=0"]);
    });
});
