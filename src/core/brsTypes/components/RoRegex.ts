import { BrsBoolean, BrsInvalid, BrsString, BrsValue, Uninitialized, ValueKind } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isStringComp, RoArray, RoList } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { BrsDevice } from "../../device/BrsDevice";

export class RoRegex extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    // JS RegExp has no native equivalent to the "x" (extended/free-spacing) flag, so it's handled
    // by preprocessing the pattern in translatePattern() rather than being forwarded to new RegExp().
    readonly supportedFlags = "gims";
    private jsRegex: RegExp;
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
        const pattern = RoRegex.translatePattern(expression.getValue(), rawFlags.includes("x"));
        try {
            this.jsRegex = new RegExp(pattern, this.parseFlags(rawFlags));
            this.valid = true;
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
        return pattern.replaceAll("\\", "$");
    }

    private static readonly whitespacePattern = /\s/;

    private static readonly noOpOptionGroup = /\(\?-?\)/y;

    /**
     * Translates PCRE syntax that JS RegExp lacks or rejects, leaving escaped characters and
     * character classes ("[...]") untouched:
     * - drops the empty inline option-setting groups `(?-)` and `(?)`, PCRE no-ops that JavaScript
     *   rejects as "Invalid group";
     * - with `freeSpacing` (the "x" flag, which JS RegExp has no native flag for), drops unescaped
     *   whitespace and "#...newline" comments.
     *
     * Unlike PCRE, JS RegExp has no "leading ']' is literal" convention for character classes, so
     * an unescaped "]" always closes the class here, even immediately after "[" or "[^" - matching
     * how `new RegExp()` will itself interpret the translated pattern.
     * @param pattern Original pattern, as passed to CreateObject
     * @param freeSpacing Whether the "x" flag was passed
     * @returns Pattern to compile with JS RegExp
     */
    private static translatePattern(pattern: string, freeSpacing: boolean): string {
        let result = "";
        let inClass = false;
        let i = 0;
        while (i < pattern.length) {
            const char = pattern[i];
            if (char === "\\" && i + 1 < pattern.length) {
                result += char + pattern[i + 1];
                i += 2;
                continue;
            }
            if (inClass) {
                inClass = char !== "]";
                result += char;
                i++;
                continue;
            }
            RoRegex.noOpOptionGroup.lastIndex = i;
            if (RoRegex.noOpOptionGroup.test(pattern)) {
                i = RoRegex.noOpOptionGroup.lastIndex;
                continue;
            }
            i++;
            if (freeSpacing && RoRegex.whitespacePattern.test(char)) {
                continue;
            }
            if (freeSpacing && char === "#") {
                const newline = pattern.indexOf("\n", i);
                i = newline === -1 ? pattern.length : newline + 1;
                continue;
            }
            inClass = char === "[";
            result += char;
        }
        return result;
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
                arr.push(
                    new RoArray(matches.filter((match) => match !== undefined).map((match) => new BrsString(match)))
                );
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
