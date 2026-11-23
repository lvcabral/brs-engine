import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsImageData,
    createNewCanvas,
    drawImageAtPos,
    putImageAtPos,
    releaseCanvas,
} from "../interfaces/IfDraw2D";

/** Most tinted copies one surface keeps, and the most pixels they may add up to. */
const MAX_ENTRIES = 64;
const MAX_PIXELS = 4_000_000;
/**
 * Most pixels held across every surface beyond its first tinted copy: the other copies, the scratch canvas
 * and the kept source pixels. Past it a surface keeps tinting, through its scratch canvas.
 */
const GLOBAL_MAX_PIXELS = 16_000_000;
/** A copy unused this long can be repainted with another tint, and the next sweep releases it. */
const IDLE_MS = 1000;
/** Tints recently missed per surface: a tint gets a copy of its own on its second miss. */
const MISS_MEMORY = 64;

/** Pixels held by every cache beyond its first copy, bounded by `GLOBAL_MAX_PIXELS`. */
let heldPixels = 0;
/** Caches holding more than their first copy, which the sweep trims once idle. */
const trimmable = new Set<TintCache>();
let lastSweep = 0;

/**
 * A 256-entry table mapping a channel value to `value * multiplier / 255`. Byte-identical to the multiply
 * for all 65536 pairs and ~2.3x faster over a full-screen surface; cached per multiplier.
 */
const channelScales = new Map<number, Uint8ClampedArray>();

function channelScale(multiplier: number): Uint8ClampedArray {
    let table = channelScales.get(multiplier);
    if (!table) {
        table = new Uint8ClampedArray(256);
        for (let value = 0; value < 256; value++) {
            table[value] = (value * multiplier) / 255;
        }
        channelScales.set(multiplier, table);
    }
    return table;
}

interface TintEntry {
    canvas: BrsCanvas;
    /** The `TintCache.epoch` the copy was painted in; older copies hold stale pixels. */
    epoch: number;
    lastUsed: number;
}

/**
 * Tinted copies of one surface (an `roBitmap` or `roAnimatedImage` canvas), keyed by the blend color's RGB.
 * The alpha byte is not part of the key: it is the blit's transparency, applied when the copy is drawn.
 *
 * Every surface may keep one copy, so a surface always drawn with the same tint never re-tints. Further
 * copies are made only for a tint missed a second time, stay within the per-surface and global budgets,
 * and are released after `IDLE_MS` without use. A tint that gets no copy is painted into a scratch canvas.
 * The surface's pixels are kept between tints only once it has been painted with two tints since it last
 * changed.
 */
export class TintCache {
    private readonly entries = new Map<number, TintEntry>();
    private readonly misses = new Set<number>();
    private scratch?: BrsCanvas;
    private scratchUsed = 0;
    /** The surface's pixels, kept for a surface tinted several ways so each tint skips the read-back. */
    private source?: BrsImageData;
    private epoch = 0;
    /** Tints painted from the surface's pixels since it last changed. */
    private paints = 0;
    /** Whether the surface was painted with two tints between changes; keeps `source` from then on. */
    private multiTint = false;
    private lastUsed = 0;
    /** This cache's share of `heldPixels`. */
    private held = 0;

    constructor(private readonly surface: BrsCanvas, private readonly context: BrsCanvasContext2D) {}

    /** Returns the surface multiplied by `rgba`'s RGB. */
    get(rgba: number): BrsCanvas {
        const now = performance.now();
        if (now - lastSweep >= IDLE_MS) {
            sweep(now);
        }
        this.lastUsed = now;
        const key = rgba >>> 8;
        const entry = this.entries.get(key);
        if (entry?.epoch === this.epoch) {
            entry.lastUsed = now;
            return entry.canvas;
        }
        let canvas: BrsCanvas;
        if (entry) {
            entry.epoch = this.epoch;
            entry.lastUsed = now;
            canvas = entry.canvas;
        } else {
            canvas = this.claim(key, now);
        }
        this.paint(canvas, key);
        return canvas;
    }

    /** Marks every copy stale: the surface's pixels changed. */
    invalidate() {
        this.epoch++;
        this.paints = 0;
        if (this.source) {
            this.source = undefined;
            this.account();
        }
    }

    /** Releases every canvas the cache holds. */
    release() {
        for (const entry of this.entries.values()) {
            releaseCanvas(entry.canvas);
        }
        this.entries.clear();
        this.misses.clear();
        if (this.scratch) {
            releaseCanvas(this.scratch);
            this.scratch = undefined;
        }
        this.source = undefined;
        this.account();
    }

    /** Releases copies, the scratch canvas and the kept pixels unused for `IDLE_MS`, keeping the latest copy. */
    trim(now: number) {
        const idleSince = now - IDLE_MS;
        let latest: TintEntry | undefined;
        for (const entry of this.entries.values()) {
            if (!latest || entry.lastUsed > latest.lastUsed) {
                latest = entry;
            }
        }
        for (const [key, entry] of this.entries) {
            if (entry !== latest && entry.lastUsed < idleSince) {
                releaseCanvas(entry.canvas);
                this.entries.delete(key);
            }
        }
        if (this.scratch && this.scratchUsed < idleSince) {
            releaseCanvas(this.scratch);
            this.scratch = undefined;
        }
        if (this.lastUsed < idleSince) {
            this.source = undefined;
            this.multiTint = false;
            this.misses.clear();
        }
        this.account();
    }

    /**
     * Picks the canvas for a tint that has no copy: the first copy, a stale copy, a new copy while the
     * budgets allow and the tint was missed before, an idle copy, or else the scratch canvas.
     */
    private claim(key: number, now: number): BrsCanvas {
        const pixels = this.surface.width * this.surface.height;
        if (this.entries.size === 0) {
            return this.add(key, createNewCanvas(this.surface.width, this.surface.height), now);
        }
        const stale = this.oldest((entry) => entry.epoch !== this.epoch);
        if (stale !== undefined) {
            return this.rekey(stale, key, now);
        }
        const capacity = pixels === 0 ? 1 : Math.min(MAX_ENTRIES, Math.floor(MAX_PIXELS / pixels));
        if (this.entries.size < capacity && heldPixels + pixels <= GLOBAL_MAX_PIXELS && this.missedBefore(key)) {
            return this.add(key, createNewCanvas(this.surface.width, this.surface.height), now);
        }
        const idleSince = now - IDLE_MS;
        const idle = this.oldest((entry) => entry.lastUsed < idleSince);
        if (idle !== undefined) {
            return this.rekey(idle, key, now);
        }
        if (!this.scratch) {
            this.scratch = createNewCanvas(this.surface.width, this.surface.height);
            this.account();
        }
        this.scratchUsed = now;
        return this.scratch;
    }

    private add(key: number, canvas: BrsCanvas, now: number): BrsCanvas {
        this.entries.set(key, { canvas, epoch: this.epoch, lastUsed: now });
        this.account();
        return canvas;
    }

    private rekey(from: number, key: number, now: number): BrsCanvas {
        const entry = this.entries.get(from)!;
        this.entries.delete(from);
        entry.epoch = this.epoch;
        entry.lastUsed = now;
        this.entries.set(key, entry);
        return entry.canvas;
    }

    /** The key of the least recently used entry that matches, if any. */
    private oldest(match: (entry: TintEntry) => boolean): number | undefined {
        let found: number | undefined;
        let foundUsed = Infinity;
        for (const [key, entry] of this.entries) {
            if (entry.lastUsed < foundUsed && match(entry)) {
                found = key;
                foundUsed = entry.lastUsed;
            }
        }
        return found;
    }

    /** Records a miss for `key`, reporting whether it had one already. */
    private missedBefore(key: number): boolean {
        if (this.misses.has(key)) {
            return true;
        }
        if (this.misses.size >= MISS_MEMORY) {
            this.misses.clear();
        }
        this.misses.add(key);
        return false;
    }

    /** Updates this cache's share of `heldPixels` and its place in the sweep. */
    private account() {
        const pixels = this.surface.width * this.surface.height;
        const copies = Math.max(0, this.entries.size - 1) + (this.scratch ? 1 : 0) + (this.source ? 1 : 0);
        const held = copies * pixels;
        heldPixels += held - this.held;
        this.held = held;
        if (held > 0) {
            trimmable.add(this);
        } else {
            trimmable.delete(this);
        }
    }

    private paint(canvas: BrsCanvas, key: number) {
        const { width, height } = this.surface;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext("2d", { alpha: true }) as BrsCanvasContext2D;
        // A per-channel multiply over the UN-PREMULTIPLIED pixels, NOT `globalCompositeOperation =
        // "multiply"` — canvas's `multiply` is the W3C *blend* formula, which over a semi-transparent
        // backdrop drags the result toward the tint instead of multiplying by it, so opaque white was not
        // an identity and a real tint came out lighter than the source. Measured table and derivation:
        // `.claude/docs/scenegraph-invariants.md`, "Blend colors". Alpha is deliberately untouched:
        // blendColor's alpha is the blit transparency (globalAlpha), never the tint strength (#935).
        const red = (key >> 16) & 0xff;
        const green = (key >> 8) & 0xff;
        const blue = key & 0xff;
        if (width === 0 || height === 0) {
            // `getImageData` THROWS on a 0-wide/0-tall rect, and both a zero-sized bitmap (which
            // `isValid()` reports true for) and a `dispose()`d one reach here. `drawImageAtPos` no-ops.
            drawImageAtPos(this.surface, ctx, 0, 0);
            return;
        }
        if (red === 255 && green === 255 && blue === 255) {
            // Multiplying by white is a mathematical identity — copy, so an all-white tint stays
            // byte-identical even when a "no blend" sentinel slips past the caller's normalization.
            // The canvas may hold an older tint, and a copy blends over what is there.
            ctx.clearRect(0, 0, width, height);
            drawImageAtPos(this.surface, ctx, 0, 0);
            return;
        }
        const image = this.sourcePixels(ctx, width, height);
        const pixels = image.data;
        // A channel multiplied by 255 is an identity, so it is left alone entirely — the common case for a
        // tint that only shifts one or two channels.
        const scaleRed = red === 255 ? undefined : channelScale(red);
        const scaleGreen = green === 255 ? undefined : channelScale(green);
        const scaleBlue = blue === 255 ? undefined : channelScale(blue);
        for (let i = 0; i < pixels.length; i += 4) {
            if (scaleRed) {
                pixels[i] = scaleRed[pixels[i]];
            }
            if (scaleGreen) {
                pixels[i + 1] = scaleGreen[pixels[i + 1]];
            }
            if (scaleBlue) {
                pixels[i + 2] = scaleBlue[pixels[i + 2]];
            }
        }
        putImageAtPos(image, ctx, 0, 0);
    }

    /**
     * A copy of the surface's pixels to multiply in place. Reading them back is the expensive part on a
     * GPU-backed canvas, so a surface tinted several ways keeps them until it changes.
     */
    private sourcePixels(ctx: BrsCanvasContext2D, width: number, height: number): BrsImageData {
        this.paints++;
        if (this.paints > 1) {
            this.multiTint = true;
        }
        if (this.source) {
            const copy = ctx.createImageData(width, height);
            copy.data.set(this.source.data);
            return copy;
        }
        const image = this.context.getImageData(0, 0, width, height);
        if (!this.multiTint || heldPixels + width * height > GLOBAL_MAX_PIXELS) {
            return image;
        }
        this.source = image;
        this.account();
        const copy = ctx.createImageData(width, height);
        copy.data.set(image.data);
        return copy;
    }
}

/** Trims every cache holding more than its first copy. */
function sweep(now: number) {
    lastSweep = now;
    for (const cache of trimmable) {
        cache.trim(now);
    }
}
