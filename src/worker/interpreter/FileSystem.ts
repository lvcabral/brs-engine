import MemoryFileSystem from "memory-fs";
import * as path from "path";
import * as zenFS from "@zenfs/core";

/** Proxy to make File System volumes case insensitive, same as Roku devices */

export class FileSystem {
    private paths: Map<string, string>;
    private zfs: typeof zenFS.fs; // pkg: and ext1:
    private tfs: MemoryFileSystem; // tmp:
    private cfs: MemoryFileSystem; // cachefs:
    private mfs: MemoryFileSystem; // common:

    constructor(zfs: typeof zenFS.fs) {
        this.paths = new Map();
        this.zfs = zfs;
        this.tfs = new MemoryFileSystem();
        this.cfs = new MemoryFileSystem();
        this.mfs = new MemoryFileSystem();
    }
    private savePath(uri: string) {
        this.paths.set(
            uri.toLowerCase().replace(/\/+/g, "/").trim(),
            uri.replace(/\/+/g, "/").trim()
        );
    }
    private deletePath(uri: string) {
        return this.paths.delete(uri.toLowerCase().replace(/\/+/g, "/").trim());
    }
    private getOriginalPath(uri: string) {
        return this.paths.get(uri.toLowerCase().replace(/\/+/g, "/").trim());
    }

    getFS(uri: string) {
        if (uri.toLowerCase().startsWith("tmp:")) {
            return this.tfs;
        } else if (uri.toLowerCase().startsWith("cachefs:")) {
            return this.cfs;
        } else if (uri.toLowerCase().startsWith("common:")) {
            return this.mfs;
        }
        return this.zfs;
    }

    getPath(uri: string) {
        return uri
            .toLowerCase()
            .replace("tmp:", "")
            .replace("cachefs:", "")
            .replace("common:", "")
            .replace(/\/+/g, "/")
            .trim();
    }

    volumesSync() {
        const volumes = this.zfs.readdirSync("/");
        volumes.push("tmp:");
        volumes.push("cachefs:");
        return volumes;
    }

    existsSync(uri: string) {
        return validUri(uri) && this.getFS(uri).existsSync(this.getPath(uri));
    }

    readFileSync(uri: string, encoding?: any): any {
        return this.getFS(uri).readFileSync(this.getPath(uri), encoding);
    }

    readdirSync(uri: string) {
        const files = this.getFS(uri).readdirSync(this.getPath(uri));
        if (memoryUri(uri) && files.length > 0) {
            const self = this;
            files.forEach(function (file: string, index: number) {
                const fullPath = path.posix.join(uri.toLowerCase(), file);
                const originalPath = self.getOriginalPath(fullPath);
                if (originalPath) {
                    files[index] = path.posix.basename(originalPath);
                }
            });
        }
        return files;
    }

    mkdirSync(uri: string) {
        this.getFS(uri).mkdirSync(this.getPath(uri));
        this.savePath(uri);
    }

    rmdirSync(uri: string) {
        this.getFS(uri).rmdirSync(this.getPath(uri));
        this.deletePath(uri);
    }

    unlinkSync(uri: string) {
        this.getFS(uri).unlinkSync(this.getPath(uri));
        this.deletePath(uri);
    }

    renameSync(oldName: string, newName: string) {
        const content = this.readFileSync(oldName);
        this.writeFileSync(newName, content);
        this.unlinkSync(oldName);
    }

    writeFileSync(uri: string, content: string | Buffer, encoding?: any) {
        this.getFS(uri).writeFileSync(this.getPath(uri), content, encoding);
        this.savePath(uri);
    }

    statSync(uri: string) {
        return this.getFS(uri).statSync(this.getPath(uri));
    }

    normalize(uri: string) {
        return zenFS.normalizePath(uri);
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

/*
 * Returns true if the Uri is from one of the in memory volumes (not zip based)
 */
export function memoryUri(uri: string): boolean {
    uri = uri.toLowerCase();
    return validUri(uri) && !(uri.startsWith("pkg:/") || uri.startsWith("ext1:/"));
}
