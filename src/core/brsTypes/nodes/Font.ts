import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";

export class Font extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "size", type: "integer", value: "24" },
        { name: "fallbackGlyph", type: "string" },
    ];

    /**
     * Valid System Fonts
     *
     * SmallestSystemFont
     * SmallestBoldSystemFont
     * SmallSystemFont
     * SmallBoldSystemFont
     * MediumSystemFont
     * MediumBoldSystemFont
     * LargeSystemFont
     * LargeBoldSystemFont
     */

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }
}
