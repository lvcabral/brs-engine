/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrsDevice, netlib } from "brs-engine";
import { getComponentDefinitionMap, setupInterpreterWithSubEnvs } from "./ComponentDefinition";
import { getNodeType, updateTypeDefHierarchy } from "../factory/NodeFactory";
import { sgRoot } from "../SGRoot";

/** Load status values reported by the ComponentLibrary node's `loadStatus` field. */
export type LibraryLoadStatus = "none" | "loading" | "ready" | "failed";

/**
 * Builds the reserved volume name used to mount a component library's package.
 * @param id The component library id (the `id` field of the ComponentLibrary node)
 * @returns A valid, unique volume name such as "complib_foo:"
 */
export function libraryVolumeName(id: string): string {
    const sanitized = id.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return `complib_${sanitized}:`;
}

/**
 * Normalizes downloaded/read bytes into an ArrayBuffer. The browser returns an
 * `ArrayBuffer` for `responseType: "arraybuffer"`, while the Node XMLHttpRequest
 * polyfill and `readFileSync` return a `Buffer`/`Uint8Array`.
 * @param data The raw response/file data
 * @returns An ArrayBuffer copy of the bytes, or undefined if the data is unusable
 */
function toArrayBuffer(data: unknown): ArrayBufferLike | undefined {
    if (data instanceof ArrayBuffer) {
        return data;
    }
    if (ArrayBuffer.isView(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return undefined;
}

/**
 * Fetches the raw bytes of a component library package.
 * Remote (http/https) URIs are downloaded synchronously; otherwise the URI is read
 * from a mounted virtual volume (pkg:, tmp:, ext1:, cachefs:).
 * @param uri The library URI
 * @returns The package bytes, or undefined if the fetch failed
 */
function fetchLibraryBytes(uri: string): ArrayBufferLike | undefined {
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
        // Route through the configured CORS proxy when available (returns the URL
        // unchanged if no proxy is set, and skips localhost/127.0.0.1).
        const proxiedUri = BrsDevice.getCORSProxy(uri);
        const bytes = toArrayBuffer(netlib.download(proxiedUri, "arraybuffer"));
        if (!bytes) {
            BrsDevice.stderr.write(`error,[sg] Failed to download component library from ${proxiedUri}`);
        }
        return bytes;
    }
    if (!BrsDevice.fileSystem.existsSync(uri)) {
        BrsDevice.stderr.write(`error,[sg] Component library not found: ${uri}`);
        return undefined;
    }
    return toArrayBuffer(BrsDevice.fileSystem.readFileSync(uri));
}

/**
 * Loads a component library, registering its components into the shared node
 * definition map with the library `id` as a namespace prefix (`id:ComponentName`).
 *
 * The library package is mounted on its own zenFS volume and its `components/` are
 * parsed and wired into the running interpreter, mirroring how the app's own
 * components are set up in the extension's `onBeforeExecute` hook.
 *
 * @param id The library id used as the component namespace prefix
 * @param uri The library package URI (http(s):// or a local volume path)
 * @returns The resulting load status ("ready" on success, "failed" otherwise)
 */
export async function loadComponentLibrary(id: string, uri: string): Promise<LibraryLoadStatus> {
    const interpreter = sgRoot.interpreter;
    if (!id.trim() || !uri.trim() || !interpreter) {
        return "failed";
    }
    if (sgRoot.getLibraryStatus(id) === "ready") {
        // Already loaded (e.g. shared by multiple components); nothing to do.
        return "ready";
    }
    sgRoot.setLibraryStatus(id, "loading");
    BrsDevice.stdout.write(`debug,[sg] Loading component library "${id}" from ${uri}`);
    try {
        const bytes = fetchLibraryBytes(uri);
        if (!bytes) {
            sgRoot.setLibraryStatus(id, "failed");
            return "failed";
        }
        const volume = libraryVolumeName(id);
        BrsDevice.fileSystem.mountLibrary(volume, bytes);
        BrsDevice.stdout.write(
            `debug,[sg] Mounted component library "${id}" (${bytes.byteLength} bytes) at volume ${volume}`
        );

        const libMap = await getComponentDefinitionMap(BrsDevice.fileSystem, [], id, volume);
        if (libMap.size === 0) {
            BrsDevice.stderr.write(`warning,[sg] Component library "${id}" has no components: ${uri}`);
            sgRoot.setLibraryStatus(id, "failed");
            return "failed";
        }

        // Merge the library components into the shared node definition map.
        for (const [name, def] of libMap.entries()) {
            sgRoot.nodeDefMap.set(name, def);
        }
        await setupInterpreterWithSubEnvs(interpreter, libMap, interpreter.manifest);
        for (const [name, def] of libMap.entries()) {
            updateTypeDefHierarchy(def);
            BrsDevice.addNodeStat(getNodeType(name));
        }
        BrsDevice.stdout.write(`debug,[sg] Loaded component library "${id}" (${libMap.size} components) from ${uri}`);
        sgRoot.setLibraryStatus(id, "ready");
        return "ready";
    } catch (err: any) {
        BrsDevice.stderr.write(`error,[sg] Failed to load component library "${id}" from ${uri}: ${err.message}`);
        sgRoot.setLibraryStatus(id, "failed");
        return "failed";
    }
}
