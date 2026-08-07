const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoDataGramSocket, RoSocketAddress, RoMessagePort, BrsBoolean, BrsString, BrsInvalid, Int32 } = brs.types;

// Real UDP loopback I/O backed by a helper child process (see src/core/device/DatagramBridge.ts).
// These tests perform genuine local network I/O, so they poll with real timers instead of fake ones.
async function waitUntil(predicate, timeoutMs = 5000, stepMs = 25) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return predicate();
}

describe("RoDataGramSocket", () => {
    let interpreter;
    const sockets = [];

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        while (sockets.length) {
            const socket = sockets.pop();
            socket.getMethod("close").call(interpreter);
        }
    });

    function newSocket() {
        const socket = new RoDataGramSocket();
        sockets.push(socket);
        return socket;
    }

    function callAddress(host) {
        const address = new RoSocketAddress();
        address.getMethod("setAddress").call(interpreter, new BrsString(host));
        return address;
    }

    describe("comparisons", () => {
        it("is equal to nothing", () => {
            const socket = newSocket();
            expect(socket.equalTo(socket)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            const socket = newSocket();
            expect(socket.toString()).toEqual("<Component: roDataGramSocket>");
        });
    });

    describe("loopback send/receive", () => {
        it("delivers a datagram sent between two sockets on 127.0.0.1", async () => {
            const receiver = newSocket();
            const sender = newSocket();
            const port = new RoMessagePort();

            // Bind the receiver to an ephemeral port and read back the real bound port.
            const bindAddress = callAddress("127.0.0.1:0");
            const bound = receiver.getMethod("setAddress").call(interpreter, bindAddress);
            expect(bound).toEqual(BrsBoolean.True);
            const boundPort = bindAddress.getMethod("getPort").call(interpreter).getValue();
            expect(boundPort).toBeGreaterThan(0);

            receiver.getMethod("setMessagePort").call(interpreter, port);
            receiver.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);

            sender.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${boundPort}`));
            const sent = sender.getMethod("sendStr").call(interpreter, new BrsString("hello from brs-engine"));
            expect(sent.getValue()).toBeGreaterThan(0);

            // Pump the message port until the socket reports readable (real async I/O in flight).
            const delivered = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return receiver.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(delivered).toBe(true);

            const received = receiver.getMethod("receiveStr").call(interpreter, new Int32(4096));
            expect(received.value).toEqual("hello from brs-engine");

            const from = receiver.getMethod("getReceivedFromAddress").call(interpreter);
            expect(from.getMethod("getHostName").call(interpreter)).toEqual(new BrsString("127.0.0.1"));
        }, 10000);
    });

    describe("setBroadcast", () => {
        it("returns a real (non-mocked) result", () => {
            const socket = newSocket();
            const result = socket.getMethod("setBroadcast").call(interpreter, BrsBoolean.True);
            expect(result).toEqual(BrsBoolean.True);
            expect(socket.getMethod("getBroadcast").call(interpreter)).toEqual(BrsBoolean.True);
        });
    });

    describe("close", () => {
        it("makes a subsequent send fail cleanly instead of throwing", () => {
            const socket = newSocket();
            socket.getMethod("setSendToAddress").call(interpreter, callAddress("127.0.0.1:9"));
            socket.getMethod("close").call(interpreter);
            const sent = socket.getMethod("sendStr").call(interpreter, new BrsString("data"));
            expect(sent).toEqual(new Int32(0));
        });
    });

    describe("notifyReadable(false)", () => {
        it("stops delivering roSocketEvents even when data is queued", async () => {
            const receiver = newSocket();
            const sender = newSocket();
            const port = new RoMessagePort();

            const bindAddress = callAddress("127.0.0.1:0");
            receiver.getMethod("setAddress").call(interpreter, bindAddress);
            const boundPort = bindAddress.getMethod("getPort").call(interpreter).getValue();

            receiver.getMethod("setMessagePort").call(interpreter, port);
            receiver.getMethod("notifyReadable").call(interpreter, BrsBoolean.False);

            sender.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${boundPort}`));
            sender.getMethod("sendStr").call(interpreter, new BrsString("ignored"));

            // Give the real UDP round trip a chance to land, then confirm it was never surfaced.
            await new Promise((resolve) => setTimeout(resolve, 300));
            const message = port.getMethod("getMessage").call(interpreter);
            expect(message).toBe(BrsInvalid.Instance);
            expect(receiver.getMethod("isReadable").call(interpreter)).toEqual(BrsBoolean.False);
        }, 10000);
    });
});
