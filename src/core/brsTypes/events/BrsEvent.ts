import { BrsType } from "..";
import { BrsBoolean, BrsValue, ValueKind } from "../BrsType";
import { BrsComponent } from "../components/BrsComponent";

export abstract class BrsEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    constructor(name: string) {
        super(name);
    }
    toString(_parent?: BrsType): string {
        return `<Component: ${this.componentName}>`;
    }

    equalTo(_other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }
}
