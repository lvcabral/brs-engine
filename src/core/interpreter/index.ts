import * as core from "..";
import { EventEmitter } from "events";
import {
    BrsType,
    BrsBoolean,
    BrsNumber,
    BrsString,
    BrsComponent,
    BrsInvalid,
    ValueKind,
    isBrsNumber,
    isBrsString,
    isBrsBoolean,
    isBrsCallable,
    isIterable,
    isComparable,
    isBoxable,
    isUnboxable,
    isNumberComp,
    isAnyNumber,
    isStringComp,
    isBoxedNumber,
    PrimitiveKinds,
    Callable,
    Int32,
    Int64,
    Float,
    Uninitialized,
    RoArray,
    RoByteArray,
    RoList,
    RoAssociativeArray,
    RoXMLElement,
    RoXMLList,
    RoFunction,
    Signature,
    BrsInterface,
    toAssociativeArray,
    isCollection,
} from "../brsTypes";
import { BrsExtension, isSceneGraphNode } from "../extensions";
import { tryCoerce } from "../brsTypes/Coercion";
import { Lexeme, GlobalFunctions } from "../lexer";
import { isToken, Location } from "../lexer/Token";
import { Expr, Stmt } from "../parser";
import { BrsDevice } from "../device/BrsDevice";
import { OutputProxy } from "../device/OutputProxy";
import { BrsError, RuntimeError, RuntimeErrorDetail, findErrorDetail, ErrorDetail } from "../error/BrsError";
import { TypeMismatch } from "../error/TypeMismatch";
import { generateArgumentMismatchError } from "../error/ArgumentMismatch";
import * as StdLib from "../stdlib";
import Long from "long";
import { Scope, Environment, NotFound } from "./Environment";
import { toCallable } from "./BrsFunction";
import { runDebugger } from "./MicroDebugger";
import { DataType, DebugCommand, DefaultSounds, numberToHex, parseTextFile } from "../common";
/// #if !BROWSER
import * as v8 from "node:v8";
/// #endif

/** The set of options used to configure an interpreter's execution. */
export interface ExecutionOptions {
    root?: string;
    ext?: string;
    entryPoint?: boolean;
    stopOnCrash?: boolean;
    /** The stdout stream that brs should use. Default: process.stdout. */
    stdout: NodeJS.WriteStream;
    /** The stderr stream that brs should use. Default: process.stderr. */
    stderr: NodeJS.WriteStream;
    /** If enabled makes OutputProxy print output via postMessage(). Default: true */
    post: boolean;
}

/** The default set of execution options.  */
export const defaultExecutionOptions: ExecutionOptions = {
    entryPoint: false,
    stopOnCrash: false,
    stdout: process.stdout,
    stderr: process.stderr,
    post: true,
};

/** The definition of a trace point to be added to the stack trace */
export interface TracePoint {
    functionName: string;
    functionLocation: Location;
    callLocation: Location;
    signature: Signature;
}

export class Interpreter implements Expr.Visitor<BrsType>, Stmt.Visitor<BrsType> {
    private readonly _stack = new Array<TracePoint>();
    private readonly _startTime = Date.now();
    private readonly _creationTime = process.env.CREATION_TIME;
    private _environment: Environment;
    private _sourceMap = new Map<string, string>();
    private _runParams: RoAssociativeArray | undefined;
    private _tryMode = false;
    private _dotLevel = 0;
    private _printed = false; // Prevent the warning when no entry point exists

    location: Location = {
        file: "",
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
    };

    static readonly InternalLocation = {
        file: "(internal)",
        start: { line: -1, column: -1 },
        end: { line: -1, column: -1 },
    };

    readonly options: ExecutionOptions = defaultExecutionOptions;
    readonly manifest: Map<string, string> = new Map<string, string>();
    readonly translations: Map<string, string> = new Map<string, string>();
    readonly extensions: Map<string, BrsExtension> = new Map<string, BrsExtension>();

    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();

    /** The set of errors detected from executing an AST. */
    errors: (BrsError | RuntimeError)[] = [];

    get environment() {
        return this._environment;
    }

    get sourceMap() {
        return this._sourceMap;
    }

    get runParams() {
        return this._runParams;
    }

    get stack() {
        return this._stack;
    }

    get startTime() {
        return this._startTime;
    }

    get creationTime() {
        return this._creationTime;
    }

    // Micro Debugger state properties
    public debugMode: boolean = false;
    public stepMode: boolean = false;
    public exitMode: boolean = false;
    private lastStmt: Stmt.Statement | null = null;

    /**
     * Adds a TracePoint to the call stack.
     * @param tracePoint The TracePoint to add to the stack
     */
    addToStack(tracePoint: TracePoint) {
        if (!this.exitMode) this._stack.push(tracePoint);
    }

    /**
     * Removes the top TracePoint from the call stack.
     */
    popFromStack() {
        if (!this.exitMode) this._stack.pop();
    }

    /**
     * Updates the interpreter manifest with the provided data.
     * @param manifest Map with manifest content
     */
    public setManifest(manifest: Map<string, string>) {
        // Reset custom manifest flags to default
        BrsDevice.singleKeyEvents = true;
        BrsDevice.useCORSProxy = true;
        // Load manifest entries
        for (const [key, value] of manifest.entries()) {
            this.manifest.set(key, value);
            // Custom manifest entries
            if (key.toLowerCase() === "multi_key_events") {
                BrsDevice.singleKeyEvents = value.trim() !== "1";
            } else if (key.toLowerCase() === "cors_proxy") {
                BrsDevice.useCORSProxy = value.trim() !== "0";
            }
        }
        // Reset sound effects
        BrsDevice.sfx.length = 0;
        BrsDevice.sfx.push(...DefaultSounds.slice());
    }

    /**
     * Convenience function to subscribe to the `err` events emitted by `interpreter.events`.
     * @param errorHandler the function to call for every runtime error emitted after subscribing
     * @returns an object with a `dispose` function, used to unsubscribe from errors
     */
    public onError(errorHandler: (err: BrsError | RuntimeError) => void) {
        this.events.on("err", errorHandler);
        return {
            dispose: () => {
                this.events.removeListener("err", errorHandler);
            },
        };
    }

    /**
     * Convenience function to subscribe to a single `err` event emitted by `interpreter.events`.
     * @param errorHandler the function to call for the first runtime error emitted after subscribing
     */
    public onErrorOnce(errorHandler: (err: BrsError | RuntimeError) => void) {
        this.events.once("err", errorHandler);
    }

    /**
     * Creates a new Interpreter, including any global properties and functions.
     * @param options configuration for the execution
     */
    constructor(options?: Partial<ExecutionOptions>) {
        this._environment = new Environment(new RoAssociativeArray([]));
        Object.assign(this.options, options);
        BrsDevice.stdout = new OutputProxy(this.options.stdout, this.options.post);
        BrsDevice.stderr = new OutputProxy(this.options.stderr, this.options.post);
        if (this.options.root) {
            BrsDevice.fileSystem.setRoot(this.options.root);
        }
        if (this.options.ext) {
            BrsDevice.fileSystem.setExt(this.options.ext);
        }
        const global = new Set<string>();
        const filteredFunctions = Object.keys(StdLib)
            .map((name) => (StdLib as any)[name])
            .filter((func) => func instanceof Callable)
            .filter((func: Callable) => {
                if (!func.name) {
                    throw new Error("Unnamed standard library function detected!");
                }

                return !!func.name;
            });
        for (const func of filteredFunctions) {
            this._environment.define(Scope.Global, func.name ?? "", func);
            if (func.name && GlobalFunctions.has(func.name)) {
                global.add(func.name);
            }
        }
        this._environment.define(Scope.Global, "global", new BrsInterface("ifGlobal", global));
    }

    /**
     * Temporarily sets an interpreter's environment to the provided one, then
     * passes the sub-interpreter to the provided JavaScript function. Always
     * reverts the current interpreter's environment to its original value.
     * @param func The JavaScript function to execute with the sub interpreter
     * @param environment Optional environment to run the interpreter in
     * @returns The result of executing the function in the sub-environment
     */
    inSubEnv(func: (interpreter: Interpreter) => BrsType, environment?: Environment): BrsType {
        let originalEnvironment = this._environment;
        let newEnv = environment ?? this._environment.createSubEnvironment();
        let retValue: BrsComponent | undefined = undefined;
        try {
            this._environment = newEnv;
            const returnValue = func(this);
            this._environment = originalEnvironment;
            return returnValue;
        } catch (err: any) {
            if (!this._tryMode && this.options.stopOnCrash && !(err instanceof Stmt.BlockEnd)) {
                // Keep environment for Micro Debugger in case of a crash
                originalEnvironment = this._environment;
            } else if (err instanceof Stmt.ReturnValue && err.value instanceof BrsComponent) {
                retValue = err.value;
                retValue.setReturn(true);
            }
            this._environment = originalEnvironment;
            throw err;
        } finally {
            newEnv.removeReferences();
            retValue?.setReturn(false);
        }
    }

    /**
     * Executes the provided statements in the current environment.
     * @param statements Array of statements to execute
     * @param sourceMap Optional source code map for debugging
     * @param args Run parameters for Main() or RunUserInterface() functions
     * @returns Array with the results of the executed statements
     */
    exec(statements: readonly Stmt.Statement[], sourceMap?: Map<string, string>, ...args: BrsType[]) {
        if (sourceMap) {
            this._sourceMap = sourceMap;
        }
        let results = statements.map((statement) => this.execute(statement));
        try {
            let mainName = "RunUserInterface";
            let maybeMain = this.getCallableFunction(mainName.toLowerCase());

            if (maybeMain.kind !== ValueKind.Callable) {
                mainName = "Main";
                maybeMain = this.getCallableFunction(mainName.toLowerCase());
            }
            if (maybeMain.kind === ValueKind.Callable) {
                let mainVariable = new Expr.Variable({
                    kind: Lexeme.Identifier,
                    text: mainName.toLowerCase(),
                    isReserved: false,
                    location: Interpreter.InternalLocation,
                });
                if (args.length > 0 && args[0] instanceof RoAssociativeArray) {
                    this._runParams = args[0];
                }
                if (maybeMain.signatures[0].signature.args.length === 0) {
                    args = [];
                }
                postMessage(`start,${mainVariable.name.text}`);
                results = [
                    this.visitCall(
                        new Expr.Call(
                            mainVariable,
                            mainVariable.name,
                            args.map((arg) => new Expr.Literal(arg, mainVariable.location))
                        )
                    ),
                ];
            } else if (this.options.entryPoint && !this._printed) {
                postMessage(
                    "warning,WARNING! No entry point found! You may need to define a function Main() or RunUserInterface()"
                );
            }
        } catch (err: any) {
            if (err instanceof Stmt.ReturnValue) {
                results = [err.value ?? BrsInvalid.Instance];
            } else if (err instanceof BrsError) {
                const backTrace = this.formatBacktrace(err.location ?? this.location, true, err.backTrace);
                throw new Error(`${err.format()}\nBackTrace:\n${backTrace}`, { cause: err });
            } else {
                throw err;
            }
        }

        return results;
    }

    /**
     * Retrieves the Callable function from the environment.
     * @param functionName The name of the function to retrieve
     * @param location Optional location from where the function will be called
     * @returns The Callable function or BrsInvalid if not found
     */
    getCallableFunction(functionName: string, location?: Location): Callable | BrsInvalid {
        let callbackVariable = new Expr.Variable({
            kind: Lexeme.Identifier,
            text: functionName,
            isReserved: false,
            location: location ?? Interpreter.InternalLocation,
        });
        let maybeCallback = this.evaluate(callbackVariable);
        if (maybeCallback.kind === ValueKind.Callable) {
            return maybeCallback;
        }

        return BrsInvalid.Instance;
    }

    visitLibrary(statement: Stmt.Library): BrsInvalid {
        // ignore during run time, already handled by lexer/parser
        return BrsInvalid.Instance;
    }

    visitNamedFunction(statement: Stmt.Function): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot create a named function with reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
        }

        if (this.environment.has(statement.name, [Scope.Module])) {
            const defLocation = this.environment.getDefinedLocation(statement.name.text);
            if (defLocation && !Location.equalTo(defLocation, statement.location)) {
                this.addError(
                    new BrsError(
                        `Attempting to declare function '${statement.name.text}' at ${statement.location.file}, but ` +
                            `it already exists in this scope from ${defLocation.file}`,
                        statement.name.location
                    )
                );
            }
        } else {
            this.environment.define(
                Scope.Module,
                statement.name.text,
                toCallable(statement.func, statement.name.text),
                statement.location
            );
        }
        return BrsInvalid.Instance;
    }

    visitReturn(statement: Stmt.Return): never {
        if (!statement.value) {
            throw new Stmt.ReturnValue(statement.tokens.return.location);
        }

        const toReturn = this.evaluate(statement.value);
        throw new Stmt.ReturnValue(statement.tokens.return.location, toReturn);
    }

    visitExpression(statement: Stmt.Expression): BrsType {
        return this.evaluate(statement.expression);
    }

    visitPrint(statement: Stmt.Print): BrsType {
        this._printed = true;
        // the `tab` function is only in-scope while executing print statements
        this.environment.define(Scope.Function, "Tab", StdLib.Tab);
        let printStream = "";
        for (const [_index, printable] of statement.expressions.entries()) {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma: {
                        const spaces = " ".repeat(16 - (BrsDevice.stdout.position() % 16));
                        printStream += spaces;
                        BrsDevice.stdout.position(spaces);
                        break;
                    }
                    case Lexeme.Semicolon:
                        break;
                    default:
                        this.addError(
                            new BrsError(`Found unexpected print separator '${printable.text}'`, printable.location)
                        );
                }
            } else {
                const obj = this.evaluate(printable);
                const str =
                    isNumberComp(obj) && this.isPositive(obj.getValue()) ? " " + obj.toString() : obj.toString();
                printStream += str;
                BrsDevice.stdout.position(str);
            }
        }
        const lastExpression = statement.expressions.at(-1);
        if (!lastExpression || !isToken(lastExpression) || lastExpression.kind !== Lexeme.Semicolon) {
            printStream += "\r\n";
        }

        BrsDevice.stdout.write(`print,${printStream}`);

        // `tab` is only in-scope when executing print statements, so remove it before we leave
        this.environment.remove("Tab");

        return BrsInvalid.Instance;
    }

    visitStop(statement: Stmt.Stop): BrsType {
        this.debugMode = true;
        this.stepMode = false;
        this.checkDebugger(statement);
        return BrsInvalid.Instance;
    }

    visitAssignment(statement: Stmt.Assignment): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(`Cannot assign a value to reserved name '${statement.name.text}'`, statement.name.location)
            );
        }

        let value = this.evaluate(statement.value);

        let name = statement.name.text;

        const typeDesignators: Record<string, ValueKind> = {
            $: ValueKind.String,
            "%": ValueKind.Int32,
            "!": ValueKind.Float,
            "#": ValueKind.Double,
            "&": ValueKind.Int64,
        };
        const requiredType = typeDesignators[name.at(-1) ?? ""];
        if (requiredType) {
            const coercedValue = tryCoerce(value, requiredType);
            if (coercedValue) {
                value = coercedValue;
            } else {
                this.addError(
                    new TypeMismatch({
                        message: `Unable to cast`,
                        left: {
                            type: requiredType,
                            location: statement.name.location,
                        },
                        right: {
                            type: value,
                            location: statement.value.location,
                        },
                        cast: true,
                    })
                );
            }
        }
        try {
            this.environment.define(Scope.Function, statement.name.text, value, statement.name.location);
        } catch (err: any) {
            this.addError(err);
        }
        return BrsInvalid.Instance;
    }

    visitDim(statement: Stmt.Dim): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(`Cannot assign a value to reserved name '${statement.name.text}'`, statement.name.location)
            );
            return BrsInvalid.Instance;
        }

        let dimensionValues: number[] = [];
        for (const expr of statement.dimensions) {
            let val = this.evaluate(expr);
            if (isBoxedNumber(val)) {
                val = val.unbox();
            }
            if (val.kind !== ValueKind.Int32 && val.kind !== ValueKind.Float) {
                this.addError(new RuntimeError(RuntimeErrorDetail.NonNumericArrayIndex, expr.location));
            }
            // dim takes max-index, so +1 to get the actual array size
            dimensionValues.push(val.getValue() + 1);
        }

        let createArrayTree = (dimIndex: number = 0): RoArray => {
            let children: RoArray[] = [];
            let size = dimensionValues[dimIndex];
            for (let i = 0; i < size; i++) {
                if (dimIndex < dimensionValues.length) {
                    let subChildren = createArrayTree(dimIndex + 1);
                    if (subChildren !== undefined) children.push(subChildren);
                }
            }
            let child = new RoArray(children);

            return child;
        };

        let array = createArrayTree();

        try {
            this.environment.define(Scope.Function, statement.name.text, array, statement.name.location);
        } catch (err: any) {
            this.addError(err);
        }

        return BrsInvalid.Instance;
    }

    visitBinary(expression: Expr.Binary) {
        let lexeme = expression.token.kind;
        let left = this.evaluate(expression.left);
        let right: BrsType = BrsInvalid.Instance;

        if (lexeme !== Lexeme.And && lexeme !== Lexeme.Or) {
            // don't evaluate right-hand-side of boolean expressions, to preserve short-circuiting
            // behavior found in other languages. e.g. `foo() && bar()` won't execute `bar()` if
            // `foo()` returns `false`.
            right = this.evaluate(expression.right);
        }

        // Unbox Numeric and Boolean components to intrinsic types
        if (isUnboxable(left)) {
            left = left.unbox();
        }
        if (isUnboxable(right)) {
            right = right.unbox();
        }

        /**
         * Determines whether or not the provided pair of values are allowed to be compared to each other.
         * @param left the left-hand side of a comparison operator
         * @param operator the operator to use when comparing `left` and `right`
         * @param right the right-hand side of a comparison operator
         * @returns `true` if `left` and `right` are allowed to be compared to each other with `operator`,
         *          otherwise `false`.
         */
        function canCheckEquality(left: BrsType, operator: Lexeme, right: BrsType): boolean {
            if (left.kind === ValueKind.Invalid || right.kind === ValueKind.Invalid) {
                // anything can be checked for *equality* with `invalid`, but greater than / less than comparisons
                // are type mismatches
                return operator === Lexeme.Equal || operator === Lexeme.LessGreater;
            }

            return (
                (left.kind < ValueKind.Dynamic || isUnboxable(left) || isComparable(left)) &&
                (right.kind < ValueKind.Dynamic || isUnboxable(right) || isComparable(right))
            );
        }

        switch (lexeme) {
            case Lexeme.LeftShift:
            case Lexeme.LeftShiftEqual:
                if (
                    isBrsNumber(left) &&
                    isBrsNumber(right) &&
                    this.isPositive(right.getValue()) &&
                    this.lessThan(right.getValue(), 32)
                ) {
                    return left.leftShift(right);
                } else if (isBrsNumber(left) && isBrsNumber(right)) {
                    return this.addError(new RuntimeError(RuntimeErrorDetail.BadBitShift, expression.right.location));
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "<<" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.RightShift:
            case Lexeme.RightShiftEqual:
                if (
                    isBrsNumber(left) &&
                    isBrsNumber(right) &&
                    this.isPositive(right.getValue()) &&
                    this.lessThan(right.getValue(), 32)
                ) {
                    return left.rightShift(right);
                } else if (isBrsNumber(left) && isBrsNumber(right)) {
                    return this.addError(new RuntimeError(RuntimeErrorDetail.BadBitShift, expression.right.location));
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator ">>" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Minus:
            case Lexeme.MinusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.subtract(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "-" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Star:
            case Lexeme.StarEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.multiply(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "*" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Caret:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.pow(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "^" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Slash:
            case Lexeme.SlashEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.divide(right);
                }
                return this.addError(
                    new TypeMismatch({
                        message: `Operator "/" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.Mod:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.modulo(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "mod" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Backslash:
            case Lexeme.BackslashEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.intDivide(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: String.raw`Operator "\" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Plus:
            case Lexeme.PlusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.add(right);
                } else if (isStringComp(left) && isStringComp(right)) {
                    return left.concat(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "+" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Greater:
                if ((isNumberComp(left) && isNumberComp(right)) || (isStringComp(left) && isStringComp(right))) {
                    return left.greaterThan(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator ">" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );

            case Lexeme.GreaterEqual:
                if ((isNumberComp(left) && isNumberComp(right)) || (isStringComp(left) && isStringComp(right))) {
                    return left.greaterThan(right).or(left.equalTo(right));
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator ">=" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );

            case Lexeme.Less:
                if ((isNumberComp(left) && isNumberComp(right)) || (isStringComp(left) && isStringComp(right))) {
                    return left.lessThan(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator "<" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.LessEqual:
                if ((isNumberComp(left) && isNumberComp(right)) || (isStringComp(left) && isStringComp(right))) {
                    return left.lessThan(right).or(left.equalTo(right));
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator "<=" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.Equal:
                if (canCheckEquality(left, lexeme, right)) {
                    return left.equalTo(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator "=" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.LessGreater:
                if (canCheckEquality(left, lexeme, right)) {
                    return left.equalTo(right).not();
                }

                return this.addError(
                    new TypeMismatch({
                        message: `Operator "<>" can't be applied to`,
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.And:
                if (isBrsBoolean(left) && !left.toBoolean()) {
                    // short-circuit ANDs - don't evaluate RHS if LHS is false
                    return BrsBoolean.False;
                } else if (isBrsBoolean(left)) {
                    right = this.evaluate(expression.right);
                    if (isUnboxable(right)) {
                        right = right.unbox();
                    }
                    if (right instanceof BrsBoolean || isBrsNumber(right)) {
                        return (left as BrsBoolean).and(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "and" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else if (isBrsNumber(left)) {
                    right = this.evaluate(expression.right);
                    if (isUnboxable(right)) {
                        right = right.unbox();
                    }
                    if (isBrsNumber(right) || right instanceof BrsBoolean) {
                        return left.and(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "and" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "and" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Or:
                if (isBrsBoolean(left) && left.toBoolean()) {
                    // short-circuit ORs - don't evaluate RHS if LHS is true
                    return BrsBoolean.True;
                } else if (isBrsBoolean(left)) {
                    right = this.evaluate(expression.right);
                    if (isUnboxable(right)) {
                        right = right.unbox();
                    }
                    if (right instanceof BrsBoolean || isBrsNumber(right)) {
                        return (left as BrsBoolean).or(right);
                    } else {
                        return this.addError(
                            new TypeMismatch({
                                message: `Operator "or" can't be applied to`,
                                left: {
                                    type: left,
                                    location: expression.left.location,
                                },
                                right: {
                                    type: right,
                                    location: expression.right.location,
                                },
                            })
                        );
                    }
                } else if (isBrsNumber(left)) {
                    right = this.evaluate(expression.right);
                    if (isUnboxable(right)) {
                        right = right.unbox();
                    }
                    if (isBrsNumber(right) || right instanceof BrsBoolean) {
                        return left.or(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "or" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "or" can't be applied to`,
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            default:
                this.addError(
                    new BrsError(`Received unexpected token kind '${expression.token.kind}'`, expression.token.location)
                );
        }
    }

    visitTryCatch(statement: Stmt.TryCatch): BrsInvalid {
        let tryMode = this._tryMode;
        try {
            this._tryMode = true;
            this.visitBlock(statement.tryBlock);
            this._tryMode = tryMode;
        } catch (err: any) {
            this._tryMode = tryMode;
            if (!(err instanceof BrsError) || err instanceof Stmt.GotoLabel || err instanceof Stmt.ReturnValue) {
                throw err;
            }
            this.environment.define(Scope.Function, statement.errorBinding.name.text, this.formatErrorVariable(err));
            this.visitBlock(statement.catchBlock);
        }
        return BrsInvalid.Instance;
    }

    visitThrow(statement: Stmt.Throw): never {
        let errDetail = RuntimeErrorDetail.UserDefined;
        errDetail.message = "";
        let toThrow = this.evaluate(statement.value);
        if (isStringComp(toThrow)) {
            errDetail.message = toThrow.getValue();
            throw new RuntimeError(errDetail, statement.location, this._stack.slice());
        }
        if (!(toThrow instanceof RoAssociativeArray)) {
            errDetail = RuntimeErrorDetail.MalformedThrow;
            errDetail.message = "Thrown value neither string nor roAssociativeArray.";
            throw new RuntimeError(errDetail, statement.location, this._stack.slice());
        }
        const extraFields: Map<string, BrsType> = new Map<string, BrsType>();
        for (const [key, element] of toThrow.elements) {
            if (key.toLowerCase() === "number") {
                errDetail = validateErrorNumber(element, errDetail);
            } else if (key.toLowerCase() === "message") {
                errDetail = validateErrorMessage(element, errDetail);
            } else if (key.toLowerCase() === "backtrace") {
                if (element instanceof RoArray) {
                    extraFields.set("backtrace", element);
                    extraFields.set("rethrown", BrsBoolean.True);
                } else {
                    errDetail = RuntimeErrorDetail.MalformedThrow;
                    errDetail.message = `Thrown "backtrace" is not an object.`;
                }
            } else if (key.toLowerCase() !== "rethrown") {
                extraFields.set(key, element);
            }
            if (errDetail.errno === RuntimeErrorDetail.MalformedThrow.errno) {
                extraFields.clear();
                break;
            }
        }
        throw new RuntimeError(errDetail, statement.location, this._stack.slice(), extraFields);
        // Validation Functions
        function validateErrorNumber(element: BrsType, errDetail: ErrorDetail): ErrorDetail {
            if (element instanceof Int32) {
                errDetail.errno = element.getValue();
                if (errDetail.message === "") {
                    const foundErr = findErrorDetail(element.getValue());
                    errDetail.message = foundErr ? foundErr.message : "UNKNOWN ERROR";
                }
            } else if (!(element instanceof BrsInvalid)) {
                return {
                    errno: RuntimeErrorDetail.MalformedThrow.errno,
                    message: `Thrown "number" is not an integer.`,
                };
            }
            return errDetail;
        }
        function validateErrorMessage(element: BrsType, errDetail: ErrorDetail): ErrorDetail {
            if (element instanceof BrsString) {
                errDetail.message = element.toString();
            } else if (!(element instanceof BrsInvalid)) {
                return {
                    errno: RuntimeErrorDetail.MalformedThrow.errno,
                    message: `Thrown "message" is not a string.`,
                };
            }
            return errDetail;
        }
    }

    visitBlock(block: Stmt.Block): BrsType {
        for (const statement of block.statements) {
            this.execute(statement);
        }
        return BrsInvalid.Instance;
    }

    visitGoto(statement: Stmt.Goto): never {
        throw new Stmt.GotoLabel(statement.location, statement.tokens.label.text);
    }

    visitContinueFor(statement: Stmt.ContinueFor): never {
        throw new Stmt.ContinueForReason(statement.location);
    }

    visitExitFor(statement: Stmt.ExitFor): never {
        throw new Stmt.ExitForReason(statement.location);
    }

    visitContinueWhile(statement: Stmt.ContinueWhile): never {
        throw new Stmt.ContinueWhileReason(statement.location);
    }

    visitExitWhile(statement: Stmt.ExitWhile): never {
        throw new Stmt.ExitWhileReason(statement.location);
    }

    visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        if (expression.callee instanceof Expr.Variable || expression.callee instanceof Expr.DottedGet) {
            functionName = expression.callee.name.text;
        }

        // evaluate the function to call (it could be the result of another function call)
        const evaluated = this.evaluate(expression.callee);
        const callee = evaluated instanceof RoFunction ? evaluated.unbox() : evaluated;
        // evaluate all of the arguments as well (they could also be function calls)
        let args = expression.args.map(this.evaluate, this);

        if (!isBrsCallable(callee)) {
            const invalidCallee = BrsInvalid.Instance.equalTo(callee).toBoolean();
            if (invalidCallee && expression.optional) {
                return callee;
            }
            this.addError(new RuntimeError(RuntimeErrorDetail.NotAFunction, expression.closingParen.location));
        }

        functionName = callee.getName();
        const savedEnvironment = this._environment;

        let satisfiedSignature = callee.getFirstSatisfiedSignature(args);

        if (satisfiedSignature) {
            try {
                let mPointer = this._environment.getRootM();

                let signature = satisfiedSignature.signature;
                args = args.map((arg, index) => {
                    // any arguments of type "object" must be automatically boxed
                    if (signature.args[index]?.type.kind === ValueKind.Object && isBoxable(arg)) {
                        return arg.box();
                    }

                    return arg;
                });

                if (expression.callee instanceof Expr.DottedGet || expression.callee instanceof Expr.IndexedGet) {
                    mPointer = callee.getContext() ?? mPointer;
                }
                return this.inSubEnv((subInterpreter) => {
                    subInterpreter.environment.setM(mPointer, false);
                    if (callee.isUserDefined()) {
                        this.addToStack({
                            functionName: functionName,
                            functionLocation: callee.getLocation() ?? this.location,
                            callLocation: expression.callee.location,
                            signature: signature,
                        });
                    }
                    try {
                        const returnValue = callee.call(this, ...args);
                        if (callee.isUserDefined()) this.popFromStack();
                        return returnValue;
                    } catch (err: any) {
                        if (!this._tryMode && this.options.stopOnCrash && err instanceof RuntimeError) {
                            if (!callee.isUserDefined()) {
                                // Restore the context for errors from built-in components/functions
                                this._environment = savedEnvironment;
                            }
                            // Enable Micro Debugger on app crash
                            const errNumber = err.errorDetail.errno;
                            runDebugger(this, this.location, this.location, err.message, errNumber);
                            this.options.stopOnCrash = false;
                        } else if (!this._tryMode && !this.options.stopOnCrash && !(err instanceof core.BlockEnd)) {
                            this.exitMode = true;
                        } else if (callee.isUserDefined()) {
                            this.popFromStack();
                        }
                        throw err;
                    }
                });
            } catch (reason: any) {
                if (!(reason instanceof Stmt.BlockEnd)) {
                    if (core.terminateReasons.includes(reason.message)) {
                        throw new Error(reason.message);
                    } else if (reason instanceof BrsError) {
                        throw reason;
                    } else if (BrsDevice.isDevMode && reason.message.length > 0) {
                        // Expose the Javascript error stack trace on `development` mode
                        console.error(reason);
                        throw new Error("");
                    }
                    throw new Error(reason.message);
                } else if (core.terminateReasons.includes(reason.message)) {
                    throw new Error(reason.message);
                }

                let returnedValue = (reason as Stmt.ReturnValue).value;
                let returnLocation = (reason as Stmt.ReturnValue).location;
                const signatureKind = satisfiedSignature.signature.returns;

                if (returnedValue && signatureKind === ValueKind.Void) {
                    this.addError(new RuntimeError(RuntimeErrorDetail.ReturnWithValue, returnLocation));
                }

                if (!returnedValue && signatureKind !== ValueKind.Void) {
                    this.addError(new RuntimeError(RuntimeErrorDetail.ReturnWithoutValue, returnLocation));
                }

                if (returnedValue) {
                    const coercedValue = tryCoerce(returnedValue, signatureKind);
                    if (coercedValue) {
                        return coercedValue;
                    }
                }

                if (returnedValue && signatureKind !== ValueKind.Dynamic && signatureKind !== returnedValue.kind) {
                    this.addError(
                        new TypeMismatch({
                            message: `Unable to cast`,
                            left: {
                                type: signatureKind,
                                location: returnLocation,
                            },
                            right: {
                                type: returnedValue,
                                location: returnLocation,
                            },
                            cast: true,
                        })
                    );
                }

                return returnedValue ?? BrsInvalid.Instance;
            }
        } else {
            this.addError(generateArgumentMismatchError(callee, args, expression.closingParen.location));
        }
    }

    visitAtSignGet(expression: Expr.AtSignGet) {
        let source = this.evaluate(expression.obj);
        if (source instanceof BrsInvalid && expression.optional) {
            return source;
        }
        if (source instanceof RoXMLElement || source instanceof RoXMLList) {
            try {
                return source.getAttribute(new BrsString(expression.name.text));
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.name.location));
            }
        } else {
            this.addError(
                new TypeMismatch({
                    message: `Expected "roXMLList" or "roXMLElement" not`,
                    left: {
                        type: source,
                        location: expression.location,
                    },
                })
            );
        }
    }

    visitDottedGet(expression: Expr.DottedGet) {
        if (expression.obj instanceof Expr.DottedGet) {
            this._dotLevel++;
        }
        let source = this.evaluate(expression.obj);
        let boxedSource = isBoxable(source) ? source.box() : source;

        if (boxedSource instanceof BrsComponent) {
            if (boxedSource.hasInterface(expression.name.text)) {
                return this._dotLevel > 0
                    ? boxedSource
                    : this.addError(new RuntimeError(RuntimeErrorDetail.BadSyntax, expression.name.location));
            }
            let ifFilter = "";
            if (expression.obj instanceof Expr.DottedGet) {
                const ifName = expression.obj.name.text;
                ifFilter = boxedSource.hasInterface(ifName) ? ifName : "";
            }
            boxedSource.setFilter(ifFilter);
        } else if (
            boxedSource instanceof BrsInterface &&
            boxedSource.name === "ifGlobal" &&
            boxedSource.hasMethod(expression.name.text)
        ) {
            for (const key in StdLib) {
                if (key.toLowerCase() === expression.name.text.toLowerCase()) {
                    const callable = (StdLib as any)[key];
                    if (callable instanceof Callable) {
                        return callable;
                    }
                    break;
                }
            }
        }
        this._dotLevel = 0;

        if (isCollection(source)) {
            try {
                const target = source.get(new BrsString(expression.name.text));
                if (isBrsCallable(target) && source instanceof RoAssociativeArray) {
                    target.setContext(source);
                }
                return target;
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.name.location));
            }
        }

        let errorDetail = RuntimeErrorDetail.DotOnNonObject;
        if (boxedSource instanceof BrsComponent) {
            const invalidSource = BrsInvalid.Instance.equalTo(source).toBoolean();
            // This check is supposed to be placed after method check,
            // but it's here to mimic the behavior of Roku, if they fix, we move it.
            if (invalidSource && expression.optional) {
                return source;
            }
            const method = boxedSource.getMethod(expression.name.text);
            if (method) {
                return method;
            } else if (!invalidSource) {
                errorDetail = RuntimeErrorDetail.MemberFunctionNotFound;
            }
        }
        this.addError(new RuntimeError(errorDetail, expression.name.location));
    }

    visitIndexedGet(expression: Expr.IndexedGet): BrsType {
        let source = this.evaluate(expression.obj);
        if (!isCollection(source)) {
            if (source instanceof BrsInvalid && expression.optional) {
                return source;
            }
            this.addError(new RuntimeError(RuntimeErrorDetail.UndimmedArray, expression.location));
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement || isSceneGraphNode(source)) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.WrongNumberOfParams, expression.closingSquare.location)
                );
            }
            let index = this.evaluate(expression.indexes[0]);
            if (!isBrsString(index)) {
                this.addError(
                    new TypeMismatch({
                        message: `"String" should be used as key, but received`,
                        left: {
                            type: index,
                            location: expression.indexes[0].location,
                        },
                    })
                );
            }
            try {
                const target = source.get(index, true);
                if (isBrsCallable(target) && source instanceof RoAssociativeArray) {
                    target.setContext(source);
                }
                return target;
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.closingSquare.location));
            }
        }
        if (source instanceof RoByteArray) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, expression.closingSquare.location)
                );
            }
        }
        let current: BrsType = source;
        for (let index of expression.indexes) {
            let dimIndex = this.evaluate(index);
            if (!isAnyNumber(dimIndex)) {
                this.addError(new RuntimeError(RuntimeErrorDetail.NonNumericArrayIndex, index.location));
            }
            if (
                current instanceof RoArray ||
                current instanceof RoByteArray ||
                current instanceof RoList ||
                current instanceof RoXMLList
            ) {
                try {
                    current = current.get(dimIndex);
                } catch (err: any) {
                    this.addError(new BrsError(err.message, index.location));
                }
            } else {
                this.addError(new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, expression.location));
            }
        }
        return current;
    }

    visitGrouping(expr: Expr.Grouping) {
        return this.evaluate(expr.expression);
    }

    visitFor(statement: Stmt.For): BrsType {
        // BrightScript for/to loops evaluate the counter initial value, final value, and increment
        // values *only once*, at the top of the for/to loop.
        let increment = this.evaluate(statement.increment) as Int32 | Float;
        if (increment instanceof Float) {
            increment = new Int32(Math.trunc(increment.getValue()));
        }
        const counterName = statement.counterDeclaration.name;
        const step = new Stmt.Assignment(
            { equals: statement.tokens.for },
            counterName,
            new Expr.Binary(
                new Expr.Variable(counterName),
                {
                    kind: Lexeme.Plus,
                    text: "+",
                    isReserved: false,
                    location: Interpreter.InternalLocation,
                },
                new Expr.Literal(increment, statement.increment.location)
            )
        );
        let startValue: BrsType;
        if (this.environment.continueFor) {
            this.execute(step);
            startValue = this.evaluate(new Expr.Variable(counterName)) as Int32 | Float;
            this.environment.continueFor = false;
        } else {
            this.execute(statement.counterDeclaration);
            startValue = this.evaluate(statement.counterDeclaration.value) as Int32 | Float;
        }
        const finalValue = this.evaluate(statement.finalValue) as Int32 | Float;
        if (
            (startValue.getValue() > finalValue.getValue() && increment.getValue() > 0) ||
            (startValue.getValue() < finalValue.getValue() && increment.getValue() < 0)
        ) {
            // Shortcut, do not process anything
            return BrsInvalid.Instance;
        }

        if (increment.getValue() > 0) {
            while (
                (this.evaluate(new Expr.Variable(counterName)) as Int32 | Float)
                    .greaterThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    this.execute(statement.body);
                } catch (reason) {
                    if (reason instanceof Stmt.ExitForReason) {
                        break;
                    } else if (reason instanceof Stmt.ContinueForReason) {
                        // continue to the next iteration
                    } else {
                        // re-throw returns, runtime errors, etc.
                        throw reason;
                    }
                }

                // then increment the counter
                this.execute(step);
            }
        } else {
            while (
                (this.evaluate(new Expr.Variable(counterName)) as Int32 | Float).lessThan(finalValue).not().toBoolean()
            ) {
                // execute the block
                try {
                    this.execute(statement.body);
                } catch (reason) {
                    if (reason instanceof Stmt.ExitForReason) {
                        break;
                    } else if (reason instanceof Stmt.ContinueForReason) {
                        // continue to the next iteration
                    } else {
                        // re-throw returns, runtime errors, etc.
                        throw reason;
                    }
                }

                // then increment the counter
                this.execute(step);
            }
        }

        return BrsInvalid.Instance;
    }

    visitForEach(statement: Stmt.ForEach): BrsType {
        let target = this.evaluate(statement.target);
        if (!isIterable(target)) {
            // Roku device does not crash if the value is not iterable, just send a console message
            const message = `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is not an enumerable object`;
            const location = `${statement.item.location.file}(${statement.item.location.start.line})`;
            BrsDevice.stderr.write(`warning,${message}: ${location}`);
            return BrsInvalid.Instance;
        }
        let continueAt = 0;
        if (this.environment.continueFor) {
            continueAt = this.environment.continueForEach;
            this.environment.continueFor = false;
            this.environment.continueForEach = 0;
        }
        let index = 0;

        target.resetNext();
        while (target.hasNext() === BrsBoolean.True) {
            const element = target.getNext();
            this.environment.define(Scope.Function, statement.item.text!, element);

            // execute the block
            try {
                if (continueAt <= index) {
                    this.execute(statement.body);
                }
            } catch (reason) {
                if (reason instanceof Stmt.ExitForReason) {
                    // break out of the loop
                    break;
                } else if (reason instanceof Stmt.ContinueForReason) {
                    // continue to the next iteration
                } else if (reason instanceof Stmt.GotoLabel) {
                    this.environment.continueForEach = index + 1;
                    throw reason;
                } else {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }

            // keep looping
            index++;
        }

        return BrsInvalid.Instance;
    }

    visitWhile(statement: Stmt.While): BrsType {
        while (this.evaluate(statement.condition).equalTo(BrsBoolean.True).toBoolean()) {
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitWhileReason) {
                    break;
                } else if (reason instanceof Stmt.ContinueWhileReason) {
                    // continue to the next iteration
                } else {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }
        }

        return BrsInvalid.Instance;
    }

    visitIf(statement: Stmt.If): BrsType {
        if (this.evaluate(statement.condition).equalTo(BrsBoolean.True).toBoolean()) {
            this.execute(statement.thenBranch);
            return BrsInvalid.Instance;
        } else {
            for (const elseIf of statement.elseIfs || []) {
                if (this.evaluate(elseIf.condition).equalTo(BrsBoolean.True).toBoolean()) {
                    this.execute(elseIf.thenBranch);
                    return BrsInvalid.Instance;
                }
            }

            if (statement.elseBranch) {
                this.execute(statement.elseBranch);
            }

            return BrsInvalid.Instance;
        }
    }

    visitAnonymousFunction(func: Expr.Function): BrsType {
        return toCallable(func);
    }

    visitLiteral(expression: Expr.Literal): BrsType {
        return expression.value;
    }

    visitArrayLiteral(expression: Expr.ArrayLiteral): RoArray {
        return new RoArray(expression.elements.map((expr) => this.evaluate(expr)));
    }

    visitAALiteral(expression: Expr.AALiteral): BrsType {
        return new RoAssociativeArray(
            expression.elements.map((member) => ({
                name: member.name,
                value: this.evaluate(member.value),
            }))
        );
    }

    visitDottedSet(statement: Stmt.DottedSet) {
        let value = this.evaluate(statement.value);
        let source = this.evaluate(statement.obj);

        if (!isCollection(source)) {
            this.addError(new RuntimeError(RuntimeErrorDetail.BadLHS, statement.name.location));
        }

        try {
            if (isSceneGraphNode(source)) {
                source.location = this.formatLocation(statement.name.location);
            }
            source.set(new BrsString(statement.name.text), value);
        } catch (err: any) {
            this.addError(new BrsError(err.message, statement.name.location));
        }

        return BrsInvalid.Instance;
    }

    visitIndexedSet(statement: Stmt.IndexedSet) {
        let value = this.evaluate(statement.value);
        let source = this.evaluate(statement.obj);

        if (!isCollection(source)) {
            this.addError(new RuntimeError(RuntimeErrorDetail.BadLHS, statement.obj.location));
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement || isSceneGraphNode(source)) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.WrongNumberOfParams, statement.closingSquare.location)
                );
            }
            let index = this.evaluate(statement.indexes[0]);
            if (!isBrsString(index)) {
                this.addError(
                    new TypeMismatch({
                        message: `"String" should be used as key, but received`,
                        left: {
                            type: index,
                            location: statement.indexes[0].location,
                        },
                    })
                );
            }
            try {
                if (isSceneGraphNode(source)) {
                    source.location = this.formatLocation(statement.closingSquare.location);
                }
                source.set(index, value, true);
            } catch (err: any) {
                this.addError(new BrsError(err.message, statement.closingSquare.location));
            }
            return BrsInvalid.Instance;
        }
        if (source instanceof RoByteArray) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, statement.closingSquare.location)
                );
            }
        }

        let current: BrsType = source;
        for (let i = 0; i < statement.indexes.length; i++) {
            let index = this.evaluate(statement.indexes[i]);
            if (!isBrsNumber(index)) {
                this.addError(new RuntimeError(RuntimeErrorDetail.NonNumericArrayIndex, statement.indexes[i].location));
            }

            if (i < statement.indexes.length - 1) {
                if (
                    current instanceof RoArray ||
                    current instanceof RoByteArray ||
                    current instanceof RoList ||
                    current instanceof RoXMLList
                ) {
                    try {
                        current = current.get(index);
                    } catch (err: any) {
                        this.addError(new BrsError(err.message, statement.closingSquare.location));
                    }
                } else {
                    this.addError(new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, statement.location));
                }
            } else if (
                current instanceof RoArray ||
                current instanceof RoByteArray ||
                current instanceof RoList ||
                current instanceof RoXMLList
            ) {
                try {
                    current.set(index, value);
                } catch (err: any) {
                    this.addError(new BrsError(err.message, statement.closingSquare.location));
                }
            } else {
                this.addError(new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, statement.location));
            }
        }

        return BrsInvalid.Instance;
    }

    visitIncrement(statement: Stmt.Increment) {
        let target = this.evaluate(statement.value);
        if (isBoxedNumber(target)) {
            target = target.unbox();
        }

        if (!isBrsNumber(target)) {
            let operation = statement.token.kind === Lexeme.PlusPlus ? "increment" : "decrement";
            this.addError(
                new TypeMismatch({
                    message: `Attempting to ${operation} value of non-numeric type`,
                    left: {
                        type: target,
                        location: statement.location,
                    },
                })
            );
        }

        let result: BrsNumber;
        if (statement.token.kind === Lexeme.PlusPlus) {
            result = target.add(new Int32(1));
        } else {
            result = target.subtract(new Int32(1));
        }

        if (statement.value instanceof Expr.Variable) {
            // store the result of the operation
            this.environment.define(Scope.Function, statement.value.name.text, result);
        } else if (statement.value instanceof Expr.DottedGet) {
            // immediately execute a dotted "set" statement
            this.execute(
                new Stmt.DottedSet(
                    statement.value.obj,
                    statement.value.name,
                    new Expr.Literal(result, statement.location)
                )
            );
        } else if (statement.value instanceof Expr.IndexedGet) {
            // immediately execute an indexed "set" statement
            this.execute(
                new Stmt.IndexedSet(
                    statement.value.obj,
                    statement.value.indexes,
                    new Expr.Literal(result, statement.location),
                    statement.value.closingSquare
                )
            );
        }

        // always return `invalid`, because ++/-- are purely side-effects in BrightScript
        return BrsInvalid.Instance;
    }

    visitUnary(expression: Expr.Unary) {
        let right = this.evaluate(expression.right);
        if (isUnboxable(right)) {
            right = right.unbox();
        }

        switch (expression.operator.kind) {
            case Lexeme.Minus:
                if (isBrsNumber(right)) {
                    return right.multiply(new Int32(-1));
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: `Operator "-" can't be applied to`,
                            left: {
                                type: right,
                                location: expression.operator.location,
                            },
                        })
                    );
                }
            case Lexeme.Plus:
                // Roku just ignores the Unary plus on any value/object
                return right;
            case Lexeme.Not:
                if (right instanceof BrsBoolean || isBrsNumber(right)) {
                    return right.not();
                } else {
                    this.addError(
                        new TypeMismatch({
                            message: `Operator "not" can't be applied to`,
                            left: {
                                type: right,
                                location: expression.operator.location,
                            },
                        })
                    );
                }
        }

        return BrsInvalid.Instance;
    }

    visitVariable(expression: Expr.Variable) {
        try {
            return this.environment.get(expression.name);
        } catch (err: any) {
            if (err instanceof NotFound) {
                return Uninitialized.Instance;
            }

            throw err;
        }
    }

    /**
     * Evaluates an expression and returns its BrsType value.
     * @param expression The expression to evaluate
     * @returns The BrsType result of evaluating the expression
     */
    evaluate(this: Interpreter, expression: Expr.Expression): BrsType {
        if (expression.location.start.line !== -1) this.location = expression.location;
        return expression.accept<BrsType>(this);
    }

    /**
     * Executes a statement and returns its BrsType result.
     * Handles goto labels, debugger checks, and extension ticks.
     * @param statement The statement to execute
     * @returns The BrsType result of executing the statement
     */
    execute(this: Interpreter, statement: Stmt.Statement): BrsType {
        if (this.environment.gotoLabel !== "") {
            return this.searchLabel(statement);
        }
        if (!(this.lastStmt instanceof Stmt.Stop)) {
            this.checkDebugger(statement);
        }
        for (const ext of this.extensions.values()) {
            ext.tick?.(this);
        }
        this.location = statement.location;
        this.lastStmt = statement;
        return statement.accept<BrsType>(this);
    }

    /**
     * Checks for debugger break commands and handles debug mode state.
     * @param statement The statement being executed
     */
    private checkDebugger(statement: Stmt.Statement) {
        const cmd = BrsDevice.checkBreakCommand(this.debugMode);
        if (cmd === DebugCommand.BREAK) {
            this.debugMode = true;
            if (!(statement instanceof Stmt.Block)) {
                if (!runDebugger(this, statement.location, this.location)) {
                    this.options.stopOnCrash = false;
                    throw new Stmt.BlockEnd("debug-exit", statement.location);
                }
            }
        } else if (cmd === DebugCommand.EXIT) {
            this.options.stopOnCrash = false;
            throw new Stmt.BlockEnd("debug-exit", statement.location);
        }
    }

    /**
     * Checks if the interpreter should enter crash debug mode based on the error.
     * @param err The error to check
     */
    public checkCrashDebug(err: any) {
        if (!this._tryMode && this.options.stopOnCrash && err instanceof RuntimeError) {
            // Enable Micro Debugger on app crash
            const errNumber = err.errorDetail.errno;
            runDebugger(this, this.location, this.location, err.message, errNumber);
            this.options.stopOnCrash = false;
        } else if (!this._tryMode && !this.options.stopOnCrash && !(err instanceof core.BlockEnd)) {
            this.exitMode = true;
        }
    }

    /**
     * Iterates through the statements to find the label to jump to.
     * @param statement The root statement to start searching from
     * @returns BrsInvalid if no exception is thrown
     */
    private searchLabel(this: Interpreter, statement: Stmt.Statement) {
        if (statement instanceof Stmt.Label) {
            if (statement.tokens.identifier.text.toLowerCase() === this.environment.gotoLabel) {
                this.environment.gotoLabel = "";
            }
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.If) {
            this.visitBlock(statement.thenBranch);
            if (this.environment.gotoLabel !== "" && statement.elseBranch) {
                this.visitBlock(statement.elseBranch);
            }
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.TryCatch) {
            // Only search on Catch block, as labels are illegal inside Try block
            this.visitBlock(statement.catchBlock);
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.For || statement instanceof Stmt.ForEach) {
            try {
                this.visitBlock(statement.body);
                this.environment.continueFor = this.environment.gotoLabel === "";
            } catch (reason) {
                this.environment.continueFor = false;
                if (reason instanceof Stmt.ExitForReason) {
                    return BrsInvalid.Instance;
                } else if (reason instanceof Stmt.ContinueForReason) {
                    this.environment.continueFor = true;
                } else {
                    throw reason;
                }
            }
        } else if (statement instanceof Stmt.While) {
            try {
                this.visitBlock(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitWhileReason) {
                    return BrsInvalid.Instance;
                } else if (reason instanceof Stmt.ContinueWhileReason) {
                    // continue to the next iteration
                } else {
                    throw reason;
                }
            }
        }
        if (this.environment.gotoLabel === "") {
            return statement.accept<BrsType>(this);
        }
        return BrsInvalid.Instance;
    }

    // Helper methods

    /**
     * Returns the memory heap information from the interpreter.
     * @returns Object with the heap size limit and the used heap size in KB
     */
    getMemoryHeapInfo() {
        let heapSizeLimit = 874299; // Mock value for the heap size limit
        let usedHeapSize = 26229; // Mock value for the used heap size
        /// #if BROWSER
        // Only Chromium based browsers support process.memory API, web workers do not have it yet,
        // This information comes from the main thread and does not include the worker thread memory.
        const limit = Atomics.load(BrsDevice.sharedArray, DataType.MHSL);
        const used = Atomics.load(BrsDevice.sharedArray, DataType.MUHS);
        if (limit > 0 && used > 0) {
            heapSizeLimit = limit;
            usedHeapSize = used;
        }
        /// #else
        // More accurate information from the V8 engine in Node.js
        const memoryUsage = v8.getHeapStatistics();
        const heapLimit = Math.floor(memoryUsage.heap_size_limit / 1024);
        const heapUsed = Math.floor(memoryUsage.used_heap_size / 1024);
        if (heapLimit > 0 && heapUsed > 0) {
            heapSizeLimit = heapLimit;
            usedHeapSize = heapUsed;
        }
        /// #endif
        return { heapSizeLimit, usedHeapSize };
    }

    /**
     * Returns the backtrace formatted as a string or an array.
     * @param loc Optional location of the error, defaults to current location
     * @param asString If true returns the backtrace as a string, otherwise as RoArray
     * @param bt Optional backtrace array, defaults to current stack
     * @returns String or RoArray with the formatted backtrace
     */
    formatBacktrace(loc?: Location, asString = true, bt?: TracePoint[]): RoArray | string {
        loc ??= this.location;
        const backTrace = bt ?? this._stack;
        let debugMsg = "";
        const btArray: BrsType[] = [];
        for (let index = backTrace.length - 1; index >= 0; index--) {
            const func = backTrace[index];
            const kind = ValueKind.toString(func.signature.returns);
            let args = "";
            for (const arg of func.signature.args) {
                args += args === "" ? "" : ",";
                args += `${arg.name.text} As ${ValueKind.toString(arg.type.kind)}`;
            }
            const funcSig = `${func.functionName}(${args}) As ${kind}`;
            if (asString) {
                debugMsg += `#${index}  Function ${funcSig}\r\n`;
                debugMsg += `   file/line: ${this.formatLocation(loc)}\r\n`;
            } else {
                const line = loc.start.line;
                const info = { filename: loc?.file ?? "()", function: funcSig, line_number: line };
                btArray.unshift(toAssociativeArray(info));
            }
            loc = func.callLocation;
        }
        return asString ? debugMsg : new RoArray(btArray);
    }

    /**
     * Returns a formatted string of variables in the selected scope for REPL and Micro Debugger.
     * @param scope The scope to inspect (defaults to Function scope)
     * @returns String representation of the variables in the selected scope
     */
    formatVariables(scope: Scope = Scope.Function): string {
        let vars = scope === Scope.Function ? `${"global".padEnd(16)} Interface:ifGlobal\r\n` : "";
        let fnc = this.environment.getList(scope);
        for (const [key, value] of fnc) {
            const varName = key.padEnd(17);
            if (value.kind === ValueKind.Uninitialized) {
                vars += `${varName}${ValueKind.toString(value.kind)}\r\n`;
            } else if (PrimitiveKinds.has(value.kind)) {
                vars += `${varName}${ValueKind.toString(value.kind)} val:${this.formatValue(value)}`;
            } else if (value instanceof BrsComponent && isCollection(value)) {
                const count = value.getElements().length;
                vars += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()} count:${count}\r\n`;
            } else if (value instanceof BrsComponent && isUnboxable(value)) {
                const unboxed = value.unbox();
                vars += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()} val:${this.formatValue(
                    unboxed
                )}`;
            } else if (value.kind === ValueKind.Object) {
                vars += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()}\r\n`;
            } else if (value.kind === ValueKind.Callable) {
                vars += `${varName}${ValueKind.toString(value.kind)} val:${value.getName()}\r\n`;
            } else {
                vars += `${varName}${value.toString().substring(0, 94)}\r\n`;
            }
        }
        return vars;
    }

    /**
     * Formats a BrsType value for display in the debugger.
     * @param value The BrsType value to format
     * @returns Formatted string representation of the value
     */
    formatValue(value: BrsType) {
        let text = value.toString();
        let lf = text.length <= 94 ? "\r\n" : "...\r\n";
        if (value instanceof BrsString) {
            text = `"${text.substring(0, 94)}"`;
        } else if (value instanceof Int32) {
            text = `${text} (&h${numberToHex(value.getValue()).toUpperCase()})`;
        } else if (value instanceof Int64) {
            text = `${text} (&h${numberToHex(value.getValue().toNumber()).toUpperCase()})`;
        }
        return `${text}${lf}`;
    }

    /**
     * Returns a string with the source code location in pkg: format.
     * @param location The location to format (defaults to current location)
     * @returns String representation of the location in format "pkg:/file(line)"
     */
    formatLocation(location: Location = this.location) {
        let formattedLocation: string;
        const file = location.file.startsWith("pkg:") ? location.file : `pkg:/${location.file}`;
        if (location.start.line) {
            formattedLocation = `${file}(${location.start.line})`;
        } else {
            formattedLocation = `${file}(??)`;
        }
        return formattedLocation;
    }

    /**
     * Returns the statistics of the interpreter for the REPL and Micro Debugger.
     * @returns String representation of the interpreter statistics
     */
    formatStats(): string {
        let debugMsg = `Sub Context Data:\r\n`;
        let varCount = this.environment.getList(Scope.Function).size + 2;
        debugMsg += `  Variables:      ${varCount}\r\n`;
        let lineCount = 0;
        for (const lines of this.sourceMap.values()) {
            lineCount += parseTextFile(lines).length;
        }
        debugMsg += "Module Constant Table Sizes:\r\n";
        debugMsg += `  Source Lns:     ${lineCount}\r\n`;
        for (const [lexeme, count] of core.stats.entries()) {
            const name = Lexeme[lexeme] + ":";
            debugMsg += `  ${name.padEnd(15)} ${count}\r\n`;
        }
        return debugMsg;
    }

    /**
     * Returns the current app's formatted version from the manifest.
     * @returns The current app version in format "major.minor.build"
     */
    getChannelVersion(): string {
        let majorVersion = Number.parseInt(this.manifest.get("major_version") ?? "0") || 0;
        let minorVersion = Number.parseInt(this.manifest.get("minor_version") ?? "0") || 0;
        let buildVersion = Number.parseInt(this.manifest.get("build_version") ?? "0") || 0;
        return `${majorVersion}.${minorVersion}.${buildVersion}`;
    }

    /**
     * Emits an error via this interpreter's `events` property, then throws it.
     * @param err The BrsError to emit and throw
     */
    public addError(err: BrsError): never {
        err.backTrace ??= this._stack.slice();
        if (!this._tryMode) {
            // do not save/emit the error if we are in a try block
            this.errors.push(err);
            this.events.emit("err", err);
        }
        throw err;
    }

    /**
     * Formats a BrsError into an associative array for error handling in BrightScript.
     * @param err The BrsError to format
     * @returns RoAssociativeArray containing error details (backtrace, message, number, etc.)
     */
    private formatErrorVariable(err: BrsError) {
        const btArray = this.formatBacktrace(err.location ?? this.location, false, err.backTrace) as RoArray;
        let errDetail = RuntimeErrorDetail.Internal;
        let errMessage = err.message;
        if (err instanceof RuntimeError) {
            errDetail = err.errorDetail;
        }
        const errorAA = toAssociativeArray({
            backtrace: btArray,
            message: errMessage,
            number: errDetail.errno,
            rethrown: false,
        });
        if (err instanceof RuntimeError && err.extraFields?.size) {
            for (const [key, value] of err.extraFields) {
                errorAA.set(new BrsString(key), value);
                if (key === "rethrown" && isBrsBoolean(value) && value.toBoolean()) {
                    errorAA.set(new BrsString("rethrow_backtrace"), btArray);
                }
            }
        }
        return errorAA;
    }

    /**
     * Evaluates if a number is positive or NaN.
     * @param value Number to evaluate (number or Long)
     * @returns True if the number is positive or NaN, false otherwise
     */
    private isPositive(value: number | Long): boolean {
        if (value instanceof Long) {
            return value.isPositive();
        }
        return Number.isNaN(value) || value >= 0;
    }

    /**
     * Evaluates if a number is less than a comparison value.
     * @param value Number to evaluate (number or Long)
     * @param compare Number to compare against
     * @returns True if value is less than compare, false otherwise
     */
    private lessThan(value: number | Long, compare: number): boolean {
        if (value instanceof Long) {
            return value.lessThan(compare);
        }
        return value < compare;
    }
}
