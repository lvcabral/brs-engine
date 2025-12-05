/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as zenFS from "@zenfs/core";
import * as nodeFS from "fs";
import { Zip } from "@lvcabral/zip";

/** Proxy Object to make File System volumes case insensitive, same as Roku devices */

export class FileSystem {
    private readonly paths: Map<string, string>;
    private readonly mfs: typeof zenFS.fs; // common:
    private readonly tfs: typeof zenFS.fs; // tmp:
    private readonly cfs: typeof zenFS.fs; // cachefs:
    private pfs: typeof zenFS.fs | typeof nodeFS; // pkg:
    private xfs: typeof zenFS.fs | typeof nodeFS; // ext1:
    private root?: string;
    private ext?: string;

    /**
     * Creates a new FileSystem instance.
     * @param root Optional root path for pkg: volume (uses Node.js fs if provided)
     * @param ext Optional external storage path for ext1: volume (uses Node.js fs if provided)
     */
    constructor(root?: string, ext?: string) {
        this.paths = new Map<string, string>();
        if (root) {
            this.root = root;
            this.pfs = nodeFS;
        } else {
            this.pfs = zenFS.fs;
        }
        if (ext) {
            this.ext = ext;
            this.xfs = nodeFS;
        } else {
            this.xfs = zenFS.fs;
        }
        this.mfs = zenFS.fs;
        this.tfs = zenFS.fs;
        this.cfs = zenFS.fs;
    }

    /**
     * Saves the original case-preserved path mapping.
     * @param uri File URI to save
     */
    private savePath(uri: string) {
        this.paths.set(uri.toLowerCase().replace(/\/+/g, "/").trim(), uri.replace(/\/+/g, "/").trim());
    }

    /**
     * Deletes a path from the case-preserved mapping.
     * @param uri File URI to delete
     * @returns True if path was deleted, false if not found
     */
    private deletePath(uri: string) {
        return this.paths.delete(uri.toLowerCase().replace(/\/+/g, "/").trim());
    }

    /**
     * Gets the original case-preserved path.
     * @param uri File URI (case-insensitive)
     * @returns Original path with preserved case or undefined if not found
     */
    private getOriginalPath(uri: string) {
        return this.paths.get(uri.toLowerCase().replace(/\/+/g, "/").trim());
    }

    /**
     * Sets the root path for pkg: volume.
     * Switches to Node.js file system for pkg: access.
     * @param root Root directory path
     */
    setRoot(root: string) {
        this.root = root;
        this.pfs = nodeFS;
    }

    /**
     * Sets the external storage path for ext1: volume.
     * Switches to Node.js file system for ext1: access.
     * @param ext External storage directory path
     */
    setExt(ext: string) {
        this.ext = ext;
        this.xfs = nodeFS;
    }

    /**
     * Resets the memory-based file systems (tmp: and cachefs:).
     * Unmounts and remounts volumes with new buffers.
     * @param tmpBuffer ArrayBufferLike for tmp: volume
     * @param cacheFSBuffer ArrayBufferLike for cachefs: volume
     */
    async resetMemoryFS(tmpBuffer: ArrayBufferLike, cacheFSBuffer: ArrayBufferLike) {
        if (zenFS.fs === undefined) {
            return;
        }
        zenFS.umount("tmp:");
        const tmp = await zenFS.resolveMountConfig({
            backend: zenFS.SingleBuffer,
            buffer: tmpBuffer,
            caseFold: "lower" as const,
        });
        zenFS.mount("tmp:", tmp);
        zenFS.umount("cachefs:");
        const cachefs = await zenFS.resolveMountConfig({
            backend: zenFS.SingleBuffer,
            buffer: cacheFSBuffer,
            caseFold: "lower" as const,
        });
        zenFS.mount("cachefs:", cachefs);
    }

    /**
     * Gets the appropriate file system for a given URI.
     * @param uri File URI with volume prefix
     * @returns File system instance for the volume
     */
    getFS(uri: string) {
        if (uri.trim().toLowerCase().startsWith("tmp:")) {
            return this.tfs;
        } else if (uri.trim().toLowerCase().startsWith("cachefs:")) {
            return this.cfs;
        } else if (uri.trim().toLowerCase().startsWith("common:")) {
            return this.mfs;
        } else if (uri.trim().toLowerCase().startsWith("ext1:")) {
            return this.xfs;
        }
        return this.pfs;
    }

    /**
     * Converts a Roku volume URI to an actual file system path.
     * Handles pkg: and ext1: volume path resolution.
     * @param uri Roku volume URI
     * @returns Resolved file system path
     */
    getPath(uri: string) {
        if (this.root && uri.trim().toLowerCase().startsWith("pkg:")) {
            uri = this.root + "/" + uri.trim().slice(4);
        } else if (this.ext && uri.trim().toLowerCase().startsWith("ext1:")) {
            uri = this.ext + "/" + uri.trim().slice(5);
        } else if (!this.root) {
            uri = uri.toLowerCase();
        }
        return uri.replace(/\/+/g, "/").trim();
    }

    /**
     * Lists all available mounted volumes.
     * @returns Array of volume names (e.g., ["pkg:", "tmp:", "cachefs:"])
     */
    volumesSync() {
        const volumes: string[] = [];
        if (this.root || this.pfs.existsSync("pkg:/")) {
            volumes.push("pkg:");
        }
        if (this.ext || this.xfs.existsSync("ext1:/")) {
            volumes.push("ext1:");
        }
        if (this.mfs.existsSync("common:/")) {
            volumes.push("common:");
        }
        volumes.push("tmp:");
        volumes.push("cachefs:");
        return volumes;
    }

    /**
     * Checks if a file or directory exists.
     * @param uri File or directory URI
     * @returns True if exists, false otherwise
     */
    existsSync(uri: string) {
        return validUri(uri) && this.getFS(uri).existsSync(this.getPath(uri));
    }

    /**
     * Reads a file synchronously.
     * @param uri File URI
     * @param encoding Optional encoding (e.g., "utf8")
     * @returns File contents as string or Buffer
     */
    readFileSync(uri: string, encoding?: any) {
        const fs = this.getFS(uri);
        return (fs as any).readFileSync(this.getPath(uri), encoding);
    }

    /**
     * Reads directory contents synchronously.
     * Preserves original case for writeable volumes.
     * @param uri Directory URI
     * @returns Array of file/directory names
     */
    readdirSync(uri: string) {
        const files = this.getFS(uri).readdirSync(this.getPath(uri));
        if (writeUri(uri) && files.length > 0) {
            for (const [index, file] of files.entries()) {
                const fullPath = path.posix.join(uri.toLowerCase(), file);
                const originalPath = this.getOriginalPath(fullPath);
                if (originalPath) {
                    files[index] = path.posix.basename(originalPath);
                }
            }
        }
        return files;
    }

    /**
     * Creates a directory synchronously.
     * Saves path mapping for case preservation.
     * @param uri Directory URI to create
     */
    mkdirSync(uri: string) {
        this.getFS(uri).mkdirSync(this.getPath(uri));
        this.savePath(uri);
    }

    /**
     * Removes a directory synchronously.
     * Throws error if directory is not empty.
     * @param uri Directory URI to remove
     */
    rmdirSync(uri: string) {
        if (writeUri(uri)) {
            const files = this.readdirSync(uri);
            if (files.length > 0) {
                throw new Error("Directory not empty!");
            }
        }
        this.getFS(uri).rmdirSync(this.getPath(uri));
        this.deletePath(uri);
    }

    /**
     * Deletes a file synchronously.
     * @param uri File URI to delete
     */
    unlinkSync(uri: string) {
        this.getFS(uri).unlinkSync(this.getPath(uri));
        this.deletePath(uri);
    }

    /**
     * Renames a file by copying and deleting.
     * @param oldName Current file URI
     * @param newName New file URI
     */
    renameSync(oldName: string, newName: string) {
        const content = this.readFileSync(oldName);
        this.writeFileSync(newName, content);
        this.unlinkSync(oldName);
    }

    /**
     * Writes a file synchronously.
     * Saves path mapping for case preservation.
     * @param uri File URI to write
     * @param content File content (string or Buffer)
     * @param encoding Optional encoding
     */
    writeFileSync(uri: string, content: string | Buffer, encoding?: any) {
        this.getFS(uri).writeFileSync(this.getPath(uri), content, encoding);
        this.savePath(uri);
    }

    /**
     * Gets file or directory statistics.
     * @param uri File or directory URI
     * @returns Stats object with file information
     */
    statSync(uri: string) {
        return this.getFS(uri).statSync(this.getPath(uri));
    }

    /**
     * Recursively finds all files with a given extension.
     * @param uri Directory URI to search
     * @param ext File extension to match (without dot)
     * @returns Array of file paths matching the extension
     */
    findSync(uri: string, ext: string): string[] {
        let results: string[] = [];
        const fs = this.getFS(uri);

        function readDirRecursive(currentDir: string) {
            const files = fs.readdirSync(currentDir);

            for (const file of files) {
                const fullPath = path.join(currentDir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    readDirRecursive(fullPath);
                } else if (path.extname(file) === `.${ext}`) {
                    results.push(fullPath);
                }
            }
        }

        readDirRecursive(this.getPath(uri));
        return results;
    }
}

/**
 * Extracts the volume prefix from a file URI.
 * @param fileUri File URI with volume prefix (e.g., "tmp:/test/test1.txt")
 * @returns Volume prefix (e.g., "tmp:")
 * @example getVolume("tmp:/test/test1.txt") returns "tmp:"
 */
export function getVolume(fileUri: string) {
    return fileUri.toLowerCase().substring(0, fileUri.indexOf(":") + 1);
}

/**
 * Checks if a URI is valid Roku file URI format.
 * Valid URIs must contain ":/ " and not start with "/" or "\".
 * @param uri URI to validate
 * @returns True if URI is valid, false otherwise
 */
export function validUri(uri: string): boolean {
    return uri.trim() !== "" && !uri.startsWith("/") && !uri.startsWith("\\") && uri.includes(":/");
}

/**
 * Checks if a URI points to a writeable volume.
 * Only tmp: and cachefs: volumes are writeable.
 * @param uri URI to check
 * @returns True if URI is from tmp: or cachefs: volume, false otherwise
 */
export function writeUri(uri: string): boolean {
    uri = uri.toLowerCase();
    return validUri(uri) && (uri.startsWith("tmp:/") || uri.startsWith("cachefs:/"));
}

/**
 * Initializes the File System with the provided zip files.
 * @param commonZip ArrayBufferLike with the common volume zip file.
 * @param tmp ArrayBufferLike with the tmp volume zip file.
 * @param cacheFS ArrayBufferLike with the cacheFS volume zip file.
 * @param pkgZip ArrayBufferLike with the package zip file.
 * @param extZip ArrayBufferLike with the external storage zip file.
 */
export async function configureFileSystem(
    commonZip: ArrayBufferLike,
    tmp: ArrayBufferLike,
    cacheFS: ArrayBufferLike,
    pkgZip?: ArrayBufferLike,
    extZip?: ArrayBufferLike
): Promise<void> {
    const fsConfig = { mounts: {}, caseFold: "lower" as const };
    // common: volume
    if (zenFS?.mounts.get("/common:")) {
        zenFS.umount("common:");
    }
    Object.assign(fsConfig.mounts, { "common:": { backend: Zip, data: commonZip } });
    // tmp: volume
    if (zenFS?.mounts.get("/tmp:")) {
        zenFS.umount("tmp:");
    }
    Object.assign(fsConfig.mounts, { "tmp:": { backend: zenFS.SingleBuffer, buffer: tmp } });
    // cachefs: volume
    if (zenFS?.mounts.get("/cachefs:")) {
        zenFS.umount("cachefs:");
    }
    Object.assign(fsConfig.mounts, { "cachefs:": { backend: zenFS.SingleBuffer, buffer: cacheFS } });
    // pkg: volume
    if (zenFS?.mounts.get("/pkg:")) {
        zenFS.umount("pkg:");
    }
    if (pkgZip) {
        Object.assign(fsConfig.mounts, { "pkg:": { backend: Zip, data: pkgZip } });
    } else {
        Object.assign(fsConfig.mounts, { "pkg:": { backend: zenFS.InMemory } });
    }
    // ext1: volume
    if (zenFS?.mounts.get("/ext1:")) {
        zenFS.umount("ext1:");
    }
    if (extZip) {
        Object.assign(fsConfig.mounts, { "ext1:": { backend: Zip, data: extZip } });
    }
    // Apply configuration
    return zenFS.configure(fsConfig);
}
