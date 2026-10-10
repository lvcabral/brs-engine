// Standalone server-sent events test server, run in its own process (see RoURLTransfer.test.js and
// test/api/sseHost.test.js). Endpoints:
//   /stream      three events (event/id/retry/multi-line data), then ends
//   /last-id     one event whose data echoes the request's Last-Event-ID header ("none" if absent)
//   /forever     one event, then stays open
//   /redirect    302 to /stream
//   /plain       a plain-text response
//   /big         a 1MB plain-text response
//   /echo-auth   one event whose data echoes the Authorization header ("none" if absent)
//   /auth-same   302 to /echo-auth on the same origin
//   /auth-cross  302 to /echo-auth on another origin (localhost instead of 127.0.0.1)
//   /missing     404
const http = require("http");

const server = http.createServer((req, res) => {
    const sse = () => res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const port = server.address().port;
    switch (req.url) {
        case "/stream": {
            sse();
            res.write(": welcome\n\n");
            res.write("event: greeting\nid: 1\nretry: 2500\ndata: hello\n\n");
            setTimeout(() => {
                res.write("id: 2\ndata: multi\ndata: line\n\n");
                res.end("event: bye\nid: 3\ndata: done\n\n");
            }, 50);
            break;
        }
        case "/last-id": {
            sse();
            res.end(`data: ${req.headers["last-event-id"] ?? "none"}\n\n`);
            break;
        }
        case "/forever": {
            sse();
            res.write("id: f1\ndata: first\n\n");
            break;
        }
        case "/redirect": {
            res.writeHead(302, { Location: "/stream" });
            res.end();
            break;
        }
        case "/big": {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("x".repeat(1024 * 1024));
            break;
        }
        case "/echo-auth": {
            sse();
            res.end(`data: ${req.headers.authorization ?? "none"}\n\n`);
            break;
        }
        case "/auth-same": {
            res.writeHead(302, { Location: `http://127.0.0.1:${port}/echo-auth` });
            res.end();
            break;
        }
        case "/auth-cross": {
            res.writeHead(302, { Location: `http://localhost:${port}/echo-auth` });
            res.end();
            break;
        }
        case "/plain": {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("just text");
            break;
        }
        default: {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("not found");
        }
    }
});
server.listen(0, () => {
    process.send({ port: server.address().port });
});
process.on("disconnect", () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
});
