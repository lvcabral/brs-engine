const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, RoArray, Interpreter } = core;

/**
 * Regression: a subtree whose accumulated opacity is 0 used to do a FULL paint — every draw call
 * was issued and the subtree's invisibility depended entirely on the final globalAlpha write being
 * correct. Any lost alpha downstream (e.g. a blend color of 0x00000000, see BlendColorAlpha) then
 * painted a faded-out node at full strength over the visible screen. Apps commonly hide UI with
 * opacity = 0 rather than visible = false, so the paint must stop at the transparent node.
 *
 * The skip is PAINT-ONLY: layout keeps propagating opacity 0 so UI under a faded-out ancestor still
 * computes bounding rects (the same guarantee HiddenMeasure pins for visible = false).
 */
describe("a fully transparent subtree is not painted", () => {
    let interpreter;

    beforeAll(() => {
        // Grids resolve fonts and the focus/footprint 9-patches from the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** Records every drawing call the SceneGraph nodes can make, so "painted nothing" is verifiable. */
    function recordingDraw2D() {
        const calls = [];
        const record = (name) => {
            return (...args) => {
                calls.push({ name, args });
            };
        };
        return {
            calls,
            doClearCanvas: record("doClearCanvas"),
            doDrawClearedRect: record("doDrawClearedRect"),
            doDrawCroppedBitmap: record("doDrawCroppedBitmap"),
            doDrawRotatedBitmap: record("doDrawRotatedBitmap"),
            doDrawRotatedRect: record("doDrawRotatedRect"),
            doDrawRotatedText: record("doDrawRotatedText"),
            doDrawScaledObject: record("doDrawScaledObject"),
            drawNinePatch: record("drawNinePatch"),
            pushClip: () => {},
            popClip: () => {},
            resetClips: () => {},
        };
    }

    /**
     * Scene > Group > LabelList (two items) — an unfocused list, which is the case that draws the
     * focus FOOTPRINT 9-patch, plus a Rectangle sibling inside the group so a second draw kind is
     * covered. LabelList renders its own items (no itemComponentName needed).
     */
    function buildList() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        const list = SGNodeFactory.createNode("LabelList");
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(100));
        rect.setValue("height", new Float(50));

        const content = SGNodeFactory.createNode("ContentNode");
        for (const title of ["A", "B"]) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(title));
            content.appendChildToParent(item);
        }
        list.setValue("content", content);

        group.appendChildToParent(list);
        group.appendChildToParent(rect);
        scene.appendChildToParent(group);
        return { scene, group, list, rect };
    }

    // Every way a subtree can reach accumulated opacity 0. All three used to issue the list's footprint
    // drawNinePatch, its item text and the sibling rectangle, relying on globalAlpha to stay invisible.
    // The third is the one the incoming-opacity-only test missed: the template receives only the
    // ANCESTORS' opacity (each renderNodeContent folds its own in later), so testing that value alone
    // still painted a node an app had faded out directly — the common single-widget fade.
    test.each([
        ["the traversal root's own opacity is 0", ({ group }) => group.setValue("opacity", new Float(0)), 1],
        ["the incoming accumulated opacity is 0", ({ group }) => group.setValue("opacity", new Float(0.5)), 0],
        [
            "each child is faded out under an opaque parent",
            ({ list, rect }) => {
                list.setValue("opacity", new Float(0));
                rect.setValue("opacity", new Float(0));
            },
            1,
        ],
    ])("no draw calls at all when %s", (_label, fade, incomingOpacity) => {
        const tree = buildList();
        fade(tree);
        const draw2D = recordingDraw2D();

        tree.group.paintNode(interpreter, [0, 0], 0, incomingOpacity, draw2D);

        expect(draw2D.calls).toHaveLength(0);
    });

    test("the same tree at full opacity still paints the footprint frame", () => {
        const { group } = buildList();
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // Pins that the guard is opacity-0 only, and that this tree really does draw a footprint.
        expect(draw2D.calls.some((call) => call.name === "drawNinePatch")).toBe(true);
        expect(draw2D.calls.some((call) => call.name === "doDrawRotatedRect")).toBe(true);
    });

    test("a transparent subtree contributes the same ancestor bounds as a layout pass", () => {
        // The skip degrades to a layout traversal rather than returning early: an early return would
        // union a rect the subtree never computed ({0,0,0,0} for a node faded out before its first
        // layout), inflating the parent's bounds toward that node's translation for every later frame.
        function build(opacity) {
            const parent = SGNodeFactory.createNode("Group");
            const shown = SGNodeFactory.createNode("Group");
            const near = SGNodeFactory.createNode("Rectangle");
            near.setValue("width", new Float(100));
            near.setValue("height", new Float(100));
            shown.appendChildToParent(near);
            shown.setValue("translation", new RoArray([new Float(300), new Float(300)]));
            const faded = SGNodeFactory.createNode("Group");
            const far = SGNodeFactory.createNode("Rectangle");
            far.setValue("width", new Float(100));
            far.setValue("height", new Float(100));
            faded.appendChildToParent(far);
            faded.setValue("translation", new RoArray([new Float(500), new Float(500)]));
            faded.setValue("opacity", new Float(opacity));
            parent.appendChildToParent(shown);
            parent.appendChildToParent(faded);
            return parent;
        }

        const painted = build(0);
        painted.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
        const laidOut = build(0);
        laidOut.layoutNode(interpreter, [0, 0], 0, 1);
        const opaque = build(1);
        opaque.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());

        // A faded child is unioned by layout, so paint must union it identically — and identically to
        // the same tree with the child opaque. An early return gave width/height 200 here, not 300.
        expect(painted.rectToParent).toEqual(laidOut.rectToParent);
        expect(painted.rectToParent).toEqual(opaque.rectToParent);
        expect(painted.rectToParent.width).toBe(300);
    });

    test("layout still runs under an opacity-0 ancestor, so boundingRect() is unaffected", () => {
        const transparent = buildList();
        transparent.group.setValue("opacity", new Float(0));
        transparent.group.setValue("translation", new RoArray([new Float(40), new Float(60)]));
        const opaque = buildList();
        opaque.group.setValue("translation", new RoArray([new Float(40), new Float(60)]));

        const hiddenRect = transparent.list.getBoundingRect("toScene", interpreter);
        const shownRect = opaque.list.getBoundingRect("toScene", interpreter);

        // The paint skip must not reach the layout pass: a faded-out list measures exactly like the
        // shown one (apps size and position UI from boundingRect() before revealing it).
        expect(hiddenRect.width).toBeGreaterThan(0);
        expect(hiddenRect.height).toBeGreaterThan(0);
        expect(hiddenRect).toEqual(shownRect);
    });

    test("a transparent node and its descendants report renderTracking 'none'", () => {
        const { group, list, rect } = buildList();
        for (const node of [group, list, rect]) {
            node.setValue("enableRenderTracking", BrsBoolean.True);
        }
        group.setValue("opacity", new Float(0));
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // The reference puts opacity 0 in the same "none" bucket as visible = false. Because the skip
        // degrades to a traversal, every descendant reaches its own nodeRenderingDone and reports it —
        // an early return would have left theirs at whatever the last painted frame set.
        expect(group.getValueJS("renderTracking")).toBe("none");
        expect(list.getValueJS("renderTracking")).toBe("none");
        expect(rect.getValueJS("renderTracking")).toBe("none");
    });

    test("a revealed subtree paints again on the next frame", () => {
        const { group } = buildList();
        group.setValue("opacity", new Float(0));
        group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());

        group.setValue("opacity", new Float(1));
        const draw2D = recordingDraw2D();
        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // isDirty is deliberately left set by the skip, so nothing stays frozen after a reveal.
        expect(draw2D.calls.some((call) => call.name === "drawNinePatch")).toBe(true);
    });

    /**
     * Dropping draw2D makes a suppressed paint LOOK like a layout pass from inside a node, and a handful of
     * sites legitimately do layout-pass-only work off that signal. They must keep behaving as what this is
     * — a paint frame — which is why `sgRoot.paintSuppressed` exists and `Node.isLayoutPass` is asked
     * instead of testing draw2D directly.
     */
    describe("a suppressed paint is not mistaken for a layout pass", () => {
        /**
         * A LayoutGroup that never settles, so the convergence loop actually iterates — the only way the
         * pass cap (MAX_LAYOUT_PASSES on a layout pass, 1 on a real frame) is observable. A naturally
         * settling tree reports 1 either way and would make the assertion vacuous.
         */
        function buildNeverSettling() {
            const wrapper = SGNodeFactory.createNode("Group");
            const layout = SGNodeFactory.createNode("LayoutGroup");
            const rect = SGNodeFactory.createNode("Rectangle");
            rect.setValue("width", new Float(100));
            rect.setValue("height", new Float(20));
            layout.appendChildToParent(rect);
            wrapper.appendChildToParent(layout);
            const synchronize = layout.synchronizeChildMetrics.bind(layout);
            layout.synchronizeChildMetrics = (...args) => {
                synchronize(...args);
                layout.layoutDirty = true;
            };
            return { wrapper, layout };
        }

        test("a LayoutGroup under a faded ancestor still runs a single pass", () => {
            // A layout pass converges to a fixed point within the one call; a real frame keeps ONE pass and
            // defers its correction to the next. A faded LayoutGroup is still a real frame, so a raw
            // !draw2D check handed it convergence semantics — up to 8 passes per painted frame — for the
            // whole duration of every fade transition.
            const faded = buildNeverSettling();
            faded.wrapper.setValue("opacity", new Float(0));
            faded.wrapper.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
            expect(faded.layout.lastPassCount).toBe(1);

            // Same tree opaque: also 1, so the assertion above is about the pass KIND, not the tree.
            const opaque = buildNeverSettling();
            opaque.wrapper.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
            expect(opaque.layout.lastPassCount).toBe(1);

            // ...and a real layout pass still gets its full convergence budget, or the fix went too far.
            const laidOut = buildNeverSettling();
            laidOut.wrapper.layoutNode(interpreter, [0, 0], 0, 1);
            expect(laidOut.layout.lastPassCount).toBeGreaterThan(1);
        });

        test("a hidden grid inside a faded ancestor does not measure its hidden extent", () => {
            // measureHiddenExtent is not a pure measurement — it refreshes content — so it belongs to layout
            // passes only. Three-way, because a two-way version passes vacuously.
            function build() {
                const group = SGNodeFactory.createNode("Group");
                const list = SGNodeFactory.createNode("LabelList");
                const content = SGNodeFactory.createNode("ContentNode");
                for (const title of ["A", "B"]) {
                    const item = SGNodeFactory.createNode("ContentNode");
                    item.setValue("title", new BrsString(title));
                    content.appendChildToParent(item);
                }
                list.setValue("content", content);
                list.setValue("visible", BrsBoolean.False);
                group.appendChildToParent(list);
                return { group, list };
            }
            const measured = [];
            function spy({ group, list }) {
                list.measureHiddenExtent = () => measured.push(list);
                return { group, list };
            }

            const faded = spy(build());
            faded.group.setValue("opacity", new Float(0));
            faded.group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
            expect(measured).toHaveLength(0); // a painted frame, however transparent

            const opaque = spy(build());
            opaque.group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
            expect(measured).toHaveLength(0); // paint hard-skips a hidden grid

            const laidOut = spy(build());
            laidOut.group.layoutNode(interpreter, [0, 0], 0, 1);
            expect(measured).toHaveLength(1); // ...but a real layout pass must still measure it
        });

        /**
         * The other direction of the same trap: a REAL layout pass started from inside a suppressed paint
         * must not inherit the suppression. `getBoundingRect`'s mid-render fallback and
         * `LayoutGroup.measureUnsizedChildren` both call `layoutNode` from within the paint traversal, so
         * this is reachable on every fade — an app observer or an item component's `init()` measuring
         * during the frame.
         */
        test("a layout pass started inside a suppressed paint is still a layout pass", () => {
            function build(fade) {
                const wrapper = SGNodeFactory.createNode("Group");
                const probe = SGNodeFactory.createNode("Rectangle");
                probe.setValue("width", new Float(10));
                probe.setValue("height", new Float(10));
                const list = SGNodeFactory.createNode("LabelList");
                const content = SGNodeFactory.createNode("ContentNode");
                for (const title of ["A", "B"]) {
                    const item = SGNodeFactory.createNode("ContentNode");
                    item.setValue("title", new BrsString(title));
                    content.appendChildToParent(item);
                }
                list.setValue("content", content);
                list.setValue("visible", BrsBoolean.False);
                wrapper.appendChildToParent(probe);
                wrapper.appendChildToParent(list);
                if (fade) {
                    wrapper.setValue("opacity", new Float(0));
                }
                return { wrapper, probe, list };
            }

            // Query a hidden grid's bounds from code running mid-frame, exactly as an app observer would.
            function measureMidFrame(fade) {
                const { wrapper, probe, list } = build(fade);
                let measured;
                const originalContent = probe.renderNodeContent.bind(probe);
                probe.renderNodeContent = (...args) => {
                    measured = list.getBoundingRect("toScene", interpreter);
                    return originalContent(...args);
                };
                wrapper.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
                return measured;
            }

            // The faded tree must measure identically to the opaque one: layout is independent of
            // visibility, and this returned {0,0,0,0} while the suppression leaked into layoutNode.
            const shown = measureMidFrame(false);
            expect(shown.width).toBeGreaterThan(0);
            expect(measureMidFrame(true)).toEqual(shown);
        });

        test("a layout pass inside a suppressed paint keeps its convergence budget", () => {
            // The other half of the same leak: a mid-frame layoutNode must still converge to a fixed point,
            // or the query that triggered it reads back a pre-convergence size. Measured at the query
            // point, because the LayoutGroup is painted again (1 pass) later in the same frame.
            function measureMidFrame(fade) {
                const wrapper = SGNodeFactory.createNode("Group");
                const probe = SGNodeFactory.createNode("Rectangle");
                probe.setValue("width", new Float(10));
                probe.setValue("height", new Float(10));
                const { layout } = buildNeverSettling();
                wrapper.appendChildToParent(probe);
                wrapper.appendChildToParent(layout);
                if (fade) {
                    wrapper.setValue("opacity", new Float(0));
                }
                let passes;
                const originalContent = probe.renderNodeContent.bind(probe);
                probe.renderNodeContent = (...args) => {
                    layout.layoutNode(interpreter, [0, 0], 0, 1);
                    passes = layout.lastPassCount;
                    return originalContent(...args);
                };
                wrapper.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
                return passes;
            }

            // Was 1 for the faded tree — the suppression leaked in and capped convergence.
            expect(measureMidFrame(true)).toBe(measureMidFrame(false));
            expect(measureMidFrame(true)).toBeGreaterThan(1);
        });

        test("isPaintPass stays true inside a suppressed subtree", () => {
            // The two predicates are NOT each other's negation, and collapsing them would silently defer
            // time-based state to the reveal frame. A BusySpinner advances its rotation on paint only.
            const group = SGNodeFactory.createNode("Group");
            const spinner = SGNodeFactory.createNode("BusySpinner");
            spinner.setValue("uri", new BrsString("common:/images/HD/spinner.png"));
            spinner.setValue("control", new BrsString("start"));
            group.appendChildToParent(spinner);
            group.setValue("opacity", new Float(0));

            let sawPaintPass;
            const originalContent = spinner.renderNodeContent.bind(spinner);
            spinner.renderNodeContent = (interp, origin, angle, opacity, draw2D) => {
                sawPaintPass = spinner.isPaintPass(draw2D);
                return originalContent(interp, origin, angle, opacity, draw2D);
            };

            group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());

            expect(sawPaintPass).toBe(true);
        });

        test("paintSuppressed is scoped, nests, and is restored on a throw", () => {
            expect(sgRoot.paintSuppressed).toBe(false);

            const { group, list } = buildList();
            group.setValue("opacity", new Float(0));
            // Nested: a faded node inside a faded node must restore the OUTER state, not clear it.
            let innerSaw;
            const originalContent = list.renderNodeContent.bind(list);
            list.renderNodeContent = (...args) => {
                innerSaw = sgRoot.paintSuppressed;
                return originalContent(...args);
            };
            list.setValue("opacity", new Float(0));
            group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
            expect(innerSaw).toBe(true);
            expect(sgRoot.paintSuppressed).toBe(false);

            // A throw from app code mid-traversal must not strand the flag for every later frame.
            const thrower = buildList();
            thrower.group.setValue("opacity", new Float(0));
            thrower.list.renderNodeContent = () => {
                throw new Error("app error during a suppressed paint");
            };
            expect(() => thrower.group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D())).toThrow();
            expect(sgRoot.paintSuppressed).toBe(false);
        });
    });
});
