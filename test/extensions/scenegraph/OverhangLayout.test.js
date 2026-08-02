const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));

/**
 * Every node positions its own drawing through `Group.getDrawTranslation` — that is what keeps a
 * node's clippingRect, its paint position and its reported rect from drifting apart (see the
 * rendering contract in `.claude/docs/scenegraph-invariants.md`).
 *
 * `Overhang` was the one node that did not: it built its draw rect from `origin` alone and passed
 * `origin` straight to its children, ignoring its own `translation`. A translated Overhang therefore
 * painted in the wrong place, and its reported rect (which came from the node translation) disagreed
 * with where it actually drew.
 */
describe("Overhang honors its own translation", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a translated Overhang reports its translation", () => {
        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.setValue("translation", vector([30, 40]));

        overhang.renderNode(interpreter, [0, 0], 0, 1);

        // Before the fix this reported {0, 0}: the draw rect was built from `origin` alone, and
        // rectToParent now derives from that draw rect.
        const rect = overhang.getBoundingRect("toParent", interpreter);
        expect(Math.round(rect.x)).toBe(30);
        expect(Math.round(rect.y)).toBe(40);
    });

    test("an untranslated Overhang is unchanged", () => {
        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.renderNode(interpreter, [0, 0], 0, 1);
        const rect = overhang.getBoundingRect("toParent", interpreter);
        expect(Math.round(rect.x)).toBe(0);
        expect(Math.round(rect.y)).toBe(0);
    });
});
