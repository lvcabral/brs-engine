import type { BrsType } from ".";
import { ValueKind, PrimitiveKinds, isNumberKind, isBrsNumber, BrsComponent, BrsBoolean } from ".";
import { isBoxable, isUnboxable } from "./Boxing";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { Double } from "./Double";

export function tryCoerce(value: BrsType, target: ValueKind): BrsType | undefined {
    if (value.kind === target || target === ValueKind.Dynamic) {
        // `value` is already the correct type; return it immediately
        return value;
    }

    if (target === ValueKind.Object) {
        if (isBoxable(value)) {
            // boxable types should be promoted to their boxed equivalents whenever possible,
            // with their boxed equivalents coerced if necessary
            return tryCoerce(value.box(), target);
        } else if (value instanceof BrsComponent) {
            // types that are always objects should be returned unmodified
            return value;
        }
    }

    if (PrimitiveKinds.has(target) && isUnboxable(value)) {
        // unboxable types should be demoted to their unboxed equivalents whenever possible,
        // with their unboxed equivalents coerced if necessary
        return tryCoerce(value.unbox(), target);
    }

    // numeric types can be cast between each other
    if (isNumberKind(target) && isBrsNumber(value)) {
        switch (target) {
            case ValueKind.Int32:
                return new Int32(value.getValue());
            case ValueKind.Int64:
                return new Int64(value.getValue());
            case ValueKind.Float:
                return new Float(value.getValue());
            case ValueKind.Double:
                return new Double(value.getValue());
        }
    } else if (target === ValueKind.Boolean && isBrsNumber(value)) {
        // numeric types can be cast to boolean
        return BrsBoolean.from(value.toBoolean());
    }

    // everything else is uncastable; return `undefined` to represent that
    return;
}
