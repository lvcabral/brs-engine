import * as path from "path";
import * as zenFS from "@zenfs/core";
import * as nodeFS from "fs";
import { Zip } from "@lvcabral/zip";
import MemoryFileSystem from "@lvcabral/memory-fs";

/** Proxy Object to make File System volumes case insensitive, same as Roku devices */

export class FileSystem {
    private readonly paths: Map<string, string>;
    private readonly mfs: typeof zenFS.fs; // common:
    private pfs: typeof zenFS.fs | typeof nodeFS; // pkg:
    private xfs: typeof zenFS.fs | typeof nodeFS; // ext1:
    private tfs: MemoryFileSystem; // tmp:
    private cfs: MemoryFileSystem; // cachefs:
    private root?: string;
    private ext?: string;

    constructor(root?: string, ext?: string) {
        this.paths = new Map();
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
        this.tfs = new MemoryFileSystem();
        this.cfs = new MemoryFileSystem();
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

    setRoot(root: string) {
        this.root = root;
        this.pfs = nodeFS;
    }

    setExt(ext: string) {
        this.ext = ext;
        this.xfs = nodeFS;
    }

    resetMemoryFS() {
        this.tfs = new MemoryFileSystem();
        this.cfs = new MemoryFileSystem();
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
        return uri.replace("tmp:", "").replace("cachefs:", "").replace(/\/+/g, "/").trim();
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
        const files = this.getFS(uri).readdirSync(this.getPath(uri));
        if (writeUri(uri) && files.length > 0) {
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
        if (writeUri(uri)) {
            const files = this.readdirSync(uri);
            if (files.length > 0) {
                throw new Error("Directory not empty!");
            }
        }
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
 * @param pkgZip ArrayBuffer with the package zip file.
 * @param extZip ArrayBuffer with the external storage zip file.
 */
export async function configureFileSystem(
    commonZip: ArrayBuffer,
    pkgZip?: ArrayBuffer,
    extZip?: ArrayBuffer
): Promise<void> {
    const fsConfig = { mounts: {} };
    if (zenFS.fs?.existsSync("common:/")) {
        zenFS.umount("common:");
    }
    Object.assign(fsConfig.mounts, {
        "common:": { backend: Zip, data: commonZip, caseSensitive: false },
    });
    if (zenFS.fs?.existsSync("pkg:/")) {
        zenFS.umount("pkg:");
    }
    if (pkgZip) {
        Object.assign(fsConfig.mounts, {
            "pkg:": { backend: Zip, data: pkgZip, caseSensitive: false },
        });
    } else {
        Object.assign(fsConfig.mounts, {
            "pkg:": zenFS.InMemory,
        });
    }
    if (extZip) {
        if (zenFS.fs?.existsSync("ext1:/")) {
            zenFS.umount("ext1:");
        }
        Object.assign(fsConfig.mounts, {
            "ext1:": { backend: Zip, data: extZip, caseSensitive: false },
        });
    }
    return zenFS.configure(fsConfig);
}
