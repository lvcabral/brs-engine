import { Token } from "../Token";
import { Lexeme } from "../Lexeme";
import { BrsType } from "../brsTypes";
import * as BrsError from "../Error";

/** The logical region from which a particular variable or function that defines where it may be accessed from. */
export enum Scope {
    /** The set of native functions that are always accessible, e.g. `RebootSystem`. */
    Global,
    /** The set of named functions accessible from a set of files compiled together. */
    Module,
    /** The set of variables (including anonymous functions) accessible *only* from within a function body. */
    Function
}

/** An error thrown when attempting to access an uninitialized variable. */
export class NotFound extends Error {
    constructor(reason: string) {
        super(reason);
    }
}

/**
 * Holds a set of values in multiple scopes and provides access operations to them.
 */
export class Environment {
    /**
     * Functions that are always accessible.
     * @see Scope.Global
     */
    private global = new Map<string, BrsType>();
    /**
     * Named functions that are compiled together into a single module.
     * @see Scope.Module
     */
    private module = new Map<string, BrsType>();
    /**
     * Variables and anonymous functions accessible only within a function's body.
     * @see Scope.Function
     */
    private function = new Map<string, BrsType>();

    public define(scope: Scope, name: string, value: BrsType): void {
        let destination: Map<string, BrsType>;

        switch (scope) {
            case Scope.Function:
                destination = this.function;
                break;
            case Scope.Module:
                destination = this.module;
                break;
            default:
                destination = this.global;
                break;
        }

        destination.set(name.toLowerCase(), value);
    }

    public remove(name: string): void {
        this.function.delete(name.toLowerCase());
    }

    public get(name: Token): BrsType {
        let lowercaseName = name.text!.toLowerCase();
        let source = [this.function, this.module, this.global].find(scope =>
            scope.has(lowercaseName)
        );

        if (source) {
            return source.get(lowercaseName)!;
        }

        throw new NotFound(`Undefined variable '${name.text}'`);
    }

    public has(name: Token): boolean {
        let lowercaseName = name.text!.toLowerCase();
        return [this.function, this.module, this.global].find(scope => scope.has(lowercaseName)) != null;
    }

    /**
     * Creates a clone of the current environment, but without its function-scoped
     * values. Useful for creating sub-environments.
     *
     * The Reference BrightScript Implementation (RBI) doesn't currently create closures when
     * functions are created.  When a function is called, it has access only to:
     *
     * 1. Globally-defined functions (e.g. `RebootSystem`, `UCase`, et. al.)
     * 2. Named functions compiled together into a single "module"
     * 3. Parameters passed into the function
     *
     * @returns a copy of this environment but with no function-scoped values.
     */
    public createSubEnvironment(): Environment {
        let newEnvironment = new Environment();
        newEnvironment.global = this.global;
        newEnvironment.module = this.module;

        return newEnvironment;
    }
}