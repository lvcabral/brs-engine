const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, Node } = scenegraph;
const { BrsDevice, BrsString, Int32 } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/**
 * Builds a root → channels → programs ContentNode tree.
 * `channels` is an array of { title, programs: [{ title, start, duration }] }.
 */
function buildContent(channels) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const channel of channels) {
        const channelNode = SGNodeFactory.createNode("ContentNode");
        channelNode.setValue("title", new BrsString(channel.title));
        for (const program of channel.programs) {
            const programNode = SGNodeFactory.createNode("ContentNode");
            programNode.setValue("title", new BrsString(program.title));
            programNode.setValue("playStart", new Int32(program.start));
            programNode.setValue("playDuration", new Int32(program.duration));
            channelNode.appendChildToParent(programNode);
        }
        root.appendChildToParent(channelNode);
    }
    return root;
}

describe("TimeGrid node", () => {
    beforeAll(() => {
        // TimeGrid resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("is wired into the factory as a TimeGrid subtype", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        expect(grid).toBeDefined();
        expect(grid.constructor.name).toBe("TimeGrid");
        expect(grid.nodeSubtype).toBe("TimeGrid");
    });

    test("exposes the documented default fields, types and values", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        const fields = grid.getNodeFields();

        const expected = [
            ["maxDays", "integer", 7],
            ["duration", "double", 9000],
            ["timeBarHeight", "float", 50],
            ["timeLabelColor", "color", 0xffffff99 | 0],
            ["programHorizMargin", "float", 14],
            ["fillProgramGaps", "boolean", false],
            ["showPastTimeScreen", "boolean", true],
            ["channelNoDataText", "string", "No Data Available"],
            ["minimumNowBarOffset", "integer", 300],
        ];
        for (const [name, type, value] of expected) {
            const field = fields.get(name.toLowerCase()); // the field map is keyed lowercase
            expect(field).toBeDefined();
            expect(field.getType()).toBe(type);
            expect(grid.getValueJS(name)).toBe(value);
        }
    });

    test("programFocusedDetails is a valid AA from construction (never invalid to read)", () => {
        // An observer of programFocused/channelFocused reads programFocusedDetails; it must
        // resolve to an associative array even before any focus change or content is set,
        // otherwise BrightScript dot-access on it throws (as seen on the EPG sample).
        const grid = SGNodeFactory.createNode("TimeGrid");
        const details = grid.getValueJS("programFocusedDetails");
        expect(details).toBeDefined();
        expect(details).not.toBeNull();
        expect(typeof details).toBe("object");
        expect(details.focusChannelIndex).toBe(0);
        expect(details.focusIndex).toBe(0);
    });

    test("extends ArrayGrid (inherits ArrayGrid + Group fields)", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        const fields = grid.getNodeFields();
        for (const field of ["content", "numrows", "focusbitmapuri", "translation", "opacity", "visible"]) {
            expect(fields.get(field)).toBeDefined();
        }
    });

    test("navigation updates the read-only focus/selection event fields", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        const base = 1_000_000_000; // fixed past epoch so "now" is always to the right of content
        grid.setValue("contentStartTime", new Int32(base));
        grid.setValue("numRows", new Int32(2));

        const content = buildContent([
            {
                title: "Channel A",
                programs: [
                    { title: "A1", start: base, duration: 1800 },
                    { title: "A2", start: base + 1800, duration: 1800 },
                ],
            },
            {
                title: "Channel B",
                programs: [
                    { title: "B1", start: base, duration: 3600 },
                    { title: "B2", start: base + 3600, duration: 1800 },
                ],
            },
        ]);
        grid.setValue("content", content);

        // Initial focus: channel 0, program 0
        expect(grid.getValueJS("channelFocused")).toBe(0);
        expect(grid.getValueJS("programFocused")).toBe(0);

        // Right → next program in the same channel
        expect(grid.handleKey("right", true)).toBe(true);
        expect(grid.getValueJS("channelFocused")).toBe(0);
        expect(grid.getValueJS("programFocused")).toBe(1);

        // Down → next channel; the time-coherent pick lands on the program covering the
        // current focus time (base+1800), which is still B1 (base..base+3600).
        expect(grid.handleKey("down", true)).toBe(true);
        expect(grid.getValueJS("channelFocused")).toBe(1);
        expect(grid.getValueJS("programFocused")).toBe(0);

        const details = grid.getValueJS("programFocusedDetails");
        expect(details.focusChannelIndex).toBe(1);
        expect(details.focusIndex).toBe(0);

        // OK → selection events reflect the focused cell
        expect(grid.handleKey("OK", true)).toBe(true);
        expect(grid.getValueJS("channelSelected")).toBe(1);
        expect(grid.getValueJS("programSelected")).toBe(0);
    });

    test("emits paired events in an order safe for observers of the trigger field", () => {
        // A field observer fires synchronously when its field changes, so the "combined"
        // field (programFocusedDetails / channelSelected) must be written BEFORE the field an
        // app typically observes (programFocused / programSelected) — otherwise the observer
        // reads a stale sibling value.
        const grid = SGNodeFactory.createNode("TimeGrid");
        const base = 1_000_000_000;
        grid.setValue("contentStartTime", new Int32(base));
        grid.setValue("numRows", new Int32(2));
        grid.setValue(
            "content",
            buildContent([
                { title: "Channel A", programs: [{ title: "A1", start: base, duration: 3600 }] },
                { title: "Channel B", programs: [{ title: "B1", start: base, duration: 3600 }] },
            ])
        );

        const writes = () => spy.mock.calls.map((call) => String(call[0]).toLowerCase());
        const spy = jest.spyOn(Node.prototype, "setValue");

        // Focus change: details must precede the focused-index events.
        grid.handleKey("down", true);
        let names = writes();
        expect(names.indexOf("programfocuseddetails")).toBeGreaterThanOrEqual(0);
        expect(names.indexOf("programfocuseddetails")).toBeLessThan(names.indexOf("programfocused"));
        expect(names.indexOf("programfocuseddetails")).toBeLessThan(names.indexOf("channelfocused"));

        // Selection: channelSelected must precede programSelected.
        spy.mockClear();
        grid.handleKey("OK", true);
        names = writes();
        expect(names.indexOf("channelselected")).toBeGreaterThanOrEqual(0);
        expect(names.indexOf("channelselected")).toBeLessThan(names.indexOf("programselected"));

        spy.mockRestore();
    });

    test("fillProgramGaps inserts a No-Data cell between non-contiguous programs", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        const base = 1_000_000_000;
        grid.setValue("contentStartTime", new Int32(base));
        grid.setValue("fillProgramGaps", core.BrsBoolean.True);

        const content = buildContent([
            {
                title: "Channel A",
                programs: [
                    { title: "A1", start: base, duration: 1800 },
                    // gap from base+1800 .. base+3600
                    { title: "A2", start: base + 3600, duration: 1800 },
                ],
            },
        ]);
        grid.setValue("content", content);

        // Right twice: A1 → gap cell → A2 (the synthesized gap is a real navigable cell).
        grid.handleKey("right", true);
        expect(grid.getValueJS("programFocused")).toBe(1);
        grid.handleKey("right", true);
        expect(grid.getValueJS("programFocused")).toBe(2);
    });

    test("renders without a draw surface", () => {
        const grid = SGNodeFactory.createNode("TimeGrid");
        const base = 1_000_000_000;
        grid.setValue("contentStartTime", new Int32(base));
        const content = buildContent([
            { title: "Channel A", programs: [{ title: "A1", start: base, duration: 3600 }] },
        ]);
        grid.setValue("content", content);
        expect(() => grid.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
    });
});
