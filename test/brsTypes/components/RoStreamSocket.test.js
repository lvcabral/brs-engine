const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoStreamSocket, BrsString } = brs.types;

/**
 * `errorCode` is what BrightScript reads back through `ifSocket.status()` (as an Int32) and through
 * every `ifSocketStatus` predicate (as an equality test against a fixed number), so it has to hold a
 * number. It used to be assigned Node's `err.code` — a *string* like "EPIPE" — which made `status()`
 * produce garbage and every predicate answer false.
 */
describe("RoStreamSocket", () => {
    let interpreter;
    let socket;

    beforeEach(() => {
        interpreter = new Interpreter();
        socket = new RoStreamSocket();
    });

    afterEach(() => {
        socket.socket?.destroy();
    });

    /** Invokes one of the component's registered BrightScript methods. */
    function call(name, ...args) {
        return socket.getMethod(name).call(interpreter, ...args);
    }

    describe("asynchronous socket failures", () => {
        it("records an error event instead of letting it crash the thread", () => {
            // `net.Socket` reports a failed write on a destroyed socket through an `error` event, not
            // as a throw. With no listener attached, Node rethrows it as an uncaught exception and
            // took down the whole worker.
            expect(() => socket.socket.emit("error", { code: "ERR_SOCKET_CLOSED" })).not.toThrow();
        });

        it("maps a host error name to the numeric code the status predicates test", () => {
            socket.socket.emit("error", { code: "EAGAIN", errno: -35 });

            // 11 is asserted by `eAgain()`. The host's own `errno` differs by platform (35 on BSD),
            // so the stable name has to win over it.
            expect(call("status").getValue()).toBe(11);
            expect(call("eAgain").toBoolean()).toBe(true);
            expect(call("eSuccess").toBoolean()).toBe(false);
        });

        it("falls back to a generic code for an unrecognized error", () => {
            socket.socket.emit("error", { code: "ERR_SOCKET_CLOSED" });

            const status = call("status").getValue();
            expect(typeof status).toBe("number");
            expect(Number.isNaN(status)).toBe(false);
            expect(status).toBe(3474);
        });

        it("starts with no error recorded", () => {
            expect(call("status").getValue()).toBe(0);
            expect(call("eSuccess").toBoolean()).toBe(true);
        });
    });

    describe("writing to a socket that cannot accept data", () => {
        beforeEach(() => {
            // A fresh socket is writable — Node buffers writes made before connect. Closing it is
            // what makes a write fail, and it fails *asynchronously*, so the caller's try/catch never
            // sees it.
            socket.socket.destroy();
        });

        it("reports nothing sent rather than queueing a write that can only fail", () => {
            expect(socket.socket.writable).toBe(false);

            expect(call("sendStr", new BrsString("hello")).getValue()).toBe(0);
            expect(call("status").getValue()).toBe(3474);
        });

        it("keeps status numeric after a failed send", () => {
            call("sendStr", new BrsString("hello"));

            // Every ifSocketStatus predicate is an equality test against a number; a string here
            // makes all of them answer false regardless of what actually happened.
            expect(typeof call("status").getValue()).toBe("number");
            expect(call("eSuccess").toBoolean()).toBe(false);
        });
    });
});
