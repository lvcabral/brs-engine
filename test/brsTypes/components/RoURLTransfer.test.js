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

// AsyncGetSSEvents() streams through a helper child process (src/core/device/SseNodeBridge.ts)
// against a separate server process (resources/sseServer.js), polled with real timers.
describe("RoURLTransfer server-sent events", () => {
    const { fork } = require("child_process");
    const path = require("path");
    const { pollUntil } = require("../../testUtils/pollUntil");
    const { RoSSEvent, BrsBoolean } = brs.types;
    let interpreter;
    let serverProcess;
    let baseUrl;
    const transfers = [];

    beforeAll(async () => {
        serverProcess = fork(path.join(__dirname, "resources", "sseServer.js"), { stdio: "pipe" });
        const port = await new Promise((resolve) => serverProcess.once("message", (msg) => resolve(msg.port)));
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(() => {
        serverProcess.disconnect();
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        while (transfers.length) {
            transfers.pop().dispose();
        }
    });

    function newTransfer(route) {
        const transfer = new RoURLTransfer();
        transfers.push(transfer);
        const port = new RoMessagePort();
        transfer.getMethod("setMessagePort").call(interpreter, port);
        transfer.getMethod("setUrl").call(interpreter, new BrsString(baseUrl + route));
        return { transfer, port };
    }

    function call(obj, method, ...args) {
        return obj.getMethod(method).call(interpreter, ...args);
    }

    /** Collects every message until a transfer-complete roUrlEvent arrives. */
    async function collectUntilComplete(port, timeoutMs = 5000) {
        const messages = [];
        await pollUntil(() => {
            let msg;
            while ((msg = call(port, "getMessage")) !== BrsInvalid.Instance) {
                messages.push(msg);
                if (msg instanceof RoURLEvent && call(msg, "getInt").getValue() === 1) {
                    return true;
                }
            }
            return false;
        }, timeoutMs);
        return messages;
    }

    function describeSse(msg) {
        return {
            event: call(msg, "getEvent").value,
            id: call(msg, "getId").value,
            data: call(msg, "getData").value,
            retry: call(msg, "getRetry").getValue(),
        };
    }

    it("delivers a started event, each server event, and a completion event", async () => {
        const { transfer, port } = newTransfer("/stream");
        expect(call(transfer, "asyncGetSSEvents")).toEqual(BrsBoolean.True);
        const messages = await collectUntilComplete(port);

        expect(messages[0]).toBeInstanceOf(RoURLEvent);
        expect(call(messages[0], "getInt").getValue()).toBe(2);
        expect(call(messages[0], "getResponseCode").getValue()).toBe(200);
        const headers = call(messages[0], "getResponseHeaders");
        expect(headers.get(new BrsString("content-type")).value).toBe("text/event-stream");

        const events = messages.filter((m) => m instanceof RoSSEvent);
        expect(events.map(describeSse)).toEqual([
            { event: "greeting", id: "1", data: "hello", retry: 2500 },
            { event: "", id: "2", data: "multi\nline", retry: 0 },
            { event: "bye", id: "3", data: "done", retry: 0 },
        ]);
        const identity = call(transfer, "getIdentity").getValue();
        expect(call(events[0], "getSourceIdentity").getValue()).toBe(identity);

        const completed = messages.at(-1);
        expect(call(completed, "getInt").getValue()).toBe(1);
        expect(call(completed, "getResponseCode").getValue()).toBe(200);
        expect(messages).toHaveLength(5);

        expect(call(transfer, "sseLastEventId").value).toBe("3");
        expect(call(transfer, "sseRetry").getValue()).toBe(2500);
    });

    it("follows redirects", async () => {
        const { transfer, port } = newTransfer("/redirect");
        call(transfer, "asyncGetSSEvents");
        const messages = await collectUntilComplete(port);
        expect(messages.filter((m) => m instanceof RoSSEvent)).toHaveLength(3);
    });

    it("sends the last event id on the next transfer until cleared", async () => {
        const { transfer, port } = newTransfer("/stream");
        call(transfer, "asyncGetSSEvents");
        await collectUntilComplete(port);

        call(transfer, "setUrl", new BrsString(baseUrl + "/last-id"));
        call(transfer, "asyncGetSSEvents");
        let messages = await collectUntilComplete(port);
        expect(
            call(
                messages.find((m) => m instanceof RoSSEvent),
                "getData"
            ).value
        ).toBe("3");

        call(transfer, "sseClearLastEventId");
        expect(call(transfer, "sseLastEventId").value).toBe("");
        call(transfer, "addHeader", new BrsString("Last-Event-ID"), new BrsString("15"));
        call(transfer, "asyncGetSSEvents");
        messages = await collectUntilComplete(port);
        expect(
            call(
                messages.find((m) => m instanceof RoSSEvent),
                "getData"
            ).value
        ).toBe("15");
        expect(call(transfer, "sseRetry").getValue()).toBe(0);
    });

    it("completes a non-stream response with its body and no started event", async () => {
        const { transfer, port } = newTransfer("/plain");
        call(transfer, "asyncGetSSEvents");
        const messages = await collectUntilComplete(port);
        expect(messages).toHaveLength(1);
        expect(call(messages[0], "getResponseCode").getValue()).toBe(200);
        expect(call(messages[0], "getString").value).toBe("just text");
    });

    it("reports HTTP errors in the completion event", async () => {
        const { transfer, port } = newTransfer("/missing");
        call(transfer, "asyncGetSSEvents");
        const messages = await collectUntilComplete(port);
        expect(messages).toHaveLength(1);
        expect(call(messages[0], "getResponseCode").getValue()).toBe(404);
    });

    it("reports connection failures with a negative response code", async () => {
        const { transfer, port } = newTransfer("/stream");
        call(transfer, "setUrl", new BrsString("http://127.0.0.1:1/stream"));
        call(transfer, "asyncGetSSEvents");
        const messages = await collectUntilComplete(port);
        expect(call(messages[0], "getResponseCode").getValue()).toBe(-7);
        expect(call(transfer, "getFailureReason").value).not.toBe("");
    });

    it("stops delivering events after AsyncCancel()", async () => {
        const { transfer, port } = newTransfer("/forever");
        call(transfer, "asyncGetSSEvents");
        const first = await pollUntil(() => {
            const msg = call(port, "getMessage");
            return msg instanceof RoSSEvent ? msg : undefined;
        });
        expect(call(first, "getData").value).toBe("first");
        expect(call(transfer, "asyncCancel")).toEqual(BrsBoolean.True);
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(call(port, "getMessage")).toBe(BrsInvalid.Instance);
        expect(call(transfer, "sseLastEventId").value).toBe("f1");
    });

    it("forwards credentials on same-origin redirects only", async () => {
        const authData = async (route) => {
            const { transfer, port } = newTransfer(route);
            call(transfer, "setUserAndPassword", new BrsString("user"), new BrsString("secret"));
            call(transfer, "asyncGetSSEvents");
            const messages = await collectUntilComplete(port);
            return call(
                messages.find((m) => m instanceof RoSSEvent),
                "getData"
            ).value;
        };
        const expected = `Basic ${Buffer.from("user:secret").toString("base64")}`;
        expect(await authData("/auth-same")).toBe(expected);
        expect(await authData("/auth-cross")).toBe("none");
    });

    it("completes with an error when the helper process dies mid-stream", async () => {
        const { transfer, port } = newTransfer("/forever");
        call(transfer, "asyncGetSSEvents");
        await pollUntil(() => call(port, "getMessage") instanceof RoSSEvent);
        transfer.sseTransport.child.kill();
        const messages = await collectUntilComplete(port);
        expect(call(messages.at(-1), "getResponseCode").getValue()).toBe(-56);

        // The transfer recovers with a fresh helper.
        call(transfer, "setUrl", new BrsString(baseUrl + "/stream"));
        call(transfer, "asyncGetSSEvents");
        const retried = await collectUntilComplete(port);
        expect(retried.filter((m) => m instanceof RoSSEvent)).toHaveLength(3);
    });

    it("returns false without a message port", () => {
        const transfer = new RoURLTransfer();
        transfers.push(transfer);
        expect(call(transfer, "asyncGetSSEvents")).toEqual(BrsBoolean.False);
    });
});
