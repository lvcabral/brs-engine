const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoStreamSocket, RoSocketAddress, RoMessagePort, RoByteArray, BrsBoolean, BrsString, BrsInvalid, Int32 } =
    brs.types;

// Real TCP loopback I/O backed by a helper child process (see src/core/device/StreamBridge.ts).
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

describe("RoStreamSocket", () => {
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
        const socket = new RoStreamSocket();
        sockets.push(socket);
        return socket;
    }

    function callAddress(host) {
        const address = new RoSocketAddress();
        address.getMethod("setAddress").call(interpreter, new BrsString(host));
        return address;
    }

    /** Binds and listens a fresh socket on an ephemeral loopback port, returning it and the bound port. */
    function newListener(port) {
        const listener = newSocket();
        const bindAddress = callAddress("127.0.0.1:0");
        listener.getMethod("setAddress").call(interpreter, bindAddress);
        if (port) {
            listener.getMethod("setMessagePort").call(interpreter, port);
            listener.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);
        }
        const listening = listener.getMethod("listen").call(interpreter, new Int32(4));
        expect(listening).toEqual(BrsBoolean.True);
        const boundPort = bindAddress.getMethod("getPort").call(interpreter).getValue();
        return { listener, boundPort };
    }

    /** Connects a fresh socket to 127.0.0.1:targetPort. */
    function newClient(targetPort) {
        const client = newSocket();
        client.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${targetPort}`));
        return client;
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
            expect(socket.toString()).toEqual("<Component: roStreamSocket>");
        });
    });

    describe("listen", () => {
        it("binds to an ephemeral port and reports isListening()", () => {
            const { listener, boundPort } = newListener();
            expect(listener.getMethod("isListening").call(interpreter)).toEqual(BrsBoolean.True);
            expect(boundPort).toBeGreaterThan(0);
        });
    });

    describe("listen + connect + accept echo round trip", () => {
        it("accepts a real TCP connection and echoes data both directions", async () => {
            const port = new RoMessagePort();
            const { listener, boundPort } = newListener(port);

            const client = newClient(boundPort);
            expect(client.getMethod("connect").call(interpreter)).toEqual(BrsBoolean.True);

            // Pump the message port until the listener reports a pending connection.
            const acceptReady = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return listener.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(acceptReady).toBe(true);

            const accepted = listener.getMethod("accept").call(interpreter);
            expect(accepted).not.toBe(BrsInvalid.Instance);
            sockets.push(accepted);
            expect(accepted.getMethod("getID").call(interpreter).getValue()).not.toEqual(
                listener.getMethod("getID").call(interpreter).getValue()
            );
            accepted.getMethod("setMessagePort").call(interpreter, port);
            accepted.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);

            const sent = client.getMethod("sendStr").call(interpreter, new BrsString("hello from client"));
            expect(sent.getValue()).toBeGreaterThan(0);

            const serverGotData = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return accepted.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(serverGotData).toBe(true);
            const received = accepted.getMethod("receiveStr").call(interpreter, new Int32(4096));
            expect(received.value).toEqual("hello from client");

            client.getMethod("setMessagePort").call(interpreter, port);
            client.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);
            const echoed = accepted.getMethod("sendStr").call(interpreter, new BrsString("echo: hello from client"));
            expect(echoed.getValue()).toBeGreaterThan(0);

            const clientGotEcho = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return client.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(clientGotEcho).toBe(true);
            const echoReceived = client.getMethod("receiveStr").call(interpreter, new Int32(4096));
            expect(echoReceived.value).toEqual("echo: hello from client");
        }, 10000);
    });

    describe("listener close", () => {
        it("stops accepting new connections without breaking already-accepted ones", async () => {
            const port = new RoMessagePort();
            const { listener, boundPort } = newListener(port);

            const client = newClient(boundPort);
            expect(client.getMethod("connect").call(interpreter)).toEqual(BrsBoolean.True);
            const acceptReady = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return listener.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(acceptReady).toBe(true);
            const accepted = listener.getMethod("accept").call(interpreter);
            sockets.push(accepted);
            accepted.getMethod("setMessagePort").call(interpreter, port);
            accepted.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);

            // Regression: Close() on the LISTENER used to tear down the whole shared helper
            // process/bridge, silently breaking every connection already Accept()ed from it.
            listener.getMethod("close").call(interpreter);

            const sent = client.getMethod("sendStr").call(interpreter, new BrsString("still alive"));
            expect(sent.getValue()).toBeGreaterThan(0);
            const serverGotData = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return accepted.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(serverGotData).toBe(true);
            const received = accepted.getMethod("receiveStr").call(interpreter, new Int32(4096));
            expect(received.value).toEqual("still alive");

            // The listener itself must actually stop accepting new connections.
            const rejectedClient = newClient(boundPort);
            const connected = rejectedClient.getMethod("connect").call(interpreter);
            expect(connected).toEqual(BrsBoolean.False);
        }, 10000);
    });

    describe("peer close", () => {
        it("receive() returns 0 once the buffer drains after the peer closes", async () => {
            const port = new RoMessagePort();
            const { listener, boundPort } = newListener(port);
            const client = newClient(boundPort);
            client.getMethod("connect").call(interpreter);

            const acceptReady = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return listener.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(acceptReady).toBe(true);
            const accepted = listener.getMethod("accept").call(interpreter);
            sockets.push(accepted);
            accepted.getMethod("setMessagePort").call(interpreter, port);
            accepted.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);

            client.getMethod("close").call(interpreter);

            const peerClosed = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return accepted.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(peerClosed).toBe(true);

            const buffer = new RoByteArray();
            const received = accepted.getMethod("receive").call(interpreter, buffer, new Int32(0), new Int32(512));
            expect(received.getValue()).toBe(0);
        }, 10000);
    });

    describe("shared message port", () => {
        it("delivers events to both the listener and an accepted connection sharing one port", async () => {
            const port = new RoMessagePort();
            const { listener, boundPort } = newListener(port);
            const client = newClient(boundPort);
            client.getMethod("connect").call(interpreter);

            const acceptReady = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return listener.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(acceptReady).toBe(true);
            const accepted = listener.getMethod("accept").call(interpreter);
            sockets.push(accepted);
            // Sharing the SAME port the listener already registered on — without a unique per-instance
            // callback key, this would silently overwrite the listener's callback (RoMessagePort keys
            // registerCallback() by component type name by default).
            accepted.getMethod("setMessagePort").call(interpreter, port);
            accepted.getMethod("notifyReadable").call(interpreter, BrsBoolean.True);

            client.getMethod("sendStr").call(interpreter, new BrsString("still there?"));
            const serverGotData = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return accepted.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(serverGotData).toBe(true);

            // The listener's own callback must still be live too — connect a second client and confirm
            // the listener still gets notified, proving its callback wasn't silently replaced.
            const secondClient = newClient(boundPort);
            secondClient.getMethod("connect").call(interpreter);
            const listenerStillWorks = await waitUntil(() => {
                port.getMethod("getMessage").call(interpreter);
                return listener.getMethod("isReadable").call(interpreter) === BrsBoolean.True;
            });
            expect(listenerStillWorks).toBe(true);
        }, 10000);
    });

    describe("unsupported environment (e.g. the browser's stubbed `os`/`child_process` modules)", () => {
        it("never throws from construction or from socket calls", () => {
            const os = require("os");
            const originalTmpdir = os.tmpdir;
            os.tmpdir = () => {
                throw new TypeError("os.tmpdir is not a function");
            };
            try {
                let socket;
                expect(() => {
                    socket = newSocket();
                }).not.toThrow();
                expect(() => {
                    socket.getMethod("setAddress").call(interpreter, callAddress("127.0.0.1:0"));
                    const listening = socket.getMethod("listen").call(interpreter, new Int32(4));
                    expect(listening).toEqual(BrsBoolean.False);
                }).not.toThrow();
            } finally {
                os.tmpdir = originalTmpdir;
            }
        });
    });

    describe("close", () => {
        it("makes a subsequent send fail cleanly instead of throwing", () => {
            const socket = newSocket();
            socket.getMethod("close").call(interpreter);
            const sent = socket.getMethod("sendStr").call(interpreter, new BrsString("data"));
            expect(sent).toEqual(new Int32(0));
        });
    });

    describe("connection options", () => {
        it("SetLinger/SetMaxSeg store locally without a live connection", () => {
            const socket = newSocket();
            expect(socket.getMethod("setLinger").call(interpreter, new Int32(5))).toEqual(BrsBoolean.True);
            expect(socket.getMethod("getLinger").call(interpreter)).toEqual(new Int32(5));
            expect(socket.getMethod("setMaxSeg").call(interpreter, new Int32(1460))).toEqual(BrsBoolean.True);
            expect(socket.getMethod("getMaxSeg").call(interpreter)).toEqual(new Int32(1460));
        });

        it("SetNoDelay/SetKeepAlive apply for real once connected", () => {
            const { boundPort } = newListener();
            const client = newClient(boundPort);
            expect(client.getMethod("connect").call(interpreter)).toEqual(BrsBoolean.True);

            expect(client.getMethod("setNoDelay").call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.True);
            expect(client.getMethod("getNoDelay").call(interpreter)).toEqual(BrsBoolean.True);
            expect(client.getMethod("setKeepAlive").call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.True);
            expect(client.getMethod("getKeepAlive").call(interpreter)).toEqual(BrsBoolean.True);
        });
    });

    describe("eConnRefused", () => {
        it("reports a real connection-refused error against a closed local port", async () => {
            // Bind, read back the OS-assigned port, then close — nothing should be listening on it
            // by the time the connect attempt below reaches the OS.
            const { listener, boundPort } = newListener();
            listener.getMethod("close").call(interpreter);

            const socket = newSocket();
            socket.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${boundPort}`));
            const connected = socket.getMethod("connect").call(interpreter);
            expect(connected).toEqual(BrsBoolean.False);
            expect(socket.getMethod("eConnRefused").call(interpreter)).toEqual(BrsBoolean.True);
        }, 10000);
    });

    describe("connect retry", () => {
        it("can retry Connect() on the same socket after a failed attempt", async () => {
            // Regression: connect() used to flip the socket's role away from "unbound" even when
            // the attempt failed, permanently blocking any retry on that instance.
            const { listener: holder, boundPort: deadPort } = newListener();
            holder.getMethod("close").call(interpreter);

            const socket = newSocket();
            socket.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${deadPort}`));
            expect(socket.getMethod("connect").call(interpreter)).toEqual(BrsBoolean.False);

            const { boundPort: livePort } = newListener();
            socket.getMethod("setSendToAddress").call(interpreter, callAddress(`127.0.0.1:${livePort}`));
            expect(socket.getMethod("connect").call(interpreter)).toEqual(BrsBoolean.True);
            expect(socket.getMethod("isConnected").call(interpreter)).toEqual(BrsBoolean.True);
        }, 10000);
    });
});
