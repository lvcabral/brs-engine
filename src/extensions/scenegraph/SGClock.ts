/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Replaceable time source backing every render-path clock read in the SceneGraph extension. */
export interface SGClockSource {
    /** Wall-clock milliseconds (Date.now semantics). */
    now(): number;
    /** Monotonic high-resolution milliseconds (performance.now semantics). */
    perfNow(): number;
}

const realSource: SGClockSource = {
    now: () => Date.now(),
    perfNow: () => performance.now(),
};

let source: SGClockSource = realSource;

/**
 * The SceneGraph clock. Time-driven nodes (animations, spinners, marquees, cursor blink, seek
 * repeat, timers) read the clock through this object instead of `Date.now()`/`performance.now()`
 * so tests can substitute a deterministic source through the built bundle via `setSource` —
 * fake-timer libraries cannot reach into the bundle's captured globals.
 */
export const sgClock = {
    now(): number {
        return source.now();
    },
    perfNow(): number {
        return source.perfNow();
    },
    /** Replaces the time source; call with no argument to restore the real clock. */
    setSource(replacement?: SGClockSource): void {
        source = replacement ?? realSource;
    },
};
