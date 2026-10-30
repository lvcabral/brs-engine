import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    isAnyNumber,
    isBrsString,
    RoAnimatedImage,
    RoArray,
    RoAssociativeArray,
    RoBitmap,
    RoFont,
    IfDraw2D,
    MeasuredText,
    Rect,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { Font } from "./Font";
import type { Label } from "./Label";
import type { Poster } from "./Poster";
import type { Rectangle } from "./Rectangle";
import type { ScrollingLabel } from "./ScrollingLabel";
import { Node } from "./Node";
import { FieldKind, FieldModel, isFont } from "../SGTypes";
import { SGNodeType } from ".";
import {
    composeSceneScale,
    convertHexColor,
    IDENTITY_SCENE_MAP,
    mapRectToScene,
    normalizeBlendColor,
    normalizedRect,
    pivotAnchor,
    rectContainsRect,
    rotateTranslation,
    sameSceneMap,
    SceneMap,
    transformLocalRect,
    unionRect,
} from "../SGUtil";
import { SGNodeFactory } from "../factory/NodeFactory";
import { jsValueOf } from "../factory/Serializer";

/** A scale frame `Group.openScaleFrame` opened: what `closeScaleFrame` restores. */
interface ScaleFrame {
    outerMap: SceneMap;
    depth: number;
}

/** The pivot of a node that neither rotates nor inherits a rotation: never read. */
const NO_CENTER: number[] = [0, 0];
/** The default `scale`. Never mutated. */
const UNIT_SCALE: number[] = [1, 1];

export class Group extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "visible", type: "boolean", value: "true" },
        { name: "opacity", type: "float", value: "1.0" },
        { name: "translation", type: "vector2d", value: "[0.0,0.0]" },
        { name: "rotation", type: "float", value: "0.0" },
        { name: "scale", type: "vector2d", value: "[1.0,1.0]" },
        { name: "scaleRotateCenter", type: "vector2d", value: "[0.0,0.0]" },
        { name: "childRenderOrder", type: "string", value: "renderLast" },
        { name: "inheritParentTransform", type: "boolean", value: "true" },
        { name: "inheritParentOpacity", type: "boolean", value: "true" },
        { name: "clippingRect", type: "rect2d", value: "[0.0,0.0,0.0,0.0]" },
        { name: "renderPass", type: "integer", value: "0" },
        { name: "muteAudioGuide", type: "boolean", value: "false" },
        { name: "enableRenderTracking", type: "boolean", value: "false" },
        { name: "renderTracking", type: "string", value: "disabled" },
    ];
    protected readonly sceneRect: Rect;
    protected resolution: string;
    private cachedLines: MeasuredText[] = [];
    private cachedHeight: number = 0;
    private _isDirty: boolean = true;
    /**
     * The (origin, angle, opacity, scene map) context of this node's last completed layout pass. A
     * pruned refresh may skip the subtree only when the incoming context matches EXACTLY (float
     * equality): a moved/rotated/scaled/faded ancestor changes the context of every descendant,
     * which re-renders them even though their own fields never changed.
     */
    private lastLayoutContext?: { x: number; y: number; angle: number; opacity: number; sceneMap: SceneMap };
    /**
     * `sgRoot.sceneMap` as of this node's last render: the ancestors' scale, which maps the
     * coordinates this node draws in (its parent's local units) to `rectToScene`.
     */
    protected sceneMap: SceneMap = IDENTITY_SCENE_MAP;
    /**
     * The rotation inherited from the ancestors (`renderNode`'s `angle`) as of this node's last
     * render. The node's own rotation is `rotation - inheritedAngle` for whatever `rotation` it
     * draws at, and it places its pivot through this angle (`pivotAnchor`).
     */
    private inheritedAngle = 0;
    /**
     * True while `Group.renderNodeContent` renders this node's children: it re-derives
     * `rectToParent`/`rectToScene` from `rectLocal` right after (`updateContainerBounds`), so a
     * child's `updateParentRects` only needs to union into `rectLocal`.
     */
    private boundsFromLocal = false;
    /**
     * The translation, scale, own rotation and pivot `placeLocalRect` last placed this node with,
     * from then until its next render starts: a child's `updateParentRects` takes its rect into this
     * node's parent space with them instead of reading the fields again for every child.
     */
    private placedTrans?: number[];
    private placedScale: number[] = UNIT_SCALE;
    private placedRotation = 0;
    private placedCenter: number[] = NO_CENTER;
    /** @internal Number of non-skipped render passes this node has run; exposed for pruning tests. */
    layoutPassCount = 0;

    get isDirty(): boolean {
        return this._isDirty;
    }

    /**
     * Dirtying a node also marks its subtree stale for the pruned layout refresh: ~65 sites set
     * `isDirty = true` directly (bypassing `makeDirty`), and each represents render-relevant state
     * the next layout pass must see. Routing the stale mark through this setter keeps the pruning
     * invariant without auditing every site. Clearing (`false`) leaves the stale mark alone —
     * `subtreeStale` is cleared only at the start of the node's own layout pass.
     */
    set isDirty(value: boolean) {
        this._isDirty = value;
        if (value) {
            this.markSubtreeStale();
        }
    }

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Group) {
        super([], name);
        this.setExtendsType(SGNodeType.Group, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const sceneUI = sgRoot.scene?.ui;
        if (sceneUI) {
            this.resolution = sceneUI.resolution;
            this.sceneRect = { x: 0, y: 0, width: sceneUI.width, height: sceneUI.height };
        } else {
            this.resolution = "HD";
            this.sceneRect = { x: 0, y: 0, width: 1280, height: 720 };
        }
        this.isDirty = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync?: boolean) {
        if (sgRoot.inTaskThread()) {
            return super.setValue(index, value, alwaysNotify, kind, sync);
        }
        const mapKey = index.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field?.getType() === FieldKind.Color && isBrsString(value)) {
            let strColor = value.getValue();
            if (strColor.length) {
                value = new Int32(convertHexColor(strColor));
            } else {
                return;
            }
        }
        this.isDirty = true;
        super.setValue(index, value, alwaysNotify, kind, sync);
    }

    setValueSilent(fieldName: string, value: BrsType): void {
        this.isDirty = true;
        super.setValueSilent(fieldName, value);
    }

    getDimensions() {
        return {
            width: (this.getValueJS("width") as number) ?? 0,
            height: (this.getValueJS("height") as number) ?? 0,
        };
    }

    isVisible() {
        return (this.getValueJS("visible") as boolean) ?? true;
    }

    protected addPoster(uri: string, translation: number[], width?: number, height?: number, noScaling?: boolean) {
        const poster = SGNodeFactory.createNode(SGNodeType.Poster) as Poster;
        if (noScaling) {
            poster.noScaling = true;
        }
        if (uri.trim()) {
            poster.setValue("uri", new BrsString(uri));
        }
        poster.setTranslation(translation);
        if (width !== undefined) {
            poster.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            poster.setValueSilent("height", new Float(height));
        }
        this.appendChildToParent(poster);
        return poster;
    }

    protected addLabel(
        colorField: string,
        translation: number[],
        width?: number,
        height?: number,
        fontSize?: number,
        vertAlign?: string,
        horizAlign?: string,
        wrap?: boolean
    ) {
        const label = SGNodeFactory.createNode(SGNodeType.Label) as Label;
        if (colorField) {
            this.copyField(label, "color", colorField);
        }
        if (fontSize) {
            const labelFields = label.getNodeFields();
            const labelFont = labelFields.get("font")?.getValue();
            if (labelFont !== undefined && isFont(labelFont)) {
                labelFont.setSize(fontSize);
            }
        }
        if (width !== undefined) {
            label.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            label.setValueSilent("height", new Float(height));
        }
        label.setTranslation(translation);
        if (vertAlign) {
            label.setValueSilent("vertalign", new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.setValueSilent("horizalign", new BrsString(horizAlign));
        }
        if (wrap !== undefined) {
            label.setValueSilent("wrap", BrsBoolean.from(wrap));
        }
        this.appendChildToParent(label);
        return label;
    }

    protected addScrollingLabel(
        colorField: string,
        translation: number[],
        maxWidth?: number,
        height?: number,
        systemFont?: string,
        vertAlign?: string,
        horizAlign?: string,
        speed?: number,
        repeat?: number
    ) {
        const label = SGNodeFactory.createNode(SGNodeType.ScrollingLabel) as ScrollingLabel;
        if (colorField) {
            this.copyField(label, "color", colorField);
        }
        if (systemFont) {
            const font = label.getValue("font");
            if (isFont(font)) {
                font.setSystemFont(systemFont);
            }
        }
        if (maxWidth !== undefined) {
            label.setValueSilent("maxWidth", new Float(maxWidth));
        }
        if (height !== undefined) {
            label.setValueSilent("height", new Float(height));
        }
        label.setTranslation(translation);
        if (vertAlign) {
            label.setValueSilent("vertalign", new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.setValueSilent("horizalign", new BrsString(horizAlign));
        }
        if (speed !== undefined) {
            label.setValueSilent("scrollSpeed", new Int32(speed));
        }
        if (repeat !== undefined) {
            label.setValueSilent("repeatCount", new Int32(repeat));
        }
        this.appendChildToParent(label);
        return label;
    }

    protected addRectangle(colorField: string, translation: number[], width?: number, height?: number) {
        const rectangle = SGNodeFactory.createNode(SGNodeType.Rectangle) as Rectangle;
        this.copyField(rectangle, "color", colorField);
        if (width !== undefined) {
            rectangle.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            rectangle.setValueSilent("height", new Float(height));
        }
        rectangle.setTranslation(translation);
        this.appendChildToParent(rectangle);
        return rectangle;
    }

    /**
     * @param scale This node's own scale field, if the caller already fetched it (avoids a second
     * `getValueJS` lookup on this hot render-path method, e.g. a caller that also needs `scale` for
     * `withScale`); fetched here when omitted.
     */
    protected getTranslation(scale?: number[]) {
        const translation = this.getValueJS("translation") as number[];
        // Adjust translation based on scale and rotation center
        scale ??= this.getValueJS("scale") as number[];
        if (scale[0] === 1 && scale[1] === 1) {
            return translation;
        }
        const scaleRotateCenter = this.getScaleRotateCenter();
        const scaleDiffX = scaleRotateCenter[0] * (scale[0] - 1);
        const scaleDiffY = scaleRotateCenter[1] * (scale[1] - 1);
        translation[0] -= scaleDiffX;
        translation[1] -= scaleDiffY;
        return translation;
    }

    setTranslation(translation: number[]) {
        if (translation.length === 2) {
            const newTrans = [new Float(translation[0]), new Float(translation[1])];
            this.setValue("translation", new RoArray(newTrans));
        }
    }

    setTranslationOffset(x: number = 0, y: number = 0) {
        const translation = this.getValueJS("translation") as number[];
        translation[0] += x;
        translation[1] += y;
        this.setTranslation(translation);
    }

    setTranslationX(x: number) {
        const translation = this.getValueJS("translation") as number[];
        translation[0] = x;
        this.setTranslation(translation);
    }

    setTranslationY(y: number) {
        const translation = this.getValueJS("translation") as number[];
        translation[1] = y;
        this.setTranslation(translation);
    }

    protected getRotation() {
        const rotation = this.getValueJS("rotation") as number;
        return rotation ?? 0;
    }

    protected getScaleRotateCenter() {
        const scaleRotateCenter = this.getValue("scaleRotateCenter");
        const center = [0, 0];
        if (scaleRotateCenter instanceof RoArray && scaleRotateCenter.elements.length === 2) {
            center[0] = jsValueOf(scaleRotateCenter.elements[0]) as number;
            center[1] = jsValueOf(scaleRotateCenter.elements[1]) as number;
        }
        return center;
    }

    protected getOpacity() {
        const opacity = this.getValueJS("opacity") as number;
        return opacity ?? 1;
    }

    /**
     * The scale this node's own draw helpers (`drawImage`, `drawText`, `drawTextWrap`) apply when the
     * caller passes none: the node's `scale` field. A node that draws its content inside a scale
     * frame (`openScaleFrame`, the ArrayGrid family) overrides this with `[1, 1]` so the scale is not
     * applied twice.
     */
    protected contentScale(): number[] {
        return this.getValueJS("scale") as number[];
    }

    /**
     * The screen (`sceneRect`) in the coordinates this node draws in right now. Under a scale frame
     * (`openScaleFrame`: an ancestor's scale, or a grid's own) the screen spans more or fewer local
     * units, so a node that stops placing items at the screen edge must test against this.
     */
    protected visibleSceneRect(): Rect {
        const map = sgRoot.sceneMap;
        if (map === IDENTITY_SCENE_MAP || map.sx === 0 || map.sy === 0) {
            return this.sceneRect;
        }
        const scene = this.sceneRect;
        return normalizedRect(
            (scene.x - map.bx) / map.sx,
            (scene.y - map.by) / map.sy,
            scene.width / map.sx,
            scene.height / map.sy
        );
    }

    /**
     * Where a draw that turns around `x + scale * scaleRotateCenter` (`doDrawRotatedRect`,
     * `doDrawRotatedBitmap`, the Effect clip) must start so that pivot lands on the node's pivot
     * under the inherited rotation `angle`: `drawTrans` itself when `angle` is 0. A node that places
     * its content from `drawTrans` instead (text, grid items) needs no adjustment.
     */
    protected getPivotAnchor(drawTrans: number[], angle: number, scale: number[], center?: number[]): number[] {
        if (angle === 0) {
            return drawTrans;
        }
        return pivotAnchor(drawTrans, angle, scale, center ?? this.getScaleRotateCenter());
    }

    /**
     * Brackets `draw` with `IfDraw2D.pushScale`/`popScale` around the pivot `(x, y)` when `scale`
     * isn't the default `[1,1]` — the shared shape behind `drawText`'s single draw call and
     * `drawTextWrap`'s per-line loop (pushed once for the whole block, not per line). Takes raw
     * coordinates rather than a `Rect` since only the pivot position is ever needed: a caller whose
     * own rect gets mutated before drawing (SimpleLabel's horizOrigin/vertOrigin alignment) can pass
     * its captured pivot directly instead of packaging a throwaway `Rect` around it.
     */
    protected withScale(draw2D: IfDraw2D | undefined, x: number, y: number, scale: number[], draw: () => void) {
        const scaled = (scale[0] !== 1 || scale[1] !== 1) && (draw2D?.pushScale(x, y, scale[0], scale[1]) ?? false);
        try {
            draw();
        } finally {
            if (scaled) {
                draw2D?.popScale();
            }
        }
    }

    protected drawText(
        fullText: string,
        font: BrsType,
        color: number,
        opacity: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        draw2D?: IfDraw2D,
        ellipsis: string = "...",
        index: number = 0,
        scale?: number[]
    ) {
        const drawFont = Font.drawFontOf(font);
        if (!(drawFont instanceof RoFont)) {
            return { text: fullText, width: 0, height: 0, ellipsized: false };
        }
        let text: string;
        let measured: MeasuredText;

        if (this.isDirty || this.cachedLines[index] === undefined) {
            if (rect.width === 0) {
                const newlineIndex = fullText.indexOf("\n");
                if (newlineIndex === -1) {
                    text = fullText;
                } else {
                    text = fullText.substring(0, newlineIndex);
                }
                measured = drawFont.measureText(text);
            } else {
                measured = drawFont.measureText(fullText, rect.width, ellipsis);
                text = measured.text;
            }
            this.cachedLines[index] = measured;
        } else {
            measured = this.cachedLines[index];
            text = measured.text;
        }

        let textX = rect.x;
        let textY = rect.y;

        if (rect.width > measured.width) {
            if (horizAlign === "center") {
                textX += (rect.width - measured.width) / 2;
            } else if (horizAlign === "right") {
                textX += rect.width - measured.width;
            }
        }
        if (rect.height > measured.height) {
            if (vertAlign === "center") {
                textY += (rect.height - measured.height) / 2;
            } else if (vertAlign === "bottom") {
                textY += rect.height - measured.height;
            }
        }
        scale ??= this.contentScale();
        this.withScale(draw2D, rect.x, rect.y, scale, () => {
            draw2D?.doDrawRotatedText(text, textX, textY, color, opacity, drawFont, rotation);
        });
        return measured;
    }

    protected drawTextWrap(
        text: string,
        font: BrsType,
        color: number,
        opacity: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        ellipsis: string = "...",
        numLines: number = 0,
        maxLines: number = 0,
        lineSpacing: number = 0,
        displayPartialLines: boolean = false,
        draw2D?: IfDraw2D,
        scale?: number[]
    ): MeasuredText {
        const drawFont = Font.drawFontOf(font);
        if (!(drawFont instanceof RoFont)) {
            return { text, width: rect.width, height: 0, ellipsized: false };
        }
        if (this.changed) {
            this.refreshLines(text, drawFont, rect, ellipsis, numLines, maxLines, lineSpacing, displayPartialLines);
        }
        let y = rect.y;
        if (rect.height > this.cachedHeight) {
            if (vertAlign === "center") {
                y += (rect.height - this.cachedHeight) / 2;
            } else if (vertAlign === "bottom") {
                y += rect.height - this.cachedHeight;
            }
        }
        scale ??= this.contentScale();
        let ellipsized = false;
        this.withScale(draw2D, rect.x, rect.y, scale, () => {
            for (const line of this.cachedLines) {
                let x = rect.x;
                if (horizAlign === "center") {
                    x += (rect.width - line.width) / 2;
                } else if (horizAlign === "right") {
                    x += rect.width - line.width;
                }
                draw2D?.doDrawRotatedText(line.text, x, y, color, opacity, drawFont, rotation);
                y += line.height + lineSpacing;
                ellipsized = line.ellipsized;
            }
        });

        return {
            text,
            width: rect.width,
            height: this.cachedHeight,
            ellipsized: ellipsized,
        };
    }

    private refreshLines(
        text: string,
        drawFont: RoFont,
        rect: Rect,
        ellipsis: string,
        numLines: number,
        maxLines: number,
        lineSpacing: number,
        displayPartialLines: boolean
    ) {
        const lines = this.breakTextIntoLines(text, drawFont, rect.width);
        const lineHeight = drawFont.measureTextHeight();
        let renderedLines = lines;
        // Match the draw loop in drawTextWrap, which advances by lineHeight + lineSpacing
        // between lines: the visible extent of N lines is N*lineHeight + (N-1)*lineSpacing.
        let totalHeight = lines.length * lineHeight + (lines.length > 1 ? (lines.length - 1) * lineSpacing : 0);

        if (rect.height > 0) {
            const maxRenderedLines = Math.floor((rect.height + lineSpacing) / (lineHeight + lineSpacing));
            renderedLines = this.checkEllipsis(lines, maxRenderedLines, drawFont, rect.width, ellipsis);
            if (!displayPartialLines && renderedLines.length < lines.length) {
                totalHeight =
                    renderedLines.length * lineHeight +
                    (renderedLines.length > 1 ? (renderedLines.length - 1) * lineSpacing : 0);
            } else {
                totalHeight = Math.min(totalHeight, rect.height);
            }
        } else if (numLines > 0 || maxLines > 0) {
            const limit = numLines > 0 ? numLines : maxLines;
            renderedLines = this.checkEllipsis(lines, limit, drawFont, rect.width, ellipsis);
            totalHeight = Math.min(totalHeight, limit * lineHeight + (limit > 1 ? (limit - 1) * lineSpacing : 0));
        }
        this.cachedHeight = totalHeight;
        this.cachedLines = renderedLines;
    }

    private checkEllipsis(lines: MeasuredText[], maxLines: number, drawFont: RoFont, width: number, ellipsis: string) {
        if (lines.length > maxLines) {
            const renderedLines = lines.slice(0, maxLines);
            if (renderedLines.length > 0) {
                const line = renderedLines.at(-1)!;
                line.text = this.ellipsizeLine(line.text, drawFont, width, ellipsis);
                line.ellipsized = true;
            }
            return renderedLines;
        }
        return lines;
    }

    protected breakTextIntoLines(text: string, font: RoFont, width: number): MeasuredText[] {
        const lines: MeasuredText[] = [];
        if (text.length === 0 || width <= 0) {
            return lines;
        }
        const words = text.split(/(\s|-)/);
        let currentMeasure = font.measureText(text);
        // The reference: "Each newline character in the text results in a new line of text" —
        // that has to hold even when the WHOLE string (embedded newlines and all) measures
        // narrower than the box, so the single-line fast path below must not apply to it.
        if (!text.includes("\n") && currentMeasure.width <= width) {
            return [currentMeasure];
        }
        currentMeasure = { text: "", width: 0, height: 0, ellipsized: false };
        for (const word of words) {
            if (word === "\n") {
                lines.push(currentMeasure);
                currentMeasure = { text: "", width: 0, height: 0, ellipsized: false };
            } else {
                const testLine = currentMeasure.text + word;
                const measure = font.measureText(testLine);
                if (measure.width <= width) {
                    currentMeasure = measure;
                } else if (font.measureText(word).width > width) {
                    // Word is too long, break it
                    const brokenWords = this.breakLongWord(word, font, width);
                    for (const brokenWord of brokenWords) {
                        const brokenMeasure = font.measureText(currentMeasure.text + brokenWord);
                        if (brokenMeasure.width <= width) {
                            currentMeasure = brokenMeasure;
                        } else {
                            lines.push(currentMeasure);
                            currentMeasure = font.measureText(brokenWord);
                        }
                    }
                } else {
                    lines.push(currentMeasure);
                    currentMeasure = font.measureText(word);
                }
            }
        }
        lines.push(currentMeasure);
        return lines;
    }

    protected breakLongWord(word: string, font: RoFont, width: number): string[] {
        const brokenWords: string[] = [];
        let currentWord = "";
        for (const char of word) {
            if (font.measureTextWidth(currentWord + char).width <= width) {
                currentWord += char;
            } else {
                brokenWords.push(currentWord);
                currentWord = char;
            }
        }
        brokenWords.push(currentWord);
        return brokenWords;
    }

    protected ellipsizeLine(line: string, font: RoFont, width: number, ellipsis: string): string {
        if (font.measureTextWidth(line + ellipsis).width <= width) {
            return line + ellipsis;
        }
        let ellipsizedLine = "";
        for (const char of line) {
            if (font.measureTextWidth(ellipsizedLine + char + ellipsis).width <= width) {
                ellipsizedLine += char;
            } else {
                return ellipsizedLine + ellipsis;
            }
        }
        return ellipsizedLine + ellipsis;
    }

    /**
     * Draws `bitmap` stretched to `rect` (its natural size on a 0 extent), scaled by `scale` and
     * turned by `rotation` around `rect + scale * scaleRotateCenter`. A rotated node must pass a
     * rect at its pivot anchor (`getPivotAnchor`). Writes the drawn (scaled) size back into `rect`.
     * @param scale The scale to draw at; `contentScale()` when omitted.
     */
    protected drawImage(
        bitmap: RoBitmap | RoAnimatedImage,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D,
        rgba?: number,
        scale?: number[]
    ) {
        // `RoAnimatedImage` content (animated WebP/Lottie) has no 9-patch marker concept — the
        // `isValid()`/`ninePatch` checks below are `RoBitmap`-only.
        if (!(bitmap instanceof RoBitmap) || bitmap.isValid()) {
            bitmap.scaleMode = 1;
            rgba = normalizeBlendColor(rgba);
            if (opacity < 0 || opacity > 1) {
                opacity = 1;
            }
            if (bitmap instanceof RoBitmap && bitmap.ninePatch) {
                draw2D?.drawNinePatch(bitmap, rect, rgba, opacity);
                // TODO: Handle 9-patch rotation, scaling
                return rect;
            }
            scale ??= this.contentScale();
            let scaleX = rect.width === 0 ? 1 : rect.width / bitmap.width;
            let scaleY = rect.height === 0 ? 1 : rect.height / bitmap.height;
            scaleX *= scale[0];
            scaleY *= scale[1];
            rect.width = scaleX * bitmap.width;
            rect.height = scaleY * bitmap.height;
            if (rotation !== 0 || scale[0] !== 1 || scale[1] !== 1) {
                // The pivot sits at the SCALED center: `rect.x/y` already carries the
                // `center * (1 - scale)` compensation from getTranslation.
                const center = this.getScaleRotateCenter();
                draw2D?.doDrawRotatedBitmap(
                    rect.x,
                    rect.y,
                    scaleX,
                    scaleY,
                    rotation,
                    bitmap,
                    center[0] * scale[0],
                    center[1] * scale[1],
                    rgba,
                    opacity
                );
            } else {
                draw2D?.doDrawScaledObject(rect.x, rect.y, scaleX, scaleY, bitmap, rgba, opacity);
            }
        }
        return rect;
    }

    /**
     * Records a measured size in all three coordinate-space rects, not just rectLocal.
     * Used by label getMeasured() implementations: a component sizing itself from a detached
     * label's boundingRect() (parent space) can query before any render pass reaches the label,
     * and mid-render getBoundingRect's measuring fallback is skipped when rectLocal is already
     * non-zero — so the measure must land in every space rather than leave a stale zero
     * rectToParent/rectToScene. Width/height are translation-invariant; the true origins are
     * recomputed when a render pass reaches the node in renderNode.
     */
    protected setMeasuredBoundingRects(width: number, height: number) {
        const trans = this.getTranslation();
        this.rectLocal = { x: 0, y: 0, width, height };
        this.rectToParent = { x: trans[0], y: trans[1], width, height };
        this.rectToScene = { x: trans[0], y: trans[1], width, height };
    }

    /**
     * Sets the node's three rects from `drawRect`, the box the node covers in its own UNSCALED units,
     * placed at its draw translation (`getDrawTranslation`, plus any outset such as a grid's focus
     * margins). `rectLocal` is that box relative to the node's origin; `rectToParent` and
     * `rectToScene` take it through the node's own translation, scale and rotation around
     * `scaleRotateCenter` (and the ancestors' transform, for the scene).
     *
     * DEVICE-MEASURED (Roku OS 15.3, probe `test/simulator/probes/group-scale-probe` R2/R3): a
     * 200x200 Rectangle or Poster scaled 0.5 reports localBoundingRect {0,0,200,200} and a 100x100
     * boundingRect, with or without a child that covers it; a LabelList scaled 0.5 at x=500 with a
     * -36 focus outset reports boundingRect x=482.
     *
     * @param rotation The rotation the node draws at: the inherited angle plus its own, or the
     * inherited one alone for a node type that ignores its own.
     * @param scale See `getTranslation`'s `scale` param — threaded through to avoid a re-fetch.
     */
    protected updateBoundingRects(drawRect: Rect, origin: number[], rotation: number, scale?: number[]) {
        scale ??= this.getValueJS("scale") as number[];
        const nodeTrans = this.getTranslation(scale);
        const angle = this.inheritedAngle;
        const turned = angle === 0 ? nodeTrans : rotateTranslation(nodeTrans, angle);
        const drawTrans = [origin[0] + turned[0], origin[1] + turned[1]];
        // Local space must agree with the parent/scene rects: a grid's drawRect is outset by its focus
        // margins, and a device reports that outset in all three. DEVICE-MEASURED: a PosterGrid at
        // translation [0,320] reports y=306 (a 14px outset), and a LabelList at [0,0] reports x=-24.
        this.rectLocal = {
            x: drawRect.x - drawTrans[0],
            y: drawRect.y - drawTrans[1],
            width: drawRect.width,
            height: drawRect.height,
        };
        this.placeLocalRect(nodeTrans, drawTrans, scale, rotation);
    }

    /**
     * Derives `rectToParent`/`rectToScene` from `rectLocal`: through the node's translation, scale
     * and own rotation for the parent, and its draw translation, scale and full `rotation` for the
     * scene, both turning around `scaleRotateCenter`.
     */
    private placeLocalRect(nodeTrans: number[], drawTrans: number[], scale: number[], rotation: number) {
        const angle = this.inheritedAngle;
        // Exact in the common cases (no own rotation, or no inherited one), so an unrotated node
        // never goes down the rotation path on a rounding residue.
        let ownRotation = rotation - angle;
        if (rotation === angle) {
            ownRotation = 0;
        } else if (angle === 0) {
            ownRotation = rotation;
        }
        const center = rotation === 0 && angle === 0 ? NO_CENTER : this.getScaleRotateCenter();
        this.rectToParent = transformLocalRect(this.rectLocal, nodeTrans, scale, ownRotation, center);
        this.placedTrans = nodeTrans;
        this.placedScale = scale;
        this.placedRotation = ownRotation;
        this.placedCenter = center;
        const anchor = pivotAnchor(drawTrans, angle, scale, center);
        this.rectToScene = mapRectToScene(
            this.sceneMap,
            transformLocalRect(this.rectLocal, anchor, scale, rotation, center)
        );
    }

    /**
     * Unions this node's rects into its parent's. `rectToParent` is in the parent's local space,
     * so it reaches the parent's own parent through the parent's translation, scale and rotation;
     * `rectToScene` is already in scene space.
     */
    protected updateParentRects(origin: number[], angle: number) {
        if (!(this.parent instanceof Group)) {
            return;
        }
        const parent = this.parent;
        parent.rectLocal = unionRect(parent.rectLocal, this.rectToParent);
        if (parent.boundsFromLocal) {
            // A container mid-pass re-derives both from rectLocal once its children are done.
            return;
        }
        let parentTrans = parent.placedTrans;
        let parentScale = parent.placedScale;
        let parentRotation = parent.placedRotation;
        let parentCenter = parent.placedCenter;
        if (parentTrans === undefined) {
            // The parent has not placed its own rects in this pass yet (or this node is measured alone).
            parentScale = parent.getValueJS("scale") as number[];
            parentTrans = parent.getTranslation(parentScale);
            parentRotation = parent.getRotation();
            parentCenter = parentRotation === 0 ? NO_CENTER : parent.getScaleRotateCenter();
        }
        const inParent = transformLocalRect(this.rectToParent, parentTrans, parentScale, parentRotation, parentCenter);
        parent.rectToParent = unionRect(parent.rectToParent, inParent);
        parent.rectToScene = unionRect(parent.rectToScene, this.rectToScene);
    }

    handleKey(key: string, press: boolean) {
        // override in derived classes
        return false;
    }

    /**
     * Render entry point for every node. This is a TEMPLATE METHOD and should not be overridden —
     * node types implement `renderNodeContent` instead, and this wrapper applies the node's own
     * `clippingRect` around it.
     *
     * The clip lives here rather than inside each node's body because `clippingRect` is declared on
     * `Group` and inherited by every renderable node, and per the SceneGraph reference it limits
     * "all drawing by this node AND its children" — so it has to bracket the node's own geometry,
     * not just the child traversal. Doing it in the parent's `renderChildren` instead would miss the
     * eight call sites that render a child directly (PanelSet's ordered panels, the grid/list item
     * renderers, TargetGroup) and both `RoSGScreen` entry points (Scene and Dialog are painted via
     * `paintNode`, with no parent traversal above them).
     *
     * Measurement/layout passes stay unclipped: `pushClippingRect` no-ops without a `draw2D`.
     */
    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        this.sceneMap = sgRoot.sceneMap;
        this.inheritedAngle = angle;
        this.placedTrans = undefined;
        this.prepareRender(draw2D);
        // A fully transparent subtree DEGRADES to a layout traversal — drop the draw target rather
        // than returning, so ancestor bounds come out identical to a layout pass and every descendant
        // still reaches its own `nodeRenderingDone`. Multiplies in this node's OWN opacity (the
        // accumulated value has only the ancestors' folded in) and tests exactly `=== 0`. Rationale and
        // regressions: `.claude/docs/scenegraph-invariants.md`.
        // Flag it as well as dropping the target: to a descendant, a dropped `draw2D` is indistinguishable
        // from a layout pass, and the handful of sites that legitimately do layout-pass-ONLY work would
        // start doing it on painted frames (see `Node.isLayoutPass`). Restored rather than cleared below,
        // so a faded subtree nested inside another one hands the outer state back.
        const wasSuppressed = sgRoot.paintSuppressed;
        if (draw2D !== undefined && opacity * this.getOpacity() === 0) {
            draw2D = undefined;
            sgRoot.paintSuppressed = true;
        }
        // Order matters for cost, not just correctness. A layout/measure pass never clips (bounding
        // rects must stay unclipped), and an invisible node draws nothing — check both before probing
        // the field, so the overwhelmingly common case is one comparison. The real visibility gates
        // stay inside each renderNodeContent: they differ per node type (soft skip for containers,
        // hard skip for renderables, hidden-extent measurement for grids).
        const clipped = draw2D !== undefined && this.isVisible() && this.pushClippingRect(origin, angle, draw2D);
        try {
            this.renderNodeContent(interpreter, origin, angle, opacity, draw2D);
        } finally {
            if (clipped) {
                draw2D?.popClip();
            }
            sgRoot.paintSuppressed = wasSuppressed;
            this.boundsFromLocal = false;
        }
    }

    /**
     * Runs before the node's draw translation is computed, for node types that must settle their own
     * position first. Default is a no-op; `StandardDialog` overrides it because its layout assigns
     * its OWN translation, which the clip position then has to be derived from.
     */
    protected prepareRender(draw2D?: IfDraw2D) {
        // override in derived classes
    }

    /** Rotation is ignored, as the sub part rects are re-expressed by translation only. */
    protected sceneUnitsTo(local: boolean): [number, number] {
        let sx = this.sceneMap.sx;
        let sy = this.sceneMap.sy;
        if (local) {
            const scale = this.getValueJS("scale") as number[];
            sx *= scale[0];
            sy *= scale[1];
        }
        return [sx === 0 ? 0 : 1 / sx, sy === 0 ? 0 : 1 / sy];
    }

    /**
     * This node's draw translation: its own translation composed with the parent-space `origin`,
     * rotated by any inherited angle.
     *
     * Every node must position its own drawing through this method, so the clip `renderNode` pushes
     * can never drift from where the node actually paints.
     *
     * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2; probe `test/simulator/probes/layout-measure-probe`, case `R`):
     * an inherited rotation rotates a child's own translation vector for EVERY node type. Two
     * identical hosts rotated 90° with a child translated [100, 0] put the child at the same rotated
     * position whether that child was a `Group` or a `Rectangle`. The engine used to rotate for 18
     * renderable types but not for `Group` or the keyboard/text-entry containers — a split that
     * looked accidental (#1133 preserved it pending exactly this measurement) and placed a container's
     * children 100px off under a rotated ancestor.
     *
     * The result is the node's unrotated local origin, which is where content placed from it (text,
     * grid items) belongs as long as the node has no rotation of its own. DEVICE-MEASURED (Roku OS
     * 15.3, probe `test/simulator/probes/group-scale-probe` R1): a 200x40 Label, Rectangle or Group
     * with `scaleRotateCenter` [100,20] inside a Group rotated 90° all cover the same
     * {T.x, T.y - 200, 40, 200}: without its own rotation or scale, the pivot does not move a node.
     * A draw that turns around `x + scale * center` starts from `getPivotAnchor` instead.
     *
     * @param scale See `getTranslation`'s `scale` param — threaded through to avoid a re-fetch.
     */
    protected getDrawTranslation(origin: number[], angle: number, scale?: number[]): number[] {
        const nodeTrans = this.getTranslation(scale);
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        return drawTrans;
    }

    /**
     * Renders the children in this node's local coordinate system. `origin` is this node's draw
     * translation and `angle` the rotation it draws at. The children start at the node's local
     * origin: `origin` turned around the pivot by the node's own rotation, plus `offset` (local
     * units) for a node that lays its children out below a header. The node's own `scale` is
     * applied there once, as a scale frame (`openScaleFrame`), so descendants keep drawing in local
     * units (sizes, layout spacing, text) and only their scene rects go through `sgRoot.sceneMap`.
     *
     * DEVICE-MEASURED (Roku OS 16, probe `test/simulator/probes/group-scale-probe`): a child of a
     * Group scaled 0.5 keeps localBoundingRect/boundingRect in unscaled local units ({0,0,64,64} /
     * {20,10,64,64}) while its sceneBoundingRect is halved; a LayoutGroup under that Group spaces its
     * items 60 apart, as when unscaled; a 20x20 child of a Rectangle rotated 45° around [50,50]
     * inside a Group rotated 90° covers {1436,92,28,28}. A non-uniform scale under a rotation is
     * approximated (scale applied after rotation).
     *
     * Node types that place their children themselves override `renderChildNodes`, never this, so
     * the frame still applies (PanelSet).
     *
     * @param scale See `getTranslation`'s `scale` param — threaded through to avoid a re-fetch.
     * @param offset Where the children start in this node's local units, when not at its origin.
     */
    renderChildren(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D,
        scale?: number[],
        offset?: number[]
    ) {
        // A childless node has nothing to place, so it skips the field reads and the frame.
        if (this.children.length === 0) {
            this.renderChildNodes(interpreter, origin, angle, opacity, draw2D);
            return;
        }
        scale ??= this.getValueJS("scale") as number[];
        let localOrigin = origin;
        if (angle !== this.inheritedAngle) {
            // The node's own rotation turns its local origin around its pivot, which sits at
            // `origin + R(inherited)(scale * center)`.
            const center = this.getScaleRotateCenter();
            if (center[0] !== 0 || center[1] !== 0) {
                const scaledCenter = [center[0] * scale[0], center[1] * scale[1]];
                const pivot = rotateTranslation(scaledCenter, this.inheritedAngle);
                const turned = rotateTranslation(scaledCenter, angle);
                localOrigin = [origin[0] + pivot[0] - turned[0], origin[1] + pivot[1] - turned[1]];
            }
        }
        let childOrigin = localOrigin;
        if (offset) {
            const turned = angle === 0 ? offset : rotateTranslation(offset, angle);
            childOrigin = [localOrigin[0] + turned[0], localOrigin[1] + turned[1]];
        }
        const frame = this.openScaleFrame(localOrigin, scale, draw2D);
        try {
            this.renderChildNodes(interpreter, childOrigin, angle, opacity, draw2D);
        } finally {
            this.closeScaleFrame(frame, draw2D);
        }
    }

    /** Renders the children at `origin`, inside the frame `renderChildren` opened. */
    protected renderChildNodes(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        super.renderChildren(interpreter, origin, angle, opacity, draw2D);
    }

    /**
     * Applies `scale` around `pivot` to everything drawn until `closeScaleFrame`: as a canvas
     * transform (`IfDraw2D.pushScaleFrame`) and as the scene map that bounding rects go through.
     * Returns undefined at scale [1,1]. Used for a node's children and for node types that draw
     * their own items at `pivot`-relative positions (ArrayGrid family, TargetGroup).
     */
    protected openScaleFrame(pivot: number[], scale: number[], draw2D?: IfDraw2D): ScaleFrame | undefined {
        if (scale[0] === 1 && scale[1] === 1) {
            return undefined;
        }
        const outerMap = sgRoot.sceneMap;
        sgRoot.sceneMap = composeSceneScale(outerMap, pivot[0], pivot[1], scale[0], scale[1]);
        const depth = draw2D?.pushScaleFrame(pivot[0], pivot[1], scale[0], scale[1]) ?? -1;
        return { outerMap, depth };
    }

    /** Closes a frame `openScaleFrame` returned; a no-op for undefined. */
    protected closeScaleFrame(frame: ScaleFrame | undefined, draw2D?: IfDraw2D) {
        if (frame === undefined) {
            return;
        }
        draw2D?.popScaleFrame(frame.depth);
        sgRoot.sceneMap = frame.outerMap;
    }

    /**
     * The node's actual rendering. Override this (never `renderNode`) in a derived node type.
     */
    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.skipRender(draw2D)) {
            return;
        }
        if (this.skipSettledLayout(origin, angle, opacity, draw2D)) {
            return;
        }
        // Clear the stale mark BEFORE the pass, not after: BrightScript that runs inside it (an
        // item component's init(), a field observer) can write fields — clearing afterwards would
        // wipe the mark those writes set and strand the change until something unrelated dirties
        // this subtree again. Record the incoming context a completed pass ran under; a pruned
        // refresh may only skip when the same context comes back.
        //
        // Both happen ONLY inside the pruned full refresh itself: scoped measurements (the
        // mid-render fallback, measureUnsizedChildren) render at origin [0,0], and a detached
        // component root's real refresh ALSO runs at [0,0] — if a scoped pass recorded that
        // context and cleared the mark, the real refresh would skip on the scoped pass's partial
        // rects (its parent's union was snapshot/restored away, or its layout hadn't been applied
        // yet). Paint passes don't participate in pruning at all.
        if (sgRoot.pruneLayout) {
            this.subtreeStale = false;
            this.measureStale = false;
            this.lastLayoutContext = { x: origin[0], y: origin[1], angle, opacity, sceneMap: this.sceneMap };
        }
        this.layoutPassCount++;
        const scale = this.getValueJS("scale") as number[];
        const nodeTrans = this.getTranslation(scale);
        const drawTrans = this.getDrawTranslation(origin, angle, scale);
        const rotation = angle + this.getRotation();
        this.rectLocal = {
            x: Number.POSITIVE_INFINITY,
            y: Number.POSITIVE_INFINITY,
            width: Number.POSITIVE_INFINITY,
            height: Number.POSITIVE_INFINITY,
        };
        this.rectToScene = mapRectToScene(this.sceneMap, {
            x: drawTrans[0],
            y: drawTrans[1],
            width: 0,
            height: 0,
        });
        this.rectToParent = {
            x: nodeTrans[0],
            y: nodeTrans[1],
            width: 0,
            height: 0,
        };
        // An invisible group traversed by a measurement pass propagates opacity 0 so its (visible)
        // descendants compute their rects but keep reporting renderTracking "none" — they are laid
        // out, not displayed.
        opacity = this.isVisible() ? opacity * this.getOpacity() : 0;
        // The clippingRect bracket lives in the renderNode template, so it wraps this whole body.
        this.boundsFromLocal = true;
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D, scale);
        this.updateContainerBounds(nodeTrans, drawTrans, scale, rotation);
        this.boundsFromLocal = false;
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    /**
     * Applies this node's `clippingRect`, limiting where the node and its children may draw. Pushed
     * by the `renderNode` template so it brackets the node's OWN geometry as well as its children,
     * per the reference ("all drawing by this node and its children").
     * The rect is in the node's local coordinate system (per the SceneGraph reference), so it is
     * placed by the node's draw translation, own scale and rotation (as its axis-aligned bounding
     * box) before being pushed; ancestor scale is already on the canvas. An
     * empty rect (width or height ≤ 0, the default `[0,0,0,0]`) disables clipping. Clipping is only
     * applied on a real draw pass (`draw2D` present); a measurement/layout pass (no draw target)
     * must remain unclipped so hidden-UI bounding rects still compute. The canvas clip intersects
     * any already-active clip, so nested/ancestor `clippingRect`s compose and stay bounded by the
     * screen. Returns whether a clip was pushed (caller must `popClip()` when true).
     */
    protected pushClippingRect(origin: number[], angle: number, draw2D?: IfDraw2D): boolean {
        if (!draw2D) {
            return false;
        }
        // Fast path for the overwhelmingly common "no clip" case. The generic read converts the whole
        // rect2d associative array to a fresh JS object (allocating a WeakSet and walking its entries)
        // — cheap once, but this now runs for every node on every paint pass, so an empty rect must
        // not pay for it. `rect2d` values are always stored with lowercase numeric x/y/width/height
        // (Field.convertRect2D rebuilds them), and anything that does not match falls through to the
        // generic path below, so semantics are unchanged.
        const raw = this.getValue("clippingRect");
        if (raw instanceof RoAssociativeArray) {
            const width = raw.elements.get("width");
            const height = raw.elements.get("height");
            if (width !== undefined && height !== undefined && isAnyNumber(width) && isAnyNumber(height)) {
                if (Number(width.getValue()) <= 0 || Number(height.getValue()) <= 0) {
                    return false;
                }
            }
        }
        const clip = this.getValueJS("clippingRect") as { x: number; y: number; width: number; height: number };
        if (!clip || clip.width <= 0 || clip.height <= 0) {
            return false;
        }
        // Resolved only once a clip is known to be needed — `getDrawTranslation` allocates, and the
        // node computes its own copy inside `renderNodeContent` anyway.
        const scale = this.getValueJS("scale") as number[];
        const drawTrans = this.getDrawTranslation(origin, angle, scale);
        const rotation = angle + this.getRotation();
        const center = rotation === 0 && angle === 0 ? NO_CENTER : this.getScaleRotateCenter();
        const anchor = pivotAnchor(drawTrans, angle, scale, center);
        draw2D.pushClip(transformLocalRect(clip, anchor, scale, rotation, center));
        return true;
    }

    /**
     * A container's parent and scene rects are its local union (children's `boundingRect`s) taken
     * through its own scale and rotation. DEVICE-MEASURED (Roku OS 16, probe
     * `test/simulator/probes/group-scale-probe`): a Group at [100,100] scaled 0.5 around a child at
     * [20,10] reports localBoundingRect {20,10,64,64} and boundingRect {110,105,32,32}; a Group
     * rotated 90° reports the bounding box of its rotated local rect.
     */
    private updateContainerBounds(nodeTrans: number[], drawTrans: number[], scale: number[], rotation: number) {
        if (!Number.isFinite(this.rectLocal.x)) {
            return;
        }
        this.placeLocalRect(nodeTrans, drawTrans, scale, rotation);
    }

    protected nodeRenderingDone(origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        // An invisible node only reaches here on a measurement pass (skipRender lets it through
        // when there is no draw target): its own rects were refreshed for bounding-rect queries,
        // but it must not contribute to the parent's bounds nor report as rendered.
        if (this.isVisible()) {
            this.updateParentRects(origin, angle);
        }
        this.updateRenderTracking(opacity === 0 || !this.isVisible());
        // Mark node as clean after rendering. Deliberately keyed on having actually had a draw target, NOT
        // on `isLayoutPass`: a fully transparent subtree drew nothing, so it must stay dirty and repaint
        // when revealed. Regression: "a revealed subtree paints again on the next frame".
        if (draw2D) {
            this.isDirty = false;
        }
    }

    /**
     * Whether a pruned layout refresh may skip this settled subtree (docs/scenegraph-layout-passes.md).
     * Active only during `refreshLayoutFromRoot`'s pruned pass (`sgRoot.pruneLayout`), never on
     * paint. A subtree is skippable when nothing in it was written since its last layout pass
     * (`subtreeStale` false — sound because layout passes are pure) AND the incoming
     * origin/angle/opacity match the context that pass ran under. A skipped child must still hand
     * its cached rect up: `updateBoundingRects` resets the parent's rects at the start of the
     * parent's pass and rebuilds them from child unions, so skipping without contributing would
     * make every ancestor's bounds come out short (a vertical LayoutGroup reporting one child's
     * height instead of the stack's — MidRenderParentMeasure).
     */
    private skipSettledLayout(origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D): boolean {
        if (draw2D || !sgRoot.pruneLayout || this.subtreeStale || !this.lastLayoutContext) {
            return false;
        }
        const ctx = this.lastLayoutContext;
        if (
            ctx.x !== origin[0] ||
            ctx.y !== origin[1] ||
            ctx.angle !== angle ||
            ctx.opacity !== opacity ||
            !sameSceneMap(ctx.sceneMap, this.sceneMap)
        ) {
            return false;
        }
        if (this.isVisible()) {
            this.updateParentRects(origin, angle);
        }
        return true;
    }

    /**
     * Whether renderNode must skip this node. Invisible nodes are skipped during frame draws
     * (draw2D present). A layout/measurement pass (no draw target — e.g. getBoundingRect's
     * refresh render) still traverses invisible plain containers so that nodes inside a hidden
     * ancestor get their bounding rects computed: on Roku, layout and bounding rects are
     * independent of visibility, and apps commonly measure UI before showing it (a component
     * built while an ancestor screen group is still hidden, then centered via boundingRect()).
     * Renderable/complex nodes (Poster, Label, ArrayGrid, …) keep their own hard skip when
     * invisible so hidden UI does not load textures or create item components.
     */
    protected skipRender(draw2D?: IfDraw2D): boolean {
        if (this.isVisible()) {
            return false;
        }
        if (!draw2D) {
            return false;
        }
        this.updateRenderTracking(true);
        return true;
    }

    /**
     * Runs on layout passes too (not gated on `isPaintPass`): tracking is a deterministic
     * function of layout state (rects + visibility), the write only fires on a genuine change,
     * and HiddenMeasure pins that a bounding-rect refresh reports "none" for UI measured under a
     * hidden ancestor. That keeps layout passes idempotent without freezing tracking between
     * frames.
     */
    protected updateRenderTracking(invisible: boolean) {
        const enableRenderTracking = this.getValueJS("enableRenderTracking") as boolean;
        const renderTracking = this.getValueJS("renderTracking") as string;
        let newStatus = "disabled";
        if (enableRenderTracking) {
            newStatus = invisible ? "none" : rectContainsRect(this.sceneRect, this.rectToScene);
        }
        if (newStatus !== renderTracking) {
            this.setValue("renderTracking", new BrsString(newStatus));
        }
    }
}
