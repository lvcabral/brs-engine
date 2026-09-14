// Standalone WebSocket test server, run in its own process (see RoWebSocket.test.js).
//
// It must be a genuinely separate process, not an in-process `WebSocketServer`: some
// RoWebSocket.test.js cases exercise `Open(wait_time)`'s synchronous busy-wait, which blocks the
// *calling* process's event loop for up to `wait_time` ms. A server sharing that same event loop
// could never accept/complete the handshake while the test's own call is blocking on it — a
// self-deadlock that has nothing to do with RoWebSocket's own correctness. A real BrightScript app
// always connects to a server in a different process (or on a different machine) with its own,
// unrelated event loop, so this mirrors real usage instead of the artificial in-process shortcut.
//
// On each connection: sends a binary greeting immediately, and echoes "hello from server" for any
// text message received.
const { WebSocketServer } = require("ws");

const server = new WebSocketServer({ port: 0 });
server.on("connection", (ws) => {
    ws.send(Buffer.from([1, 2, 3, 4]));
    ws.on("message", (data, isBinary) => {
        if (!isBinary) {
            ws.send("hello from server");
        }
    });
});
server.once("listening", () => {
    process.send({ port: server.address().port });
});
process.on("disconnect", () => {
    server.close(() => process.exit(0));
});
