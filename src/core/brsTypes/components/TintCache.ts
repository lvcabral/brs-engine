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
 * and the kept source pixels. Past it a surface repaints a copy it already has for each new tint.
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
/** The time of the last message-loop pass, which copies are stamped with when used. */
let clock = 0;
let lastSweep = 0;

/** 256-entry tables mapping a channel value to `value * multiplier / 255`, cached per multiplier. */
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

/** Multiplies each pixel's RGB in place, leaving channels multiplied by 255 and alpha untouched. */
function multiplyInPlace(pixels: Uint8ClampedArray, red: number, green: number, blue: number) {
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
}

/** Writes `source` with each pixel's RGB multiplied into `target`, in one pass. */
function multiplyInto(source: Uint8ClampedArray, target: Uint8ClampedArray, red: number, green: number, blue: number) {
    const scaleRed = channelScale(red);
    const scaleGreen = channelScale(green);
    const scaleBlue = channelScale(blue);
    for (let i = 0; i < source.length; i += 4) {
        target[i] = scaleRed[source[i]];
        target[i + 1] = scaleGreen[source[i + 1]];
        target[i + 2] = scaleBlue[source[i + 2]];
        target[i + 3] = source[i + 3];
    }
}

/**
 * Advances the cache clock and, once `IDLE_MS` has passed since the last sweep, releases idle copies.
 * Runs on every message-loop pass (`RoMessagePort`), so copies an app stopped drawing with are freed
 * even when nothing is drawn.
 */
export function sweepIdleTints(now = performance.now()) {
    clock = now;
    if (trimmable.size === 0 || now - lastSweep < IDLE_MS) {
        return;
    }
    lastSweep = now;
    for (const cache of trimmable) {
        cache.trim(now);
    }
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
 * copies are made only for a tint used a second time, stay within the per-surface and global budgets, and
 * are released after `IDLE_MS` without use. A tint that gets no copy is painted into a scratch canvas, which
 * becomes the tint's copy when it is drawn again before another tint takes it.
 * The surface's pixels are kept between tints only while it is painted with two tints between changes.
 */
export class TintCache {
    private readonly entries = new Map<number, TintEntry>();
    private readonly misses = new Set<number>();
    private scratch?: BrsCanvas;
    /** The tint the scratch canvas holds, and the epoch it was painted in. */
    private scratchKey = -1;
    private scratchEpoch = -1;
    private scratchUsed = 0;
    /** The surface's pixels, kept for a surface tinted several ways so each tint skips the read-back. */
    private source?: BrsImageData;
    private epoch = 0;
    /** Set by `markStale` when the surface changed; the next `get` moves to a new epoch. */
    private stale = false;
    /** Tints painted from the surface's pixels since it last changed. */
    private paints = 0;
    /** Whether the surface was painted with two tints before it last changed; keeps `source` if so. */
    private multiTint = false;
    private lastUsed = 0;
    /** This cache's share of `heldPixels`. */
    private held = 0;

    constructor(private readonly surface: BrsCanvas, private readonly context: BrsCanvasContext2D) {}

    /** Returns the surface multiplied by `rgba`'s RGB. */
    get(rgba: number): BrsCanvas {
        if (this.stale) {
            this.refresh();
        }
        const now = clock;
        this.lastUsed = now;
        const key = rgba >>> 8;
        const entry = this.entries.get(key);
        if (entry) {
            entry.lastUsed = now;
            if (entry.epoch === this.epoch) {
                return entry.canvas;
            }
            entry.epoch = this.epoch;
        } else if (this.scratch && this.scratchKey === key && this.scratchEpoch === this.epoch) {
            return this.reuseScratch(key, now);
        }
        const canvas = entry?.canvas ?? this.claim(key, now);
        this.paint(canvas, key);
        return canvas;
    }

    /** Marks every copy stale: the surface's pixels or size changed. */
    markStale() {
        this.stale = true;
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

    private get pixels(): number {
        return this.surface.width * this.surface.height;
    }

    private get capacity(): number {
        const pixels = this.pixels;
        return pixels === 0 ? 1 : Math.min(MAX_ENTRIES, Math.floor(MAX_PIXELS / pixels));
    }

    /** Returns the scratch canvas, already painted with `key`, keeping it as that tint's copy if one fits. */
    private reuseScratch(key: number, now: number): BrsCanvas {
        const scratch = this.scratch!;
        this.scratchUsed = now;
        if (this.entries.size < this.capacity) {
            this.entries.set(key, { canvas: scratch, epoch: this.epoch, lastUsed: now });
            this.scratch = undefined;
            this.account();
        }
        return scratch;
    }

    /** Moves to a new epoch, so every copy repaints before it is used again. */
    private refresh() {
        this.stale = false;
        this.epoch++;
        this.multiTint = this.paints > 1;
        this.paints = 0;
        if (this.source) {
            this.source = undefined;
            this.account();
        }
    }

    /**
     * Picks the canvas for a tint that has no copy: the first copy, a stale copy, a new copy while the
     * budgets allow and the tint was missed before, an idle copy, the scratch canvas while the global
     * budget allows it, or else the least recently used copy.
     */
    private claim(key: number, now: number): BrsCanvas {
        const pixels = this.pixels;
        if (this.entries.size === 0) {
            return this.add(key, now);
        }
        const stale = this.oldest((entry) => entry.epoch !== this.epoch);
        if (stale !== undefined) {
            return this.rekey(stale, key, now);
        }
        if (this.entries.size < this.capacity && heldPixels + pixels <= GLOBAL_MAX_PIXELS && this.missedBefore(key)) {
            return this.add(key, now);
        }
        const idleSince = now - IDLE_MS;
        const idle = this.oldest((entry) => entry.lastUsed < idleSince);
        if (idle !== undefined) {
            return this.rekey(idle, key, now);
        }
        if (!this.scratch) {
            if (heldPixels + pixels > GLOBAL_MAX_PIXELS) {
                return this.rekey(this.oldest(() => true)!, key, now);
            }
            this.scratch = this.blank();
            this.account();
        }
        this.scratchKey = key;
        this.scratchEpoch = this.epoch;
        this.scratchUsed = now;
        return this.scratch;
    }

    private blank(): BrsCanvas {
        return createNewCanvas(this.surface.width, this.surface.height);
    }

    private add(key: number, now: number): BrsCanvas {
        const canvas = this.blank();
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
        const copies = Math.max(0, this.entries.size - 1) + (this.scratch ? 1 : 0) + (this.source ? 1 : 0);
        const held = copies * this.pixels;
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
        if (width === 0 || height === 0) {
            // `getImageData` throws on an empty rect (a zero-sized or disposed bitmap).
            return;
        }
        const ctx = canvas.getContext("2d", { alpha: true }) as BrsCanvasContext2D;
        if (key === 0xffffff) {
            // Multiplying by white is an identity: copy, so the result stays byte-identical. The canvas may
            // hold an older tint, and a copy blends over what is there.
            ctx.clearRect(0, 0, width, height);
            drawImageAtPos(this.surface, ctx, 0, 0);
            return;
        }
        // A per-channel multiply over the un-premultiplied pixels; canvas's `multiply` is a blend, not a
        // multiply (`.claude/docs/scenegraph-invariants.md`, "Blend colors"). Alpha is left as is: it is the
        // blit's transparency.
        const [from, to] = this.pixelsToTint(ctx, width, height);
        if (from === to) {
            multiplyInPlace(to.data, (key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff);
        } else {
            multiplyInto(from.data, to.data, (key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff);
        }
        putImageAtPos(to, ctx, 0, 0);
    }

    /**
     * The surface's pixels and the image to write the tint into: the same image, read back, or the kept
     * pixels and a new image. Reading back is the expensive part on a GPU-backed canvas, so a surface
     * tinted several ways keeps its pixels until it changes.
     */
    private pixelsToTint(ctx: BrsCanvasContext2D, width: number, height: number): [BrsImageData, BrsImageData] {
        this.paints++;
        this.multiTint ||= this.paints > 1;
        if (!this.source) {
            const image = this.context.getImageData(0, 0, width, height);
            if (!this.multiTint || heldPixels + width * height > GLOBAL_MAX_PIXELS) {
                return [image, image];
            }
            this.source = image;
            this.account();
        }
        return [this.source, ctx.createImageData(width, height)];
    }
}
