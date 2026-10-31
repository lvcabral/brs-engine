/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrsDevice, netlib, parseManifest } from "brs-engine";
import { getComponentDefinitionMap, setupInterpreterWithSubEnvs } from "./ComponentDefinition";
import { getNodeType, updateTypeDefHierarchy } from "../factory/NodeFactory";
import { sgRoot } from "../SGRoot";

/** Load status values reported by the ComponentLibrary node's `loadStatus` field. */
export type LibraryLoadStatus = "none" | "loading" | "ready" | "failed";

/**
 * Builds the reserved volume name used to mount a component library's package.
 * @param uri The component library uri (the `uri` field of the ComponentLibrary node)
 * @returns A valid, unique volume name such as "complib_1a2b3c4d:"
 */
export function libraryVolumeName(uri: string): string {
    // FNV-1a hash keeps the name short and stable for any uri.
    let hash = 0x811c9dc5;
    for (let i = 0; i < uri.length; i++) {
        hash ^= uri.codePointAt(i) ?? 0;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `complib_${hash.toString(16).padStart(8, "0")}:`;
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
 * Reads the namespace a component library provides from its manifest.
 * @param volume The mounted library volume (e.g. "complib_foo:")
 * @returns The `sg_component_libs_provided` value, or undefined if absent
 */
function readLibraryNamespace(volume: string): string | undefined {
    const manifestPath = `${volume}/manifest`;
    if (!BrsDevice.fileSystem.existsSync(manifestPath)) {
        return undefined;
    }
    try {
        const manifest = parseManifest(BrsDevice.fileSystem.readFileSync(manifestPath, "utf-8"));
        const provided = manifest.get("sg_component_libs_provided")?.trim();
        return provided && provided.length > 0 ? provided : undefined;
    } catch {
        return undefined;
    }
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
 * definition map under the namespace the library provides (`Namespace:ComponentName`).
 *
 * The library package is mounted on its own zenFS volume and its `components/` are
 * parsed and wired into the running interpreter, mirroring how the app's own
 * components are set up in the extension's `onBeforeExecute` hook.
 *
 * @param uri The library package URI (http(s):// or a local volume path), also the library key
 * @param id Optional library id, the namespace fallback when the manifest declares none
 * @returns The resulting load status ("ready" on success, "failed" otherwise)
 */
export function loadComponentLibrary(uri: string, id?: string): LibraryLoadStatus {
    const interpreter = sgRoot.interpreter;
    uri = uri.trim();
    if (!uri || !interpreter) {
        return "failed";
    }
    const currentStatus = sgRoot.getLibraryStatus(uri);
    if (currentStatus === "ready" || currentStatus === "failed") {
        // Already resolved (e.g. shared by multiple components or pre-loaded at startup).
        return currentStatus;
    }
    const label = id?.trim() || uri;
    sgRoot.setLibraryStatus(uri, "loading");
    BrsDevice.stdout.write(`debug,[sg] Loading component library "${label}" from ${uri}`);
    try {
        const bytes = fetchLibraryBytes(uri);
        if (!bytes) {
            sgRoot.setLibraryStatus(uri, "failed");
            return "failed";
        }
        const volume = libraryVolumeName(uri);
        BrsDevice.fileSystem.mountLibrary(volume, bytes);
        // The component namespace comes from the library manifest's `sg_component_libs_provided`
        // (per Roku); fall back to the node `id` when the manifest does not declare it.
        const namespace = readLibraryNamespace(volume) ?? id?.trim();
        if (!namespace) {
            BrsDevice.stderr.write(
                `warning,[sg] Component library manifest has no sg_component_libs_provided and no id is set: ${uri}`
            );
            sgRoot.setLibraryStatus(uri, "failed");
            return "failed";
        }
        BrsDevice.stdout.write(
            `debug,[sg] Mounted component library "${label}" as "${namespace}" (${bytes.byteLength} bytes) at volume ${volume}`
        );

        const libMap = getComponentDefinitionMap(BrsDevice.fileSystem, [], namespace, volume);
        if (libMap.size === 0) {
            BrsDevice.stderr.write(`warning,[sg] Component library "${label}" has no components: ${uri}`);
            sgRoot.setLibraryStatus(uri, "failed");
            return "failed";
        }

        // Merge the library components into the shared node definition map.
        for (const [name, def] of libMap.entries()) {
            sgRoot.nodeDefMap.set(name, def);
        }
        setupInterpreterWithSubEnvs(interpreter, libMap, interpreter.manifest);
        for (const [name, def] of libMap.entries()) {
            updateTypeDefHierarchy(def);
            BrsDevice.addNodeStat(getNodeType(name));
        }
        BrsDevice.stdout.write(
            `debug,[sg] Loaded component library "${namespace}" (${libMap.size} components) from ${uri}`
        );
        sgRoot.setLibraryStatus(uri, "ready");
        return "ready";
    } catch (err: any) {
        BrsDevice.stderr.write(`error,[sg] Failed to load component library "${label}" from ${uri}: ${err.message}`);
        sgRoot.setLibraryStatus(uri, "failed");
        return "failed";
    }
}
