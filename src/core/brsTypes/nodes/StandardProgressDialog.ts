import { FieldModel } from "./Field";
import { StandardDialog } from "./StandardDialog";
import { AAMember } from "../components/RoAssociativeArray";
import { StdDlgTitleArea, StdDlgContentArea, StdDlgProgressItem, jsValueOf, BrsString, Float } from "..";
import { BrsDevice, Interpreter } from "../..";
import { IfDraw2D } from "../interfaces/IfDraw2D";

export class StandardProgressDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "string", value: "" },
    ];
    private readonly progressItem: StdDlgProgressItem;
    private readonly margin: number;
    private readonly screenWidth: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StandardProgressDialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        if (this.resolution === "FHD") {
            this.margin = 180;
            this.screenWidth = 1920;
        } else {
            this.margin = 120;
            this.screenWidth = 1280;
        }
        const titleArea = new StdDlgTitleArea();
        this.appendChildToParent(titleArea);
        const contentArea = new StdDlgContentArea();
        this.progressItem = new StdDlgProgressItem();
        contentArea.appendChildToParent(this.progressItem);
        this.appendChildToParent(contentArea);
        this.linkField(this.progressItem, "text", "message");
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        const title = jsValueOf(this.getFieldValue("title")) as string;
        const message = jsValueOf(this.getFieldValue("message")) as string;
        if (title === "") {
            const itemWidth = jsValueOf(this.progressItem.getFieldValue("width")) as number;
            this.set(new BrsString("width"), new Float(itemWidth + this.margin));
            this.setTranslationX((this.screenWidth - itemWidth) / 2);
        }
        if (message === "") {
            this.set(new BrsString("message"), new BrsString(BrsDevice.getTerm("Please wait...")));
        }
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }
}
