const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, Group } = scenegraph;
const { Interpreter, BrsString } = core;

/**
 * ifSGNodeDict.parentSubtype(nodeType as String) as String is documented to always return a
 * String - an empty string when nodeType has no parent in the SceneGraph class hierarchy (e.g.
 * "Node" itself, the root). rokucommunity/promises' isPromise() walks the hierarchy via this
 * method and checks `subType = ""` to detect the root; brs-engine returned Invalid instead,
 * which crashed LCase(Invalid) on the very next loop iteration for any non-Promise node passed
 * to isPromise() - failing on every @SGNode Rooibos suite that validates isPromise()/isComplete()
 * against a plain node.
 */
describe("ifSGNodeDict.parentSubtype", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    test("returns an empty string, not Invalid, for a root type with no parent", () => {
        const node = new Node([], "Node");
        const parentSubtype = node.getMethod("parentSubtype");

        const result = parentSubtype.call(interpreter, new BrsString("Node"));

        expect(result).toEqual(new BrsString(""));
    });

    test("returns the parent subtype for a type with a known parent", () => {
        const node = new Group([], "Group");
        const parentSubtype = node.getMethod("parentSubtype");

        const result = parentSubtype.call(interpreter, new BrsString("Group"));

        expect(result).toEqual(new BrsString("Node"));
    });

    test("returns an empty string for an unrecognized node type name", () => {
        const node = new Node([], "Node");
        const parentSubtype = node.getMethod("parentSubtype");

        const result = parentSubtype.call(interpreter, new BrsString("NotARealNodeType"));

        expect(result).toEqual(new BrsString(""));
    });
});
