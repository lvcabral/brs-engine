import { AAMember, BrsType, Float, Int32 } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { ArrayGrid, Label, SGNodeType } from ".";
import { Panel } from "./Panel";

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
    private readonly labelOffsetX: number;
    private readonly labelOffsetY: number;
    public nextPanelCallback?: (panel: Panel) => void;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.GridPanel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Panel);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.labelOffsetX = 9;
            this.labelOffsetY = 18;
            this.leftLabel = this.addLabel("", [this.labelOffsetX, this.labelOffsetY], 0, 0, 27, "bottom", "left");
            this.rightLabel = this.addLabel("", [this.labelOffsetX, this.labelOffsetY], 0, 0, 27, "bottom", "right");
            this.labelsAreaHeight = 69;
        } else {
            this.labelOffsetX = 6;
            this.labelOffsetY = 12;
            this.leftLabel = this.addLabel("", [this.labelOffsetX, this.labelOffsetY], 0, 0, 18, "bottom", "left");
            this.rightLabel = this.addLabel("", [this.labelOffsetX, this.labelOffsetY], 0, 0, 18, "bottom", "right");
            this.labelsAreaHeight = 46;
        }
        super.setValueSilent("leftLabel", this.leftLabel);
        super.setValueSilent("rightLabel", this.rightLabel);
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
        } else if (["leftlabel", "rightlabel"].includes(fieldName)) {
            return; // Read-only fields; do not set
        } else if (["width", "height"].includes(fieldName)) {
            super.setValue(index, value, alwaysNotify, kind);
            const arrayGrid = this.getValue("arrayGrid");
            if (arrayGrid instanceof ArrayGrid) {
                arrayGrid.setValueSilent(index, value);
            }
            const leftLabel = this.getValue("leftLabel");
            if (leftLabel instanceof Label && fieldName === "width") {
                const width = this.getValueJS("width");
                leftLabel.setValueSilent(index, new Float(width - this.labelOffsetX * 5));
            }
            const rightLabel = this.getValue("rightLabel");
            if (rightLabel instanceof Label && fieldName === "width") {
                const width = this.getValueJS("width");
                rightLabel.setValueSilent(index, new Float(width - this.labelOffsetX * 5));
            }
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

    private onItemFocusChanged(index: number) {
        if (this.getValueJS("createNextPanelOnItemFocus") === true && this.nextPanelCallback) {
            this.setValue("createNextPanelIndex", new Int32(index));
        }
    }
}
