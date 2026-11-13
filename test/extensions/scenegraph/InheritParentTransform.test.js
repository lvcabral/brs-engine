const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Group, SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsDevice, BrsString, Float, RoArray } = core;

/**
 * `inheritParentTransform = false` (issue #1261) and a rotated Group's own rects (issue #1260).
 * Every expected rect is the device's, from `test/simulator/probes/group-scale-probe` on a Roku
 * Express 4K+, Roku OS 16.0.4: page 1 (`device-trace.txt`, cases S6/S7/S9) and page 3
 * (`device-trace-detach.txt`, cases D0-D11). See that probe's README.
 */

const fakeInterpreter = {};
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

function node(type, fields = {}) {
    const created = SGNodeFactory.createNode(type);
    for (const [name, value] of Object.entries(fields)) {
        if (Array.isArray(value)) {
            created.setValue(name, vector(value));
        } else if (typeof value === "boolean") {
            created.setValue(name, BrsBoolean.from(value));
        } else if (typeof value === "string") {
            created.setValue(name, new BrsString(value));
        } else {
            created.setValue(name, new Float(value));
        }
    }
    return created;
}

function tree(type, fields, children = []) {
    const parent = node(type, fields);
    for (const child of children) {
        parent.appendChildToParent(child);
    }
    return parent;
}

function rounded(rect) {
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

function rects(target) {
    return {
        local: rounded(target.getBoundingRect("local", fakeObserverInterpreter)),
        parent: rounded(target.getBoundingRect("toParent", fakeObserverInterpreter)),
        scene: rounded(target.getBoundingRect("toScene", fakeObserverInterpreter)),
    };
}

function box(x, y, width, height) {
    return { x, y, width, height };
}

/**
 * A draw target that records each rect it is asked to fill and the canvas frames around it. A
 * rect drawn inside a `pushTransformReset` frame is in screen units, so it is mapped to the screen
 * only through the scale frames pushed after that reset.
 */
function recordingDraw2D() {
    const rec = {
        rects: [],
        resets: 0,
        frames: [],
        doDrawRotatedRect(rect, color, rotation, center, opacity, scaleX = 1, scaleY = 1) {
            let { x, y } = rect;
            let width = rect.width * scaleX;
            let height = rect.height * scaleY;
            for (let i = rec.frames.length - 1; i >= 0 && rec.frames[i] !== "reset"; i--) {
                const [px, py, sx, sy] = rec.frames[i];
                x = px + (x - px) * sx;
                y = py + (y - py) * sy;
                width *= sx;
                height *= sy;
            }
            rec.rects.push({ color, rotation, rect: rounded({ x, y, width, height }) });
        },
        doDrawRotatedText() {},
        doDrawScaledObject() {},
        doDrawRotatedBitmap() {},
        doDrawCroppedBitmap() {},
        drawNinePatch() {},
        pushClip() {},
        popClip() {},
        pushScale() {
            return false;
        },
        popScale() {},
        pushScaleFrame(px, py, sx, sy) {
            rec.frames.push([px, py, sx, sy]);
            return rec.frames.length - 1;
        },
        pushTransformReset() {
            rec.resets++;
            rec.frames.push("reset");
            return rec.frames.length - 1;
        },
        popScaleFrame(depth) {
            if (depth >= 0) {
                rec.frames.length = depth;
            }
        },
    };
    return rec;
}

/** The screen box a Rectangle of `color` was filled at. */
function drawnAt(rec, color) {
    const found = rec.rects.find((entry) => entry.color === color);
    return found?.rect;
}

beforeAll(() => {
    const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
    BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
});

afterEach(() => {
    sgRoot.setFocused();
});

describe("a rotated Group's own rects (#1260)", () => {
    test("a Group rotated 90deg reports its rotated local rect in its parent and scene", () => {
        // Device S6.
        const r6 = node("Rectangle", { width: 100, height: 100, rotation: 0.7853982, scaleRotateCenter: [50, 50] });
        const g6 = tree("Group", { translation: [1400, 100], rotation: 1.5707963 }, [r6]);
        tree("Group", {}, [g6]).renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rects(g6)).toEqual({
            local: box(-21, -21, 141, 141),
            parent: box(1379, -21, 141, 141),
            scene: box(1379, -21, 141, 141),
        });
        expect(rects(r6).scene).toEqual(box(1379, -21, 141, 141));
    });

    test("a Group rotated 180deg around its center reports the turned rect", () => {
        // Device S9.
        const chip = node("Rectangle", { width: 32, height: 32 });
        const spun = tree("Group", { translation: [1300, 800], scaleRotateCenter: [32, 32], rotation: 3.14159265 }, [
            chip,
        ]);
        tree("Group", {}, [spun]).renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rects(spun).parent).toEqual(box(1332, 832, 32, 32));
        expect(rects(spun).scene).toEqual(box(1332, 832, 32, 32));
        expect(rects(chip).scene).toEqual(box(1332, 832, 32, 32));
    });

    test("a Group wrapping a marker under a 90deg-rotated host covers the turned marker", () => {
        // layout-measure-probe case R: host [600,320] rotated 90deg, child Group at [100,0].
        const marker = node("Rectangle", { width: 20, height: 20 });
        const inner = tree("Group", { translation: [100, 0] }, [marker]);
        const host = tree("Group", { translation: [600, 320], rotation: Math.PI / 2 }, [inner]);
        tree("Group", {}, [host]).renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rects(inner).scene).toEqual(box(600, 200, 20, 20));
    });
});

describe("inheritParentTransform = false (#1261)", () => {
    test("draws at its own translation in scene space and reports its local rect", () => {
        // Device S7.
        const r7 = node("Rectangle", {
            translation: [40, 40],
            width: 64,
            height: 64,
            color: "0xE08040FF",
            inheritParentTransform: false,
        });
        const r7b = node("Rectangle", { translation: [200, 40], width: 64, height: 64, color: "0x8040E0FF" });
        const g7 = tree("Group", { translation: [1400, 420], scale: [0.5, 0.5] }, [r7, r7b]);
        const draw2D = recordingDraw2D();
        tree("Group", {}, [g7]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(drawnAt(draw2D, 0xe08040ff | 0)).toEqual(box(40, 40, 64, 64));
        expect(drawnAt(draw2D, 0x8040e0ff | 0)).toEqual(box(1500, 440, 32, 32));
        expect(draw2D.resets).toBe(1);
        expect(rects(r7)).toEqual({ local: box(0, 0, 64, 64), parent: box(0, 0, 64, 64), scene: box(0, 0, 64, 64) });
        expect(rects(r7b)).toEqual({
            local: box(0, 0, 64, 64),
            parent: box(200, 40, 64, 64),
            scene: box(1500, 440, 32, 32),
        });
        expect(rects(g7)).toEqual({
            local: box(0, 0, 264, 104),
            parent: box(1400, 420, 132, 52),
            scene: box(1400, 420, 132, 52),
        });
    });

    test("needs no canvas reset when no ancestor scales", () => {
        // Device D0: a detached child of an untransformed root still reports {0,0,w,h}.
        const d0 = node("Rectangle", { translation: [40, 40], width: 40, height: 40, inheritParentTransform: false });
        const draw2D = recordingDraw2D();
        tree("Group", {}, [d0]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.resets).toBe(0);
        expect(rects(d0).parent).toEqual(box(0, 0, 40, 40));
        expect(rects(d0).scene).toEqual(box(0, 0, 40, 40));
    });

    test("keeps its own scale and rotation, but reports neither", () => {
        // Device D1 and D2.
        const d1 = node("Rectangle", {
            translation: [100, 100],
            width: 200,
            height: 100,
            scale: [0.5, 0.5],
            color: "0xE04040FF",
            inheritParentTransform: false,
        });
        const g1 = tree("Group", { translation: [100, 600], scale: [0.5, 0.5] }, [
            node("Rectangle", { width: 100, height: 100 }),
            d1,
        ]);
        const d2 = node("Rectangle", {
            translation: [400, 100],
            width: 100,
            height: 100,
            rotation: 0.7853982,
            scaleRotateCenter: [50, 50],
            inheritParentTransform: false,
        });
        const g2 = tree("Group", { translation: [400, 700], rotation: 0.5 }, [
            node("Rectangle", { width: 100, height: 100 }),
            d2,
        ]);
        const draw2D = recordingDraw2D();
        tree("Group", {}, [g1, g2]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(drawnAt(draw2D, 0xe04040ff | 0)).toEqual(box(100, 100, 100, 50));
        expect(rects(d1).parent).toEqual(box(0, 0, 200, 100));
        expect(rects(d1).scene).toEqual(box(0, 0, 200, 100));
        expect(rects(g1)).toEqual({
            local: box(0, 0, 200, 100),
            parent: box(100, 600, 100, 50),
            scene: box(100, 600, 100, 50),
        });
        expect(rects(d2).parent).toEqual(box(0, 0, 100, 100));
        expect(rects(g2).parent).toEqual(box(400, 652, 136, 136));
    });

    test("a detached Group places its children from its own transform", () => {
        // Device D3 and D3b: its descendants report scene rects as if nothing were detached.
        const cc3 = node("Rectangle", { translation: [10, 10], width: 20, height: 20, color: "0x000000FF" });
        const c3 = tree("Rectangle", { translation: [20, 30], width: 80, height: 60, color: "0xE0E040FF" }, [cc3]);
        const d3 = tree("Group", { translation: [700, 100], inheritParentTransform: false }, [c3]);
        const g3 = tree("Group", { translation: [700, 700], scale: [0.5, 0.5] }, [
            node("Rectangle", { width: 100, height: 100 }),
            d3,
        ]);
        const c3b = node("Rectangle", { translation: [40, 40], width: 100, height: 100, color: "0x40E0E0FF" });
        const d3b = tree("Group", { translation: [900, 100], scale: [0.5, 0.5], inheritParentTransform: false }, [c3b]);
        const g3b = tree("Group", { translation: [900, 700], scale: [0.5, 0.5] }, [
            node("Rectangle", { width: 100, height: 100 }),
            d3b,
        ]);
        const draw2D = recordingDraw2D();
        tree("Group", {}, [g3, g3b]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(drawnAt(draw2D, 0xe0e040ff | 0)).toEqual(box(720, 130, 80, 60));
        expect(drawnAt(draw2D, 0x000000ff)).toEqual(box(730, 140, 20, 20));
        expect(drawnAt(draw2D, 0x40e0e0ff | 0)).toEqual(box(920, 120, 50, 50));

        expect(rects(d3)).toEqual({
            local: box(20, 30, 80, 60),
            parent: box(20, 30, 80, 60),
            scene: box(20, 30, 80, 60),
        });
        expect(rects(c3)).toEqual({
            local: box(0, 0, 80, 60),
            parent: box(20, 30, 80, 60),
            scene: box(1060, 765, 40, 30),
        });
        expect(rects(cc3).scene).toEqual(box(1065, 770, 10, 10));
        expect(rects(g3).local).toEqual(box(0, 0, 100, 100));
        expect(rects(d3b).parent).toEqual(box(40, 40, 100, 100));
        expect(rects(c3b).scene).toEqual(box(1360, 760, 25, 25));
        expect(rects(g3b).local).toEqual(box(0, 0, 140, 140));
    });

    test("a plain Node between a detached Group and its child passes coordinates through", () => {
        // Device D3's c3, with a plain Node wrapping it inside the detached Group.
        const c3 = node("Rectangle", { translation: [20, 30], width: 80, height: 60, color: "0xE0E040FF" });
        const plain = tree("Node", {}, [c3]);
        const d3 = tree("Group", { translation: [700, 100], inheritParentTransform: false }, [plain]);
        const g3 = tree("Group", { translation: [700, 700], scale: [0.5, 0.5] }, [d3]);
        const draw2D = recordingDraw2D();
        tree("Group", {}, [g3]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(drawnAt(draw2D, 0xe0e040ff | 0)).toEqual(box(720, 130, 80, 60));
        expect(rects(c3).scene).toEqual(box(1060, 765, 40, 30));
    });

    test("items a container places itself report scene rects as if nothing were detached", () => {
        // Like a grid's item components: drawn from an origin the container computes, not from the
        // item's own translation, so the reported scene rect has to follow where the item is drawn.
        class Placer extends Group {
            renderChildNodes(interpreter, origin, angle, opacity, draw2D) {
                for (const [index, child] of this.getNodeChildren().entries()) {
                    child.renderNode(interpreter, [origin[0] + 50, origin[1] + 60 * index], angle, opacity, draw2D);
                }
            }
        }
        function build(detached) {
            const items = [0, 1, 2].map(() => node("Rectangle", { width: 200, height: 50 }));
            const placer = new Placer();
            for (const item of items) {
                placer.appendChildToParent(item);
            }
            const wrapper = tree("Group", { translation: [100, 40], inheritParentTransform: detached }, [placer]);
            const root = tree("Group", {}, [tree("Group", { translation: [700, 300], scale: [0.5, 0.5] }, [wrapper])]);
            root.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());
            return items.map((item) => rects(item).scene);
        }

        const attached = build(false);
        expect(attached[1]).toEqual(box(775, 350, 100, 25));
        expect(build(true)).toEqual(attached);
    });

    test("an empty detached Group reports an empty rect at its origin", () => {
        const empty = node("Group", { translation: [300, 200], inheritParentTransform: false });
        const parent = tree("Group", { translation: [50, 50] }, [node("Rectangle", { width: 10, height: 10 }), empty]);
        tree("Group", {}, [parent]).renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rects(empty).parent).toEqual(box(0, 0, 0, 0));
        expect(rects(empty).scene).toEqual(box(0, 0, 0, 0));
        expect(rects(parent).local).toEqual(box(0, 0, 10, 10));
    });

    test("drops every ancestor's transform, and its rect unions through them", () => {
        // Device D4.
        const d4 = node("Rectangle", {
            translation: [1100, 100],
            width: 80,
            height: 80,
            color: "0xE040E0FF",
            inheritParentTransform: false,
        });
        const g4b = tree("Group", { translation: [50, 50], rotation: 1.5707963, scale: [2, 2] }, [
            node("Rectangle", { width: 40, height: 20 }),
            d4,
        ]);
        const g4 = tree("Group", { translation: [1100, 650] }, [node("Rectangle", { width: 50, height: 50 }), g4b]);
        const draw2D = recordingDraw2D();
        tree("Group", {}, [g4]).renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        const drawn = draw2D.rects.find((entry) => entry.color === (0xe040e0ff | 0));
        expect(drawn.rect).toEqual(box(1100, 100, 80, 80));
        expect(drawn.rotation).toBe(0);
        expect(rects(d4).scene).toEqual(box(0, 0, 80, 80));
        expect(rects(g4b).local).toEqual(box(0, 0, 80, 80));
        expect(rects(g4b).parent).toEqual(box(50, -110, 160, 160));
        expect(rects(g4).local).toEqual(box(0, -110, 210, 160));
    });

    test("tracks rendering where it is drawn, not where it reports", () => {
        // Device D5 (positions scaled to the default 1280x720 scene): drawn off-screen reads
        // "none" and hanging over an edge reads "partial", though both report {0,0,w,h}.
        const fields = { width: 64, height: 64, enableRenderTracking: true, inheritParentTransform: false };
        const off = node("Rectangle", { ...fields, translation: [-500, 300] });
        const edge = node("Rectangle", { ...fields, translation: [1250, 680] });
        tree("Group", {}, [tree("Group", { translation: [800, 300] }, [off, edge])]).renderNode(
            fakeInterpreter,
            [0, 0],
            0,
            1,
            recordingDraw2D()
        );

        expect(off.getValueJS("renderTracking")).toBe("none");
        expect(edge.getValueJS("renderTracking")).toBe("partial");
    });

    test("a LayoutGroup still gives a detached item its slot", () => {
        // Device D11: the item is laid out to [0,60] and drawn there in scene space.
        const a11 = node("Rectangle", { width: 100, height: 50 });
        const b11 = node("Rectangle", { width: 100, height: 50, color: "0xFF8080FF", inheritParentTransform: false });
        const c11 = node("Rectangle", { width: 100, height: 50 });
        const lg11 = tree("LayoutGroup", { translation: [100, 250], layoutDirection: "vert", itemSpacings: [10] }, [
            a11,
            b11,
            c11,
        ]);
        const root = tree("Group", {}, [lg11]);
        root.renderNode(fakeInterpreter, [0, 0], 0, 1);
        const draw2D = recordingDraw2D();
        root.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(b11.getValueJS("translation")).toEqual([0, 60]);
        expect(c11.getValueJS("translation")).toEqual([0, 120]);
        expect(drawnAt(draw2D, 0xff8080ff | 0)).toEqual(box(0, 60, 100, 50));
        expect(rects(b11).parent).toEqual(box(0, 0, 100, 50));
        expect(rects(lg11).local).toEqual(box(0, 0, 100, 170));
    });

    test("setting the field back to true re-attaches the node", () => {
        const child = node("Rectangle", {
            translation: [40, 40],
            width: 64,
            height: 64,
            color: "0xE08040FF",
            inheritParentTransform: "false",
        });
        const root = tree("Group", {}, [tree("Group", { translation: [1000, 400], scale: [0.5, 0.5] }, [child])]);
        const detached = recordingDraw2D();
        root.renderNode(fakeInterpreter, [0, 0], 0, 1, detached);
        child.setValue("inheritParentTransform", BrsBoolean.True);
        const attached = recordingDraw2D();
        root.renderNode(fakeInterpreter, [0, 0], 0, 1, attached);

        expect(drawnAt(detached, 0xe08040ff | 0)).toEqual(box(40, 40, 64, 64));
        expect(drawnAt(attached, 0xe08040ff | 0)).toEqual(box(1020, 420, 32, 32));
        expect(attached.resets).toBe(0);
        expect(rects(child).scene).toEqual(box(1020, 420, 32, 32));
    });
});
