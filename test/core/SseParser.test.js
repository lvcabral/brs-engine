import { SseParser } from "../../src/core/device/SseParser.ts";

function simplify(events) {
    return events.map(({ event, id, data, retry }) => ({ event, id, data, retry }));
}

describe("SseParser", () => {
    it("parses all fields and joins multi-line data", () => {
        const parser = new SseParser();
        const events = parser.feed("event: update\nid: 7\nretry: 3000\ndata: line 1\ndata: line 2\n\n");
        expect(simplify(events)).toEqual([{ event: "update", id: "7", data: "line 1\nline 2", retry: 3000 }]);
        expect(events[0].hasId).toBe(true);
        expect(events[0].hasRetry).toBe(true);
    });

    it("reports absent fields as empty values", () => {
        const events = new SseParser().feed("data: only data\n\n");
        expect(simplify(events)).toEqual([{ event: "", id: "", data: "only data", retry: 0 }]);
        expect(events[0].hasId).toBe(false);
        expect(events[0].hasRetry).toBe(false);
    });

    it("ignores comments, unknown fields and blocks without fields", () => {
        const events = new SseParser().feed(": keep-alive\n\nfoo: bar\n\n: note\ndata:x\n\n");
        expect(simplify(events)).toEqual([{ event: "", id: "", data: "x", retry: 0 }]);
    });

    it("strips only one leading space from values", () => {
        const events = new SseParser().feed("data:  two spaces\ndata\n\n");
        expect(events[0].data).toBe(" two spaces\n");
    });

    it("ignores invalid retry values and ids containing NUL", () => {
        const events = new SseParser().feed("retry: 12a\nid: a\0b\ndata: x\n\n");
        expect(simplify(events)).toEqual([{ event: "", id: "", data: "x", retry: 0 }]);
    });

    it("handles chunks split mid-line and CR/CRLF line endings", () => {
        const parser = new SseParser();
        expect(parser.feed("\uFEFFda")).toEqual([]);
        expect(parser.feed("ta: one\r")).toEqual([]);
        expect(simplify(parser.feed("\n\r\ndata: two\r\r"))).toEqual([{ event: "", id: "", data: "one", retry: 0 }]);
        // The trailing CR is held back in case the next chunk starts with LF.
        expect(simplify(parser.feed("\n"))).toEqual([{ event: "", id: "", data: "two", retry: 0 }]);
    });

    it("assembles a long line delivered in many chunks", () => {
        const parser = new SseParser();
        expect(parser.feed("data: ")).toEqual([]);
        for (let i = 0; i < 100; i++) {
            expect(parser.feed("abcdefghij")).toEqual([]);
        }
        expect(parser.feed("\r")).toEqual([]);
        const events = parser.feed("\n\n");
        expect(events).toHaveLength(1);
        expect(events[0].data).toBe("abcdefghij".repeat(100));
    });

    it("discards an unterminated event at end of stream", () => {
        const parser = new SseParser();
        expect(parser.feed("data: partial\n")).toEqual([]);
        expect(parser.end()).toEqual([]);
    });
});
