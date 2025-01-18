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
    AAMember,
} from "../brsTypes";
import { tryCoerce } from "../brsTypes/Coercion";
import { Lexeme, GlobalFunctions } from "../lexer";
import { isToken, Location } from "../lexer/Token";
import { Expr, Stmt } from "../parser";
import { BrsError, RuntimeError, RuntimeErrorDetail, findErrorDetail, ErrorDetail } from "../Error";
import { TypeMismatch } from "./TypeMismatch";
import { generateArgumentMismatchError } from "./ArgumentMismatch";
import { OutputProxy } from "./OutputProxy";
import * as StdLib from "../stdlib";
import Long from "long";
import { Scope, Environment, NotFound } from "./Environment";
import { toCallable } from "./BrsFunction";
import { BlockEnd, GotoLabel } from "../parser/Statement";
import { FileSystem } from "./FileSystem";
import { runDebugger } from "./MicroDebugger";
import {
    DataType,
    DebugCommand,
    DataBufferIndex,
    DefaultDeviceInfo,
    numberToHex,
    parseTextFile,
    threadYield,
} from "../common";
/// #if !BROWSER
import * as v8 from "v8";
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
    private _singleKeyEvents = true; // Default Roku behavior is `true`

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

    readonly fileSystem: FileSystem;
    readonly options: ExecutionOptions = defaultExecutionOptions;
    readonly manifest: Map<string, any> = new Map<string, any>();
    readonly deviceInfo: Map<string, any> = new Map<string, any>();
    readonly registry: Map<string, string> = new Map<string, string>();
    readonly translations: Map<string, string> = new Map<string, string>();
    readonly sharedArray = core.shared.array ?? new Int32Array([]);
    readonly isShared = core.shared.isShared;
    readonly keysBuffer = core.controlEvents;
    readonly debugBuffer = core.debugEvents;
    readonly inputBuffer = core.inputEvents;
    readonly sysLogBuffer = core.sysLogEvents;
    readonly audioBuffer = core.audioEvents;
    readonly videoBuffer = core.videoEvents;
    readonly wavStatus = core.wavStatus;
    readonly cecStatus = core.cecStatus;
    readonly isDevMode = process.env.NODE_ENV === "development";

    readonly stdout: OutputProxy;
    readonly stderr: OutputProxy;

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

    get singleKeyEvents() {
        return this._singleKeyEvents;
    }

    get creationTime() {
        return this._creationTime;
    }

    public displayEnabled: boolean = true;
    public lastRemote: number = 0;
    public lastKeyTime: number = Date.now();
    public currKeyTime: number = Date.now();
    public debugMode: boolean = false;

    /**
     * Updates the interpreter manifest with the provided data
     * @param manifest Map with manifest content.
     */
    public setManifest(manifest: Map<string, string>) {
        manifest.forEach((value: string, key: string) => {
            this.manifest.set(key, value);
            // Custom Manifest Entries
            if (key.toLowerCase() === "multi_key_events") {
                this._singleKeyEvents = value.trim() !== "1";
            }
        });
    }

    /**
     * Updates the interpreter registry with the provided data
     * @param registry Map with registry content.
     */
    public setRegistry(registry: Map<string, string>) {
        registry.forEach((value: string, key: string) => {
            this.registry.set(key, value);
        });
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
        this.stdout = new OutputProxy(this.options.stdout, this.options.post);
        this.stderr = new OutputProxy(this.options.stderr, this.options.post);
        this.fileSystem = new FileSystem(this.options.root, this.options.ext);
        for (const [key, value] of Object.entries(DefaultDeviceInfo)) {
            if (!["registry", "fonts"].includes(key)) {
                this.deviceInfo.set(key, value);
            }
        }
        const global = new Set<string>();
        Object.keys(StdLib)
            .map((name) => (StdLib as any)[name])
            .filter((func) => func instanceof Callable)
            .filter((func: Callable) => {
                if (!func.name) {
                    throw new Error("Unnamed standard library function detected!");
                }

                return !!func.name;
            })
            .forEach((func: Callable) => {
                this._environment.define(Scope.Global, func.name ?? "", func);
                if (func.name && GlobalFunctions.has(func.name)) {
                    global.add(func.name);
                }
            });
        this._environment.define(Scope.Global, "global", new BrsInterface("ifGlobal", global));
    }

    /**
     * Temporarily sets an interpreter's environment to the provided one, then
     * passes the sub-interpreter to the provided JavaScript function. Always
     * reverts the current interpreter's environment to its original value.
     * @param func the JavaScript function to execute with the sub interpreter.
     * @param environment (Optional) the environment to run the interpreter in.
     */
    async inSubEnv(
        func: (interpreter: Interpreter) => Promise<BrsType>,
        environment?: Environment
    ): Promise<BrsType> {
        let originalEnvironment = this._environment;
        let newEnv = environment ?? this._environment.createSubEnvironment();
        let retValue: BrsComponent | undefined = undefined;
        try {
            this._environment = newEnv;
            const returnValue = await func(this);
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

    async exec(
        statements: readonly Stmt.Statement[],
        sourceMap?: Map<string, string>,
        ...args: BrsType[]
    ) {
        if (sourceMap) {
            this._sourceMap = sourceMap;
        }
        let results: BrsType[] = [];
        // resolve statement promises in a loop to ensure statements are executed in order.
        for (let statement of statements) {
            results.push(await this.execute(statement));
        }
        try {
            let mainName = "RunUserInterface";
            let maybeMain = await this.getCallableFunction(mainName.toLowerCase());

            if (maybeMain.kind !== ValueKind.Callable) {
                mainName = "Main";
                maybeMain = await this.getCallableFunction(mainName.toLowerCase());
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
                    await this.visitCall(
                        new Expr.Call(
                            mainVariable,
                            mainVariable.name,
                            args.map((arg) => new Expr.Literal(arg, mainVariable.location))
                        )
                    ),
                ];
            } else if (this.options.entryPoint) {
                // Generate an exception when Entry Point is required
                throw new RuntimeError(
                    {
                        errno: RuntimeErrorDetail.MissingMainFunction.errno,
                        message:
                            "No entry point found! You must define a function Main() or RunUserInterface()",
                    },
                    Interpreter.InternalLocation
                );
            }
        } catch (err: any) {
            if (err instanceof Stmt.ReturnValue) {
                results = [err.value ?? BrsInvalid.Instance];
            } else if (err instanceof BrsError) {
                const backTrace = this.formatBacktrace(err.location, true, err.backTrace);
                throw new Error(`${err.format()}\nBackTrace:\n${backTrace}`, { cause: err });
            } else {
                throw err;
            }
        }

        return results;
    }

    async getCallableFunction(functionName: string): Promise<Callable | BrsInvalid> {
        let callbackVariable = new Expr.Variable({
            kind: Lexeme.Identifier,
            text: functionName,
            isReserved: false,
            location: Interpreter.InternalLocation,
        });
        let maybeCallback = this.evaluate(callbackVariable);
        if (maybeCallback instanceof Callable) {
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
            // TODO: Figure out how to determine where the original version was declared
            // Maybe `Environment.define` records the location along with the value?
            this.addError(
                new BrsError(
                    `Attempting to declare function '${statement.name.text}', but ` +
                        `a property of that name already exists in this scope.`,
                    statement.name.location
                )
            );
        }

        this.environment.define(
            Scope.Module,
            statement.name.text,
            toCallable(statement.func, statement.name.text)
        );
        return BrsInvalid.Instance;
    }

    async visitReturn(statement: Stmt.Return) {
        if (!statement.value) {
            throw new Stmt.ReturnValue(statement.tokens.return.location);
        }

        const toReturn = await this.evaluate(statement.value);
        throw new Stmt.ReturnValue(statement.tokens.return.location, toReturn);
        return BrsInvalid.Instance;
    }

    async visitExpression(statement: Stmt.Expression): Promise<BrsType> {
        return await this.evaluate(statement.expression);
    }

    async visitPrint(statement: Stmt.Print): Promise<BrsType> {
        // the `tab` function is only in-scope while executing print statements
        this.environment.define(Scope.Function, "Tab", StdLib.Tab);
        let printStream = "";
        for (let printable of statement.expressions) {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma: {
                        const spaces = " ".repeat(16 - (this.stdout.position() % 16));
                        printStream += spaces;
                        this.stdout.position(spaces);
                        break;
                    }
                    case Lexeme.Semicolon:
                        break;
                    default:
                        this.addError(
                            new BrsError(
                                `Found unexpected print separator '${printable.text}'`,
                                printable.location
                            )
                        );
                }
            } else {
                const obj = await this.evaluate(printable);
                const str =
                    isNumberComp(obj) && this.isPositive(obj.getValue())
                        ? " " + obj.toString()
                        : obj.toString();
                printStream += str;
                this.stdout.position(str);
            }
        }
        let lastExpression = statement.expressions[statement.expressions.length - 1];
        if (!isToken(lastExpression) || lastExpression.kind !== Lexeme.Semicolon) {
            printStream += "\r\n";
        }

        this.stdout.write(`print,${printStream}`);

        // `tab` is only in-scope when executing print statements, so remove it before we leave
        this.environment.remove("Tab");

        return BrsInvalid.Instance;
    }

    visitStop(statement: Stmt.Stop): BrsType {
        this.debugMode = true;
        return BrsInvalid.Instance;
    }

    async visitAssignment(statement: Stmt.Assignment): Promise<BrsType> {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
        }

        let value = await this.evaluate(statement.value);

        let name = statement.name.text;

        const typeDesignators: Record<string, ValueKind> = {
            $: ValueKind.String,
            "%": ValueKind.Int32,
            "!": ValueKind.Float,
            "#": ValueKind.Double,
            "&": ValueKind.Int64,
        };
        let requiredType = typeDesignators[name.charAt(name.length - 1)];

        if (requiredType) {
            let coercedValue = tryCoerce(value, requiredType);
            if (coercedValue != null) {
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
            this.environment.define(
                Scope.Function,
                statement.name.text,
                value,
                statement.name.location
            );
        } catch (err: any) {
            this.addError(err);
        }
        return BrsInvalid.Instance;
    }

    async visitDim(statement: Stmt.Dim): Promise<BrsType> {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
        }

        let dimensionValues: number[] = [];
        for (let expr of statement.dimensions) {
            let val = await this.evaluate(expr);
            if (val.kind !== ValueKind.Int32 && val.kind !== ValueKind.Float) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.NonNumericArrayIndex, expr.location)
                );
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
            this.environment.define(
                Scope.Function,
                statement.name.text,
                array,
                statement.name.location
            );
        } catch (err: any) {
            this.addError(err);
        }

        return BrsInvalid.Instance;
    }

    async visitBinary(expression: Expr.Binary) {
        let lexeme = expression.token.kind;
        let left = await this.evaluate(expression.left);
        let right: BrsType = BrsInvalid.Instance;

        if (lexeme !== Lexeme.And && lexeme !== Lexeme.Or) {
            // don't evaluate right-hand-side of boolean expressions, to preserve short-circuiting
            // behavior found in other languages. e.g. `foo() && bar()` won't execute `bar()` if
            // `foo()` returns `false`.
            right = await this.evaluate(expression.right);
        }

        // Unbox Numeric components to intrinsic types
        if (isBoxedNumber(left)) {
            left = left.unbox();
        }
        if (isBoxedNumber(right)) {
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
                    return this.addError(
                        new RuntimeError(RuntimeErrorDetail.BadBitShift, expression.right.location)
                    );
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
                    return this.addError(
                        new RuntimeError(RuntimeErrorDetail.BadBitShift, expression.right.location)
                    );
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
                            message: `Operator "\\" can't be applied to`,
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
                if (
                    (isNumberComp(left) && isNumberComp(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
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
                if (
                    (isNumberComp(left) && isNumberComp(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
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
                if (
                    (isNumberComp(left) && isNumberComp(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
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
                if (
                    (isNumberComp(left) && isNumberComp(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
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
                    right = await this.evaluate(expression.right);
                    if (isBrsBoolean(right) || isBrsNumber(right)) {
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
                    right = await this.evaluate(expression.right);

                    if (isBrsNumber(right) || isBrsBoolean(right)) {
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
                    right = await this.evaluate(expression.right);
                    if (isBrsBoolean(right) || isBrsNumber(right)) {
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
                    right = await this.evaluate(expression.right);
                    if (isBrsNumber(right) || isBrsBoolean(right)) {
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
                    new BrsError(
                        `Received unexpected token kind '${expression.token.kind}'`,
                        expression.token.location
                    )
                );
        }
    }

    async visitTryCatch(statement: Stmt.TryCatch): Promise<BrsInvalid> {
        let tryMode = this._tryMode;
        try {
            this._tryMode = true;
            await this.visitBlock(statement.tryBlock);
            this._tryMode = tryMode;
        } catch (err: any) {
            this._tryMode = tryMode;
            if (!(err instanceof BrsError) || err instanceof GotoLabel) {
                throw err;
            }
            this.environment.define(
                Scope.Function,
                statement.errorBinding.name.text,
                this.formatErrorVariable(err)
            );
            await this.visitBlock(statement.catchBlock);
        }
        return BrsInvalid.Instance;
    }

    async visitThrow(statement: Stmt.Throw) {
        let errDetail = RuntimeErrorDetail.UserDefined;
        errDetail.message = "";
        let toThrow = await this.evaluate(statement.value);
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
        return BrsInvalid.Instance;
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

    async visitBlock(block: Stmt.Block): Promise<BrsType> {
        for (let statement of block.statements) {
            await this.execute(statement);
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

    async visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        // TODO: auto-box
        if (
            expression.callee instanceof Expr.Variable ||
            expression.callee instanceof Expr.DottedGet
        ) {
            functionName = expression.callee.name.text;
        }

        // evaluate the function to call (it could be the result of another function call)
        const evaluated = await this.evaluate(expression.callee);
        const callee = evaluated instanceof RoFunction ? evaluated.unbox() : evaluated;
        // evaluate all of the arguments as well (they could also be function calls)
        let args = new Array<BrsType>();
        for (let arg of expression.args) {
            args.push(await this.evaluate(arg));
        }

        if (!isBrsCallable(callee)) {
            if (callee instanceof BrsInvalid && expression.optional) {
                return callee;
            }
            this.addError(
                new RuntimeError(RuntimeErrorDetail.NotAFunction, expression.closingParen.location)
            );
        }

        functionName = callee.getName();

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

                if (expression.callee instanceof Expr.DottedGet) {
                    mPointer = callee.getContext() ?? mPointer;
                }
                return await this.inSubEnv(async (subInterpreter) => {
                    subInterpreter.environment.setM(mPointer);
                    this._stack.push({
                        functionName: functionName,
                        functionLocation: callee.getLocation() ?? this.location,
                        callLocation: expression.callee.location,
                        signature: signature,
                    });
                    try {
                        const returnValue = await callee.call(this, ...args);
                        this._stack.pop();
                        return returnValue;
                    } catch (err: any) {
                        this._stack.pop();
                        if (
                            !this._tryMode &&
                            this.options.stopOnCrash &&
                            !(err instanceof Stmt.BlockEnd)
                        ) {
                            // Enable Micro Debugger on app crash
                            let errNumber = RuntimeErrorDetail.Internal.errno;
                            if (err instanceof RuntimeError) {
                                errNumber = err.errorDetail.errno;
                            }
                            await runDebugger(
                                this,
                                this.location,
                                this.location,
                                err.message,
                                errNumber
                            );
                            this.options.stopOnCrash = false;
                        }
                        throw err;
                    }
                });
            } catch (reason: any) {
                if (!(reason instanceof Stmt.BlockEnd)) {
                    if (reason.message === "debug-exit") {
                        throw new Error(reason.message);
                    } else if (reason instanceof BrsError) {
                        throw reason;
                    } else if (this.isDevMode && reason.message.length > 0) {
                        // Expose the Javascript error stack trace on `development` mode
                        console.error(reason);
                        throw new Error("");
                    }
                    throw new Error(reason.message);
                } else if (reason.message === "debug-exit") {
                    throw new Error(reason.message);
                }

                let returnedValue = (reason as Stmt.ReturnValue).value;
                let returnLocation = (reason as Stmt.ReturnValue).location;
                const signatureKind = satisfiedSignature.signature.returns;

                if (returnedValue && signatureKind === ValueKind.Void) {
                    this.addError(
                        new RuntimeError(RuntimeErrorDetail.ReturnWithValue, returnLocation)
                    );
                }

                if (!returnedValue && signatureKind !== ValueKind.Void) {
                    this.addError(
                        new RuntimeError(RuntimeErrorDetail.ReturnWithoutValue, returnLocation)
                    );
                }

                if (returnedValue) {
                    let coercedValue = tryCoerce(returnedValue, signatureKind);
                    if (coercedValue != null) {
                        return coercedValue;
                    }
                }

                if (
                    returnedValue &&
                    signatureKind !== ValueKind.Dynamic &&
                    signatureKind !== returnedValue.kind
                ) {
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
            this.addError(
                generateArgumentMismatchError(callee, args, expression.closingParen.location)
            );
        }
    }

    async visitAtSignGet(expression: Expr.AtSignGet) {
        let source = await this.evaluate(expression.obj);
        if (source instanceof BrsInvalid && expression.optional) {
            return source;
        }
        if (isIterable(source) && (source instanceof RoXMLElement || source instanceof RoXMLList)) {
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

    async visitDottedGet(expression: Expr.DottedGet) {
        if (expression.obj instanceof Expr.DottedGet) {
            this._dotLevel++;
        }
        let source = await this.evaluate(expression.obj);
        let boxedSource = isBoxable(source) ? source.box() : source;

        if (boxedSource instanceof BrsComponent) {
            if (boxedSource.hasInterface(expression.name.text)) {
                return this._dotLevel > 0
                    ? boxedSource
                    : this.addError(
                          new RuntimeError(RuntimeErrorDetail.BadSyntax, expression.name.location)
                      );
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

        if (isIterable(source)) {
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

    async visitIndexedGet(expression: Expr.IndexedGet): Promise<BrsType> {
        let source = await this.evaluate(expression.obj);
        if (!isIterable(source)) {
            if (source instanceof BrsInvalid && expression.optional) {
                return source;
            }
            this.addError(new RuntimeError(RuntimeErrorDetail.UndimmedArray, expression.location));
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.WrongNumberOfParams,
                        expression.closingSquare.location
                    )
                );
            }
            let index = await this.evaluate(expression.indexes[0]);
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
                return source.get(index, true);
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.closingSquare.location));
            }
        }
        if (source instanceof RoByteArray) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.BadNumberOfIndexes,
                        expression.closingSquare.location
                    )
                );
            }
        }
        let current: BrsType = source;
        for (let index of expression.indexes) {
            let dimIndex = await this.evaluate(index);
            if (!isBrsNumber(dimIndex)) {
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.NonNumericArrayIndex, index.location)
                );
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
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, expression.location)
                );
            }
        }
        return current;
    }

    async visitGrouping(expr: Expr.Grouping) {
        return await this.evaluate(expr.expression);
    }

    async visitFor(statement: Stmt.For): Promise<BrsType> {
        // BrightScript for/to loops evaluate the counter initial value, final value, and increment
        // values *only once*, at the top of the for/to loop.
        let increment = (await this.evaluate(statement.increment)) as Int32 | Float;
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
            await this.execute(step);
            startValue = (await this.evaluate(new Expr.Variable(counterName))) as Int32 | Float;
            this.environment.continueFor = false;
        } else {
            await this.execute(statement.counterDeclaration);
            startValue = (await this.evaluate(statement.counterDeclaration.value)) as Int32 | Float;
        }
        const finalValue = (await this.evaluate(statement.finalValue)) as Int32 | Float;
        if (
            (startValue.getValue() > finalValue.getValue() && increment.getValue() > 0) ||
            (startValue.getValue() < finalValue.getValue() && increment.getValue() < 0)
        ) {
            // Shortcut, do not process anything
            return BrsInvalid.Instance;
        }

        if (increment.getValue() > 0) {
            while (
                ((await this.evaluate(new Expr.Variable(counterName))) as Int32 | Float)
                    .greaterThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    await this.execute(statement.body);
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
                await this.execute(step);
            }
        } else {
            while (
                ((await this.evaluate(new Expr.Variable(counterName))) as Int32 | Float)
                    .lessThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    await this.execute(statement.body);
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
                await this.execute(step);
            }
        }

        return BrsInvalid.Instance;
    }

    async visitForEach(statement: Stmt.ForEach): Promise<BrsType> {
        let target = await this.evaluate(statement.target);
        if (!isIterable(target)) {
            // Roku device does not crash if the value is not iterable, just send a console message
            const message = `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is ${ValueKind.toString(
                target.kind
            )}`;
            const location = `${statement.item.location.file}(${statement.item.location.start.line})`;
            this.stderr.write(`warning,${message}: ${location}`);
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
                    await this.execute(statement.body);
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

    async visitWhile(statement: Stmt.While): Promise<BrsType> {
        while ((await this.evaluate(statement.condition)).equalTo(BrsBoolean.True).toBoolean()) {
            try {
                await this.execute(statement.body);
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

    async visitIf(statement: Stmt.If): Promise<BrsType> {
        if ((await this.evaluate(statement.condition)).equalTo(BrsBoolean.True).toBoolean()) {
            await this.execute(statement.thenBranch);
            return BrsInvalid.Instance;
        } else {
            for (const elseIf of statement.elseIfs || []) {
                if ((await this.evaluate(elseIf.condition)).equalTo(BrsBoolean.True).toBoolean()) {
                    await this.execute(elseIf.thenBranch);
                    return BrsInvalid.Instance;
                }
            }

            if (statement.elseBranch) {
                await this.execute(statement.elseBranch);
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

    async visitArrayLiteral(expression: Expr.ArrayLiteral): Promise<RoArray> {
        const array = new Array<BrsType>();
        for (let expr of expression.elements) {
            array.push(await this.evaluate(expr));
        }
        return new RoArray(array);
    }

    async visitAALiteral(expression: Expr.AALiteral): Promise<BrsType> {
        const aaMembers = new Array<AAMember>();
        for (let member of expression.elements) {
            aaMembers.push({
                name: member.name,
                value: await this.evaluate(member.value),
            });
        }
        return new RoAssociativeArray(aaMembers);
    }

    async visitDottedSet(statement: Stmt.DottedSet) {
        let value = await this.evaluate(statement.value);
        let source = await this.evaluate(statement.obj);

        if (!isIterable(source)) {
            this.addError(new RuntimeError(RuntimeErrorDetail.BadLHS, statement.name.location));
        }

        try {
            source.set(new BrsString(statement.name.text), value);
        } catch (err: any) {
            this.addError(new BrsError(err.message, statement.name.location));
        }

        return BrsInvalid.Instance;
    }

    async visitIndexedSet(statement: Stmt.IndexedSet) {
        let value = await this.evaluate(statement.value);
        let source = await this.evaluate(statement.obj);

        if (!isIterable(source)) {
            this.addError(new RuntimeError(RuntimeErrorDetail.BadLHS, statement.obj.location));
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.WrongNumberOfParams,
                        statement.closingSquare.location
                    )
                );
            }
            let index = await this.evaluate(statement.indexes[0]);
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
                source.set(index, value, true);
            } catch (err: any) {
                this.addError(new BrsError(err.message, statement.closingSquare.location));
            }
            return BrsInvalid.Instance;
        }
        if (source instanceof RoByteArray) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.BadNumberOfIndexes,
                        statement.closingSquare.location
                    )
                );
            }
        }

        let current: BrsType = source;
        for (let i = 0; i < statement.indexes.length; i++) {
            let index = await this.evaluate(statement.indexes[i]);
            if (!isBrsNumber(index)) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.NonNumericArrayIndex,
                        statement.indexes[i].location
                    )
                );
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
                    this.addError(
                        new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, statement.location)
                    );
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
                this.addError(
                    new RuntimeError(RuntimeErrorDetail.BadNumberOfIndexes, statement.location)
                );
            }
        }

        return BrsInvalid.Instance;
    }

    async visitIncrement(statement: Stmt.Increment) {
        let target = await this.evaluate(statement.value);
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
            await this.execute(
                new Stmt.DottedSet(
                    statement.value.obj,
                    statement.value.name,
                    new Expr.Literal(result, statement.location)
                )
            );
        } else if (statement.value instanceof Expr.IndexedGet) {
            // immediately execute an indexed "set" statement
            await this.execute(
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

    async visitUnary(expression: Expr.Unary) {
        let right = await this.evaluate(expression.right);
        if (isBoxedNumber(right)) {
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
                if (isBrsBoolean(right) || isBrsNumber(right)) {
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

    evaluate(this: Interpreter, expression: Expr.Expression): BrsType | Promise<BrsType> {
        if (expression.location.start.line !== -1) this.location = expression.location;
        return expression.accept<BrsType>(this);
    }

    async execute(this: Interpreter, statement: Stmt.Statement): Promise<BrsType> {
        if (this.environment.gotoLabel !== "") {
            return this.searchLabel(statement);
        }
        const cmd = await this.checkBreakCommand();
        if (cmd === DebugCommand.BREAK) {
            if (!(statement instanceof Stmt.Block)) {
                const proceed = await runDebugger(this, statement.location, this.location);
                if (!proceed) {
                    this.options.stopOnCrash = false;
                    throw new BlockEnd("debug-exit", statement.location);
                }
            }
        } else if (cmd === DebugCommand.EXIT) {
            this.options.stopOnCrash = false;
            throw new BlockEnd("debug-exit", statement.location);
        }
        this.location = statement.location;
        return statement.accept<BrsType>(this);
    }

    /**
     * Iterates through the statements to find the label to jump to
     * @param statement the root statement to start searching
     *
     * @returns Invalid if no exception is thrown
     */
    private async searchLabel(this: Interpreter, statement: Stmt.Statement) {
        if (statement instanceof Stmt.Label) {
            if (statement.tokens.identifier.text.toLowerCase() === this.environment.gotoLabel) {
                this.environment.gotoLabel = "";
            }
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.If) {
            await this.visitBlock(statement.thenBranch);
            if (this.environment.gotoLabel !== "" && statement.elseBranch) {
                await this.visitBlock(statement.elseBranch);
            }
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.TryCatch) {
            // Only search on Catch block, as labels are illegal inside Try block
            await this.visitBlock(statement.catchBlock);
            return BrsInvalid.Instance;
        } else if (statement instanceof Stmt.For || statement instanceof Stmt.ForEach) {
            try {
                await this.visitBlock(statement.body);
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
                await this.visitBlock(statement.body);
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
     * Returns the Memory Heap information from the interpreter
     *
     * @returns an object with the heap size limit and the used heap size
     * */
    getMemoryHeapInfo() {
        let heapSizeLimit = 874299; // Mock value for the heap size limit
        let usedHeapSize = 26229; // Mock value for the used heap size
        /// #if BROWSER
        // Only Chromium based browsers support process.memory API, web workers do not have it yet,
        // This information comes from the main thread and does not include the worker thread memory.
        if (core.memoryInfo.heapSizeLimit > 0 && core.memoryInfo.usedHeapSize > 0) {
            heapSizeLimit = core.memoryInfo.heapSizeLimit;
            usedHeapSize = core.memoryInfo.usedHeapSize;
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
     * Returns the Backtrace formatted as a string or an array
     * @param loc the location of the error
     * @param asString a boolean, if true returns the backtrace as a string, otherwise as an array
     * @param bt the backtrace array
     * @returns a string or an array with the backtrace formatted
     */
    formatBacktrace(loc: Location, asString = true, bt?: TracePoint[]): RoArray | string {
        const backTrace = bt ?? this._stack;
        let debugMsg = "";
        const btArray: BrsType[] = [];
        for (let index = backTrace.length - 1; index >= 0; index--) {
            const func = backTrace[index];
            const kind = ValueKind.toString(func.signature.returns);
            let args = "";
            func.signature.args.forEach((arg) => {
                args += args !== "" ? "," : "";
                args += `${arg.name.text} As ${ValueKind.toString(arg.type.kind)}`;
            });
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
     * Method to return the current scope of the interpreter for the REPL and Micro Debugger
     * @returns a string representation of the local variables in the current scope
     */
    formatLocalVariables(): string {
        let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
        let fnc = this.environment.getList(Scope.Function);
        fnc.forEach((value, key) => {
            const varName = key.padEnd(17);
            if (value.kind === ValueKind.Uninitialized) {
                debugMsg += `${varName}${ValueKind.toString(value.kind)}\r\n`;
            } else if (PrimitiveKinds.has(value.kind)) {
                debugMsg += `${varName}${ValueKind.toString(value.kind)} val:${this.formatValue(
                    value
                )}`;
            } else if (isIterable(value)) {
                const count = value.getElements().length;
                debugMsg += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()} count:${count}\r\n`;
            } else if (value instanceof BrsComponent && isUnboxable(value)) {
                const unboxed = value.unbox();
                debugMsg += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()} val:${this.formatValue(
                    unboxed
                )}`;
            } else if (value.kind === ValueKind.Object) {
                debugMsg += `${varName}${value.getComponentName()} refcnt=${value.getReferenceCount()}\r\n`;
            } else if (value.kind === ValueKind.Callable) {
                debugMsg += `${varName}${ValueKind.toString(
                    value.kind
                )} val:${value.getName()}\r\n`;
            } else {
                debugMsg += `${varName}${value.toString().substring(0, 94)}\r\n`;
            }
        });
        return debugMsg;
    }

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
     * Method to return a string with the current source code location
     * @returns a string representation of the location
     */
    formatLocation(location: Location = this.location) {
        let formattedLocation: string;
        if (location.start.line) {
            formattedLocation = `pkg:/${location.file}(${location.start.line})`;
        } else {
            formattedLocation = `pkg:/${location.file}(??)`;
        }
        return formattedLocation;
    }

    /**
     * Method to return the statistics of the interpreter for the REPL and Micro Debugger
     * @returns a string representation of the interpreter statistics
     */
    formatStats(): string {
        let debugMsg = `Sub Context Data:\r\n`;
        let varCount = this.environment.getList(Scope.Function).size + 2;
        debugMsg += `  Variables:      ${varCount}\r\n`;
        let lineCount = 0;
        this.sourceMap.forEach((lines) => {
            lineCount += parseTextFile(lines).length;
        });
        debugMsg += "Module Constant Table Sizes:\r\n";
        debugMsg += `  Source Lns:     ${lineCount}\r\n`;
        core.stats.forEach((count, lexeme) => {
            const name = Lexeme[lexeme] + ":";
            debugMsg += `  ${name.padEnd(15)} ${count}\r\n`;
        });
        return debugMsg;
    }

    /**
     * Method to return the current app formatted version
     * @returns the current app version
     */
    getChannelVersion(): string {
        let majorVersion = parseInt(this.manifest.get("major_version")) || 0;
        let minorVersion = parseInt(this.manifest.get("minor_version")) || 0;
        let buildVersion = parseInt(this.manifest.get("build_version")) || 0;
        return `${majorVersion}.${minorVersion}.${buildVersion}`;
    }

    /**
     * Method to check if the Break Command was sent
     * @returns the last debug command
     */
    async checkBreakCommand(): Promise<number> {
        let cmd = this.debugMode ? DebugCommand.BREAK : -1;
        if (!this.debugMode) {
            if (this.isShared) {
                cmd = Atomics.load(this.sharedArray, DataType.DBG);
                if (cmd === DebugCommand.BREAK) {
                    Atomics.store(this.sharedArray, DataType.DBG, -1);
                    this.debugMode = true;
                } else if (cmd === DebugCommand.PAUSE) {
                    postMessage("debug,pause");
                    Atomics.wait(this.sharedArray, DataType.DBG, DebugCommand.PAUSE);
                    Atomics.store(this.sharedArray, DataType.DBG, -1);
                    cmd = -1;
                    postMessage("debug,continue");
                }
            } else if (this.debugBuffer.length > 0) {
                let cmd = this.debugBuffer.shift()?.command ?? -1;
                if (cmd === DebugCommand.BREAK) {
                    this.debugMode = true;
                } else if (cmd === DebugCommand.PAUSE) {
                    postMessage("debug,pause");
                    while (cmd === DebugCommand.PAUSE) {
                        await threadYield();
                        if (this.debugBuffer.length > 0) {
                            cmd = this.debugBuffer.shift()?.command ?? -1;
                        }
                    }
                    postMessage("debug,continue");
                }
            }
        }
        return cmd;
    }

    /**
     * Method to extract the data buffer from the sharedArray
     * @returns the data buffer as a string
     */
    readDataBuffer(): string {
        let data = "";
        this.sharedArray.slice(DataBufferIndex).every((char) => {
            if (char > 0) {
                data += String.fromCharCode(char);
            }
            return char; // if \0 stops decoding
        });
        Atomics.store(this.sharedArray, DataType.BUF, -1);
        return data;
    }

    /**
     * Emits an error via this processor's `events` property, then throws it.
     * @param err the ParseError to emit then throw
     */
    public addError(err: BrsError): never {
        if (!err.backTrace) {
            err.backTrace = this._stack.slice();
        }
        if (!this._tryMode) {
            // do not save/emit the error if we are in a try block
            this.errors.push(err);
            this.events.emit("err", err);
        }
        throw err;
    }

    /**
     * Method to evaluate if a string is a valid IP address
     * @param ip the string to evaluate
     * @returns whether the string is a valid IP address
     */
    public isValidIp(ip: string): boolean {
        const parts = ip.split(".");
        return (
            parts.length === 4 &&
            parts.every((part) => {
                const num = Number(part);
                return !isNaN(num) && num >= 0 && num <= 255;
            })
        );
    }

    private formatErrorVariable(err: BrsError) {
        const btArray = this.formatBacktrace(err.location, false, err.backTrace) as RoArray;
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
     * Method to evaluate if a number is positive
     * @param value number to evaluate
     * @returns boolean indicating if the number is positive
     */
    private isPositive(value: number | Long): boolean {
        if (value instanceof Long) {
            return value.isPositive();
        }
        return value >= 0;
    }

    /**
     * Method to evaluate if a number is less than compare
     * @param value number to evaluate
     * @param compare number to compare
     * @returns boolean indicating if the number is less than compare
     */
    private lessThan(value: number | Long, compare: number): boolean {
        if (value instanceof Long) {
            return value.lessThan(compare);
        }
        return value < compare;
    }
}
