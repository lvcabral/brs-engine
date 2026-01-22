import { AAMember, BrsType } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { PanelSet, Panel, SGNodeType, Overhang } from ".";
import { Scene } from "./Scene";
import { SGNodeFactory } from "../factory/NodeFactory";

export class OverhangPanelSetScene extends Scene {
    readonly defaultFields: FieldModel[] = [
        { name: "overhang", type: "node" },
        { name: "panelSet", type: "node" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.OverhangPanelSetScene) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Scene);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        const overhang = SGNodeFactory.createNode(SGNodeType.Overhang) as Overhang;
        const panelSet = SGNodeFactory.createNode(SGNodeType.PanelSet) as PanelSet;
        panelSet.focusedPanelCallback = this.onFocusedPanel.bind(this);
        this.setValueSilent("overhang", overhang);
        this.setValueSilent("panelSet", panelSet);
        this.appendChildToParent(overhang);
        this.appendChildToParent(panelSet);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (["overhang", "panelset"].includes(fieldName)) {
            return; // Read-only fields; do not set
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setInitState(state: "initializing" | "initialized") {
        super.setInitState(state);
        if (state === "initialized") {
            const panelSet = this.getValue("panelSet") as PanelSet;
            panelSet.setNodeFocus(true);
        }
    }

    private onFocusedPanel(panel: Panel) {
        const overhang = this.getValue("overhang") as Overhang;
        overhang.setValueSilent("optionsAvailable", panel.getValue("optionsAvailable"));
        if (panel.getValueJS("leftOrientation") === true) {
            overhang.setValueSilent("visible", panel.getValue("overhangVisible"));
            overhang.setValueSilent("title", panel.getValue("overhangTitle"));
            overhang.setValueSilent("clockText", panel.getValue("clockText"));
        }
    }
}
