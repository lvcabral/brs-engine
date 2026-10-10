/**
 * Platform-agnostic shape shared by `roUrlTransfer.AsyncGetSSEvents()`'s two transports:
 * `SseNodeBridge` (Node/CLI, a helper process) and `SseBridge` (browser, a `fetch()` owned by the
 * main thread). Both only stream the raw response; SSE parsing happens on the interpreter side
 * (`SseParser.ts`), so there is a single parser regardless of platform.
 */

export interface SseRequestParams {
    url: string;
    method: string;
    headers: Record<string, string>;
}

export type SseEventPayload =
    | { type: "response"; status: number; statusText: string; headers: string; contentType: string }
    | { type: "chunk"; text: string }
    | { type: "end" }
    | { type: "error"; code: number; message: string };

/** Streaming HTTP I/O behind a common surface `RoURLTransfer` drives without knowing the platform. */
export interface SseTransport {
    /** Starts a request, aborting any one still in flight. Returns `false` if the transport itself
     *  could not be started, in which case no event will ever follow. */
    start(params: SseRequestParams): boolean;
    /** Drains every payload of the current request received since the last call. Never blocks. */
    poll(): SseEventPayload[];
    /** Cancels the current request; no further payloads from it are returned. */
    abort(): void;
    /** Tears down the transport. Safe to call more than once. */
    dispose(): void;
}

/** Response code reported when the network fails mid-stream (`CURLE_RECV_ERROR`). */
export const SSE_RECV_ERROR = -56;
/** Response code reported when the connection could not be established (`CURLE_COULDNT_CONNECT`). */
export const SSE_CONNECT_ERROR = -7;

const CURL_ERROR_CODES: Record<string, number> = {
    UNSUPPORTED_PROTOCOL: -1,
    URL_MALFORMAT: -3,
    ENOTFOUND: -6,
    EAI_AGAIN: -6,
    ECONNREFUSED: -7,
    EHOSTUNREACH: -7,
    ENETUNREACH: -7,
    ETIMEDOUT: -28,
    TOO_MANY_REDIRECTS: -47,
    ECONNRESET: SSE_RECV_ERROR,
    EPIPE: SSE_RECV_ERROR,
    DEPTH_ZERO_SELF_SIGNED_CERT: -60,
    SELF_SIGNED_CERT_IN_CHAIN: -60,
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: -60,
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: -60,
    CERT_HAS_EXPIRED: -60,
    ERR_TLS_CERT_ALTNAME_INVALID: -60,
};

/** Maps a Node error code name to the negative cURL code `roUrlEvent.GetResponseCode()` reports. */
export function curlErrorCode(name: string | undefined, fallback: number = SSE_CONNECT_ERROR): number {
    return (name && CURL_ERROR_CODES[name.toUpperCase()]) || fallback;
}
