import { BrsBoolean, BrsInvalid, BrsString, BrsValue, Uninitialized, ValueKind } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isStringComp, RoArray, RoList } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { BrsDevice } from "../../device/BrsDevice";
import { PcreTranslation, translatePcre } from "./PcreTranslator";

export class RoRegex extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    // JS RegExp has no native equivalent to the "x" (extended/free-spacing) flag, so it's handled
    // by translatePcre() rather than being forwarded to new RegExp().
    private jsRegex: RegExp;
    private readonly translation: PcreTranslation;
    private readonly valid: boolean;

    constructor(expression: BrsType, flags: BrsType = new BrsString("")) {
        super("roRegex");
        if (!isStringComp(expression)) {
            const errorDetail =
                expression instanceof Uninitialized
                    ? RuntimeErrorDetail.UninitializedVariable
                    : RuntimeErrorDetail.TypeMismatch;
            throw new RuntimeError(errorDetail);
        } else if (!isStringComp(flags)) {
            const errorDetail =
                flags instanceof Uninitialized
                    ? RuntimeErrorDetail.UninitializedVariable
                    : RuntimeErrorDetail.TypeMismatch;
            throw new RuntimeError(errorDetail);
        }
        const rawFlags = flags.getValue();
        this.translation = translatePcre(expression.getValue(), rawFlags);
        try {
            this.jsRegex = new RegExp(this.translation.source, this.translation.flags);
            this.valid = !this.translation.invalid;
        } catch {
            // An invalid object is never handed to BrightScript (see createRegex); this never matches.
            this.jsRegex = /(?!)/;
            this.valid = false;
        }

        this.registerMethods({
            ifRegex: [this.isMatch, this.match, this.replace, this.replaceAll, this.split, this.matchAll],
        });
    }

    /** Returns `false` when the pattern did not compile. */
    isValid() {
        return this.valid;
    }

    toString(parent?: BrsType) {
        return "<Component: roRegex>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /**
     * Transforms positional pattern replacements to javascript syntax
     * by replacing backslashes with dollar symbols
     * @param pattern Pattern to replace
     * @returns Replaced string
     */
    private parseReplacementPattern(pattern: string): string {
        const { groupMap, extraGroups } = this.translation;
        if (extraGroups.length === 0) {
            return pattern.replaceAll("\\", "$");
        }
        return pattern.replaceAll(/\\(\d)?/g, (_, digit?: string) =>
            digit === undefined ? "$" : `$${groupMap[Number(digit)] ?? digit}`
        );
    }

    /** The capture groups of a match as the pattern defines them, without the groups added by translation. */
    private userGroups(result: RegExpExecArray): (string | undefined)[] {
        if (this.translation.extraGroups.length === 0) {
            return result;
        }
        return this.translation.groupMap.map((index) => result[index]);
    }

    /** Drops the capture groups added by translation from the pieces `String.split` returns. */
    private withoutExtraGroups(items: string[]): string[] {
        const { extraGroups, groupMap } = this.translation;
        const stride = groupMap.length + extraGroups.length;
        const extra = new Set(extraGroups);
        return items.filter((_, k) => !extra.has(k % stride));
    }

    /** Returns whether the string matched the regex or not */
    private readonly isMatch = new Callable("ismatch", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            return BrsBoolean.from(this.jsRegex.test(str.value));
        },
    });

    /** Returns an array of matches */
    private readonly match = new Callable("match", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, str: BrsString) => {
            const result = this.jsRegex.exec(str.value);
            let arr: BrsString[] = [];
            if (result !== null) {
                arr = this.userGroups(result).map((match) => new BrsString(match || ""));
            }

            return new RoArray(arr);
        },
    });

    /** Returns a new string with first match replaced */
    private readonly replace = new Callable("replace", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String), new StdlibArgument("replacement", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, str: BrsString, replacement: BrsString) => {
            let replacementPattern = this.parseReplacementPattern(replacement.value);
            const newStr = this.jsRegex[Symbol.replace](str.value, replacementPattern);
            return new BrsString(newStr);
        },
    });

    /** Returns a new string with all matches replaced */
    private readonly replaceAll = new Callable("replaceall", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String), new StdlibArgument("replacement", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, str: BrsString, replacement: BrsString) => {
            const source = this.jsRegex.source;
            let flags = this.jsRegex.flags;
            if (!flags.includes("g")) {
                flags += "g";
            }
            this.jsRegex = new RegExp(source, flags);
            const replacementPattern = this.parseReplacementPattern(replacement.value);
            const newStr = this.jsRegex[Symbol.replace](str.value, replacementPattern);

            return new BrsString(newStr);
        },
    });

    /** An roList of substrings of str that were separated by strings which match the pattern in the CreateObject call. */
    private readonly split = new Callable("split", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, str: BrsString) => {
            let items = this.jsRegex[Symbol.split](str.value);
            if (this.translation.extraGroups.length > 0) {
                items = this.withoutExtraGroups(items);
            }
            let brsItems = items.map((item) => new BrsString(item).box());
            return new RoList(brsItems);
        },
    });

    /** Returns an array of array with all matches found */
    private readonly matchAll = new Callable("matchall", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, str: BrsString) => {
            const source = this.jsRegex.source;
            let flags = this.jsRegex.flags;
            if (!flags.includes("g")) {
                flags += "g";
            }
            this.jsRegex = new RegExp(source, flags);
            let arr = [];
            let matches: RegExpExecArray | null;

            while ((matches = this.jsRegex.exec(str.value)) !== null) {
                const groups: BrsString[] = [];
                for (const match of this.userGroups(matches)) {
                    if (match !== undefined) {
                        groups.push(new BrsString(match));
                    }
                }
                arr.push(new RoArray(groups));
            }
            return new RoArray(arr);
        },
    });
}

/**
 * Creates a roRegex for CreateObject. Like the device, an invalid pattern prints an error and
 * returns invalid instead of raising a runtime error.
 */
export function createRegex(interpreter: Interpreter, expression: BrsType, flags: BrsType) {
    const regex = new RoRegex(expression, flags);
    if (regex.isValid()) {
        return regex;
    }
    BrsDevice.stderr.write(`warning,BRIGHTSCRIPT: ERROR: roRegex: Invalid pattern: ${interpreter.formatLocation()}`);
    return BrsInvalid.Instance;
}
