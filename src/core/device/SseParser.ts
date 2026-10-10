/** One server-sent event, as exposed by `roSSEvent`. Absent fields are empty (`retry` is 0). */
export interface ServerSentEvent {
    event: string;
    id: string;
    data: string;
    retry: number;
    /** Whether the block carried an `id` field (an empty `id:` resets the last event id). */
    hasId: boolean;
    /** Whether the block carried a valid `retry` field. */
    hasRetry: boolean;
}

/**
 * Incremental `text/event-stream` parser (WHATWG HTML "Server-sent events" interpretation rules).
 * Feed decoded text chunks of any size; complete events are returned as soon as their terminating
 * blank line arrives. A block is dispatched when it carries at least one known field, since
 * `roSSEvent` exposes `event`/`id`/`data`/`retry` individually.
 */
export class SseParser {
    private buffer = "";
    /** Length of the buffer prefix already known to contain no line break. */
    private scanned = 0;
    private started = false;
    private event = "";
    private id = "";
    private data: string[] = [];
    private retry = 0;
    private hasFields = false;
    private hasId = false;
    private hasRetry = false;

    feed(text: string): ServerSentEvent[] {
        if (!this.started && text.length > 0) {
            this.started = true;
            if (text.startsWith("\uFEFF")) {
                text = text.slice(1);
            }
        }
        this.buffer += text;
        const events: ServerSentEvent[] = [];
        let start = 0;
        for (let i = this.scanned; i < this.buffer.length; i++) {
            const ch = this.buffer[i];
            if (ch !== "\n" && ch !== "\r") {
                continue;
            }
            if (ch === "\r" && i + 1 === this.buffer.length) {
                // A trailing CR may be the first half of a CRLF split across chunks.
                break;
            }
            this.processLine(this.buffer.slice(start, i), events);
            if (ch === "\r" && this.buffer[i + 1] === "\n") {
                i++;
            }
            start = i + 1;
        }
        this.buffer = this.buffer.slice(start);
        this.scanned = this.buffer.endsWith("\r") ? this.buffer.length - 1 : this.buffer.length;
        return events;
    }

    /** Flushes a trailing CR-terminated line at end of stream. An unterminated event is discarded. */
    end(): ServerSentEvent[] {
        const events: ServerSentEvent[] = [];
        if (this.buffer.endsWith("\r")) {
            this.processLine(this.buffer.slice(0, -1), events);
        }
        this.buffer = "";
        this.scanned = 0;
        this.reset();
        return events;
    }

    private processLine(line: string, events: ServerSentEvent[]) {
        if (line === "") {
            if (this.hasFields) {
                events.push({
                    event: this.event,
                    id: this.id,
                    data: this.data.join("\n"),
                    retry: this.retry,
                    hasId: this.hasId,
                    hasRetry: this.hasRetry,
                });
            }
            this.reset();
            return;
        }
        if (line.startsWith(":")) {
            return;
        }
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) {
            value = value.slice(1);
        }
        switch (field) {
            case "event":
                this.event = value;
                break;
            case "data":
                this.data.push(value);
                break;
            case "id":
                if (value.includes("\0")) {
                    return;
                }
                this.id = value;
                this.hasId = true;
                break;
            case "retry":
                if (!/^\d+$/.test(value)) {
                    return;
                }
                this.retry = Number.parseInt(value, 10);
                this.hasRetry = true;
                break;
            default:
                return;
        }
        this.hasFields = true;
    }

    private reset() {
        this.event = "";
        this.id = "";
        this.data = [];
        this.retry = 0;
        this.hasFields = false;
        this.hasId = false;
        this.hasRetry = false;
    }
}
