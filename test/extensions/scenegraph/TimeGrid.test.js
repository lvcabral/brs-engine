const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, Node } = scenegraph;
const { BrsDevice, BrsString, Float, Int32 } = core;

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
        const spy = vi.spyOn(Node.prototype, "setValue");

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

    test("pulses scrollingStatus ahead of the settle on the channel-info and time-pan paths", () => {
        // Those three paths (entering/leaving the channel-info column, moving inside it, and panning
        // the time window) publish their focus fields directly instead of going through focusCell, so
        // each has to emit the pulse itself — otherwise the falling edge lands AFTER the settle and an
        // app that tears transient scroll state down on it is left with nothing to rebuild from.
        // See ArrayGrid.armScrollPulse.
        const grid = SGNodeFactory.createNode("TimeGrid");
        const base = 1_000_000_000;
        grid.setValue("contentStartTime", new Int32(base));
        grid.setValue("numRows", new Int32(2));
        grid.setValue("channelInfoFocusable", core.BrsBoolean.True);
        grid.setValue(
            "content",
            buildContent([
                { title: "Channel A", programs: [{ title: "A1", start: base, duration: 3600 }] },
                { title: "Channel B", programs: [{ title: "B1", start: base, duration: 3600 }] },
            ])
        );
        grid.setNodeFocus(true);

        const log = [];
        const port = new core.RoMessagePort();
        port.pushMessage = (event) => {
            log.push(`${event.fieldName.getValue()}=${event.fieldValue?.getValue?.()}`);
        };
        const fields = ["scrollingStatus", "channelInfoFocused", "channelInfoUnfocused", "channelFocused"];
        for (const field of fields) {
            grid.addObserver({ environment: {}, inSubEnv: () => {} }, "unscoped", new BrsString(field), port);
        }

        // Left → into the channel-info column.
        grid.handleKey("left", true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.indexOf("channelInfoFocused=0")).toBeGreaterThan(1);

        // Down → moves within the channel-info column.
        log.length = 0;
        grid.handleKey("down", true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.indexOf("channelInfoUnfocused=0")).toBeGreaterThan(1);
        expect(log.indexOf("channelInfoFocused=1")).toBeGreaterThan(1);

        // Right → back out of the channel-info column.
        log.length = 0;
        grid.handleKey("right", true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.indexOf("channelInfoUnfocused=1")).toBeGreaterThan(1);
        expect(grid.getValueJS("scrollingStatus")).toBe(false);
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

    /**
     * Regression: channelParseCache's invalidation gate used to be the channel's child COUNT
     * alone. That misses in-place mutations that keep the count the same — the same species of
     * bug as the ArrayGrid/RowList item-component cache fixed in ArrayGridItemReorder.test.js, but
     * a different mechanism (a per-channel parse cache, not a position-keyed item-component cache).
     */
    describe("channel parse cache invalidates on in-place program mutation, not just count", () => {
        test("a program replaced in place (same count) is not left stale", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            const content = buildContent([
                {
                    title: "Channel A",
                    programs: [
                        { title: "A1", start: base, duration: 1800 },
                        { title: "A2", start: base + 1800, duration: 1800 },
                    ],
                },
            ]);
            grid.setValue("content", content);
            expect(grid.programs[0][1].getValueJS("title")).toBe("A2");

            // App swaps program index 1 for a different object at the same position (same channel
            // child count) — mirrors an EPG data source replacing a program entry outright.
            // ContentNode.makeDirty only dirties the CONTAINER (the channel), never the replaced
            // child, so a count-only cache gate would keep serving the stale A2 object.
            const channelA = content.getNodeChildren()[0];
            const replacement = SGNodeFactory.createNode("ContentNode");
            replacement.setValue("title", new BrsString("A2-updated"));
            replacement.setValue("playStart", new Int32(base + 1800));
            replacement.setValue("playDuration", new Int32(1800));
            channelA.replaceChildAtIndex(replacement, 1);

            grid.refreshContent();

            expect(grid.programs[0][1].getValueJS("title")).toBe("A2-updated");
        });

        test("a program's PLAYDURATION edited in place (same count) updates the cached cell width", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            const content = buildContent([
                {
                    title: "Channel A",
                    programs: [
                        { title: "A1", start: base, duration: 1800 },
                        { title: "A2", start: base + 1800, duration: 1800 },
                    ],
                },
            ]);
            grid.setValue("content", content);
            expect(grid.programDuration[0][0]).toBe(1800);

            // App corrects A1's schedule in place (e.g. a live event running long) — same object,
            // same channel child count. ContentNode marks the PROGRAM's own `.changed`, not the
            // channel's, so a count-only cache gate never sees this edit.
            const channelA = content.getNodeChildren()[0];
            const a1 = channelA.getNodeChildren()[0];
            a1.setValue("playDuration", new Int32(3600));

            grid.refreshContent();

            expect(grid.programDuration[0][0]).toBe(3600);
        });
    });

    /**
     * Regression: Group.drawText caches each drawn string by a running per-frame index
     * (cachedLines[index]) unless the node isDirty. TimeGrid.renderContent draws every
     * channel-info/time-label/program-title through drawText with ONE running counter across the
     * whole grid, so if a channel's program COUNT shifts between two paints — e.g. an SGDEX-style
     * content manager assigns `content` once, then streams each row's programs in afterward via an
     * in-place append to the SAME already-assigned content tree (never rewriting the `content`
     * field, so Group.setValue's isDirty=true never fires) — every index from that row onward maps
     * to a DIFFERENT logical string than what an earlier paint cached there. Observed on a real
     * SGDEX TimeGridView sample: a program cell whose row was still loading on the first paint later
     * showed the NEXT row's channel name instead of its own (now-loaded) program title, until any
     * key press (which dirties the node through an unrelated field write) forced a fresh redraw.
     */
    describe("a content reparse forces fresh text draws (no stale drawText cache across shifted row/program counts)", () => {
        const stubDraw2D = () => ({
            doDrawRotatedText: () => {},
            doDrawRotatedRect: () => {},
            doDrawRotatedBitmap: () => {},
            drawNinePatch: () => {},
        });

        test("refreshContent marks the node dirty", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            const content = buildContent([
                { title: "Channel A", programs: [{ title: "A1", start: base, duration: 3600 }] },
            ]);
            grid.setValue("content", content);

            // A real paint clears isDirty (Group.nodeRenderingDone, draw2D present).
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, stubDraw2D());
            expect(grid.isDirty).toBe(false);

            // An in-place content mutation (append, matching ContentManagerTimeGrid's per-row async
            // load) never touches a field on the grid itself, so only refreshContent — invoked at
            // the top of the next render because the mutation dirtied the content tree — can be the
            // one to force fresh text draws.
            const channelA = content.getNodeChildren()[0];
            const a2 = SGNodeFactory.createNode("ContentNode");
            a2.setValue("title", new BrsString("A2"));
            a2.setValue("playStart", new Int32(base + 3600));
            a2.setValue("playDuration", new Int32(1800));
            channelA.appendChildToParent(a2);

            grid.refreshContent();
            expect(grid.isDirty).toBe(true);
        });

        test("a row whose programs finish loading after the first paint shows its own title, not the next row's channel name", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            grid.setValue("numRows", new Int32(5));
            grid.setValue("width", new Float(1280));
            grid.setValue("height", new Float(720));

            // Row 3 (0-indexed) starts with NO programs — still loading, like ContentManagerTimeGrid
            // assigning `content` as soon as the channel list arrives, before every row's guide data
            // has come back.
            const content = buildContent([
                { title: "Channel A", programs: [{ title: "Being Gary Busey", start: base, duration: 3600 }] },
                {
                    title: "Channel B",
                    programs: [{ title: "The House Where Evil Dwells", start: base, duration: 3600 }],
                },
                { title: "Channel C", programs: [{ title: "The People's Court", start: base, duration: 3600 }] },
                { title: "KATU 4.1", programs: [] },
                { title: "KAZT 7.1", programs: [{ title: "Taye Diggs Is Here", start: base, duration: 3600 }] },
            ]);
            grid.setValue("content", content);

            // First paint: row 3 draws only its (empty-row) channel info, no program title yet.
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, stubDraw2D());

            // Row 3's program finishes loading: an in-place append to the SAME row ContentNode
            // already held by `content` — `content` itself is never reassigned.
            const row3 = content.getNodeChildren()[3];
            const lateProgram = SGNodeFactory.createNode("ContentNode");
            lateProgram.setValue("title", new BrsString("I Remember, I Remember"));
            lateProgram.setValue("playStart", new Int32(base));
            lateProgram.setValue("playDuration", new Int32(3600));
            row3.appendChildToParent(lateProgram);

            // Second paint: capture the drawn text sequence in order.
            const drawn = [];
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, {
                ...stubDraw2D(),
                doDrawRotatedText: (text) => drawn.push(text),
            });

            // Row 3's channel name is immediately followed by ITS OWN program title — not row 4's
            // channel name ("KAZT 7.1"), which is what a stale cachedLines[index] would serve.
            const row3NameIdx = drawn.indexOf("KATU 4.1");
            expect(row3NameIdx).toBeGreaterThanOrEqual(0);
            expect(drawn[row3NameIdx + 1]).toBe("I Remember, I Remember");
        });
    });

    /**
     * Device-observed: TimeGrid has no `vertFocusAnimationStyle` field (unlike RowList/MarkupList) —
     * its vertical navigation is always "fixed focus": the focused channel is pinned at the TOP of
     * the visible window and the content scrolls under it, and moving up from the first channel (or
     * down from the last) wraps around instead of stopping. Previously the engine floated the
     * highlight through the visible rows (like ArrayGrid's default floatingFocus) and did not wrap.
     */
    describe("vertical navigation is fixed-focus and wraps (device-observed, no vertFocusAnimationStyle field on TimeGrid)", () => {
        function buildChannels(n) {
            const base = 1_000_000_000;
            const channels = [];
            for (let i = 0; i < n; i++) {
                channels.push({ title: `Ch${i}`, programs: [{ title: `P${i}`, start: base, duration: 3600 }] });
            }
            return buildContent(channels);
        }

        test("the focused channel is always the top visible row — content scrolls, focus does not float", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            grid.setValue("contentStartTime", new Int32(1_000_000_000));
            grid.setValue("numRows", new Int32(2));
            grid.setValue("content", buildChannels(5));

            expect(grid.getValueJS("channelFocused")).toBe(0);
            expect(grid.topRow).toBe(0);

            // A floating-focus list would keep topRow at 0 here (channel 1 still fits in a 2-row
            // window starting at 0). A fixed-focus list scrolls immediately.
            grid.handleKey("down", true);
            expect(grid.getValueJS("channelFocused")).toBe(1);
            expect(grid.topRow).toBe(1);

            grid.handleKey("down", true);
            expect(grid.getValueJS("channelFocused")).toBe(2);
            expect(grid.topRow).toBe(2);
        });

        test("up from the first channel wraps to the last; down from the last wraps to the first", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            grid.setValue("contentStartTime", new Int32(1_000_000_000));
            grid.setValue("content", buildChannels(5));

            expect(grid.getValueJS("channelFocused")).toBe(0);
            expect(grid.handleKey("up", true)).toBe(true);
            expect(grid.getValueJS("channelFocused")).toBe(4);
            expect(grid.topRow).toBe(4);

            expect(grid.handleKey("down", true)).toBe(true);
            expect(grid.getValueJS("channelFocused")).toBe(0);
            expect(grid.topRow).toBe(0);
        });

        test("a single-channel grid reports the key unhandled (wrap-to-self is a no-op, matching MarkupList)", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            grid.setValue("contentStartTime", new Int32(1_000_000_000));
            grid.setValue("content", buildChannels(1));

            expect(grid.handleKey("up", true)).toBe(false);
            expect(grid.handleKey("down", true)).toBe(false);
        });

        test("the channel-info column wraps the same way", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            grid.setValue("contentStartTime", new Int32(1_000_000_000));
            grid.setValue("channelInfoFocusable", core.BrsBoolean.True);
            grid.setValue("content", buildChannels(3));

            // Move into the channel-info column, then wrap up from channel 0.
            grid.handleKey("left", true);
            expect(grid.getValueJS("channelInfoFocused")).toBe(0);
            grid.handleKey("up", true);
            expect(grid.getValueJS("channelInfoFocused")).toBe(2);
        });
    });

    /**
     * Device-observed (per the TimeGrid reference and confirmed on a real Roku): with
     * `automaticLoadingDataFeedback` at its default `true`, the program-grid region of a channel row
     * is automatically replaced with `loadingDataText` whenever that row has no program data
     * covering the visible time window — e.g. a row-by-row lazy content loader (like SGDEX's
     * ContentManagerTimeGrid) that hasn't fetched that channel's programs yet. Previously the engine
     * only ever showed this for the WHOLE grid (no channels loaded at all) or in the fully manual
     * `showLoadingDataFeedback` override — never per row once at least one channel had data.
     */
    describe("automatic per-row loading feedback (automaticLoadingDataFeedback)", () => {
        function recordingDraw2D() {
            const drawn = [];
            return {
                draw2D: {
                    doDrawRotatedText: (text) => drawn.push(text),
                    doDrawRotatedRect: () => {},
                    doDrawRotatedBitmap: () => {},
                    drawNinePatch: () => {},
                },
                drawn,
            };
        }

        test("a channel with no programs shows loadingDataText in its row; a loaded channel does not", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            grid.setValue("numRows", new Int32(2));
            grid.setValue(
                "content",
                buildContent([
                    { title: "Loaded", programs: [{ title: "Real Program", start: base, duration: 3600 }] },
                    { title: "NotLoaded", programs: [] },
                ])
            );

            const { draw2D, drawn } = recordingDraw2D();
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            expect(drawn).toContain("Real Program");
            expect(drawn).toContain("Loading Data…");
        });

        test("a custom loadingDataText is used instead of the default", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            grid.setValue("loadingDataText", new BrsString("Please wait..."));
            grid.setValue("content", buildContent([{ title: "NotLoaded", programs: [] }]));

            const { draw2D, drawn } = recordingDraw2D();
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            expect(drawn).toContain("Please wait...");
            expect(drawn).not.toContain("Loading Data…");
        });

        test("disabling automaticLoadingDataFeedback (without showLoadingDataFeedback) shows nothing for an unloaded row", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            grid.setValue("automaticLoadingDataFeedback", core.BrsBoolean.False);
            grid.setValue("content", buildContent([{ title: "NotLoaded", programs: [] }]));

            const { draw2D, drawn } = recordingDraw2D();
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            expect(drawn).not.toContain("Loading Data…");
        });

        test("disabling automaticLoadingDataFeedback but enabling showLoadingDataFeedback covers the whole grid manually", () => {
            const grid = SGNodeFactory.createNode("TimeGrid");
            const base = 1_000_000_000;
            grid.setValue("contentStartTime", new Int32(base));
            grid.setValue("automaticLoadingDataFeedback", core.BrsBoolean.False);
            grid.setValue("showLoadingDataFeedback", core.BrsBoolean.True);
            grid.setValue(
                "content",
                buildContent([{ title: "Loaded", programs: [{ title: "Real Program", start: base, duration: 3600 }] }])
            );

            const { draw2D, drawn } = recordingDraw2D();
            grid.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            // Manual mode is a whole-grid override — pre-existing behavior, unaffected by the
            // per-row automatic detection above.
            expect(drawn).toContain("Loading Data…");
        });
    });
});
