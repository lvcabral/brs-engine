import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { Int32, Float, RoArray, AAMember, BrsBoolean } from "..";

export class Group extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "visible", type: "boolean", value: "true" },
        { name: "opacity", type: "float", value: "1.0" },
        { name: "translation", type: "array", value: "[0.0,0.0]" },
        { name: "rotation", type: "float", value: "0.0" },
        { name: "scale", type: "array", value: "[1.0,1.0]" },
        { name: "scaleRotateCenter", type: "array", value: "[0.0,0.0]" },
        { name: "childRenderOrder", type: "string", value: "renderLast" },
        { name: "inheritParentTransform", type: "boolean", value: "true" },
        { name: "inheritParentOpacity", type: "boolean", value: "true" },
        { name: "clippingRect", type: "array", value: "[0.0,0.0,0.0,0.0]" },
        { name: "renderPass", type: "integer", value: "0" },
        { name: "muteAudioGuide", type: "boolean", value: "false" },
        { name: "enableRenderTracking", type: "boolean", value: "false" },
        { name: "renderTracking", type: "string", value: "disabled" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Group") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected isVisible() {
        const visible = this.fields.get("visible")?.getValue();
        return visible instanceof BrsBoolean ? visible.toBoolean() : true;
    }

    protected getTranslation() {
        const transField = this.fields.get("translation")?.getValue();
        const translation = [0, 0];
        if (transField instanceof RoArray && transField.elements.length === 2) {
            transField.elements.map((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    translation[index] = element.getValue();
                }
            });
        }
        return translation;
    }
}
