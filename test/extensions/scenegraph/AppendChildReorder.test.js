const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString } = core;

/**
 * Regression: appendChild() of a node that is ALREADY a child must MOVE it to the end of the
 * child list, matching a real device. Apps reorder list content this way — e.g. a profile menu
 * builder that appends a new "Add Account" entry and then re-appends the existing "Guest" entry
 * so it becomes the last option. appendChildToParent used to early-return true when the child
 * was already present, leaving the order unchanged (the two last options rendered swapped).
 */
describe("appendChild moves an existing child to the end", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    function ids(parent) {
        return parent.getNodeChildren().map((child) => child.getValueJS("id"));
    }

    function buildParent(type, childType, count) {
        const parent = SGNodeFactory.createNode(type);
        for (let i = 0; i < count; i++) {
            const child = SGNodeFactory.createNode(childType);
            child.setValue("id", new BrsString(`c${i}`));
            parent.appendChildToParent(child);
        }
        return parent;
    }

    test("re-appending an existing ContentNode child moves it to the end", () => {
        const parent = buildParent("ContentNode", "ContentNode", 3);
        const guest = parent.getNodeChildren()[1];

        expect(parent.appendChildToParent(guest)).toBe(true);

        expect(ids(parent)).toEqual(["c0", "c2", "c1"]);
        expect(parent.getNodeChildren()).toHaveLength(3);
        expect(guest.getNodeParent()).toBe(parent);
    });

    test("re-appending the last ContentNode child is a no-op", () => {
        const parent = buildParent("ContentNode", "ContentNode", 3);
        const last = parent.getNodeChildren()[2];

        expect(parent.appendChildToParent(last)).toBe(true);

        expect(ids(parent)).toEqual(["c0", "c1", "c2"]);
    });

    test("re-appending an existing Group child moves it to the end", () => {
        const parent = buildParent("Group", "Group", 3);
        const first = parent.getNodeChildren()[0];

        expect(parent.appendChildToParent(first)).toBe(true);

        expect(ids(parent)).toEqual(["c1", "c2", "c0"]);
        expect(first.getNodeParent()).toBe(parent);
    });

    test("re-appending the last Group child is a no-op", () => {
        const parent = buildParent("Group", "Group", 2);
        const last = parent.getNodeChildren()[1];

        expect(parent.appendChildToParent(last)).toBe(true);

        expect(ids(parent)).toEqual(["c0", "c1"]);
    });
});
