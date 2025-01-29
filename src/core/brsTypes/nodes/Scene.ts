import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: "string", value: "0x2F3140FF" },
        { name: "backExitsScene", type: "boolean", value: "true" },
        { name: "dialog", type: "node" },
        { name: "currentDesignResolution", type: "assocarray" },
    ];
    width = 1280;
    height = 720;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected getBoundingRect() {
        const translation = this.getTranslation();
        this.rect.x = translation[0];
        this.rect.y = translation[1];
        this.rect.width = this.width;
        this.rect.height = this.height;
        return this.rect;
    }
}
