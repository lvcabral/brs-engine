import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { RoSGNode } from "../components/RoSGNode";

export class RSGPalette extends RoSGNode {
    readonly defaultFields: FieldModel[] = [{ name: "colors", type: "assocarray" }];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RSGPalette") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
