const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, fromSGNode } = scenegraph;
const { BrsString, Int32, RoArray, RoMessagePort } = core;

/**
 * Minimal fake interpreter accepted by Node.addObserver for a port observer.
 * Port observers never enter inSubEnv (they just pushMessage), so the body is
 * never invoked, but the shape needs to exist.
 */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * Lazy field materialization: a ContentNode declares ~103 `hidden` metadata default fields.
 * To avoid allocating a `Field` object per hidden default on every node (a multi-million-object
 * burst for a large EPG), hidden defaults live only in a shared per-class spec and are materialized
 * into a real `Field` the first time they are read, written, observed, or probed. These tests assert
 * that a hidden default behaves exactly as if it had always been a live `Field`.
 */
describe("ContentNode hidden-field lazy materialization", () => {
    test("a fresh ContentNode does not materialize its hidden defaults", () => {
        const node = SGNodeFactory.createNode("ContentNode");
        const fields = node.getNodeFields();

        // "title" is a hidden metadata default: it is NOT a live Field until touched...
        expect(fields.has("title")).toBe(false);
        expect(fields.has("length")).toBe(false);
        // ...but hasNodeField still reports it as present (spec-aware existence check).
        expect(node.hasNodeField("title")).toBe(true);
        expect(node.hasNodeField("length")).toBe(true);
        // Only the handful of non-hidden defaults are materialized (id/focusable/change/... + 2).
        expect(fields.size).toBeLessThan(12);
        // A genuinely unknown field is still absent everywhere.
        expect(node.hasNodeField("notafield")).toBe(false);
    });

    test("reading a hidden field returns its declared default and un-hides it", () => {
        const node = SGNodeFactory.createNode("ContentNode");

        // String default is "", integer default is 0 — same values the eager Field produced.
        expect(node.getValueJS("title")).toBe("");
        expect(node.getValueJS("length")).toBe(0);

        // The read materialized the field and it is now visible (no longer hidden).
        const titleField = node.getNodeFields().get("title");
        expect(titleField).toBeDefined();
        expect(titleField.isHidden()).toBe(false);
        // It now shows up among the visible field names.
        const names = node.getElements().map((s) => s.getValue().toLowerCase());
        expect(names).toContain("title");
    });

    test("a type-check-only probe (canAcceptValue) does NOT un-hide the field", () => {
        const node = SGNodeFactory.createNode("ContentNode");

        // canAcceptValue resolves the field to validate the type but must not "access" it.
        expect(node.canAcceptValue("title", new BrsString("ok"))).toBe(true);

        // The field is now materialized (it had to be, to type-check) but remains hidden,
        // so it stays out of the visible field set until genuinely read or written.
        const titleField = node.getNodeFields().get("title");
        expect(titleField).toBeDefined();
        expect(titleField.isHidden()).toBe(true);
        const names = node.getElements().map((s) => s.getValue().toLowerCase());
        expect(names).not.toContain("title");
    });

    test("setting a hidden field works and un-hides it", () => {
        const node = SGNodeFactory.createNode("ContentNode");

        node.setValue("title", new BrsString("Breaking News"));
        expect(node.getValueJS("title")).toBe("Breaking News");
        expect(node.getNodeFields().get("title").isHidden()).toBe(false);

        // A hidden array default round-trips through its typed conversion just like before.
        node.setValue("categories", new RoArray([new BrsString("news"), new BrsString("live")]));
        expect(node.getValueJS("categories")).toEqual(["news", "live"]);
    });

    test("observing a hidden field materializes it and delivers change events", () => {
        const node = SGNodeFactory.createNode("ContentNode");
        const port = new RoMessagePort();
        const received = [];
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            received.push(event);
            originalPush(event);
        };

        expect(node.getNodeFields().has("title")).toBe(false);
        node.addObserver(fakeInterpreter, "unscoped", new BrsString("title"), port);
        // Observing materialized the field.
        expect(node.getNodeFields().has("title")).toBe(true);

        node.setValue("title", new BrsString("Live"));
        expect(received.length).toBe(1);
        expect(received[0].fieldName.getValue()).toBe("title");
        expect(received[0].fieldValue.getValue()).toBe("Live");
    });

    test("serialization is unaffected: hidden defaults are excluded until touched", () => {
        const node = SGNodeFactory.createNode("ContentNode");
        node.setValue("title", new BrsString("Show"));

        const serialized = fromSGNode(node, false);
        // The touched field is serialized...
        expect(serialized.title).toBe("Show");
        // ...untouched hidden defaults are not (identical to the eager behavior, which skipped
        // hidden fields in fromSGNode).
        expect("length" in serialized).toBe(false);
        expect("description" in serialized).toBe(false);
    });

    test("addField still creates a dynamic, visible field alongside lazy defaults", () => {
        const node = SGNodeFactory.createNode("ContentNode");
        node.addNodeField("customField", "string", false);
        node.setValue("customField", new BrsString("value"));

        expect(node.hasNodeField("customField")).toBe(true);
        expect(node.getValueJS("customField")).toBe("value");
        const names = node.getElements().map((s) => s.getValue().toLowerCase());
        expect(names).toContain("customfield");

        // fromSGNode keys fields by their lowercase map key.
        const serialized = fromSGNode(node, false);
        expect(serialized.customfield).toBe("value");
    });

    test("the hidden-field spec is shared across all instances of a class", () => {
        // Touching a hidden default on one node must not leak a materialized Field into a sibling.
        const a = SGNodeFactory.createNode("ContentNode");
        const b = SGNodeFactory.createNode("ContentNode");

        a.setValue("title", new BrsString("A only"));
        expect(a.getNodeFields().has("title")).toBe(true);
        expect(b.getNodeFields().has("title")).toBe(false);
        // b still sees the pristine default.
        expect(b.getValueJS("title")).toBe("");
    });
});
