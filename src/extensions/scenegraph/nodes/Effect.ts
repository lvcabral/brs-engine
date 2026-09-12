import { AAMember, IfDraw2D, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Node } from "./Node";
import { Group } from "./Group";

/**
 * Roku OS 16.0 `Effect` node: a data-only node referenced by a Poster/Rectangle's `effect` field
 * that applies rounded corners, a border stroke and a linear/radial gradient to that node's own
 * content. Field spec taken directly from the Roku OS 16.0 Beta release notes
 * (`external/dev-doc/docs/DEVELOPER/release-notes/index.md`) — no dedicated reference page exists
 * yet under `external/dev-doc/docs/REFERENCES/scenegraph/` as of this writing, so several rendering
 * details below are inferences from that prose, not device-measured facts.
 *
 * This engine has no real GPU/shader pipeline, so the effect is approximated with Canvas2D
 * primitives (`IfDraw2D.pushRoundedClip`/`strokeRoundedRect`/`fillEffectGradient`/
 * `strokeEffectGradient`). `supported` is always `true`: the approximation has no device/config
 * gate that could fail it.
 *
 * Declaring an `effect` field on a node is not enough by itself — a node's own `renderNodeContent`
 * must also wrap its content-drawing call in `applyNodeEffect` (see `Rectangle`/`Poster`) for the
 * field to do anything; there is no template-level hook that applies it automatically.
 */
export class Effect extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "supported", type: "boolean", value: "true" },
        { name: "borderRadius", type: "floatarray", value: "[]" },
        { name: "borderWidth", type: "float", value: "0.0" },
        { name: "borderPadding", type: "float", value: "0.0" },
        { name: "borderColor", type: "color", value: "0xFFFFFFFF" },
        { name: "gradientColors", type: "colorarray", value: "[]" },
        { name: "gradientStops", type: "floatarray", value: "[]" },
        { name: "gradientAngle", type: "float", value: "0.0" },
        { name: "gradientCentre", type: "vector2d", value: "[0.5,0.5]" },
        { name: "gradientRadius", type: "vector2d", value: "[1.0,1.0]" },
        { name: "gradientStyle", type: "string", value: "none" },
        { name: "gradientFillContent", type: "boolean", value: "true" },
        { name: "gradientFillBorder", type: "boolean", value: "false" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Effect) {
        super([], name);
        this.setExtendsType(SGNodeType.Effect, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}

/**
 * "0, 1, or 4 floats... Other lengths are silently truncated to length 1 or 4." A length of 2-3
 * keeps only the first value (uniform radius); a length of 5+ keeps only the first four (extras
 * dropped). Neither truncation boundary is spelled out precisely in the release notes prose, so
 * this split is an inference, not a device-measured fact.
 */
function truncateToValidLength(values: number[]): number[] {
    if (values.length === 0 || values.length === 4) {
        return values;
    }
    return values.length <= 3 ? [values[0]] : values.slice(0, 4);
}

function toFiniteNumbers(raw: unknown): number[] {
    return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v)) : [];
}

/**
 * Remaps Roku's `borderRadius` order (clockwise from top-right: [topRight, bottomRight,
 * bottomLeft, topLeft]) to Canvas2D `roundRect()`'s own order ([topLeft, topRight, bottomRight,
 * bottomLeft]), applying the 0/1/4 truncation rule above.
 */
export function normalizeBorderRadius(raw: unknown): [number, number, number, number] {
    const picked = truncateToValidLength(toFiniteNumbers(raw));
    const [topRight, bottomRight, bottomLeft, topLeft] =
        picked.length === 4 ? picked : [picked[0] ?? 0, picked[0] ?? 0, picked[0] ?? 0, picked[0] ?? 0];
    return [topLeft, topRight, bottomRight, bottomLeft];
}

/** "At least 2 and at most 8 color values... Indexes 8 or higher are ignored." */
export function resolveGradientColors(raw: unknown): number[] {
    return toFiniteNumbers(raw).slice(0, 8);
}

/**
 * "It should have the same length as gradientColors, and is truncated or ignored if it does not"
 * — a longer array is truncated to the first N stops; any other mismatch (shorter, or empty) falls
 * back to an even distribution across [0, 1].
 */
export function resolveGradientStops(colors: number[], raw: unknown): number[] {
    const values = toFiniteNumbers(raw);
    if (values.length >= colors.length && values.length > 0) {
        return values.slice(0, colors.length).map((v) => Math.min(Math.max(v, 0), 1));
    }
    return colors.map((_, index) => (colors.length > 1 ? index / (colors.length - 1) : 0));
}

/**
 * Wraps a Poster/Rectangle's own content-drawing call with its `effect` field's rounded-clip,
 * gradient fill and border stroke, when one is assigned and `Effect.supported` is true. Falls
 * through to `drawContent(rect, rotation, scale)` unmodified otherwise, per the spec: "the node to
 * which it is applied renders as though the Effect were not present."
 *
 * A free function rather than a `Group` method/hook: keeps `Group.renderNode`'s template contract
 * (`.claude/docs/scenegraph-invariants.md`) untouched — this only brackets a node's own "draw my
 * content" step, exactly where `MaskGroup`'s offscreen composite brackets `super.renderNodeContent`.
 *
 * `rotation`/`center`/`scale` are the same values the caller would otherwise hand its own
 * `doDrawRotatedRect`/`doDrawRotatedBitmap` call. When an effect is present, THIS function
 * composes that rotate/scale-around-pivot transform once (via `IfDraw2D.pushRoundedClip`) and
 * calls `drawContent` with an already-local, unrotated/unscaled rect — so the rounded clip, the
 * content, and the border/gradient all rotate and scale together as one rigid shape instead of the
 * effect staying axis-aligned under a rotated/scaled node. `drawContent` must draw using the
 * `rect`/`rotation`/`scale` it is CALLED with, not values captured from its enclosing scope, since
 * they differ between the two branches below.
 */
export function applyNodeEffect(
    node: Group,
    rect: Rect,
    draw2D: IfDraw2D | undefined,
    opacity: number,
    drawContent: (rect: Rect, rotation: number, scale: [number, number]) => void,
    rotation: number = 0,
    center: number[] = [0, 0],
    scale: [number, number] = [1, 1]
) {
    const effect = node.getValue("effect");
    if (!(effect instanceof Effect) || !effect.getValueJS("supported")) {
        drawContent(rect, rotation, scale);
        return;
    }
    // Snapshot `rect` before drawContent runs: a caller (Poster's "limitsize" display mode) mutates
    // its OWN rect object in place while computing its draw geometry, and the clip pushed below is
    // baked into the canvas synchronously — reading a mutated rect afterward for the gradient/
    // border would size them differently than the clip already applied.
    const contentRect: Rect = { ...rect };

    const radii = normalizeBorderRadius(effect.getValueJS("borderRadius"));
    const gradientStyle = ((effect.getValueJS("gradientStyle") as string) ?? "none").trim().toLowerCase();
    const style = gradientStyle as "linear" | "radial";
    const hasGradient = gradientStyle === "linear" || gradientStyle === "radial";
    const gradientColors = hasGradient ? resolveGradientColors(effect.getValueJS("gradientColors")) : [];
    // Only read once a gradient will actually be drawn — `gradientCentre`/`gradientRadius` are
    // vector2d fields, and reading one allocates a fresh array each time (see
    // `Rectangle.test.js`'s "reads the scale field exactly once per render pass").
    const hasEnoughColors = gradientColors.length >= 2;
    const gradientStops = hasEnoughColors
        ? resolveGradientStops(gradientColors, effect.getValueJS("gradientStops"))
        : [];
    const zeroVector: [number, number] = [0, 0];
    const gradientAngle = hasEnoughColors ? (effect.getValueJS("gradientAngle") as number) : 0;
    const gradientCentre = hasEnoughColors ? (effect.getValueJS("gradientCentre") as [number, number]) : zeroVector;
    const gradientRadius = hasEnoughColors ? (effect.getValueJS("gradientRadius") as [number, number]) : zeroVector;

    const localRect: Rect = { x: 0, y: 0, width: contentRect.width, height: contentRect.height };
    const clipped = draw2D !== undefined && contentRect.width > 0 && contentRect.height > 0;
    if (clipped) {
        draw2D!.pushRoundedClip(contentRect, radii, rotation, center, scale[0], scale[1]);
    }
    try {
        drawContent(localRect, 0, [1, 1]);
        if (clipped && hasEnoughColors && effect.getValueJS("gradientFillContent")) {
            draw2D!.fillEffectGradient(
                localRect,
                radii,
                style,
                gradientColors,
                gradientStops,
                gradientAngle,
                gradientCentre,
                gradientRadius,
                opacity
            );
        }
    } finally {
        if (clipped) {
            draw2D!.popClip();
        }
    }

    const borderWidth = effect.getValueJS("borderWidth") as number;
    if (draw2D !== undefined && borderWidth > 0) {
        const borderColor = effect.getValueJS("borderColor") as number;
        const borderPadding = effect.getValueJS("borderPadding") as number;
        // "Padding between the content rect and the border stroke" — the stroke's centerline sits
        // `borderPadding` px outside the content edge, then straddles that centerline by half its
        // own width (Canvas2D strokes are centered on the path).
        const outset = borderPadding + borderWidth / 2;
        const borderLocalRect: Rect = {
            x: -outset,
            y: -outset,
            width: contentRect.width + outset * 2,
            height: contentRect.height + outset * 2,
        };
        // A rounded rect offset outward by `outset` is a uniform-gap "parallel" curve of the
        // content's rounded rect only if its own corner radius also grows by `outset` too — but
        // only on a corner that was already rounded; a square (radius 0) corner stays square no
        // matter how much padding/width the border adds. See `.claude/docs/scenegraph-invariants.md`.
        const borderRadii = radii.map((r) => (r > 0 ? r + outset : 0)) as [number, number, number, number];
        draw2D.strokeRoundedRect(
            contentRect,
            borderLocalRect,
            borderRadii,
            borderWidth,
            borderColor,
            opacity,
            rotation,
            center,
            scale[0],
            scale[1]
        );
        if (hasEnoughColors && effect.getValueJS("gradientFillBorder")) {
            draw2D.strokeEffectGradient(
                contentRect,
                borderLocalRect,
                borderRadii,
                borderWidth,
                style,
                gradientColors,
                gradientStops,
                gradientAngle,
                gradientCentre,
                gradientRadius,
                opacity,
                rotation,
                center,
                scale[0],
                scale[1]
            );
        }
    }
}
