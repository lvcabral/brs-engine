const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { BrsString, BrsInvalid, RoURLTransfer, RoMessagePort, RoURLEvent, Callable } = brs.types;

describe("RoURLTransfer", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("escape", () => {
        it("percent-encodes reserved URI characters, matching Roku device behavior", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");
            expect(escape).toBeInstanceOf(Callable);

            expect(escape.call(interpreter, new BrsString("!@#"))).toEqual(new BrsString("%21%40%23"));
        });

        it("leaves unreserved characters untouched", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");

            expect(escape.call(interpreter, new BrsString("ABcde_-.~"))).toEqual(new BrsString("ABcde_-.~"));
        });
    });

    describe("urlEncode", () => {
        it("percent-encodes reserved URI characters, matching Roku device behavior", () => {
            let transfer = new RoURLTransfer();
            let urlEncode = transfer.getMethod("urlEncode");
            expect(urlEncode).toBeInstanceOf(Callable);

            expect(urlEncode.call(interpreter, new BrsString("!@#"))).toEqual(new BrsString("%21%40%23"));
        });
    });

    describe("unescape", () => {
        it("decodes percent-encoded reserved URI characters", () => {
            let transfer = new RoURLTransfer();
            let unescape = transfer.getMethod("unescape");
            expect(unescape).toBeInstanceOf(Callable);

            expect(unescape.call(interpreter, new BrsString("%21%40%23"))).toEqual(new BrsString("!@#"));
        });

        it("round-trips through escape", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");
            let unescape = transfer.getMethod("unescape");

            let encoded = escape.call(interpreter, new BrsString("test=!@#"));
            expect(unescape.call(interpreter, encoded)).toEqual(new BrsString("test=!@#"));
        });
    });

    describe("AsyncPostFromString", () => {
        // A POST with an empty body is valid (e.g. token requests that carry auth in headers
        // only). The async path must still fire the request and post an roUrlEvent — regressed
        // when the queue guard treated the empty-string body as "no work" and dropped it, so the
        // caller's wait() blocked until timeout.
        it("fires the request for an empty body and posts an roUrlEvent", () => {
            const transfer = new RoURLTransfer();
            const port = new RoMessagePort();
            transfer.getMethod("setMessagePort").call(interpreter, port);

            // Stub the network layer so no real request is made; capture the body it receives.
            const sentBodies = [];
            transfer.postFromStringEvent = (body) => {
                sentBodies.push(body);
                return new RoURLEvent(1, "", "ok", 200, "", "");
            };

            const asyncPost = transfer.getMethod("asyncPostFromString");
            expect(asyncPost.call(interpreter, new BrsString("")).toBoolean()).toBe(true);

            // The queued callback is what wait()/getMessage drains — it must yield the event.
            const event = port.getMethod("getMessage").call(interpreter);
            expect(event).toBeInstanceOf(RoURLEvent);
            expect(sentBodies).toEqual([""]);
        });

        it("fires the request for a non-empty body", () => {
            const transfer = new RoURLTransfer();
            const port = new RoMessagePort();
            transfer.getMethod("setMessagePort").call(interpreter, port);

            const sentBodies = [];
            transfer.postFromStringEvent = (body) => {
                sentBodies.push(body);
                return new RoURLEvent(1, "", "ok", 200, "", "");
            };

            const asyncPost = transfer.getMethod("asyncPostFromString");
            asyncPost.call(interpreter, new BrsString('{"refreshToken":"abc"}'));

            const event = port.getMethod("getMessage").call(interpreter);
            expect(event).toBeInstanceOf(RoURLEvent);
            expect(sentBodies).toEqual(['{"refreshToken":"abc"}']);
        });

        it("yields invalid when the callback fires with an empty queue", () => {
            const transfer = new RoURLTransfer();
            // No body queued: draining must be a no-op (invalid), not a spurious request.
            transfer.postFromStringEvent = () => {
                throw new Error("should not be called with an empty queue");
            };
            expect(transfer.postFromStringAsync()).toBe(BrsInvalid.Instance);
        });
    });

    describe("AsyncGetToString + PeekMessage", () => {
        // PeekMessage() used to read callbackQueue[0] without removing it, so for roUrlTransfer's
        // callbackQueue entries (one-shot job thunks that perform a real, synchronous HTTP request)
        // the same pending job kept firing on every PeekMessage() call once messageQueue drained —
        // producing duplicate network requests and repeated roUrlEvent delivery in the very common
        // PeekMessage()+GetMessage() polling idiom. Regression for that zombie-callback bug.
        it("fires the request only once across a PeekMessage()+GetMessage() poll loop", () => {
            const transfer = new RoURLTransfer();
            const port = new RoMessagePort();
            transfer.getMethod("setMessagePort").call(interpreter, port);

            let callCount = 0;
            transfer.getToStringEvent = () => {
                callCount++;
                return new RoURLEvent(1, "", "ok", 200, "", "");
            };

            transfer.getMethod("asyncGetToString").call(interpreter);

            const peekMessage = port.getMethod("peekMessage");
            const getMessage = port.getMethod("getMessage");

            // Common app idiom: peek, then get once a message is available.
            const peeked = peekMessage.call(interpreter);
            expect(peeked).toBeInstanceOf(RoURLEvent);

            const gotten = getMessage.call(interpreter);
            expect(gotten).toBeInstanceOf(RoURLEvent);

            // A further poll with no new async call queued must not re-fire the request.
            expect(peekMessage.call(interpreter)).toBe(BrsInvalid.Instance);
            expect(callCount).toBe(1);
        });
    });
});
