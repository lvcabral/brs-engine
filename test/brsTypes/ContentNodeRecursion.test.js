const sg = require("brs-node/bin/brs-sg.node");
const brs = require("brs-node/bin/brs.node");
const { ContentNode, Field } = sg;
const { BrsString } = brs.types;

describe("ContentNode parentField notification recursion", () => {
    it("prevents recursive notification cascades between content nodes", () => {
        const nodeA = new ContentNode();
        const nodeB = new ContentNode();
        let parentNotifications = 0;

        // Parent fields are real Field instances. Their notification handlers mutate
        // the opposite node, recreating the cross-node observer loop seen in grids.
        const parentFieldA = new Field("itemContent", nodeA, "node", true);
        const parentFieldB = new Field("itemContent", nodeB, "node", true);
        parentFieldA.permanentObservers.push({});
        parentFieldA.executeCallbacks = () => {
            parentNotifications++;
            nodeB.setValue("title", new BrsString(`b-${parentNotifications}`), true);
        };
        parentFieldB.permanentObservers.push({});
        parentFieldB.executeCallbacks = () => {
            parentNotifications++;
            nodeA.setValue("title", new BrsString(`a-${parentNotifications}`), true);
        };

        nodeA.addParentField(parentFieldA);
        nodeB.addParentField(parentFieldB);

        expect(() => nodeA.setValue("title", new BrsString("start"), true)).not.toThrow();
        expect(parentNotifications).toBeLessThan(4);
    });
});
