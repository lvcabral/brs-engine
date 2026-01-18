import { AAMember, BrsType } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { ArrayGrid, Label, MarkupGrid, PosterGrid, SGNodeType } from ".";
import { Panel, PanelSizeValue } from "./Panel";

const LabelsAreaHeightHD = 46;

export class GridPanel extends Panel {
    readonly defaultFields: FieldModel[] = [
        { name: "arrayGrid", type: "node" },
        { name: "grid", type: "node" },
        { name: "list", type: "node" },
        { name: "leftLabel", type: "node" },
        { name: "rightLabel", type: "node" },
        { name: "reuseRightPanel", type: "boolean", value: "false" },
        { name: "showSectionLabels", type: "boolean", value: "false" },
        { name: "createNextPanelIndex", type: "integer" },
        { name: "nextPanel", type: "node" },
        { name: "createNextPanelOnItemFocus", type: "boolean", value: "true" },
    ];
    private readonly leftLabel: Label;
    private readonly rightLabel: Label;
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.GridPanel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Panel);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.leftLabel = this.addLabel("", [0, 0], 0, 0, 27, "top", "left");
            this.rightLabel = this.addLabel("", [0, 0], 0, 0, 27, "top", "right");
        } else {
            this.leftLabel = this.addLabel("", [0, 0], 0, 0, 18, "top", "left");
            this.rightLabel = this.addLabel("", [0, 0], 0, 0, 18, "top", "right");
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
            value.setTranslationY(this.resolution === "HD" ? LabelsAreaHeightHD : LabelsAreaHeightHD * 1.5);
            value.setValueSilent("width", this.getValue("width"));
            value.setValueSilent("height", this.getValue("height"));
            super.setValue("arrayGrid", value, alwaysNotify, kind);
            super.setValue("grid", value, alwaysNotify, kind);
            super.setValue("list", value, alwaysNotify, kind);
            return;
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
}
