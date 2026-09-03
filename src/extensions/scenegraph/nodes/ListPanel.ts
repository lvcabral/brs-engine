import { AAMember } from "brs-engine";
import { SGNodeType } from ".";
import { GridPanel } from "./GridPanel";

export class ListPanel extends GridPanel {
    // ListPanel has the same fields and behavior as GridPanel, but per Roku's docs it is
    // documented as extending Panel directly - GridPanel is only this engine's implementation
    // reuse, not the public hierarchy, so register the documented relationship explicitly rather
    // than relying on GridPanel's own (GridPanel -> Panel) registration to "leak through".
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ListPanel) {
        super([], name);
        this.setExtendsType(SGNodeType.ListPanel, SGNodeType.Panel);
        this.registerInitializedFields(initializedFields);
    }
}
