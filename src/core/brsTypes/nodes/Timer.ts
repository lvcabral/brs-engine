import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";

export class Timer extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "repeat", type: "boolean" },
        { name: "duration", type: "float" },
        { name: "fire", type: "function" },
    ];

    constructor(members: AAMember[] = [], readonly name: string = "Timer") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }
}
