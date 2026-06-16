/**
 * Key Definition File (KDF) model and layout engine for the Dynamic voice keyboards.
 *
 * A KDF is a JSON description of a keyboard layout organized as a hierarchy of
 * KeyLayout → Section → Grid (per mode) → Row → Key. See the Roku reference
 * `scenegraph/dynamic-voice-keyboard-nodes/key-definition-file.md` for the spec.
 *
 * `computeLayout()` flattens the selected grid of every section into absolutely
 * positioned, renderable keys, applying the spec's size-distribution rules.
 */

export interface KeySuggestions {
    options?: string | string[];
    triggers?: string | string[];
}

export interface KeyDef {
    keyWidthFHD?: number;
    keyWidthHD?: number;
    label?: string;
    icon?: string;
    focusIcon?: string;
    strOut?: string;
    autoRepeat?: number;
    disabled?: number;
    suggestions?: KeySuggestions;
}

export interface RowDef {
    rowHeightFHD?: number;
    rowHeightHD?: number;
    keys: KeyDef[];
}

export interface GridDef {
    gridHeightFHD?: number;
    gridHeightHD?: number;
    modes?: string | string[];
    rows: RowDef[];
}

export interface SectionDef {
    sectionWidthFHD?: number;
    sectionWidthHD?: number;
    grids: GridDef[];
}

export interface KeyLayout {
    keyboardWidthFHD?: number;
    keyboardHeightFHD?: number;
    keyboardWidthHD?: number;
    keyboardHeightHD?: number;
    sections: SectionDef[];
}

/** A single key flattened to absolute coordinates, ready to render and navigate. */
export interface RenderedKey {
    section: number;
    row: number;
    col: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    icon?: string;
    focusIcon?: string;
    /** The value emitted via keyFocused/keySelected: strOut when set, otherwise label. */
    out: string;
    /** Raw strOut (may be empty for plain label keys). */
    strOut: string;
    disabled: boolean;
    autoRepeat: boolean;
    suggestions?: KeySuggestions;
    /** Whether the key can receive focus (false for blank keys and disabled keys). */
    focusable: boolean;
}

type Resolution = "FHD" | "HD";

function pick(res: Resolution, fhd: number | undefined, hd: number | undefined): number | undefined {
    return res === "FHD" ? fhd : hd;
}

/** Normalizes a Grid's `modes` (string | string[] | undefined) to a string array. */
function modesOf(grid: GridDef): string[] {
    if (grid.modes === undefined) {
        return [];
    }
    return Array.isArray(grid.modes) ? grid.modes : [grid.modes];
}

/**
 * Selects the Grid of a Section to display for the given mode.
 * - A section with a single grid always uses that grid.
 * - Otherwise the grid whose `modes` contains `mode` is used.
 * - A grid with no `modes` acts as a fallback shared across all modes.
 */
export function selectGrid(section: SectionDef, mode: string): GridDef | undefined {
    if (section.grids.length === 0) {
        return undefined;
    }
    if (section.grids.length === 1) {
        return section.grids[0];
    }
    let fallback: GridDef | undefined;
    for (const grid of section.grids) {
        const modes = modesOf(grid);
        if (modes.length === 0) {
            fallback ??= grid;
        } else if (modes.includes(mode)) {
            return grid;
        }
    }
    return fallback ?? section.grids[0];
}

/**
 * Distributes `total` across N slots. Slots with an explicit size keep it; the
 * remaining space is divided evenly among the slots without an explicit size.
 */
function distribute(total: number, explicit: (number | undefined)[]): number[] {
    let sumExplicit = 0;
    let autoCount = 0;
    for (const value of explicit) {
        if (value === undefined) {
            autoCount++;
        } else {
            sumExplicit += value;
        }
    }
    const autoSize = autoCount > 0 ? (total - sumExplicit) / autoCount : 0;
    return explicit.map((value) => value ?? autoSize);
}

/** Returns the keyboard's overall [width, height] for the resolution. */
export function keyboardSize(layout: KeyLayout, res: Resolution): [number, number] {
    const width = pick(res, layout.keyboardWidthFHD, layout.keyboardWidthHD) ?? 0;
    const height = pick(res, layout.keyboardHeightFHD, layout.keyboardHeightHD) ?? 0;
    return [width, height];
}

/** Margins (in keyboard pixels) between the background bitmap edges and the key cells. */
export interface KeyInset {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const NO_INSET: KeyInset = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Flattens the layout into absolutely positioned keys for the given mode and
 * resolution. Coordinates are relative to the keyboard's top-left corner. The
 * optional `inset` carves out the margins that surround the key cells in the
 * keyboard background bitmap, so the keys land on the drawn cells.
 */
export function computeLayout(
    layout: KeyLayout,
    mode: string,
    res: Resolution,
    inset: KeyInset = NO_INSET
): RenderedKey[] {
    const [boardWidth, boardHeight] = keyboardSize(layout, res);
    const contentWidth = boardWidth - inset.left - inset.right;
    const contentHeight = boardHeight - inset.top - inset.bottom;
    const rendered: RenderedKey[] = [];

    const sectionWidths = distribute(
        contentWidth,
        layout.sections.map((section) => pick(res, section.sectionWidthFHD, section.sectionWidthHD))
    );

    // When every section has an explicit width that leaves the keyboard wider than
    // their sum, the leftover space is distributed as equal gaps between sections
    // (this matches Roku's keyboard backgrounds, which separate the sections).
    const sumWidths = sectionWidths.reduce((acc, w) => acc + w, 0);
    const gap = layout.sections.length > 1 ? Math.max(0, (contentWidth - sumWidths) / (layout.sections.length - 1)) : 0;

    let sectionX = inset.left;
    for (let s = 0; s < layout.sections.length; s++) {
        const section = layout.sections[s];
        const sectionWidth = sectionWidths[s];
        const grid = selectGrid(section, mode);
        if (grid) {
            const gridHeight = pick(res, grid.gridHeightFHD, grid.gridHeightHD) ?? contentHeight;
            const rowHeights = distribute(
                gridHeight,
                grid.rows.map((row) => pick(res, row.rowHeightFHD, row.rowHeightHD))
            );
            let rowY = inset.top;
            for (let r = 0; r < grid.rows.length; r++) {
                const row = grid.rows[r];
                const rowHeight = rowHeights[r];
                const keyWidths = distribute(
                    sectionWidth,
                    row.keys.map((key) => pick(res, key.keyWidthFHD, key.keyWidthHD))
                );
                let keyX = sectionX;
                for (let c = 0; c < row.keys.length; c++) {
                    const key = row.keys[c];
                    const keyWidth = keyWidths[c];
                    const label = key.label ?? "";
                    const strOut = key.strOut ?? "";
                    const hasContent = label.length > 0 || (key.icon ?? "").length > 0;
                    const disabled = (key.disabled ?? 0) !== 0;
                    rendered.push({
                        section: s,
                        row: r,
                        col: c,
                        x: keyX,
                        y: rowY,
                        width: keyWidth,
                        height: rowHeight,
                        label,
                        icon: key.icon,
                        focusIcon: key.focusIcon,
                        out: strOut.length > 0 ? strOut : label,
                        strOut,
                        disabled,
                        autoRepeat: (key.autoRepeat ?? 0) !== 0,
                        suggestions: key.suggestions,
                        focusable: hasContent && !disabled,
                    });
                    keyX += keyWidth;
                }
                rowY += rowHeight;
            }
        }
        sectionX += sectionWidth + gap;
    }
    return rendered;
}

/** Resolution-independent icon mapping for a special key, keyed by its strOut. */
export interface SpecialKeyIcon {
    /** Base name of an existing `common:/images/{res}/icon_<name>.png` asset, if any. */
    iconName?: "clear" | "delete" | "space";
    /** Short text glyph drawn when no bitmap asset is available. */
    glyph: string;
}

/**
 * Maps a key's `strOut` to an icon asset and/or a text-glyph fallback. Only the
 * clear/space/delete icons ship in `common.zip`; everything else is a glyph.
 */
export function resolveKeyIcon(strOut: string): SpecialKeyIcon | undefined {
    switch (strOut) {
        case "clear":
            return { iconName: "clear", glyph: "clear" };
        case "backspace":
            return { iconName: "delete", glyph: "⌫" }; // ⌫
        case "space":
            return { iconName: "space", glyph: "␣" }; // ␣
        case "shift":
            return { glyph: "⇧" }; // ⇧
        case "left":
            return { glyph: "◄" }; // ◄
        case "right":
            return { glyph: "►" }; // ►
        case "capslock":
            return { glyph: "⇪" }; // ⇪
        case "abc123":
            return { glyph: "ABC" };
        case "symbols":
            return { glyph: "#+=" };
        case "accents":
            return { glyph: "àé" }; // àé
        default:
            return undefined;
    }
}
