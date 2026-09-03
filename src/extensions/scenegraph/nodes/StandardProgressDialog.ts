import { AAMember, BrsDevice, BrsString, IfDraw2D, Interpreter } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { StandardDialog } from "./StandardDialog";
import { StdDlgTitleArea } from "./StdDlgTitleArea";
import { StdDlgContentArea } from "./StdDlgContentArea";
import { StdDlgProgressItem } from "./StdDlgProgressItem";

/**
 * StandardProgressDialog — shows a spinning progress indicator with a short message (Roku's
 * replacement for the legacy ProgressDialog). Comprised of an optional StdDlgTitleArea and a
 * StdDlgContentArea containing a StdDlgProgressItem. Layout/centering is handled by StandardDialog.
 */
export class StandardProgressDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "string", value: "" },
    ];
    private readonly progressItem: StdDlgProgressItem;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardProgressDialog) {
        super([], name);
        this.setExtendsType(SGNodeType.StandardProgressDialog, SGNodeType.StandardDialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const titleArea = new StdDlgTitleArea();
        this.appendChildToParent(titleArea);
        this.linkField(titleArea, "primaryTitle", "title");

        const contentArea = new StdDlgContentArea();
        this.progressItem = new StdDlgProgressItem();
        contentArea.appendChildToParent(this.progressItem);
        this.appendChildToParent(contentArea);
        this.linkField(this.progressItem, "text", "message");
    }

    /**
     * Applies the default message before StandardDialog lays the dialog out — the message drives the
     * content height, which the layout then sizes and recenters the dialog from.
     */
    protected prepareRender(draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        if ((this.getValueJS("message") as string) === "") {
            this.setValue("message", new BrsString(BrsDevice.getTerm("Please wait...")));
        }
        super.prepareRender(draw2D);
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        super.renderNodeContent(interpreter, origin, angle, opacity, draw2D);
    }
}
