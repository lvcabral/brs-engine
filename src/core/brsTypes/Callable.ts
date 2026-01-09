import { Interpreter } from "../interpreter";
import * as Brs from ".";
import * as Expr from "../parser/Expression";
import { Scope } from "../interpreter/Environment";
import { Location } from "../lexer";
import { tryCoerce } from "./Coercion";
import { generateArgumentMismatchError } from "../error/ArgumentMismatch";

let anonCounter = 0;

/** An argument to a BrightScript `function` or `sub`. */
export interface Argument {
    /** Where the argument exists in the parsed source file(s). */
    readonly location: Location;

    /** The argument's name. */
    readonly name: {
        text: string;
        location: Location;
    };

    /** The type of the argument expected by the BrightScript runtime. */
    readonly type: {
        kind: Brs.ValueKind;
        location: Location;
    };

    /** The default value to use for the argument if none is provided. */
    readonly defaultValue?: Expr.Expression;
}

/**
 * A variant of the `Argument` interface intended for use only when creating standard library
 * functions.
 */
export class StdlibArgument implements Argument {
    readonly location: Argument["location"];
    readonly name: Argument["name"];
    readonly type: Argument["type"];
    readonly defaultValue: Argument["defaultValue"];

    /**
     * Creates an `Argument` without requiring locations to be specified.
     * @param name the name of the argument, used for presentation to users
     * @param type the type of value accepted at runtime
     * @param defaultValue the optional default value to use for this argument if one isn't
     *                     provided at runtime
     */
    constructor(name: string, type: Brs.ValueKind, defaultValue?: Brs.BrsType) {
        this.location = StdlibArgument.InternalLocation;
        this.name = { text: name, location: StdlibArgument.InternalLocation };
        this.type = { kind: type, location: StdlibArgument.InternalLocation };
        if (defaultValue) {
            this.defaultValue = new Expr.Literal(defaultValue, StdlibArgument.InternalLocation);
        }
    }

    /** A fake location exists only within the BRS runtime. */
    static readonly InternalLocation = {
        file: "(stdlib)",
        start: { line: -1, column: -1 },
        end: { line: -1, column: -1 },
    };
}

/** A BrightScript `function` or `sub`'s signature. */
export interface Signature {
    /** The set of arguments a function accepts. */
    readonly args: Argument[];
    /** Whether the function accepts a variable number of arguments. */
    readonly variadic?: boolean;
    /** The type of BrightScript value the function will return. `sub`s must use `ValueKind.Void`. */
    readonly returns: Brs.ValueKind;
}

/** A BrightScript function signature paired with its implementation. */
export type SignatureAndImplementation = {
    /** A BrightScript function's signature. */
    signature: Signature;
    /** The implementation corresponding to `signature`. */
    impl: CallableImplementation;
};

type SignatureMismatch = AnonymousMismatch | ArgumentMismatch;
type SignatureSatisfaction = SignatureAndImplementation & {
    readonly coercedArgs: Brs.BrsType[];
    mismatches: SignatureMismatch[];
};

/** A mismatch between a BrightScript function's signature and its received arguments. */
export interface AnonymousMismatch {
    /** The type of mismatch that was received. */
    reason: MismatchReason.TooFewArguments | MismatchReason.TooManyArguments;
    /** The number of arguments that was expected. */
    expected: string;
    /** The number of arguments that was actually received. */
    received: string;
}

/** A mismatch between a function argument's expected type and its runtime type. */
export interface ArgumentMismatch {
    /** The type of mismatch that was received. */
    reason: MismatchReason.ArgumentTypeMismatch;
    /** The BrightScript type that was expected for argument `argName`. */
    expected: string;
    /** The BrightScript type that was actually received. */
    received: string;
    /** The name of the argument that had a type mismatch. */
    argName: string;
}

/** The set of possible reasons why a signature and runtime arguments don't match. */
export enum MismatchReason {
    /** Not enough arguments were provided to satisfy a signature. */
    TooFewArguments,
    /** Too many arguments were provided to satisfy a signature. */
    TooManyArguments,
    /** An argument's type didn't match the signature's type. */
    ArgumentTypeMismatch,
}

/** A BrightScript function's signature, paired with a set of detected signature mismatches. */
export type SignatureAndMismatches = SignatureAndImplementation & {
    /** A copy of the provided arguments, coerced into `signature`'s types if possible. */
    readonly coercedArgs?: Brs.BrsType[];
    /** The set of mismatches between `signature` and the detected mismatches. */
    mismatches: SignatureMismatch[];
};

/*
 * Note that TypeScript's `--strictFunctionTypes` compiler argument prevents the `args` parameter
 * from being typed as `...args: Brs.BrsType[]` here. See
 * https://www.stephanboyer.com/post/132/what-are-covariance-and-contravariance for a wonderful
 * description of why.
 */
/** The function type required for all concrete Callables to provide. */
export type CallableImplementation = (interpreter: Interpreter, ...args: any[]) => Brs.BrsType;

/** A `function` or `sub` (either "native" or implemented in BrightScript) that can be called in a BrightScript file. */
export class Callable implements Brs.BrsValue, Brs.Boxable {
    readonly kind = Brs.ValueKind.Callable;
    inArray: boolean = false;

    /** The name of this function within the BrightScript runtime. */
    readonly name: string | undefined;

    /** The signature of this callable within the BrightScript runtime. */
    readonly signatures: SignatureAndImplementation[];

    /** The context (m) that this callable is running under (if `undefined` is running on root m) */
    private context: Brs.RoAssociativeArray | undefined;

    /** The location where this callable is on the source code */
    private location: Location | undefined;

    /** Whether this callable was defined by the user (as opposed to being a built-in function). */
    private userDefined: boolean = false;

    /**
     * Calls the function this `Callable` represents with the provided `arg`uments using the
     * provided `Interpreter` instance.
     *
     * @param interpreter the interpreter to execute this callable in.
     * @param args the arguments to pass to the callable routine.
     *
     * @returns the return value of the function, or `invalid` if nothing is explicitly returned.
     */
    call(interpreter: Interpreter, ...args: Brs.BrsType[]) {
        let satisfiedSignature = this.getFirstSatisfiedSignature(args);
        if (satisfiedSignature == null) {
            interpreter.addError(generateArgumentMismatchError(this, args, interpreter.location));
        }

        let { signature, impl } = satisfiedSignature;

        let mutableArgs = [...satisfiedSignature.coercedArgs];

        return interpreter.inSubEnv((subInterpreter) => {
            // first, we need to evaluate all of the parameter default values
            // and define them in a new environment
            for (const [index, param] of signature.args.entries()) {
                if (param.defaultValue && mutableArgs[index] == null) {
                    mutableArgs[index] = subInterpreter.evaluate(param.defaultValue);
                }

                subInterpreter.environment.define(
                    Scope.Function,
                    param.name.text,
                    mutableArgs[index],
                    interpreter.location
                );
            }

            // then return whatever the selected implementation would return
            return impl(subInterpreter, ...mutableArgs);
        });
    }

    /**
     * Marks this callable as being defined by the user (as opposed to being a built-in function).
     */
    setUserDefined(): void {
        this.userDefined = true;
    }

    /**
     * Returns whether this callable was defined by the user (as opposed to being a built-in function).
     */
    isUserDefined(): boolean {
        return this.userDefined;
    }

    /**
     * Creates a new BrightScript `function` or `sub`.
     * @param name the name this callable should have within the BrightScript runtime.
     * @param signatures the signatures and associated (JavaScript) implementations this callable should
     *                   have within the BrightScript runtime.
     */
    constructor(name: string | undefined, ...signatures: SignatureAndImplementation[]) {
        this.name = name;
        this.signatures = signatures;
        if (this.signatures.length && (!this.name || this.name === "[Function]")) {
            this.name = `$anon_${++anonCounter}`;
        }
    }

    lessThan(other: Brs.BrsType): Brs.BrsBoolean {
        return Brs.BrsBoolean.False;
    }

    greaterThan(other: Brs.BrsType): Brs.BrsBoolean {
        return Brs.BrsBoolean.False;
    }

    equalTo(other: Brs.BrsType): Brs.BrsBoolean {
        return Brs.BrsBoolean.from(this === other);
    }

    toString(parent?: Brs.BrsType): string {
        return `<Function: ${this.name?.toLowerCase() ?? "UNDEFINED"}>`;
    }

    box() {
        return new Brs.RoFunction(this);
    }

    getName(): string {
        return this.name ?? "";
    }

    getContext() {
        return this.context;
    }

    setContext(context: Brs.RoAssociativeArray) {
        this.context = context;
    }

    setLocation(location: Location) {
        this.location = location;
    }

    getLocation() {
        return this.location;
    }

    /**
     * Attempts to satisfy each signature of this Callable using the provided arguments, coercing arguments into other
     * types where necessary and possible, returning the first satisfied signature and the arguments.
     * @param args - the arguments to satisfy this Callable with
     * @returns the signature, implementation, type mismatches, and coerced arguments for the first encountered
     *          signature satisfied by the provide arguments.
     */
    getFirstSatisfiedSignature(args: Brs.BrsType[]): SignatureSatisfaction | undefined {
        for (let sigAndImpl of this.signatures) {
            let satisfaction = this.trySatisfySignature(sigAndImpl, args);
            if (satisfaction.mismatches.length === 0) {
                return satisfaction;
            }
        }
        return undefined;
    }

    /**
     * Attempts to satisfy each signature of this Callable using the provided arguments, coercing arguments into other
     * types where necessary and possible.
     * @param args - the arguments to satisfy this Callable with
     * @returns the signature, implementation, type mismatches, and coerced arguments for each signature in this
     *          Callable.
     */
    getAllSignatureMismatches(args: Brs.BrsType[]): SignatureSatisfaction[] {
        return this.signatures.map((sigAndImpl) => this.trySatisfySignature(sigAndImpl, args));
    }

    private trySatisfySignature(sigAndImpl: SignatureAndImplementation, args: Brs.BrsType[]): SignatureSatisfaction {
        let { signature, impl } = sigAndImpl;
        let reasons: SignatureMismatch[] = [];
        let requiredArgCount = signature.args.filter((arg) => !arg.defaultValue).length;

        if (args.length < requiredArgCount) {
            reasons.push({
                reason: MismatchReason.TooFewArguments,
                expected: signature.args.length.toString(),
                received: args.length.toString(),
            });
        } else if (!signature.variadic && args.length > signature.args.length) {
            reasons.push({
                reason: MismatchReason.TooManyArguments,
                expected: signature.args.length.toString(),
                received: args.length.toString(),
            });
        }

        let coercedArgs = [...args];
        const argsToCheck = signature.args.slice(0, Math.min(signature.args.length, args.length));
        for (const [index, _value] of argsToCheck.entries()) {
            let expected = signature.args[index];
            let received = args[index];

            let coercedValue = tryCoerce(received, expected.type.kind);
            if (coercedValue === undefined) {
                reasons.push({
                    reason: MismatchReason.ArgumentTypeMismatch,
                    expected: Brs.ValueKind.toString(expected.type.kind),
                    received: Brs.ValueKind.toString(received.kind),
                    argName: expected.name.text,
                });
            } else {
                coercedArgs[index] = coercedValue;
            }
        }

        return {
            signature,
            impl,
            coercedArgs,
            mismatches: reasons,
        };
    }

    /**
     * Creates several copies of the provided signature and implementation pair, simulating variadic types by
     * creating a function that accepts zero args, one that accepts one arg, one that accepts two args, (…).
     *
     * @param signatureAndImpl the base signature and implementation to make variadic
     *
     * @returns an array containing psuedo-variadic versions of the provided signature and implementation
     */
    static variadic(signatureAndImpl: SignatureAndImplementation): SignatureAndImplementation[] {
        let { signature, impl } = signatureAndImpl;
        return [
            signatureAndImpl,
            ...new Array(10).fill(0).map((_, numArgs) => {
                return {
                    signature: {
                        args: [
                            ...signature.args,
                            ...new Array(numArgs)
                                .fill(0)
                                .map((_, i) => new StdlibArgument(`arg${i}`, Brs.ValueKind.Dynamic)),
                        ],
                        returns: signature.returns,
                    },
                    impl: impl,
                };
            }),
        ];
    }
}
