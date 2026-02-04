import { AAMember, Float, BrsString, BrsDevice, Interpreter, IfDraw2D } from "brs-engine";
import { jsValueOf } from "../factory/Serializer";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { StandardDialog } from "./StandardDialog";
import { StdDlgTitleArea } from "./StdDlgTitleArea";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { StdDlgProgressItem } from "./StdDlgProgressItem";

export class StandardProgressDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "string", value: "" },
    ];
    private readonly progressItem: StdDlgProgressItem;
    private readonly margin: number;
    private readonly screenWidth: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardProgressDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.StandardDialog);

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
        this.setTranslation(this.dialogTrans);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        const title = jsValueOf(this.getValue("title")) as string;
        const message = jsValueOf(this.getValue("message")) as string;
        if (title === "") {
            const itemWidth = jsValueOf(this.progressItem.getValue("width")) as number;
            this.setValue("width", new Float(itemWidth + this.margin));
            this.setTranslationX((this.screenWidth - itemWidth) / 2);
        }
        if (message === "") {
            this.setValue("message", new BrsString(BrsDevice.getTerm("Please wait...")));
        }
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }
}
