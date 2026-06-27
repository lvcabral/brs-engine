/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Optional outer encryption for the whole package container (`.bpk`). On top of the per-source
 * `source/data` blob, the entire zip can be encrypted so that even the plaintext assets (images,
 * fonts, data files, manifest) are unreadable without the password.
 *
 * The container is `[MAGIC][IV][AES-256-CTR(zip)]`. Detection is by the MAGIC prefix, so a plain
 * zip / legacy `.bpk` (which always starts with the `PK` local-file header) is opened unchanged —
 * the encryption is fully backward compatible.
 *
 * This layer uses the Web Crypto API (`globalThis.crypto.subtle`), available natively in browsers
 * (the engine already requires a secure context) and in Node 22+. It therefore runs on the main
 * thread / CLI where the package is unzipped, without pulling a Node-crypto polyfill into the API
 * bundle. It is self-contained: the same algorithm/parameters are used to encrypt and decrypt.
 */

/** 8-byte container signature: "BRSBPK1\0". A zip never starts with these bytes (it starts "PK"). */
const MAGIC = new Uint8Array([0x42, 0x52, 0x53, 0x42, 0x50, 0x4b, 0x31, 0x00]);
/** AES-CTR initialization vector length, in bytes. */
const IV_LENGTH = 16;
/** Local-file-header signature ("PK\x03\x04") used to validate a successful decryption. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/**
 * Web Crypto's `BufferSource` type is stricter about the backing buffer (`ArrayBuffer`) than our
 * generic `Uint8Array` views; at runtime every view here is `ArrayBuffer`-backed, so this coercion
 * is safe and avoids copying potentially large package bytes.
 * @param view The byte view to pass to a Web Crypto call.
 */
function bytes(view: Uint8Array): BufferSource {
    return view as unknown as BufferSource;
}

/**
 * Returns true when the data is an outer-encrypted package container (has the MAGIC prefix).
 * @param data Raw package bytes.
 */
export function isEncryptedPackage(data: Uint8Array): boolean {
    if (data.length < MAGIC.length) {
        return false;
    }
    return MAGIC.every((byte, index) => data[index] === byte);
}

/**
 * Derives the 32-byte AES-256 key from the password. The CLI enforces a 32-character password; if a
 * different length is provided the UTF-8 bytes are truncated/zero-padded to 32 bytes.
 * @param password Encryption password.
 */
function deriveKey(password: string): Uint8Array {
    const bytes = new TextEncoder().encode(password);
    if (bytes.length === 32) {
        return bytes;
    }
    const key = new Uint8Array(32);
    key.set(bytes.subarray(0, 32));
    return key;
}

/**
 * Wraps a zip package in an encrypted container using the given password. Returns the zip unchanged
 * when no password is provided (no outer encryption).
 * @param zip The plain zip bytes to protect.
 * @param password Encryption password (same one used for the source blob).
 */
export async function encryptPackage(zip: Uint8Array, password: string): Promise<Uint8Array> {
    if (!password) {
        return zip;
    }
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await globalThis.crypto.subtle.importKey("raw", bytes(deriveKey(password)), "AES-CTR", false, [
        "encrypt",
    ]);
    const cipher = new Uint8Array(
        await globalThis.crypto.subtle.encrypt({ name: "AES-CTR", counter: bytes(iv), length: 64 }, key, bytes(zip))
    );
    const out = new Uint8Array(MAGIC.length + IV_LENGTH + cipher.length);
    out.set(MAGIC, 0);
    out.set(iv, MAGIC.length);
    out.set(cipher, MAGIC.length + IV_LENGTH);
    return out;
}

/**
 * Opens a package container. If it is not an encrypted container (no MAGIC prefix) the data is
 * returned unchanged, so plain zips and legacy `.bpk` files load exactly as before. Otherwise the
 * password is required and the decrypted zip is returned; a wrong password is detected by the
 * absence of the zip local-file-header in the result.
 * @param data Raw package bytes.
 * @param password Password to decrypt the container.
 */
export async function decryptPackage(data: Uint8Array, password: string): Promise<Uint8Array> {
    if (!isEncryptedPackage(data)) {
        return data;
    }
    if (!password) {
        throw new Error("This package is password protected; a password is required to open it.");
    }
    const iv = data.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
    const cipher = data.subarray(MAGIC.length + IV_LENGTH);
    const key = await globalThis.crypto.subtle.importKey("raw", bytes(deriveKey(password)), "AES-CTR", false, [
        "decrypt",
    ]);
    const plain = new Uint8Array(
        await globalThis.crypto.subtle.decrypt({ name: "AES-CTR", counter: bytes(iv), length: 64 }, key, bytes(cipher))
    );
    if (!ZIP_MAGIC.every((byte, index) => plain[index] === byte)) {
        throw new Error("Invalid password for the encrypted package.");
    }
    return plain;
}
