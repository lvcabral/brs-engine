import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Node } from "./Node";

export class RSGPalette extends Node {
    readonly defaultFields: FieldModel[] = [{ name: "colors", type: "assocarray" }];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RSGPalette") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
