import { ValueKind, BrsValue, BrsBoolean } from "./BrsType";
import { Callable } from "./Callable";

/**
 * A small typed wrapper around a BrightScript Interface.
 *
 * While BrightScript interfaces don't have any direct uses that I've found, their presence is useful in implementing reflection-based logic.
 */
export class BrsInterface implements BrsValue {
    readonly kind = ValueKind.Interface;
    readonly methodNames: Set<string>;

    constructor(readonly name: string, methods: Callable[]) {
        this.methodNames = new Set(methods.filter(m => m.name).map(m => m.name!));
    }

    toString(): string {
        return `<Interface: ${this.name}>`;
    }

    equalTo(other: BrsValue): BrsBoolean {
        // interfaces are never equal to anything (they can't be compared, just like arrays)
        return BrsBoolean.False;
    }
}
