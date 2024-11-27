import * as Path from "path";
import * as zenFS from "@zenfs/core";

/** Proxy to make InMemory volumes case insensitive as Roku File System */

export class FileSystem {
    private paths: Map<string, string>;
    private fs: typeof zenFS.fs;

    constructor(fs: typeof zenFS.fs) {
        this.paths = new Map();
        this.fs = fs;
    }

    existsSync(path: string) {
        return this.fs.existsSync(path.toLowerCase());
    }

    readFileSync(path: string, encoding?: any): any {
        return this.fs.readFileSync(path.toLowerCase(), encoding);
    }

    readdirSync(path: string) {
        const files = this.fs.readdirSync(path.toLowerCase());
        const paths = this.paths;
        if (files.length > 0) {
            files.forEach(function (file: string, index: number) {
                let fullPath = Path.join(path.toLowerCase(), file);
                if (paths.has(fullPath)) {
                    files[index] = Path.basename(paths.get(fullPath) as string);
                }
            });
        }
        return files;
    }

    mkdirSync(path: string) {
        this.fs.mkdirSync(path.toLowerCase());
        this.paths.set(path.toLowerCase(), path);
    }

    rmdirSync(path: string) {
        this.fs.rmdirSync(path.toLowerCase());
        this.paths.delete(path.toLowerCase());
    }

    unlinkSync(path: string) {
        this.fs.unlinkSync(path.toLowerCase());
        this.paths.delete(path.toLowerCase());
    }

    renameSync(oldPath: string, newPath: string) {
        this.fs.renameSync(oldPath.toLowerCase(), newPath.toLowerCase());
        this.paths.delete(oldPath.toLowerCase());
        this.paths.set(newPath.toLowerCase(), newPath);
    }

    writeFileSync(path: string, content: string | Buffer, encoding?: any) {
        this.fs.writeFileSync(path.toLowerCase(), content, encoding);
        this.paths.set(path.toLowerCase(), path);
    }

    statSync(path: string) {
        return this.fs.statSync(path.toLowerCase());
    }

    normalize(path: string) {
        return zenFS.normalizePath(path);
    }
}

/*
 * Returns the volume from a brs file uri
 *   ex. "tmp:/test/test1.txt" -> "tmp:"
 */
export function getVolume(fileUri: string) {
    return fileUri.substring(0, fileUri.indexOf(":") + 1);
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
    return validUri(uri) && (uri.startsWith("tmp:/") || uri.startsWith("cachefs:/"));
}

