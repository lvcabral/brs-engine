import { BrsType } from "../brsTypes";
import type { TracePoint } from "../interpreter";
import type { Location } from "../lexer";

export class BrsError extends Error {
    constructor(message: string, readonly location: Location, public backTrace?: TracePoint[]) {
        super(message);
    }

    /**
     * Formats the error into a human-readable string including filename, starting and ending line
     * and column, and the message associated with the error, e.g.:
     *
     * `lorem.brs(1,1-3): Expected '(' after sub name`
     * @see BrsError#format
     */
    format() {
        return BrsError.format(this.message, this.location);
    }

    /**
     * Formats a location and message into a human-readable string including filename, starting
     * and ending line and column, and the message associated with the error, e.g.:
     *
     * `lorem.brs(1,1-3): Expected '(' after sub name`
     *
     * @param message a string describing the error
     * @param location where the error occurred
     */
    static format(message: string, location: Location): string {
        let formattedLocation: string;

        if (location.start.line === location.end.line) {
            let columns = `${location.start.column}`;
            if (location.start.column !== location.end.column) {
                columns += `-${location.end.column}`;
            }
            formattedLocation = `${location.file}(${location.start.line},${columns})`;
        } else {
            formattedLocation = `${location.file}(${location.start.line},${location.start.column},${location.end.line},${location.end.line})`;
        }

        return `${formattedLocation}: ${message}`;
    }
}

/** An error thrown when a BrightScript runtime error is encountered. */
export class RuntimeError extends BrsError {
    constructor(
        readonly errorDetail: ErrorDetail,
        location: Location,
        readonly backTrace?: TracePoint[],
        readonly extraFields?: Map<string, BrsType>
    ) {
        super(errorDetail.message, location, backTrace);
    }
}

/** Any error detail provided by the reference brightscript implementation. */
export type ErrorDetail = {
    /** The unique ID of the error. */
    errno: number;
    /** The human-readable version */
    message: string;
};

/**
 * Function to find the error detail by the errno
 * @param errno number of the error code
 * @returns the error detail object
 */
export function findErrorDetail(errno: number): ErrorDetail | null {
    for (const [_, value] of Object.entries(RuntimeErrorDetail)) {
        if (value.errno === errno) {
            return value;
        }
    }
    return null;
}

/** Enumerator with the RBI Runtime Error codes */
export const RuntimeErrorDetail = {
    NextWithoutFor: {
        errno: 0,
        message: "Next Without For.",
    },
    BadSyntax: {
        message: "Syntax Error.",
        errno: 2,
    },
    ReturnedWithoutGosub: {
        message: "Return Without Gosub.",
        errno: 4,
    },
    OutOfData: {
        message: "Out of Data on READ.",
        errno: 6,
    },
    BadFunctionOrArrayParam: {
        message: "Invalid parameter passed to function/array (e.g neg matrix dim or sqr root).",
        errno: 8,
    },
    OutOfMemory: {
        message: "Out Of Memory.",
        errno: 12,
    },
    MissingLineNumber: {
        message: "Label/Line Not Found.",
        errno: 14,
    },
    IndexOutOfBounds: {
        message: "Array subscript out of bounds.",
        errno: 16,
    },
    RedimensionArray: {
        message: "Attempted to redimension an array.",
        errno: 18,
    },
    DivideByZero: {
        message: "Divide by Zero.",
        errno: 20,
    },
    TypeMismatch: {
        message: "Type Mismatch.",
        errno: 24,
    },
    OutOfMemoryStringOp: {
        message: "Out of Memory when doing string operation.",
        errno: 26,
    },
    StringTooLong: {
        message: "String Too Long.",
        errno: 28,
    },
    BadBitShift: {
        message: "Invalid Bitwise Shift.",
        errno: 30,
    },
    NoContinue: {
        message: "Continue Not Allowed.",
        errno: 32,
    },
    OutOfRange: {
        message: "Constant Out Of Range",
        errno: 34,
    },
    ExecutionTimeout: {
        message: "Execution timeout",
        errno: 35,
    },
    InvalidFormatSpecifier: {
        message: "Invalid Format Specifier",
        errno: 36,
    },
    MalformedThrow: {
        message: "Invalid argument to Throw",
        errno: 38,
    },
    UserDefined: {
        message: "User-specified exception",
        errno: 40,
    },
    TooManyTasks: {
        message: "Too many task threads",
        errno: 41,
    },
    RunNotSupported: {
        message: "run() is unsupported.",
        errno: 140,
    },
    ContinueForWithoutFor: {
        message: "Continue For is not inside a For loop",
        errno: 141,
    },
    ContinueWhileWithoutWhile: {
        message: "Continue While is not inside a While",
        errno: 142,
    },
    TryContainsLabel: {
        message: "Labels are illegal inside a TRY clause.",
        errno: 143,
    },
    EvalDisabled: {
        message: "eval() is deprecated. You must eliminate usage of eval().",
        errno: 144,
    },
    FunctionNotFound: {
        message: "Function is not defined in component's namespace",
        errno: 145,
    },
    NameShadowsBuiltin: {
        message: "Syntax Error. Builtin function call expected.",
        errno: 157,
    },
    VarShadowsFunctionName: {
        message: "Variable name cannot be the same as that of a declared function.",
        errno: 160,
    },
    LabelLimitExceeded: {
        message: "Too Many Labels. Internal Label table size exceeded.",
        errno: 161,
    },
    ClassNotFound: {
        message: "Class Not Found.",
        errno: 162,
    },
    InterfaceTooLarge: {
        message: "Interface has too many functions for bytecode.",
        errno: 163,
    },
    NoInitializer: {
        message: "Assignment initializer missing.",
        errno: 164,
    },
    ExitForWithoutFor: {
        message: "Exit For is not inside a For loop.",
        errno: 165,
    },
    Deprecated: {
        message: "Statement type no longer supported.",
        errno: 166,
    },
    BadType: {
        message: "Type is Invalid.",
        errno: 167,
    },
    MissingReturnType: {
        message: "Function must have a return type.",
        errno: 168,
    },
    ReturnWithoutValue: {
        message: "Return must return a value.",
        errno: 169,
    },
    ReturnWithValue: {
        message: "Return can not have a return-value if inside a Sub or Function with Void return type.",
        errno: 170,
    },
    TypeMismatchForEachIndex: {
        message: "For-Each index variable must be 'dynamic' type.",
        errno: 171,
    },
    MissingMainFunction: {
        message: "No Main() Found.",
        errno: 172,
    },
    DuplicateSub: {
        message: "SUB or FUNCTION defined twice.",
        errno: 173,
    },
    LimitExceeded: {
        message: "Internal limit size exceeded.",
        errno: 174,
    },
    ExitWhileWithoutWhile: {
        message: "Exit While is not inside a While.",
        errno: 175,
    },
    TooManyVariables: {
        message: "Variable table size exceeded.",
        errno: 176,
    },
    TooManyConstants: {
        message: "Constant table size exceeded.",
        errno: 177,
    },
    FunctionNotExpected: {
        message: "Function not expected here.",
        errno: 178,
    },
    UnterminatedString: {
        message: `String missing ending quote.`,
        errno: 179,
    },
    DuplicateLabel: {
        message: "Label/LineNumber defined more than once.",
        errno: 180,
    },
    UnterminatedBlock: {
        message: "A block (such as FOR/NEXT or IF/ENDIF) was not terminated correctly.",
        errno: 181,
    },
    BadNext: {
        message: "Variable in NEXT does not match correct FOR.",
        errno: 182,
    },
    EndOfFile: {
        message: "Unexpected End-Of-File.",
        errno: 183,
    },
    CannotReadFile: {
        message: "Error loading file.",
        errno: 185,
    },
    LineNumberSequenceError: {
        message: "Classic BASIC style line number is out of sequence.",
        errno: 186,
    },
    NoLineNumber: {
        message: "Line Number not found where expected.",
        errno: 187,
    },
    IfWithoutEndIf: {
        message: "ENDIF Missing.",
        errno: 189,
    },
    WhileWithoutEndWhile: {
        message: "While Statement is missing a matching EndWhile.",
        errno: 190,
    },
    EndWhileWithoutWhile: {
        message: "EndWhile Without While.",
        errno: 191,
    },
    ExceptionThrownOnStack: {
        message: "UNEXPECTED INTERNAL (Exception on stack)",
        errno: 222,
    },
    StackOverflow: {
        message: "Stack overflow.",
        errno: 223,
    },
    NotAFunction: {
        message: "Function Call Operator ( ) attempted on non-function.",
        errno: 224,
    },
    UnsupportedUnicode: {
        message: "Error: Unicode not supported.",
        errno: 225,
    },
    ValueReturn: {
        message: "Return from non-function.",
        errno: 226,
    },
    BadNumberOfIndexes: {
        message: "Invalid number of Array indexes.",
        errno: 227,
    },
    BadLHS: {
        message: "Invalid value for left-side of expression.",
        errno: 228,
    },
    MissingReturnValue: {
        message: "Function does not have a required return.",
        errno: 229,
    },
    UninitializedFunction: {
        message: "Use of a reference to a function/sub that is not initialized.",
        errno: 230,
    },
    UndimmedArray: {
        message: "Array operation attempted on variable not DIM'd.",
        errno: 231,
    },
    NonNumericArrayIndex: {
        message: "Attempt to use a non-numeric array index not allowed.",
        errno: 232,
    },
    UninitializedVariable: {
        message: "Use of uninitialized variable.",
        errno: 233,
    },
    TypelessOperation: {
        message: "Operation on UnTyped operand(s) attempted.",
        errno: 235,
    },
    DotOnNonObject: {
        message: "'Dot' Operator attempted with invalid BrightScript Component or interface reference.",
        errno: 236,
    },
    NonStaticInterfaceCall: {
        message: "Interface function calls from type rotINTERFACE must by static.",
        errno: 237,
    },
    NotWaitable: {
        message: "Tried to Wait on an BrightScript Component that does not have MessagePort interface.",
        errno: 238,
    },
    NotPrintable: {
        message: "Non printable value.",
        errno: 239,
    },
    ReturnValueIgnored: {
        message: "Function returns a value that is ignored.",
        errno: 240,
    },
    WrongNumberOfParams: {
        message: "Wrong number of function parameters.",
        errno: 241,
    },
    TooManyParams: {
        message: "Too many function parameters (internal limit exceeded).",
        errno: 242,
    },
    InterfaceNotAMember: {
        message: "Interface not a member of BrightScript Component",
        errno: 243,
    },
    MemberFunctionNotFound: {
        message: "Member function not found in BrightScript Component or interface.",
        errno: 244,
    },
    RoWrongNumberOfParams: {
        message: "BrightScript Component function call does not have the correct number of parameters.",
        errno: 245,
    },
    ObjectClassNotFound: {
        message: "BrightScript Component Class not Found.",
        errno: 246,
    },
    Stop: {
        message: "STOP",
        errno: 247,
    },
    Break: {
        message: "BREAK",
        errno: 248,
    },
    StackUnderflow: {
        message: "Stack Underflow.",
        errno: 249,
    },
    MissingParenthesis: {
        message: "Missing Parentheses",
        errno: 250,
    },
    UndefinedOperator: {
        message: "Unsupported expression operator.",
        errno: 251,
    },
    NormalEnd: {
        message: "Normal End.",
        errno: 252,
    },
    UndefinedOpCode: {
        message: "Undefined Op Code.",
        errno: 253,
    },
    Internal: {
        message: "UNEXPECTED INTERNAL.",
        errno: 254,
    },
    Okay: {
        message: "OKAY",
        errno: 255,
    },
};
