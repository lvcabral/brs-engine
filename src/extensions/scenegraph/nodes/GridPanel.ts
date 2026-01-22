import { AAMember, BrsType, Int32 } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { ArrayGrid, Label, MarkupGrid, PosterGrid, SGNodeType } from ".";
import { Panel, PanelSizeValue } from "./Panel";

export class GridPanel extends Panel {
    readonly defaultFields: FieldModel[] = [
        { name: "arrayGrid", type: "node" },
        { name: "grid", type: "node" },
        { name: "list", type: "node" },
        { name: "leftLabel", type: "node" },
        { name: "rightLabel", type: "node" },
        { name: "reuseRightPanel", type: "boolean", value: "false" },
        { name: "showSectionLabels", type: "boolean", value: "false" },
        { name: "createNextPanelIndex", type: "integer", value: "-1" },
        { name: "nextPanel", type: "node" },
        { name: "createNextPanelOnItemFocus", type: "boolean", value: "true" },
    ];
    private readonly leftLabel: Label;
    private readonly rightLabel: Label;
    private readonly labelsAreaHeight: number;
    public nextPanelCallback?: (panel: Panel) => void;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.GridPanel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Panel);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.leftLabel = this.addLabel("", [0, 0], 0, 0, 27, "top", "left");
            this.rightLabel = this.addLabel("", [0, 0], 0, 0, 27, "top", "right");
            this.labelsAreaHeight = 69;
        } else {
            this.leftLabel = this.addLabel("", [0, 0], 0, 0, 18, "top", "left");
            this.rightLabel = this.addLabel("", [0, 0], 0, 0, 18, "top", "right");
            this.labelsAreaHeight = 46;
        }
        this.setValueSilent("leftLabel", this.leftLabel);
        this.setValueSilent("rightLabel", this.rightLabel);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (["arrayGrid", "grid", "list"].includes(fieldName)) {
            if (!(value instanceof ArrayGrid)) {
                return; // Invalid node type; do not set
            }
            value.setTranslationY(this.labelsAreaHeight);
            value.setValueSilent("width", this.getValue("width"));
            value.setValueSilent("height", this.getValue("height"));
            super.setValue("arrayGrid", value, alwaysNotify, kind);
            super.setValue("grid", value, alwaysNotify, kind);
            super.setValue("list", value, alwaysNotify, kind);
            value.itemFocusCallback = this.onItemFocusChanged.bind(this);
            return;
        } else if (fieldName === "nextpanel") {
            const hasNextPanel = this.getValueJS("hasNextPanel") === true;
            if (hasNextPanel && value instanceof Panel && this.nextPanelCallback) {
                this.nextPanelCallback(value);
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setNodeFocus(focusOn: boolean): boolean {
        const arrayGrid = this.getValue("arrayGrid");
        if (arrayGrid instanceof ArrayGrid) {
            return arrayGrid.setNodeFocus(focusOn);
        }
        return super.setNodeFocus(focusOn);
    }

    protected setSizeAndPosition(sizeValue: PanelSizeValue) {
        super.setSizeAndPosition(sizeValue);
        const grid = this.getValue("arrayGrid");
        if (grid instanceof PosterGrid || grid instanceof MarkupGrid) {
            grid.setValueSilent("width", this.getValue("width"));
            grid.setValueSilent("height", this.getValue("height"));
        }
    }

    private onItemFocusChanged(index: number) {
        if (this.getValueJS("createNextPanelOnItemFocus") === true && this.nextPanelCallback) {
            this.setValue("createNextPanelIndex", new Int32(index));
        }
    }
}
