import { AAMember, BrsBoolean, BrsString, Float, Int32 } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Label } from "./Label";
import { Poster } from "./Poster";
import { getDialogColors, colorFromPalette } from "./StdDlgItemBase";

/**
 * The title row at the top of a StandardDialog. Renders `primaryTitle` through a Label using the
 * dialog palette's DialogTitleColor, followed by a thin horizontal divider (a 9-patch image tinted
 * with the palette's DialogSecondaryItemColor). (Icon fields are accepted for fidelity but not yet
 * drawn.)
 */
export class StdDlgTitleArea extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "primaryTitle", type: "string", value: "" },
        { name: "primaryIcon", type: "uri" },
        { name: "primaryIconVertOffset", type: "float", value: "0.0" },
        { name: "secondaryIcon", type: "uri" },
        { name: "secondaryIconVertOffset", type: "float", value: "0.0" },
    ];
    private readonly dividerUri = "common:/images/dialog_divider.9.png";
    private readonly title: Label;
    private readonly divider: Poster;
    private readonly dividerGap: number;
    private readonly dividerThickness: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgTitleArea) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.dividerGap = this.resolution === "FHD" ? 18 : 12;
        this.dividerThickness = this.resolution === "FHD" ? 3 : 2;

        this.title = new Label();
        this.title.setValueSilent("horizAlign", new BrsString("left"));
        this.title.setValueSilent("vertAlign", new BrsString("top"));
        this.appendChildToParent(this.title);
        this.linkField(this.title, "text", "primaryTitle");

        this.divider = this.addPoster(this.dividerUri, [0, 0]);
    }

    /** Positions/sizes the title + divider for the given content width and returns the total height (0 when empty). */
    layoutTitle(width: number): number {
        const text = (this.getValueJS("primaryTitle") as string) ?? "";
        if (text === "") {
            this.divider.setValueSilent("visible", BrsBoolean.False);
            this.setValueSilent("width", new Float(0));
            this.setValueSilent("height", new Float(0));
            return 0;
        }
        const colors = getDialogColors(this);
        // The title area uses DialogTextColor (there is no separate title color in the RSG palette).
        const color = colorFromPalette(colors, "DialogTextColor", "0xFFFFFFFF");
        this.title.setValueSilent("width", new Float(width));
        this.title.setValue("font", new BrsString("font:MediumBoldSystemFont"));
        this.title.setValueSilent("color", new Int32(color));
        const titleHeight = this.title.getMeasured().height;

        const dividerY = titleHeight + this.dividerGap;
        this.divider.setValueSilent("visible", BrsBoolean.True);
        this.divider.setTranslation([0, dividerY]);
        this.divider.setValueSilent("width", new Float(width));
        this.divider.setValueSilent("height", new Float(this.dividerThickness));
        const dividerColor = colorFromPalette(colors, "DialogSecondaryItemColor", "0xCCCCCC66");
        this.divider.setValue("blendColor", new Int32(dividerColor));

        const height = dividerY + this.dividerThickness;
        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(height));
        return height;
    }
}
