import { isWebSocketCommand, handleWebSocketCommand, disposeSocketsForRealm } from "./webSocketHost";
import { isSseCommand, handleSseCommand, disposeSseForRealm } from "./sseHost";

/**
 * Routes worker→main commands of the network bridges that must run on the main thread
 * (`roWebSocket`, `roUrlTransfer` server-sent events), shared by the app (`index.ts`) and Task
 * (`task.ts`) worker hosts.
 * @returns `true` if the message was a bridge command and has been handled.
 */
export function handleBridgeCommand(data: any): boolean {
    if (isWebSocketCommand(data)) {
        handleWebSocketCommand(data);
        return true;
    }
    if (isSseCommand(data)) {
        handleSseCommand(data);
        return true;
    }
    return false;
}

/** Closes every bridge connection opened by a worker realm (0 = app/render thread, >0 = a Task),
 *  since a terminated worker can never close them itself. */
export function disposeBridgesForRealm(realm: number): void {
    disposeSocketsForRealm(realm);
    disposeSseForRealm(realm);
}
