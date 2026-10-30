const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, Node, Group, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, RoArray } = core;

/**
 * How a node's own scale, rotation and scaleRotateCenter reach its content, its bounding rects and
 * the content of node types that place their children themselves. Every expected value below is
 * the device's, from `test/simulator/probes/group-scale-probe` (page 2, `scene=review`, Roku OS
 * 15.3): see that probe's README for the trace.
 */

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Minimal fake interpreter accepted by getBoundingRect (mirrors Label.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

const QUARTER_TURN = Math.PI / 2;

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

function node(type, fields = {}) {
    const created = SGNodeFactory.createNode(type);
    for (const [name, value] of Object.entries(fields)) {
        if (Array.isArray(value)) {
            created.setValue(name, vector(value));
        } else if (typeof value === "string") {
            created.setValue(name, new BrsString(value));
        } else {
            created.setValue(name, new Float(value));
        }
    }
    return created;
}

function rects(target) {
    return {
        local: target.getBoundingRect("local", fakeObserverInterpreter),
        parent: target.getBoundingRect("toParent", fakeObserverInterpreter),
        scene: target.getBoundingRect("toScene", fakeObserverInterpreter),
    };
}

function rounded(rect) {
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

/** A draw target that accepts every call a render pass can make and records the text origins. */
function recordingDraw2D() {
    const rec = {
        texts: [],
        roundedClips: [],
        bitmaps: [],
        frames: 0,
        doDrawRotatedText(text, x, y, rgba, opacity, font, rotation) {
            rec.texts.push({ text, x, y, rotation });
        },
        doDrawRotatedRect() {},
        doDrawScaledObject(x, y, scaleX, scaleY) {
            rec.bitmaps.push({ x, y, scaleX, scaleY, rotation: 0, centerX: 0, centerY: 0 });
        },
        doDrawRotatedBitmap(x, y, scaleX, scaleY, rotation, bitmap, centerX, centerY) {
            rec.bitmaps.push({ x, y, scaleX, scaleY, rotation, centerX, centerY });
        },
        doDrawCroppedBitmap() {},
        drawNinePatch() {},
        pushClip() {},
        popClip() {},
        pushRoundedClip(rect, radii, rotation, center, scaleX, scaleY) {
            rec.roundedClips.push({ rect: { ...rect }, rotation, center, scaleX, scaleY });
        },
        strokeRoundedRect() {},
        pushScale() {
            return true;
        },
        popScale() {},
        pushScaleFrame() {
            rec.frames++;
            return 0;
        },
        popScaleFrame() {},
    };
    return rec;
}

beforeAll(() => {
    const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
    BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
});

afterEach(() => {
    sgRoot.setFocused();
});

describe("a node's own pivot under a rotated ancestor", () => {
    /** A Group at `translation` rotated 90° holding `child`. */
    function quarterTurned(translation, child) {
        const group = node("Group", { translation, rotation: QUARTER_TURN });
        group.appendChildToParent(child);
        return group;
    }

    // Device R1: a 200x40 child with scaleRotateCenter [100,20] and no rotation or scale of its
    // own covers {T.x, T.y - 200, 40, 200}, whatever its type: the pivot does not move it.
    test.each([
        ["Label", { width: 200, height: 40, text: "Pivot Label", scaleRotateCenter: [100, 20] }],
        ["Rectangle", { width: 200, height: 40, scaleRotateCenter: [100, 20] }],
    ])("a %s is not moved by its own scaleRotateCenter", (type, fields) => {
        const child = node(type, fields);
        const group = quarterTurned([200, 350], child);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rounded(rects(child).scene)).toEqual({ x: 200, y: 150, width: 40, height: 200 });
    });

    test("a Label's text is drawn from the same origin as without a pivot", () => {
        const pivoted = node("Label", { width: 200, height: 40, text: "Pivot", scaleRotateCenter: [100, 20] });
        const plain = node("Label", { width: 200, height: 40, text: "Pivot" });
        const withPivot = recordingDraw2D();
        const withoutPivot = recordingDraw2D();
        quarterTurned([200, 350], pivoted).renderNode(fakeInterpreter, [0, 0], 0, 1, withPivot);
        quarterTurned([200, 350], plain).renderNode(fakeInterpreter, [0, 0], 0, 1, withoutPivot);

        expect(withPivot.texts).toHaveLength(1);
        expect(withPivot.texts[0].x).toBeCloseTo(withoutPivot.texts[0].x, 6);
        expect(withPivot.texts[0].y).toBeCloseTo(withoutPivot.texts[0].y, 6);
    });

    test("a Group with a pivot places its children as without one", () => {
        const holder = node("Group", { scaleRotateCenter: [100, 20] });
        const fill = node("Rectangle", { width: 200, height: 40 });
        holder.appendChildToParent(fill);
        quarterTurned([600, 350], holder).renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rounded(rects(fill).scene)).toEqual({ x: 600, y: 150, width: 40, height: 200 });
    });

    test("a Rectangle with its own rotation turns around its pivot inside a rotated parent", () => {
        // Device R1 r1e: 200x40, rotation 0.5 around [100,20], parent [1400,350] rotated 90°.
        const child = node("Rectangle", { width: 200, height: 40, rotation: 0.5, scaleRotateCenter: [100, 20] });
        const group = quarterTurned([1400, 350], child);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        expect(rounded(rects(child).scene)).toEqual({ x: 1355, y: 153, width: 131, height: 195 });
        expect(rounded(rects(group).local)).toEqual({ x: 3, y: -45, width: 195, height: 131 });
    });
});

describe("a Poster's image and its Effect share one pivot", () => {
    function scaledTurnedPoster(withEffect) {
        // Device R2: 200x200, scale 0.5, rotation 0.5 around [100,100], at [600,500].
        const poster = node("Poster", {
            translation: [600, 500],
            width: 200,
            height: 200,
            loadWidth: 200,
            loadHeight: 200,
            scale: [0.5, 0.5],
            rotation: 0.5,
            scaleRotateCenter: [100, 100],
            uri: "common:/images/icon_options.png",
        });
        if (withEffect) {
            const effect = SGNodeFactory.createNode("Effect");
            effect.setValue("borderRadius", vector([30, 30, 30, 30]));
            poster.setValue("effect", effect);
        }
        return poster;
    }

    test("the rounded clip turns around the point the plain image turns around", () => {
        const plain = recordingDraw2D();
        scaledTurnedPoster(false).renderNode(fakeInterpreter, [0, 0], 0, 1, plain);
        const effect = recordingDraw2D();
        const poster = scaledTurnedPoster(true);
        poster.renderNode(fakeInterpreter, [0, 0], 0, 1, effect);

        expect(plain.bitmaps).toHaveLength(1);
        const image = plain.bitmaps[0];
        const imagePivot = [image.x + image.centerX, image.y + image.centerY];
        expect(effect.roundedClips).toHaveLength(1);
        const clip = effect.roundedClips[0];
        // The clip frame scales around rect.x/y, then turns around rect + scale * center.
        const clipPivot = [clip.rect.x + clip.scaleX * clip.center[0], clip.rect.y + clip.scaleY * clip.center[1]];
        expect(clipPivot[0]).toBeCloseTo(imagePivot[0], 6);
        expect(clipPivot[1]).toBeCloseTo(imagePivot[1], 6);
        expect([clip.scaleX, clip.scaleY]).toEqual([0.5, 0.5]);
        // Inside the clip frame the image is drawn at local units, not scaled a second time.
        expect(effect.bitmaps).toHaveLength(1);
        expect(effect.bitmaps[0].x).toBe(0);
        expect(effect.bitmaps[0].scaleX).toBeCloseTo(image.scaleX / 0.5, 6);
        expect(rounded(rects(poster).parent)).toEqual({ x: 632, y: 532, width: 136, height: 136 });
    });
});

describe("localBoundingRect leaves out the node's own scale", () => {
    // Device R3: a 200x200 node scaled 0.5 reports local 200x200 and parent 100x100, with or
    // without a child that covers it.
    test.each([
        ["Rectangle", false],
        ["Rectangle", true],
        ["Poster", false],
        ["Poster", true],
    ])("a scaled %s (covering child: %s)", (type, withChild) => {
        const scaled = node(type, { translation: [900, 500], width: 200, height: 200, scale: [0.5, 0.5] });
        if (withChild) {
            scaled.appendChildToParent(node("Rectangle", { width: 200, height: 200 }));
        }
        scaled.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        const reported = rects(scaled);
        expect(reported.local).toEqual({ x: 0, y: 0, width: 200, height: 200 });
        expect(reported.parent).toEqual({ x: 900, y: 500, width: 100, height: 100 });
        expect(reported.scene).toEqual({ x: 900, y: 500, width: 100, height: 100 });
    });

    test("a scaled Label reports its text extent unscaled in local space", () => {
        const label = node("Label", { translation: [1650, 500], text: "Scaled", scale: [0.5, 0.5] });
        label.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        const reported = rects(label);
        expect(reported.parent.width).toBeCloseTo(reported.local.width / 2, 6);
        expect(reported.parent.height).toBeCloseTo(reported.local.height / 2, 6);
    });
});

describe("own scale reaches the content of node types that place it themselves", () => {
    test("a TargetGroup scales its items around its translation", () => {
        // Device R4: targets 200 tall, 100 apart vertically -> 50 tall, 50 apart.
        const group = node("TargetGroup", { translation: [100, 820], scale: [0.5, 0.5] });
        group.setValue("itemComponentName", new BrsString("Rectangle"));
        const set = SGNodeFactory.createNode("TargetSet");
        set.setValue("targetRects", new RoArray([vector([0, 0, 200, 100]), vector([0, 100, 200, 100])].map((r) => r)));
        set.setValue("focusIndex", new Int32(0));
        group.setValue("targetSet", set);
        const content = SGNodeFactory.createNode("ContentNode");
        content.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        content.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        group.setValue("content", content);
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());
        for (const item of group.itemComps) {
            item.setValue("height", new Float(100));
        }
        const draw2D = recordingDraw2D();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.frames).toBeGreaterThan(0);
        expect(rounded(rects(group.itemComps[1]).scene)).toEqual({ x: 100, y: 870, width: 100, height: 50 });
    });

    test("a PanelSet scales its panels around its translation", () => {
        // Device R4: PanelSet at [900,780] scaled 0.25; a 300x300 box in its panel covers 75x75.
        const panelSet = node("PanelSet", { translation: [900, 780], scale: [0.25, 0.25] });
        const panel = SGNodeFactory.createNode("Panel");
        const box = node("Rectangle", { width: 300, height: 300 });
        panel.appendChildToParent(box);
        panelSet.appendChildToParent(panel);
        panelSet.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D());

        const panelX = rects(panel).parent.x;
        const scene = rects(box).scene;
        expect(scene.x).toBeCloseTo(900 + 0.25 * panelX, 6);
        expect(scene.y).toBeCloseTo(780, 6);
        expect(scene.width).toBeCloseTo(75, 6);
        expect(scene.height).toBeCloseTo(75, 6);
    });

    test("a LabelList draws inside its own scale frame and reports a scaled boundingRect", () => {
        // Device R4: a LabelList at [500,820] scaled 0.5 with a -36 focus outset reports x=482. Placed
        // higher here: this scene is 1280x720 (HD), and the grid stops at the screen edge.
        const list = node("LabelList", { translation: [500, 300], scale: [0.5, 0.5], itemSize: [300, 50] });
        const content = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 3; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(`List item ${i}`));
            content.appendChildToParent(item);
        }
        list.setValue("content", content);
        const draw2D = recordingDraw2D();
        list.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.frames).toBe(1);
        const reported = rects(list);
        expect(reported.parent.x).toBeCloseTo(500 + 0.5 * reported.local.x, 6);
        expect(reported.parent.y).toBeCloseTo(300 + 0.5 * reported.local.y, 6);
        expect(reported.parent.width).toBeCloseTo(0.5 * reported.local.width, 6);
        // The item text is laid out in local units, and the frame scales it once.
        expect(draw2D.texts).toHaveLength(3);
        expect(draw2D.texts[1].y - draw2D.texts[0].y).toBeCloseTo(50, 6);
    });

    test("a scaled LabelList near the screen bottom keeps the items the scale brings on screen", () => {
        // Scaled 0.5 at y=600, the third 100-tall row starts at y=700 on screen, inside this 720-tall
        // scene; in unscaled units it starts at 800, past the edge.
        const list = node("LabelList", { translation: [100, 600], scale: [0.5, 0.5], itemSize: [300, 100] });
        const content = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 3; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(`Row ${i}`));
            content.appendChildToParent(item);
        }
        list.setValue("content", content);
        const draw2D = recordingDraw2D();
        list.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.texts.map((t) => t.text)).toEqual(["Row 0", "Row 1", "Row 2"]);
    });

    test("a renderChildNodes override that offsets the children is scaled around the node, not the offset", () => {
        // PosterGridItem lays its children out below a caption: the offset is in local units.
        class CaptionedGroup extends Group {
            renderChildNodes(interpreter, origin, ...rest) {
                super.renderChildNodes(interpreter, [origin[0], origin[1] + 30], ...rest);
            }
        }
        const group = new CaptionedGroup();
        group.setValue("scale", vector([0.5, 0.5]));
        const child = node("Rectangle", { width: 10, height: 10 });
        group.appendChildToParent(child);
        group.renderChildren(fakeInterpreter, [100, 100], 0, 1, recordingDraw2D());

        // Read straight off the node: getBoundingRect would refresh the detached tree from its root.
        expect(child.rectToScene).toEqual({ x: 100, y: 115, width: 5, height: 5 });
    });
});

describe("bounding-rect bookkeeping cost", () => {
    function countOwnReads(target, field, render) {
        const spy = vi.spyOn(Node.prototype, "getValueJS");
        render();
        const reads = spy.mock.calls.filter(
            ([name], call) => name === field && spy.mock.contexts[call] === target
        ).length;
        spy.mockRestore();
        return reads;
    }

    test("a container reads its own scale and rotation a fixed number of times, whatever its child count", () => {
        const counts = [1, 6].map((childCount) => {
            const group = node("Group", { translation: [10, 10], scale: [0.5, 0.5], rotation: 0.25 });
            for (let i = 0; i < childCount; i++) {
                group.appendChildToParent(node("Rectangle", { translation: [i * 20, 0], width: 10, height: 10 }));
            }
            const render = () => group.renderNode(fakeInterpreter, [0, 0], 0, 1);
            return [countOwnReads(group, "scale", render), countOwnReads(group, "rotation", render)];
        });
        expect(counts[1]).toEqual(counts[0]);
    });

    test("a Rectangle with children reads its scale field once per render pass", () => {
        const rect = node("Rectangle", { width: 100, height: 50, scale: [0.5, 0.5] });
        rect.appendChildToParent(node("Rectangle", { width: 10, height: 10 }));
        const reads = countOwnReads(rect, "scale", () =>
            rect.renderNode(fakeInterpreter, [0, 0], 0, 1, recordingDraw2D())
        );
        expect(reads).toBe(1);
    });

    test("Group is still the base of every node type checked here", () => {
        expect(SGNodeFactory.createNode("PanelSet")).toBeInstanceOf(Group);
    });
});
