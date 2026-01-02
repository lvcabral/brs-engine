import { BrsBoolean, BrsString, BrsValue, ValueKind } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray, RoList } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoRegex extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    // 'x' flag is not implemented yet.
    readonly supportedFlags = "gims";
    private jsRegex: RegExp;

    constructor(expression: BrsString, flags = new BrsString("")) {
        super("roRegex");
        this.jsRegex = new RegExp(expression.getValue(), this.parseFlags(flags.getValue()));

        this.registerMethods({
            ifRegex: [this.isMatch, this.match, this.replace, this.replaceAll, this.split, this.matchAll],
        });
    }

    toString(parent?: BrsType) {
        return "<Component: roRegex>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /**
     * Checks and parses the flags to avoid passing flags
     * that are not supported
     * @param inputFlags Flags passed to constructor
     * @returns parsed flags
     */
    private parseFlags(inputFlags: string): string {
        let parsedFlags = "";
        if (inputFlags.length === 0) {
            return parsedFlags;
        }
        for (const flag of inputFlags) {
            if (this.supportedFlags.includes(flag)) {
                parsedFlags += flag;
            }
        }
        return parsedFlags;
    }

    /**
     * Transforms positional pattern replacements to javascript syntax
     * by replacing backslashes with dollar symbols
     * @param pattern Pattern to replace
     * @returns Replaced string
     */
    private parseReplacementPattern(pattern: string): string {
        return pattern.replace(/\\/g, "$");
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
                arr = result.map((match) => new BrsString(match || ""));
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
            const newStr = this.jsRegex[Symbol.replace](str.value, replacement.value);

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
            let brsItems = items.map((item) => new BrsString(item));
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
                arr.push(
                    new RoArray(matches.filter((match) => match !== undefined).map((match) => new BrsString(match)))
                );
            }
            return new RoArray(arr);
        },
    });
}
