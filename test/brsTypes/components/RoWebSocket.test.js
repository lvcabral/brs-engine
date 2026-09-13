const { fork } = require("child_process");
const path = require("path");
const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoWebSocket, RoMessagePort, BrsBoolean, BrsString, BrsInvalid, Int32, RoByteArray } = brs.types;
const { pollUntil } = require("../../testUtils/pollUntil");

// Real WebSocket loopback I/O backed by a helper child process (see src/core/device/WebSocketBridge.ts),
// talking to a *separate* server process (see resources/wsEchoServer.js for why it must not be
// in-process). These tests perform genuine local network I/O, so they poll with real timers instead
// of fake ones.

describe("RoWebSocket", () => {
    let interpreter;
    let serverProcess;
    let serverUrl;
    const sockets = [];

    beforeAll(async () => {
        serverProcess = fork(path.join(__dirname, "resources", "wsEchoServer.js"), { stdio: "pipe" });
        const port = await new Promise((resolve) => serverProcess.once("message", (msg) => resolve(msg.port)));
        serverUrl = `ws://127.0.0.1:${port}`;
    });

    afterAll(() => {
        serverProcess.disconnect();
    });

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
        const socket = new RoWebSocket();
        sockets.push(socket);
        return socket;
    }

    function pump(port) {
        port.getMethod("getMessage").call(interpreter);
    }

    function waitForEventType(port, type, timeoutMs = 5000) {
        return pollUntil(() => {
            const msg = port.getMethod("getMessage").call(interpreter);
            if (msg !== BrsInvalid.Instance && msg.getMethod("getType").call(interpreter).getValue() === type) {
                return msg;
            }
            return undefined;
        }, timeoutMs);
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
            expect(socket.toString()).toEqual("<Component: roWebSocket>");
        });
    });

    describe("local state", () => {
        it("round-trips URL, socket data, and identity", () => {
            const socket = newSocket();
            expect(socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl))).toEqual(BrsBoolean.True);
            expect(socket.getMethod("getUrl").call(interpreter).value).toEqual(serverUrl);

            expect(socket.getMethod("setUrl").call(interpreter, new BrsString(""))).toEqual(BrsBoolean.False);

            const data = new BrsString("my-tag");
            socket.getMethod("setData").call(interpreter, data);
            expect(socket.getMethod("getData").call(interpreter)).toEqual(data);

            const id1 = socket.getMethod("getSocketId").call(interpreter);
            const id2 = newSocket().getMethod("getSocketId").call(interpreter);
            expect(id1.getValue()).not.toEqual(id2.getValue());
        });

        it("has no open info before connecting", () => {
            const socket = newSocket();
            expect(socket.getMethod("getOpenInfo").call(interpreter)).toBe(BrsInvalid.Instance);
        });
    });

    describe("loopback connect/send/receive", () => {
        it("opens, exchanges a text message, and closes cleanly", async () => {
            const socket = newSocket();
            const port = new RoMessagePort();
            socket.getMethod("setMessagePort").call(interpreter, port);
            socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));

            expect(socket.getMethod("open").call(interpreter)).toEqual(BrsBoolean.True);

            const opened = await pollUntil(() => {
                pump(port);
                return socket.getMethod("getOpenInfo").call(interpreter) !== BrsInvalid.Instance;
            });
            expect(opened).toBe(true);

            const sendResult = socket.getMethod("send").call(interpreter, new BrsString("hello from client"));
            expect(sendResult).not.toBe(BrsInvalid.Instance);

            // The server always greets with a binary message first, then echoes text as
            // "hello from server" — drain until the TextReceived reply shows up.
            const textEvent = await waitForEventType(port, 5);
            expect(textEvent).not.toBeUndefined();
            expect(textEvent.getMethod("getInfo").call(interpreter).get(new BrsString("Text")).value).toEqual(
                "hello from server"
            );

            socket.getMethod("close").call(interpreter);
            const closedEvent = await waitForEventType(port, 2);
            expect(closedEvent).not.toBeUndefined();
        }, 10000);

        it("delivers the server's binary greeting as roByteArray Data", async () => {
            const socket = newSocket();
            const port = new RoMessagePort();
            socket.getMethod("setMessagePort").call(interpreter, port);
            socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));

            socket.getMethod("open").call(interpreter);

            const dataEvent = await waitForEventType(port, 6);
            expect(dataEvent).not.toBeUndefined();
            const bytes = dataEvent.getMethod("getInfo").call(interpreter).get(new BrsString("Data"));
            expect(bytes).toBeInstanceOf(RoByteArray);
            expect(Array.from(bytes.getByteArray())).toEqual([1, 2, 3, 4]);
        }, 10000);
    });

    describe("Open(wait_time) synchronous connect", () => {
        it("blocks until connected and returns true", () => {
            const socket = newSocket();
            socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));
            const result = socket.getMethod("open").call(interpreter, new Int32(3000));
            expect(result).toEqual(BrsBoolean.True);
            expect(socket.getMethod("getOpenInfo").call(interpreter)).not.toBe(BrsInvalid.Instance);
        }, 10000);

        it("returns false when the server refuses the connection", () => {
            const socket = newSocket();
            socket.getMethod("setUrl").call(interpreter, new BrsString("ws://127.0.0.1:1"));
            const result = socket.getMethod("open").call(interpreter, new Int32(2000));
            expect(result).toEqual(BrsBoolean.False);
        }, 5000);
    });

    describe("SetTimer", () => {
        it("fires a repeating Timer event carrying the timer id and occurrence count", async () => {
            const socket = newSocket();
            const port = new RoMessagePort();
            socket.getMethod("setMessagePort").call(interpreter, port);
            socket.getMethod("setTimer").call(interpreter, new BrsString("tick"), new Int32(50), BrsBoolean.False);

            const timerEvent = await waitForEventType(port, 9, 2000);
            expect(timerEvent).not.toBeUndefined();
            const info = timerEvent.getMethod("getInfo").call(interpreter);
            expect(info.get(new BrsString("TimerId")).value).toEqual("tick");
            expect(info.get(new BrsString("Occur")).getValue()).toEqual(1);
        }, 5000);
    });

    describe("basic method smoke test", () => {
        it("never throws across the open/send/close call sequence", () => {
            expect(() => {
                const socket = newSocket();
                socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));
                socket.getMethod("open").call(interpreter);
                socket.getMethod("send").call(interpreter, new BrsString("data"));
                socket.getMethod("close").call(interpreter);
            }).not.toThrow();
        });
    });

    describe("reconnecting the same object", () => {
        it("still exchanges messages correctly after Open() is called a second time", async () => {
            // Regression: the Node helper script kept its active connection in one outer `let ws`
            // reassigned on every 'open' command; event handlers closing over that shared variable
            // could act on whichever connection was current, not the one they were bound to.
            const socket = newSocket();
            const port = new RoMessagePort();
            socket.getMethod("setMessagePort").call(interpreter, port);
            socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));

            socket.getMethod("open").call(interpreter);
            expect(await waitForEventType(port, 1)).not.toBeUndefined(); // Opened
            socket.getMethod("close").call(interpreter);
            expect(await waitForEventType(port, 2)).not.toBeUndefined(); // Closed

            // Reconnect on the same roWebSocket instance, reusing the same helper process.
            socket.getMethod("open").call(interpreter);
            expect(await waitForEventType(port, 1)).not.toBeUndefined(); // Opened again

            socket.getMethod("send").call(interpreter, new BrsString("hello from client"));
            const textEvent = await waitForEventType(port, 5);
            expect(textEvent?.getMethod("getInfo").call(interpreter).get(new BrsString("Text")).value).toEqual(
                "hello from server"
            );
        }, 10000);
    });

    describe("transport fails to start", () => {
        it("reports Open() as failed with an Error event instead of hanging silently", async () => {
            // Regression: WebSocketBridge.open() used to be void, so a spawn failure (simulated
            // here the same way RoDataGramSocket.test.js does — os.tmpdir() throwing, as the
            // browser build's webpack `resolve.fallback` stubs os/child_process the same way)
            // left Open() reporting success with no event ever following, hanging a script
            // waiting on the message port forever.
            const os = require("os");
            const originalTmpdir = os.tmpdir;
            os.tmpdir = () => {
                throw new TypeError("os.tmpdir is not a function");
            };
            try {
                const socket = newSocket();
                const port = new RoMessagePort();
                socket.getMethod("setMessagePort").call(interpreter, port);
                socket.getMethod("setUrl").call(interpreter, new BrsString(serverUrl));

                const result = socket.getMethod("open").call(interpreter);
                expect(result).toEqual(BrsBoolean.False);

                const errorEvent = await waitForEventType(port, 3, 2000);
                expect(errorEvent).not.toBeUndefined();
            } finally {
                os.tmpdir = originalTmpdir;
            }
        }, 5000);
    });
});
