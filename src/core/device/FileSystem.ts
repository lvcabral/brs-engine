import * as zenFS from "@zenfs/core";
import * as nodeFS from "fs";
import { Zip } from "@lvcabral/zip";

/** Proxy Object to make File System volumes case insensitive, same as Roku devices */

export class FileSystem {
    private readonly mfs: typeof zenFS.fs; // common:
    private pfs: typeof zenFS.fs | typeof nodeFS; // pkg:
    private xfs: typeof zenFS.fs | typeof nodeFS; // ext1:
    private tfs: typeof zenFS.fs; // tmp:
    private cfs: typeof zenFS.fs; // cachefs:
    private root?: string;
    private ext?: string;

    constructor(root?: string, ext?: string) {
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

    setRoot(root: string) {
        this.root = root;
        this.pfs = nodeFS;
    }

    setExt(ext: string) {
        this.ext = ext;
        this.xfs = nodeFS;
    }

    async resetMemoryFS() {
        if (zenFS.fs === undefined) {
            return;
        }
        zenFS.umount("tmp:");
        const tmp = await zenFS.resolveMountConfig({
            backend: zenFS.InMemory,
            caseFold: "lower" as const,
        });
        zenFS.mount("tmp:", tmp);
        zenFS.umount("cachefs:");
        const cachefs = await zenFS.resolveMountConfig({
            backend: zenFS.InMemory,
            caseFold: "lower" as const,
        });
        zenFS.mount("cachefs:", cachefs);
    }

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

    getPath(uri: string) {
        if (this.root && uri.trim().toLowerCase().startsWith("pkg:")) {
            uri = this.root + "/" + uri.trim().slice(4);
        } else if (this.ext && uri.trim().toLowerCase().startsWith("ext1:")) {
            uri = this.ext + "/" + uri.trim().slice(5);
        } else {
            uri = uri.toLowerCase();
        }
        return uri.replace(/\/+/g, "/").trim();
    }

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

    existsSync(uri: string) {
        return validUri(uri) && this.getFS(uri).existsSync(this.getPath(uri));
    }

    readFileSync(uri: string, encoding?: any) {
        const fs = this.getFS(uri);
        return (fs as any).readFileSync(this.getPath(uri), encoding);
    }

    readdirSync(uri: string) {
        return this.getFS(uri).readdirSync(this.getPath(uri));
    }

    mkdirSync(uri: string) {
        this.getFS(uri).mkdirSync(this.getPath(uri));
    }

    rmdirSync(uri: string) {
        if (writeUri(uri)) {
            const files = this.readdirSync(uri);
            if (files.length > 0) {
                throw new Error("Directory not empty!");
            }
        }
        this.getFS(uri).rmdirSync(this.getPath(uri));
    }

    unlinkSync(uri: string) {
        this.getFS(uri).unlinkSync(this.getPath(uri));
    }

    renameSync(oldName: string, newName: string) {
        const content = this.readFileSync(oldName);
        this.writeFileSync(newName, content);
        this.unlinkSync(oldName);
    }

    writeFileSync(uri: string, content: string | Buffer, encoding?: any) {
        this.getFS(uri).writeFileSync(this.getPath(uri), content, encoding);
    }

    statSync(uri: string) {
        return this.getFS(uri).statSync(this.getPath(uri));
    }
}

/*
 * Returns the volume from a brs file uri
 *   ex. "tmp:/test/test1.txt" -> "tmp:"
 */
export function getVolume(fileUri: string) {
    return fileUri.toLowerCase().substring(0, fileUri.indexOf(":") + 1);
}

/*
 * Returns true if the Uri is valid
 */
export function validUri(uri: string): boolean {
    return uri.trim() !== "" && !uri.startsWith("/") && !uri.startsWith("\\") && uri.includes(":/");
}

/*
 * Returns true if the Uri is from one of the two writeable volumes
 */
export function writeUri(uri: string): boolean {
    uri = uri.toLowerCase();
    return validUri(uri) && (uri.startsWith("tmp:/") || uri.startsWith("cachefs:/"));
}

/**
 * Initializes the File System with the provided zip files.
 * @param commonZip ArrayBuffer with the common storage zip file.
 * @param pkgZip ArrayBuffer with the package zip file.
 * @param extZip ArrayBuffer with the external storage zip file.
 */
export async function configureFileSystem(
    commonZip: ArrayBufferLike,
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
    Object.assign(fsConfig.mounts, { "tmp:": { backend: zenFS.InMemory } });
    // cachefs: volume
    if (zenFS?.mounts.get("/cachefs:")) {
        zenFS.umount("cachefs:");
    }
    Object.assign(fsConfig.mounts, { "cachefs:": { backend: zenFS.InMemory } });
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
