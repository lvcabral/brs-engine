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
    Float,
    Uninitialized,
    RoArray,
    RoByteArray,
    RoList,
    RoAssociativeArray,
    RoXMLElement,
    RoXMLList,
    RoFunction,
} from "../brsTypes";
import { tryCoerce } from "../brsTypes/coercion";
import { shared } from "..";
import { Lexeme } from "../lexer";
import { isToken, Location } from "../lexer/Token";
import { Expr, Stmt } from "../parser";
import { BrsError, RuntimeError, RuntimeErrorCode, findErrorCode, ErrorCode } from "../Error";
import { TypeMismatch } from "./TypeMismatch";
import { generateArgumentMismatchError } from "./ArgumentMismatch";
import { OutputProxy } from "./OutputProxy";
import * as StdLib from "../stdlib";
import Long from "long";

import { Scope, Environment, NotFound, BackTrace } from "./Environment";
import { toCallable } from "./BrsFunction";
import { BlockEnd } from "../parser/Statement";
import { FileSystem } from "./FileSystem";
import { runDebugger } from "./MicroDebugger";
import { DataType, DebugCommand, dataBufferIndex, defaultDeviceInfo } from "../common";

/** The set of options used to configure an interpreter's execution. */
export interface ExecutionOptions {
    root?: string;
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
    root: process.cwd(),
    entryPoint: false,
    stopOnCrash: false,
    stdout: process.stdout,
    stderr: process.stderr,
    post: true,
};

export class Interpreter implements Expr.Visitor<BrsType>, Stmt.Visitor<BrsType> {
    private _environment = new Environment();
    private _sourceMap = new Map<string, string>();
    private _startTime = Date.now();
    private _dotLevel = 0;
    private _singleKeyEvents = true; // Default Roku behavior is `true`

    location: Location = {
        file: "",
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
    };

    readonly options: ExecutionOptions = defaultExecutionOptions;
    readonly fileSystem: Map<string, FileSystem> = new Map<string, FileSystem>();
    readonly manifest: Map<string, any> = new Map<string, any>();
    readonly deviceInfo: Map<string, any> = new Map<string, any>();
    readonly registry: Map<string, string> = new Map<string, string>();
    readonly translations: Map<string, string> = new Map<string, string>();
    readonly sharedArray = shared.get("buffer") || new Int32Array([]);
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

    get startTime() {
        return this._startTime;
    }

    get singleKeyEvents() {
        return this._singleKeyEvents;
    }

    public audioId: number = 0;
    public lastKeyTime: number = Date.now();
    public currKeyTime: number = Date.now();
    public debugMode: boolean = false;

    /**
     * Updates the interpreter manifest with the provided data
     *
     * @param manifest Map with manifest content.
     *
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
     *
     * @param registry Map with registry content.
     *
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
        Object.assign(this.options, options);
        this.stdout = new OutputProxy(this.options.stdout, this.options.post);
        this.stderr = new OutputProxy(this.options.stderr, this.options.post);
        this.fileSystem.set("common:", new FileSystem());
        this.fileSystem.set("pkg:", new FileSystem());
        this.fileSystem.set("tmp:", new FileSystem());
        this.fileSystem.set("cachefs:", new FileSystem());
        Object.keys(defaultDeviceInfo).forEach((key) => {
            if (!["registry", "fonts"].includes(key)) {
                this.deviceInfo.set(key, defaultDeviceInfo[key]);
            }
        });
        Object.keys(StdLib)
            .map((name) => (StdLib as any)[name])
            .filter((func) => func instanceof Callable)
            .filter((func: Callable) => {
                if (!func.name) {
                    throw new Error("Unnamed standard library function detected!");
                }

                return !!func.name;
            })
            .forEach((func: Callable) =>
                this._environment.define(Scope.Global, func.name ?? "", func)
            );
    }

    /**
     * Temporarily sets an interpreter's environment to the provided one, then
     * passes the sub-interpreter to the provided JavaScript function. Always
     * reverts the current interpreter's environment to its original value.
     * @param func the JavaScript function to execute with the sub interpreter.
     * @param environment (Optional) the environment to run the interpreter in.
     */
    inSubEnv(func: (interpreter: Interpreter) => BrsType, environment?: Environment): BrsType {
        let originalEnvironment = this._environment;
        let newEnv = environment ?? this._environment.createSubEnvironment();
        let btArray = originalEnvironment.getBackTrace();
        btArray.forEach((bt) => {
            newEnv.addBackTrace(bt.functionName, bt.functionLoc, bt.callLoc, bt.signature);
        });
        try {
            this._environment = newEnv;
            return func(this);
        } catch (err: any) {
            if (this.options.stopOnCrash && !(err instanceof Stmt.BlockEnd)) {
                // Keep environment for Micro Debugger in case of a crash
                originalEnvironment = this._environment;
            }
            throw err;
        } finally {
            this._environment = originalEnvironment;
        }
    }

    exec(
        statements: readonly Stmt.Statement[],
        sourceMap?: Map<string, string>,
        ...args: BrsType[]
    ) {
        let results = statements.map((statement) => this.execute(statement));
        if (sourceMap) {
            this._sourceMap = sourceMap;
        }
        try {
            let mainVariable = new Expr.Variable({
                kind: Lexeme.Identifier,
                text: "runuserinterface",
                isReserved: false,
                location: {
                    start: {
                        line: -1,
                        column: -1,
                    },
                    end: {
                        line: -1,
                        column: -1,
                    },
                    file: "(internal)",
                },
            });

            let maybeMain = this.visitVariable(mainVariable);

            if (maybeMain.kind !== ValueKind.Callable) {
                mainVariable = new Expr.Variable({
                    kind: Lexeme.Identifier,
                    text: "main",
                    isReserved: false,
                    location: {
                        start: {
                            line: -1,
                            column: -1,
                        },
                        end: {
                            line: -1,
                            column: -1,
                        },
                        file: "(internal)",
                    },
                });
                maybeMain = this.visitVariable(mainVariable);
            }

            if (maybeMain.kind === ValueKind.Callable) {
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
            } else if (this.options.entryPoint) {
                // Generate an exception when Entry Point is required
                throw new RuntimeError(
                    RuntimeErrorCode.MissingMainFunction,
                    "No entry point found! You must define a function Main() or RunUserInterface()",
                    mainVariable.location
                );
            }
        } catch (err: any) {
            if (err instanceof Stmt.ReturnValue) {
                results = [err.value ?? BrsInvalid.Instance];
            } else if (err instanceof BrsError) {
                const backtrace = this.formatBacktrace(err.location, true, err.backtrace);
                throw new Error(`${err.format()}\nBackTrace:\n${backtrace}`);
            } else {
                throw err;
            }
        }

        return results;
    }

    getCallableFunction(functionName: string): Callable {
        let callbackVariable = new Expr.Variable({
            kind: Lexeme.Identifier,
            text: functionName,
            isReserved: false,
            location: {
                start: {
                    line: -1,
                    column: -1,
                },
                end: {
                    line: -1,
                    column: -1,
                },
                file: "(internal)",
            },
        });
        let maybeCallback = this.evaluate(callbackVariable);
        if (maybeCallback.kind === ValueKind.Callable) {
            return maybeCallback;
        }

        throw new NotFound(`${functionName} was not found in scope`);
    }

    visitLibrary(statement: Stmt.Library): BrsInvalid {
        // ignore during run time, already handled by lexer/parser
        return BrsInvalid.Instance;
    }

    visitNamedFunction(statement: Stmt.Function): BrsType {
        if (statement.name.isReserved) {
            return this.addError(
                new BrsError(
                    `Cannot create a named function with reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
        }

        if (this.environment.has(statement.name, [Scope.Module])) {
            // TODO: Figure out how to determine where the original version was declared
            // Maybe `Environment.define` records the location along with the value?
            return this.addError(
                new BrsError(
                    `Attempting to declare function '${statement.name.text}', but ` +
                        `a property of that name already exists in this scope.`,
                    statement.name.location
                )
            );
        }

        this.environment.define(
            Scope.Module,
            statement.name.text!,
            toCallable(statement.func, statement.name.text)
        );
        return BrsInvalid.Instance;
    }

    visitReturn(statement: Stmt.Return): never {
        if (!statement.value) {
            throw new Stmt.ReturnValue(statement.tokens.return.location);
        }

        let toReturn = this.evaluate(statement.value);
        throw new Stmt.ReturnValue(statement.tokens.return.location, toReturn);
    }

    visitExpression(statement: Stmt.Expression): BrsType {
        return this.evaluate(statement.expression);
    }

    visitPrint(statement: Stmt.Print): BrsType {
        // the `tab` function is only in-scope while executing print statements
        this.environment.define(Scope.Function, "Tab", StdLib.Tab);
        let printStream = "";
        statement.expressions.forEach((printable, index) => {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma:
                        const spaces = " ".repeat(16 - (this.stdout.position() % 16));
                        printStream += spaces;
                        this.stdout.position(spaces);
                        break;
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
                const obj = this.evaluate(printable);
                const str =
                    isNumberComp(obj) && this.isPositive(obj.getValue())
                        ? " " + obj.toString()
                        : obj.toString();
                printStream += str;
                this.stdout.position(str);
            }
        });
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

    visitAssignment(statement: Stmt.Assignment): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
            return BrsInvalid.Instance;
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

        this.environment.define(Scope.Function, statement.name.text, value);
        return BrsInvalid.Instance;
    }

    visitDim(statement: Stmt.Dim): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
            return BrsInvalid.Instance;
        }

        let dimensionValues: number[] = [];
        statement.dimensions.forEach((expr) => {
            let val = this.evaluate(expr);
            if (val.kind !== ValueKind.Int32 && val.kind !== ValueKind.Float) {
                this.addError(
                    new RuntimeError(RuntimeErrorCode.NonNumericArrayIndex, "", expr.location)
                );
            }
            // dim takes max-index, so +1 to get the actual array size
            dimensionValues.push(val.getValue() + 1);
            return;
        });

        let createArrayTree = (dimIndex: number = 0): RoArray => {
            let children: RoArray[] = [];
            let size = dimensionValues[dimIndex];
            for (let i = 0; i < size; i++) {
                if (dimIndex < dimensionValues.length) {
                    let subchildren = createArrayTree(dimIndex + 1);
                    if (subchildren !== undefined) children.push(subchildren);
                }
            }
            let child = new RoArray(children);

            return child;
        };

        let array = createArrayTree();

        this.environment.define(Scope.Function, statement.name.text, array);

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
                        new RuntimeError(
                            RuntimeErrorCode.BadBitShift,
                            "",
                            expression.right.location
                        )
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
                        new RuntimeError(
                            RuntimeErrorCode.BadBitShift,
                            "",
                            expression.right.location
                        )
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
                    right = this.evaluate(expression.right);
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
                    right = this.evaluate(expression.right);

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
                    right = this.evaluate(expression.right);
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
                    right = this.evaluate(expression.right);
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
                return this.addError(
                    new BrsError(
                        `Received unexpected token kind '${expression.token.kind}'`,
                        expression.token.location
                    )
                );
        }
    }

    visitTryCatch(statement: Stmt.TryCatch): BrsInvalid {
        let stopState = this.options.stopOnCrash;
        try {
            this.options.stopOnCrash = false;
            this.visitBlock(statement.tryBlock);
            this.options.stopOnCrash = stopState;
        } catch (err: any) {
            this.options.stopOnCrash = stopState;
            if (!(err instanceof BrsError)) {
                throw err;
            }
            const btArray = this.formatBacktrace(err.location, false, err.backtrace) as RoArray;
            let errCode = RuntimeErrorCode.Internal;
            let errMessage = err.message;
            if (err instanceof RuntimeError) {
                errCode = err.errCode;
            }
            const errorAA = new RoAssociativeArray([
                { name: new BrsString("backtrace"), value: btArray },
                { name: new BrsString("message"), value: new BrsString(errMessage) },
                { name: new BrsString("number"), value: new Int32(errCode.errno) },
                { name: new BrsString("rethrown"), value: BrsBoolean.False },
            ]);
            if (err instanceof RuntimeError && err.extraFields?.size) {
                for (const [key, value] of err.extraFields) {
                    errorAA.set(new BrsString(key), value);
                    if (key === "rethrown" && toBool(value)) {
                        errorAA.set(new BrsString("rethrow_backtrace"), btArray);
                    }
                }
            }
            this.environment.define(Scope.Function, statement.errorBinding.name.text, errorAA);
            this.visitBlock(statement.catchBlock);
        }
        return BrsInvalid.Instance;
        // Helper Function
        function toBool(value: BrsType): boolean {
            return isBrsBoolean(value) && value.toBoolean();
        }
    }

    visitThrow(statement: Stmt.Throw): never {
        let errCode = RuntimeErrorCode.UserDefined;
        errCode.message = "";
        const extraFields: Map<string, BrsType> = new Map<string, BrsType>();
        let toThrow = this.evaluate(statement.value);
        if (isStringComp(toThrow)) {
            errCode.message = toThrow.getValue();
        } else if (toThrow instanceof RoAssociativeArray) {
            for (const [key, element] of toThrow.elements) {
                if (key.toLowerCase() === "number") {
                    errCode = validateErrorNumber(element, errCode);
                } else if (key.toLowerCase() === "message") {
                    errCode = validateErrorMessage(element, errCode);
                } else if (key.toLowerCase() === "backtrace") {
                    if (element instanceof RoArray) {
                        extraFields.set("backtrace", element);
                        extraFields.set("rethrown", BrsBoolean.True);
                    } else {
                        errCode = RuntimeErrorCode.MalformedThrow;
                        errCode.message = `Thrown "backtrace" is not an object.`;
                    }
                } else if (key.toLowerCase() !== "rethrown") {
                    extraFields.set(key, element);
                }
                if (errCode.errno === RuntimeErrorCode.MalformedThrow.errno) {
                    extraFields.clear();
                    break;
                }
            }
        } else {
            errCode = RuntimeErrorCode.MalformedThrow;
            errCode.message = `Thrown value neither string nor roAssociativeArray.`;
        }
        throw new RuntimeError(
            errCode,
            errCode.message,
            statement.location,
            extraFields,
            this.environment.getBackTrace()
        );
        // Validation Functions
        function validateErrorNumber(element: BrsType, errCode: ErrorCode): ErrorCode {
            if (element instanceof Int32) {
                errCode.errno = element.getValue();
                if (errCode.message === "") {
                    const foundErr = findErrorCode(element.getValue());
                    errCode.message = foundErr ? foundErr.message : "UNKNOWN ERROR";
                }
            } else if (!(element instanceof BrsInvalid)) {
                return {
                    errno: RuntimeErrorCode.MalformedThrow.errno,
                    message: `Thrown "number" is not an integer.`,
                };
            }
            return errCode;
        }
        function validateErrorMessage(element: BrsType, errCode: ErrorCode): ErrorCode {
            if (element instanceof BrsString) {
                errCode.message = element.toString();
            } else if (!(element instanceof BrsInvalid)) {
                return {
                    errno: RuntimeErrorCode.MalformedThrow.errno,
                    message: `Thrown "message" is not a string.`,
                };
            }
            return errCode;
        }
    }

    visitBlock(block: Stmt.Block): BrsType {
        block.statements.forEach((statement) => this.execute(statement));
        return BrsInvalid.Instance;
    }

    visitContinueFor(statement: Stmt.ContinueFor): never {
        throw new Stmt.ContinueForReason(statement.location);
    }

    visitExitFor(statement: Stmt.ExitFor): never {
        throw new Stmt.ExitForReason(statement.location);
    }

    visitContinueWhile(expression: Stmt.ContinueWhile): never {
        throw new Stmt.ContinueWhileReason(expression.location);
    }

    visitExitWhile(expression: Stmt.ExitWhile): never {
        throw new Stmt.ExitWhileReason(expression.location);
    }

    visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        // TODO: auto-box
        if (
            expression.callee instanceof Expr.Variable ||
            expression.callee instanceof Expr.DottedGet
        ) {
            functionName = expression.callee.name.text;
        }

        // evaluate the function to call (it could be the result of another function call)
        const evaluated = this.evaluate(expression.callee);
        const callee = evaluated instanceof RoFunction ? evaluated.unbox() : evaluated;
        // evaluate all of the arguments as well (they could also be function calls)
        let args = expression.args.map(this.evaluate, this);

        if (!isBrsCallable(callee)) {
            return this.addError(
                new RuntimeError(
                    RuntimeErrorCode.NotAFunction,
                    "",
                    expression.closingParen.location
                )
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
                    if (signature.args[index].type.kind === ValueKind.Object && isBoxable(arg)) {
                        return arg.box();
                    }

                    return arg;
                });

                if (expression.callee instanceof Expr.DottedGet) {
                    mPointer = callee.getContext() ?? mPointer;
                }
                return this.inSubEnv((subInterpreter) => {
                    subInterpreter.environment.setM(mPointer);
                    let funcLoc = callee.getLocation();
                    if (funcLoc) {
                        let callLoc = expression.callee.location;
                        let sign = callee.signatures[0].signature;
                        subInterpreter.environment.addBackTrace(
                            functionName,
                            funcLoc,
                            callLoc,
                            sign
                        );
                    }
                    try {
                        return callee.call(this, ...args);
                    } catch (err: any) {
                        if (this.options.stopOnCrash && !(err instanceof Stmt.BlockEnd)) {
                            // Enable Micro Debugger on app crash
                            let errCode = RuntimeErrorCode.Internal.errno;
                            if (err instanceof RuntimeError) {
                                errCode = err.errCode.errno;
                            }
                            runDebugger(this, this.location, this.location, err.message, errCode);
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
                        new RuntimeError(RuntimeErrorCode.ReturnWithValue, "", returnLocation)
                    );
                }

                if (!returnedValue && signatureKind !== ValueKind.Void) {
                    this.addError(
                        new RuntimeError(RuntimeErrorCode.ReturnWithoutValue, "", returnLocation)
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
                    return this.addError(
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
            return this.addError(
                generateArgumentMismatchError(callee, args, expression.closingParen.location)
            );
        }
    }

    visitAtSignGet(expression: Expr.AtSignGet) {
        let source = this.evaluate(expression.obj);

        if (isIterable(source) && (source instanceof RoXMLElement || source instanceof RoXMLList)) {
            try {
                return source.getAttribute(new BrsString(expression.name.text));
            } catch (err: any) {
                return this.addError(new BrsError(err.message, expression.name.location));
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

        // TODO: Short-circuit if the source is invalid or uninitialized (consider the ?. operator)

        if (boxedSource instanceof BrsComponent) {
            if (boxedSource.hasInterface(expression.name.text)) {
                return this._dotLevel > 0
                    ? boxedSource
                    : this.addError(
                          new RuntimeError(RuntimeErrorCode.BadSyntax, "", expression.name.location)
                      );
            }
            let ifFilter = "";
            if (expression.obj instanceof Expr.DottedGet) {
                const ifName = expression.obj.name.text;
                ifFilter = boxedSource.hasInterface(ifName) ? ifName : "";
            }
            boxedSource.setFilter(ifFilter);
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

        if (boxedSource instanceof BrsComponent) {
            try {
                return boxedSource.getMethod(expression.name.text) ?? BrsInvalid.Instance;
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.name.location));
            }
        } else {
            this.addError(
                new RuntimeError(RuntimeErrorCode.DotOnNonObject, "", expression.name.location)
            );
        }
    }

    visitIndexedGet(expression: Expr.IndexedGet): BrsType {
        let source = this.evaluate(expression.obj);
        if (!isIterable(source)) {
            this.addError(
                new RuntimeError(RuntimeErrorCode.UndimmedArray, "", expression.location)
            );
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorCode.WrongNumberOfParams,
                        "",
                        expression.closingSquare.location
                    )
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
                return source.get(index, true);
            } catch (err: any) {
                this.addError(new BrsError(err.message, expression.closingSquare.location));
            }
        }
        if (source instanceof RoByteArray) {
            if (expression.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorCode.BadNumberOfIndexes,
                        "",
                        expression.closingSquare.location
                    )
                );
            }
        }
        let current: BrsType = source;
        for (let index of expression.indexes) {
            let dimIndex = this.evaluate(index);
            if (!isBrsNumber(dimIndex)) {
                this.addError(
                    new RuntimeError(RuntimeErrorCode.NonNumericArrayIndex, "", index.location)
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
                    new RuntimeError(RuntimeErrorCode.BadNumberOfIndexes, "", expression.location)
                );
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
        this.execute(statement.counterDeclaration);
        const startValue = this.evaluate(statement.counterDeclaration.value) as Int32 | Float;
        const finalValue = this.evaluate(statement.finalValue) as Int32 | Float;
        let increment = this.evaluate(statement.increment) as Int32 | Float;
        if (increment instanceof Float) {
            increment = new Int32(Math.trunc(increment.getValue()));
        }
        if (
            (startValue.getValue() > finalValue.getValue() && increment.getValue() > 0) ||
            (startValue.getValue() < finalValue.getValue() && increment.getValue() < 0)
        ) {
            // Shortcut, do not process anything
            return BrsInvalid.Instance;
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
                    location: {
                        start: {
                            line: -1,
                            column: -1,
                        },
                        end: {
                            line: -1,
                            column: -1,
                        },
                        file: "(internal)",
                    },
                },
                new Expr.Literal(increment, statement.increment.location)
            )
        );

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
                    } else if (!(reason instanceof Stmt.ContinueForReason)) {
                        // re-throw returns, runtime errors, etc.
                        throw reason;
                    }
                }

                // then increment the counter
                this.execute(step);
            }
        } else {
            while (
                (this.evaluate(new Expr.Variable(counterName)) as Int32 | Float)
                    .lessThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    this.execute(statement.body);
                } catch (reason) {
                    if (reason instanceof Stmt.ExitForReason) {
                        break;
                    } else if (!(reason instanceof Stmt.ContinueForReason)) {
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
            const message = `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is ${ValueKind.toString(
                target.kind
            )}`;
            const location = `${statement.item.location.file}(${statement.item.location.start.line})`;
            this.stderr.write(`warning,${message}: ${location}`);
            return BrsInvalid.Instance;
        }

        target.getElements().every((element) => {
            this.environment.define(Scope.Function, statement.item.text!, element);

            // execute the block
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitForReason) {
                    // break out of the loop
                    return false;
                } else if (!(reason instanceof Stmt.ContinueForReason)) {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }

            // keep looping
            return true;
        });

        return BrsInvalid.Instance;
    }

    visitWhile(statement: Stmt.While): BrsType {
        while (this.evaluate(statement.condition).equalTo(BrsBoolean.True).toBoolean()) {
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitWhileReason) {
                    break;
                } else if (!(reason instanceof Stmt.ContinueWhileReason)) {
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

        if (!isIterable(source)) {
            this.addError(new RuntimeError(RuntimeErrorCode.BadLHS, "", statement.name.location));
        }

        try {
            source.set(new BrsString(statement.name.text), value);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, statement.name.location));
        }

        return BrsInvalid.Instance;
    }

    visitIndexedSet(statement: Stmt.IndexedSet) {
        let value = this.evaluate(statement.value);
        let source = this.evaluate(statement.obj);

        if (!isIterable(source)) {
            this.addError(new RuntimeError(RuntimeErrorCode.BadLHS, "", statement.obj.location));
        }

        if (source instanceof RoAssociativeArray || source instanceof RoXMLElement) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorCode.WrongNumberOfParams,
                        "",
                        statement.closingSquare.location
                    )
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
                source.set(index, value, true);
            } catch (err: any) {
                return this.addError(new BrsError(err.message, statement.closingSquare.location));
            }
            return BrsInvalid.Instance;
        }
        if (source instanceof RoByteArray) {
            if (statement.indexes.length !== 1) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorCode.BadNumberOfIndexes,
                        "",
                        statement.closingSquare.location
                    )
                );
            }
        }

        let current: BrsType = source;
        for (let i = 0; i < statement.indexes.length; i++) {
            let index = this.evaluate(statement.indexes[i]);
            if (!isBrsNumber(index)) {
                this.addError(
                    new RuntimeError(
                        RuntimeErrorCode.NonNumericArrayIndex,
                        "",
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
                        new RuntimeError(
                            RuntimeErrorCode.BadNumberOfIndexes,
                            "",
                            statement.location
                        )
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
                    return this.addError(
                        new BrsError(err.message, statement.closingSquare.location)
                    );
                }
            } else {
                this.addError(
                    new RuntimeError(RuntimeErrorCode.BadNumberOfIndexes, "", statement.location)
                );
            }
        }

        return BrsInvalid.Instance;
    }

    visitIncrement(expression: Stmt.Increment) {
        let target = this.evaluate(expression.value);
        if (isBoxedNumber(target)) {
            target = target.unbox();
        }

        if (!isBrsNumber(target)) {
            let operation = expression.token.kind === Lexeme.PlusPlus ? "increment" : "decrement";
            this.addError(
                new TypeMismatch({
                    message: `Attempting to ${operation} value of non-numeric type`,
                    left: {
                        type: target,
                        location: expression.location,
                    },
                })
            );
        }

        let result: BrsNumber;
        if (expression.token.kind === Lexeme.PlusPlus) {
            result = target.add(new Int32(1));
        } else {
            result = target.subtract(new Int32(1));
        }

        if (expression.value instanceof Expr.Variable) {
            // store the result of the operation
            this.environment.define(Scope.Function, expression.value.name.text, result);
        } else if (expression.value instanceof Expr.DottedGet) {
            // immediately execute a dotted "set" statement
            this.execute(
                new Stmt.DottedSet(
                    expression.value.obj,
                    expression.value.name,
                    new Expr.Literal(result, expression.location)
                )
            );
        } else if (expression.value instanceof Expr.IndexedGet) {
            // immediately execute an indexed "set" statement
            this.execute(
                new Stmt.IndexedSet(
                    expression.value.obj,
                    expression.value.indexes,
                    new Expr.Literal(result, expression.location),
                    expression.value.closingSquare
                )
            );
        }

        // always return `invalid`, because ++/-- are purely side-effects in BrightScript
        return BrsInvalid.Instance;
    }

    visitUnary(expression: Expr.Unary) {
        let right = this.evaluate(expression.right);
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

    evaluate(this: Interpreter, expression: Expr.Expression): BrsType {
        this.location = expression.location;
        return expression.accept<BrsType>(this);
    }

    execute(this: Interpreter, statement: Stmt.Statement): BrsType {
        const cmd = this.checkBreakCommand();
        if (cmd === DebugCommand.BREAK) {
            if (!(statement instanceof Stmt.Block)) {
                if (!runDebugger(this, statement.location, this.location)) {
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

    // Helper methods

    /**
     * Returns the Backtrace formatted as a string or an array
     * @param loc the location of the error
     * @param asString a boolean, if true returns the backtrace as a string, otherwise as an array
     * @param bt the backtrace array
     * @returns a string or an array with the backtrace formatted
     */
    formatBacktrace(loc: Location, asString = true, bt?: BackTrace[]): RoArray | string {
        const backTrace = bt ?? this.environment.getBackTrace();
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
            const funcSign = `${func.functionName}(${args}) As ${kind}`;
            if (asString) {
                debugMsg += `#${index}  Function ${funcSign}\r\n`;
                debugMsg += `   file/line: ${this.formatLocation(loc)}\r\n`;
            } else {
                const line = loc.start.line;
                btArray.unshift(
                    new RoAssociativeArray([
                        {
                            name: new BrsString("filename"),
                            value: new BrsString(loc?.file ?? "()"),
                        },
                        { name: new BrsString("function"), value: new BrsString(funcSign) },
                        { name: new BrsString("line_number"), value: new Int32(line) },
                    ])
                );
            }
            loc = func.callLoc;
        }
        return asString ? debugMsg : new RoArray(btArray);
    }

    /**
     * Method to return the current scope of the interpreter for the REPL and Micro Debugger
     * @returns a string representation of the local variables in the current scope
     */
    formatLocalVariables(): string {
        let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
        debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
            this.environment.getM().getElements().length
        }\r\n`;
        let fnc = this.environment.getList(Scope.Function);
        fnc.forEach((value, key) => {
            const varName = key.padEnd(17);
            if (PrimitiveKinds.has(value.kind)) {
                let text = value.toString();
                let lf = text.length <= 94 ? "\r\n" : "...\r\n";
                if (value.kind === ValueKind.String) {
                    text = `"${text.substring(0, 94)}"`;
                }
                debugMsg += `${varName}${ValueKind.toString(value.kind)} val:${text}${lf}`;
            } else if (isIterable(value)) {
                const count = value.getElements().length;
                debugMsg += `${varName}${value.getComponentName()} count:${count}\r\n`;
            } else if (value instanceof BrsComponent && isUnboxable(value)) {
                const unboxed = value.unbox();
                debugMsg += `${varName}${value.getComponentName()} val:${unboxed.toString()}\r\n`;
            } else if (value.kind === ValueKind.Object) {
                debugMsg += `${varName}${value.getComponentName()}\r\n`;
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
     * Method to return the current channel formatted version
     * @returns the current channel version
     */
    getChannelVersion(): string {
        let majorVersion = parseInt(this.manifest.get("major_version")) || 0;
        let minorVersion = parseInt(this.manifest.get("minor_version")) || 0;
        let buildVersion = parseInt(this.manifest.get("build_version")) || 0;
        return `${majorVersion}.${minorVersion}.${buildVersion}`;
    }

    /**
     * Method to check if the Break Command is set in the sharedArray
     * @returns the last debug command
     */
    checkBreakCommand(): number {
        let cmd = this.debugMode ? DebugCommand.BREAK : -1;
        if (!this.debugMode) {
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
        }
        return cmd;
    }

    /**
     * Method to extract the data buffer from the sharedArray
     * @returns the data buffer as a string
     */
    readDataBuffer(): string {
        let data = "";
        this.sharedArray.slice(dataBufferIndex).every((char) => {
            if (char > 0) {
                data += String.fromCharCode(char);
            }
            return char; // if \0 stops decoding
        });
        return data;
    }

    /**
     * Emits an error via this processor's `events` property, then throws it.
     * @param err the ParseError to emit then throw
     */
    public addError(err: BrsError): never {
        if (!err.backtrace) {
            err.backtrace = this.environment.getBackTrace();
        }
        this.errors.push(err);
        this.events.emit("err", err);
        throw err;
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
