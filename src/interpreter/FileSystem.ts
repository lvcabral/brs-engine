import MemoryFileSystem from "memory-fs";
import * as Path from "path";

/** Proxy to make MemoryFileSystem case insensitive as Roku File System */
export class FileSystem {
    private fs: MemoryFileSystem;
    private paths: Map<string, string>;

    constructor() {
        this.fs = new MemoryFileSystem();
        this.paths = new Map();
    }

    existsSync(path: string) {
        return this.fs.existsSync(path.toLowerCase());
    }

    readFileSync(path: string, encoding?: string) {
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
        this.paths.set(path.toLowerCase(), path);
        this.fs.mkdirSync(path.toLowerCase());
    }

    rmdirSync(path: string) {
        this.paths.delete(path.toLowerCase());
        this.fs.rmdirSync(path.toLowerCase());
    }

    rmfileSync(path: string) {
        this.paths.delete(path.toLowerCase());
        this.fs.unlinkSync(path.toLowerCase());
    }

    writeFileSync(path: string, content: string | Buffer, encoding?: string) {
        this.paths.set(path.toLowerCase(), path);
        this.fs.writeFileSync(path.toLowerCase(), content, encoding);
    }

    statSync(path: string) {
        return this.fs.statSync(path.toLowerCase());
    }

    normalize(path: string) {
        return this.fs.normalize(path);
    }
}
