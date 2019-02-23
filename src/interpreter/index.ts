import { EventEmitter } from "events";

import {
    BrsType,
    ValueKind,
    BrsInvalid,
    isBrsNumber,
    isBrsString,
    BrsBoolean,
    BrsString,
    isBrsBoolean,
    Int32,
    isBrsCallable,
    Uninitialized,
    BrsArray,
    isIterable,
    SignatureAndMismatches,
    MismatchReason,
    Callable,
} from "../brsTypes";

import { Lexeme } from "../lexer";
import { isToken } from "../lexer/Token";
import { Expr, Stmt } from "../parser";
import { BrsError, TypeMismatch } from "../Error";

import * as StdLib from "../stdlib";

import { Scope, Environment, NotFound } from "./Environment";
import { OutputProxy } from "./OutputProxy";
import { toCallable } from "./BrsFunction";
import { BlockEnd, StopReason, Runtime, Expression } from "../parser/Statement";
import { AssociativeArray } from "../brsTypes/components/AssociativeArray";
import MemoryFileSystem from "memory-fs";
import { BrsComponent } from "../brsTypes/components/BrsComponent";

/** The set of options used to configure an interpreter's execution. */
export interface ExecutionOptions {
    /** The base path for  */
    root: string,
    stdout: NodeJS.WriteStream,
    stderr: NodeJS.WriteStream
}

/** The default set of execution options.  Includes the `stdout`/`stderr` pair from the process that invoked `brs`. */
export const defaultExecutionOptions: ExecutionOptions = {
    root: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr
};

export class Interpreter implements Expr.Visitor<BrsType>, Stmt.Visitor<BrsType> {
    private _environment = new Environment();

    readonly stdout: OutputProxy;
    readonly stderr: OutputProxy;
    readonly temporaryVolume: MemoryFileSystem = new MemoryFileSystem();

    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();

    /** The set of errors detected from executing an AST. */
    errors: (BrsError | Runtime)[] = [];

    get environment() {
        return this._environment;
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
            }
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
     * @param outputStreams the WriteStreams to use for `stdout` and `stderr`.
     */
    constructor(outputStreams: ExecutionOptions = defaultExecutionOptions) {
        this.stdout = new OutputProxy(outputStreams.stdout);
        this.stderr = new OutputProxy(outputStreams.stderr);

        Object.keys(StdLib)
            .map(name => (StdLib as any)[name])
            .filter(func => func instanceof Callable)
            .filter((func: Callable) => {
                if (!func.name) {
                    throw new Error("Unnamed standard library function detected!");
                }

                return !!func.name;
            })
            .forEach((func: Callable) =>
                this._environment.define(Scope.Global, func.name || "", func)
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
        try {
            this._environment = newEnv;
            return func(this);
        } catch (err) {
            if (err.kind == null) {
                console.error("Runtime error encountered in BRS implementation: ", err);
            }
            throw err;
        } finally {
            this._environment = originalEnvironment;
        }
    }

    exec(statements: ReadonlyArray<Stmt.Statement>) {
        let results = statements.map((statement) => this.execute(statement));
        try {
            let maybeMain = this._environment.get({
                kind: Lexeme.Identifier,
                text: "main",
                isReserved: false,
                location: {
                    start: {
                        line: -1,
                        column: -1
                    },
                    end: {
                        line: -1,
                        column: -1
                    },
                    file: "(internal)"
                }
            });
            if (maybeMain.kind === ValueKind.Callable) {
                results = [ maybeMain.call(this) ];
            }
        } catch (err) {
            throw err;
        } finally {
            return results;
        }
    }

    visitNamedFunction(statement: Stmt.Function): BrsType {
        if (statement.name.isReserved) {
            return this.addError(
                new BrsError(`Cannot create a named function with reserved name '${statement.name.text}'`, statement.name.location)
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

        this.environment.define(Scope.Module, statement.name.text!, toCallable(statement.func, statement.name.text));
        return BrsInvalid.Instance;
    }

    visitReturn(statement: Stmt.Return): never {
        if (!statement.value) {
            throw new Stmt.ReturnValue(statement.tokens.return);
        }

        let toReturn = this.evaluate(statement.value);
        throw new Stmt.ReturnValue(statement.tokens.return, toReturn);
    }

    visitExpression(statement: Stmt.Expression): BrsType {
        return this.evaluate(statement.expression);
    }

    visitPrint(statement: Stmt.Print): BrsType {
        // the `tab` function is only in-scope while executing print statements
        this.environment.define(Scope.Function, "Tab", StdLib.Tab);

        statement.expressions.forEach( (printable, index) => {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma:
                        this.stdout.write(
                            " ".repeat(16 - (this.stdout.position() % 16))
                        );
                        break;
                    case Lexeme.Semicolon:
                        if (index === statement.expressions.length - 1) {
                            // Don't write an extra space for trailing `;` in print lists.
                            // They're used to suppress trailing newlines in `print` statements
                            break;
                        }

                        this.stdout.write(" ");
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
                this.stdout.write(
                    this.evaluate(printable).toString()
                );
            }
        });

        let lastExpression = statement.expressions[statement.expressions.length - 1];
        if (!isToken(lastExpression) || lastExpression.kind !== Lexeme.Semicolon) {
            this.stdout.write("\n");
        }

        // `tab` is only in-scope when executing print statements, so remove it before we leave
        this.environment.remove("Tab");

        return BrsInvalid.Instance;
    }

    visitAssignment(statement: Stmt.Assignment): BrsType {
        if (statement.name.isReserved) {
            return this.addError(
                new BrsError(`Cannot assign a value to reserved name '${statement.name}'`, statement.name.location)
            );
        }

        let value = this.evaluate(statement.value);
        this.environment.define(Scope.Function, statement.name.text!, value);
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
        function canCompare(left: BrsType, operator: Lexeme, right: BrsType ): boolean {
            if (left.kind === ValueKind.Invalid || right.kind === ValueKind.Invalid) {
                // anything can be checked for *equality* with `invalid`, but greater than / less than comparisons
                // are type mismatches
                return operator === Lexeme.Equal || operator=== Lexeme.LessGreater;
            }

            // and only primitive non-invalid values can be compared to each other (i.e. no `foo <> []`)
            return left.kind < ValueKind.Dynamic && right.kind < ValueKind.Dynamic;
        }

        switch (lexeme) {
            case Lexeme.Minus:
            case Lexeme.MinusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.subtract(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to subtract non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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
                            message: "Attempting to multiply non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }
            case Lexeme.Caret:
            case Lexeme.CaretEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.pow(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to exponentiate non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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
                        message: "Attempting to dividie non-numeric values.",
                        left: {
                            type: left,
                            location: expression.left.location
                        },
                        right: {
                            type: right,
                            location: expression.right.location
                        }
                    })
                );
            case Lexeme.Mod:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.modulo(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to modulo non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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
                            message: "Attempting to integer-divide non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }
            case Lexeme.Plus:
            case Lexeme.PlusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.add(right);
                } else if (isBrsString(left) && isBrsString(right)) {
                    return left.concat(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to add non-homogeneous values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }
            case Lexeme.Greater:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.greaterThan(right);
            case Lexeme.GreaterEqual:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.greaterThan(right).or(left.equalTo(right));
            case Lexeme.Less:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.lessThan(right);
            case Lexeme.LessEqual:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.lessThan(right).or(left.equalTo(right));
            case Lexeme.Equal:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.equalTo(right);
            case Lexeme.LessGreater:
                if (!canCompare(left, lexeme, right)) {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to compare non-primitive values.",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                }

                return left.equalTo(right).not();
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
                            message: "Attempting to 'and' boolean with non-boolean value",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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
                            message: "Attempting to bitwise 'and' number with non-numberic value",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to 'and' unexpected values",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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
                                message: "Attempting to 'or' boolean with non-boolean value",
                                left: {
                                    type: left,
                                    location: expression.left.location
                                },
                                right: {
                                    type: right,
                                    location: expression.right.location
                                }
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
                            message: "Attempting to bitwise 'or' number with non-numeric expression",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Attempting to 'or' unexpected values",
                            left: {
                                type: left,
                                location: expression.left.location
                            },
                            right: {
                                type: right,
                                location: expression.right.location
                            }
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

    visitBlock(block: Stmt.Block): BrsType {
        block.statements.forEach((statement) => this.execute(statement));
        return BrsInvalid.Instance;
    }

    visitExitFor(statement: Stmt.ExitFor): never {
        throw new Stmt.ExitForReason();
    }

    visitExitWhile(expression: Stmt.ExitWhile): never {
        throw new Stmt.ExitWhileReason();
    }

    visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        if (expression.callee instanceof Expr.Variable) {
            if (expression.callee.name.text) {
                functionName = expression.callee.name.text;
            }
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
                let mPointer = this._environment.getM();

                if (expression.callee instanceof Expr.DottedGet || expression.callee instanceof Expr.IndexedGet) {
                    let maybeM = this.evaluate(expression.callee.obj);
                    if (maybeM.kind === ValueKind.Object) {
                        if (maybeM instanceof AssociativeArray) {
                            mPointer = maybeM;
                        }
                    } else {
                        return this.addError(
                            new BrsError("Attempted to retrieve a function from a primitive value", expression.closingParen.location)
                        );
                    }
                }

                return this.inSubEnv(
                    (subInterpreter) => {
                        subInterpreter.environment.setM(mPointer);
                        return callee.call(this, ...args);
                    }
                );
            } catch (reason) {
                if (reason.kind == null) {
                    throw new Error("Something terrible happened and we didn't throw a `BlockEnd` instance.");
                }

                let returnedValue = (reason as Stmt.ReturnValue).value;
                let returnLocation = (reason as Stmt.ReturnValue).location;

                if (returnedValue && satisfiedSignature.signature.returns === ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of non-void type ${ValueKind.toString(returnedValue.kind)} `
                            + `from function ${callee.getName()} with void return type.`,
                            returnLocation.location
                        )
                    );
                }

                if (!returnedValue && satisfiedSignature.signature.returns !== ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return void value from function ${callee.getName()} with non-void return type.`,
                            returnLocation.location
                        )
                    );
                }

                if (returnedValue && satisfiedSignature.signature.returns !== ValueKind.Dynamic && satisfiedSignature.signature.returns !== returnedValue.kind) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of type ${ValueKind.toString(returnedValue.kind)}, `
                            + `but function ${callee.getName()} declares return value of type `
                            + ValueKind.toString(satisfiedSignature.signature.returns),
                            returnLocation.location
                        )
                    );
                }

                return returnedValue || BrsInvalid.Instance;
            }
        } else {
            function formatMismatch(mismatchedSignature: SignatureAndMismatches) {
                let sig = mismatchedSignature.signature;
                let mismatches = mismatchedSignature.mismatches;

                let messageParts = [];

                let args = sig.args.map(a => {
                    let requiredArg = `${a.name} as ${ValueKind.toString(a.type.kind)}`;
                    if (a.defaultValue) {
                        return `[${requiredArg}]`;
                    } else {
                        return requiredArg;
                    }
                }).join(", ");
                messageParts.push(`function ${functionName}(${args}) as ${ValueKind.toString(sig.returns)}:`);
                messageParts.push(
                    ...mismatches.map(mm => {
                        switch (mm.reason) {
                            case MismatchReason.TooFewArguments:
                                return `* ${functionName} requires at least ${mm.expected} arguments, but received ${mm.received}.`;
                            case MismatchReason.TooManyArguments:
                                return `* ${functionName} accepts at most ${mm.expected} arguments, but received ${mm.received}.`;
                            case MismatchReason.ArgumentTypeMismatch:
                                return `* Argument '${mm.argName}' must be of type ${mm.expected}, but received ${mm.received}.`;
                        }
                    }).map(line => `    ${line}`)
                );

                return messageParts.map(line => `    ${line}`).join("\n");
            }

            let mismatchedSignatures = callee.getAllSignatureMismatches(args);

            let header;
            let messages;
            if (mismatchedSignatures.length === 1) {
                header = `Provided arguments don't match ${functionName}'s signature.`;
                messages = [ formatMismatch(mismatchedSignatures[0]) ];
            } else {
                header = `Provided arguments don't match any of ${functionName}'s signatures.`;
                messages = mismatchedSignatures.map(formatMismatch);
            }

            return this.addError(
                new BrsError(
                    [header, ...messages].join("\n"),
                    expression.closingParen.location
                )
            );
        }
    }

    visitDottedGet(expression: Expr.DottedGet) {
        let source = this.evaluate(expression.obj);

        if (isIterable(source)) {
            try {
                return source.get(new BrsString(expression.name.text));
            } catch (err) {
                return this.addError(
                    new BrsError(err.message, expression.name.location)
                );
            }
        } else if (source instanceof BrsComponent) {
            try {
                return source.getMethod(expression.name.text) || BrsInvalid.Instance;
            } catch (err) {
                return this.addError(
                    new BrsError(err.message, expression.name.location)
                );
            }
        } else {
            throw new TypeMismatch({
                message: "Attempting to retrieve property from non-iterable value",
                left: {
                    type: source,
                    location: expression.location
                }
            });
        }
    }

    visitIndexedGet(expression: Expr.IndexedGet): BrsType {
        let source = this.evaluate(expression.obj);
        if (!isIterable(source)) {
            throw new TypeMismatch({
                message: "Attempting to retrieve property from non-iterable value",
                left: {
                    type: source,
                    location: expression.location
                }
            });
        }

        let index = this.evaluate(expression.index);
        if (!isBrsNumber(index) && !isBrsString(index)) {
            throw new TypeMismatch({
                message: "Attempting to retrieve property from iterable with illegal index type",
                left: {
                    type: source,
                    location: expression.obj.location
                },
                right: {
                    type: index,
                    location: expression.index.location
                }
            });
        }

        try {
            return source.get(index);
        } catch (err) {
            return this.addError(
                new BrsError(err.message, expression.closingSquare.location)
            );
        }
    }

    visitGrouping(expr: Expr.Grouping) {
        return this.evaluate(expr.expression);
    }

    visitFor(statement: Stmt.For): BrsType {
        // BrightScript for/to loops evaluate the counter initial value, final value, and increment
        // values *only once*, at the top of the for/to loop.
        this.execute(statement.counterDeclaration);
        const finalValue = this.evaluate(statement.finalValue);
        const increment = this.evaluate(statement.increment);

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
                            column: -1
                        },
                        end: {
                            line: -1,
                            column: -1
                        },
                        file: "(internal)"
                    }
                },
                new Expr.Literal(
                    increment,
                    statement.increment.location
                )
            )
        );

        let loopExitReason: Stmt.BlockEnd | undefined;

        while (
            this.evaluate(new Expr.Variable(counterName))
                .equalTo(finalValue)
                .not()
                .toBoolean()
        ) {
            // execute the block
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason.kind === Stmt.StopReason.ExitFor) {
                    loopExitReason = reason as BlockEnd;
                    break;
                } else {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }

            // then increment the counter
            this.execute(step);
        }

        // BrightScript for/to loops execute the body one more time when initial === final
        if (loopExitReason === undefined) {
            this.execute(statement.body);
            // they also increments the counter once more
            this.execute(step);
        }

        return BrsInvalid.Instance;
    }

    visitForEach(statement: Stmt.ForEach): BrsType {
        let target = this.evaluate(statement.target);
        if (!isIterable(target)) {
            return this.addError(
                new BrsError(
                    `Attempting to iterate across values of non-iterable type ` +
                        ValueKind.toString(target.kind),
                    statement.item.location
                )
            );
        }

        target.getElements().every(element => {
            this.environment.define(Scope.Function, statement.item.text!, element);

            // execute the block
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason.kind === Stmt.StopReason.ExitFor) {
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
                if (reason.kind && reason.kind === Stmt.StopReason.ExitWhile) {
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

    visitArrayLiteral(expression: Expr.ArrayLiteral): BrsArray {
        return new BrsArray(
            expression.elements.map(expr => this.evaluate(expr))
        );
    }

    visitAALiteral(expression: Expr.AALiteral): BrsType {
        return new AssociativeArray(
            expression.elements.map(member =>
                ({
                    name: member.name,
                    value: this.evaluate(member.value)
                })
            )
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
                        location: statement.name.location
                    }
                })
            );
        }

        try {
            source.set(new BrsString(statement.name.text), value);
        } catch (err) {
            return this.addError(
                new BrsError(err.message, statement.name.location)
            );
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
                        location: statement.obj.location
                    }
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
                        location: statement.obj.location
                    },
                    right: {
                        type: index,
                        location: statement.index.location
                    }
                })
            );
        }

        let value = this.evaluate(statement.value);

        try {
            source.set(index, value);
        } catch (err) {
            return this.addError(
                new BrsError(err.message, statement.closingSquare.location)
            );
        }

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
        } catch (err) {
            if (err instanceof NotFound) {
                return Uninitialized.Instance;
            }

            throw err;
        }
    }

    evaluate(this: Interpreter, expression: Expr.Expression): BrsType {
        return expression.accept<BrsType>(this);
    }

    execute(this: Interpreter, statement: Stmt.Statement): BrsType {
        return statement.accept<BrsType>(this);
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
}
