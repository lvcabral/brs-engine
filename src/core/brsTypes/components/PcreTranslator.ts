/**
 * Translates PCRE patterns (what a Roku's `roRegex` compiles) into JavaScript `RegExp` source.
 *
 * Rewrites are done in a single scanner that skips escapes and character classes. Constructs JavaScript
 * lacks and the way each is handled:
 * - inline options `(?i)`, `(?-i)`, `(?i:...)`: a leading `(?flags)` becomes JS flags; anywhere else the
 *   `i`/`m`/`s` options are emulated in the pattern text (letters become `[aA]`, `^`/`$`/`.` are rewritten),
 *   since JS regexp modifiers are not available in every supported runtime. `x` is always emulated;
 * - possessive quantifiers `X*+` and atomic groups `(?>X)` become `(?=(X))\N`, which adds a capture group.
 *   `groupMap` maps the pattern's own group numbers to the compiled ones, so callers can hide the extras;
 * - `(?#...)` comments, `(?P<n>...)`/`(?P=n)` named groups, `\A`, `\z`, `\Z`, `\Q...\E`, POSIX classes
 *   (`[[:digit:]]`), `\p{..}` (compiled with the `u` flag) and `\x{...}`.
 */

export interface PcreTranslation {
    /** Pattern source to hand to `new RegExp()`. */
    source: string;
    /** Flags to hand to `new RegExp()`. */
    flags: string;
    /** `groupMap[n]` is the compiled group number of the pattern's capture group `n` (`groupMap[0]` is `0`). */
    groupMap: number[];
    /** `true` when the compiled pattern has capture groups the original pattern does not. */
    /** Compiled group numbers added by the translation, in ascending order. */
    extraGroups: number[];
    /** `true` when the pattern uses syntax that cannot be translated and is known to be wrong. */
    invalid: boolean;
}

interface State {
    i: boolean;
    m: boolean;
    s: boolean;
    x: boolean;
}

interface Frame {
    state: State;
    start: number;
    groupsBefore: number;
    /** Compiled group number of an atomic group's wrapper. */
    atomic?: number;
}

const posixClasses: Record<string, string> = {
    alpha: "a-zA-Z",
    digit: "0-9",
    alnum: "a-zA-Z0-9",
    upper: "A-Z",
    lower: "a-z",
    space: String.raw`\s`,
    blank: String.raw` \t`,
    punct: String.raw`!-\/:-@\[-` + "`" + String.raw`{-~`,
    print: String.raw`\x20-\x7e`,
    graph: String.raw`\x21-\x7e`,
    cntrl: String.raw`\x00-\x1f\x7f`,
    xdigit: "0-9A-Fa-f",
    word: String.raw`\w`,
    ascii: String.raw`\x00-\x7f`,
};

const negatedPosixClasses: Record<string, string> = {
    digit: String.raw`\D`,
    space: String.raw`\S`,
    word: String.raw`\W`,
};

const syntaxChars = new Set(String.raw`^$\.*+?()[]{}|/`);
const quantifierBraces = /\{\d+(?:,\d*)?\}/y;
const flagGroup = /\(\?([imsxJX]*)(?:-([imsxJX]*))?([:)])/y;
const namedGroup = /\(\?(?:P?<([A-Za-z_]\w*)>|'([A-Za-z_]\w*)')/y;
const hexBrace = /\\x\{([0-9a-fA-F]+)\}/y;
const propertyBrace = /\\([pP])(?:\{(\^?)([^}]*)\}|([A-Za-z]))/y;
const pythonBackReference = /\(\?P=([A-Za-z_]\w*)\)/y;
const namedReference = /\\k(?:\{(\w+)\}|'(\w+)')/y;
const groupPrefix = /\(\?(?:<[=!]|[:=!])?/y;
const digitRun = /\d+/y;
const posixName = /\[:(\^?)([a-z]+):\]/y;
const backReferenceText = /\\(\\|\d+)/g;

const whitespace = /\s/;
const letterOrDigit = /[A-Za-z0-9]/;

/** Returns the other-case counterpart of a single character, or `undefined` when it has none. */
function caseCounterpart(char: string) {
    const lower = char.toLowerCase();
    const upper = char.toUpperCase();
    if (lower === upper || lower.length !== 1 || upper.length !== 1) {
        return undefined;
    }
    return char === lower ? upper : lower;
}

function validProperty(name: string) {
    try {
        new RegExp(String.raw`\p{${name}}`, "u");
        return true;
    } catch {
        return false;
    }
}

interface ClassItem {
    text: string;
    single: boolean;
    literal?: string;
}

class Scanner {
    private out = "";
    private pos = 0;
    private atomStart = -1;
    private atomGroups = 0;
    private jsGroups = 0;
    private state: State;
    private readonly stack: Frame[] = [];
    private readonly synthetic = new Set<number>();
    readonly groupMap = [0];
    needEmulate = false;
    needUnicode = false;
    private invalid = false;

    constructor(
        private readonly pattern: string,
        private readonly baseFlags: string,
        private readonly emulate: boolean,
        private readonly unicode: boolean
    ) {
        this.state = {
            i: baseFlags.includes("i"),
            m: baseFlags.includes("m"),
            s: baseFlags.includes("s"),
            x: baseFlags.includes("x"),
        };
    }

    scan() {
        const p = this.pattern;
        while (this.pos < p.length) {
            const char = p[this.pos];
            if (char === "\\") {
                this.escape();
            } else if (char === "[") {
                this.characterClass();
            } else if (char === "(") {
                this.openGroup();
            } else if (char === ")") {
                this.closeGroup();
            } else if (this.state.x && whitespace.test(char)) {
                this.pos++;
            } else if (this.state.x && char === "#") {
                const newline = p.indexOf("\n", this.pos);
                this.pos = newline === -1 ? p.length : newline + 1;
            } else if (char === "*" || char === "+" || char === "?" || char === "{") {
                this.quantifier();
            } else if (char === "|") {
                this.out += char;
                this.atomStart = -1;
                this.pos++;
            } else if (char === "^" || char === "$" || char === ".") {
                this.anchorOrDot(char);
            } else {
                this.literal(char);
                this.pos++;
            }
        }
    }

    result(): PcreTranslation {
        let flags = this.baseFlags.includes("g") ? "g" : "";
        if (!this.emulate) {
            for (const flag of "ims") {
                if (this.state[flag as keyof State]) {
                    flags += flag;
                }
            }
        }
        if (this.unicode) {
            flags += "u";
        }
        return {
            source: this.out,
            flags,
            groupMap: this.groupMap,
            extraGroups: [...this.synthetic].sort((a, b) => a - b),
            invalid: this.invalid,
        };
    }

    private startAtom() {
        this.atomStart = this.out.length;
        this.atomGroups = this.jsGroups;
    }

    /** Appends one literal character, honoring emulated case-insensitivity and unicode-mode escaping. */
    private literal(char: string, quoted = false) {
        this.startAtom();
        const counterpart = this.emulate && this.state.i ? caseCounterpart(char) : undefined;
        if (counterpart !== undefined) {
            this.out += `[${char}${counterpart}]`;
        } else if (syntaxChars.has(char) && (quoted || (this.unicode && "{}]".includes(char)))) {
            this.out += "\\" + char;
        } else {
            this.out += char;
        }
    }

    private anchorOrDot(char: string) {
        this.pos++;
        if (char === ".") {
            this.startAtom();
            this.out += this.emulate && this.state.s ? String.raw`[\s\S]` : char;
            return;
        }
        this.atomStart = -1;
        if (this.emulate && this.state.m) {
            this.out += char === "^" ? String.raw`(?<![^\n])` : String.raw`(?![^\n])`;
        } else {
            this.out += char;
        }
    }

    private quantifier() {
        const p = this.pattern;
        let text = p[this.pos];
        if (text === "{") {
            quantifierBraces.lastIndex = this.pos;
            const found = quantifierBraces.exec(p);
            if (found === null) {
                this.literal("{");
                this.pos++;
                return;
            }
            text = found[0];
        }
        this.out += text;
        this.pos += text.length;
        if (p[this.pos] === "?") {
            this.out += "?";
            this.pos++;
        } else if (p[this.pos] === "+") {
            this.pos++;
            this.makePossessive();
        }
    }

    /** Rewrites the last (already quantified) atom `X*` as `(?=(X*))\N`. */
    private makePossessive() {
        if (this.atomStart < 0) {
            this.out += "+";
            return;
        }
        const index = this.atomGroups + 1;
        const atom = this.out.slice(this.atomStart).replaceAll(backReferenceText, (all, ref: string) => {
            return ref !== "\\" && Number(ref) >= index ? `\\${Number(ref) + 1}` : all;
        });
        this.insertGroupNumber(index);
        this.out = `${this.out.slice(0, this.atomStart)}(?=(${atom}))\\${index}`;
        this.synthetic.add(index);
    }

    /** Makes room for a new compiled group so that every group from `index` on moves up by one. */
    private insertGroupNumber(index: number) {
        this.jsGroups++;
        for (let n = 1; n < this.groupMap.length; n++) {
            if (this.groupMap[n] >= index) {
                this.groupMap[n]++;
            }
        }
        const shifted = [...this.synthetic].map((n) => (n >= index ? n + 1 : n));
        this.synthetic.clear();
        for (const n of shifted) {
            this.synthetic.add(n);
        }
        for (const frame of this.stack) {
            if (frame.atomic !== undefined && frame.atomic >= index) {
                frame.atomic++;
            }
        }
    }

    private openGroup() {
        const p = this.pattern;
        const frame: Frame = { state: this.state, start: this.out.length, groupsBefore: this.jsGroups };
        if (!p.startsWith("(?", this.pos)) {
            this.addCapture(frame, "(");
            this.pos++;
            return;
        }
        if (p.startsWith("(?#", this.pos)) {
            const close = p.indexOf(")", this.pos);
            this.pos = close === -1 ? p.length : close + 1;
            return;
        }
        namedGroup.lastIndex = this.pos;
        const named = namedGroup.exec(p);
        if (named !== null) {
            this.addCapture(frame, `(?<${named[1] ?? named[2]}>`);
            this.pos += named[0].length;
            return;
        }
        pythonBackReference.lastIndex = this.pos;
        const back = pythonBackReference.exec(p);
        if (back !== null) {
            this.startAtom();
            this.out += `\\k<${back[1]}>`;
            this.pos += back[0].length;
            return;
        }
        if (p.startsWith("(?>", this.pos)) {
            const index = ++this.jsGroups;
            this.synthetic.add(index);
            frame.atomic = index;
            this.out += "(?:(?=(";
            this.stack.push(frame);
            this.atomStart = -1;
            this.pos += 3;
            return;
        }
        flagGroup.lastIndex = this.pos;
        const flags = flagGroup.exec(p);
        if (flags !== null) {
            this.optionGroup(frame, flags);
            return;
        }
        // (?:  (?=  (?!  (?<=  (?<!  and anything JS will validate for itself
        groupPrefix.lastIndex = this.pos;
        const kind = groupPrefix.exec(p)?.[0] ?? "(?";
        this.out += kind;
        this.stack.push(frame);
        this.atomStart = -1;
        this.pos += kind.length;
    }

    private addCapture(frame: Frame, text: string) {
        this.jsGroups++;
        this.groupMap.push(this.jsGroups);
        this.out += text;
        this.stack.push(frame);
        this.atomStart = -1;
    }

    private optionGroup(frame: Frame, found: RegExpExecArray) {
        const [text, on, off = "", terminator] = found;
        this.pos += text.length;
        const next: State = { ...this.state };
        for (const [flags, value] of [
            [on, true],
            [off, false],
        ] as const) {
            for (const flag of flags) {
                if (flag in next) {
                    next[flag as keyof State] = value;
                }
            }
        }
        const engineChange = next.i !== this.state.i || next.m !== this.state.m || next.s !== this.state.s;
        if (engineChange && !this.emulate) {
            const leading = terminator === ")" && this.out === "" && this.stack.length === 0;
            if (!leading) {
                this.needEmulate = true;
                next.i = this.state.i;
                next.m = this.state.m;
                next.s = this.state.s;
            }
        }
        if (terminator === ")") {
            this.state = next;
            return;
        }
        this.out += "(?:";
        this.state = next;
        this.stack.push(frame);
        this.atomStart = -1;
    }

    private closeGroup() {
        this.pos++;
        const frame = this.stack.pop();
        if (frame === undefined) {
            this.out += ")";
            return;
        }
        this.out += frame.atomic === undefined ? ")" : `))\\${frame.atomic})`;
        this.state = frame.state;
        this.atomStart = frame.start;
        this.atomGroups = frame.groupsBefore;
    }

    private escape() {
        const p = this.pattern;
        const next = p[this.pos + 1];
        if (next === undefined) {
            this.out += "\\";
            this.pos++;
            return;
        }
        switch (next) {
            case "A":
                this.zeroWidth(String.raw`(?<![\s\S])`);
                return;
            case "z":
                this.zeroWidth(String.raw`(?![\s\S])`);
                return;
            case "Z":
                this.zeroWidth(String.raw`(?=\n?(?![\s\S]))`);
                return;
            case "Q":
                this.quote(false);
                return;
            case "E":
                this.pos += 2;
                return;
            case "p":
            case "P":
                this.startAtom();
                this.out += this.property();
                return;
            case "x": {
                hexBrace.lastIndex = this.pos;
                const hex = hexBrace.exec(p);
                if (hex !== null) {
                    this.startAtom();
                    this.out += this.codePoint(hex[1], hex[0]);
                    this.pos += hex[0].length;
                    return;
                }
                break;
            }
            case "k": {
                namedReference.lastIndex = this.pos;
                const found = namedReference.exec(p);
                if (found !== null) {
                    this.startAtom();
                    this.out += `\\k<${found[1] ?? found[2]}>`;
                    this.pos += found[0].length;
                    return;
                }
                break;
            }
            default:
                if (next >= "1" && next <= "9") {
                    this.backReference();
                    return;
                }
        }
        this.startAtom();
        if (this.unicode && !letterOrDigit.test(next) && !syntaxChars.has(next)) {
            this.out += next;
        } else {
            this.out += "\\" + next;
        }
        this.pos += 2;
    }

    private zeroWidth(text: string) {
        this.atomStart = -1;
        this.out += text;
        this.pos += 2;
    }

    private backReference() {
        digitRun.lastIndex = this.pos + 1;
        const text = digitRun.exec(this.pattern)![0];
        const number = Number(text);
        this.startAtom();
        this.out += `\\${number < this.groupMap.length ? this.groupMap[number] : text}`;
        this.pos += 1 + text.length;
    }

    /** Handles `\Q...\E` (the cursor is on the backslash); returns the class text when `inClass`. */
    private quote(inClass: boolean): string {
        const p = this.pattern;
        const end = p.indexOf(String.raw`\E`, this.pos + 2);
        const text = p.slice(this.pos + 2, end === -1 ? p.length : end);
        this.pos = end === -1 ? p.length : end + 2;
        if (inClass) {
            let body = "";
            for (const char of text) {
                body += this.classLiteral(char);
            }
            return body;
        }
        for (const char of text) {
            this.literal(char, true);
        }
        return "";
    }

    /** Compiles `\x{...}`; `raw` is returned unchanged when the code point is out of range. */
    private codePoint(hex: string, raw: string) {
        const value = Number.parseInt(hex, 16);
        if (value > 0x10ffff) {
            return raw;
        }
        if (value <= 0xffff) {
            return `\\u${value.toString(16).padStart(4, "0")}`;
        }
        this.needUnicode = true;
        return `\\u{${value.toString(16)}}`;
    }

    /** Compiles `\p{..}`, `\P{..}`, `\p{^..}` and the one-letter `\pL`; the cursor is on the backslash. */
    private property() {
        propertyBrace.lastIndex = this.pos;
        const found = propertyBrace.exec(this.pattern);
        if (found === null) {
            const raw = "\\" + this.pattern[this.pos + 1];
            this.pos += 2;
            return raw;
        }
        this.pos += found[0].length;
        this.needUnicode = true;
        let name = found[3] ?? found[4];
        const negated = (found[1] === "P") !== (found[2] === "^");
        if (name === "L&") {
            name = "LC";
        }
        if (!validProperty(name) && validProperty(`Script=${name}`)) {
            name = `Script=${name}`;
        }
        return `\\${negated ? "P" : "p"}{${name}}`;
    }

    private classLiteral(char: string) {
        const counterpart = this.emulate && this.state.i ? caseCounterpart(char) : undefined;
        const escaped = this.classEscape(char);
        return counterpart === undefined ? escaped : escaped + counterpart;
    }

    private characterClass() {
        const p = this.pattern;
        this.startAtom();
        let j = this.pos + 1;
        const negated = p[j] === "^";
        if (negated) {
            j++;
        }
        let body = "";
        let closed = false;
        while (j < p.length) {
            const char = p[j];
            if (char === "]") {
                j++;
                closed = true;
                break;
            }
            if (char === "[" && p[j + 1] === ":") {
                posixName.lastIndex = j;
                const posix = posixName.exec(p);
                const mapped = posix && (posix[1] ? negatedPosixClasses[posix[2]] : posixClasses[posix[2]]);
                if (posix) {
                    this.invalid ||= !mapped;
                    body += mapped ?? "";
                    j += posix[0].length;
                    continue;
                }
            }
            this.pos = j;
            const item = this.classItem();
            j = this.pos;
            if (item.single && p[j] === "-" && j + 1 < p.length && p[j + 1] !== "]") {
                this.pos = j + 1;
                const end = this.classItem();
                j = this.pos;
                if (!end.single) {
                    body += item.text + String.raw`\-` + end.text;
                } else if (item.literal === undefined || end.literal === undefined) {
                    body += `${this.rangeEnd(item)}-${this.rangeEnd(end)}`;
                } else {
                    body += this.classRange(item.literal, end.literal);
                }
                continue;
            }
            body += item.text;
        }
        this.out += `[${negated ? "^" : ""}${body}${closed ? "]" : ""}`;
        this.pos = j;
    }

    private classRange(from: string, to: string) {
        const range = `${this.classEscape(from)}-${this.classEscape(to)}`;
        if (!this.emulate || !this.state.i) {
            return range;
        }
        const fromOther = caseCounterpart(from);
        const toOther = caseCounterpart(to);
        const sameKind = (a: string, b: string) => (a === a.toLowerCase()) === (b === b.toLowerCase());
        if (fromOther !== undefined && toOther !== undefined && sameKind(from, to)) {
            return `${range}${fromOther}-${toOther}`;
        }
        return range;
    }

    /** Text of a range endpoint: a plain character without its emulated other-case variant. */
    private rangeEnd(item: ClassItem) {
        return item.literal === undefined ? item.text : this.classEscape(item.literal);
    }

    private classEscape(char: string) {
        return String.raw`\]^-[`.includes(char) ? "\\" + char : char;
    }

    /**
     * Reads one class member at the cursor. `single` is set when it stands for exactly one character, so it can
     * start or end a range; `literal` is set when that character was written plainly.
     */
    private classItem(): ClassItem {
        const p = this.pattern;
        const char = p[this.pos];
        if (char !== "\\" || this.pos + 1 >= p.length) {
            this.pos++;
            return { text: this.classLiteral(char), literal: char, single: true };
        }
        const next = p[this.pos + 1];
        if (next === "Q") {
            return { text: this.quote(true), single: false };
        }
        if (next === "E") {
            this.pos += 2;
            return { text: "", single: false };
        }
        if (next === "p" || next === "P") {
            return { text: this.property(), single: false };
        }
        if (next === "x") {
            hexBrace.lastIndex = this.pos;
            const hex = hexBrace.exec(p);
            if (hex !== null) {
                this.pos += hex[0].length;
                return { text: this.codePoint(hex[1], hex[0]), single: true };
            }
        }
        this.pos += 2;
        if (this.unicode && !letterOrDigit.test(next) && !syntaxChars.has(next) && next !== "-") {
            return { text: next, literal: next, single: true };
        }
        return { text: "\\" + next, single: !"dDwWsShHvVRXN".includes(next) };
    }
}

/**
 * Translates a PCRE `pattern` for JavaScript.
 * @param pattern Pattern as passed to CreateObject
 * @param flags Flags to apply: any of `g`, `i`, `m`, `s` (JS) and `x` (free-spacing, handled here)
 */
export function translatePcre(pattern: string, flags: string): PcreTranslation {
    let emulate = false;
    let unicode = false;
    for (;;) {
        const scanner: Scanner = new Scanner(pattern, flags, emulate, unicode);
        scanner.scan();
        if ((scanner.needEmulate && !emulate) || (scanner.needUnicode && !unicode)) {
            emulate ||= scanner.needEmulate;
            unicode ||= scanner.needUnicode;
            continue;
        }
        return scanner.result();
    }
}
