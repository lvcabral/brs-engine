import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // The suite is plain CommonJS and uses describe/it/expect (and now `vi`) un-imported.
        globals: true,
        environment: "node",
        include: ["test/**/*.test.js"],
        exclude: ["**/node_modules/**", "out/**"],
        // `forks` rather than `threads`: test/node/host.test.js spawns real worker_threads,
        // and the engine bundle eagerly requires node-canvas (a native addon). Never use
        // `vmThreads` - it reintroduces the VM-realm problem that breaks `instanceof
        // SharedArrayBuffer` (see the `isTypeOf` note in .claude/CLAUDE.md).
        pool: "forks",
        // Keep Jest's per-file freshness: the engine bundle holds module-level singletons
        // (BrsDevice, sgRoot, zenFS, the Graphics registry, the extension registry) and
        // several suites patch globals/prototypes without restoring them.
        isolate: true,
        testTimeout: 20000,
        // test/cli spawns one `node brs.cli.js` child process per test; uncapped concurrency
        // would thrash.
        maxConcurrency: 8,
    },
});
