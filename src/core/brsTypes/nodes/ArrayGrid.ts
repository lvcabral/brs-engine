import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    getTextureManager,
    jsValueOf,
    RoBitmap,
    ValueKind,
} from "..";

export class ArrayGrid extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "itemSize", type: "array", value: "[0,0]" },
        { name: "itemSpacing", type: "array", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "focusRow", type: "integer", value: "0" },
        { name: "focusColumn", type: "integer", value: "0" },
        { name: "horizFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "vertFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "fadeFocusFeedbackWhenAutoScrolling", type: "boolean", value: "false" },
        { name: "currFocusFeedbackOpacity", type: "float", value: "read-only" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerWidth", type: "float", value: "0" },
        { name: "wrapDividerHeight", type: "float", value: "36" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "numRenderPasses", type: "integer", value: "1" },
        { name: "rowHeights", type: "array", value: "[]" },
        { name: "columnWidths", type: "array", value: "[]" },
        { name: "rowSpacings", type: "array", value: "[]" },
        { name: "columnSpacings", type: "array", value: "[]" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "font" },
        { name: "sectionDividerTextColor", type: "color", value: "0xddddddff" },
        { name: "sectionDividerSpacing", type: "float", value: "0.0" },
        { name: "sectionDividerWidth", type: "float", value: "0.0" },
        { name: "sectionDividerHeight", type: "float", value: "0.0" },
        { name: "sectionDividerMinWidth", type: "float", value: "0.0" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0.0" },
        { name: "itemClippingRect", type: "array", value: "[ 0.0, 0.0, 0.0, 0.0 ]" },
        { name: "itemSelected", type: "integer", value: "0" },
        { name: "itemFocused", type: "integer", value: "0" },
        { name: "itemUnfocused", type: "integer", value: "0" },
        { name: "jumpToItem", type: "integer", value: "0" },
        { name: "animateToItem", type: "integer", value: "0" },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ArrayGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
    protected focusIndex: number = 0;
    protected focusBitmapUri: string = "";
    protected focusBitmap?: RoBitmap;
    protected focusFootprintUri: string = "";
    protected focusFootprint?: RoBitmap;

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (["jumptoitem", "animatetoitem"].includes(fieldName)) {
            const focusedIndex = jsValueOf(this.getFieldValue("itemFocused"));
            if (focusedIndex !== jsValueOf(value)) {
                this.focusIndex = jsValueOf(value);
                index = new BrsString("itemFocused");
            } else {
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "itemfocused") {
            // Read-only field
            return BrsInvalid.Instance;
        } else if (
            fieldName === "vertfocusanimationstyle" &&
            !["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(
                value.toString().toLowerCase()
            )
        ) {
            // Invalid vertFocusAnimationStyle
            return BrsInvalid.Instance;
        } else if (
            fieldName === "horizfocusanimationstyle" &&
            !["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())
        ) {
            // Invalid horizFocusAnimationStyle
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    protected getFocusBitmap() {
        const uri = jsValueOf(this.getFieldValue("focusBitmapUri")) as string;
        if (uri.trim() !== "" && this.focusBitmapUri !== uri) {
            this.focusBitmapUri = uri;
            const textureManager = getTextureManager();
            this.focusBitmap = textureManager.loadTexture(uri);
        } else if (uri.trim() === "") {
            this.focusBitmapUri = "";
            this.focusBitmap = undefined;
        }
        return this.focusBitmap;
    }

    protected getFocusFootprint() {
        const uri = jsValueOf(this.getFieldValue("focusFootprintBitmapUri")) as string;
        if (uri.trim() !== "" && this.focusFootprintUri !== uri) {
            this.focusFootprintUri = uri;
            const textureManager = getTextureManager();
            this.focusFootprint = textureManager.loadTexture(uri);
        } else if (uri.trim() === "") {
            this.focusFootprintUri = "";
            this.focusFootprint = undefined;
        }
        return this.focusFootprint;
    }

    protected hasNinePatch() {
        return this.focusBitmap?.ninePatch || this.focusFootprint?.ninePatch;
    }
}
