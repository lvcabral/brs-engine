/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A node's intrinsic UI motion (a PanelSet slide, a list scrolling its focus), as opposed to an
 * app-authored `Animation` node. Logical state (focus, child lists) always changes synchronously;
 * a transition only moves the presentation toward it over time and emits the in-transit fields a
 * device publishes while it runs.
 *
 * Owners register with `sgRoot.addTransition` while moving. The render loop ticks every registered
 * transition once per pass (`sgRoot.processTransitions`), before painting, and keeps redrawing only
 * while at least one is active, so an idle scene costs nothing. When transitions are disabled
 * (`sgRoot.uiTransitionsEnabled === false`) owners must settle synchronously instead of registering.
 */
export interface UITransition {
    /**
     * Advances the motion to `now` (milliseconds, `sgClock.perfNow()`), writing the in-transit fields.
     * @returns False once the motion has settled; the registry then drops it.
     */
    tickTransition(now: number): boolean;
}

/** Quintic ease-out: Roku's PanelSet slide curve (device-measured, see panelset-slide-probe). */
export function easeOutQuint(u: number): number {
    const clamped = Math.min(Math.max(u, 0), 1);
    return 1 - Math.pow(1 - clamped, 5);
}

/** Cubic ease-out: Roku's list focus motion curve (device-measured, see list-focus-motion-probe). */
export function easeOutCubic(u: number): number {
    const clamped = Math.min(Math.max(u, 0), 1);
    return 1 - Math.pow(1 - clamped, 3);
}
