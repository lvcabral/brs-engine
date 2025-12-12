import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember } from "brs-engine";
import { Node } from "./Node";

export class RSGPalette extends Node {
    readonly defaultFields: FieldModel[] = [{ name: "colors", type: "assocarray" }];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.RSGPalette) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
