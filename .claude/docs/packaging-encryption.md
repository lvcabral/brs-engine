# App packaging & encryption (`.bpk`)

Deep detail on `--pack`. Read this **before** touching `src/core/packageEncryption.ts`,
`src/{cli,api}/package.ts`, `FileSystem`'s source overlay, or the encrypted-app code paths in
`src/core/index.ts`.

`brs-cli --pack <password> --out <dir>` turns a plaintext app (`.zip` or `--root` folder) into an
**encrypted `.bpk`**. The password is the **raw AES-256-CTR key — exactly 32 chars** (no KDF/salt), and is
required to *run* the `.bpk` (`--pack <password>`, or `options.password` in the browser API).

**Two independent encryption layers**, same password:
1. The **source blob** (`source/data`) — precompiled token stream + raw component text.
2. The **whole-package container** — the entire zip wrapped in AES-256-CTR so even plaintext assets are
   unreadable at rest.

## Package container encryption (`src/core/packageEncryption.ts`)

Standard libs can't do per-entry zip encryption (`fflate` has none; `@lvcabral/zip` documents "No
encryption"), so the whole zip is wrapped: `[MAGIC "BRSBPK1\0"][16-byte IV][AES-256-CTR(zip)]`.
`encryptPackage` wraps at pack time (CLI `runApp` after `updateAppZip`; exported for browser packers);
`decryptPackage` unwraps in `loadAppZip` **before** `unzipSync` (both `src/cli/package.ts` and
`src/api/package.ts`, now `async` + password). The password reaches `loadAppZip` from `program.pack` (CLI) /
`currentApp.password` (browser).

- **Backward compatible by construction:** a real zip starts with `PK\x03\x04`, never `BRSBPK1`, so
  `decryptPackage` returns plain zips / legacy `.bpk`s untouched. A wrong password is caught by checking
  the decrypted bytes start with `PK` → "Invalid password" (CTR has no auth tag).
- **Uses Web Crypto (`globalThis.crypto.subtle`), not Node `crypto`** — the package is unzipped on the
  main thread / API bundle (`target: web`), which has no `crypto`/`Buffer` polyfill. Web Crypto is native
  in browsers and Node 22+, so no bundle cost.
- **Performance: negligible.** Hardware AES (~6–8 GB/s): a 3.4 MB package decrypts in ~0.6 ms, 50 MB in
  ~8 ms. Container adds 24 bytes.

## What gets encrypted, and the blob format

Two things fold into a **single encrypted blob** (`encode({ pcode, files })` → `zlibSync` →
AES-256-CTR), written as `source/data` (ciphertext) + `source/var` (IV), originals stripped:

- **`pkg:/source/*.brs`** → lexed/preprocessed to a **token stream** (`pcode`) — long-standing (`runSource`
  via `lexParseSync`).
- **`pkg:/components/**/*.{brs,xml}`** → stored as **raw text** in `files`, keyed by lowercase
  package-relative path (`collectComponentFiles`). Covers external scripts *and* inline `<script>` blocks.

Backward compatible: legacy `.bpk`s have no `files` key. Core stays SceneGraph-agnostic — it treats
`components/**` as opaque "extra encrypted files".

## Runtime restore — the FileSystem overlay (do not replace with a mounted volume)

On decrypt (`runEncrypted`, and `executeTask` for browser Task threads), `files` is pushed into an
**opt-in in-memory overlay** on `FileSystem` via `setSourceOverlay`. `existsSync`/`readFileSync`/`statSync`/
`findSync` consult the overlay first **only when non-empty** (zero change for normal apps). The SceneGraph
loader (`getComponentDefinitionMap`) and `ComponentScopeResolver` read decrypted components transparently.

**Source protection — the overlay is consumed, then dropped.** `setupInterpreterWithSubEnvs` (from the
SceneGraph `onBeforeExecute`) **eagerly parses every component's scripts** before `Main` runs, so
`runBeforeExecuteHooks` calls `clearSourceOverlay()` right after. From then on the app's own BrightScript
(`ReadAsciiFile`, `roFileSystem`, `MatchFiles`/`ListDir`, …) sees the component `.brs`/`.xml` as absent —
matching the protection tokenized `source/` already gives. Also cleared on each `setup()`.

> The overlay was chosen over "decrypt then mount a reorganized `pkg:` volume": zenFS's `CopyOnWrite`
> can't init through the synchronous `configureSync` the engine uses (async `create()` → `EAGAIN`); manual
> `CopyOnWriteFS` loses `caseFold:"lower"` (Roku fs is case-insensitive) and crashes `readdir` on the
> Zip's empty `components/` dir. The synchronous fallbacks cost full-app memory/startup since the Zip
> backend reads lazily. The overlay is synchronous, case-correct, minimal-memory, and free of zenFS
> internals.

## Stripping & SceneGraph detection (two `updateAppZip`s + a `components/` marker)

`updateAppZip(source, iv, packedFiles)` rebuilds the package, dropping `source/*` **and** every path in
`packedFiles`. **Two copies must stay in sync**: `src/cli/package.ts` (CLI) and `src/api/package.ts`
(browser). Both then call `stripEncryptedComponentDirs`, which **prunes the now-empty `components/`
subtree** (it would leak app structure) — keeping only dirs holding surviving non-encrypted assets, plus a
single top-level `components/` marker.

The marker matters because the **browser** decides whether to load SceneGraph by scanning the package
(`loadAppZip`): unencrypted apps are detected by a `components/*.xml` entry, but an encrypted app's XML is
gone, so it's detected by the preserved folder
(`hasSceneGraph = isEncrypted ? hasComponentsFolder : hasSGComponents`). The CLI registers SceneGraph
unconditionally (`--no-sg` to disable), so this detection is browser-only. `TaskPayload.password` is
threaded through (`src/core/common.ts`, `src/api/task.ts`) so browser Task threads can decrypt.

Regression: the "SceneGraph .bpk encryption" suite in `test/cli/cli.test.js`.

## Encrypted apps always run in production mode

`debugOnCrash` is forced off in `executeFile`/`executeTask` (`isEncryptedPayload`) so a protected app can't
be inspected. See the production-vs-developer-mode section in `.claude/CLAUDE.md`.
