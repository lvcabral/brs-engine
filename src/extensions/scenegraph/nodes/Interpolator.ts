import { AAMember, BrsType } from "brs-engine";
import { Node } from "./Node";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";

export abstract class Interpolator extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "fieldToInterp", type: "string" },
        { name: "key", type: "floatarray", value: "[]" },
        { name: "fraction", type: "float", value: "0.0" },
        { name: "reverse", type: "boolean", value: "false" },
    ];

    constructor(members: AAMember[] = [], name: string = SGNodeType.Node) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    abstract interpolate(fraction: number): BrsType | undefined;

    protected resolveSegment(fraction: number): { index: number; localT: number } {
        const keys = this.getKeyframes();
        const normalized = this.normalizeFraction(fraction);

        if (keys.length < 2) {
            return { index: 0, localT: normalized };
        }

        if (normalized <= keys[0]) {
            return { index: 0, localT: 0 };
        }

        const lastIndex = keys.length - 1;
        if (normalized >= keys[lastIndex]) {
            return { index: lastIndex - 1, localT: 1 };
        }

        for (let i = 0; i < lastIndex; i++) {
            const start = keys[i];
            const end = keys[i + 1];
            if (normalized >= start && normalized <= end) {
                const span = end - start;
                const localT = span === 0 ? 0 : (normalized - start) / span;
                return { index: i, localT };
            }
        }

        return { index: lastIndex - 1, localT: 1 };
    }

    protected getKeyframes(): number[] {
        const key = this.getValueJS("key");
        return Array.isArray(key) ? key : [];
    }

    private normalizeFraction(fraction: number): number {
        const clamped = Math.min(Math.max(fraction, 0), 1);
        return this.getValueJS("reverse") ? 1 - clamped : clamped;
    }
}
