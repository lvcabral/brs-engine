/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { GraphicsBitmap, GraphicsData, MaxTextureMemory } from "../common";

/**
 * Global texture-memory registry, modeling Roku's internal `roGraphics` object.
 *
 * This module keeps a set of every live bitmap currently loaded into "texture memory"
 * so it can be reported via the ECP `query/r2d2-bitmaps` endpoint (and, later, telnet).
 * It is intentionally dependency-light: bitmaps are tracked through the structural
 * `GraphicsTexture` interface (satisfied by `RoBitmap`) and fonts are pulled lazily
 * through a provider hook set by the font registry, so neither this module nor
 * `BrsDevice` needs to import the concrete `RoBitmap`/`RoFontRegistry` classes.
 */

/** Minimal structural view of a bitmap held in texture memory. */
export interface GraphicsTexture {
    readonly width: number;
    readonly height: number;
    readonly address: string;
    getImageName(): string;
    hasAlpha(): boolean;
    isValid(): boolean;
}

// Set of live bitmaps currently loaded into texture memory.
const textures = new Set<GraphicsTexture>();

// Incrementing counter used to generate synthetic pointer-like addresses.
let addressCounter = 0x1e100000;

// Optional provider returning the registered fonts as graphics bitmaps.
let fontProvider: (() => GraphicsBitmap[]) | undefined;

/** Generates the next synthetic pointer-like address (hex string). */
export function nextAddress(): string {
    addressCounter += 0x70;
    return `0x${addressCounter.toString(16)}`;
}

/** Adds a bitmap to the texture-memory registry. */
export function registerTexture(texture: GraphicsTexture): void {
    textures.add(texture);
}

/** Removes a bitmap from the texture-memory registry. */
export function unregisterTexture(texture: GraphicsTexture): void {
    textures.delete(texture);
}

/** Clears the texture-memory registry (used on app shutdown/reset). */
export function clearTextures(): void {
    textures.clear();
}

/** Registers a provider that returns the currently registered fonts as bitmaps. */
export function setFontTextureProvider(provider: () => GraphicsBitmap[]): void {
    fontProvider = provider;
}

/** Builds a `GraphicsBitmap` entry from a live texture. */
function toBitmap(texture: GraphicsTexture): GraphicsBitmap {
    const bpp = texture.hasAlpha() ? 4 : 3;
    const width = texture.width;
    const height = texture.height;
    return {
        address: texture.address,
        width,
        height,
        bpp,
        size: width * height * bpp, // Approximate: Roku pads to texture alignment
        name: texture.getImageName(),
    };
}

/**
 * Collects the current texture-memory state as a `GraphicsData` object.
 * @param channelId the running app id (or "dev" for sideloaded apps)
 * @param max the maximum texture memory in bytes
 */
export function collectGraphicsData(channelId: string, max: number = MaxTextureMemory): GraphicsData {
    const bitmaps: GraphicsBitmap[] = [];
    for (const texture of textures) {
        if (texture.isValid() && texture.width > 0 && texture.height > 0) {
            bitmaps.push(toBitmap(texture));
        }
    }
    if (fontProvider) {
        bitmaps.push(...fontProvider());
    }
    let used = 0;
    for (const bitmap of bitmaps) {
        used += bitmap.size;
    }
    return {
        timestamp: Date.now(),
        channelId: channelId || "dev",
        systemMemory: { used: 0 },
        textureMemory: { used, available: Math.max(0, max - used), max },
        bitmaps,
    };
}
