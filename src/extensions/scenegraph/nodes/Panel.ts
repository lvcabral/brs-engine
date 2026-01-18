import { AAMember, BrsBoolean, BrsType, Float } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";

/** Valid values for panel sizes in HD */
export type PanelSizeValue = {
    width: number;
    height: number;
    leftPos: number;
};
export const PanelSizeValues: Map<string, PanelSizeValue> = new Map([
    ["narrow", { width: 388, height: 605, leftPos: 105 }],
    ["medium", { width: 520, height: 605, leftPos: 105 }],
    ["wide", { width: 645, height: 605, leftPos: 112 }],
    ["full", { width: 940, height: 605, leftPos: 170 }],
]);

export class Panel extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "388" },
        { name: "height", type: "float", value: "605" },
        { name: "leftPosition", type: "float", value: "105" },
        { name: "panelSize", type: "string", value: "narrow", alwaysNotify: true },
        { name: "overhangTitle", type: "string", value: "" },
        { name: "overhangVisible", type: "boolean", value: "false" },
        { name: "clockText", type: "string", value: "" },
        { name: "optionsAvailable", type: "boolean", value: "false" },
        { name: "leftOrientation", type: "boolean", value: "false" },
        { name: "leftOnly", type: "boolean", value: "false" },
        { name: "hasNextPanel", type: "boolean", value: "false" },
        { name: "isFullScreen", type: "boolean", value: "false" },
        { name: "goBackCount", type: "integer", value: "1" },
        { name: "selectButtonMovesPanelForward", type: "boolean", value: "true" },
        { name: "isOffscreenLeft", type: "boolean", value: "false" },
        { name: "suppressLeftArrow", type: "boolean", value: "false" },
        { name: "maskUri", type: "string", value: "" },
        { name: "maskSize", type: "vector2d", value: "[0,0]" },
        { name: "maskOffset", type: "vector2d", value: "[0,0]" },
        { name: "maskBitmapWidth", type: "integer", value: "0" },
        { name: "maskBitmapHeight", type: "integer", value: "0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Panel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.setValueSilent("focusable", BrsBoolean.True);
        this.setSizeAndPosition(PanelSizeValues.get("narrow")!);
    }

    protected setSizeAndPosition(sizeValue: PanelSizeValue) {
        const width = this.resolution === "HD" ? sizeValue.width : sizeValue.width * 1.5;
        const height = this.resolution === "HD" ? sizeValue.height : sizeValue.height * 1.5;
        const leftPos = this.resolution === "HD" ? sizeValue.leftPos : sizeValue.leftPos * 1.5;
        this.setValue("width", new Float(width));
        this.setValue("height", new Float(height));
        this.setValue("leftPosition", new Float(leftPos));
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "panelsize") {
            const sizeValue = PanelSizeValues.get(value.toString().toLowerCase());
            if (sizeValue) {
                this.setSizeAndPosition(sizeValue);
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
    }
}
