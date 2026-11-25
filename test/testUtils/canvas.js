/** Returns the RGBA bytes of one pixel of `canvas`. */
function pixel(canvas, x = 0, y = 0) {
    return Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
}

/**
 * Counts the pixel reads (`getImageData`) of `surface`'s canvas from now on — what the tint cache does to tint it.
 * Reading the same canvas through `pixel()` counts too.
 */
function countReads(surface) {
    const ctx = surface.getContext();
    const read = ctx.getImageData.bind(ctx);
    const counter = { reads: 0 };
    ctx.getImageData = (...args) => {
        counter.reads++;
        return read(...args);
    };
    return counter;
}

module.exports = { pixel, countReads };
