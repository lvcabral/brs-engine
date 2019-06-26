const brs = require("brs");
const { ValueKind, Callable, BrsString, RoAssociativeArray } = brs.types;
const { Interpreter } = require("../../lib/interpreter");
const { MockNode } = require("../../lib/mocks/MockNode");

describe("MockNode", () => {
    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("registerNewMethod", () => {
            it("registers a new callable on the mock node", () => {
                let newMethod = new Callable("newMethod", {
                    signature: {
                        args: [],
                        returns: ValueKind.Boolean,
                    },
                    impl: () => {
                        return true;
                    },
                });

                let aa = new RoAssociativeArray([
                    { name: new BrsString("newMethod"), value: newMethod },
                ]);
                let mockNode = new MockNode(aa);
                result = mockNode.getMethod("newMethod");
                expect(result).toBeTruthy();
                expect(result.call(interpreter)).toBe(true);
            });
        });
    });
});
