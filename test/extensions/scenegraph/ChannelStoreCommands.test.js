const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { ChannelStore, ContentNode, toContentNode } = scenegraph;
const { BrsBoolean, BrsString, Int32, RoAssociativeArray, RoChannelStore, isInvalid, toAssociativeArray } = core;

// The mocked ChannelStore commands, checked against Roku's reference for the node
// (REFERENCES/scenegraph/control-nodes/channelstore.md) and for ifChannelStore. The end-to-end
// pass lives in test/cli/cli-scenegraph.test.js ("Mocks every documented ChannelStore node
// command"); this file covers the pure conversion/filtering logic without spawning the CLI.
//
// Two things asserted here are ENGINE CHOICES rather than device measurements, and a device probe
// may legitimately overturn them: that a negative `deltaOrder` quantity removes the line item once
// it reaches zero (the reference says it removes the item but not what a partial decrement does),
// and the individual `errorCode` values on a failed partner order.

/** A fakeServer-enabled store, i.e. one whose mocks are active. */
function fakeStore() {
    const store = new RoChannelStore();
    store.setFakeServer(true);
    return store;
}

/** The keys of an associative array, in insertion order. */
function keysOf(aa) {
    return [...aa.elements.keys()];
}

/** A plain string read off an associative array. */
function stringOf(aa, name) {
    return aa.get(new BrsString(name)).getValue();
}

/** A ChannelStore node with fakeServer already enabled. */
function fakeNode() {
    const node = new ChannelStore();
    node.setValue("fakeServer", BrsBoolean.True);
    return node;
}

/** Builds a ContentNode from plain field values. */
function contentNode(fields) {
    return toContentNode(toAssociativeArray(fields));
}

describe("ChannelStore mocked commands", () => {
    describe("user account data", () => {
        // Note the result names differ from the request names: `street` yields street1 + street2 and
        // `firstname` yields firstName.
        test.each([
            [
                "all",
                "signup",
                // The default request, in the reference's own table order.
                ["firstName","lastName","email","street1","street2","city","state","zip","country","phone","birth","gender"], // prettier-ignore
            ],
            // Surrounding whitespace is tolerated, and the fields follow the order requested.
            ["email, street ,firstname", "signup", ["email", "street1", "street2", "firstName"]],
            // An unknown attribute is ignored rather than yielding an empty field.
            ["email,nosuchattribute", "signup", ["email"]],
            // "lists only email or phone attributes ... Other attributes are ignored even if specified".
            ["all", "signin", ["email", "phone"]],
            ["firstname,zip", "signin", []],
        ])("getUserAccountData(%p, %p) returns the fields %p", (requested, context, expected) => {
            expect(keysOf(fakeStore().getUserAccountData(requested, context))).toEqual(expected);
        });

        test("returns the canned value for a requested attribute", () => {
            expect(stringOf(fakeStore().getUserAccountData("firstname"), "firstName")).toBe("John");
        });

        test("no account or region data is mocked while fakeServer is off", () => {
            const store = new RoChannelStore();
            expect(store.getUserAccountData()).toBeUndefined();
            expect(store.getRegionData()).toBeUndefined();
        });

        test("region data matches the account's own state, zip and country", () => {
            const region = fakeStore().getRegionData();
            const account = fakeStore().getUserAccountData();
            expect(keysOf(region)).toEqual(["state", "zip", "country"]);
            for (const name of ["state", "zip", "country"]) {
                expect(stringOf(region, name)).toBe(stringOf(account, name));
            }
        });
    });

    describe("channel credentials", () => {
        test("storeChannelCredData reports success as status 0 with a JSON response string", () => {
            // Note the inverted convention: this command and getChannelCred document 0 as success,
            // while catalog/purchases/orderStatus document 1.
            const result = fakeStore().storeCredData("token-1");
            expect(result.get(new BrsString("status")).getValue()).toBe(0);
            expect(JSON.parse(stringOf(result, "response"))).toEqual({ status: "success", error: "none" });
        });

        test("the credential store works without fakeServer, unlike the catalog/order commands", () => {
            // This is the Roku cloud credential store behind account linking, not a Streaming Store
            // response, and the artifact is the app's own — a production app never calls
            // fakeServer(true), so gating it here would silently discard its token.
            const store = new RoChannelStore();
            expect(store.storeCredData("token-1").get(new BrsString("status")).getValue()).toBe(0);
            const cred = store.getChannelCredData();
            expect(cred.get(new BrsString("status")).getValue()).toBe(0);
            expect(JSON.parse(stringOf(cred, "json")).channel_data).toBe("token-1");
        });

        test("getChannelCred returns parseable JSON and adds channel_data only once stored", () => {
            // The reference's own sample calls ParseJson() on this field, so it has to be real JSON.
            const store = fakeStore();
            const before = store.getChannelCredData();
            expect(keysOf(before)).toEqual(["channelID", "errorCode", "json", "publisherDeviceID", "status"]);
            expect(before.get(new BrsString("status")).getValue()).toBe(0);
            expect(stringOf(before, "errorCode")).toBe("");

            const payload = JSON.parse(stringOf(before, "json"));
            expect(payload.token_type).toBe("urn:roku:pucid:token_type:pucid_token");
            expect(payload.roku_pucid).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
            // "not returned if you have not used the StoreChannelCredData method".
            expect(payload.channel_data).toBeUndefined();

            store.storeCredData("token-1");
            const after = JSON.parse(stringOf(store.getChannelCredData(), "json"));
            expect(after.channel_data).toBe("token-1");
            // A PUCID is stable for the same user and app, so it must not change between calls.
            expect(after.roku_pucid).toBe(payload.roku_pucid);
        });

        test("the mocked PUCID is stable for the same app and device", () => {
            const first = JSON.parse(stringOf(new RoChannelStore().getChannelCredData(), "json"));
            const second = JSON.parse(stringOf(new RoChannelStore().getChannelCredData(), "json"));
            expect(first.roku_pucid).toBe(second.roku_pucid);
        });
    });

    describe("deltaOrder", () => {
        test("adds, increments and removes an item, returning the quantity remaining", () => {
            const store = fakeStore();
            expect(store.setDeltaOrder("A", 2)).toBe(2);
            expect(store.setDeltaOrder("A", 3)).toBe(5);
            expect(store.setDeltaOrder("A", -2)).toBe(3);
            expect(store.getOrderItems()).toHaveLength(1);
            // Reaching zero deletes the line item instead of leaving an empty one behind.
            expect(store.setDeltaOrder("A", -3)).toBe(0);
            expect(store.getOrderItems()).toHaveLength(0);
        });

        test("a non-positive delta on an item that is not in the cart is a no-op", () => {
            const store = fakeStore();
            expect(store.setDeltaOrder("A", -1)).toBe(0);
            expect(store.setDeltaOrder("A", 0)).toBe(0);
            expect(store.getOrderItems()).toHaveLength(0);
        });

        test("updates a line item in place even when its stored quantity is not numeric", () => {
            // An app can set `qty` as a string on the order ContentNode; matching on the code alone
            // keeps that from appending a second line item under the same code.
            const store = fakeStore();
            store.setNewOrder([toAssociativeArray({ code: "A", qty: "2" })]);
            expect(store.setDeltaOrder("A", 1)).toBe(1);
            expect(store.getOrderItems()).toHaveLength(1);
        });
    });

    describe("placing an order", () => {
        test("an empty cart cannot be ordered", () => {
            // Without this guard the fake order XML's items are reported as purchased for an order
            // that holds nothing — reachable by removing the last item with a negative deltaOrder.
            const store = fakeStore();
            store.setDeltaOrder("A", 1);
            store.setDeltaOrder("A", -1);
            const status = { code: 0, message: "" };
            expect(store.placeOrder(status)).toHaveLength(0);
            expect(status).toEqual({ code: -3, message: "Invalid Order" });
        });
    });

    describe("partner orders", () => {
        const orderInfo = () => toAssociativeArray({ code: "MOVIE1", price: "2.99", priceDisplay: "3.99" });

        test("a billing check succeeds and echoes the price back as the total", () => {
            // Keyed as ifChannelStore documents it — the order id is `id` here; the ChannelStore node
            // renames that one key to `orderId` at its own edge.
            const result = fakeStore().requestPartnerOrderData(orderInfo(), "MOVIE1");
            expect(Object.keys(result)).toEqual(["id", "status", "tax", "total"]);
            expect(result).toMatchObject({ status: "Success", tax: "0.00", total: "2.99" });
            expect(result.id).not.toBe("");
        });

        test("accepts a numeric price, which an app can set directly on the request node", () => {
            const numericPrice = toAssociativeArray({ code: "MOVIE1", price: 2.99 });
            expect(fakeStore().requestPartnerOrderData(numericPrice, "MOVIE1")).toMatchObject({
                status: "Success",
                total: "2.99",
            });
        });

        test("a request missing a required field is rejected as an invalid request", () => {
            const store = fakeStore();
            const rejected = [
                toAssociativeArray({ code: "MOVIE1" }), // no price
                toAssociativeArray({ price: "2.99" }), // no code
                new BrsString("nope"), // not an associative array at all
            ];
            for (const request of rejected) {
                expect(store.requestPartnerOrderData(request, "")).toMatchObject({
                    status: "Failure",
                    errorCode: "-4",
                });
            }
        });

        test("a confirmation needs a preceding billing check, and consumes its order id", () => {
            const store = fakeStore();
            // "The user's billing status must first be confirmed with the requestPartnerOrder command".
            expect(store.confirmPartnerOrderData(orderInfo(), "MOVIE1")).toMatchObject({
                status: "Failure",
                errorCode: "-3",
            });

            const { id } = store.requestPartnerOrderData(orderInfo(), "MOVIE1");
            const confirmation = toAssociativeArray({ orderId: id, code: "MOVIE1", price: "2.99" });
            const confirmed = store.confirmPartnerOrderData(confirmation, "MOVIE1");
            expect(Object.keys(confirmed)).toEqual(["purchaseId", "status"]);
            expect(confirmed.status).toBe("Success");
            expect(confirmed.purchaseId).not.toBe("");

            // Replaying the same confirmation must not purchase twice.
            expect(store.confirmPartnerOrderData(confirmation, "MOVIE1")).toMatchObject({
                status: "Failure",
                errorCode: "-3",
            });
        });

        test("a confirmation carrying the wrong order id is rejected", () => {
            const store = fakeStore();
            store.requestPartnerOrderData(orderInfo(), "MOVIE1");
            const mismatched = toAssociativeArray({ orderId: "not-the-order", code: "MOVIE1", price: "2.99" });
            expect(store.confirmPartnerOrderData(mismatched, "MOVIE1")).toMatchObject({
                status: "Failure",
                errorCode: "-3",
            });
        });

        test("both steps fail while fakeServer is off", () => {
            const store = new RoChannelStore();
            for (const step of ["requestPartnerOrderData", "confirmPartnerOrderData"]) {
                expect(store[step](orderInfo(), "MOVIE1")).toMatchObject({ status: "Failure", errorCode: "-1" });
            }
        });
    });

    describe("the node's order field", () => {
        /** Reads back the `order` field's line items as `[code, qty]` pairs. */
        function lineItems(node) {
            return node
                .getValue("order")
                .getNodeChildren()
                .map((child) => [child.getValue("code").getValue(), child.getValue("qty").getValue()]);
        }

        test("takes one line item per child, and republishes the order on a deltaOrder write", () => {
            const node = fakeNode();
            const order = new ContentNode();
            order.appendChildToParent(contentNode({ code: "A", qty: 1 }));
            order.appendChildToParent(contentNode({ code: "B", qty: 2 }));
            node.setValue("order", order);

            // The reference documents the associative array as { code, qty }; the write also
            // republishes `order`, which is what makes the round-trip observable here.
            node.setValue("deltaOrder", toAssociativeArray({ code: "B", qty: 3 }));
            expect(lineItems(node)).toEqual([
                ["A", 1],
                ["B", 5],
            ]);
        });

        test("accepts a childless order node as a single line item", () => {
            // The shape this node has always converted, and a legitimate one-item order.
            const node = fakeNode();
            node.setValue("order", contentNode({ code: "A", qty: 2 }));
            node.setValue("deltaOrder", toAssociativeArray({ code: "A", qty: 1 }));
            expect(lineItems(node)).toEqual([["A", 3]]);
        });

        test("tolerates `delta` as a legacy spelling of the product code", () => {
            const node = fakeNode();
            node.setValue("deltaOrder", toAssociativeArray({ delta: "A", qty: 1 }));
            expect(lineItems(node)).toEqual([["A", 1]]);
        });

        test("republishing keeps the same node and its order-level action metadata", () => {
            // The app holds its own reference to the order node, and the top node carries the
            // `action` ("Upgrade"/"Downgrade") that drives a subscription change — a freshly built
            // replacement node would drop both.
            const node = fakeNode();
            const order = new ContentNode();
            order.setValueSilent("action", new BrsString("Upgrade"));
            order.appendChildToParent(contentNode({ code: "A", qty: 1 }));
            node.setValue("order", order);

            node.setValue("deltaOrder", toAssociativeArray({ code: "B", qty: 1 }));
            expect(node.getValue("order")).toBe(order);
            expect(order.getValue("action").getValue()).toBe("Upgrade");
            expect(lineItems(node)).toEqual([
                ["A", 1],
                ["B", 1],
            ]);
        });

        test("setting the order to invalid clears it", () => {
            const node = fakeNode();
            node.setValue("order", contentNode({ code: "A", qty: 2 }));
            node.setValue("order", core.BrsInvalid.Instance);
            // Re-adding the same code starts from scratch rather than incrementing the cleared item.
            node.setValue("deltaOrder", toAssociativeArray({ code: "A", qty: 1 }));
            expect(lineItems(node)).toEqual([["A", 1]]);
        });
    });

    describe("the node's command dispatch", () => {
        test("getUserData honors requestedUserData and the requestedUserDataInfo context", () => {
            const node = fakeNode();
            node.setValue("requestedUserData", new BrsString("email,zip"));
            node.setValue("command", new BrsString("getUserData"));
            let userData = node.getValue("userData");
            expect(userData.getValue("email").getValue()).toBe("john.doe@email.com");
            expect(userData.getValue("zip").getValue()).toBe("95110");

            node.setValue("requestedUserDataInfo", contentNode({ context: "signin" }));
            node.setValue("command", new BrsString("getUserData"));
            userData = node.getValue("userData");
            expect(userData.getValue("email").getValue()).toBe("john.doe@email.com");
            // A sign-in RFI screen never returns the zip code.
            expect(isInvalid(userData.getValue("zip"))).toBe(true);
        });

        test("a non-string requestedUserDataInfo context is treated as a signup request", () => {
            // The field can hold any type, and this write happens after super.setValue, so a raw
            // JS type error here escapes Node.setValue's guard and crashes the app.
            const node = fakeNode();
            const info = new ContentNode();
            info.setValueSilent("context", new Int32(1));
            node.setValue("requestedUserDataInfo", info);
            node.setValue("command", new BrsString("getUserData"));
            // Signup returns the full set, so a field a signin request would drop is present.
            expect(node.getValue("userData").getValue("zip").getValue()).toBe("95110");
        });

        test("getUserData reports invalid while fakeServer is off, as a declined request does", () => {
            const node = new ChannelStore();
            node.setValue("command", new BrsString("getUserData"));
            expect(isInvalid(node.getValue("userData"))).toBe(true);
        });

        test("storeChannelCredData publishes an associative array, getChannelCred a ContentNode", () => {
            // The reference is asymmetric here on purpose: storeChannelCredDataStatus is documented
            // as an roAssociativeArray while channelCred is documented as a ContentNode.
            const node = fakeNode();
            node.setValue("channelCredData", new BrsString("token-1"));
            node.setValue("command", new BrsString("storeChannelCredData"));
            const status = node.getValue("storeChannelCredDataStatus");
            expect(status).toBeInstanceOf(RoAssociativeArray);
            expect(JSON.parse(stringOf(status, "response")).status).toBe("success");

            node.setValue("command", new BrsString("getChannelCred"));
            const cred = node.getValue("channelCred");
            expect(cred).toBeInstanceOf(ContentNode);
            expect(JSON.parse(cred.getValue("json").getValue()).channel_data).toBe("token-1");
        });

        test("the partner-order commands publish the documented success and failure fields", () => {
            const node = fakeNode();
            node.setValue(
                "requestPartnerOrder",
                contentNode({ code: "MOVIE1", price: "2.99", priceDisplay: "3.99", title: "Test Movie" })
            );
            node.setValue("command", new BrsString("requestPartnerOrder"));
            const request = node.getValue("requestPartnerOrderStatus");
            // This field names the order id `orderId`; ifChannelStore names the same value `id`.
            expect(request.getValue("status").getValue()).toBe("Success");
            expect(request.getValue("total").getValue()).toBe("2.99");
            const orderId = request.getValue("orderId").getValue();
            expect(orderId).not.toBe("");

            node.setValue("confirmPartnerOrder", contentNode({ orderId: orderId, code: "MOVIE1", price: "2.99" }));
            node.setValue("command", new BrsString("confirmPartnerOrder"));
            const confirmation = node.getValue("confirmPartnerOrderStatus");
            expect(confirmation.getValue("status").getValue()).toBe("Success");
            expect(confirmation.getValue("purchaseId").getValue()).not.toBe("");

            // Confirming again reuses a consumed order id and must report the failure keys instead.
            node.setValue("command", new BrsString("confirmPartnerOrder"));
            const replay = node.getValue("confirmPartnerOrderStatus");
            expect(replay.getValue("status").getValue()).toBe("Failure");
            expect(replay.getValue("errorCode").getValue()).toBe("-3");
            expect(replay.getValue("errorMessage").getValue()).not.toBe("");
        });

        test("the command dispatch reads fakeServer from the field, not from an earlier write", () => {
            // XML-initialized fields and cross-thread copies both bypass setValue(), so the command
            // has to re-derive the request state from the node's own fields.
            const node = new ChannelStore();
            node.setValueSilent("fakeServer", BrsBoolean.True);
            node.setValue("command", new BrsString("getUserData"));
            expect(node.getValue("userData").getValue("email").getValue()).toBe("john.doe@email.com");
        });
    });
});
