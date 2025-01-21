import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: "string", value: "0x000000FF" },
        { name: "backExitsScene", type: "boolean", value: "true" },
        { name: "dialog", type: "node" },
        { name: "currentDesignResolution", type: "assocarray" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
