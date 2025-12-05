import { ValueKind, BrsValue, BrsBoolean } from "../BrsType";

/**
 * A small typed wrapper around a BrightScript Interface.
 *
 * While BrightScript interfaces don't have any direct uses that I've found, their presence is useful in implementing reflection-based logic.
 */
export class BrsInterface implements BrsValue {
    readonly kind = ValueKind.Interface;
    readonly methodNames: Set<string>;

    constructor(readonly name: string, methods: Set<string>) {
        this.methodNames = new Set(Array.from(methods).map((method) => method.toLowerCase()));
    }

    getInterfaceName(): string {
        return this.name;
    }

    hasMethod(method: string): boolean {
        return this.methodNames.has(method.toLowerCase());
    }

    toString(): string {
        return `<Interface: ${this.name}>`;
    }

    equalTo(other: BrsValue): BrsBoolean {
        // interfaces are never equal to anything (they can't be compared, just like arrays)
        return BrsBoolean.False;
    }
}
