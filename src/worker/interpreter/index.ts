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
    isNumberKind,
    isIterable,
    isComparable,
    isBoxable,
    isUnboxable,
    isNumberComp,
    isStringComp,
    Int32,
    Int64,
    Float,
    Double,
    Uninitialized,
    RoArray,
    RoAssociativeArray,
    SignatureAndMismatches,
    MismatchReason,
    Callable,
    RoXMLElement,
    RoXMLList,
} from "../brsTypes";
import { shared } from "..";
import { Lexeme } from "../lexer";
import { isToken, Location } from "../lexer/Token";
import { Expr, Stmt } from "../parser";
import { BrsError, TypeMismatch } from "../Error";

import * as StdLib from "../stdlib";
import Long from "long";

import { Scope, Environment, NotFound } from "./Environment";
import { toCallable } from "./BrsFunction";
import { Runtime, BlockEnd } from "../parser/Statement";
import { FileSystem } from "./FileSystem";
import { runDebugger } from "./MicroDebugger";
import { DataType, DebugCommand, dataBufferIndex } from "../enums";

/** The set of options used to configure an interpreter's execution. */
export interface ExecutionOptions {
    root?: string;
    entryPoint?: boolean;
    stopOnCrash?: boolean;
}

/** The default set of execution options.  */
export const defaultExecutionOptions: ExecutionOptions = {
    root: process.cwd(),
    entryPoint: false,
    stopOnCrash: false,
};

export class Interpreter implements Expr.Visitor<BrsType>, Stmt.Visitor<BrsType> {
    private _environment = new Environment();
    private _startTime = Date.now();
    private _currLoc: Location = {
        file: "",
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
    };
    private _dotLevel = 0;
    private _singleKeyEvents = true; // Default Roku behavior is `true`

    readonly options: ExecutionOptions = defaultExecutionOptions;
    readonly fileSystem: Map<string, FileSystem> = new Map<string, FileSystem>();
    readonly manifest: Map<string, any> = new Map<string, any>();
    readonly deviceInfo: Map<string, any> = new Map<string, any>();
    readonly registry: Map<string, string> = new Map<string, string>();
    readonly translations: Map<string, string> = new Map<string, string>();
    readonly sharedArray = shared.get("buffer") || new Int32Array([]);

    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();

    /** The set of errors detected from executing an AST. */
    errors: (BrsError | Runtime)[] = [];

    get environment() {
        return this._environment;
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
    public onError(errorHandler: (err: BrsError | Runtime) => void) {
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
    public onErrorOnce(errorHandler: (err: BrsError | Runtime) => void) {
        this.events.once("err", errorHandler);
    }

    /**
     * Creates a new Interpreter, including any global properties and functions.
     * @param options configuration for the execution
     */
    constructor(options?: ExecutionOptions) {
        Object.assign(this.options, options);
        this.fileSystem.set("common:", new FileSystem());
        this.fileSystem.set("pkg:", new FileSystem());
        this.fileSystem.set("tmp:", new FileSystem());
        this.fileSystem.set("cachefs:", new FileSystem());
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
     */
    inSubEnv(func: (interpreter: Interpreter) => BrsType): BrsType {
        let originalEnvironment = this._environment;
        let newEnv = this._environment.createSubEnvironment();
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

    exec(statements: ReadonlyArray<Stmt.Statement>, ...args: BrsType[]) {
        let results = statements.map((statement) => this.execute(statement));
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
                throw new Error(
                    "No entry point found! You must define a function Main() or RunUserInterface()"
                );
            }
        } catch (err: any) {
            if (err instanceof Stmt.ReturnValue) {
                results = [err.value ?? BrsInvalid.Instance];
            } else if (!(err instanceof BrsError)) {
                // Swallow BrsErrors, because they should have been exposed to the user downstream.
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
        //this.environment.define(Scope.Function, "Tab", StdLib.Tab);

        let printStream = "";
        statement.expressions.forEach((printable, index) => {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma:
                        printStream += "\t";
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
                let toPrint = this.evaluate(printable);
                if (isNumberComp(toPrint) && this.isPositive(toPrint.getValue())) {
                    printStream += " ";
                }
                printStream += toPrint.toString();
            }
        });
        postMessage(`print,${printStream}\r\n`);
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

        if (requiredType && requiredType !== value.kind) {
            if (this.canAutoCast(value.kind, requiredType)) {
                value = this.autoCast(value, requiredType);
            } else {
                return this.addError(
                    new TypeMismatch({
                        message: `Attempting to assign incorrect value to statically-typed variable '${name}'`,
                        left: {
                            type: requiredType,
                            location: statement.name.location,
                        },
                        right: {
                            type: value,
                            location: statement.value.location,
                        },
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

        // NOTE: Roku's dim implementation creates a resizable, empty array for the
        //   bottom children. Resizable arrays aren't implemented yet (issue #530),
        //   so when that's added this code should be updated so the bottom-level arrays
        //   are resizable, but empty
        let dimensionValues: number[] = [];
        statement.dimensions.forEach((expr) => {
            let val = this.evaluate(expr);
            if (val.kind !== ValueKind.Int32) {
                this.addError(
                    new BrsError(`Dim expression must evaluate to an integer`, expr.location)
                );
                return BrsInvalid.Instance;
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
                        new TypeMismatch({
                            message:
                                "Type Mismatch. In a bit shift expression the right value must be >= 0 and < 32.",
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
                            message: "Type Mismatch. Attempting to bit shift non-numeric values.",
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
                        new TypeMismatch({
                            message:
                                "Type Mismatch. In a bit shift expression the right value must be >= 0 and < 32.",
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
                            message: "Type Mismatch. Attempting to bit shift non-numeric values.",
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
                            message: "Type Mismatch. Attempting to subtract non-numeric values.",
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
                            message: "Type Mismatch. Attempting to multiply non-numeric values.",
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
                            message: "Type Mismatch. Attempting to potentiate non-numeric values.",
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
                        message: "Type Mismatch. Attempting to divide non-numeric values.",
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
                            message: "Type Mismatch. Attempting to modulo non-numeric values.",
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
                            message:
                                "Type Mismatch. Attempting to integer-divide non-numeric values.",
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
                            message: `Type Mismatch. Operator "+" can't be applied to:`,
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
                        message: `Type Mismatch. Operator ">" can't be applied to:`,
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
                        message: `Type Mismatch. Operator ">=" can't be applied to:`,
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
                        message: `Type Mismatch. Operator "<" can't be applied to:`,
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
                        message: `Type Mismatch. Operator "<=" can't be applied to:`,
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
                    if (left.kind === ValueKind.Invalid) {
                        return right.equalTo(left);
                    }
                    return left.equalTo(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-primitive values.",
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
                    if (left.kind === ValueKind.Invalid) {
                        return right.equalTo(left).not();
                    }
                    return left.equalTo(right).not();
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-primitive values.",
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
                    if (isBrsBoolean(right)) {
                        return (left as BrsBoolean).and(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to 'and' boolean with non-boolean value",
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

                    if (isBrsNumber(right)) {
                        // TODO: support boolean AND with numbers
                        return left.and(right);
                    }

                    // TODO: figure out how to handle 32-bit int AND 64-bit int
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to bitwise 'and' number with non-numeric value",
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
                            message: "Type Mismatch. Attempting to 'and' unexpected values",
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
                    if (isBrsBoolean(right)) {
                        return (left as BrsBoolean).or(right);
                    } else {
                        return this.addError(
                            new TypeMismatch({
                                message:
                                    "Type Mismatch. Attempting to 'or' boolean with non-boolean value",
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
                    if (isBrsNumber(right)) {
                        return left.or(right);
                    }

                    // TODO: figure out how to handle 32-bit int OR 64-bit int
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to bitwise 'or' number with non-numeric expression",
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
                            message: "Type Mismatch. Attempting to 'or' unexpected values",
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
        this.visitBlock(statement.tryBlock);
        return BrsInvalid.Instance;
    }

    visitBlock(block: Stmt.Block): BrsType {
        block.statements.forEach((statement) => this.execute(statement));
        return BrsInvalid.Instance;
    }

    visitExitFor(statement: Stmt.ExitFor): never {
        throw new Stmt.ExitForReason(statement.location);
    }

    visitExitWhile(expression: Stmt.ExitWhile): never {
        throw new Stmt.ExitWhileReason(expression.location);
    }

    visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        // TODO: autobox
        if (
            expression.callee instanceof Expr.Variable ||
            expression.callee instanceof Expr.DottedGet
        ) {
            functionName = expression.callee.name.text;
        }

        // evaluate the function to call (it could be the result of another function call)
        const callee = this.evaluate(expression.callee);
        // evaluate all of the arguments as well (they could also be function calls)
        const args = expression.args.map(this.evaluate, this);

        if (!isBrsCallable(callee)) {
            return this.addError(
                new BrsError(
                    `'${functionName}' is not a function and cannot be called.`,
                    expression.closingParen.location
                )
            );
        }

        functionName = callee.getName();

        let satisfiedSignature = callee.getFirstSatisfiedSignature(args);

        if (satisfiedSignature) {
            try {
                let mPointer = this._environment.getRootM();
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
                            runDebugger(this, this._currLoc, this._currLoc, err.message);
                            this.options.stopOnCrash = false;
                        }
                        throw err;
                    }
                });
            } catch (reason: any) {
                if (!(reason instanceof Stmt.BlockEnd)) {
                    if (reason.message === "debug-exit") {
                        throw new Error(reason.message);
                    }
                    let message = `${reason.message}\n`;
                    if (!message.startsWith("Backtrace:") && !message.startsWith("-->")) {
                        if (reason instanceof BrsError) {
                            message = "Backtrace:\n";
                        } else if (process.env.NODE_ENV === "development") {
                            message = "";
                            // Expose the Javascript error stack trace on `development` mode
                            console.error(reason);
                        } else {
                            message = `--> Engine Error: ${reason.message}\n`;
                        }
                    }
                    if (expression.location.start.line > 0) {
                        message += `--> Function ${functionName}() called at:\n   file/line: ${expression.location.file}(${expression.location.start.line})`;
                    } else {
                        message += `--> Function ${functionName}()`;
                    }
                    throw new Error(message);
                } else if (reason.message === "debug-exit") {
                    throw new Error(reason.message);
                }

                let returnedValue = (reason as Stmt.ReturnValue).value;
                let returnLocation = (reason as Stmt.ReturnValue).location;
                const signatureKind = satisfiedSignature.signature.returns;

                if (returnedValue && signatureKind === ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of non-void type ${ValueKind.toString(
                                returnedValue.kind
                            )} ` + `from function ${callee.getName()} with void return type.`,
                            returnLocation
                        )
                    );
                }

                if (!returnedValue && signatureKind !== ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return void value from function ${callee.getName()} with non-void return type.`,
                            returnLocation
                        )
                    );
                }

                if (
                    returnedValue &&
                    isBoxable(returnedValue) &&
                    returnedValue.kind !== ValueKind.Invalid &&
                    signatureKind === ValueKind.Object
                ) {
                    returnedValue = returnedValue.box();
                }

                if (returnedValue && this.canAutoCast(returnedValue.kind, signatureKind)) {
                    returnedValue = this.autoCast(returnedValue, signatureKind);
                } else if (
                    returnedValue &&
                    signatureKind !== ValueKind.Dynamic &&
                    signatureKind !== returnedValue.kind &&
                    returnedValue.kind !== ValueKind.Invalid
                ) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of type ${ValueKind.toString(
                                returnedValue.kind
                            )}, ` +
                                `but function ${callee.getName()} declares return value of type ` +
                                ValueKind.toString(signatureKind),
                            returnLocation
                        )
                    );
                }

                return returnedValue ?? BrsInvalid.Instance;
            }
        } else {
            function formatMismatch(mismatchedSignature: SignatureAndMismatches) {
                let sig = mismatchedSignature.signature;
                let mismatches = mismatchedSignature.mismatches;

                let messageParts: string[] = [];

                let args = sig.args
                    .map((a) => {
                        let requiredArg = `${a.name.text} as ${ValueKind.toString(a.type.kind)}`;
                        if (a.defaultValue) {
                            return `[${requiredArg}]`;
                        } else {
                            return requiredArg;
                        }
                    })
                    .join(", ");
                messageParts.push(
                    `function ${functionName}(${args}) as ${ValueKind.toString(sig.returns)}:`
                );
                messageParts.push(
                    ...mismatches
                        .map((mm) => {
                            switch (mm.reason) {
                                case MismatchReason.TooFewArguments:
                                    return `* ${functionName} requires at least ${mm.expected} arguments, but received ${mm.received}.`;
                                case MismatchReason.TooManyArguments:
                                    return `* ${functionName} accepts at most ${mm.expected} arguments, but received ${mm.received}.`;
                                case MismatchReason.ArgumentTypeMismatch:
                                    return `* Argument '${mm.argName}' must be of type ${mm.expected}, but received ${mm.received}.`;
                            }
                        })
                        .map((line) => `    ${line}`)
                );

                return messageParts.map((line) => `    ${line}`).join("\n");
            }

            let mismatchedSignatures = callee.getAllSignatureMismatches(args);

            let header;
            let messages;
            if (mismatchedSignatures.length === 1) {
                header = `Provided arguments don't match ${functionName}'s signature.`;
                messages = [formatMismatch(mismatchedSignatures[0])];
            } else {
                header = `Provided arguments don't match any of ${functionName}'s signatures.`;
                messages = mismatchedSignatures.map(formatMismatch);
            }

            return this.addError(
                new BrsError([header, ...messages].join("\n"), expression.closingParen.location)
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
            return this.addError(
                new TypeMismatch({
                    message:
                        "Attempting to retrieve attribute from value not roXMLList or roXMLElement",
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
                    : this.addError(new BrsError("Syntax Error.", expression.name.location));
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
                return this.addError(new BrsError(err.message, expression.name.location));
            }
        }

        if (boxedSource instanceof BrsComponent) {
            try {
                return boxedSource.getMethod(expression.name.text) ?? BrsInvalid.Instance;
            } catch (err: any) {
                return this.addError(new BrsError(err.message, expression.name.location));
            }
        } else {
            return this.addError(
                new TypeMismatch({
                    message: "DottedGet: Attempting to retrieve property from non-iterable value",
                    left: {
                        type: source,
                        location: expression.location,
                    },
                })
            );
        }
    }

    visitIndexedGet(expression: Expr.IndexedGet): BrsType {
        let source = this.evaluate(expression.obj);
        if (!isIterable(source)) {
            this.addError(
                new TypeMismatch({
                    message: "IndexedGet: Attempting to retrieve property from non-iterable value",
                    left: {
                        type: source,
                        location: expression.location,
                    },
                })
            );
        }

        let index = this.evaluate(expression.index);
        if (!isBrsNumber(index) && !isBrsString(index)) {
            this.addError(
                new TypeMismatch({
                    message:
                        "Attempting to retrieve property from iterable with illegal index type",
                    left: {
                        type: source,
                        location: expression.obj.location,
                    },
                    right: {
                        type: index,
                        location: expression.index.location,
                    },
                })
            );
        }

        try {
            return source.get(index, true);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, expression.closingSquare.location));
        }
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
            const message = `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is ${ValueKind.toString(
                target.kind
            )}`;
            const location = `${statement.item.location.file}(${statement.item.location.start.line})`;
            postMessage(`warning,${message}: ${location}`);
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
                } else {
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
        let source = this.evaluate(statement.obj);
        let value = this.evaluate(statement.value);

        if (!isIterable(source)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on non-iterable value",
                    left: {
                        type: source,
                        location: statement.name.location,
                    },
                })
            );
        }

        try {
            source.set(new BrsString(statement.name.text), value);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, statement.name.location));
        }

        return BrsInvalid.Instance;
    }

    visitIndexedSet(statement: Stmt.IndexedSet) {
        let source = this.evaluate(statement.obj);

        if (!isIterable(source)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on non-iterable value",
                    left: {
                        type: source,
                        location: statement.obj.location,
                    },
                })
            );
        }

        let index = this.evaluate(statement.index);
        if (!isBrsNumber(index) && !isBrsString(index)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on iterable with illegal index type",
                    left: {
                        type: source,
                        location: statement.obj.location,
                    },
                    right: {
                        type: index,
                        location: statement.index.location,
                    },
                })
            );
        }

        let value = this.evaluate(statement.value);

        try {
            source.set(index, value, true);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, statement.closingSquare.location));
        }

        return BrsInvalid.Instance;
    }

    visitIncrement(expression: Stmt.Increment) {
        let target = this.evaluate(expression.value);

        if (!isBrsNumber(target)) {
            let operation = expression.token.kind === Lexeme.PlusPlus ? "increment" : "decrement";
            return this.addError(
                new BrsError(
                    `Attempting to ${operation} value of non-numeric type ${ValueKind.toString(
                        target.kind
                    )}`,
                    expression.location
                )
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
                    expression.value.index,
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

        switch (expression.operator.kind) {
            case Lexeme.Minus:
                if (isBrsNumber(right)) {
                    return right.multiply(new Int32(-1));
                } else {
                    return this.addError(
                        new BrsError(
                            `Attempting to negate non-numeric value.
                            value type: ${ValueKind.toString(right.kind)}`,
                            expression.operator.location
                        )
                    );
                }
            case Lexeme.Plus:
                if (isBrsNumber(right)) {
                    return right;
                } else {
                    return this.addError(
                        new BrsError(
                            `Attempting to apply unary positive operator to non-numeric value.
                            value type: ${ValueKind.toString(right.kind)}`,
                            expression.operator.location
                        )
                    );
                }
            case Lexeme.Not:
                if (isBrsBoolean(right)) {
                    return right.not();
                } else {
                    return this.addError(
                        new BrsError(
                            `Attempting to NOT non-boolean value.
                            value type: ${ValueKind.toString(right.kind)}`,
                            expression.operator.location
                        )
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

    visitLibrary(statement: Stmt.Library) {
        // ignore during run time, already handled by lexer/parser
        return BrsInvalid.Instance;
    }

    evaluate(this: Interpreter, expression: Expr.Expression): BrsType {
        return expression.accept<BrsType>(this);
    }

    execute(this: Interpreter, statement: Stmt.Statement): BrsType {
        const cmd = this.checkBreakCommand();
        if (cmd === DebugCommand.BREAK) {
            if (!(statement instanceof Stmt.Block)) {
                if (!runDebugger(this, statement.location, this._currLoc)) {
                    this.options.stopOnCrash = false;
                    throw new BlockEnd("debug-exit", statement.location);
                }
            }
        } else if (cmd === DebugCommand.EXIT) {
            this.options.stopOnCrash = false;
            throw new BlockEnd("debug-exit", statement.location);
        }
        this._currLoc = statement.location;
        return statement.accept<BrsType>(this);
    }

    formatLocation(location: Location = this._currLoc) {
        let formattedLocation: string;
        if (location.start.line) {
            formattedLocation = `pkg:/${location.file}(${location.start.line})`;
        } else {
            formattedLocation = `pkg:/${location.file}(??)`;
        }
        return formattedLocation;
    }

    getChannelVersion(): string {
        let majorVersion = parseInt(this.manifest.get("major_version")) || 0;
        let minorVersion = parseInt(this.manifest.get("minor_version")) || 0;
        let buildVersion = parseInt(this.manifest.get("build_version")) || 0;
        return `${majorVersion}.${minorVersion}.${buildVersion}`;
    }

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
    private addError(err: BrsError): never {
        this.errors.push(err);
        this.events.emit("err", err);
        throw err;
    }

    private canAutoCast(fromKind: ValueKind, toKind: ValueKind): boolean {
        return isNumberKind(fromKind) && isNumberKind(toKind);
    }

    private autoCast(value: BrsType, requiredType: ValueKind): BrsType {
        if (value instanceof Float || value instanceof Double || value instanceof Int32) {
            if (requiredType === ValueKind.Double) {
                return new Double(value.getValue());
            } else if (requiredType === ValueKind.Float) {
                return new Float(value.getValue());
            } else if (requiredType === ValueKind.Int32) {
                return new Int32(value.getValue());
            } else if (requiredType === ValueKind.Int64) {
                return new Int64(value.getValue());
            }
        }
        return BrsInvalid.Instance;
    }

    private isPositive(value: number | Long): boolean {
        if (value instanceof Long) {
            return value.isPositive();
        }
        return value >= 0;
    }

    private lessThan(value: number | Long, compare: number): boolean {
        if (value instanceof Long) {
            return value.lessThan(compare);
        }
        return value < compare;
    }
}
