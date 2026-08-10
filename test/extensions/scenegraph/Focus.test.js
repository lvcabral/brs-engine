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
    test("drops a backwards steal raised from a container's own focusedChild observer", () => {
        // Device-measured shape (test/simulator/probes/list-refocus-settle-probe, R7): a container
        // observes its own `focusedChild` and redirects focus to an inner child; something reached
        // from that notification then re-grabs focus to an unrelated SIBLING of the container. That
        // target sits outside the subtree the in-flight transaction just focused, so it is a backwards
        // steal and must be dropped.
        //
        // Regression for an owner-keyed classifier: the container IS still in the focus chain (focus
        // went to its own child), so testing only the notifying owner reads this as a legal forward
        // focus and honors it — leaving the app focused on the node it was navigating away from.
        const scene = focusableNode();
        const container = focusableNode();
        const inner = focusableNode();
        const sibling = focusableNode();
        scene.appendChildToParent(container);
        container.appendChildToParent(inner);
        scene.appendChildToParent(sibling);

        sibling.setNodeFocus(true);

        // The container redirects focus inward, then steals it back out to the sibling.
        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        let redirected = false;
        port.pushMessage = (event) => {
            if (!redirected && container.isChildrenFocused() === false && sgRoot.focused === container) {
                redirected = true;
                inner.setNodeFocus(true);
                // Raised while the container's notification is still dispatching: a backwards steal.
                sibling.setNodeFocus(true);
            }
            originalPush(event);
        };
        container.fields
            .get("focusedchild")
            .addObserver("permanent", fakeInterpreter, port, container, focusedChildFieldArg);

        container.setNodeFocus(true);

        // The steal is dropped: focus stays where the redirect put it.
        expect(sgRoot.focused).toBe(inner);
        expect(sibling.getValueJS("focusable")).toBe(true);
    });

    test("still honors a forward focus onto a sibling of the focused child", () => {
        // The mirror case that must keep working: a container hands focus from its first child to
        // another of its own children (how a dialog highlights a specific button). The target is a
        // SIBLING of the live focus, not a descendant of it, so a target-must-be-below-focus test
        // would wrongly drop this.
        const scene = focusableNode();
        const container = focusableNode();
        const childA = focusableNode();
        const childB = focusableNode();
        scene.appendChildToParent(container);
        container.appendChildToParent(childA);
        container.appendChildToParent(childB);

        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        let forwarded = false;
        port.pushMessage = (event) => {
            if (!forwarded && sgRoot.focused === childA) {
                forwarded = true;
                childB.setNodeFocus(true);
            }
            originalPush(event);
        };
        container.fields
            .get("focusedchild")
            .addObserver("permanent", fakeInterpreter, port, container, focusedChildFieldArg);

        childA.setNodeFocus(true);

        expect(sgRoot.focused).toBe(childB);
    });
    test("honors a redirect out of a node observing its OWN focus gain", () => {
        // The "I got focus but have nothing to show, pass it on" pattern: a node observes its own
        // focusedChild and hands focus to a sibling (or up to its container). The focus transaction
        // stages focusedChild on the focused leaf itself, so that leaf is also an `owner` — and an
        // over-broad "target must be inside the owner's subtree" test dropped both redirects, which is a
        // regression against long-standing behavior that focus-probe2 never covered (N1/N2 only measured
        // forward focus INTO a container's subtree). The subtree test applies only when the owner is a
        // PROPER ANCESTOR of the focused node, i.e. the container-redirect shape.
        for (const targetIsSibling of [true, false]) {
            sgRoot.setFocused();
            const scene = focusableNode();
            const container = focusableNode();
            const leaf = focusableNode();
            const sibling = focusableNode();
            scene.appendChildToParent(container);
            container.appendChildToParent(leaf);
            container.appendChildToParent(sibling);

            // Sibling redirect targets a peer; the other case hands focus UP to the container.
            const redirectTo = targetIsSibling ? sibling : container;
            const port = new RoMessagePort();
            const originalPush = port.pushMessage.bind(port);
            let redirected = false;
            port.pushMessage = (event) => {
                if (!redirected && sgRoot.focused === leaf) {
                    redirected = true;
                    redirectTo.setNodeFocus(true);
                }
                originalPush(event);
            };
            leaf.fields.get("focusedchild").addObserver("permanent", fakeInterpreter, port, leaf, focusedChildFieldArg);

            leaf.setNodeFocus(true);

            expect(sgRoot.focused).toBe(redirectTo);
        }
    });
});
