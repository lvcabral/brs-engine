import { AAMember, BrsType } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
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
        const overhang = SGNodeFactory.createNode(SGNodeType.Overhang);
        const panelSet = SGNodeFactory.createNode(SGNodeType.PanelSet);
        this.setValueSilent("overhang", overhang!);
        this.setValueSilent("panelSet", panelSet!);
        this.appendChildToParent(overhang!);
        this.appendChildToParent(panelSet!);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (["overhang", "panelset"].includes(fieldName)) {
            return; // Read-only fields; do not set
        }
        super.setValue(index, value, alwaysNotify, kind);
    }
}
