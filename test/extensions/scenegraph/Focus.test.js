const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot } = scenegraph;
const { BrsBoolean, RoMessagePort } = core;

/**
 * Builds a focusable Group node.
 */
function focusableNode() {
    const node = new Node([], "Group");
    node.setValue("focusable", BrsBoolean.True, false);
    return node;
}

/**
 * Minimal fake interpreter accepted by Field.addObserver for a port observer.
 * Port observers never enter inSubEnv (they just pushMessage), so the body is
 * never invoked, but the shape needs to exist.
 */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * Field name passed to addObserver; only getValue/toString are exercised.
 */
const focusedChildFieldArg = { getValue: () => "focusedChild", toString: () => "focusedChild" };

describe("SceneGraph focus management", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    test("setFocus moves the global focus pointer before clearing the old focus chain", () => {
        // Two sibling buttons under a common parent.
        const parent = focusableNode();
        const buttonA = focusableNode();
        const buttonB = focusableNode();
        parent.appendChildToParent(buttonA);
        parent.appendChildToParent(buttonB);

        // Button A starts focused.
        buttonA.setNodeFocus(true);
        expect(sgRoot.focused).toBe(buttonA);

        // Observe button A's focusedChild with a port so the observer fires
        // synchronously when A loses focus. Capture which node the engine
        // considers focused *during* that notification.
        const port = new RoMessagePort();
        let focusedDuringALosingFocus;
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            focusedDuringALosingFocus = sgRoot.focused;
            originalPush(event);
        };
        buttonA.fields
            .get("focusedchild")
            .addObserver("permanent", fakeInterpreter, port, buttonA, focusedChildFieldArg);

        // Move focus to button B. Clearing A's focusedChild fires the observer above.
        buttonB.setNodeFocus(true);

        // Regression: while A is losing focus, the global focus pointer must
        // already be B, so A.hasFocus() (=== sgRoot.focused === A) returns false.
        // Previously the pointer was still A here, making both buttons report focus.
        expect(focusedDuringALosingFocus).toBe(buttonB);
        expect(sgRoot.focused).toBe(buttonB);
    });
});
