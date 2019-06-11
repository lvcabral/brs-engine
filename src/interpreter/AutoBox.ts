import { BrsType, ValueKind, RoString } from "../brsTypes";

export function autobox(maybeIntrinsic: BrsType) {
    switch (maybeIntrinsic.kind) {
        case ValueKind.String:
            return new RoString(maybeIntrinsic);
        default:
            return maybeIntrinsic;
    }
}
